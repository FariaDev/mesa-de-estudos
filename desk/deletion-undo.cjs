'use strict';

/* Desfazer remoção — tokens, prazos e merge no backend (em processo).
 *
 * O item removido (ORIGINAL, com id/datas/agenda) fica só NESTE processo, atrás
 * de um token opaco curto e com prazo. O renderer nunca manda item de volta:
 * `check` só devolve o que o backend guardou, e apenas quando o escopo atual é o
 * mesmo da emissão e (nas anotações) o caminho continua autorizado.
 *
 * A DECISÃO pura (desconhecido → vencido → outro escopo → material bloqueado →
 * pronto) mora no núcleo Bend `core/undoview.bend` (leis em
 * `core/laws/undoview.bend`, provas em `core/proofs/undoview.bend`). O host
 * confere o relógio, o mapa de tokens e a lista autorizada; o núcleo decide.
 *
 * Contrato para o integrador (`main.cjs`/`services.cjs`):
 *   - cada domínio cria o seu store: `createUndoStore()` (Caderno usa
 *     `review.cjs`; Anotações usa `annotations.cjs`), então um token de um
 *     domínio nunca vale no outro;
 *   - `issue({kind, scopeKey, item, index, schedule, at})` → `{token, expiresAt}`
 *     (o token nasce AQUI; o renderer nunca o inventa);
 *   - `check({token, scopeKey, authorized, at})` valida o token e devolve
 *     `{ok:true, entry}` ou `{ok:false, reason}` com `reason` em
 *     `'unknown'|'expired'|'scope'|'unauthorized'`; recusas de escopo/material
 *     NÃO consomem o token — o dono legítimo ainda pode desfazer no prazo;
 *   - `commit(token)` consome somente após a gravação; falhas de disco permitem
 *     nova tentativa. `take(options)` combina os dois para usos sem disco;
 *   - `mergeRemoved(items, removed, same, index)` reinsere UMA entrada na
 *     posição clampada, sem duplicar identidade; devolve `{items, restored}`.
 *
 * `MESA_UNDOVIEW_CORE` aponta para um artefato temporário nos testes; sem a
 * variável, o host carrega `desk/src/generated/undoview.core.js` (o build do
 * pai gera de `core/undoview.bend`). Nada aqui abre socket nem toca disco. */

const crypto = require('node:crypto');
const path = require('node:path');
const {toNat, wholeNat} = require('./src/bend-nat.mjs');

let coreCache = null;

function core() {
  if (!coreCache) {
    const file = process.env.MESA_UNDOVIEW_CORE
      || path.join(__dirname, 'src', 'generated', 'undoview.core.js');
    try {
      coreCache = require(file).default;
    } catch (error) {
      const missing = new Error('O núcleo do Desfazer não foi gerado (core/undoview.bend → desk/src/generated/undoview.core.js).');
      missing.code = 'UNDO_CORE_MISSING';
      missing.cause = error;
      throw missing;
    }
  }
  return coreCache;
}

const ttlMs = () => Number(core().ttlMs());
const noticeMs = () => Number(core().noticeMs());
const maxEntries = () => Number(core().maxEntries());

/* O token é curto e opaco: 9 bytes em base64url dão 12 caracteres, dentro do
 * teto do núcleo e longe de qualquer id de registro. */
function newToken() {
  return crypto.randomBytes(9).toString('base64url');
}

function textOf(value) {
  return typeof value === 'string' ? value : '';
}

function createUndoStore(options = {}) {
  const entries = new Map();
  const fixedTtl = Number.isFinite(Number(options.ttlMs)) && Number(options.ttlMs) > 0
    ? Math.trunc(Number(options.ttlMs))
    : 0;

  const ttlOf = () => fixedTtl || ttlMs();

  /* Vencido sai do mapa; acima do teto, o mais antigo sai primeiro. O token
   * pedido NUNCA é podado por fora: ele decide o próprio vencimento em `check`. */
  function prune(at, keep = '') {
    for (const [token, entry] of [...entries]) {
      if (token === keep) continue;
      if (core().isExpired(toNat(at), toNat(entry.expiresAt))) entries.delete(token);
    }
    while (entries.size > maxEntries()) {
      let victim = null;
      for (const token of entries.keys()) {
        if (token !== keep) {
          victim = token;
          break;
        }
      }
      if (!victim) break;
      entries.delete(victim);
    }
  }

  return {
    /* Emite o token para o item removido. `schedule` é o instantâneo da agenda
     * do Caderno (ou null): volta por ID no undo, sem sync que perca histórico. */
    issue({kind = '', scopeKey = '', item, index = 0, schedule = null, token = '', at = Date.now()} = {}) {
      const now = Math.max(0, Math.trunc(Number(at) || 0));
      prune(now);
      let candidate = core().validToken(textOf(token).trim()) ? textOf(token).trim() : newToken();
      while (entries.has(candidate)) candidate = newToken();
      const expiresAt = Number(core().expiryFrom(toNat(now), toNat(ttlOf())));
      entries.set(candidate, {
        kind: textOf(kind),
        scopeKey: textOf(scopeKey),
        item,
        index: Number.isFinite(Number(index)) ? Math.max(0, Math.trunc(Number(index))) : 0,
        schedule,
        expiresAt,
      });
      return {token: candidate, expiresAt};
    },

    /* Valida sem consumir quando a decisão do núcleo é `Ready`. `authorized` pode
     * ser um booleano ou `(entry) => boolean` (as anotações precisam do item
     * guardado para conferir o caminho contra a biblioteca atual). */
    check({token = '', scopeKey = '', authorized = true, at = Date.now()} = {}) {
      const now = Math.max(0, Math.trunc(Number(at) || 0));
      const key = textOf(token);
      const entry = core().validToken(key) ? entries.get(key) : undefined;
      prune(now, key);
      const known = !!entry;
      const expired = entry ? core().isExpired(toNat(now), toNat(entry.expiresAt)) : true;
      /* O callback de autorização só roda para token vivo: vencido é recusa
       * antes de qualquer conferência de material. */
      const authorizedOk = entry && !expired
        ? (typeof authorized === 'function' ? authorized(entry) !== false : authorized !== false)
        : false;
      const decision = core().decide(
        known,
        expired,
        entry ? entry.scopeKey === textOf(scopeKey) : false,
        authorizedOk
      );
      if (decision.$ === 'UndoUnknown') return {ok: false, reason: 'unknown'};
      if (decision.$ === 'UndoExpired') {
        entries.delete(key);
        return {ok: false, reason: 'expired'};
      }
      if (decision.$ === 'UndoForeign') return {ok: false, reason: 'scope'};
      if (decision.$ === 'UndoBlocked') return {ok: false, reason: 'unauthorized'};
      return {ok: true, entry: {token: key, ...entry}};
    },

    // Domínios com disco confirmam somente depois de gravar a restauração.
    commit(token) { entries.delete(textOf(token)); },

    take(options = {}) {
      const result = this.check(options);
      if (result.ok) this.commit(result.entry.token);
      return result;
    },

    peek(token) {
      return entries.get(textOf(token)) || null;
    },

    size() {
      return entries.size;
    },

    clear() {
      entries.clear();
    },
  };
}

/* Reinsere UMA entrada, na posição original (clampada ao tamanho atual), sem
 * duplicar identidade. O resto da lista fica exatamente como está agora. */
function mergeRemoved(items, removed, same, index = 0) {
  const list = Array.isArray(items) ? items.slice() : [];
  if (typeof same === 'function' && list.some((one) => same(one, removed))) {
    return {items: list, restored: false};
  }
  const at = Number(core().clampIndex(
    wholeNat(index),
    toNat(list.length)
  ));
  list.splice(at, 0, removed);
  return {items: list, restored: true};
}

/* Texto em português para o motivo da recusa (o aviso mostra; o backend não
 * grava). O renderer chama isto com o mesmo núcleo. */
function reasonText(reason) {
  switch (reason) {
    case 'expired':
      return core().expiredText();
    case 'scope':
      return core().foreignText();
    case 'unauthorized':
      return core().blockedText();
    case 'unknown':
      return core().unknownText();
    default:
      return core().failedText();
  }
}

module.exports = {
  createUndoStore,
  mergeRemoved,
  reasonText,
  newToken,
  ttlMs,
  noticeMs,
  maxEntries,
};
