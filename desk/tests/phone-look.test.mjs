import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {readPalette, phoneLookCss, ACCENTS} = require('../phone-look.cjs');
const {phonePageHtml} = require('../phone-page.cjs');

/* A página do celular segue o tema e o acento da Mesa (#36), lidos do style.css real. */
const palette = readPalette(fs.readFileSync(path.join(import.meta.dirname, '..', 'style.css'), 'utf8'));

test('o style.css tem os tokens que a página do celular usa, para cada acento', () => {
  for (const token of ['bg', 'surface', 'fg', 'muted', 'border']) assert.ok(palette[token], `falta --${token}`);
  for (const accent of ACCENTS) assert.match(palette[`acc-${accent}`]?.light ?? '', /^#[0-9a-f]{6}$/i, `--acc-${accent}`);
  assert.equal(palette.border.dark, 'rgb(255 255 255/.10)');
});

test('tema fixo da Mesa vale no celular, sem seguir o tema do aparelho', () => {
  const dark = phoneLookCss({theme: 'dark', accent: 'green', palette});
  assert.match(dark, /color-scheme:dark/);
  assert.match(dark, new RegExp(`--accent:${palette['acc-green'].dark}`));
  assert.doesNotMatch(dark, /prefers-color-scheme/);
  const light = phoneLookCss({theme: 'light', accent: 'pink', palette});
  assert.match(light, new RegExp(`--accent:${palette['acc-pink'].light}`));
  assert.match(light, new RegExp(`--bg:${palette.bg.light}`));
});

test('tema automático segue o aparelho, com os dois tons do acento', () => {
  const css = phoneLookCss({theme: 'auto', accent: 'violet', palette});
  assert.match(css, /color-scheme:light dark/);
  assert.match(css, new RegExp(`--accent:${palette['acc-violet'].light}.*@media \\(prefers-color-scheme:dark\\).*--accent:${palette['acc-violet'].dark}`));
});

test('grafite no escuro leva texto escuro sobre o botão; acento desconhecido vira azul', () => {
  assert.match(phoneLookCss({theme: 'dark', accent: 'graphite', palette}), /--on-accent:#181818/);
  assert.match(phoneLookCss({theme: 'light', accent: 'roxo-neon', palette}), new RegExp(`--accent:${palette['acc-blue'].light}`));
});

test('a página leva o :root da Mesa e o lugar das fotos enviadas', () => {
  const t = (key) => key;
  const html = phonePageHtml({t, lang: 'pt-BR', nonce: 'n', maxMb: 15, lookCss: phoneLookCss({theme: 'dark', accent: 'orange', palette})});
  assert.match(html, /<style nonce="n">:root\{color-scheme:dark;/);
  assert.match(html, /<div id="sent"/);
  assert.match(html, /URL\.createObjectURL\(file\)/, 'a prévia é feita no celular, sem buscar a foto no servidor');
});
