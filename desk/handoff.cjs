'use strict';

/* Bilhete da Conversa → Mesa: fronteira com o núcleo Bend
   (core/handoff.bend → src/generated/handoff.core.js).
   A Conversa é chat geral; quando o assunto vira estudo, o usuário leva o
   pedido para a Mesa. O que atravessa é o pacote mínimo: objetivo, referências e
   pergunta pendente.
   Aqui é o lado da MESA (protocolo de processamento). O lado da Conversa
   (escrita) vive em `chat/handoff.cjs` com a MESMA parte de formato: os dois
   artefatos do núcleo são gerados do mesmo módulo e o teste de contrato compara
   as duas cópias byte a byte, então o formato não pode divergir em silêncio.

   POR QUE HÁ UM PROTOCOLO, E NÃO UM "consume"
   A primeira versão lia `conversa.json` e só depois renomeava esse mesmo
   caminho. Entre a leitura e o arquivamento, uma escrita nova podia ocupar o
   lugar: a Mesa preparava o bilhete A, arquivava o B e não deixava nada
   pendente — A sumia do disco sem nunca ter sido arquivado nem entregue.
   Agora o arquivo é REIVINDICADO por renomeação atômica (nome exclusivo) antes
   de ser lido, e o resto do ciclo trabalha sempre nesse mesmo arquivo.

   CICLO DE VIDA (um arquivo por fase, nome diz a fase)
     conversa.json                 pendente, ainda não reivindicado
     reivindicado-<ts>-<pid>-<n>   reivindicado, envio comprovadamente NÃO começou
     enviando-<ts>-<pid>-<n>       envio iniciado, confirmação ainda não chegou
     entregue-<ts>                 entregue ao Pi, ainda não arquivado
     arquivo/<ts>.json             entregue e arquivado (fim)
     falha/<ts>-<motivo>.json      não vira contexto (torto/nova versão/sem pedido)
     duvida/<ts>-<motivo>.json     entregue ou não: a confirmação não chegou
     arquivo/, falha/ e duvida/ preservam o arquivo; nada é apagado aqui.

   'reivindicado-*' responde "o envio pode não ter começado": é a ÚNICA fase que
   a recuperação devolve à fila. O envio só começa depois de `enviando-*` estar
   no disco (`beginDelivery`) — sem isso, uma queda entre a escrita no Pi e a
   confirmação faria o mesmo contexto voltar para a fila e chegar duas vezes.
   'entregue-*' é a marca de "já foi": nunca volta para pendente, nem para
   dúvida: já está resolvido, só falta arquivar.

   Puro: sem IPC, DOM ou relógio — `now` entra como argumento. Os motivos são
   códigos curtos ou nomes de fase; nunca carregam o conteúdo do bilhete. */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const core = require('./src/generated/handoff.core.js').default;

const VERSION = 1;
const FROM = 'conversa';
/* Teto de referências: o bilhete é curto de propósito; lista longa é histórico,
   não contexto. */
const MAX_REFS = 20;
const REF_MAX = 300;
/* Bilhete de outro dia não deixa de valer, mas não passa por assunto de agora. */
const STALE_MS = 24 * 60 * 60 * 1000;

const PENDENTE = 'conversa.json';
const CLAIM_PREFIX = 'reivindicado-';
const SENDING_PREFIX = 'enviando-';
const DELIVERED_PREFIX = 'entregue-';
const ARQUIVO = 'arquivo';
const FALHA = 'falha';
const DUVIDA = 'duvida';

/* Lista na representação do artefato (`Con`/`Nil`), como o resto do host monta
   as listas que cruzam para o Bend. */
function bendList(items) {
  let out = {$: 'Nil'};
  for (let i = items.length - 1; i >= 0; i--) out = {$: 'Con', head: items[i], tail: out};
  return out;
}

/* Limpeza pelo núcleo: o mesmo trim e os mesmos limites valem nos dois apps,
   então o que a Conversa escreve é o que a Mesa lê. */
function normalizeFields({goal, question, refs} = {}) {
  const cleanRefs = [];
  for (const ref of Array.isArray(refs) ? refs : []) {
    if (cleanRefs.length >= MAX_REFS) break;
    if (typeof ref === 'string' && ref.trim()) cleanRefs.push(ref.trim().slice(0, REF_MAX));
  }
  return {
    goal: core.cleanGoal(typeof goal === 'string' ? goal : ''),
    question: core.cleanQuestion(typeof question === 'string' ? question : ''),
    refs: cleanRefs,
  };
}

function isAccepted(goal, question) {
  return core.accepted(goal, question) === true;
}

/**
 * Bloco de contexto do bilhete, ou '' quando não há pedido (só referências não
 * é pedido) — quem decide é o núcleo.
 * @param {{goal?: string, question?: string, refs?: string[], stale?: boolean}} bilhete
 * @returns {string}
 */
function buildBlock({goal, question, refs, stale} = {}) {
  const clean = normalizeFields({goal, question, refs});
  return core.render(
    clean.goal,
    clean.question,
    bendList(clean.refs),
    isAccepted(clean.goal, clean.question),
    !!stale,
  );
}

/* Runtime da Mesa: a mesma ordem do doctor (env, `runtimePath` do config, o
   padrão por sistema). A Conversa precisa chegar no MESMO caminho, então a
   ordem é parte do contrato. */
function mesaRuntime(explicit) {
  if (explicit) return explicit;
  if (process.env.LEARNING_DESK_RUNTIME) return process.env.LEARNING_DESK_RUNTIME;
  const appData = process.platform === 'win32'
    ? process.env.APPDATA || ''
    : path.join(os.homedir(), 'Library', 'Application Support');
  const root = path.join(appData, 'Mesa de Estudos');
  try {
    const configured = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8'))?.runtimePath;
    if (typeof configured === 'string' && configured) return configured;
  } catch {}
  return path.join(root, 'runtime');
}

function handoffDir(runtime) {
  return path.join(mesaRuntime(runtime), 'handoff');
}

function pendentePath(runtime) {
  return path.join(handoffDir(runtime), PENDENTE);
}

/* Compatibilidade: `handoffPath` era o caminho do bilhete quando só existia a
   fase pendente. Segue sendo o lugar onde a Conversa escreve. */
function handoffPath(runtime) {
  return pendentePath(runtime);
}

function subDir(runtime, name) {
  return path.join(handoffDir(runtime), name);
}

function archiveDir(runtime) {
  return subDir(runtime, ARQUIVO);
}

function failureDir(runtime) {
  return subDir(runtime, FALHA);
}

function doubtDir(runtime) {
  return subDir(runtime, DUVIDA);
}

/* Carimbo para nome de arquivo. Relógio, pid e contador: duas operações no
   mesmo milissegundo (ou em execuções diferentes) não recebem o mesmo nome. */
let nameCounter = 0;
function stamp(now) {
  nameCounter += 1;
  return `${Number(now ?? Date.now())}-${process.pid}-${nameCounter}`;
}

function slug(reason) {
  return String(reason || 'motivo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'motivo';
}

/* Nome livre em `dir`, RESERVADO (o arquivo vazio criado aqui é substituído
   pelo `rename` de quem pediu). `open(...,'wx')` falha com EEXIST se o nome já
   existe, então dois arquivos guardados no mesmo instante nunca disputam o
   mesmo destino — e um `rename` sobre arquivo alheio apagaria o bilhete que
   estava lá. O laço cobre destino de execução anterior; o sufixo -1, -2… cobre
   o mesmo relógio. */
function reserveName(dir, name) {
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  for (let n = 0; n < 1000; n += 1) {
    const candidate = path.join(dir, n === 0 ? name : `${stem}-${n}${ext}`);
    try {
      fs.closeSync(fs.openSync(candidate, 'wx'));
      return candidate;
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
    }
  }
  return '';
}

/* Move um arquivo para um subdiretório. Nunca apaga e nunca sobrescreve: se o
   move falhar, o arquivo de origem permanece no lugar e o motivo volta para
   quem chamou; se o destino já existir, o nome leva sufixo. */
function moveInto(file, dir, name) {
  try {
    fs.mkdirSync(dir, {recursive: true});
  } catch (error) {
    return {ok: false, path: file, reason: `não deu para preparar ${path.basename(dir)}: ${error?.code || error?.message}`};
  }
  let target = '';
  try {
    target = reserveName(dir, name);
  } catch (error) {
    return {ok: false, path: file, reason: `não deu para preparar ${path.basename(dir)}: ${error?.code || error?.message}`};
  }
  if (!target) return {ok: false, path: file, reason: `não deu para preparar ${path.basename(dir)}: nomes ocupados`};
  try {
    fs.renameSync(file, target);
    return {ok: true, path: target};
  } catch (error) {
    /* A reserva era só o nome: sem o conteúdo, ela não pode ficar aí como se
       fosse bilhete. */
    try { fs.unlinkSync(target); } catch {}
    return {ok: false, path: file, reason: `não deu para mover para ${path.basename(dir)}: ${error?.code || error?.message}`};
  }
}

/* Devolve um `reivindicado-*` para a fila SEM sobrescrever o destino.
   A checagem-e-renomeação de antes perdia o bilhete novo que chegasse na janela
   entre o `existsSync` e o `rename` (o rename substitui o destino em silêncio).
   Aqui a criação do destino é o próprio teste: `link` falha com EEXIST se
   alguém ocupou a fila, e nada é escrito por cima.
   - link OK → o pendente tem o mesmo inode do reivindicado; sobra remover o
     nome antigo. Queda entre o link e o unlink é retomada (é o mesmo inode).
   - EEXIST sem ser o mesmo arquivo → um bilhete novo é o pendente: A não some,
     vai para `falha/` como superado, e o motivo volta para quem chamou.
   - `EXDEV`/`ENOSYS`/`EPERM` (plataforma sem hard link) → cópia exclusiva, que
     também recusa destino existente. */
function restorePending(file, {runtime, now} = {}) {
  const pendente = pendentePath(runtime);
  const sameFile = () => {
    try {
      const a = fs.statSync(file);
      const b = fs.statSync(pendente);
      return a.dev === b.dev && a.ino !== 0 && a.ino === b.ino;
    } catch {
      return false;
    }
  };
  const occupied = () => {
    if (sameFile()) {
      /* Restauração anterior interrompida depois do link: já está na fila. */
      try { fs.unlinkSync(file); } catch {}
      return {restored: true, resumed: true};
    }
    const kept = moveInto(file, failureDir(runtime), `${Number(now ?? Date.now())}-superado.json`);
    return {
      restored: false,
      conflict: true,
      reason: kept.ok ? 'pendente novo chegou durante a recuperação' : kept.reason,
    };
  };
  try {
    fs.linkSync(file, pendente);
  } catch (error) {
    if (error?.code === 'EEXIST') return occupied();
    if (error?.code !== 'EXDEV' && error?.code !== 'ENOSYS' && error?.code !== 'EPERM') {
      return {restored: false, reason: error?.code || 'erro'};
    }
    try {
      fs.copyFileSync(file, pendente, fs.constants.COPYFILE_EXCL);
    } catch (copyError) {
      if (copyError?.code === 'EEXIST') return occupied();
      return {restored: false, reason: copyError?.code || 'erro'};
    }
  }
  try { fs.unlinkSync(file); } catch {}
  return {restored: true};
}

/**
 * Espia o bilhete pendente SEM reivindicar (é o que o doctor usa: diagnóstico
 * não pode roubar o bilhete do app).
 * @param {{runtime?: string, now?: number}} options
 */
function readHandoff({runtime, now} = {}) {
  let raw;
  try {
    raw = fs.readFileSync(pendentePath(runtime), 'utf8');
  } catch {
    return {bilhete: null, block: '', stale: false, reason: 'ausente'};
  }
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return {bilhete: null, block: '', stale: false, reason: 'json inválido'};
  }
  return interpret(payload, {now});
}

function interpret(payload, {now} = {}) {
  if (!payload || typeof payload !== 'object') return {bilhete: null, block: '', stale: false, reason: 'formato inesperado'};
  if (payload.v !== VERSION) return {bilhete: null, block: '', stale: false, reason: `versão ${payload.v} não suportada`};
  if (payload.from !== FROM) return {bilhete: null, block: '', stale: false, reason: `origem ${payload.from} desconhecida`};
  const clean = normalizeFields(payload);
  if (!isAccepted(clean.goal, clean.question)) {
    return {bilhete: null, block: '', stale: false, reason: 'sem objetivo e sem pergunta'};
  }
  const createdAt = Number(payload.createdAt);
  const age = Number.isFinite(createdAt) ? Math.max(0, Number(now ?? Date.now()) - createdAt) : 0;
  const stale = age > STALE_MS;
  return {bilhete: clean, block: buildBlock({...clean, stale}), stale, reason: ''};
}

/**
 * Reivindica o pendente por renomeação atômica: a partir daqui o trabalho é
 * sempre sobre ESTE arquivo, e uma escrita nova em `conversa.json` fica
 * pendente para a próxima rodada (não é mais confundida com o que foi lido).
 * @param {{runtime?: string, now?: number}} options
 */
function claimPending({runtime, now} = {}) {
  const from = pendentePath(runtime);
  const to = path.join(handoffDir(runtime), `${CLAIM_PREFIX}${stamp(now)}.json`);
  try {
    fs.mkdirSync(handoffDir(runtime), {recursive: true});
    fs.renameSync(from, to);
    return {claimed: true, path: to};
  } catch (error) {
    if (error?.code === 'ENOENT') return {claimed: false, path: from, reason: 'ausente'};
    return {claimed: false, path: from, reason: `não deu para reivindicar: ${error?.code || error?.message}`};
  }
}

/** Lê um arquivo reivindicado. Não o move: quem decide o destino é quem entrega. */
function readClaim(file, {now} = {}) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (error) {
    return {bilhete: null, block: '', stale: false, reason: `não deu para ler: ${error?.code || error?.message}`};
  }
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return {bilhete: null, block: '', stale: false, reason: 'json inválido'};
  }
  return interpret(payload, {now});
}

/**
 * Persiste a fase "envio iniciado". É o que separa "pode repetir" de "não pode
 * repetir": depois desta transição, o envio pode ter começado, então o arquivo
 * nunca mais volta para a fila sozinho.
 *
 * Quem chama tem de fazer isso ANTES da primeira operação que possa transmitir
 * o prompt ao Pi; se a transição não for possível, nada pode ser enviado (sem a
 * marca, uma queda no meio da escrita devolveria o bilhete à fila). Devolve
 * `{started, path, reason}`: `started` falso significa que o arquivo continua
 * reivindicado, exatamente onde estava.
 */
function beginDelivery(file, {runtime, now} = {}) {
  const target = path.join(handoffDir(runtime), `${SENDING_PREFIX}${stamp(now)}.json`);
  try {
    fs.renameSync(file, target);
    return {started: true, path: target};
  } catch (error) {
    return {started: false, path: file, reason: `não deu para marcar o envio: ${error?.code || error?.message}`};
  }
}

/**
 * Marca o bilhete como entregue (renomeia para a fase `entregue-`). É o que
 * impede a recuperação de devolver à fila um contexto que já foi injetado.
 */
function markDelivered(file, {runtime, now} = {}) {
  const target = path.join(handoffDir(runtime), `${DELIVERED_PREFIX}${stamp(now)}.json`);
  try {
    fs.renameSync(file, target);
    return {delivered: true, path: target};
  } catch (error) {
    return {delivered: false, path: file, reason: `não deu para marcar como entregue: ${error?.code || error?.message}`};
  }
}

/**
 * Desfaz a marca de "envio iniciado". Só serve para a recusa COMPROVADA (o
 * bridge provou que nada foi escrito): aí o arquivo volta para a fase
 * reivindicada, que é a única que a recuperação devolve para a fila. Se o
 * rename falhar, o arquivo fica onde está e a abertura seguinte o trata como
 * incerto — o lado conservador, que nunca repete contexto sozinho.
 */
function revertDelivery(file, {runtime} = {}) {
  const base = path.basename(String(file || ''));
  if (!base.startsWith(SENDING_PREFIX) || !base.endsWith('.json')) {
    return {reverted: false, path: file, reason: 'não estava na fase de envio'};
  }
  const target = path.join(handoffDir(runtime), `${CLAIM_PREFIX}${base.slice(SENDING_PREFIX.length)}`);
  try {
    fs.renameSync(file, target);
    return {reverted: true, path: target};
  } catch (error) {
    return {reverted: false, path: file, reason: `não deu para desfazer a marca de envio: ${error?.code || error?.message}`};
  }
}

/** Arquiva um bilhete já entregue. Falha não apaga nada: o arquivo fica. */
function archiveDelivered(file, {runtime, now} = {}) {
  const out = moveInto(file, archiveDir(runtime), `${Number(now ?? Date.now())}.json`);
  return out.ok
    ? {archived: true, path: out.path}
    : {archived: false, path: out.path, reason: out.reason};
}

/**
 * Guarda um bilhete que não deve virar contexto nem voltar para a fila.
 * `bucket` é `falha` (nunca foi entregue) ou `duvida` (pode ter sido).
 */
function quarantine(file, {runtime, now, reason, bucket = FALHA} = {}) {
  const dir = bucket === DUVIDA ? doubtDir(runtime) : failureDir(runtime);
  const out = moveInto(file, dir, `${Number(now ?? Date.now())}-${slug(reason)}.json`);
  return out.ok
    ? {kept: true, path: out.path, bucket}
    : {kept: false, path: out.path, reason: out.reason, bucket};
}

/**
 * Recuperação na abertura: fecha o ciclo de uma execução anterior.
 *   - `enviando-*` PODE ter sido escrito no Pi sem confirmação → vai para
 *     `duvida/`, nunca de volta para a fila (contexto repetido é pior do que
 *     conferir);
 *   - `reivindicado-*` é envio comprovadamente não começado → volta a pendente
 *     (se não houver um pendente mais novo) ou vai para `falha/`;
 *   - `entregue-*` JÁ foi entregue → tenta arquivar; se não der, fica onde está
 *     (o nome diz que foi entregue, então não volta para a fila).
 * @param {{runtime?: string, now?: number}} options
 */
function recoverClaims({runtime, now} = {}) {
  const dir = handoffDir(runtime);
  let names = [];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return {recovered: 0, requeued: 0, archived: 0, doubtful: 0, details: []};
  }
  const details = [];
  const when = Number(now ?? Date.now());
  let requeued = 0;
  let archived = 0;
  let doubtful = 0;

  for (const name of names.filter((n) => n.startsWith(SENDING_PREFIX) && n.endsWith('.json'))) {
    const file = path.join(dir, name);
    const out = moveInto(file, doubtDir(runtime), `${when}-envio-incerto.json`);
    if (out.ok) doubtful += 1;
    details.push({name, action: out.ok ? 'guardado-em-duvida' : 'preservado', reason: out.reason});
  }

  for (const name of names.filter((n) => n.startsWith(CLAIM_PREFIX) && n.endsWith('.json'))) {
    const file = path.join(dir, name);
    const out = restorePending(file, {runtime, now: when});
    if (out.restored) requeued += 1;
    details.push({
      name,
      action: out.restored ? 'de-volta-a-pendente' : out.conflict ? 'guardado-em-falha' : 'falhou-ao-voltar',
      ...(out.resumed ? {resumed: true} : {}),
      ...(out.reason ? {reason: out.reason} : {}),
    });
  }

  for (const name of names.filter((n) => n.startsWith(DELIVERED_PREFIX) && n.endsWith('.json'))) {
    const file = path.join(dir, name);
    const out = moveInto(file, archiveDir(runtime), name.slice(DELIVERED_PREFIX.length));
    if (out.ok) archived += 1;
    details.push({name, action: out.ok ? 'arquivado' : 'preservado', reason: out.reason});
  }

  return {recovered: requeued + archived, requeued, archived, doubtful, details};
}

/**
 * Reivindica e lê o bilhete pendente, já resolvendo o que não vira contexto.
 * Devolve `{claim, problem}`: `claim` nulo com `problem` preenchido significa que
 * havia algo e não deu para entregar (o motivo é código curto, nunca o conteúdo).
 * Está aqui, e não no main, porque é o pedaço que precisa de teste: o main só
 * decide o momento de chamar.
 * @param {{runtime?: string, now?: number}} options
 */
function claimForDelivery({runtime, now} = {}) {
  const claim = claimPending({runtime, now});
  if (!claim.claimed) {
    return {claim: null, problem: claim.reason === 'ausente' ? '' : claim.reason};
  }
  const read = readClaim(claim.path, {now});
  if (!read.block) {
    const kept = quarantine(claim.path, {runtime, now, reason: read.reason, bucket: FALHA});
    return {
      claim: null,
      problem: kept.kept
        ? `bilhete guardado em falha: ${read.reason}`
        : `bilhete preservado, mas ${kept.reason}`,
    };
  }
  return {
    claim: {path: claim.path, block: read.block, bilhete: read.bilhete, stale: read.stale},
    problem: '',
  };
}

/**
 * A MÃO do bilhete durante a execução do app: UM por vez, procurado a cada
 * mensagem.
 *
 * `take()` devolve `{claim, problem, fresh}`. `fresh` marca a reivindicação
 * nova — é o que faz a faixa avisar na tela que a Conversa mandou algo. Com um
 * bilhete já na mão, `take()` devolve o MESMO sem procurar outro: o pendente
 * que chegar nesse meio-tempo espera a vez (o protocolo de arquivo já garante
 * que ele não se perde).
 *
 * `release()` devolve a mão, e quem chama é o DESFECHO do envio: aceite e
 * envio ambíguo soltam (aquele bilhete terminou); recusa comprovada NÃO solta —
 * o bilhete continua valendo para a próxima tentativa desta execução.
 *
 * O que NÃO existe aqui: "checou uma vez por execução". A Conversa pode
 * escrever o bilhete depois da primeira mensagem da Mesa; sem a busca a cada
 * mensagem, ele só apareceria no próximo reinício.
 * @param {{runtime?: string, now?: number}} options
 */
function claimHand({runtime, now} = {}) {
  let held = null;
  return {
    take() {
      if (held) return {claim: held, problem: '', fresh: false};
      const out = claimForDelivery({runtime, now});
      held = out.claim;
      return {claim: held, problem: out.problem, fresh: !!held};
    },
    release() {
      const had = !!held;
      held = null;
      return had;
    },
  };
}

/**
 * Fecha o destino do arquivo reivindicado conforme o resultado do envio.
 * `outcome`:
 *   accepted  → o Pi aceitou o prompt: marca como entregue e arquiva;
 *   refused   → nada foi escrito no Pi: o arquivo continua reivindicado, e a
 *               recuperação da próxima abertura devolve para a fila;
 *   ambiguous → o prompt pode ter sido escrito: guarda em `duvida/` em vez de
 *               voltar para a fila (contexto repetido é pior do que conferir).
 * Nunca lança e nunca apaga. Devolve `{action, path, reason}` para o main avisar.
 */
function settleDelivery(claim, {runtime, now, outcome} = {}) {
  if (!claim || !claim.path) return {action: 'nenhuma', path: ''};
  if (outcome === 'refused') {
    /* Recusa comprovada: nada foi escrito, então a marca de envio pode ser
       desfeita e o bilhete volta a ser "pode repetir". */
    const back = revertDelivery(claim.path, {runtime});
    return {action: 'mantido-reivindicado', path: back.path, ...(back.reverted ? {} : {reason: back.reason})};
  }
  if (outcome !== 'accepted') {
    const kept = quarantine(claim.path, {runtime, now, reason: 'entrega-incerta', bucket: DUVIDA});
    return {action: kept.kept ? 'guardado-em-duvida' : 'preservado', path: kept.path, reason: kept.reason};
  }
  const marked = markDelivered(claim.path, {runtime, now});
  /* Marcação que falha deixa o arquivo na fase `enviando-`: ele já pode ter
     chegado ao Pi, então não pode voltar para a fila nem no próximo reinício. */
  if (!marked.delivered) return {action: 'entregue-sem-marca', path: marked.path, reason: marked.reason};
  const archived = archiveDelivered(marked.path, {runtime, now});
  return archived.archived
    ? {action: 'arquivado', path: archived.path}
    : {action: 'entregue-preservado', path: archived.path, reason: archived.reason};
}

module.exports = {
  VERSION, FROM, MAX_REFS, STALE_MS,
  PENDENTE, CLAIM_PREFIX, SENDING_PREFIX, DELIVERED_PREFIX, ARQUIVO, FALHA, DUVIDA,
  bendList, normalizeFields, isAccepted, buildBlock,
  mesaRuntime, handoffDir, handoffPath, pendentePath, archiveDir, failureDir, doubtDir,
  readHandoff, interpret, claimPending, readClaim, beginDelivery, revertDelivery, markDelivered, archiveDelivered,
  quarantine, recoverClaims, claimForDelivery, claimHand, settleDelivery,
};
