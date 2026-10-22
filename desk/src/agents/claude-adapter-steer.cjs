// @ts-check
'use strict';

/* Steer do ClaudeAdapter (#58; especificação nos commits `fa87b66` e
   `f4aa958` da branch t3/opencode-provider, refeita no estilo do main).

   O segundo item entra na consulta que JÁ está aberta: a mesma `MessageQueue`
   que o SDK consome como `prompt` iterável. Nenhum método novo do SDK, nenhuma
   segunda sessão. O item leva `priority: 'now'` (campo de `SDKUserMessage` no
   SDK 0.3.301), que pede ao CLI para tratar a mensagem já, sem esperar a
   ferramenta em curso terminar.

   Regras de entrega (as mesmas do turno):
   - o ECO do SDK com o mesmo uuid é o aceite; ele resolve SÓ esta entrega, e
     o turno principal segue ocupado até o `result` nativo;
   - fila fechada ao empurrar é recusa comprovada (`notSent`): pode repetir;
   - prazo, queda da consulta ou close sem eco é INCERTEZA: nunca é reenviada
     sozinha e é pegajosa (o turno fica degradado e o adaptador recusa envios
     novos até um adaptador novo).

   O uuid do steer entra na família do turno (`turn.steerUuids`): um `result`
   que ecoa o steer é do MESMO turno, não de outro envio. Métodos instalados no
   protótipo pelo claude-adapter.cjs. */

const crypto = require('node:crypto');
const {message: uiMsg} = require('../i18n.mjs');
const {causeArg} = require('../error-detail.mjs');
const {ClaudeAdapterError} = require('./claude-adapter-contract.cjs');
const {isUuid, errorText, asAdapterError} = require('./claude-adapter-input.cjs');
const turnPolicy = require('./claude-turn-policy.cjs');

/**
 * @typedef {{id: string, wireUuid: string, turn: any, item: object|null, phase: string|null,
 *   finalized: boolean, timer: NodeJS.Timeout|null, resolve: (value: {accepted: true, id: string}) => void,
 *   reject: (error: Error) => void, promise: Promise<{accepted: true, id: string}>}} SteerDelivery
 */

/* A classe só leva métodos; o tipo do adaptador montado vem de
   `types/claude-adapter-host.d.ts`. `Object` não entra no que é copiado. */
const AdapterBase = /** @type {new () => import('../../types/claude-adapter-host').ClaudeAdapterHost} */ (/** @type {unknown} */ (Object));

class ClaudeAdapterSteer extends AdapterBase {
  /**
   * Entrega `prepared` na consulta viva do turno em voo.
   * @param {{id: string, prepared: {blocks: object[]}}} input
   * @returns {Promise<{accepted: true, id: string}>}
   * @example await adapter.send({id, text: 'na verdade, use a fórmula 2', delivery: 'steer'}) // → _sendSteer
   */
  async _sendSteer({id, prepared}) {
    const turn = this._turn;
    if (!turn || turn.finalized || !this._queue || !this._query || this._queryDead) {
      throw new ClaudeAdapterError('CLAUDE_STEER_UNAVAILABLE', uiMsg('err.claude.steerUnavailable'), {id}, true);
    }
    const delivery = this._newSteerDelivery(id, turn);
    const marked = await this._persistSteerMarker(turn, 'transmitting');
    if (!marked.ok) {
      throw new ClaudeAdapterError('CLAUDE_PERSIST_FAILED', uiMsg('err.claude.persistFailed', {cause: causeArg(errorText(marked.error))}), null, true);
    }
    delivery.phase = 'transmitting';
    this._emitSteerDelivery(delivery, 'transmitting');
    delivery.item = {
      type: 'user',
      message: {role: 'user', content: prepared.blocks},
      parent_tool_use_id: null,
      uuid: delivery.wireUuid,
      session_id: this._sessionId || undefined,
      priority: 'now',
    };
    this._steers.set(delivery.wireUuid, delivery);
    turn.steerUuids.add(delivery.wireUuid);
    try {
      this._queue.push(delivery.item);
    } catch (error) {
      this._refuseSteer(delivery, error);
      await this._persistSteerMarker(turn, turn.phase || 'accepted');
      return delivery.promise;
    }
    delivery.timer = setTimeout(() => {
      this._failSteerUncertain(delivery, 'err.claude.steerTimeout').catch(() => {});
    }, this._timeoutMs);
    delivery.timer.unref?.();
    return delivery.promise;
  }

  /** @param {string} id @param {any} turn @returns {SteerDelivery} */
  _newSteerDelivery(id, turn) {
    /** @type {any} */
    const delivery = {id, wireUuid: isUuid(id) ? id : crypto.randomUUID(), turn, item: null, phase: null, finalized: false, timer: null};
    delivery.promise = new Promise((resolve, reject) => { delivery.resolve = resolve; delivery.reject = reject; });
    delivery.promise.catch(() => {});
    return delivery;
  }

  /* O marcador no disco é o do TURNO (a conversa tem um fato de escrita só):
     enquanto o steer está em voo, uma queda do app vê `transmitting` e
     reabre como incerta. Não mexe em `turn.phase`. */
  /** @param {any} turn @param {string} status */
  async _persistSteerMarker(turn, status) {
    if (!this._persistDelivery) return {ok: true};
    try {
      await this._persistDelivery({id: turn.id, status});
      return {ok: true};
    } catch (error) {
      return {ok: false, error};
    }
  }

  /** @param {SteerDelivery} delivery @param {string} status */
  _emitSteerDelivery(delivery, status) {
    if (status === 'uncertain') this._deliveryUncertain = true;
    this._emitTurn(delivery.turn, 'delivery', {id: delivery.id, status, steer: true});
  }

  /** @param {SteerDelivery} delivery */
  _closeSteer(delivery) {
    delivery.finalized = true;
    if (delivery.timer) clearTimeout(delivery.timer);
    delivery.timer = null;
    this._steers.delete(delivery.wireUuid);
  }

  /** @param {SteerDelivery} delivery @param {unknown} error */
  _refuseSteer(delivery, error) {
    this._closeSteer(delivery);
    delivery.turn.steerUuids.delete(delivery.wireUuid);
    this._emitSteerDelivery(delivery, 'refused');
    delivery.reject(asAdapterError(error, true, 'CLAUDE_DELIVERY_REFUSED'));
  }

  /* Eco do SDK com o uuid do steer: a mensagem entrou na consulta viva. O
     turno principal NÃO acaba aqui. O disco volta a dizer `accepted`. */
  /** @param {SteerDelivery} delivery */
  async _acceptSteer(delivery) {
    if (delivery.finalized || delivery.phase !== 'transmitting') return;
    this._closeSteer(delivery);
    delivery.phase = 'accepted';
    await this._persistSteerMarker(delivery.turn, 'accepted');
    this._emitSteerDelivery(delivery, 'accepted');
    delivery.resolve({accepted: true, id: delivery.id});
  }

  /* Sem eco: INCERTO. Nunca é reenviado sozinho; o turno fica degradado, então
     o registro final da conversa também é incerto. */
  /** @param {SteerDelivery} delivery @param {string} key */
  async _failSteerUncertain(delivery, key) {
    if (delivery.finalized) return;
    this._closeSteer(delivery);
    delivery.phase = 'uncertain';
    delivery.turn.degraded = true;
    await this._persistSteerMarker(delivery.turn, 'uncertain');
    this._emitSteerDelivery(delivery, 'uncertain');
    delivery.reject(new ClaudeAdapterError('CLAUDE_DELIVERY_UNCERTAIN', uiMsg(key), null, false));
  }

  /* A consulta morreu ou fechou com steers em voo. */
  /** @param {string} key */
  _failOpenSteers(key) {
    for (const delivery of [...this._steers.values()]) this._failSteerUncertain(delivery, key).catch(() => {});
  }

  /* Mensagem do CLI que ecoa um steer em voo: aceita a entrega. Devolve true
     quando a mensagem era só o eco (o replay não segue para o resto). */
  /** @param {any} message @returns {Promise<boolean>} */
  async _routeSteerEcho(message) {
    if (!this._steers.size) return false;
    const delivery = [...this._steers.values()].find((entry) => turnPolicy.correlationEvidence(message, entry.wireUuid).evidence === 'match');
    if (!delivery) return false;
    await this._acceptSteer(delivery);
    return message.type === 'user' && message.isReplay === true;
  }

  /* Uuid do turno que a mensagem ecoa: o do envio principal ou o de um steer
     do mesmo turno. Sem eco de nenhum dos dois, o do principal (a política
     decide o resto). */
  /** @param {any} turn @param {any} message @returns {string} */
  _turnEchoUuid(turn, message) {
    if (!turn.steerUuids.size) return turn.wireUuid;
    if (turnPolicy.correlationEvidence(message, turn.wireUuid).evidence !== 'mismatch') return turn.wireUuid;
    const steer = [...turn.steerUuids].find((uuid) => turnPolicy.correlationEvidence(message, uuid).evidence === 'match');
    return steer || turn.wireUuid;
  }
}

module.exports = {ClaudeAdapterSteer};
