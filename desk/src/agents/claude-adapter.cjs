/* Ponte isolada Mesa ↔ Claude Code original (fase 1, experimental — rodada 3).
 *
 * Esta é a única superfície que o main deve importar do motor Claude. O
 * transporte é o Agent SDK OFICIAL (@anthropic-ai/claude-agent-sdk 0.3.301,
 * testado com o CLI 2.1.301), com `import()` dinâmico e
 * `pathToClaudeCodeExecutable` apontando sempre para o Claude Code do usuário,
 * numa versão dentro da faixa aceita (#51, ver claude-environment.cjs) — nunca
 * para o binário que o pacote do SDK instala, Pi, proxy, token copiado ou flag
 * privada.
 *
 * Contrato congelado:
 *   const a = new ClaudeAdapter({conversationId, sessionId, resume, cwd,
 *     claudePath, systemPrompt, env, queryFactory, sdkLoader, persistDelivery,
 *     timeoutMs, toolPolicy, permissionTtlMs, selection, persistSelection,
 *     controlsTimeoutMs, priorMessages});
 *   a.on('event', e => ...);                       // eventos canônicos
 *   await a.connect();                             // sem chamada de modelo
 *   await a.initializeControls();                  // AÇÃO EXPLÍCITA: cria/reusa
 *                                                  // a Query sem prompt, lê o
 *                                                  // catálogo e restaura a escolha
 *   a.setToolPolicy(policy);                       // troca a política sem turno
 *   await a.setControls({model, effort}, {persistSelection}); // só ocioso
 *   a.controlsSnapshot();                          // seletor/estados seguros
 *   await a.send({id, text, images});              // aceite = replay/correlação
 *   await a.send({id, text, delivery: 'steer'});   // turno em voo (#58)
 *   await a.commands(); await a.command({id, name, text});
 *   await a.compact({customInstructions});         // fim = compact_result
 *   a.sessionUsage();                              // medidor ou null
 *   a.respond({id, confirmed, cancelled});         // permissões concretas
 *   a.respond({id, answers});                      // pergunta (AskUserQuestion)
 *   await a.cancel();                              // interrupt; busy até result
 *   await a.history();                             // getSessionMessages oficial
 *   a.close();                                     // encerra só a própria Query
 *
 * Uso de tokens: cada `message_end` de assistente carrega `message.usage` no
 * formato que o host consome (`input`/`output`/`cacheRead`/`cacheWrite`),
 * mapeado de `message.message.usage` (`input_tokens`, `output_tokens`,
 * `cache_read_input_tokens`, `cache_creation_input_tokens`). Só métrica
 * REPORTADA entra (ausente/nulo fica de fora — nunca zero inventado; 0 real
 * fica 0) e o par de cache sai separado, sem pré-soma (quem soma é o host). A
 * CLI pode dividir UMA resposta em vários quadros com o mesmo `message.id`,
 * todos com o mesmo uso final: só o primeiro quadro com uso reportado emite,
 * para a mesma rodada não ser somada duas vezes.
 *
 * Histórico importado: `priorMessages` é o prefixo já normalizado que o host
 * precisa preservar (ex.: transcrição importada que só entrou no system prompt
 * do primeiro turno nativo). `history()` devolve esse prefixo seguido do
 * histórico nativo, sem repetir entradas iguais — inclusive quando o cache do
 * descritor já contém mensagens nativas. Sem a opção, `history()` continua
 * devolvendo só o histórico nativo.
 *
 * Modelo/esforço (controles da rodada 3, somente APIs do SDK PINADO 0.3.301):
 * a escolha desejada vive em `selection` e é separada do modelo OBSERVADO
 * (`_model`, vindo do init nativo). `initializeControls()` é a única porta que
 * cria a Query sem prompt; `connect()`/health continuam só versão/auth. O
 * catálogo sanitizado vem de `Query.supportedModels()` (fallback
 * `initializationResult().models`), nunca de nomes fixados em código, e só o
 * NOME do provedor da conta é retido (nunca e-mail/organização/plano). A
 * restauração usa `query.setModel(model || undefined)` e
 * `query.applyFlagSettings({effortLevel: effort || null})`; `setControls()`
 * valida o catálogo, chama o nativo, só então persiste (`persistSelection`) e
 * reaplica o estado anterior se algo falhar. Falha de rollback marca o
 * adaptador como bloqueado: nenhum envio novo passa até um adaptador novo —
 * nunca existe descritor "meio trocado" nem escolha silenciosamente ignorada.
 * Catálogo ausente = seletores desligados; escolha explícita inválida/ausente
 * RECUSA o envio antes de transmitir (nada de fallback silencioso).
 *
 * Ciclo de entrega persistido (o callback pode ser sync ou async; TODAS as
 * transições são aguardadas antes de resolver `send`/emitir `turn_end`):
 *   transmitting → (aceite comprovado) accepted → (result correlacionado) settled
 *   transmitting → (queda antes de yield) refused
 *   transmitting → (timeout, queda depois de yield, close) uncertain
 *   accepted     → (queda/close durante o turno) uncertain
 * Falha do callback em `accepted`/final NUNCA confirma sucesso: o turno fica
 * conservador em `uncertain`, a fila não é liberada e nada é reenviado.
 * `result` só encerra o turno atual com UUID/carimbo correto; subagente
 * (`parent_tool_use_id`) e sessão divergente não mudam a identidade nem
 * correlacionam. `--replay-user-messages` é passado via `extraArgs` (flag
 * pública da CLI) para o eco de aceite; `result.user_message_uuid` (e o array
 * `user_message_uuids`, quando existir) é o fallback de correlação.
 *
 * Segurança de ferramentas (v0): base só Read/Glob/Grep; Bash/Edit/Write/
 * Agent/Task/MCP herdado desabilitados; `settingSources: []`,
 * `strictMcpConfig: true`, sem MCP herdado; em Livre, somente a ferramenta
 * nativa `mcp__mesa__criar_pdf` pode salvar um novo material. Hook PreToolUse com realpath
 * aplica `toolPolicy` (readPaths/readRoots) inclusive em chamadas
 * auto-aprovadas; Glob/Grep não escapam a raiz por symlink; `canUseTool` nunca
 * devolve `updatedPermissions`.
 *
 * Liquidação (rodada 3, política pura em `claude-turn-policy.cjs`): um
 * `result` sem eco só encerra o turno ÚNICO com aceite persistido, não
 * degradado, sem eco estrangeiro anterior, sem origem não-humana e sem
 * `num_turns` zero; `taken` não é aceite. Resultado não correlacionado de
 * turno ainda não aceito é ignorado até timeout/fim de consulta. Cancelamento
 * explícito + aceite + fim NATIVO observado (`query` terminou, inclusive com
 * erro de iterador) ⇒ `settled` com `cancelled:true` e `uncertain:false`; sem
 * cancelamento a queda segue incerta; `close()`/timer do host seguem
 * conservadores. Falhas nativas do `result` (blocking_limit, 429/529,
 * contexto/imagem/orçamento, janela rejeitada não liberada) ganham erro
 * `fatal:false` e NÃO desfazem o aceite. `api_retry` preserva
 * tentativa/máximo/atraso/status, dedupe por attempt e nunca encerra o turno
 * (aviso `CLAUDE_API_RETRY`, ou `CLAUDE_OVERLOADED` em 529); recusa/fallback
 * vira aviso `CLAUDE_MODEL_REFUSAL`/`CLAUDE_MODEL_FALLBACK` com retração
 * limitada, com evicção de DOM explicitamente adiada. Incerteza de entrega
 * hidratada (`deliveryUncertain`) é PEGAJOSA: envio, `initializeControls` e
 * `setControls` recusam antes de consulta/nativo/disco até um adaptador novo.
 *
 * Perguntas (AskUserQuestion, APIs do SDK pinado 0.3.301): a ferramenta entra
 * em `tools` (sai de `disallowedTools`) mas NÃO concede escrita/Bash/MCP: o
 * `canUseTool` emite `permission_request {method:'question', questions}` e só
 * devolve allow com respostas ESTRUTURADAS validadas (`respond({id, answers})`),
 * com `updatedInput {questions, answers}` (multiSelect vira "A, B"). Cancelar,
 * abort (AbortSignal do SDK) ou vencer o prazo nega com
 * `permission_cancelled {id, reason}`; ID vencido nunca concede allow.
 *
 * Limite de uso: `rate_limit_event` de PRIMEIRO NÍVEL (o SDK 0.3.301 declara
 * esse tipo fora de `system`; o subtipo em `system` fica como leitura legada
 * defensiva) NÃO encerra o turno: rejected sem overage vira aviso
 * deduplicado `CLAUDE_RATE_LIMITED` com janela/reset; `allowed` libera e
 * permite aviso novo; `allowed_warning` avisa; rejected com overage em uso
 * continua e avisa o overage. A janela rejeitada é rastreada por tipo (várias
 * ao mesmo tempo são possíveis); quando ela passa a `allowed`, sai UMA
 * transição `CLAUDE_RATE_LIMIT_RESUMED` com `rateLimit.blocked:false` para a
 * UI limpar a pausa — nunca a cada `allowed` repetido e sem mexer em
 * busy/fila/liquidação. busy/fila/entrega ficam intactos.
 *
 * Testes usam SOMENTE SDK fake injetado (queryFactory/sdkLoader/detectClaude);
 * nada aqui inicia inferência, login ou processo Claude real por conta própria.
 */
'use strict';

const crypto = require('node:crypto');
const {EventEmitter} = require('node:events');
const path = require('node:path');
const {message: uiMsg} = require('../i18n.mjs');
const {causeArg, describeReceived, invalidValue} = require('../error-detail.mjs');
const environment = require('./claude-environment.cjs');
const {createActivityCallGate}=require('./activity-call-gate.cjs');
/* Política pura de liquidação do turno (correlação, fim de consulta, falhas
   nativas, retry e recusa): o adaptador mede os fatos e aplica o veredito. */
const turnPolicy = require('./claude-turn-policy.cjs');
const {ADAPTER_VERSION, CLAUDE_CLIENT_APP, DEFAULT_TIMEOUT_MS, DEFAULT_PERMISSION_TTL_MS, MAX_PERMISSION_TTL_MS, MAX_IMAGES, MAX_IMAGE_BYTES, MAX_TEXT_BYTES, MAX_CONTENT_BYTES, MAX_TOOL_RESULT_CHARS, MAX_TOOL_DETAILS_CHARS, MAX_HISTORY_MESSAGES, MAX_HISTORY_BYTES, MAX_HISTORY_PAGES, MAX_RATE_LIMIT_NOTICES, MAX_RATE_LIMIT_WAIT_MS, DEFAULT_CONTROLS_TIMEOUT_MS, MAX_CONTROLS_TIMEOUT_MS, CONTROLS_STATES, ALLOWED_IMAGE_TYPES, ALLOWED_TOOLS, SDK_TOOLS, DISALLOWED_TOOLS, RATE_LIMIT_WINDOWS, ASSISTANT_ERROR_CODES, CAPABILITIES, MODEL_INFO, EVENT_TYPES, DELIVERY_STATUSES, ClaudeAdapterError, MessageQueue} = require('./claude-adapter-contract.cjs');
const {isUuid, errorText, asAdapterError, normalizeSelectionInput, canonicalPath, isInside, normalizeToolPolicy, extractPathFromInput, validateImage, prepareMessage, normalizeUserQuestions, validateQuestionAnswers} = require('./claude-adapter-input.cjs');
const {normalizeAssistantBlocks, summarizeToolResult, normalizeHistory, normalizeUsage, normalizePriorMessages, mergePriorHistory} = require('./claude-adapter-history.cjs');
const {ClaudeAdapterRateLimit, rateLimitReset, formatWaitMs} = require('./claude-adapter-rate-limit.cjs');
const {installPrototypeMethods} = require('../prototype-mixins.cjs');
const {ClaudeAdapterControls} = require('./claude-adapter-controls.cjs');
const {ClaudeAdapterTurns} = require('./claude-adapter-turns.cjs');
const {ClaudeAdapterQuery} = require('./claude-adapter-query.cjs');
const {ClaudeAdapterStream} = require('./claude-adapter-stream.cjs');
const {ClaudeAdapterPermissions} = require('./claude-adapter-permissions.cjs');
const {ClaudeAdapterSteer} = require('./claude-adapter-steer.cjs');
const {ClaudeAdapterCommands} = require('./claude-adapter-commands.cjs');
const {ClaudeAdapterMeter} = require('./claude-adapter-meter.cjs');
const {COMPACT_TIMEOUT_MS} = require('./claude-compaction.cjs');

class ClaudeAdapter extends EventEmitter {
  constructor(options = {}) {
    super();
    const {
      conversationId,
      sessionId = null,
      resume = false,
      cwd = null,
      claudePath = null,
      systemPrompt = '',
      env = null,
      queryFactory = null,
      sdkLoader = null,
      persistDelivery = null,
      timeoutMs = DEFAULT_TIMEOUT_MS,
      toolPolicy = null,
      detectClaude = null,
      permissionTtlMs = DEFAULT_PERMISSION_TTL_MS,
      selection = null,
      persistSelection = null,
      controlsTimeoutMs = DEFAULT_CONTROLS_TIMEOUT_MS,
      compactTimeoutMs = COMPACT_TIMEOUT_MS,
      noTools = false,
      persistSession = true,
      deliveryUncertain = false,
      createMaterial = null,
      createActivity = null,
      previewActivity = null,
      viewFigure = null,
      geogebra = null,
      tutorLanguage = null,
      priorMessages = null,
      importedPrefixLength = 0,
    } = options;

    if (typeof conversationId !== 'string' || !conversationId.trim()) {
      throw new ClaudeAdapterError('CLAUDE_BAD_ARGUMENTS', invalidValue('conversationId', conversationId, 'string(1..)'), null, true);
    }
    this._conversationId = conversationId;
    this._sessionId = typeof sessionId === 'string' && sessionId ? sessionId : null;
    this._resume = resume === true;
    if (this._resume && !this._sessionId) {
      throw new ClaudeAdapterError('CLAUDE_RESUME_WITHOUT_SESSION', `resume=true exige sessionId explícito (nunca "última sessão"): recebido ${describeReceived(sessionId)}; esperado string(1..)`, null, true);
    }
    this._cwd = typeof cwd === 'string' && cwd ? path.resolve(cwd) : null;
    this._claudePath = typeof claudePath === 'string' && claudePath ? claudePath : null;
    /* O que o host pediu fica separado do que foi resolvido: a reconexão volta
       a seguir o launcher atual do usuário em vez de ficar presa no binário
       real (`versions/<v>`) resolvido na conexão anterior. */
    this._configuredClaudePath = this._claudePath;
    /* Linha do log quando o Claude Code passa da versão testada (#51). */
    this._executableNote = '';
    this._systemPrompt = typeof systemPrompt === 'string' ? systemPrompt : '';
    this._childEnv = env && typeof env === 'object' ? env : null;
    this._queryFactory = typeof queryFactory === 'function' ? queryFactory : null;
    this._sdkLoader = typeof sdkLoader === 'function' ? sdkLoader : null;
    this._createMaterial = typeof createMaterial === 'function' ? createMaterial : null;
    this._createActivity = typeof createActivity === 'function' ? createActivity : null;
    /* GeoGebra (#53): o serviço do host (`geogebra-host.cjs`), a mesma ferramenta do Pi. */
    this._geogebra = geogebra && typeof geogebra.run === 'function' ? geogebra : null;
    /* Acessor do idioma do tutor: o texto da ferramenta é montado a cada consulta (#41). */
    this._tutorLanguage = typeof tutorLanguage === 'function' ? tutorLanguage : () => 'pt-BR';
    /* Prévia do quadro (#42): só existe junto da ferramenta de mostrar. */
    this._previewActivity = this._createActivity && typeof previewActivity === 'function' ? previewActivity : null;
    /* Ver a figura (#60): o print do SVG ou da cerca `plot`; não grava nada. */
    this._viewFigure = typeof viewFigure === 'function' ? viewFigure : null;
    this._activityCallGate = this._createActivity ? createActivityCallGate({
      current:()=>({conversationId:this._conversationId,generation:this._generation,runId:this._runId,
        active:!this._closed&&!this._cancelRequested&&!!this._turn&&!this._turn.finalized}),
      publish:args=>this._createActivity(args),
    }) : null;
    this._persistDelivery = typeof persistDelivery === 'function' ? persistDelivery : null;
    this._timeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS;
    this._permissionTtlMs = Number.isFinite(permissionTtlMs) && permissionTtlMs > 0
      ? Math.min(Math.floor(permissionTtlMs), MAX_PERMISSION_TTL_MS)
      : 0;
    this._toolPolicy = normalizeToolPolicy(toolPolicy, this._cwd);
    this._detectClaude = typeof detectClaude === 'function' ? detectClaude : environment.detectClaude;
    /* SDK/Query simulados pulam a detecção, a menos que o host injete o
       detector de propósito (o teste de janela prova a escolha do executável
       com binários falsos). */
    this._detectInjected = typeof detectClaude === 'function';
    this._injected = Boolean(this._queryFactory || this._sdkLoader) && !this._detectInjected;
    this._controlsTimeoutMs = Number.isFinite(controlsTimeoutMs) && controlsTimeoutMs > 0
      ? Math.min(Math.floor(controlsTimeoutMs), MAX_CONTROLS_TIMEOUT_MS)
      : DEFAULT_CONTROLS_TIMEOUT_MS;
    this._persistSelection = typeof persistSelection === 'function' ? persistSelection : null;
    this._compactTimeoutMs = Number.isFinite(compactTimeoutMs) && compactTimeoutMs > 0 ? Math.floor(compactTimeoutMs) : COMPACT_TIMEOUT_MS;
    /* Rascunho de revisão (#58): consulta temporária sem ferramenta nenhuma e
       sem sessão salva em ~/.claude/projects. */
    this._noTools = noTools === true;
    this._persistSession = persistSession !== false;

    this._connected = false;
    this._closed = false;
    this._busy = false;
    this._generation = 0;
    this._runId = null;
    this._query = null;
    this._queue = null;
    this._queryDead = true;
    /* Um prompt SÓ conta como entregue quando um item passou pelo yield (é o
       que decide sessionId × resume na próxima consulta — a inicialização de
       catálogo sem prompt não pode virar "resume" de sessão inexistente). */
    this._promptDelivered = false;
    this._sdk = null;
    this._initEmitted = false;
    this._version = null;
    this._model = null;
    this._permissions = new Map();
    this._rateLimitNotices = new Map();
    this._rejectedWindows = new Map();
    this._turn = null;
    this._foreignSessions = new Set();
    this._cancelRequested = false;
    this._streamed = new Set();
    this._completed = new Map();
    this._toolNames = new Map();
    /* Quadros da MESMA mensagem lógica: o cursor de blocos dá índices globais
       (`contentIndexes`) sem deduplicar por `message.id`; a declaração de cada
       tool_use sai no `content_block_start` e não se repete no quadro final. */
    this._messageBlockCursor = new Map();
    this._declaredTools = new Map();

    /* Controles: escolha DESEJADA (persistida) ≠ estado NATIVO aplicado. */
    this._selection = normalizeSelectionInput(selection);
    this._nativeSelection = {model: null, effort: null};
    this._controlsState = 'idle';
    this._controlsCatalog = null;
    this._controlsError = null;
    this._controlsInitPromise = null;
    this._controlsChanging = false;
    this._controlsFailed = false;
    this._controlsFailedDetail = null;
    this._accountProvider = null;
    /* Hidratação ESTRITA: só o booleano `true` liga a incerteza de entrega
       herdada do descritor. O fato é PEGAJOSO neste adaptador (envio,
       initializeControls e troca de controles recusam); só um adaptador novo
       resolve, exatamente como o Bend `canChangeControls`/`canBegin` exige. */
    this._deliveryUncertain = deliveryUncertain === true;
    this._apiRetryNotices = new Map();
    /* Prefixo importado que o host quer preservar no histórico + memória de
       uso já emitido por mensagem lógica (não repete a mesma rodada). */
    this._priorMessages = normalizePriorMessages(priorMessages);
    this._importedPrefixLength = Number.isInteger(importedPrefixLength)?Math.max(0,Math.min(this._priorMessages.length,importedPrefixLength)):0;
    this._usageReported = new Map();
    /* #58: steers em voo (o eco pode chegar depois do turno principal), o
       pedido de compactação, o catálogo de comandos da consulta e a amostra
       do medidor. */
    this._steers = new Map();
    this._compaction = null;
    this._compactUuid = null;
    this._commandCache = null;
    this._usageSample = null;
    this._modelUsage = null;
  }

  snapshot() {
    return {
      connected: this._connected && !this._closed,
      busy: this._busy,
      compacting: Boolean(this._compaction),
      model: this._currentModelInfo(),
      capabilities: this._capabilities(),
      sessionId: this._sessionId,
      /* Esforço NATIVO aplicado por este adaptador (null = default do CLI). */
      thinkingLevel: this._nativeSelection.effort,
    };
  }

  /* Estado do turno corrente/último turno ainda em liquidação — sobrevive ao
     aceite (o main pode conferir o registro mesmo depois do replay). */

  deliveryState() {
    const turn = this._turn;
    if (!turn) return null;
    return {
      id: turn.id,
      wireUuid: turn.wireUuid,
      status: turn.phase,
      accepted: turn.acceptResolved,
      degraded: turn.degraded,
      finalized: turn.finalized,
    };
  }

  /* Detecta binário/versão/login ANTES de existir consulta. Nenhuma chamada de
     modelo. Testes injetam queryFactory/sdkLoader (e podem injetar detectClaude). */

  async connect() {
    if (this._connected && !this._closed) return this.snapshot();
    if (this._closed) {
      this._closed = false;
      this._generation += 1;
      this._initEmitted = false;
      this._foreignSessions.clear();
    }
    if (!this._cwd) {
      throw new ClaudeAdapterError('CLAUDE_CWD_REQUIRED', 'cwd obrigatório: a sessão precisa de pasta de trabalho controlada (nunca o vault inteiro)', null, true);
    }
    if (!this._injected) {
      let info;
      try {
        info = await this._detectClaude({configuredPath: this._configuredClaudePath, env: process.env});
      } catch (error) {
        throw asAdapterError(error, true);
      }
      if (info?.path) this._claudePath = info.path;
      if (info?.version) this._version = info.version;
      this._executableNote = environment.describeVersion(info);
      /* Só o NOME do provedor (firstParty/bedrock/...) — nunca e-mail,
         organização ou plano; é o suficiente para o compile first-party. */
      if (typeof info?.auth?.apiProvider === 'string') {
        const provider = info.auth.apiProvider.trim();
        if (provider && provider.length <= 100) this._accountProvider = provider;
      }
      for (const warning of info?.warnings || []) {
        this._emit('warning', {message: warning.message, code: warning.code});
      }
    }
    this._connected = true;
    return this.snapshot();
  }

  /* Troca a política de caminhos (ex.: PDF ativo muda por prompt). Sempre
     canonicaliza; recusa com turno em andamento ou permissão pendente para
     não mudar a regra no meio de uma decisão já apresentada. */

  setToolPolicy(policy) {
    if (this._closed) {
      throw new ClaudeAdapterError('CLAUDE_CLOSED', uiMsg('err.claude.closedPolicy'), null, true);
    }
    if (this._busy || this._turn || this._permissions.size) {
      throw new ClaudeAdapterError('CLAUDE_BUSY', uiMsg('err.claude.busyPolicy'), null, true);
    }
    this._toolPolicy = normalizeToolPolicy(policy, this._cwd);
    return {readPaths: [...this._toolPolicy.readPaths], readRoots: [...this._toolPolicy.readRoots]};
  }

  /* ---------------- modelo/esforço (controles nativos) ----------------
   *
   * Contrato público para o host (main/serviço):
   *   await adapter.initializeControls()            // ação explícita, sem prompt
   *   adapter.controlsSnapshot()                   // seletor + estados seguros
   *   await adapter.setControls({model, effort}, {persistSelection})
   *   adapter.snapshot()                           // modelo/esforço OBSERVADOS
   *
   * `_selection` é a escolha DESEJADA (persistida no descritor); `_nativeSelection`
   * é o que ESTE adaptador aplicou na Query viva. Os dois só divergem em falha
   * explícita — e a divergência bloqueia o envio (nunca fallback silencioso).
   */

  /* AÇÃO EXPLÍCITA (conexão da UI ou antes de um prompt real). Conecta (só
     versão/auth), cria/reusa a Query NATIVA sem prompt, lê o catálogo
     sanitizado NA MESMA Query e restaura a escolha salva com as APIs do pin.
     Idempotente quando já está saudável; chamadas concorrentes compartilham a
     promessa. NÃO faz inferência: nenhum item entra no iterador de entrada. */

  /* Um turno por vez. A promise só resolve no aceite comprovado E persistido. */
  async send(input = {}) {
    const id = typeof input?.id === 'string' && input.id.trim() ? input.id.trim() : crypto.randomUUID();
    const text = typeof input?.text === 'string' ? input.text : '';
    const images = Array.isArray(input?.images) ? input.images : [];
    const prepared = prepareMessage({text, images});

    if (!this._connected || this._closed) {
      throw new ClaudeAdapterError('CLAUDE_NOT_CONNECTED', uiMsg('err.claude.notConnected'), null, true);
    }
    /* Entrega incerta (hidratada do descritor ou medida neste adaptador) é
       PEGAJOSA: nenhum envio novo a limpa. Recusa ANTES de marca no disco,
       consulta ou item no iterador — só um adaptador novo resolve. */
    if (this._deliveryUncertain) {
      throw new ClaudeAdapterError('CLAUDE_DELIVERY_UNCERTAIN', uiMsg('err.claude.deliveryUncertain'), null, true);
    }
    /* Controles em troca/falha ou escolha salva não honrada recusam ANTES de
       qualquer marca no disco ou item no iterador. */
    const controlsBlock = this._controlsSendBlock();
    if (controlsBlock) throw controlsBlock;
    /* Uma mensagem de estudo não atravessa o resumo da compactação. */
    if (this._compaction) {
      throw new ClaudeAdapterError('CLAUDE_COMPACT_BUSY', uiMsg('err.claude.compactBusy'), {id}, true);
    }
    if (this._busy && this._turn && input?.delivery === 'steer') return this._sendSteer({id, prepared});
    if (this._busy || this._turn) {
      throw new ClaudeAdapterError('CLAUDE_BUSY', uiMsg('err.claude.busyTurn'), {id}, true);
    }

    const wireUuid = isUuid(id) ? id : crypto.randomUUID();
    const turn = {
      id,
      wireUuid,
      generation: this._generation,
      item: null,
      taken: false,
      phase: null,
      acceptAttempted: false,
      acceptResolved: false,
      degraded: false,
      finalized: false,
      delivered: new Set(),
      pending: null,
      timer: null,
      chain: Promise.resolve(),
      lateAckWarned: false,
      foreignWarned: false,
      foreignSeen: false,
      announcedRateLimits: new Set(),
      /* Fatos por turno para classificar o `result` (limite/autenticação),
         sem contaminação entre turnos. */
      rejectedRateLimitTypes: new Set(),
      latestAssistantRateLimited: false,
      authenticationFailure: false,
      lastRateLimit: null,
      apiRetries: new Set(),
      /* Uuids dos steers deste turno: um `result` que ecoa um deles é do
         MESMO turno (#58). */
      steerUuids: new Set(),
      history: null,
    };
    turn.pending = {settled: false, resolve: null, reject: null};
    turn.history = new Promise((resolve, reject) => {
      turn.pending.resolve = resolve;
      turn.pending.reject = reject;
    });
    /* Ninguém pode deixar o processo morrer por um reject interno. O caller que
       fizer await continua vendo a rejeição. */
    turn.history.catch(() => {});

    this._busy = true;
    this._turn = turn;
    this._cancelRequested = false;
    this._runId = wireUuid;

    /* 1) marca de envio iniciado no disco ANTES de entregar qualquer coisa. */
    const transmitting = await this._record(turn, 'transmitting');
    if (!transmitting.ok) {
      this._busy = false;
      this._turn = null;
      this._runId = null;
      throw new ClaudeAdapterError(
        'CLAUDE_PERSIST_FAILED',
        uiMsg('err.claude.persistFailed', {cause: causeArg(errorText(transmitting.error))}),
        null,
        true,
      );
    }
    this._emitDelivery(turn, 'transmitting');
    this._emitTurn(turn, 'turn_start', {model: this._model});

    /* 2) sobe/reaproveita o processo do SDK. Falha aqui é recusa comprovada. */
    try {
      await this._ensureQuery();
    } catch (error) {
      const failure = asAdapterError(error, true, 'CLAUDE_QUERY_START_FAILED');
      await this._enqueue(turn, () => this._refuseBeforeDelivery(turn, failure));
      return turn.history;
    }

    const item = {
      type: 'user',
      message: {role: 'user', content: prepared.blocks},
      parent_tool_use_id: null,
      uuid: wireUuid,
      session_id: this._sessionId || undefined,
    };
    turn.item = item;

    /* 3) entrega ao AsyncIterable (não é aceite; só replay/carimbo é). */
    try {
      this._queue.push(item);
    } catch (error) {
      const failure = asAdapterError(error, true, 'CLAUDE_DELIVERY_REFUSED');
      await this._enqueue(turn, () => this._refuseBeforeDelivery(turn, failure));
      return turn.history;
    }

    turn.timer = setTimeout(() => {
      this._enqueue(turn, () => this._timeoutTurn(turn)).catch(() => {});
    }, this._timeoutMs);
    turn.timer.unref?.();
    return turn.history;
  }

  /* Interrompe o turno. Permissões/perguntas pendentes são negadas aqui;
     busy continua até `result`/fim de consulta/close (nada é inferido). */

  async cancel() {
    this._cancelRequested = true;
    this._invalidatePermissions('Cancelado pelo usuário', this._turn, 'user');
    const query = this._query;
    if (!query || !this._busy) return {cancelled: false, requested: true};
    try {
      if (typeof query.interrupt === 'function') await query.interrupt();
    } catch (error) {
      this._emit('warning', {message: `não deu para interromper a consulta (${errorText(error)})`, code: 'CLAUDE_INTERRUPT_FAILED'});
    }
    return {cancelled: true, requested: true};
  }

  /* Resposta de permissão/pergunta. `allow` de confirmação só com
     confirmed === true; pergunta exige `answers` estruturadas e validadas
     (nunca `confirmed` sozinho). Nunca aplica `updatedPermissions`/sugestões
     globais. ID vencido/desconhecido não aceita nada. */

  respond(input = {}) {
    const id = input && typeof input.id === 'string' ? input.id : null;
    const entry = id ? this._permissions.get(id) : null;
    if (!entry) return {ok: false, id, code: 'CLAUDE_PERMISSION_UNKNOWN'};

    if (input.cancelled === true) {
      this._emit('permission_cancelled', {id, reason: 'user'});
      entry.finish({behavior: 'deny', message: 'Cancelado pelo usuário'});
      return {ok: true, id, cancelled: true};
    }

    if (entry.method === 'question') {
      if (input.confirmed === false) {
        entry.finish({behavior: 'deny', message: 'Recusado pelo usuário'});
        return {ok: true, id, allowed: false};
      }
      if (input.answers === undefined || input.answers === null) {
        return {ok: false, id, code: 'CLAUDE_QUESTION_ANSWERS_REQUIRED'};
      }
      const validation = validateQuestionAnswers(entry.questions, input.answers);
      if (!validation.ok) return {ok: false, id, code: validation.code, detail: validation.detail};
      const result = {behavior: 'allow', updatedInput: {questions: entry.rawQuestions, answers: validation.answers}};
      if (entry.toolUseID) result.toolUseID = entry.toolUseID;
      entry.finish(result);
      return {ok: true, id, allowed: true, answers: validation.answers};
    }

    if (input.confirmed !== true) {
      entry.finish({behavior: 'deny', message: 'Recusado pelo usuário'});
      return {ok: true, id, allowed: false};
    }

    entry.finish({behavior: 'allow'});
    return {ok: true, id, allowed: true};
  }

  /* Histórico da PRÓPRIA sessão via API oficial; `options.sessionId` é ignorado
     de propósito (nunca consultar outra conversa). Pagina até o limite
     explícito (teto de 200/8 MB — não é histórico completo; o export é do
     host). Sem exigir login/conexão e sem reexecutar ferramenta. */

  async history(options = {}) {
    this.historyComplete = false;
    const sessionId = this._sessionId;
    if (!sessionId) return this._mergePrior([]);
    const sdk = await this._loadSdk();
    const getSessionMessages = typeof sdk?.getSessionMessages === 'function'
      ? sdk.getSessionMessages
      : sdk?.default?.getSessionMessages;
    if (typeof getSessionMessages !== 'function') {
      throw new ClaudeAdapterError('CLAUDE_SDK_UNAVAILABLE', 'getSessionMessages indisponível no SDK oficial', null, false);
    }
    const requested = Number.isFinite(options.limit) && options.limit > 0 ? Math.floor(options.limit) : MAX_HISTORY_MESSAGES;
    const limit = Math.min(requested, MAX_HISTORY_MESSAGES);
    const offset = Number.isFinite(options.offset) && options.offset > 0 ? Math.floor(options.offset) : 0;
    const raw = [];
    let cursor = offset;
    let pages = 0;
    while (raw.length < limit && pages < MAX_HISTORY_PAGES) {
      pages += 1;
      const page = await getSessionMessages(sessionId, {dir: this._cwd || undefined, limit: limit - raw.length, offset: cursor});
      if (!Array.isArray(page)) throw new ClaudeAdapterError('CLAUDE_HISTORY_UNAVAILABLE', invalidValue('retorno de getSessionMessages()', page, 'array'), null, false);
      if (page.length === 0) { this.historyComplete = true; break; }
      raw.push(...page);
      cursor += page.length;
    }
    if (raw.length >= limit && options.limit == null) {
      const tail = await getSessionMessages(sessionId, {dir: this._cwd || undefined, limit: 1, offset: cursor});
      this.historyComplete = Array.isArray(tail) && tail.length === 0;
      if (!this.historyComplete) this._emit('warning', {
        message: `A prévia nativa mostra as primeiras ${limit} mensagens. O cache local recente foi preservado; use Exportar para consultar o histórico.`,
        code: 'CLAUDE_HISTORY_TRUNCATED',
      });
    }
    return this._mergePrior(normalizeHistory(raw, {
      maxBytes: MAX_HISTORY_BYTES,
      onTruncate: (info) => { this.historyComplete = false; this._emit('warning', {
        message: `histórico maior que o teto de ${info.maxBytes} bytes: ${info.kept} de ${info.total} mensagens exibidas; exportação completa é do host`,
        code: 'CLAUDE_HISTORY_TRUNCATED',
      }); },
    }));
  }

  /* Prefixo importado + histórico nativo sem repetição (ver
     `mergePriorHistory`): cobre o cache do descritor que já contém mensagens
     nativas, evitando duplicar quando o adaptador hidrata o mesmo transcript. */

  cacheHistory(messages, importedPrefixLength) {
    this._priorMessages = Array.isArray(messages) ? messages.slice() : [];
    this._importedPrefixLength = Number.isInteger(importedPrefixLength)
      ? Math.max(0, Math.min(this._priorMessages.length, importedPrefixLength)) : 0;
  }

  _mergePrior(native) {
    const imported=this._priorMessages.slice(0,this._importedPrefixLength);
    const cachedNative=this._priorMessages.slice(this._importedPrefixLength);
    return [...imported,...mergePriorHistory(cachedNative, native)];
  }

  /* Encerra APENAS a própria consulta. Não apaga sessão nem estado: o
     histórico continua recuperável. A liquidação do turno (recusa/incerteza)
     é persistida e só então o `turn_end` sai. */

  close() {
    if (this._closed) return;
    this._closed = true;
    this._activityCallGate?.clear();
    this._generation += 1;
    const turn = this._turn;
    const cancelRequested = this._cancelRequested;
    if (turn) {
      this._turn = null;
      this._busy = false;
      this._runId = null;
      this._cancelRequested = false;
    }
    this._invalidatePermissions('Conexão encerrada', turn, 'close');
    this._failOpenSteers('err.claude.steerQueryEnded');
    this._failOpenCompaction();
    const queue = this._queue;
    const query = this._query;
    this._queue = null;
    this._query = null;
    this._queryDead = true;
    /* O catálogo/controles pertenciam à Query encerrada; a escolha DESEJADA
       (`_selection`) e o bloqueio terminal (`_controlsFailed`) permanecem. */
    this._controlsState = 'idle';
    this._controlsCatalog = null;
    this._controlsError = null;
    this._nativeSelection = {model: null, effort: null};
    /* A incerteza de entrega NÃO é limpa aqui: é pegajosa até um adaptador
       novo (close/reconnect deste objeto continua bloqueado para envio). */
    /* Janelas rejeitadas são estado da sessão encerrada: a próxima conexão
       não herda pausa nem transição de liberação. */
    this._rejectedWindows.clear();
    if (queue) queue.end();
    try {
      if (query && typeof query.close === 'function') {
        const result = query.close();
        if (result && typeof result.catch === 'function') result.catch(() => {});
      }
    } catch {
      /* fechar à força não pode derrubar o chamador */
    }
    if (turn && !turn.finalized) {
      /* close() do host NÃO é fim nativo observado: o desfecho é conservador
         mesmo com aceite e cancelamento (`endKind:'close'`). */
      const end = turnPolicy.classifyQueryEnd({
        accepted: turn.acceptResolved,
        taken: turn.taken,
        phase: turn.phase,
        cancelled: cancelRequested,
        degraded: turn.degraded,
        endKind: 'close',
      });
      this._enqueue(turn, () => this._finalizeTurn(turn, end.outcome, {
        cancelled: true,
        isError: true,
        message: 'close da conexão antes da confirmação',
        reason: 'close',
      })).catch(() => {});
    }
  }

  stop() {
    this.close();
  }

  /* ---------------- interno ---------------- */
}

/* Cada responsabilidade mora no seu claude-adapter-*.cjs (#43 fase 2); o
   contrato público continua só neste arquivo. */
installPrototypeMethods(ClaudeAdapter, [ClaudeAdapterControls, ClaudeAdapterTurns, ClaudeAdapterQuery, ClaudeAdapterRateLimit, ClaudeAdapterStream, ClaudeAdapterPermissions, ClaudeAdapterSteer, ClaudeAdapterCommands, ClaudeAdapterMeter]);

module.exports = {
  ClaudeAdapter,
  ClaudeAdapterError,
  MessageQueue,
  ADAPTER_VERSION,
  CLAUDE_CLIENT_APP,
  CAPABILITIES,
  MODEL_INFO,
  EVENT_TYPES,
  DELIVERY_STATUSES,
  ALLOWED_TOOLS,
  SDK_TOOLS,
  DISALLOWED_TOOLS,
  ALLOWED_IMAGE_TYPES,
  RATE_LIMIT_WINDOWS,
  ASSISTANT_ERROR_CODES,
  LIMITS: Object.freeze({
    MAX_IMAGES,
    MAX_IMAGE_BYTES,
    MAX_TEXT_BYTES,
    MAX_CONTENT_BYTES,
    MAX_TOOL_RESULT_CHARS,
    MAX_TOOL_DETAILS_CHARS,
    MAX_HISTORY_MESSAGES,
    MAX_HISTORY_BYTES,
    DEFAULT_TIMEOUT_MS,
    DEFAULT_PERMISSION_TTL_MS,
    MAX_PERMISSION_TTL_MS,
    MAX_RATE_LIMIT_NOTICES,
    MAX_RATE_LIMIT_WAIT_MS,
    DEFAULT_CONTROLS_TIMEOUT_MS,
    MAX_CONTROLS_TIMEOUT_MS,
  }),
  CONTROLS_STATES,
  prepareMessage,
  validateImage,
  normalizeAssistantBlocks,
  normalizeHistory,
  normalizeUsage,
  normalizePriorMessages,
  mergePriorHistory,
  normalizeUserQuestions,
  validateQuestionAnswers,
  summarizeToolResult,
  formatWaitMs,
  rateLimitReset,
  canonicalPath,
  normalizeToolPolicy,
  extractPathFromInput,
  isInside,
  isUuid,
};
