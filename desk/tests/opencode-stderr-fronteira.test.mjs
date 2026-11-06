/* Prova da revisão de segurança: mecanismos de mascaramento do stderr na
   fronteira do teto de 64 KiB, na ordem da descarga (exit/close) e no stdout.
   Se algum destes testes ficar VERMELHO, há vazamento confirmado: o flush do
   `exit` descarregava o rabo pendente (que pode ser o começo de um segredo) e
   os dados entregues depois do `exit` completavam a chave em claro no log. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';

const require = createRequire(import.meta.url);
const {startOpenCodeServer, createStderrLogger, STDERR_LINE_LIMIT} = require('../src/agents/opencode-process.cjs');

function createFakeSpawn() {
  const calls = [];
  const spawnProcess = (binary, args, options) => {
    const child = Object.assign(new EventEmitter(), {pid: 4242, exitCode: null, signalCode: null, stdout: new PassThrough(), stderr: new PassThrough(), kills: [],
      kill: (signal) => { child.kills.push(signal); return true; }});
    calls.push({binary, args, options, child});
    return child;
  };
  return {calls, spawnProcess};
}

test('segredo cortado EXATAMENTE na fronteira do teto não vaza (rabo = L-1)', () => {
  const secret = 'SECRETLONG';
  const lines = [];
  const logger = createStderrLogger({log: (area, line) => lines.push(line), secrets: [secret], maxLineLength: 20});
  /* O segredo começa no último caractere antes do corte e termina no pedaço seguinte. */
  logger.push(`${'y'.repeat(19)}SECRE`);
  logger.push('TLONG fim\n');
  logger.flush(true);
  const out = lines.join('\n');
  assert.equal(out.includes('SECRE'), false, 'o pedaço antes do corte não vaza');
  assert.equal(out.includes('TLONG'), false, 'o pedaço depois do corte não vaza');
  assert.match(out, /\*\*\*/);
});

test('segredo de L-1 caracteres no rabo do estouro é completado e mascarado', () => {
  const secret = 'SECRETLONG';
  const lines = [];
  const logger = createStderrLogger({log: (area, line) => lines.push(line), secrets: [secret], maxLineLength: 20});
  /* Estouro com exatamente L-1 chars do segredo no fim: tudo precisa ficar retido. */
  logger.push(`${'y'.repeat(20)}SECRETLON`);
  logger.push('G fim\n');
  logger.flush(true);
  const out = lines.join('\n');
  assert.equal(out.includes('SECRET'), false);
  assert.match(out, /\*\*\*/);
});

test('segredo que cruza a fronteira REAL de 64 KiB não vaza', () => {
  const secret = 'sk-1234567890abcdef';
  const lines = [];
  const logger = createStderrLogger({log: (area, line) => lines.push(line), secrets: [secret]});
  /* Uma linha sem \n que estoura o teto de verdade (65537 chars), com o segredo
     partido na fronteira do corte do estouro. */
  const first = `${'z'.repeat(STDERR_LINE_LIMIT - 5 + 1)}sk-12`;
  logger.push(first);
  logger.push('34567890abcdef fim\n');
  logger.flush(true);
  const out = lines.join('\n');
  assert.equal(out.includes('sk-'), false, 'nem o pedaço do segredo antes do corte');
  assert.equal(out.includes('34567890abcdef'), false);
  assert.match(out, /\*\*\*/);
});

test('o flush do exit não pode descarregar segredo INCOMPLETO em claro', () => {
  /* Unidade: o que falta do segredo ainda vai chegar no próximo chunk; o flush
     do exit descarrega o pendente e o log reconstrói o segredo inteiro. */
  const lines = [];
  const logger = createStderrLogger({log: (area, line) => lines.push(line), secrets: ['sk-1234567890abcdef']});
  logger.push('antes sk-12');
  logger.flush();
  logger.push('34567890abcdef depois\n');
  logger.flush(true);
  const out = lines.join('\n');
  assert.equal(out.includes('sk-12'), false, 'o pedaço do segredo não pode sair no flush do exit');
  assert.equal(out.includes('34567890abcdef'), false, 'nem a continuação no flush do close');
});

test('F1: segredo com borda partido entre exit e close não vaza L-1 caracteres', () => {
  /* Caso exato da revisão: `xSECRETx` começa e termina com `x`, então o rabo
     retido no flush do exit era só a borda e o resto da chave ia em claro. */
  const lines = [];
  const logger = createStderrLogger({log: (area, line) => lines.push(line), secrets: ['xSECRETx']});
  logger.push('antes xSECR');
  logger.flush();
  logger.push('ETx');
  logger.flush(true);
  assert.deepEqual(lines, ['antes', '***'], 'o log não reconstrói a chave com borda');
  assert.equal(lines.join('\n').includes('xSECRET'), false);
});

test('F1: segredo inteiro com borda no fim do pendente sai mascarado', () => {
  const lines = [];
  const logger = createStderrLogger({log: (area, line) => lines.push(line), secrets: ['xSECRETx']});
  logger.push('antes xSECRETx');
  logger.flush();
  logger.flush(true);
  assert.deepEqual(lines, ['antes ***'], 'o segredo inteiro não pode ser partido pelo corte do rabo');
});

test('F1: close sem exit e vários flushes não liberam segredo com borda', () => {
  const semExit = [];
  const closeOnly = createStderrLogger({log: (area, line) => semExit.push(line), secrets: ['xSECRETx']});
  closeOnly.push('fim xSECRETx');
  closeOnly.flush(true);
  assert.deepEqual(semExit, ['fim ***'], 'o close sem exit descarrega tudo mascarado');

  const repetidos = [];
  const several = createStderrLogger({log: (area, line) => repetidos.push(line), secrets: ['xSECRETx']});
  several.push('antes xSECR');
  several.flush();
  several.push('ETx');
  several.flush();
  several.flush();
  several.flush(true);
  assert.deepEqual(repetidos, ['antes', '***'], 'flush repetido não devolve o rabo em claro');
});

test('F1: exit sem close não põe o começo do segredo com borda no log', () => {
  const lines = [];
  const logger = createStderrLogger({log: (area, line) => lines.push(line), secrets: ['xSECRETx']});
  logger.push('antes xSECRETx');
  logger.flush();
  assert.equal(lines.join('\n').includes('xSECRET'), false, 'sem close, o rabo retido some, mas não vaza');
});

test('F1: borda do segredo entre exit e close pela ordem real de eventos', async () => {
  const {calls, spawnProcess} = createFakeSpawn();
  const lines = [];
  const pending = startOpenCodeServer({binary: '/x/opencode', env: {OPENAI_API_KEY: 'xSECRETx'}, spawnProcess,
    log: (area, line) => lines.push(line)});
  const {child} = calls[0];
  child.stderr.write('antes xSECR');
  child.exitCode = 1;
  child.emit('exit', 1);
  child.stderr.write('ETx');
  child.emit('close');
  await assert.rejects(pending);
  const out = lines.join('\n');
  assert.equal(out.includes('xSECRET'), false, 'o pedaço antes do exit não pode sair em claro');
  assert.equal(out.includes('SECRETx'), false, 'nem a continuação depois do exit');
});

test('F4: segredo de 200 KB não deixa o flush do exit quadrático', () => {
  /* Antes eram ~9,5 s de CPU no main (slice + endsWith por comprimento). O teto
     largo de 1,5 s separa o algoritmo linear do quadrático sem medir ruído. */
  const big = 'B'.repeat(200000);
  const lines = [];
  const logger = createStderrLogger({log: (area, line) => lines.push(line), secrets: [big]});
  logger.push(`${'B'.repeat(69999)}C`);
  const started = Date.now();
  logger.flush();
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 1500, `flush levou ${elapsed} ms com segredo de 200 KB; esperado custo linear`);
  logger.flush(true);
});

test('F4: o rabo retido continua sendo o maior prefixo próprio do segredo', () => {
  const lines = [];
  const logger = createStderrLogger({log: (area, line) => lines.push(line), secrets: ['abcabcX', 'zzabczz']});
  logger.push('texto abcabc');
  logger.flush();
  logger.push('X fim\n');
  logger.flush(true);
  const out = lines.join('\n');
  assert.equal(out.includes('abcabcX'), false, 'o prefixo que virou segredo inteiro foi mascarado');
  assert.equal(out.includes('abcabc'), false, 'o rabo retido não saiu antes da hora');
});

test('descarga entre exit e close continua mascarada (ordem da descarga)', async () => {
  const {calls, spawnProcess} = createFakeSpawn();
  const lines = [];
  const pending = startOpenCodeServer({binary: '/x/opencode', env: {OPENAI_API_KEY: 'sk-1234567890abcdef'}, spawnProcess,
    log: (area, line) => lines.push(line)});
  const {child} = calls[0];
  /* O filho escreve o segredo em dois chunks e morre; o pipe entrega o segundo
     chunk depois do evento exit (comum com escrita grande). */
  child.stderr.write('antes sk-12');
  child.exitCode = 1;
  child.emit('exit', 1);
  child.stderr.write('34567890abcdef depois\n');
  child.emit('close');
  await assert.rejects(pending);
  const out = lines.join('\n');
  assert.equal(out.includes('sk-12'), false, 'o pedaço do segredo antes do exit não pode ir ao log');
  assert.equal(out.includes('34567890abcdef'), false, 'o pedaço depois do exit também não');
});

test('stdout nunca vai ao log', async () => {
  const {calls, spawnProcess} = createFakeSpawn();
  const lines = [];
  const pending = startOpenCodeServer({binary: '/x/opencode', env: {OPENAI_API_KEY: 'sk-1234567890abcdef'}, spawnProcess,
    log: (area, line) => lines.push(line)});
  const {child} = calls[0];
  child.stdout.write('server listening on http://127.0.0.1:51299\n');
  const server = await pending;
  child.stdout.write('sk-1234567890abcdef no stdout\n');
  server.stop();
  const out = lines.join('\n');
  assert.equal(out.includes('sk-'), false);
  assert.equal(out.includes('stdout'), false);
});

test('F17: parcial de linha NÃO inicial não vaza entre exit e close', () => {
  /* A linha 2 do segredo multilinha começa no meio do pendente do `exit` e o
     resto chega no close; antes o rabo retido só olhava prefixo do segredo
     INTEIRO, então "L2secretval" saía em claro e o log recompunha a linha. */
  const secret = 'HEADER-LINE\nL2secretvalue\nFOOTER-LINE';
  const lines = [];
  const logger = createStderrLogger({log: (area, line) => lines.push(line), secrets: [secret]});
  logger.push('prefixo L2secretval');
  logger.flush();
  logger.push('ue\n');
  logger.flush(true);
  assert.deepEqual(lines, ['prefixo', '***'], 'o rabo da linha 2 fica retido até completar e some mascarado');
  assert.equal(lines.join('\n').includes('L2secret'), false);
});

test('F17: parcial de linha não inicial no close não vai em claro', () => {
  const secret = 'HEADER-LINE\nL2secretvalue\nFOOTER-LINE';
  const lines = [];
  const logger = createStderrLogger({log: (area, line) => lines.push(line), secrets: [secret]});
  logger.push('texto antes L2secretvalu');
  logger.flush(true);
  assert.deepEqual(lines, ['texto antes', '***'], 'o fim do stream retém o prefixo da linha 2 e o troca por ***');
  assert.equal(lines.join('\n').includes('L2secretvalu'), false);
});

test('F20: segredo multilinha com milhares de linhas não trava o log', () => {
  /* Cada linha do segredo era um alvo de split/join por linha de stderr e a
     lista era reconstruída a cada emit: 2000 linhas davam ~5 ms por linha de
     60 KB. O teto de alvos mantém o custo limitado. */
  const many = Array.from({length: 2000}, (_, index) => `linha-secreta-${index}-0123456789abcdef`).join('\n');
  const logger = createStderrLogger({log: () => {}, secrets: [many]});
  const text = `${'x'.repeat(60000)}\n`;
  for (let index = 0; index < 5; index += 1) logger.push(text);
  const started = process.hrtime.bigint();
  for (let index = 0; index < 300; index += 1) logger.push(text);
  const elapsed = Number(process.hrtime.bigint() - started) / 1e6;
  logger.flush(true);
  assert.ok(elapsed < 600, `300 linhas de 60 KB levaram ${elapsed.toFixed(1)} ms; esperado teto de linhas-alvo`);
});
