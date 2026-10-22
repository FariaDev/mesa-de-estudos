/* O seletor de acento das Configurações e da primeira abertura (#70). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {ACCENT_IDS, accentOptionsMarkup, nextAccent} from '../src/accent-picker.mjs';
import ptBR from '../locales/pt-BR.json' with {type: 'json'};

test('as seis opções têm rótulo traduzido, com azul marcado', () => {
  assert.deepEqual([...ACCENT_IDS], ['blue', 'violet', 'green', 'orange', 'pink', 'graphite'], 'a ordem do ACCENTS do state.mjs');
  for (const id of ACCENT_IDS) assert.ok(ptBR[`settings.accent.${id}`], `falta settings.accent.${id}`);
  const markup = accentOptionsMarkup();
  assert.equal((markup.match(/role="radio"/g) || []).length, ACCENT_IDS.length);
  assert.match(markup, /data-accent="blue" aria-checked="true" tabindex="0"/);
  assert.match(markup, /data-accent="graphite" aria-checked="false" tabindex="-1"/);
  assert.match(markup, /data-i18n="settings\.accent\.violet"/);
});

test('as setas andam pelos acentos dando a volta; outra tecla não muda', () => {
  assert.equal(nextAccent('blue', 'ArrowRight'), 'violet');
  assert.equal(nextAccent('blue', 'ArrowLeft'), 'graphite');
  assert.equal(nextAccent('graphite', 'ArrowDown'), 'blue');
  assert.equal(nextAccent('desconhecido', 'ArrowRight'), 'violet', 'valor fora da lista conta como azul');
  assert.equal(nextAccent('blue', 'Enter'), '');
});
