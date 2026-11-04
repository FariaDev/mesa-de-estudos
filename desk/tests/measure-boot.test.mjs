import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {measureBoot} from '../scripts/measure-boot.mjs';

const DESK = path.resolve(import.meta.dirname, '..');
const MiB = 1024 * 1024;

test('a partida do renderer não carrega o pdf.js antes do primeiro PDF', () => {
  const report = measureBoot({root: DESK});
  assert.ok(report.modules > 100, `grafo pequeno demais: ${report.modules} módulos`);
  assert.equal(report.missing.length, 0, `imports sem arquivo: ${report.missing.join(', ')}`);
  assert.ok(!report.moduleFiles.includes('node_modules/pdfjs-dist/build/pdf.mjs'),
    'o pdf.js (860 KiB) voltou para o caminho de partida: use src/pdfjs-loader.mjs');
});

test('o núcleo das Configurações (133 KiB) só entra quando o diálogo abre', () => {
  const report = measureBoot({root: DESK});
  assert.ok(!report.moduleFiles.includes('src/generated/settingsview.core.js'),
    'o settingsview.core.js voltou para o caminho de partida: use src/lazy-module.mjs');
});

test('o núcleo da primeira abertura (125 KiB) só entra quando a tela vale', () => {
  const report = measureBoot({root: DESK});
  assert.ok(!report.moduleFiles.includes('src/generated/firstrun.core.js'),
    'o firstrun.core.js voltou para o caminho de partida: use src/first-run-boot.mjs');
  assert.ok(!report.moduleFiles.includes('src/first-run.mjs'),
    'a tela da primeira abertura voltou para o caminho de partida: use src/first-run-boot.mjs');
});

test('o painel de Estatísticas só entra quando é aberto', () => {
  const report = measureBoot({root: DESK});
  assert.ok(!report.moduleFiles.includes('src/study-stats.mjs'),
    'o study-stats.mjs voltou para o caminho de partida');
  assert.ok(!report.moduleFiles.includes('src/generated/studystats.core.js'),
    'o studystats.core.js voltou para o caminho de partida: use src/lazy-module.mjs');
});

test('o payload de partida fica abaixo do teto e o CSS é medido', () => {
  const report = measureBoot({root: DESK});
  assert.ok(report.html.styleBytes > 0, 'nenhuma folha de estilo medida');
  assert.ok(report.bytes < 4 * MiB, `partida do renderer com ${report.bytes} bytes (teto 4 MiB)`);
});
