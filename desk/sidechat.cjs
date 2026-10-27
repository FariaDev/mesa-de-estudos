'use strict';

/* Chat lateral da Mesa: segundo chat com história própria, isolado do principal.
 *
 * Este módulo é o host PURO do canal lateral: store em disco, escopo por
 * conversa principal/matéria, snapshot de contexto do principal, máquina de
 * entrega (transmitting → accepted/refused/uncertain, nunca reenvio automático)
 * e roteamento de eventos/permissões. O que nunca pode divergir mora no núcleo
 * Bend (`core/sidechat.bend` + leis/provas): `scoped`, `recoversTo`,
 * `eventAllowed`, `canPrompt`, `contextChanged`.
 *
 * Invariantes do host:
 *  - ABRIR/RETOMAR não recopia o principal: o snapshot congela na criação e só
 *    `context()` (explícito) ou `fresh:true` trocam; reabrir é read-only.
 *  - RETOMAR do disco recupera envio em voo de OUTRA execução (transmitting →
 *    uncertain); envio vivo do próprio processo nunca é marcado incerto.
 *  - A fala do usuário entra no histórico do canal UMA vez, no envio, com o
 *    texto original; o eco `message_end` role=user do motor é suprimido (o
 *    motor recebe o digest do principal, mas a UI nunca o vê como fala).
 *  - `agent_settled` que chega antes do aceite não vira `accepted` depois.
 *  - Não há fila/follow-up do lado: com o canal ocupado, o envio é recusado
 *    nos DOIS motores (`canPrompt`/Aguarde) — sem turno anterior em voo, um
 *    terminal antigo não fecha o aceite novo nem mascara a incerteza do novo.
 *  - Desfecho tardio (aceite/recusa que resolve depois do close/suspend/troca)
 *    não regrava o descritor interrompido nem o de outro prompt.
 *
 * As dependências entram por injeção para o módulo ser exercitado sem Electron:
 *  - current()    → {session, courseId, engine} da conversa principal AGORA
 *  - snapshot({refs}) → {mainSession, refs, study, at, digest, key} do principal
 *  - validPdf(p)  → valida contra a biblioteca autorizada (lança se fora)
 *  - createEngine({engine,id,descriptor,onEvent}) → canal do motor (Pi/Claude)
 *  - emit(payload) → `{id,engine,event}` para o renderer
 *
 * O armazenamento fica em `runtime/sidechats/`: um descritor JSON por chat,
 * uma sessão JSONL por chat Pi e `index.json` (conversa principal → id atual).
 * Tudo é gravado de forma atômica; nada antigo é apagado por troca de escopo. */

const crypto = require('node:crypto');
const {boundMessages} = require('./src/agents/conversations.cjs');
const conversations = require('./src/agents/conversations.cjs');
const {MAX_DRAFT} = require('./state-adapter.cjs');
const core = require('./src/generated/sidechat.core.js').default;
const {message: uiMsg} = require('./src/i18n.mjs');
const {CONTEXT_END_MARKER, CORE_BY_STATUS, ID_RE, MAX_DIALOG_IDS, MAX_MESSAGE_ID, SCHEMA_VERSION, STATUS_BY_CORE, appendMessage, conversationList, descriptorPath, displayMessages, displayUserText, fail, isPlainObject, normalizeRefs, nowMs, piSessionPath, readDescriptorRaw, readIndex, saveDescriptor, sidechatsDir, validDescriptor, writeIndex} = require('./sidechat-store.cjs');

/* ---------- manager ---------- */

/* Claude e OpenCode (#74) guardam o turno num descritor nativo, no campo
   `claude` do descritor lateral (o nome é de quando só havia o Claude). */
const isNative = (engine) => conversations.NATIVE_ENGINES.includes(engine);

/**
 * Chats laterais da conversa principal: escopo, limites, motor e gravação.
 * @param {{runtime: string, current: () => {session: string, courseId: string, engine: string, courseName: string, model?: string|null, effort?: string|null},
 *   snapshot: (request: {refs: Array<{path: string, page: number}>}) => object, validPdf: (path: string) => string,
 *   createEngine: (request: {engine: string, id: string, descriptor: {claude?: string|null, session?: string|null}, onEvent: (event: object) => void}) => object,
 *   emit: (payload: object) => void, log: (scope: string, line: string) => void, now?: () => number}} options
 */
function createSideChatManager({runtime, current, snapshot, validPdf, createEngine, emit, log, now = Date.now} = {}) {
  if (typeof runtime !== 'string' || !runtime) fail('runtime obrigatório para o chat lateral.');
  if (typeof current !== 'function') fail('current() obrigatório para o chat lateral.');
  if (typeof snapshot !== 'function') fail('snapshot() obrigatório para o chat lateral.');
  if (typeof validPdf !== 'function') fail('validPdf() obrigatório para o chat lateral.');
  if (typeof createEngine !== 'function') fail('createEngine() obrigatório para o chat lateral.');

  /* id → {descriptor, channel, pending:Set, pendingUser, settledTurn, generation}.
     O canal nasce sob demanda (nenhum processo é iniciado por abrir/ler/atualizar
     contexto). `pendingUser` é a fala visível registrada no envio (identidade
     estável para a recusa comprovada tirar de volta); `settledTurn` guarda um
     `agent_settled` que chegou antes do aceite do mesmo envio; `generation`
     invalida desfechos tardios quando a entrada é fechada (suspend/troca/fresh). */
  const active = new Map();

  function newEntry(descriptor) {
    return {descriptor, channel: null, pending: new Set(), pendingUser: null, settledTurn: null, generation: 0};
  }

  function report(source, error) {
    try {
      log?.(source, String(error?.message || error));
    } catch {}
  }

  function recover(descriptor) {
    const status = descriptor.delivery?.status;
    if (!status) return;
    /* O núcleo espera o nó etiquetado (`{$:'SidechatStatus.X'}`); a resposta
       volta etiquetada e vira o nome do host. */
    const nextNode = core.recoversTo({$: `SidechatStatus.${CORE_BY_STATUS[status]}`});
    const next = STATUS_BY_CORE[String(nextNode?.$ || '').replace(/^SidechatStatus\./, '')] || status;
    if (next !== status) {
      descriptor.delivery = {...descriptor.delivery, status: next};
      descriptor.updatedAt = now();
      saveDescriptor(runtime, descriptor);
    }
  }

  function resolve(input) {
    const id = typeof input === 'string' ? input : input?.id;
    if (typeof id !== 'string' || !ID_RE.test(id)) fail('Chat lateral inválido.');
    const descriptor = readDescriptorRaw(runtime, id);
    if (!descriptor) fail(uiMsg('err.sidechat.notFound'));
    const ctx = current();
    if (!core.scoped(descriptor.mainSession, ctx.session, descriptor.courseId, ctx.courseId)) {
      fail(uiMsg('err.sidechat.wrongSession'));
    }
    if (descriptor.engine !== ctx.engine) fail(uiMsg('err.sidechat.engineChanged'));
    const existing = active.get(id);
    if (existing && existing.descriptor.mainSession === descriptor.mainSession) {
      /* O descritor em memória é a fonte viva; relê o arquivo só para o
         contrato de tipos. Preserva o canal existente. Sem canal vivo, o envio
         em voo de uma execução anterior é recuperado aqui (nunca no meio de um
         envio vivo). */
      if (!existing.channel) {
        recover(existing.descriptor);
        hydrateClaudeUncertainty(existing);
      }
      activate(existing);
      return existing;
    }
    /* Sem canal vivo, o arquivo manda: envio em voo de uma execução anterior
       vira incerto aqui e nunca é reenviado sozinho. */
    recover(descriptor);
    const entry = newEntry(descriptor);
    hydrateClaudeUncertainty(entry);
    activate(entry);
    return entry;
  }

  function activeIdForSession(session) {
    for (const [id, entry] of active) {
      if (entry.descriptor.mainSession === session) return id;
    }
    return '';
  }

  function closeEntry(id, entry, reason) {
    const channel = entry.channel;
    entry.channel = null;
    entry.pending = new Set();
    /* Qualquer desfecho que resolva depois deste ponto pertence a uma entrada
       que já foi interrompida: não pode gravar accepted/refused no descritor. */
    entry.generation += 1;
    if (!channel) return;
    try {
      channel.close();
    } catch (error) {
      report('sidechat', `falha ao fechar ${id}${reason ? ` (${reason})` : ''}: ${error?.message || error}`);
    }
  }

  function markInterrupted(entry) {
    if (entry.descriptor.delivery?.status !== 'transmitting') return;
    entry.descriptor.delivery = {...entry.descriptor.delivery, status: 'uncertain'};
    entry.descriptor.updatedAt = now();
    try {
      saveDescriptor(runtime, entry.descriptor);
    } catch (error) {
      report('sidechat', `falha ao guardar incerteza de ${entry.descriptor.id}: ${error?.message || error}`);
    }
  }

  function activate(entry) {
    const ctx = current();
    for (const [id, other] of [...active]) {
      if (other === entry) continue;
      /* Um canal ativo por conversa principal: ao abrir/trocar, o anterior para.
         Envio em voo vira incerto (nunca reenvia sozinho); o descritor antigo
         continua recuperável. */
      if (other.descriptor.mainSession === entry.descriptor.mainSession || !core.scoped(other.descriptor.mainSession, ctx.session, other.descriptor.courseId, ctx.courseId)) {
        markInterrupted(other);
        closeEntry(id, other, other.descriptor.mainSession === entry.descriptor.mainSession ? 'canal substituído' : 'outra sessão');
        active.delete(id);
      }
    }
    active.set(entry.descriptor.id, entry);
  }

  function routeEvent(id, channel, event) {
    const entry = active.get(id);
    if (!entry || entry.channel !== channel) return; /* canal antigo/recriado */
    const ctx = current();
    if (!core.scoped(entry.descriptor.mainSession, ctx.session, entry.descriptor.courseId, ctx.courseId)) return; /* sessão antiga */
    if (!core.eventAllowed(id, activeIdForSession(ctx.session) || '')) return; /* não é o canal ativo agora */
    const descriptor = entry.descriptor;
    if (event?.type === 'extension_ui_request' && typeof event.id === 'string' && event.id) {
      entry.pending.add(event.id);
      while (entry.pending.size > MAX_DIALOG_IDS) entry.pending.delete(entry.pending.values().next().value);
    }
    if (event?.type === 'agent_request_cancelled' && typeof event.id === 'string') entry.pending.delete(event.id);
    if (event?.type === 'message_end') {
      const role = event.message?.role;
      if (role === 'user') {
        /* Eco do motor com o texto contextual (digest + fala). A fala visível
           já foi registrada UMA vez no envio (pendingUser); reentrar aqui
           duplicaria e exporia o bloco interno — não entra no cache nem sai
           para a UI. */
        return;
      }
      if (descriptor.engine === 'pi' && appendMessage(descriptor, event.message)) {
        descriptor.updatedAt = now();
        saveDescriptor(runtime, descriptor);
      }
    }
    if (event?.type === 'agent_settled' && descriptor.delivery) {
      if (descriptor.delivery.status === 'accepted') {
        descriptor.delivery = {...descriptor.delivery, status: event.uncertain === true ? 'uncertain' : 'settled'};
        descriptor.updatedAt = now();
        saveDescriptor(runtime, descriptor);
      } else if (descriptor.delivery.status === 'transmitting') {
        /* O turno terminou antes de o aceite chegar (resposta inteira síncrona).
           Guarda para o aceite não marcar `accepted` depois de `settled`. */
        entry.settledTurn = {id: descriptor.delivery.id, uncertain: event.uncertain === true};
      }
    }
    emit?.({id, engine: descriptor.engine, event});
  }

  function ensureChannel(entry) {
    if (entry.channel) return entry.channel;
    const descriptor = entry.descriptor;
    if (isNative(descriptor.engine)) {
      conversations.recoverClaudeConversation(descriptor.claude, {runtime});
      const record = conversations.readClaudeConversation(descriptor.claude, {runtime});
      if (!record) fail(uiMsg('err.sidechat.recordMissing'));
    }
    let channel;
    channel = createEngine({engine: descriptor.engine, id: descriptor.id, descriptor, onEvent: (event) => routeEvent(descriptor.id, channel, event)});
    entry.channel = channel;
    return channel;
  }

  /* Histórico de exibição. O cache do Claude guarda o texto enviado (com o
     envelope de contexto); a projeção tira o bloco sem tocar no arquivo. O do
     Pi é registro de falas limpas — a projeção é defesa para descritores
     antigos que tenham guardado o eco do motor. */
  function storedMessages(descriptor, channel) {
    if (descriptor.engine === 'pi') {
      return displayMessages(Array.isArray(descriptor.messages) ? descriptor.messages : []);
    }
    if (channel && Array.isArray(channel.messages?.())) return displayMessages(channel.messages());
    try {
      return displayMessages(conversations.readClaudeConversation(descriptor.claude, {runtime})?.messages || []);
    } catch {
      return [];
    }
  }

  /* Recuperação do descritor NATIVO do Claude sem criar canal/processo: o
     adaptador grava `accepted`/`transmitting` e uma execução que morreu no meio
     do turno não tem terminal. A previsão de `recoverClaudeConversation`
     (em voo → incerto) vale para o lado também; aplicá-la aqui deixa payload e
     ledger coerentes ANTES de qualquer novo envio. Não é chamada com canal vivo
     (o canal manda) e settled/refused não são tocados. */
  function hydrateClaudeUncertainty(entry) {
    const descriptor = entry.descriptor;
    if (entry.channel || !isNative(descriptor.engine)) return false;
    const status = descriptor.delivery?.status;
    if (status !== 'transmitting' && status !== 'accepted') return false;
    let record;
    try {
      record = conversations.recoverClaudeConversation(descriptor.claude, {runtime});
    } catch (error) {
      report('sidechat', `falha ao recuperar a entrega Claude de ${descriptor.id}: ${error?.message || error}`);
      return false;
    }
    if (record?.delivery?.status !== 'uncertain') return false;
    descriptor.delivery = {...descriptor.delivery, status: 'uncertain'};
    descriptor.updatedAt = now();
    try {
      saveDescriptor(runtime, descriptor);
    } catch (error) {
      report('sidechat', `falha ao guardar incerteza de ${descriptor.id}: ${error?.message || error}`);
    }
    return true;
  }

  function uncertainOf(entry) {
    if (entry.channel?.isUncertain?.() === true) return true;
    const status = entry.descriptor.delivery?.status;
    if (status === 'uncertain') return true;
    /* Sem canal vivo, um aceite Claude persistido pelo adaptador pode ser de
       execução que morreu antes do terminal: a mesma previsão da recuperação
       (transmitting/accepted/uncertain → incerto) é exibida sem criar canal. */
    if (!entry.channel && isNative(entry.descriptor.engine) && (status === 'transmitting' || status === 'accepted')) {
      try {
        const native = conversations.readClaudeConversation(entry.descriptor.claude, {runtime})?.delivery?.status;
        return native === 'transmitting' || native === 'accepted' || native === 'uncertain';
      } catch {
        return false;
      }
    }
    return false;
  }

  function payloadFor(entry) {
    const descriptor = entry.descriptor;
    const channel = entry.channel;
    return {
      id: descriptor.id,
      engine: descriptor.engine,
      messages: storedMessages(descriptor, channel),
      draft: descriptor.draft || '',
      busy: (channel?.isBusy?.() === true) || descriptor.delivery?.status === 'transmitting',
      uncertain: uncertainOf(entry),
      context: {
        mainSession: descriptor.context.mainSession,
        refs: descriptor.context.refs,
        study: descriptor.context.study,
        at: descriptor.context.at,
      },
      delivery: descriptor.delivery ? {status: descriptor.delivery.status, at: descriptor.delivery.at} : null,
      createdAt: descriptor.createdAt,
      updatedAt: descriptor.updatedAt,
    };
  }

  function snapshotOrFail(refs) {
    const clean = normalizeRefs(refs).map((ref) => ({...ref, path: validPdf(ref.path)}));
    const ctx = current();
    const snap = snapshot({refs: clean});
    if (!isPlainObject(snap) || snap.mainSession !== ctx.session || typeof snap.digest !== 'string' || typeof snap.key !== 'string') {
      fail(uiMsg('err.sidechat.copyFail'));
    }
    return {
      mainSession: snap.mainSession,
      refs: normalizeRefs(snap.refs),
      study: isPlainObject(snap.study) ? snap.study : {},
      at: nowMs(snap.at) || now(),
      digest: snap.digest,
      key: snap.key,
    };
  }

  function applyContext(entry, snap) {
    entry.descriptor.context = snap;
    entry.descriptor.updatedAt = now();
    saveDescriptor(runtime, entry.descriptor);
  }

  function newDescriptor(ctx, snap) {
    const id = `sc-${crypto.randomUUID()}`;
    const descriptor = {
      schemaVersion: SCHEMA_VERSION,
      id,
      engine: ctx.engine,
      courseId: ctx.courseId,
      mainSession: ctx.session,
      createdAt: now(),
      updatedAt: now(),
      draft: '',
      messages: [],
      delivery: null,
      context: snap,
      contextDeliveredKey: '',
      session: ctx.engine === 'pi' ? piSessionPath(runtime, id) : null,
      /* O lateral nativo nasce no modelo e no esforço da principal (v1.0.2), como o Pi. */
      claude: isNative(ctx.engine) ? conversations.createClaudeConversation({runtime, courseId: ctx.courseId, engine: ctx.engine, ...(ctx.model ? {model: ctx.model} : {}), ...(ctx.effort ? {effort: ctx.effort} : {})}) : null,
    };
    if (!validDescriptor(descriptor, id)) fail(uiMsg('err.sidechat.createFail'));
    saveDescriptor(runtime, descriptor);
    return descriptor;
  }

  return {
    /* Abre/retoma o chat lateral da conversa principal atual. `fresh:true` cria
       um novo (o anterior fica preservado em disco, fora do índice).
       Retomar NÃO recopia o principal: o snapshot da abertura original fica
       congelado até uma atualização explícita (`context()`). Só um chat novo
       (ou `fresh:true`) copia agora. Envio em voo de execução anterior é
       recuperado ao retomar do disco; envio vivo não é tocado. */
    open(input = {}) {
      if (!isPlainObject(input)) fail('Pedido inválido.');
      if (input.fresh !== undefined && typeof input.fresh !== 'boolean') fail('Pedido inválido.');
      /* A forma das refs é validada sempre; numa retomada elas são ignoradas
         (o snapshot congelado manda) — só um chat novo copia. */
      normalizeRefs(input.refs);
      const ctx = current();
      let entry;
      if (input.fresh !== true) {
        const mapping = readIndex(runtime);
        const existing = readDescriptorRaw(runtime, mapping[ctx.session]);
        if (existing && existing.engine === ctx.engine && core.scoped(existing.mainSession, ctx.session, existing.courseId, ctx.courseId)) {
          const live = active.get(existing.id);
          entry = live || newEntry(existing);
          if (!entry.channel) {
            recover(entry.descriptor);
            hydrateClaudeUncertainty(entry);
          }
          if (!live) activate(entry);
          return payloadFor(entry);
        }
      }
      const snap = snapshotOrFail(input.refs);
      if (snap.mainSession !== ctx.session) fail(uiMsg('err.sidechat.mainChanged'));
      const descriptor = newDescriptor(ctx, snap);
      const mapping = readIndex(runtime);
      mapping[ctx.session] = descriptor.id;
      writeIndex(runtime, mapping);
      entry = newEntry(descriptor);
      activate(entry);
      return payloadFor(entry);
    },

    /* Lê/ativa sem tocar no motor. */
    read(input = {}) {
      const entry = resolve(input);
      activate(entry);
      return payloadFor(entry);
    },

    async prompt(input = {}) {
      if (!isPlainObject(input)) fail('Pedido inválido.');
      const entry = resolve(input);
      const descriptor = entry.descriptor;
      if (typeof input.text !== 'string' || !input.text.trim()) fail('Mensagem inválida.');
      if (input.text.length > MAX_DRAFT) fail(uiMsg('err.sidechat.tooLong'));
      if (descriptor.delivery?.status === 'transmitting') {
        return {sent: false, retryable: true, error: uiMsg('err.sidechat.pending')};
      }
      if (isNative(descriptor.engine) && uncertainOf(entry)) {
        return {sent: false, retryable: false, uncertain: true, error: uiMsg('err.sidechat.uncertain')};
      }
      /* As refs persistidas no snapshot podem ter saído da biblioteca desde a
         abertura (configuração/matéria mudou). O snapshot NÃO é trocado em
         silêncio: recusa clara e o usuário atualiza o contexto. */
      const context = descriptor.context;
      const contextPaths = (context.refs || []).map((ref) => ref.path);
      let readPaths = contextPaths;
      if (isNative(descriptor.engine)) {
        try {
          readPaths = contextPaths.map((refPath) => validPdf(refPath));
        } catch {
          return {
            sent: false,
            retryable: true,
            error: uiMsg('err.sidechat.refLeft'),
          };
        }
      }
      let channel;
      try {
        channel = ensureChannel(entry);
      } catch (error) {
        return {sent: false, retryable: false, error: String(error?.message || error)};
      }
      if (isNative(descriptor.engine) && uncertainOf(entry)) {
        return {sent: false, retryable: false, uncertain: true, error: uiMsg('err.sidechat.uncertain')};
      }
      /* O lateral NÃO tem fila nem follow-up: com o canal ocupado o envio é
         recusado nos DOIS motores (mesma regra `canPrompt`). Sem um turno
         anterior em voo, um terminal antigo não pode fechar o aceite novo —
         é o que dispensa identidade de turno nos eventos do Pi. */
      const mustWait = channel.isBusy?.() === true;
      if (!core.canPrompt(mustWait, descriptor.delivery?.status === 'transmitting')) {
        return {sent: false, retryable: true, error: uiMsg('err.sidechat.waitTurn')};
      }
      const includeContext = !!context.digest && core.contextChanged(descriptor.contextDeliveredKey || '', context.key || '');
      const text = input.text.trim();
      /* O envelope fecha o bloco interno: o que vem depois é a fala do usuário,
         exatamente como ele escreveu. */
      const message = includeContext ? `${context.digest}${CONTEXT_END_MARKER}${text}` : text;
      const promptId = crypto.randomUUID();
      /* A fala visível entra UMA vez, antes de qualquer evento do motor: ordem
         garantida mesmo quando o eco/assistant chegam antes do aceite, e a
         recusa comprovada tira a MESMA referência de volta. */
      const userMessage = {role: 'user', content: [{type: 'text', text}]};
      appendMessage(descriptor, userMessage);
      entry.pendingUser = userMessage;
      entry.settledTurn = null;
      descriptor.delivery = {id: promptId, status: 'transmitting', at: now()};
      descriptor.updatedAt = now();
      saveDescriptor(runtime, descriptor); /* gravado ANTES de qualquer escrita no motor */
      /* Geração do envio: `closeEntry` invalida desfechos que resolvem depois
         do suspend/troca/fresh. Um ACK/recusa tardio não pode gravar accepted/
         refused nem consumir contexto de um registro já interrompido. */
      const generation = entry.generation;
      const stillCurrent = () =>
        entry.generation === generation
        && entry.channel === channel
        && active.get(descriptor.id) === entry
        && descriptor.delivery?.id === promptId;
      try {
        await channel.prompt({
          id: promptId,
          text: message,
          readPaths,
          running: channel.isBusy?.() === true,
        });
      } catch (error) {
        if (!stillCurrent()) {
          /* Interrompido: o `uncertain` do markInterrupted já está no disco. O
             desfecho tardio não rebaixa nem mexe em histórico/contexto. */
          return {sent: false, retryable: false, uncertain: true, error: uiMsg('err.sidechat.interrupted')};
        }
        const refused = error?.notSent === true;
        if (refused && entry.pendingUser === userMessage) {
          const list = Array.isArray(descriptor.messages) ? descriptor.messages.filter((message) => message !== userMessage) : [];
          descriptor.messages = boundMessages(list);
        }
        if (entry.pendingUser === userMessage) entry.pendingUser = null;
        descriptor.delivery = {id: promptId, status: refused ? 'refused' : 'uncertain', at: now()};
        descriptor.updatedAt = now();
        saveDescriptor(runtime, descriptor);
        return {sent: false, retryable: refused, uncertain: !refused, error: String(error?.message || error)};
      }
      if (!stillCurrent()) {
        return {sent: false, retryable: false, uncertain: true, error: uiMsg('err.sidechat.interrupted')};
      }
      entry.pendingUser = null;
      const settled = entry.settledTurn?.id === promptId ? entry.settledTurn : null;
      entry.settledTurn = null;
      descriptor.delivery = {id: promptId, status: settled ? (settled.uncertain ? 'uncertain' : 'settled') : 'accepted', at: now()};
      if (includeContext) descriptor.contextDeliveredKey = context.key || '';
      descriptor.updatedAt = now();
      saveDescriptor(runtime, descriptor);
      /* `streaming` é medido no canal AGORA: se o turno inteiro já terminou
         antes do aceite, a UI não fica presa esperando evento que já veio. */
      return {sent: true, id: descriptor.id, engine: descriptor.engine, streaming: channel.isBusy?.() === true};
    },

    /* Cancela SÓ o canal lateral; nada do principal é tocado. */
    async abort(input = {}) {
      const entry = resolve(input);
      if (!entry.channel) return {aborted: false};
      try {
        const result = await entry.channel.abort();
        return {aborted: true, result};
      } catch (error) {
        return {aborted: false, error: String(error?.message || error)};
      }
    },

    /* Rascunho próprio do lateral. */
    save(input = {}) {
      if (!isPlainObject(input)) fail('Pedido inválido.');
      const entry = resolve(input);
      if (typeof input.draft !== 'string') fail('Rascunho inválido.');
      entry.descriptor.draft = input.draft.slice(0, MAX_DRAFT);
      entry.descriptor.updatedAt = now();
      saveDescriptor(runtime, entry.descriptor);
      return {ok: true, draft: entry.descriptor.draft};
    },

    /* Atualização EXPLÍCITA do contexto (refs novas validadas pela biblioteca).
       Não envia nada: o próximo prompt leva o snapshot novo. */
    context(input = {}) {
      if (!isPlainObject(input)) fail('Pedido inválido.');
      const entry = resolve(input);
      const snap = snapshotOrFail(input.refs);
      applyContext(entry, snap);
      return payloadFor(entry);
    },

    /* Resposta de permissão/pergunta roteada ao canal certo. */
    respond(input = {}) {
      if (!isPlainObject(input)) fail('Pedido inválido.');
      const entry = resolve(input);
      const response = input.response;
      if (!isPlainObject(response) || typeof response.id !== 'string' || !response.id || response.id.length > MAX_MESSAGE_ID) {
        fail('Resposta inválida.');
      }
      if (!entry.channel) fail(uiMsg('err.sidechat.noPending'));
      if (!entry.pending.has(response.id)) fail(uiMsg('err.sidechat.noDialog'));
      const result = entry.channel.respond(response);
      if (result && result.ok === false) fail(uiMsg('err.dialog.notAccepted'));
      entry.pending.delete(response.id);
      return {ok: true};
    },

    /* Troca de matéria/conversa ou encerramento: fecha e interrompe o canal
       ativo, guardando envio em voo como incerto (nunca reenvia sozinho). Os
       descritores continuam recuperáveis pela conversa de origem. */
    suspend(reason = '') {
      let closed = 0;
      for (const [id, entry] of [...active]) {
        markInterrupted(entry);
        closeEntry(id, entry, reason);
        active.delete(id);
        closed += 1;
      }
      return {closed};
    },

    /* Só para testes/diagnóstico: não inicia motor. */
    peek(id) {
      return readDescriptorRaw(runtime, id);
    },
    activeIds() {
      return [...active.keys()];
    },
    isBusy() {
      return [...active.values()].some(entry=>entry.channel?.isBusy?.()===true||entry.descriptor.delivery?.status==='transmitting');
    },
  };
}

module.exports = {
  createSideChatManager,
  conversationList,
  normalizeRefs,
  displayUserText,
  ID_RE,
  MAX_DRAFT,
  SCHEMA_VERSION,
  sidechatsDir,
  descriptorPath,
};
