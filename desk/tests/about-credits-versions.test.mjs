import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/* #46: a lista "Créditos e licenças" do Sobre cita a versão de cada
   biblioteca que a Mesa embute. Sem esta trava a lista envelhece em silêncio a
   cada atualização de dependência: o `package-lock.json` muda e o aviso de
   terceiros continua apontando a versão antiga. */
const DESK = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(DESK, 'index.html'), 'utf8');
const credits = [...html.matchAll(/<li data-package="([^"]+)"><strong>([^<]+)<\/strong>\s+(\d+\.\d+\.\d+)\s/g)]
  .map(([, pkg, label, version]) => ({pkg, label, version}));

function installedVersion(pkg) {
  const manifest = path.join(DESK, 'node_modules', ...pkg.split('/'), 'package.json');
  return JSON.parse(fs.readFileSync(manifest, 'utf8')).version;
}

test('o Sobre credita as bibliotecas embutidas, cada uma com versão e licença', () => {
  const found = credits.map((entry) => entry.pkg).sort();
  assert.deepEqual(found, [
    '@anthropic-ai/claude-agent-sdk', 'chart.js', 'dompurify', 'electron', 'katex', 'marked', 'pdfjs-dist',
  ], `pacotes creditados em desk/index.html: ${found.join(', ')}`);
});

test('a versão citada no Sobre é a instalada em node_modules', () => {
  for (const {pkg, label, version} of credits) {
    assert.equal(version, installedVersion(pkg),
      `Sobre → Créditos cita ${label} ${version}, mas ${pkg} instalado é ${installedVersion(pkg)}; atualize desk/index.html`);
  }
});

test('todo pacote de dependencies do desk aparece nos créditos', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(DESK, 'package.json'), 'utf8'));
  const credited = new Set(credits.map((entry) => entry.pkg));
  for (const pkg of Object.keys(manifest.dependencies)) {
    assert.ok(credited.has(pkg), `${pkg} está em dependencies e falta em Sobre → Créditos e licenças (desk/index.html)`);
  }
});
