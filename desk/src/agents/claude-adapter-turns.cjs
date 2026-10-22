'use strict';

/* Ciclo do turno do ClaudeAdapter: eventos, entrega, prazo, recusa antes da
   entrega e liquidação. Métodos instalados no protótipo pelo
   claude-adapter.cjs (#43 fase 2). */

const {ClaudeAdapterError} = require('./claude-adapter-contract.cjs');
const {errorText} = require('./claude-adapter-input.cjs');

class ClaudeAdapterTurns {
  _emit(type, payload = {}, identity = null) {
    this.emit('event', {
      type,
      conversationId: this._conversationId,
      runId: identity ? identity.runId : this._runId,
      generation: identity ? identity.generation : this._generation,
      adapter: 'claude',
      at: new Date().toISOString(),
      ...payload,
    });
  }

  _emitTurn(turn, type, payload = {}) {
    this._emit(type, payload, {runId: turn.wireUuid, generation: turn.generation});
  }

  _emitDelivery(turn, status) {
    if (turn.delivered.has(status)) return;
    turn.delivered.add(status);
    /* Incerteza de entrega é fato PEGAJOSO do adaptador (o Bend a usa no
       portão dos controles e no envio): só um adaptador novo resolve. */
    if (status === 'uncertain') this._deliveryUncertain = true;
    this._emitTurn(turn, 'delivery', {id: turn.id, status});
  }

  _enqueue(turn, fn) {
    const run = () => Promise.resolve().then(fn);
    const next = turn.chain.then(run, run);
    turn.chain = next.then(() => undefined, () => undefined);
    return next;
  }

  _clearTimer(turn) {
    if (turn.timer) {
      clearTimeout(turn.timer);
      turn.timer = null;
    }
  }

  _rejectPending(turn, error) {
    if (!turn.pending || turn.pending.settled) return;
    turn.pending.settled = true;
    this._clearTimer(turn);
    turn.pending.reject(error);
  }

  /* Registro de entrega: idempotente por status, callback sync OU async é
     aguardado. Falha NÃO muda a fase (conservador). */

  async _record(turn, status, detail) {
    if (turn.phase === status) return {ok: true, changed: false};
    if (!this._persistDelivery) {
      turn.phase = status;
      return {ok: true, changed: true};
    }
    try {
      await this._persistDelivery(detail ? {id: turn.id, status, ...detail} : {id: turn.id, status});
      turn.phase = status;
      return {ok: true, changed: true};
    } catch (error) {
      return {ok: false, changed: false, error};
    }
  }

  _emitInitOnce(turn) {
    if (this._initEmitted || !this._sessionId) return;
    this._initEmitted = true;
    const payload = {
      sessionId: this._sessionId,
      version: this._version || null,
      model: this._model || null,
      executable: this._claudePath,
      executableNote: this._executableNote,
    };
    if (turn) this._emitTurn(turn, 'init', payload);
    else this._emit('init', payload);
  }

  _finishTurn(turn) {
    if (!turn || this._turn === turn) {
      this._activityCallGate?.clear();
      this._busy = false;
      this._turn = null;
      this._runId = null;
      this._cancelRequested = false;
      this._toolNames.clear();
      this._streamed.clear();
    }
  }

  /* Aceite comprovado: primeiro PERSISTE, só então resolve o envio. Se o
     registro falhar, o turno vira incerto e a mensagem nunca é repetida. */

  async _resolveAccepted(turn) {
    if (turn.acceptResolved || turn.finalized || turn.acceptAttempted) return;
    turn.acceptAttempted = true;
    this._emitInitOnce(turn);
    const recorded = await this._record(turn, 'accepted');
    if (recorded.ok) {
      turn.acceptResolved = true;
      this._emitDelivery(turn, 'accepted');
      this._clearTimer(turn);
      if (turn.pending && !turn.pending.settled) {
        turn.pending.settled = true;
        turn.pending.resolve({accepted: true, id: turn.id});
      }
      return;
    }
    turn.degraded = true;
    this._emitTurn(turn, 'error', {
      message: `o aceite foi comprovado, mas não deu para registrar; tratado como incerto e nunca repetido (${errorText(recorded.error)})`,
      code: 'CLAUDE_PERSIST_FAILED',
      detail: {phase: 'accepted'},
    });
    await this._record(turn, 'uncertain');
    this._emitDelivery(turn, 'uncertain');
    this._rejectPending(turn, new ClaudeAdapterError(
      'CLAUDE_DELIVERY_UNCERTAIN',
      'o aceite foi comprovado mas não pôde ser registrado; a mensagem NÃO é repetida automaticamente',
      {persistFailure: true, phase: 'accepted'},
      false,
    ));
  }

  async _timeoutTurn(turn) {
    if (turn.finalized || turn.acceptResolved || turn.phase !== 'transmitting') return;
    const recorded = await this._record(turn, 'uncertain', {timedOut: true});
    if (!recorded.ok) {
      this._emitTurn(turn, 'error', {
        message: `tempo esgotado sem confirmação e o registro incerto falhou (${errorText(recorded.error)}); o registro anterior fica como está`,
        code: 'CLAUDE_PERSIST_FAILED',
        detail: {phase: 'uncertain'},
      });
    }
    this._emitDelivery(turn, 'uncertain');
    this._rejectPending(turn, new ClaudeAdapterError(
      'CLAUDE_DELIVERY_UNCERTAIN',
      'tempo esgotado sem confirmação de recebimento; a mensagem não é repetida automaticamente',
      {timedOut: true},
      false,
    ));
  }

  /* Falha comprovada ANTES do yield: tentar registrar recusa; se o registro
     falhar, cai para incerto (conservador) em vez de prometer recusa. */

  async _refuseBeforeDelivery(turn, failure) {
    if (turn.finalized) return;
    turn.finalized = true;
    this._clearTimer(turn);
    const recorded = await this._record(turn, 'refused');
    if (recorded.ok) {
      this._emitDelivery(turn, 'refused');
      this._emitTurn(turn, 'error', {message: failure.message, code: failure.code});
      this._rejectPending(turn, failure);
      this._emitTurn(turn, 'turn_end', {cancelled: false, isError: true, uncertain: false});
      this._finishTurn(turn);
      return;
    }
    await this._record(turn, 'uncertain');
    this._emitTurn(turn, 'error', {
      message: `a recusa não pôde ser registrada; tratado como incerto (${errorText(recorded.error)})`,
      code: 'CLAUDE_PERSIST_FAILED',
      detail: {phase: 'refused', cause: failure.code},
    });
    this._emitDelivery(turn, 'uncertain');
    this._rejectPending(turn, new ClaudeAdapterError(
      'CLAUDE_DELIVERY_UNCERTAIN',
      'a recusa não pôde ser registrada; tratado como incerto e nunca repetido automaticamente',
      {persistFailure: true, phase: 'refused', cause: failure.code},
      false,
    ));
    this._emitTurn(turn, 'turn_end', {cancelled: false, isError: true, uncertain: true});
    this._finishTurn(turn);
  }

  /* Fim de turno: persistir o desfecho ANTES do evento final. */
  async _finalizeTurn(turn, outcome, meta = {}) {
    if (turn.finalized) return;
    turn.finalized = true;
    this._clearTimer(turn);
    this._invalidatePermissions('Rodada terminou', turn, 'turn_end');
    let uncertain;

    if (outcome === 'settled') {
      const recorded = await this._record(turn, 'settled');
      if (recorded.ok) {
        uncertain = false;
        this._emitDelivery(turn, 'settled');
      } else {
        uncertain = true;
        await this._record(turn, 'uncertain');
        this._emitTurn(turn, 'error', {
          message: `não deu para registrar o término do turno; mantido como incerto (${errorText(recorded.error)})`,
          code: 'CLAUDE_PERSIST_FAILED',
          detail: {phase: 'settled'},
        });
        this._emitDelivery(turn, 'uncertain');
      }
    } else if (outcome === 'refused') {
      const recorded = await this._record(turn, 'refused');
      if (recorded.ok) {
        uncertain = false;
        this._emitDelivery(turn, 'refused');
        this._rejectPending(turn, meta.error || new ClaudeAdapterError(
          'CLAUDE_DELIVERY_REFUSED',
          `nada foi enviado ao Claude Code (${meta.message || 'queda antes da entrega'})`,
          meta.detail || null,
          true,
        ));
      } else {
        uncertain = true;
        await this._record(turn, 'uncertain');
        this._emitTurn(turn, 'error', {
          message: `a recusa não pôde ser registrada; tratado como incerto (${errorText(recorded.error)})`,
          code: 'CLAUDE_PERSIST_FAILED',
          detail: {phase: 'refused'},
        });
        this._emitDelivery(turn, 'uncertain');
        this._rejectPending(turn, new ClaudeAdapterError(
          'CLAUDE_DELIVERY_UNCERTAIN',
          'a recusa não pôde ser registrada; tratado como incerto e nunca repetido automaticamente',
          {persistFailure: true, phase: 'refused'},
          false,
        ));
      }
    } else {
      uncertain = true;
      const recorded = await this._record(turn, 'uncertain', meta.recordDetail);
      if (!recorded.ok) {
        this._emitTurn(turn, 'error', {
          message: `não deu para registrar a incerteza (${errorText(recorded.error)}); o registro anterior fica como está`,
          code: 'CLAUDE_PERSIST_FAILED',
          detail: {phase: 'uncertain'},
        });
      }
      this._emitDelivery(turn, 'uncertain');
      this._rejectPending(turn, meta.error || new ClaudeAdapterError(
        'CLAUDE_DELIVERY_UNCERTAIN',
        `a mensagem pode ter chegado ao Claude Code sem confirmação (${meta.message || 'sem confirmação'}); não é repetida automaticamente`,
        meta.detail || null,
        false,
      ));
    }

    this._emitTurn(turn, 'turn_end', {
      cancelled: meta.cancelled === true,
      isError: meta.isError === true,
      uncertain,
    });
    this._finishTurn(turn);
  }
}

module.exports = {ClaudeAdapterTurns};
