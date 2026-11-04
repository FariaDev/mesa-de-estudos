// Envio ao tutor (`pi-prompt`; #43 fase 2: saiu do main.cjs), com o motor Pi.
import test from 'node:test';
import assert from 'node:assert/strict';
import {ptMatches} from './pt-text.mjs';
import {createRequire} from 'node:module';
import {fakeIpcMain} from './fake-electron-shell.mjs';
import {fakeTutorBridge} from './fake-tutor-bridge.mjs';

const require = createRequire(import.meta.url);
const {registerTutorPromptHost} = require('../tutor-prompt-host.cjs');

function tutorPromptHost({engine = 'pi', runtime = '/rt', session = '/s.jsonl', bridge = fakeTutorBridge({get_state: {isStreaming: true}}), authorizePdfs, warmPdf} = {}) {
  const ipcMain = fakeIpcMain();
  const accepted = [];
  const live = {config: {desk: {}}, state: {study: {title: 'Lista 2'}}, courseId: 'calc', courses: [{id: 'calc', name: 'Cálculo'}], session,
    bridge, lastContextKey: '', languageHost: {tutorLanguage: () => 'pt-BR', tutor: () => 'pt-BR', ui: () => 'pt-BR'},
    studyServices: {accepted: entry => accepted.push(entry.engine)}};
  registerTutorPromptHost({ipcMain, live, runtime, FREE_ID: '__free__', allowedXopp: new Set(), ggb: {newRequest() {}}, appendLog: () => {},
    engine: () => engine, connect: () => bridge, promptImages: () => [], validPdf: file => file, authorizePdfs, assertNoFreeMutation() {}, assertNoNav() {}, warmPdf});
  return {ipcMain, bridge, live, accepted};
}

test('pi-prompt manda texto com ref e contexto e marca o contexto no aceite', async () => {
  const {ipcMain, bridge, live, accepted} = tutorPromptHost();
  let sent = null;
  bridge.request = async (method, params) => { bridge.seen.push(method); if (method === 'prompt') sent = params; return method === 'get_state' ? {isStreaming: true} : {}; };
  const out = await ipcMain.invoke('pi-prompt', {text: 'me ajuda', refs: [{path: '/p/Limites.pdf', page: 3}]});
  assert.equal(out.streaming, true);
  assert.match(sent.message, /^me ajuda/);
  assert.match(sent.message, /\/p\/Limites\.pdf#page=3/);
  assert.match(sent.message, /Cálculo/);
  assert.notEqual(live.lastContextKey, '', 'o aceite grava a chave do contexto enviado');
  assert.deepEqual(accepted, ['pi']);
});

test('pi-prompt recusa texto que não é string', async () => {
  const {ipcMain} = tutorPromptHost();
  await assert.rejects(async () => ipcMain.invoke('pi-prompt', {text: 42}), ptMatches(/pi-prompt: text recebeu 42; esperado string\(0\.\./));
});

test('ref sem caminho devolve o aviso traduzido, não um TypeError (regressão da #43 fase 2)', async () => {
  /* `let message=payload.text` sombreava a função `message` do i18n: a ref
     inválida virava "message is not a function". */
  const {ipcMain} = tutorPromptHost();
  const {message} = require('../src/i18n.mjs');
  await assert.rejects(async () => ipcMain.invoke('pi-prompt', {text: 'oi', refs: [{page: 1}]}), error => {
    assert.equal(error.message, message('err.ref.reselect'));
    return true;
  });
});

/* #70: o `read` do OpenCode não tem página e procurava `….pdf#page=53`; a
   referência vai com o caminho limpo e a página à parte. */
test('pi-prompt no OpenCode manda a referência com o caminho limpo', async () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const conversations = require('../src/agents/conversations.cjs');
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-prompt-oc-'));
  try {
    const session = conversations.createClaudeConversation({runtime, courseId: 'calc', engine: 'opencode'});
    const sent = [];
    const bridge = {uncertain: false, adapter: {snapshot: () => ({busy: true})},
      request: async (method, params) => { sent.push(params); return {}; }};
    const {ipcMain} = tutorPromptHost({engine: 'opencode', runtime, session, bridge});
    const out = await ipcMain.invoke('pi-prompt', {text: 'confere', refs: [{path: '/p/Apostila de M03.pdf', page: 53}]});
    assert.equal(out.streaming, true);
    assert.match(sent[0].message, /\/p\/Apostila de M03\.pdf \(p\. 53\)/);
    assert.doesNotMatch(sent[0].message, /#page=/);
  } finally {
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

const attachedPdf = {name: 'Aula.pdf', path: '/tmp/fora/Aula.pdf', pages: 12};

test('pi-prompt manda o PDF anexado como referência e nomeia mesa_ler_pdf', async () => {
  const {ipcMain, bridge} = tutorPromptHost({authorizePdfs(raw) {
    assert.deepEqual(raw, [attachedPdf]);
    return [attachedPdf];
  }});
  let sent = null;
  bridge.request = async (method, params) => { if (method === 'prompt') sent = params; return method === 'get_state' ? {isStreaming: false} : {}; };
  await ipcMain.invoke('pi-prompt', {text: 'explica', pdfs: [attachedPdf]});
  assert.match(sent.message, /^explica/);
  assert.match(sent.message, /\[PDFs anexados a esta mensagem\]\n  · Aula\.pdf \(12 páginas\) — \/tmp\/fora\/Aula\.pdf\n/);
  assert.match(sent.message, /mesa_ler_pdf/);
  assert.doesNotMatch(sent.message, /%PDF/);
  assert.doesNotMatch(sent.message, /mcp__mesa__ler_pdf/);
});

test('claude e opencode recebem a referência do PDF; o read nativo não ganha esse caminho', async () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const conversations = require('../src/agents/conversations.cjs');
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-prompt-pdf-'));
  try {
    for (const engine of ['claude', 'opencode']) {
      const session = conversations.createClaudeConversation({runtime, courseId: 'calc', engine});
      const sent = [];
      const bridge = {uncertain: false, adapter: {snapshot: () => ({busy: false})},
        request: async (_method, params) => { sent.push(params); return {}; }};
      const {ipcMain} = tutorPromptHost({engine, runtime, session, bridge, authorizePdfs: () => [attachedPdf]});
      await ipcMain.invoke('pi-prompt', {text: 'lê', refs: [{path: '/lib/Livro.pdf', page: 2}], pdfs: [attachedPdf]});
      assert.match(sent.at(-1).message, /\/tmp\/fora\/Aula\.pdf/);
      assert.doesNotMatch(sent.at(-1).message, /%PDF/);
      if (engine === 'claude') {
        assert.match(sent.at(-1).message, /mcp__mesa__ler_pdf/);
      } else {
        assert.match(sent.at(-1).message, /mesa_ler_pdf/);
        assert.match(sent.at(-1).message, /\/lib\/Livro\.pdf \(p\. 2\)/);
      }
    }
  } finally {
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('OpenCode aquece o PDF citado sem colocar o texto na mensagem', async () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const conversations = require('../src/agents/conversations.cjs');
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-prompt-warm-'));
  const warmed = [];
  try {
    const session = conversations.createClaudeConversation({runtime, courseId: 'calc', engine: 'opencode'});
    const sent = [];
    const bridge = {uncertain: false, adapter: {snapshot: () => ({busy: false})},
      request: async (_method, params) => { sent.push(params); return {}; }};
    const {ipcMain} = tutorPromptHost({engine: 'opencode', runtime, session, bridge, warmPdf: (request) => warmed.push(request)});
    const out = await ipcMain.invoke('pi-prompt', {text: 'confere', refs: [{path: '/p/Apostila de M03.pdf', page: 53}]});
    assert.equal(out.streaming, false);
    assert.match(sent[0].message, /\/p\/Apostila de M03\.pdf \(p\. 53\)/);
    assert.doesNotMatch(sent[0].message, /Limites fundamentais/);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(warmed, [{file: '/p/Apostila de M03.pdf', first: 53}]);
    warmed.length = 0;
    assert.deepEqual(await ipcMain.invoke('tutor-warm', [{path: '/p/Outro.pdf', page: 2}]), {warmed: true});
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(warmed, [{file: '/p/Outro.pdf', first: 2}]);
  } finally {
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});
