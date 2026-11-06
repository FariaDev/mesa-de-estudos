import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/* #67: contraste WCAG AA dos dois temas e dos seis acentos, lido do style.css.
   Texto pede 4,5:1; o anel de foco, que não é texto, pede 3:1. */
const desk = path.resolve(import.meta.dirname, '..');
const css = fs.readFileSync(path.join(desk, 'style.css'), 'utf8');
const THEMES = /** @type {const} */ (['light', 'dark']);
const ACCENTS = ['blue', 'violet', 'green', 'orange', 'pink', 'graphite'];
const BACKGROUNDS = ['bg', 'surface', 'side'];

/**
 * Lê `--nome:light-dark(#claro,#escuro)` do style.css.
 * @param {string} name token sem os dois traços, como "acc-blue-text"
 * @returns {{light: string, dark: string}}
 */
function themeToken(name) {
  const match = css.match(new RegExp(`--${name}:light-dark\\((#[0-9a-f]{6}),(#[0-9a-f]{6})\\)`));
  assert.ok(match, `--${name}: esperado light-dark(#rrggbb,#rrggbb) no style.css`);
  return {light: match[1], dark: match[2]};
}

/** @param {string} hex */
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** @param {string} a @param {string} b */
function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** @param {string} fg @param {string} bg @param {number} floor @param {string} label */
function assertContrast(fg, bg, floor, label) {
  const ratio = contrastRatio(fg, bg);
  assert.ok(ratio >= floor, `${label}: ${fg} sobre ${bg} dá ${ratio.toFixed(2)}:1, esperado ≥ ${floor}:1`);
}

test('contraste: a conta bate com os pares conhecidos', () => {
  assert.equal(contrastRatio('#000000', '#ffffff').toFixed(1), '21.0');
  assert.equal(contrastRatio('#777777', '#ffffff').toFixed(2), '4.48');
});

test('texto, texto fraco e texto de status passam AA nos dois temas', () => {
  for (const theme of THEMES) {
    for (const bg of BACKGROUNDS) {
      for (const fg of ['fg', 'muted', 'faint', 'danger-text', 'success-text', 'warn-text']) {
        assertContrast(themeToken(fg)[theme], themeToken(bg)[theme], 4.5, `${theme} --${fg} em --${bg}`);
      }
    }
  }
});

test('os seis acentos passam AA como link e como fundo da ação principal', () => {
  for (const theme of THEMES) {
    for (const accent of ACCENTS) {
      const onFill = accent === 'graphite' && theme === 'dark' ? '#181818' : '#ffffff';
      assertContrast(onFill, themeToken(`acc-${accent}`)[theme], 4.5, `${theme} texto sobre --acc-${accent}`);
      for (const bg of BACKGROUNDS) {
        assertContrast(themeToken(`acc-${accent}-text`)[theme], themeToken(bg)[theme], 4.5, `${theme} --acc-${accent}-text em --${bg}`);
      }
    }
  }
});

test('o fundo da ação principal se destaca 3:1 das superfícies nos dois temas (#69)', () => {
  /* No escuro o fill ficava em 2,46:1 sobre --surface (achado 9 da #67); o tom
     novo fica entre 3:1 contra o fundo e 4,5:1 com o texto branco por cima. */
  for (const theme of THEMES) {
    for (const accent of ACCENTS) {
      for (const bg of BACKGROUNDS) assertContrast(themeToken(`acc-${accent}`)[theme], themeToken(bg)[theme], 3, `${theme} --acc-${accent} em --${bg}`);
    }
  }
});

test('texto de status usa as versões -text, não o tom de ícone e fundo', () => {
  const sheets = [path.join(desk, 'style.css'), ...fs.readdirSync(path.join(desk, 'src')).filter((f) => f.endsWith('.css')).map((f) => path.join(desk, 'src', f))];
  for (const sheet of sheets) {
    const hit = fs.readFileSync(sheet, 'utf8').match(/(?<![-\w])color:var\(--(danger|success|warn)\)/);
    assert.equal(hit, null, `${path.basename(sheet)}: ${hit?.[0]}; esperado color:var(--${hit?.[1]}-text)`);
  }
});

test('o ponto da atualização no ⚙ e no item Ajustes usa o tom que passa 3:1 no escuro (#67)', () => {
  const about = fs.readFileSync(path.join(desk, 'src', 'help-about.css'), 'utf8');
  const dots = about.split('\n').filter((line) => line.includes('[data-dot="true"]'));
  assert.equal(dots.length, 2, `esperadas 2 regras do ponto, achadas ${dots.length}`);
  for (const line of dots) assert.match(line, /background:var\(--accent-text\)/, line);
  for (const accent of ACCENTS) {
    for (const bg of BACKGROUNDS) assertContrast(themeToken(`acc-${accent}-text`).dark, themeToken(bg).dark, 3, `ponto --acc-${accent}-text em --${bg}`);
  }
});

test('o trio ∫ Σ ∇ segue os seis acentos e passa nos dois temas (#100)', () => {
  /* Corpo e membro são desenho (3:1); o sinal é glifo (4,5:1); o claro é o
     preenchimento do ∇. A tinta do rosto fica sobre o corpo e é detalhe. */
  for (const theme of THEMES) {
    for (const accent of ACCENTS) {
      const token = (part) => themeToken(`trio-${accent}-${part}`)[theme];
      assertContrast(token('corpo'), themeToken('bg')[theme], 3, `${theme} ${accent}: corpo no fundo`);
      assertContrast(token('corpo'), themeToken('surface')[theme], 3, `${theme} ${accent}: corpo na superfície`);
      assertContrast(token('claro'), themeToken('bg')[theme], 3, `${theme} ${accent}: claro no fundo`);
      assertContrast(token('membro'), themeToken('surface')[theme], 3, `${theme} ${accent}: membro na superfície`);
      assertContrast(token('sinal'), themeToken('bg')[theme], 4.5, `${theme} ${accent}: sinal no fundo`);
      assertContrast(token('sinal'), themeToken('surface')[theme], 4.5, `${theme} ${accent}: sinal na superfície`);
    }
  }
});

/* Auditoria de UI/UX, rodada 1: --danger no escuro dá 4,1:1 como texto (D1);
   texto de status sai dos -text, que passam AA nos três fundos. E nenhum texto
   a 10px: o piso é 11px (D2). Rodada 2 (D2): os estilos injetados pelos .mjs
   valem o mesmo que CSS — a varredura cobre os dois. */
test('texto de status sai dos -text, nunca do --danger/--success/--warn (D1)', () => {
  const src = path.join(desk, 'src');
  const offenders = [];
  for (const file of fs.readdirSync(src).filter((name) => name.endsWith('.css') || name.endsWith('.mjs'))) {
    const lines = fs.readFileSync(path.join(src, file), 'utf8').split('\n');
    lines.forEach((line, index) => {
      if (/(^|[{\s])color\s*:\s*var\(--(danger|success|warn)[,)]/.test(line)) {
        offenders.push(`${file}:${index + 1}: ${line.trim()}`);
      }
    });
  }
  assert.deepEqual(offenders, [], `cor de texto com token não-texto: ${JSON.stringify(offenders)}`);
  const activity = fs.readFileSync(path.join(src, 'activity.css'), 'utf8');
  assert.match(activity, /\.activity-error\s*\{[^}]*color:\s*var\(--danger-text/, '.activity-error usa --danger-text');
});

test('piso de legibilidade: nenhum font-size a 10px no CSS (D2)', () => {
  const px = parseFloat(themeTokenRaw('fs-2xs'));
  assert.ok(px >= 11, `--fs-2xs é ${px}px, esperado ao menos 11px`);
  const roots = [desk, path.join(desk, 'src')];
  const offenders = [];
  for (const root of roots) {
    for (const file of fs.readdirSync(root).filter((name) => name.endsWith('.css'))) {
      const lines = fs.readFileSync(path.join(root, file), 'utf8').split('\n');
      lines.forEach((line, index) => {
        if (/font-size\s*:[^;{}]*\b10px\b/.test(line)) offenders.push(`${file}:${index + 1}: ${line.trim()}`);
      });
    }
  }
  assert.deepEqual(offenders, [], `texto a 10px: ${JSON.stringify(offenders)}`);
});

/**
 * Valor cru do token de tamanho (sem light-dark).
 * @param {string} name
 */
function themeTokenRaw(name) {
  const match = css.match(new RegExp(`--${name}:([0-9.]+)px`));
  assert.ok(match, `--${name}: esperado Npx no style.css`);
  return match[1];
}
