/* UI de atividades em Electron sintético: store/runtime/ponte reais no main,
   preload no formato de produção e o `src/activity.mjs` real no host. Verifica
   montagem ao vivo, histórico preguiçoso, protocolo de estado, ampliar sem
   recarregar, reiniciar com contexto novo, parar laço, rascunho e as duas vias
   de correlação (Pi por toolCallId, Claude por callRef registrado).

   Uso: node tests/hunt-activity-ui.mjs */
import {_electron as electron} from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {testEnv} from './electron-env.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(here, '..');
const MAIN = path.join(here, 'fixtures', 'activity', 'ui-main.cjs');
const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-activity-ui-hunt-'));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let failures = 0;

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`[PASS] ${label}`);
  } else {
    failures += 1;
    console.log(`[FAIL] ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function waitFor(run, timeout = 8000, interval = 120) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await run();
    if (value) return value;
    await sleep(interval); // espera fixa: intervalo do próprio polling
  }
  return null;
}

async function frameFor(page, prefix = 'mesa-activity://') {
  return waitFor(async () => page.frames().find((frame) => frame.url().startsWith(prefix)) || null, 10000);
}

const app = await electron.launch({args: [MAIN], cwd: DESK, env: testEnv({ACTIVITY_RUNTIME: runtime})});
try {
  const page = await app.firstWindow();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error && error.message || error)));
  page.on('crash', () => {
    app.evaluate(() => (global.__ui ? global.__ui.watchdogLog() : [])).then((log) => console.log('WATCHDOG AT PAGE CRASH', JSON.stringify(log))).catch(() => {});
  });
  page.on('console', (message) => {
    if (message.type() === 'error') pageErrors.push(`console: ${message.text()}`);
  });
  await page.waitForFunction(() => !!window.__activityHost, undefined, {timeout: 10000});
  await app.evaluate(() => !!global.__ui);

  /* 1. Publicação ao vivo (Pi) monta o artefato e conversa estado. */
  await page.evaluate(() => window.__addSlot('call-live-1', 'done'));
  const published = await app.evaluate(() => global.__ui.publishThroughBridge('MRUV_SPEC', {toolCallId: 'call-live-1'}));
  check('ponte publica a atividade (Pi)', published.data?.published === true, JSON.stringify(published.data));
  await page.waitForSelector('.activity-slot[data-activity-call="call-live-1"] .activity-iframe', {timeout: 10000});
  const mruvFrame = await frameFor(page);
  check('iframe montado com origem mesa-activity', !!mruvFrame, page.frames().map((frame) => frame.url()).join(', '));
  await mruvFrame.waitForSelector('#s-out', {timeout: 10000});
  const initial = await mruvFrame.locator('#s-out').textContent();
  check('artefato renderiza o valor inicial', initial.includes('15.0'), initial);
  await page.locator('.activity-slot[data-activity-call="call-live-1"] .activity-card').scrollIntoViewIfNeeded();
  await mruvFrame.evaluate(() => { const a = document.getElementById('a'); a.value = '4'; a.dispatchEvent(new Event('input', {bubbles: true})); });
  const moved = await mruvFrame.locator('#s-out').textContent();
  check('artefato recalcula com o slider', moved.includes('24.0'), moved);
  const saved = await waitFor(async () => {
    const item = (await app.evaluate(() => global.__ui.list()))[0];
    if (!item) return null;
    const state = await app.evaluate((_electron, payload) => global.__ui.stateOf(payload.id, payload.version, payload.hash), item);
    return state?.state?.values?.a === 4 ? state : null;
  }, 6000);
  check('estado da atividade chega ao store (a=4)', !!saved, JSON.stringify(saved));
  const itemLive = (await app.evaluate(() => global.__ui.list()))[0];
  const lastRead = await app.evaluate(() => global.__ui.lastReadPayload());
  check('activityRead repassa scopeRef do item', !!itemLive && lastRead?.scopeRef === itemLive.scopeRef, JSON.stringify(lastRead));
  const lastState = await app.evaluate(() => global.__ui.lastStatePayload());
  check('activityStateSave repassa scopeRef do item', !!itemLive && lastState?.scopeRef === itemLive.scopeRef, JSON.stringify(lastState));
  const rejectedScope = await page.evaluate(async () => {
    try {
      await window.desk.activityStateGet({id: 'act-x', version: 1, hash: 'sha256:x', scopeRef: 'scope-ref-errado'});
      return false;
    } catch { return true; }
  });
  check('host recusa scopeRef de outra conversa', rejectedScope);

  /* 1a. Hash da revisão e teto em BYTES UTF-8: mensagem forjada/grande não
     toca no estado; payload multibyte dentro do teto é aceito. */
  await mruvFrame.evaluate(() => { const m = window.__MESA_ACTIVITY__; parent.postMessage({v: 1, type: 'state', id: m.id, version: m.version, hash: 'sha256:forjado', payload: {a: 99}}, '*'); });
  await mruvFrame.evaluate(() => window.mesa.state({big: '你'.repeat(6000)}));
  await sleep(500); // espera fixa: "nada acontece em 0,5 s" — hash forjado e excesso UTF-8 não alteram o estado
  const itemState = (await app.evaluate(() => global.__ui.list())).find((entry) => entry.toolCallId === 'call-live-1');
  const stateAfterBounds = await app.evaluate((_electron, payload) => global.__ui.stateOf(payload.id, payload.version, payload.hash), itemState);
  check('hash forjado e excesso UTF-8 não alteram o estado', stateAfterBounds?.state?.values?.a !== 99 && stateAfterBounds?.state?.values?.big === undefined, JSON.stringify(stateAfterBounds?.state));
  await mruvFrame.evaluate(() => window.mesa.state({safe: '你'.repeat(500)}));
  const stateUnicode = await waitFor(async () => {
    const current = await app.evaluate((_electron, payload) => global.__ui.stateOf(payload.id, payload.version, payload.hash), itemState);
    return current?.state?.values?.safe?.length === 500 ? current : null;
  }, 6000);
  check('payload multibyte dentro do teto é aceito', !!stateUnicode);

  /* 1b. Falha de persistência não é escondida: erro visível e retry salva. */
  await app.evaluate(() => global.__ui.failNextSave(1));
  await mruvFrame.evaluate(() => { const a = document.getElementById('a'); a.value = '3'; a.dispatchEvent(new Event('input', {bubbles: true})); });
  const errorShown = await waitFor(async () => page.evaluate(() => {
    const el = document.querySelector('.activity-slot[data-activity-call="call-live-1"] .activity-error');
    return el && !el.hidden ? el.textContent : '';
  }), 5000);
  check('falha de save mostra erro no card', !!errorShown && /salvar/i.test(errorShown), errorShown || '');
  const recovered = await waitFor(async () => {
    const item = (await app.evaluate(() => global.__ui.list())).find((entry) => entry.toolCallId === 'call-live-1');
    if (!item) return false;
    const state = await app.evaluate((_electron, payload) => global.__ui.stateOf(payload.id, payload.version, payload.hash), item);
    return state?.state?.values?.a === 3;
  }, 10000);
  check('retry controlado salva o estado (a=3)', !!recovered);
  const errorCleared = await waitFor(async () => page.evaluate(() => {
    const el = document.querySelector('.activity-slot[data-activity-call="call-live-1"] .activity-error');
    return !el || el.hidden;
  }), 5000);
  check('erro de save some após retry bem-sucedido', !!errorCleared);

  /* 2. Levar ao tutor anexa sem apagar o rascunho e sem disparar prompt. */
  const beforeDraft = await page.locator('#prompt').inputValue();
  await page.locator('.activity-slot[data-activity-call="call-live-1"] [data-act="draft"]').click();
  const afterDraft = await page.locator('#prompt').inputValue();
  check('rascunho preserva o texto anterior', afterDraft.startsWith(beforeDraft) && afterDraft.length > beforeDraft.length, afterDraft);
  check('rascunho identifica a atividade', afterDraft.includes('[Atividade: MRUV'), afterDraft.slice(-160));

  /* 3. Tela cheia (#42; antes "Ampliar") mantém o MESMO contexto (sem reparenting/recarga). */
  await mruvFrame.evaluate(() => { window.__token = (window.__token || 0) + 1; });
  const tokenBefore = await mruvFrame.evaluate(() => window.__token);
  await page.locator('.activity-slot[data-activity-call="call-live-1"] [data-act="expand"]').click();
  await page.waitForSelector('.activity-slot[data-activity-call="call-live-1"] .activity-card.activity-fullscreen');
  const tokenExpanded = await mruvFrame.evaluate(() => window.__token);
  check('ampliar não recarrega o artefato', tokenBefore === tokenExpanded, `${tokenBefore}/${tokenExpanded}`);
  await page.locator('.activity-slot[data-activity-call="call-live-1"] [data-act="expand"]').click();

  /* 4. Reiniciar cria contexto novo. */
  await page.locator('.activity-slot[data-activity-call="call-live-1"] [data-act="restart"]').click();
  const restartedFrame = await waitFor(async () => {
    const frame = page.frames().find((candidate) => candidate.url().startsWith('mesa-activity://'));
    return frame && frame !== mruvFrame && !frame.isDetached() ? frame : null;
  }, 10000);
  await restartedFrame.waitForSelector('#s-out', {timeout: 10000});
  const tokenRestarted = await restartedFrame.evaluate(() => window.__token || 0);
  check('reiniciar usa montagem nova', tokenRestarted !== tokenExpanded, `${tokenExpanded}/${tokenRestarted}`);

  /* 5. Parar remove o iframe sem tocar no chat. */
  await page.locator('.activity-slot[data-activity-call="call-live-1"] [data-act="stop"]').click();
  const stopped = await waitFor(async () => !(await page.locator('.activity-slot[data-activity-call="call-live-1"] .activity-iframe').count()));
  check('parar remove o iframe', !!stopped);
  const cardStopped = await page.evaluate(() => window.__cardInfo('call-live-1'));
  check('card fica no estado parado', cardStopped.state === 'stopped', JSON.stringify(cardStopped));

  /* 6. Histórico é preguiçoso: sem evento ao vivo, só pôster até pedir. */
  await app.evaluate(() => global.__ui.publishSilently('CALC_SPEC', {toolCallId: 'call-silent-1'}));
  await page.evaluate(() => window.__addSlot('call-silent-1', 'done'));
  await page.waitForSelector('.activity-slot[data-activity-call="call-silent-1"] .activity-card', {timeout: 8000});
  await page.waitForTimeout(300); // espera fixa: "nada acontece em 0,3 s" — o histórico não monta o iframe sozinho
  const silentInfo = await page.evaluate(() => window.__cardInfo('call-silent-1'));
  check('histórico não monta iframe sozinho', silentInfo.iframe === false && silentInfo.posterVisible === true, JSON.stringify(silentInfo));
  await page.locator('.activity-slot[data-activity-call="call-silent-1"] [data-act="open"]').click();
  await page.waitForSelector('.activity-slot[data-activity-call="call-silent-1"] .activity-iframe', {timeout: 10000});
  check('abrir monta o artefato do histórico', true);

  /* 7. Laço é contido: chat segue respondendo e parar o frame funciona. */
  await page.evaluate(() => window.__addSlot('call-loop-1', 'done'));
  await app.evaluate(() => global.__ui.publishThroughBridge('LOOP_SPEC', {toolCallId: 'call-loop-1'}));
  await page.waitForSelector('.activity-slot[data-activity-call="call-loop-1"] .activity-iframe', {timeout: 10000});
  await sleep(700); // espera fixa: janela de medição do batimento do host (o tempo é o que se mede)
  const beatA = await page.evaluate(() => window.__beat);
  await sleep(900); // espera fixa: janela de medição do batimento do host
  const beatB = await page.evaluate(() => window.__beat);
  check('host continua responsivo com laço no artefato', beatB > beatA, `${beatA}/${beatB}`);
  await page.locator('.activity-slot[data-activity-call="call-loop-1"] [data-act="stop"]').click();
  const loopStopped = await waitFor(async () => !(await page.locator('.activity-slot[data-activity-call="call-loop-1"] .activity-iframe').count()));
  check('laço pode ser encerrado sem perder o chat', !!loopStopped);
  /* O kill do processo travado pode levar alguns segundos (o frame some da
     árvore depois); a prova fica na checagem final. */

  /* 7b. Flood DIRETO (parent.postMessage fora do wrapper): host limita taxa e
     segue responsivo; parar encerra o frame. */
  await page.evaluate(() => window.__addSlot('call-flood-1', 'done'));
  await app.evaluate(() => global.__ui.publishThroughBridge('FLOOD_SPEC', {toolCallId: 'call-flood-1'}));
  await page.waitForSelector('.activity-slot[data-activity-call="call-flood-1"] .activity-iframe', {timeout: 10000});
  const savesBefore = await app.evaluate(() => global.__ui.saveCount());
  await sleep(600); // espera fixa: janela de medição do batimento sob flood
  const floodBeatA = await page.evaluate(() => window.__beat);
  await sleep(1200); // espera fixa: janela de medição do batimento sob flood
  const floodBeatB = await page.evaluate(() => window.__beat);
  const savesAfter = await app.evaluate(() => global.__ui.saveCount());
  check('host continua responsivo com flood direto', floodBeatB > floodBeatA, `${floodBeatA}/${floodBeatB}`);
  check('flood direto não vira avalanche de saves', savesAfter - savesBefore < 20, `${savesBefore}/${savesAfter}`);
  await page.locator('.activity-slot[data-activity-call="call-flood-1"] [data-act="stop"]').click();
  const floodStopped = await waitFor(async () => !(await page.locator('.activity-slot[data-activity-call="call-flood-1"] .activity-iframe').count()));
  check('flood direto pode ser parado', !!floodStopped);
  /* A fila de mensagens já postadas drena antes do próximo cenário (o Parar
     remove o frame, mas os eventos enfileirados ainda chegam). */
  const drain = await waitFor(async () => {
    const first = await page.evaluate(() => window.__msgCount);
    await sleep(400); // espera fixa: intervalo entre as duas leituras do contador (fila quieta = sem mensagem nova em 0,4 s)
    const second = await page.evaluate(() => window.__msgCount);
    return second === first ? true : null;
  }, 12000, 250);
  check('fila de mensagens do flood drena após Parar', drain === true, String(drain));

  /* 7c. Quota de montagens: 4 publicações ao vivo mantêm no máximo 3 frames;
     reiniciar um card pausado também não estoura a quota. */
  for (const [name, call] of [['MRUV_SPEC', 'call-budget-1'], ['CALC_SPEC', 'call-budget-2'], ['FREE_SPEC', 'call-budget-3'], ['MRUV_SPEC', 'call-budget-4']]) {
    await page.evaluate((toolCallId) => window.__addSlot(toolCallId, 'done'), call);
    await app.evaluate((_electron, payload) => global.__ui.publishThroughBridge(payload.name, {toolCallId: payload.call}), {name, call});
  }
  await waitFor(async () => (await page.evaluate(() => document.querySelectorAll('.activity-iframe').length)) >= 3, 8000);
  await page.waitForTimeout(400); // espera fixa: "nada acontece em 0,4 s" — o 4º card não pode montar acima da quota
  const framesWithBudget = await page.evaluate(() => document.querySelectorAll('.activity-iframe').length);
  check('quota de montagens limitada a 3 frames', framesWithBudget <= 3, String(framesWithBudget));
  const pausedSlot = await page.evaluate(() => {
    const slot = document.querySelector('.activity-slot[data-activity-call="call-budget-1"]');
    return slot ? !!slot.querySelector('.activity-poster:not([hidden])') : false;
  });
  if (pausedSlot) {
    await page.locator('.activity-slot[data-activity-call="call-budget-1"] [data-act="restart"]').click();
    await page.waitForTimeout(500); // espera fixa: "nada acontece em 0,5 s" — reiniciar um card pausado não estoura a quota
    const framesAfterRestart = await page.evaluate(() => document.querySelectorAll('.activity-iframe').length);
    check('reiniciar card pausado respeita a quota', framesAfterRestart <= 3, String(framesAfterRestart));
  } else {
    check('reiniciar card pausado respeita a quota', true, 'sem card pausado, nada a medir');
  }
  /* Limpa os cards de estresse (Parar) para não deixar observador remontando
     fora da tela durante o próximo cenário. */
  for (const call of ['call-budget-1', 'call-budget-2', 'call-budget-3', 'call-budget-4']) {
    const info = await page.evaluate((toolCallId) => window.__cardInfo(toolCallId), call);
    if (info.iframe) {
      await page.locator(`.activity-slot[data-activity-call="${call}"] [data-act="stop"]`).click();
    }
  }
  await waitFor(async () => (await page.evaluate(() => document.querySelectorAll('.activity-iframe').length)) === 0, 8000);

  /* 7d. Estado 13 KiB + tentativa 3,5 KiB: envelope de 21 KiB persiste os
     dois campos sem erro (achado P2 — antes sumia em silêncio). */
  await page.evaluate(() => window.__addSlot('call-big-state', 'done'));
  await app.evaluate(() => global.__ui.publishThroughBridge('BIG_STATE_SPEC', {toolCallId: 'call-big-state'}));
  await page.waitForSelector('.activity-slot[data-activity-call="call-big-state"] .activity-iframe', {timeout: 10000});
  const bigSaved = await waitFor(async () => {
    const item = (await app.evaluate(() => global.__ui.list())).find((entry) => entry.toolCallId === 'call-big-state');
    if (!item) return null;
    const state = await app.evaluate((_electron, payload) => global.__ui.stateOf(payload.id, payload.version, payload.hash), item);
    return state?.state?.values?.blob?.length === 13000 && state?.state?.attempt?.blob?.length === 3500 ? state : null;
  }, 10000);
  check('estado 13K + tentativa 3,5K persiste os dois campos', !!bigSaved, JSON.stringify(bigSaved?.state && {values: bigSaved.state.values?.blob?.length, attempt: bigSaved.state.attempt?.blob?.length}));
  const bigError = await page.evaluate(() => {
    const el = document.querySelector('.activity-slot[data-activity-call="call-big-state"] .activity-error');
    return el && !el.hidden ? el.textContent : '';
  });
  check('card não mostra erro de limite para o envelope válido', bigError === '', bigError);
  await page.locator('.activity-slot[data-activity-call="call-big-state"] [data-act="stop"]').click();

  /* 7e. Quota cheia + reiniciar um card MONTADO: os outros dois iframes
     precisam sobreviver (antes o mount despejava um card alheio). */
  for (const [name, call] of [['MRUV_SPEC', 'call-quota-1'], ['CALC_SPEC', 'call-quota-2'], ['FREE_SPEC', 'call-quota-3']]) {
    await page.evaluate((id) => window.__addSlot(id, 'done'), call);
    await app.evaluate((_electron, payload) => global.__ui.publishThroughBridge(payload.name, {toolCallId: payload.call}), {name, call});
  }
  for (const call of ['call-quota-1', 'call-quota-2', 'call-quota-3']) {
    await page.locator(`.activity-slot[data-activity-call="${call}"] .activity-card`).scrollIntoViewIfNeeded();
  }
  await page.waitForSelector('.activity-slot[data-activity-call="call-quota-3"] .activity-iframe', {timeout: 10000});
  await page.evaluate(() => { document.querySelectorAll('.activity-iframe').forEach((frame, index) => { frame.dataset.probe = String(index); }); });
  await page.locator('.activity-slot[data-activity-call="call-quota-2"] [data-act="restart"]').click();
  await waitFor(async () => page.evaluate(() => {
    const slots = [...document.querySelectorAll('.activity-slot[data-activity-call^="call-quota-"]')];
    const second = document.querySelector('.activity-slot[data-activity-call="call-quota-2"] .activity-iframe');
    return slots.filter((slot) => slot.querySelector('.activity-iframe')).length === 3 && !!second && second.dataset.probe === undefined;
  }), 8000);
  const quotaInfo = await page.evaluate(() => [...document.querySelectorAll('.activity-slot[data-activity-call^="call-quota-"]')].map((slot) => {
    const frame = slot.querySelector('.activity-iframe');
    return {call: slot.dataset.activityCall, iframe: !!frame, probe: frame ? frame.dataset.probe : null};
  }));
  const preserved = quotaInfo.filter((info) => info.call !== 'call-quota-2' && info.iframe && info.probe !== null && info.probe !== undefined);
  check('reiniciar card montado preserva os outros dois iframes', quotaInfo.filter((info) => info.iframe).length === 3 && preserved.length === 2, JSON.stringify(quotaInfo));
  check('quota continua ≤3 após reiniciar montado', quotaInfo.filter((info) => info.iframe).length <= 3, JSON.stringify(quotaInfo));
  for (const call of ['call-quota-1', 'call-quota-2', 'call-quota-3']) {
    await page.locator(`.activity-slot[data-activity-call="${call}"] .activity-card`).scrollIntoViewIfNeeded();
    await page.locator(`.activity-slot[data-activity-call="${call}"] [data-act="stop"]`).click();
  }
  await waitFor(async () => (await page.evaluate(() => document.querySelectorAll('.activity-iframe').length)) === 0, 8000);

  /* 8. Caminho Claude: registry + callRef injetado publica com toolCallId. */
  const claude = await app.evaluate(() => global.__ui.publishThroughTool('FREE_SPEC', {toolCallId: 'toolu-ui-1'}));
  check('caminho Claude publica com o toolCallId do registry', claude.toolCallId === 'toolu-ui-1', JSON.stringify(claude));
  await page.evaluate(() => window.__addSlot('toolu-ui-1', 'done'));
  await page.waitForSelector('.activity-slot[data-activity-call="toolu-ui-1"] .activity-card', {timeout: 8000});
  await page.locator('.activity-slot[data-activity-call="toolu-ui-1"] .activity-card').scrollIntoViewIfNeeded();
  const tooluAuto = await waitFor(async () => (await page.locator('.activity-slot[data-activity-call="toolu-ui-1"] .activity-iframe').count()) > 0, 8000);
  check('publicação pendente monta sozinha quando o slot aparece', !!tooluAuto);
  const claudeItem = (await app.evaluate(() => global.__ui.list())).find((entry) => entry.toolCallId === 'toolu-ui-1');
  const stateHistory = [];
  const freeFrame = await waitFor(async () => {
    stateHistory.push((await page.evaluate(() => window.__cardInfo('toolu-ui-1'))).state);
    return page.frames().find((frame) => frame.url().includes(claudeItem.id)) || null;
  }, 10000);
  const tooluInfo = await page.evaluate(() => window.__cardInfo('toolu-ui-1'));
  const navLog = await app.evaluate(() => global.__ui.navLog());
  check('simulação livre (fora de catálogo) abre', !!freeFrame, `${JSON.stringify(tooluInfo)} | hist=${stateHistory.join(',')} | ${navLog.filter((n) => n.url.includes(claudeItem.id)).map((n) => `${n.url.split('/')[2]} prevented=${n.prevented} current=${n.current} at=${n.at}`).join(' ; ')}`);

  /* 9. Re-render de histórico troca o conteúdo sem vazar estado. */
  await page.evaluate(() => window.__historyRendered());
  await waitFor(async () => (await page.evaluate(() => window.__cardInfo('call-live-1'))).found === true, 5000);
  await page.waitForTimeout(300); // espera fixa: "nada acontece em 0,3 s" — o card refeito não monta o frame sozinho
  const afterHistory = await page.evaluate(() => window.__cardInfo('call-live-1'));
  check('histórico refeito recria o card sem frame automático', afterHistory.found === true && afterHistory.iframe === false, JSON.stringify(afterHistory));

  /* 10. Reabrir restaura o último estado salvo: init.state = values, sem
     reinit duplicado regredindo o que o artefato já mudou. */
  const historyItem = (await app.evaluate(() => global.__ui.list())).find((entry) => entry.toolCallId === 'call-live-1');
  await page.locator('.activity-slot[data-activity-call="call-live-1"] .activity-card').scrollIntoViewIfNeeded();
  await page.locator('.activity-slot[data-activity-call="call-live-1"] [data-act="open"]').click();
  await page.waitForSelector('.activity-slot[data-activity-call="call-live-1"] .activity-card[data-state="ready"]', {timeout: 10000});
  const firstOpen = await waitFor(async () => page.frames().find((frame) => frame.url().includes(historyItem.id)) || null, 10000);
  await firstOpen.waitForSelector('#a');
  await firstOpen.evaluate(() => { const a = document.getElementById('a'); a.value = '3.5'; a.dispatchEvent(new Event('input', {bubbles: true})); });
  const savedAgain = await waitFor(async () => {
    const state = await app.evaluate((_electron, payload) => global.__ui.stateOf(payload.id, payload.version, payload.hash), historyItem);
    return state?.state?.values?.a === 3.5;
  }, 8000);
  check('estado novo é salvo antes de reabrir', !!savedAgain);
  await page.evaluate(() => window.__historyRendered());
  await waitFor(async () => (await page.evaluate(() => window.__cardInfo('call-live-1'))).found === true, 5000);
  await page.locator('.activity-slot[data-activity-call="call-live-1"] .activity-card').scrollIntoViewIfNeeded();
  await page.locator('.activity-slot[data-activity-call="call-live-1"] [data-act="open"]').click();
  await page.waitForSelector('.activity-slot[data-activity-call="call-live-1"] .activity-card[data-state="ready"]', {timeout: 10000});
  const restoredFrame = await waitFor(async () => page.frames().find((frame) => frame.url().includes(historyItem.id)) || null, 10000);
  const restoredValue = await waitFor(async () => {
    if (!restoredFrame) return null;
    const value = await restoredFrame.evaluate(() => document.getElementById('a').value);
    return value === '3.5' ? value : null;
  }, 6000);
  check('reabrir restaura o último estado (values)', restoredValue === '3.5', String(restoredValue));

  /* 10b. Parar e reabrir o MESMO card usa o estado mais recente (não o
     snapshot inicial): o remount precisa reinicializar com lastState. */
  await restoredFrame.evaluate(() => { const a = document.getElementById('a'); a.value = '2.5'; a.dispatchEvent(new Event('input', {bubbles: true})); });
  const latestSaved = await waitFor(async () => {
    const state = await app.evaluate((_electron, payload) => global.__ui.stateOf(payload.id, payload.version, payload.hash), historyItem);
    return state?.state?.values?.a === 2.5;
  }, 8000);
  check('novo valor salvo antes de parar', !!latestSaved);
  await page.locator('.activity-slot[data-activity-call="call-live-1"] [data-act="stop"]').click();
  await waitFor(async () => (await page.locator('.activity-slot[data-activity-call="call-live-1"] .activity-iframe').count()) === 0);
  await page.locator('.activity-slot[data-activity-call="call-live-1"] .activity-card').scrollIntoViewIfNeeded();
  await page.locator('.activity-slot[data-activity-call="call-live-1"] [data-act="open"]').click();
  await page.waitForSelector('.activity-slot[data-activity-call="call-live-1"] .activity-card[data-state="ready"]', {timeout: 10000});
  const reopenedAgain = await waitFor(async () => page.frames().find((frame) => frame.url().includes(historyItem.id)) || null, 10000);
  const valueAgain = await waitFor(async () => {
    if (!reopenedAgain) return null;
    const value = await reopenedAgain.evaluate(() => document.getElementById('a').value);
    return value === '2.5' ? value : null;
  }, 6000);
  check('parar/reabrir mantém o estado mais recente', valueAgain === '2.5', String(valueAgain));

  /* 10c. Tema dark/light/system no MESMO iframe, com color-scheme coerente.
     #42: o fundo é o da coluna do tutor, no html (o body fica transparente), e
     "system" chega já resolvido pelo host (claro ou escuro, com os tokens). */
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  await reopenedAgain.waitForFunction(() => document.documentElement.dataset.theme === 'dark', undefined, {timeout: 5000}).catch(() => {});
  const darkInfo = await reopenedAgain.evaluate(() => ({theme: document.documentElement.dataset.theme, scheme: getComputedStyle(document.documentElement).colorScheme, bg: getComputedStyle(document.documentElement).backgroundColor}));
  check('tema dark chega ao artefato', darkInfo.theme === 'dark' && darkInfo.scheme === 'dark' && darkInfo.bg === 'rgb(36, 36, 36)', JSON.stringify(darkInfo));
  await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
  await reopenedAgain.waitForFunction(() => document.documentElement.dataset.theme === 'light', undefined, {timeout: 5000}).catch(() => {});
  const lightInfo = await reopenedAgain.evaluate(() => ({theme: document.documentElement.dataset.theme, scheme: getComputedStyle(document.documentElement).colorScheme, bg: getComputedStyle(document.documentElement).backgroundColor}));
  check('tema light chega ao artefato', lightInfo.theme === 'light' && lightInfo.scheme === 'light' && lightInfo.bg === 'rgb(244, 244, 244)', JSON.stringify(lightInfo));
  await page.evaluate(() => { document.documentElement.removeAttribute('data-theme'); });
  await reopenedAgain.waitForFunction(() => document.documentElement.dataset.theme !== 'light', undefined, {timeout: 5000}).catch(() => {});
  const autoInfo = await reopenedAgain.evaluate(() => ({theme: document.documentElement.dataset.theme, scheme: getComputedStyle(document.documentElement).colorScheme, bg: getComputedStyle(document.documentElement).backgroundColor}));
  const systemDark = await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches);
  const resolved = systemDark ? 'dark' : 'light';
  check('tema system chega ao artefato (resolvido pelo host)', autoInfo.theme === resolved && autoInfo.scheme === resolved && autoInfo.bg === (systemDark ? 'rgb(36, 36, 36)' : 'rgb(244, 244, 244)'), JSON.stringify(autoInfo));

  /* 10. Evento atrasado de outra conversa é ignorado pelo renderer. */
  await page.evaluate(() => window.__addSlot('call-stale-1', 'done'));
  await app.evaluate(() => global.__ui.sendEvent({
    status: 'published',
    activity: {
      id: 'act-antiga1', version: 1, hash: 'sha256:antiga', toolCallId: 'call-stale-1', title: 'Conversa antiga',
      objective: 'Não pode aparecer', conversationId: 'conversa-antiga', generation: 0,
    },
    scope: {conversationId: 'conversa-antiga', generation: 0, courseId: null},
  }));
  await page.waitForTimeout(600); // espera fixa: "nada acontece em 0,6 s" — evento de outra conversa não hidrata
  const staleInfo = await page.evaluate(() => window.__cardInfo('call-stale-1'));
  check('evento de outra conversa não hidrata atividade', staleInfo.found === false && staleInfo.iframe === false, JSON.stringify(staleInfo));

  /* 10b. Mesma conversa, geração antiga: o renderer usa a geração confiável de
     activityScope (não só conversa/matéria) e descarta o evento. */
  await page.evaluate(() => window.__addSlot('call-stale-gen', 'done'));
  const scopeNow = await app.evaluate(() => global.__ui.scope);
  await app.evaluate((_electron, payload) => global.__ui.sendEvent({
    status: 'published',
    activity: {
      id: 'act-geracao1', version: 1, hash: 'sha256:geracao', toolCallId: 'call-stale-gen', title: 'Geração antiga',
      objective: 'Não pode aparecer', conversationId: payload.scope.conversationId, generation: payload.scope.generation + 1,
    },
    scope: {...payload.scope, generation: payload.scope.generation + 1},
  }), {scope: scopeNow});
  await page.waitForTimeout(600); // espera fixa: "nada acontece em 0,6 s" — geração antiga não hidrata
  const staleGen = await page.evaluate(() => window.__cardInfo('call-stale-gen'));
  check('evento da mesma conversa com geração antiga não hidrata', staleGen.found === false && staleGen.iframe === false, JSON.stringify(staleGen));

  /* 11. Evento live atrasado depois de Parar não pode automontar o artefato. */
  await app.evaluate(() => global.__ui.publishSilently('CALC_SPEC', {toolCallId: 'call-late-1'}));
  await page.evaluate(() => window.__addSlot('call-late-1', 'stopped'));
  await waitFor(async () => (await page.evaluate(() => window.__cardInfo('call-late-1'))).found === true, 5000);
  await app.evaluate(() => {
    const item = global.__ui.list().find((entry) => entry.toolCallId === 'call-late-1');
    global.__ui.sendEvent({status: 'published', scope: {...global.__ui.scope}, activity: item});
  });
  await page.waitForTimeout(900); // espera fixa: "nada acontece em 0,9 s" — evento live atrasado não automonta depois de Parar
  const lateInfo = await page.evaluate(() => window.__cardInfo('call-late-1'));
  check('evento live atrasado após Parar não automonta', lateInfo.found === true && lateInfo.iframe === false && lateInfo.state === 'idle', JSON.stringify(lateInfo));
  await page.locator('.activity-slot[data-activity-call="call-late-1"] .activity-card').scrollIntoViewIfNeeded();
  await page.locator('.activity-slot[data-activity-call="call-late-1"] [data-act="open"]').click();
  await page.waitForSelector('.activity-slot[data-activity-call="call-late-1"] .activity-iframe', {timeout: 10000});
  check('abrir explicitamente depois do Parar ainda monta', true);

  const watchdogKills = await app.evaluate(() => global.__ui.watchdogLog().filter((entry) => entry.type === 'kill'));
  check('watchdog mata o processo travado do laço', watchdogKills.length > 0 && watchdogKills[0].pid > 0, JSON.stringify(watchdogKills));
  const failuresNow = pageErrors.filter((text) => !/DevTools|Autofill/.test(text));
  check('sem erros de página no host', failuresNow.length === 0, failuresNow.join(' | '));
} finally {
  await app.close().catch(() => {});
  fs.rmSync(runtime, {recursive: true, force: true});
}
console.log(failures === 0 ? 'HUNT ACTIVITY UI: PASSOU' : `HUNT ACTIVITY UI: ${failures} FALHA(S)`);
if (failures > 0) process.exitCode = 1;
