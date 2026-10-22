// Gravador do desk.log (desk-log.cjs) e o formato da linha (src/log-entry.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {logEntryLine, parseLogLine, readableLog, readableLogLine, redactSecrets} from '../src/log-entry.mjs';

const require = createRequire(import.meta.url);
const {createDeskLog, processGoneEntry, writeReadableLog} = require('../desk-log.cjs');

const NOW = new Date('2026-10-19T14:03:22.120Z');
const tempRuntime = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-desk-log-'));
const entriesOf = (file) => fs.readFileSync(file, 'utf8').trim().split('\n').map((line) => JSON.parse(line));

/* Regressão (#43 fase 3): o main lia `details` do evento do Electron, não do
   argumento certo, e a linha saía vazia. Na mesma fase os detalhes viraram campos. */
test('processGoneEntry descreve o processo que caiu, com os detalhes em campos', () => {
  assert.deepEqual(processGoneEntry({type: 'GPU', reason: 'crashed', exitCode: 5}), {
    msg: 'processo GPU caiu',
    extra: {level: 'error', type: 'GPU', reason: 'crashed', exitCode: 5},
  });
  assert.deepEqual(processGoneEntry({reason: 'oom'}).extra, {level: 'error', type: '', reason: 'oom', exitCode: null});
});

test('logEntryLine: ts, level, area, msg e campos primitivos, uma linha JSON', () => {
  const line = logEntryLine({area: 'update', msg: 'concluído  \n', level: 'warn', fields: {version: '0.5.1', tries: 2, ok: false}, now: NOW});
  assert.ok(line.endsWith('\n') && !line.slice(0, -1).includes('\n'));
  assert.deepEqual(JSON.parse(line), {ts: '2026-10-19T14:03:22.120Z', level: 'warn', area: 'update', msg: 'concluído', version: '0.5.1', tries: 2, ok: false});
});

test('logEntryLine: nível desconhecido vira info, campo não primitivo ou reservado sai, texto vazio não grava', () => {
  const entry = JSON.parse(logEntryLine({area: 'x', msg: 'oi', level: 'fatal', fields: {msg: 'troca', ts: 'troca', nested: {a: 1}, list: [1], n: Infinity}, now: NOW}));
  assert.deepEqual(entry, {ts: '2026-10-19T14:03:22.120Z', level: 'info', area: 'x', msg: 'oi', n: 'Infinity'});
  assert.equal(logEntryLine({area: 'x', msg: '   '}), '');
});

test('nada que pareça segredo chega ao log, nem na frase nem nos campos', () => {
  assert.equal(redactSecrets('falhou com sk-ant-api03-abcdefghijklmnop'), 'falhou com [oculto]');
  assert.equal(redactSecrets('Authorization: Bearer abc.def.ghi123'), 'Authorization: [oculto]');
  assert.equal(redactSecrets('url?api_key=XYZ12345&x=1'), 'url?api_key=[oculto]&x=1');
  assert.equal(redactSecrets('"token": "abcd1234"'), '"token": "[oculto]"');
  assert.equal(redactSecrets('tokens usados: 1200'), 'tokens usados: 1200');
  const entry = JSON.parse(logEntryLine({area: 'claude', msg: 'chave sk-proj-0123456789abcdefXYZ recusada', fields: {header: 'Bearer abcdefghijk'}, now: NOW}));
  assert.equal(entry.msg, 'chave [oculto] recusada');
  assert.equal(entry.header, '[oculto]');
});

test('parseLogLine lê o formato novo, o antigo {t, src, line} e texto solto', () => {
  assert.deepEqual(parseLogLine('{"ts":"2026-10-19T14:03:22.120Z","level":"error","area":"pi","msg":"caiu","code":7}'),
    {ts: '2026-10-19T14:03:22.120Z', level: 'error', area: 'pi', msg: 'caiu', code: 7});
  assert.deepEqual(parseLogLine('{"t":"2026-01-01T00:00:00.000Z","src":"update","line":"ok"}'),
    {ts: '2026-01-01T00:00:00.000Z', level: 'info', area: 'update', msg: 'ok'});
  assert.deepEqual(parseLogLine('linha antiga sem JSON'), {ts: '', level: 'info', area: '-', msg: 'linha antiga sem JSON'});
  assert.equal(parseLogLine('   '), null);
});

test('readableLogLine e readableLog dão texto para gente ler', () => {
  assert.equal(readableLogLine({ts: '2026-10-19T14:03:22.120Z', level: 'error', area: 'renderer', msg: 'quebrou', code: 7, file: 'a.pdf'}),
    '2026-10-19 14:03:22Z ERROR [renderer] quebrou (code=7, file=a.pdf)');
  const text = readableLog(`${logEntryLine({area: 'desk', msg: 'um', now: NOW})}\nlinha solta\n`);
  assert.equal(text, '2026-10-19 14:03:22Z INFO [desk] um\n— INFO [-] linha solta\n');
  assert.equal(readableLog(''), '');
});

test('createDeskLog grava no formato novo, aceita nível e campos, e nunca lança', () => {
  const runtime = tempRuntime();
  try {
    const logFile = path.join(runtime, 'desk.log');
    const appendLog = createDeskLog({logFile, logText: (raw) => raw.replace('KEY', 'frase')});
    appendLog('update', 'KEY traduzida', {level: 'warn', version: '0.5.1'});
    appendLog('renderer', 'sem extra');
    appendLog('x', '');
    const [first, second] = entriesOf(logFile);
    assert.deepEqual({...first, ts: 'T'}, {ts: 'T', level: 'warn', area: 'update', msg: 'frase traduzida', version: '0.5.1'});
    assert.deepEqual({...second, ts: 'T'}, {ts: 'T', level: 'info', area: 'renderer', msg: 'sem extra'});
    assert.equal(entriesOf(logFile).length, 2, 'linha vazia não grava');
    const broken = createDeskLog({logFile: path.join(runtime, 'nao-existe', 'desk.log'), logText: () => { throw new Error('sem idioma'); }});
    assert.doesNotThrow(() => broken('x', 'y'));
  } finally {
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('writeReadableLog junta desk.log.1 e desk.log em texto num .log ao lado', () => {
  const runtime = tempRuntime();
  try {
    const logFile = path.join(runtime, 'desk.log');
    fs.writeFileSync(`${logFile}.1`, '{"t":"2026-10-18T10:00:00.000Z","src":"update","line":"antiga"}\n');
    fs.writeFileSync(logFile, logEntryLine({area: 'pi', msg: 'nova', level: 'error', now: NOW}));
    const readableFile = path.join(runtime, 'desk-legivel.log');
    assert.equal(writeReadableLog({logFile, readableFile}), readableFile);
    assert.equal(fs.readFileSync(readableFile, 'utf8'), '2026-10-18 10:00:00Z INFO [update] antiga\n2026-10-19 14:03:22Z ERROR [pi] nova\n');
    fs.rmSync(logFile); fs.rmSync(`${logFile}.1`);
    writeReadableLog({logFile, readableFile});
    assert.equal(fs.readFileSync(readableFile, 'utf8'), '(log vazio)\n');
  } finally {
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});
