'use strict';

/* Limites e avisos do ClaudeAdapter: rate limit por janela, overage, retomada,
   retry da API e recusa do modelo. Métodos instalados no protótipo pelo
   claude-adapter.cjs (#43 fase 2). */

const {message: uiMsg} = require('../i18n.mjs');
/* Política pura de liquidação do turno (correlação, fim de consulta, falhas
   nativas, retry e recusa): o adaptador mede os fatos e aplica o veredito. */
const turnPolicy = require('./claude-turn-policy.cjs');
const {MAX_RATE_LIMIT_NOTICES, MAX_RATE_LIMIT_WAIT_MS, RATE_LIMIT_WINDOWS} = require('./claude-adapter-contract.cjs');

function rateLimitReset(resetsAt) {
  if (!Number.isFinite(resetsAt) || resetsAt <= 0) return {resetsAt: null, resetAt: null, waitMs: null};
  const ms = resetsAt * 1000;
  const date = new Date(ms);
  const valid = !Number.isNaN(date.getTime());
  const waitMs = ms - Date.now();
  return {
    resetsAt,
    resetAt: valid ? date.toISOString() : null,
    waitMs: valid && waitMs > 0 && waitMs <= MAX_RATE_LIMIT_WAIT_MS ? waitMs : null,
  };
}

function formatWaitMs(waitMs) {
  const totalMinutes = Math.ceil(waitMs / 60000);
  if (totalMinutes < 60) return `${totalMinutes}min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours}h${minutes}min` : `${hours}h`;
}

/* Normaliza o input de AskUserQuestion (sdk-tools.d.ts do pin 0.3.301) para o
   contrato da Mesa: pergunta sem texto é descartada; header ausente ganha um
   rótulo neutro; opção sem label é descartada; o restante é preservado. */

class ClaudeAdapterRateLimit {
  _handleApiRetry(message) {
    const retry = turnPolicy.classifyApiRetry(message);
    if (!retry) return;
    const turn = this._rateLimitActiveTurn();
    const seen = turn ? turn.apiRetries : this._apiRetryNotices;
    if (seen.has(retry.dedupeKey)) return;
    seen.add(retry.dedupeKey);
    if (!turn) {
      while (this._apiRetryNotices.size > MAX_RATE_LIMIT_NOTICES) {
        const oldest = this._apiRetryNotices.keys().next().value;
        this._apiRetryNotices.delete(oldest);
      }
    }
    const payload = {message: retry.message, code: retry.code, detail: retry.detail};
    if (turn) this._emitTurn(turn, 'warning', payload);
    else this._emit('warning', payload);
  }

  /* Recusa/fallback do modelo (SDK 0.3.301): aviso com dados limitados e a
     retração exposta no detalhe (UUIDs limitados/deduplicados). A evicção de
     DOM fica explicitamente ADIADA: o adaptador não remove mensagem nenhuma. */

  _handleRefusalNotice(message) {
    const refusal = turnPolicy.classifyRefusalNotice(message);
    if (!refusal) return;
    let text = refusal.notice;
    if (!text && refusal.kind === 'no_fallback') {
      text = uiMsg('claude.refusal.category', {category: refusal.detail.apiRefusalCategory || '—'});
    } else if (!text && refusal.detail.retractedMessageUuids.length) {
      text = uiMsg('claude.refusal.retracted');
    }
    if (!text) return;
    const payload = {message: text, code: refusal.code, detail: refusal.detail};
    const turn = this._rateLimitActiveTurn();
    if (turn) this._emitTurn(turn, 'warning', payload);
    else this._emit('warning', payload);
  }

  /* ---------------- limite de uso (rate_limit_event) ---------------- */

  _rateLimitOverage(info) {
    return info.overageStatus === 'allowed'
      || info.overageStatus === 'allowed_warning'
      || info.isUsingOverage === true
      || info.overageInUse === true;
  }

  _rateLimitActiveTurn() {
    return this._turn && !this._turn.finalized ? this._turn : null;
  }

  _rateLimitAnnounced(key) {
    const turn = this._rateLimitActiveTurn();
    if (turn) return turn.announcedRateLimits.has(key);
    return this._rateLimitNotices.has(key);
  }

  _rateLimitRemember(key) {
    const turn = this._rateLimitActiveTurn();
    if (turn) {
      turn.announcedRateLimits.add(key);
      return;
    }
    this._rateLimitNotices.set(key, true);
    if (this._rateLimitNotices.size > MAX_RATE_LIMIT_NOTICES) {
      const oldest = this._rateLimitNotices.keys().next().value;
      this._rateLimitNotices.delete(oldest);
    }
  }

  /* `allowed` libera a janela: um novo rejected da mesma janela volta a
     avisar em vez de ficar silencioso para sempre. */

  _forgetRateLimit(type) {
    const marker = `:${type}:`;
    const turn = this._rateLimitActiveTurn();
    if (turn) {
      for (const key of [...turn.announcedRateLimits]) {
        if (key.includes(marker)) turn.announcedRateLimits.delete(key);
      }
    }
    for (const key of [...this._rateLimitNotices.keys()]) {
      if (key.includes(marker)) this._rateLimitNotices.delete(key);
    }
  }

  /* Memória de janelas REJEITADAS (pode haver várias ao mesmo tempo). É o que
     permite emitir UMA transição de liberação por janela, e não a cada
     `allowed` repetido. */

  _rememberRejectedWindow(type, info) {
    this._rejectedWindows.set(type, {resetsAt: Number.isFinite(info.resetsAt) ? info.resetsAt : null});
    if (this._rejectedWindows.size > MAX_RATE_LIMIT_NOTICES) {
      const oldest = this._rejectedWindows.keys().next().value;
      this._rejectedWindows.delete(oldest);
    }
  }

  /* Transição rejected → allowed: UM aviso canônico para a UI limpar a pausa.
     Só sai quando a janela estava marcada como rejeitada; não mexe em
     busy/fila/liquidação. */

  _noteRateLimitResumed(info, type) {
    if (!this._rejectedWindows.has(type)) return;
    this._rejectedWindows.delete(type);
    const reset = rateLimitReset(info.resetsAt);
    const payload = {
      code: 'CLAUDE_RATE_LIMIT_RESUMED',
      message: uiMsg('claude.limit.resumed', {window: RATE_LIMIT_WINDOWS[type] || 'usage'}),
      rateLimit: {...this._rateLimitPayload(info, type, reset, {blocked: false, overageInUse: this._rateLimitOverage(info)}), resumed: true},
    };
    const turn = this._rateLimitActiveTurn();
    if (turn) this._emitTurn(turn, 'warning', payload);
    else this._emit('warning', payload);
  }

  _rateLimitPayload(info, type, reset, {blocked, overageInUse}) {
    const overageReset = rateLimitReset(Number.isFinite(info.overageResetsAt) ? info.overageResetsAt : NaN);
    return {
      status: info.status,
      type: type === 'unknown' ? null : type,
      window: RATE_LIMIT_WINDOWS[type] || null,
      resetsAt: reset.resetsAt,
      resetAt: reset.resetAt,
      waitMs: reset.waitMs,
      utilization: Number.isFinite(info.utilization) ? info.utilization : null,
      blocked: blocked === true,
      overage: {
        status: typeof info.overageStatus === 'string' ? info.overageStatus : null,
        inUse: overageInUse === true,
        disabledReason: typeof info.overageDisabledReason === 'string' ? info.overageDisabledReason : null,
        resetsAt: overageReset.resetsAt,
        resetAt: overageReset.resetAt,
        waitMs: overageReset.waitMs,
      },
      surpassedThreshold: Number.isFinite(info.surpassedThreshold) ? info.surpassedThreshold : null,
    };
  }

  _rateLimitMessage(type, reset, kind) {
    const window = RATE_LIMIT_WINDOWS[type] || 'usage';
    const wait = reset.waitMs != null ? formatWaitMs(reset.waitMs) : '';
    const family = kind === 'blocked' ? 'blocked' : kind === 'warning' ? 'warning' : 'overage';
    return uiMsg(wait ? `claude.limit.${family}Wait` : `claude.limit.${family}`, {window, wait});
  }

  /* Evento de primeiro nível do SDK 0.3.301 (o subtipo em `system` é legado
     defensivo). NÃO encerra o turno e NÃO libera busy: o CLI pausa a própria
     janela rejeitada. Avisos são deduplicados por janela/turno; `allowed`
     libera (e emite UMA transição RESUMED se a janela estava rejeitada);
     overage em uso continua. */

  _handleRateLimit(message) {
    const info = message?.rate_limit_info;
    if (!info || typeof info !== 'object') return;
    const status = info.status;
    if (status !== 'allowed' && status !== 'allowed_warning' && status !== 'rejected') return;
    const type = typeof info.rateLimitType === 'string' && info.rateLimitType ? info.rateLimitType : 'unknown';

    if (status === 'allowed') {
      const activeTurn = this._rateLimitActiveTurn();
      if (activeTurn) {
        /* `allowed` limpa a evidência da janela rejeitada DESTE turno: um
           result depois não pode ser rotulado como limite recuperado. */
        activeTurn.rejectedRateLimitTypes.delete(type);
        activeTurn.lastRateLimit = null;
      }
      this._forgetRateLimit(type);
      this._noteRateLimitResumed(info, type);
      return;
    }

    const overageInUse = this._rateLimitOverage(info);
    const blocked = status === 'rejected' && !overageInUse;
    const turn = this._rateLimitActiveTurn();
    if (turn) {
      if (blocked) turn.rejectedRateLimitTypes.add(type);
      else if (status === 'allowed_warning' || overageInUse) turn.rejectedRateLimitTypes.delete(type);
    }
    if (blocked) this._rememberRejectedWindow(type, info);
    /* `allowed_warning` e rejected-com-overage NÃO limpam a pausa: a transição
       que a UI espera é o `allowed` da janela rejeitada (um RESUMED por vez). */
    const kind = blocked ? 'blocked' : status === 'allowed_warning' ? 'warning' : 'overage';
    const reset = rateLimitReset(info.resetsAt);
    const key = `${kind}:${type}:${reset.resetsAt ?? 'unknown'}`;
    /* O texto do overage usa a janela do próprio overage quando o CLI manda. */
    const messageReset = kind === 'overage' && Number.isFinite(info.overageResetsAt) && info.overageResetsAt > 0
      ? rateLimitReset(info.overageResetsAt)
      : reset;
    const payload = {
      code: kind === 'blocked' ? 'CLAUDE_RATE_LIMITED' : kind === 'warning' ? 'CLAUDE_RATE_LIMIT_WARNING' : 'CLAUDE_RATE_LIMIT_OVERAGE',
      message: this._rateLimitMessage(type, messageReset, kind),
      rateLimit: this._rateLimitPayload(info, type, reset, {blocked, overageInUse}),
    };
    if (turn) turn.lastRateLimit = payload.rateLimit;
    if (this._rateLimitAnnounced(key)) return;
    this._rateLimitRemember(key);
    if (turn) this._emitTurn(turn, 'warning', payload);
    else this._emit('warning', payload);
  }
}

module.exports = {ClaudeAdapterRateLimit, rateLimitReset, formatWaitMs};
