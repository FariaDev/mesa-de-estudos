import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

/* Limites de texto grande da Mesa (issue bendlang/bend#798, acumulador do
   aron-intframe): o preview (marcadores da Mesa, `/conferir`, colapso e corte
   de 48) e o rótulo (nota em 40) aguentam 100k; se o núcleo falhar por algo
   inesperado, o host degrada em vez de engolir para vazio. */

const require = createRequire(import.meta.url);
const core = require('../src/generated/sessions.core.js').default;
const {sessionPreviewFromJsonl, formatSessionLabel} = require('../lib.cjs');

const jsonl = (text, role = 'user') =>
  JSON.stringify({type: 'message', message: {role, content: text}}) + '\n';
const x = (n) => 'x'.repeat(n);
const pad2 = (n) => String(n).padStart(2, '0');

test('preview do JSONL da Mesa aguenta 5k/8k/20k/100k', () => {
  for (const n of [5000, 8000, 20000, 100000]) {
    assert.equal(sessionPreviewFromJsonl(jsonl(x(n))), x(48), `n=${n}`);
  }
});

test('preview corta os marcadores da Mesa em qualquer tamanho', () => {
  const markers = ['[Contexto da sessão na Mesa:', '[Referências abertas', '[Conferência visual'];
  for (const n of [5000, 20000, 100000]) {
    for (const marker of markers) {
      assert.equal(sessionPreviewFromJsonl(jsonl('ok\n\n' + marker + ' ' + x(n))), 'ok', `${marker} n=${n}`);
    }
  }
});

test('preview limpa multilinha antes de cortar em 48', () => {
  for (const n of [5000, 20000, 100000]) {
    const text = '  linha um\nlinha dois   ' + x(n) + '  ';
    const flat = text.replace(/\s+/g, ' ').trim();
    assert.equal(sessionPreviewFromJsonl(jsonl(text)), flat.slice(0, 48), `n=${n}`);
  }
});

test('/conferir vira o rótulo mesmo com texto grande', () => {
  assert.equal(sessionPreviewFromJsonl(jsonl('/conferir ' + x(100000))), 'Conferir Xournal++');
});

test('formatSessionLabel com preview de 100k mantém a nota em 40', () => {
  assert.equal(formatSessionLabel({preview: x(100000)}), 'Conversa · ' + x(40));
  const started = 1700000000000;
  const d = new Date(started);
  const when = `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  assert.equal(formatSessionLabel({started, preview: x(100000)}), `${when} · ${x(40)}`);
});

test('preview e rótulo degradam quando o núcleo falha', () => {
  const realPreview = core.sessionPreview;
  const realLabel = core.formatSessionLabel;
  core.sessionPreview = () => {
    throw new RangeError('pilha (sintético)');
  };
  core.formatSessionLabel = () => {
    throw new RangeError('pilha (sintético)');
  };
  try {
    const text = '  alfa   beta\n\n[Contexto da sessão na Mesa: ' + x(20000);
    const raw = jsonl(text);
    assert.equal(sessionPreviewFromJsonl(raw), text.replace(/\s+/g, ' ').trim().slice(0, 48), 'preview local em vez de vazio');
    const started = 1700000000000;
    const d = new Date(started);
    const when = `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    assert.equal(formatSessionLabel({started, preview: 'nota da sessão'}), `${when} · nota da sessão`);
    assert.equal(formatSessionLabel({preview: ''}), 'Conversa');
  } finally {
    core.sessionPreview = realPreview;
    core.formatSessionLabel = realLabel;
  }
});
