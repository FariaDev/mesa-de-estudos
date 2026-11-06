// PROVA — texto perdido no stream vivo (auditoria rodada 5, D3).
// Roda o cenário Electron (markup-live-loss-scenarios.cjs) e assera o contrato:
// o `$` solto "só vale até a quebra de linha … o resto continua texto"
// (comentário do próprio teste puro de `openMathRange`), e delimitador dentro
// de código não é fórmula em chegada. Afirma o texto esperado no vivo E no
// final, para falhar mesmo quando os dois erram igual (preço como fórmula).
// Roda da pasta desk: `DISPLAY=:0 node --test tests/markup-live-loss.test.mjs`.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {testEnv} from './electron-env.mjs';

const require = createRequire(import.meta.url);
const electronPath = require('electron');
const DESK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCENARIO = path.join(DESK, 'tests', 'markup-live-loss-scenarios.cjs');
const SANDBOX_LIMIT = /mach_port_rendezvous|bootstrap_check_in|sandbox_extension_issue_file_to_process|Process failed to launch/i;

function runScenario() {
  const run = spawnSync(electronPath, [SCENARIO], {
    cwd: DESK,
    env: testEnv({DESK_TEST: '1'}),
    encoding: 'utf8',
    timeout: 120000,
    killSignal: 'SIGKILL',
  });
  const match = /__RESULT__ (\{.*\})\s*$/m.exec(String(run.stdout || ''));
  return {output: `${run.stdout || ''}${run.stderr || ''}`, data: match ? JSON.parse(match[1]) : null};
}

const {output, data} = runScenario();
const skip = !data && SANDBOX_LIMIT.test(output)
  ? `Electron não inicia neste ambiente (sandbox): ${output.split('\n').map((line) => line.trim()).filter(Boolean)[0] || 'sem saída'}`
  : false;

function got() {
  assert.ok(data, `sem resultado:\n${output.slice(-3000)}`);
  return data;
}

test('o cenário Electron rodou', {skip}, () => {
  got();
});

test('D3: texto DEPOIS de uma linha $… completa continua visível no vivo', {skip}, () => {
  /* O contrato do `openMathRange` para o `$` solto devolve `end` = fim da
     linha e o teste puro diz "o resto continua texto". O vivo tem de mostrar
     o que vem depois do fim da linha candidata. */
  const {dollarLine, dollarLineFinal} = got();
  assert.ok(dollarLine.text.includes('próximo parágrafo continua'),
    `o vivo engoliu o texto depois do $ aberto: ${JSON.stringify(dollarLine.text)}`);
  assert.ok(String(dollarLineFinal).includes('próximo parágrafo continua'),
    `o final perdeu o texto depois do $ aberto: ${JSON.stringify(dollarLineFinal)}`);
});

test('D3: $ dentro de código (crase) não é fórmula em chegada', {skip}, () => {
  const {codeDollar, codeDollarFinal} = got();
  assert.ok(codeDollar.text.includes('no terminal'),
    `o vivo engoliu o resto da linha depois do $HOME em código: ${JSON.stringify(codeDollar.text)}`);
  assert.equal(codeDollar.pending, false, 'não pode haver linha quieta para $ dentro de crase');
  assert.ok(String(codeDollarFinal).includes('$HOME'),
    `o final perdeu o $HOME em código: ${JSON.stringify(codeDollarFinal)}`);
});

test('D3: \\( dentro de código não é fórmula em chegada', {skip}, () => {
  const {codeParen, codeParenFinal} = got();
  assert.ok(codeParen.text.includes('e siga'),
    `o vivo engoliu o texto depois do \\( em código: ${JSON.stringify(codeParen.text)}`);
  assert.equal(codeParen.pending, false, 'não pode haver linha quieta para \\( dentro de crase');
  assert.ok(String(codeParenFinal).includes('e siga'),
    `o final perdeu o texto depois do \\( em código: ${JSON.stringify(codeParenFinal)}`);
});

test('D3: $ dentro de cerca não engole o resto da mensagem', {skip}, () => {
  const {fenceDollar, fenceDollarFinal} = got();
  assert.ok(fenceDollar.text.includes('fim do bloco'),
    `o vivo engoliu o que vem depois da cerca: ${JSON.stringify(fenceDollar.text)}`);
  assert.ok(String(fenceDollarFinal).includes('fim do bloco'),
    `o final perdeu o que vem depois da cerca: ${JSON.stringify(fenceDollarFinal)}`);
});

test('preço continua texto no vivo e no final (sem linha quieta)', {skip}, () => {
  const {price, priceFinal} = got();
  assert.equal(price.pending, false, 'preço não vira linha quieta');
  assert.equal(price.range, null, 'preço não é fórmula aberta');
  assert.ok(price.text.includes('$5') && price.text.includes('$6'),
    `o vivo comeu o preço como fórmula: ${JSON.stringify(price.text)}`);
  assert.ok(String(priceFinal).includes('$5') && String(priceFinal).includes('$6'),
    `o final comeu o preço como fórmula: ${JSON.stringify(priceFinal)}`);
});

test('$$ aberto continua linha quieta até fechar (comportamento pedido)', {skip}, () => {
  assert.equal(got().openDisplay.pending, true, '$$ aberto sem linha quieta');
});
