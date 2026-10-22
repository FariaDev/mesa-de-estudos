import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

/* #61: a STIX Two Text vem embutida em src/fonts/ e é declarada uma vez só em
   src/fonts.css, que a Mesa e a janela de PDF carregam. A Newsreader saiu, e a
   pilha de código mora só em --font-mono. Estes testes leem os arquivos; a
   fonte renderizada de fato é conferida nos testes de janela. */
const DESK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(DESK, rel), 'utf8');

/** Lista os .css/.mjs/.html de `dir`, sem node_modules, runtime nem gerados. */
function sourceFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(path.join(DESK, dir), {withFileTypes: true})) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.runtime', 'generated', 'tests'].includes(entry.name)) out.push(...sourceFiles(rel));
      continue;
    }
    if (/\.(css|mjs|html)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

test('fonts.css declara a STIX com arquivos woff2 que existem', () => {
  const css = read('src/fonts.css');
  const urls = [...css.matchAll(/url\("([^"]+)"\)/g)].map((m) => m[1]);
  assert.deepEqual(urls, ['fonts/STIXTwoText.woff2', 'fonts/STIXTwoText-Italic.woff2']);
  for (const url of urls) {
    const bytes = fs.readFileSync(path.join(DESK, 'src', url));
    assert.equal(bytes.subarray(0, 4).toString('latin1'), 'wOF2', `${url}: esperado cabeçalho wOF2`);
  }
  assert.match(read('src/fonts/OFL.txt'), /SIL OPEN FONT LICENSE Version 1\.1/);
});

test('a Mesa e a página de PDF carregam o mesmo fonts.css', () => {
  assert.match(read('src/desk-areas.css'), /@import url\('fonts\.css'\);\n@import url\('header\.css'\);/);
  assert.match(read('src/materials/print.html'), /<link rel="stylesheet" href="\.\.\/fonts\.css">/);
});

test('--serif começa na STIX e a Newsreader não aparece mais', () => {
  assert.match(read('src/fonts.css'), /--serif:"STIX Two Text",/);
  const leftovers = sourceFiles('.').filter((rel) => read(rel).includes('Newsreader'));
  assert.deepEqual(leftovers, []);
});

test('a pilha de código mora só em --font-mono, com as fontes do Windows', () => {
  assert.match(read('src/fonts.css'), /--font-mono:[^;]*"Cascadia Mono",Consolas/);
  const repeated = sourceFiles('.').filter((rel) => rel !== path.join('src', 'fonts.css') && /ui-monospace,\s*(SFMono|Menlo)/.test(read(rel)));
  assert.deepEqual(repeated, []);
});
