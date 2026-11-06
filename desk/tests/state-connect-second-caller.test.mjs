/* Segundo `connect()` na mesma sessão com voo pendente: um voo novo é lançado
   em fundo, mas quem chamou recebe o promise ANTIGO. Se o antigo falha/é
   cancelado e o novo liga, quem pediu a conexão nova recebe a falha do voo
   velho e segue sem conexão — ex.: o `send()` desiste do envio com a sessão
   ligando logo depois. Quem chamou tem de receber o voo novo (o desfecho do
   próprio pedido), como já acontece na troca de sessão.
   Rodar: node --test --test-force-exit tests/state-connect-second-caller.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import {installDom} from './dom-shim.mjs';

const {window} = installDom();
const state = await import('../src/state.mjs');
const {S, connect} = state;
const tick = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms));

test('segundo connect na mesma sessão recebe o voo novo, não o antigo cancelado', async () => {
  S.connected = false;
  S.connectCancelled = false;
  S.currentSession = '/A.jsonl';
  S.link = {state: '', label: '', reason: ''};
  S.connecting = null;
  S.connectingSession = null;
  let rejectOld;
  let resolveFresh;
  const calls = [];
  window.desk.connect = () => {
    const index = calls.length;
    calls.push(index);
    return new Promise((resolve, reject) => {
      if (index === 0) rejectOld = reject; else resolveFresh = resolve;
    });
  };
  window.desk.getConfig = async () => ({engine: 'opencode', models: []});
  const first = connect();
  await tick();
  assert.equal(calls.length, 1);
  /* O segundo pedido (ex.: o Enviar enquanto o boot ainda chama) lança um voo
     novo em fundo; o desfecho que ele observa tem de ser o do voo novo. */
  const second = connect();
  await tick();
  assert.equal(calls.length, 2, 'o segundo connect lança um voo novo em fundo');
  /* O voo antigo é cancelado (o Cancelar do "Chamando" não invalida por desenho:
     o catch precisa pintar "desligado" se fosse o corrente); o novo resolve. */
  S.connectCancelled = true;
  rejectOld(Error('Chamada ao tutor cancelada'));
  await first.catch(() => {});
  resolveFresh({engine: 'opencode', models: [], session: '/A.jsonl'});
  await second;
  await tick();
  assert.equal(S.connected, true, 'quem pediu a conexão nova segue com a sessão ligada');
  assert.equal(S.link.state, 'online');
});

test('segundo connect na mesma sessão recebe o erro do voo novo, não o do antigo', async () => {
  S.connected = false;
  S.connectCancelled = false;
  S.currentSession = '/B.jsonl';
  S.link = {state: '', label: '', reason: ''};
  S.connecting = null;
  S.connectingSession = null;
  let resolveOld;
  let rejectFresh;
  const calls = [];
  window.desk.connect = () => {
    const index = calls.length;
    calls.push(index);
    return new Promise((resolve, reject) => {
      if (index === 0) resolveOld = resolve; else rejectFresh = reject;
    });
  };
  window.desk.getConfig = async () => ({engine: 'opencode', models: []});
  const first = connect();
  await tick();
  const second = connect();
  await tick();
  assert.equal(calls.length, 2);
  /* O antigo resolve tarde (ignorado por geração); o novo falha de verdade. */
  resolveOld({engine: 'opencode', models: [], session: '/B.jsonl'});
  await first;
  rejectFresh(Error('O tutor não respondeu'));
  await assert.rejects(second, /não respondeu/);
  await tick();
  assert.equal(S.connected, false, 'o voo novo falhou: a sessão segue desligada');
  assert.equal(S.link.state, 'error');
});
