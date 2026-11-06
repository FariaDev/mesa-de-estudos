import test from 'node:test';
import assert from 'node:assert/strict';
import {initialSetup, goToStep} from '../src/setup-flow.mjs';
import fs from 'node:fs';
import {LAMP_STATES, LAMP_SCENE, lampStateOf, nameLineScale} from '../src/setup-lamp.mjs';

/* #101: a cena da luminária. Só a luz se move; cada passo tem um alvo, e o
   tutor sem motor, instalando ou com falha fica fraco e estável, sem alarme. */
const at = (id, extra = {}) => ({...goToStep(initialSetup('setup'), id), ...extra});
const found = {claudeFound: true, visibleEngines: ['claude', 'opencode']};
const none = {claudeFound: false, opencodeFound: false, visibleEngines: ['claude', 'opencode']};

test('cada passo e quadro aponta a luz do mockup', () => {
  assert.equal(lampStateOf(initialSetup('setup')), 'welcome');
  assert.deepEqual([0, 1, 2, 3].map((frame) => lampStateOf(at('tour', {frame}))), ['material', 'escrita', 'tutor', 'onde']);
  assert.equal(lampStateOf(at('name')), 'nome');
  assert.equal(lampStateOf(at('folder')), 'pasta-esperando');
  assert.equal(lampStateOf(at('folder', {alert: true})), 'pasta-arrastando');
  assert.equal(lampStateOf(at('folder', {folder: '/pdfs', pdfCount: 3})), 'pasta-achada');
  assert.equal(lampStateOf(at('ready')), 'pronto');
});

test('tutor: ligando pulsa, ligado fica estável, sem motor é fraco', () => {
  assert.equal(lampStateOf(at('tutor'), found, {state: 'idle'}), 'tutor-ligando');
  assert.equal(lampStateOf(at('tutor', {online: true}), found, {state: 'idle'}), 'tutor-ligado');
  assert.equal(lampStateOf(at('tutor'), none, {state: 'idle'}), 'tutor-sem-motor');
  assert.equal(lampStateOf(at('tutor'), none, {state: 'installing'}), 'tutor-instalando');
  assert.equal(lampStateOf(at('tutor'), none, {state: 'error'}), 'tutor-falha');
  assert.equal(lampStateOf(at('tutor'), none, {state: 'done'}), 'tutor-ligando', 'instalou: já pode ligar');
});

test('a cena e o CSS cobrem todos os estados, sem personagem nem balão', () => {
  const css = fs.readFileSync(new URL('../src/first-run.css', import.meta.url), 'utf8');
  for (const state of LAMP_STATES) assert.ok(css.includes(`[data-lamp="${state}"]`), `${state}: alvo da luz no CSS`);
  assert.ok(LAMP_SCENE.includes('sl-pool'));
  assert.ok(LAMP_SCENE.includes('sl-beam-shape'));
  assert.doesNotMatch(LAMP_SCENE, /mascote|personagem/i, 'sem personagens');
});

test('a linha do nome acompanha a digitação de 5% a 100%', () => {
  assert.equal(nameLineScale(''), 0.05);
  assert.equal(nameLineScale('   '), 0.05);
  assert.equal(nameLineScale('Cál'), 0.375);
  assert.equal(nameLineScale('Cálculo I'), 1);
  assert.equal(nameLineScale('Uma matéria com nome bem comprido'), 1);
});
