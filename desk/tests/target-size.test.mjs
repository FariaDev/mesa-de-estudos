import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {_electron as electron} from '@playwright/test';

/* #67: alvo mínimo de clique de 24px (WCAG 2.5.8). Varre as regras de botão
   das folhas da Mesa que fixam largura ou altura em px. O que fica menor tem de
   ganhar a borda invisível de 3px (`::after{inset:-3px}`). A fila, adiada na
   #67, ganhou linha de 24px na #69. */
const desk = path.resolve(import.meta.dirname, '..');
const MIN_TARGET = 24;
const HIT_AREA = ['.mention-chip-remove', '.attachment .attachment-remove'];

function sheets() {
  const src = fs.readdirSync(path.join(desk, 'src')).filter((f) => f.endsWith('.css')).map((f) => path.join('src', f));
  return ['style.css', ...src].map((rel) => ({rel, css: fs.readFileSync(path.join(desk, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')}));
}

/** Seletor cujo último trecho é um botão, sem estado nem pseudo-elemento. */
function isButtonSelector(selector) {
  const tail = selector.split(/[\s>+~]+/).pop() ?? '';
  return /(button|-btn\b|-remove\b|-close\b|role=button)/.test(tail) && !/:hover|:focus|:active|::/.test(selector);
}

function smallButtonRules() {
  const found = [];
  for (const {rel, css} of sheets()) {
    for (const chunk of css.split('}')) {
      const open = chunk.lastIndexOf('{');
      if (open < 0) continue;
      const selectors = chunk.slice(0, open).trim().split('\n').pop().split(',').map((s) => s.trim()).filter(isButtonSelector);
      const sizes = [...chunk.slice(open + 1).matchAll(/(?:^|;)\s*(width|height)\s*:\s*(\d+(?:\.\d+)?)px/g)].filter((m) => Number(m[2]) < MIN_TARGET);
      for (const selector of sizes.length ? selectors : []) found.push({rel, selector, sizes: sizes.map((m) => `${m[1]}:${m[2]}px`).join(' ')});
    }
  }
  return found;
}

test('botão com largura ou altura abaixo de 24px ganha borda de clique', () => {
  for (const {rel, selector, sizes} of smallButtonRules()) {
    assert.ok(HIT_AREA.includes(selector), `${rel}: ${selector} tem ${sizes}; esperado ≥ ${MIN_TARGET}px ou a borda invisível de 3px`);
  }
});

test('.set-link tem ao menos 24px de altura (auditoria rodada 2, D7)', () => {
  /* Links de ação de Ajustes ("Conferir de novo", "Como funciona") mediam
     14px; o mínimo do WCAG 2.2 (2.5.8) é 24px. O padding é simétrico para o
     texto não se deslocar em relação ao vizinho. */
  const css = fs.readFileSync(path.join(desk, 'src', 'settings.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [...css.matchAll(/\.set-link\{([^}]*)\}/g)].map((m) => m[1]);
  assert.ok(rules.length > 0, 'settings.css: esperada a regra .set-link');
  const rule = rules.find((body) => /min-height\s*:/.test(body));
  assert.ok(rule, 'settings.css: .set-link com min-height');
  const min = rule.match(/min-height\s*:\s*(\d+(?:\.\d+)?)px/);
  assert.ok(min && Number(min[1]) >= MIN_TARGET, `.set-link: min-height de ${min?.[1] ?? '?'}px, esperado ao menos ${MIN_TARGET}px`);
  const pad = rule.match(/padding\s*:\s*(\d+(?:\.\d+)?)px(?:\s+0)?[;}]/);
  assert.ok(pad && Number(pad[1]) > 0, '.set-link: padding vertical simétrico, sem deslocar o texto vizinho');
});

test('a borda invisível existe e soma 24px nos 18px do desenho', () => {
  const composer = fs.readFileSync(path.join(desk, 'src', 'composer.css'), 'utf8');
  const rule = composer.match(/:is\(([^)]*)\)::after\{content:"";position:absolute;inset:-3px/);
  assert.ok(rule, 'composer.css: esperado :is(...)::after{content:"";position:absolute;inset:-3px…}');
  assert.deepEqual(rule[1].split(',').map((s) => s.trim()), HIT_AREA);
  assert.ok(smallButtonRules().filter((r) => HIT_AREA.includes(r.selector)).every((r) => /18px/.test(r.sizes)), 'o desenho segue em 18px');
});

/* Auditoria rodada 4, F3: os alvos da classe na CASCATA REAL, sem ler folha
   como texto (condição do ticket: só parser do navegador e CSSOM). Uma janela
   escondida do Electron veste elementos com as classes de verdade e o teste
   mede `offsetWidth/offsetHeight` — o Backup injetado por JS fica para o
   target-size-ui.mjs, que mede o app aberto. */
const NO_DISPLAY = process.platform === 'linux' && !process.env.DISPLAY;

test('alvos da F3 medem 24px na cascata real', {skip: NO_DISPLAY ? 'sem DISPLAY para a janela escondida do Electron' : false, timeout: 120000}, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-target-size-'));
  const main = path.join(dir, 'main.cjs');
  const view = path.join(dir, 'view.html');
  const css = ['style.css', 'src/readers.css', 'src/settings.css', 'src/opencode-providers.css']
    .map((sheet) => `<link rel="stylesheet" href="file://${path.join(desk, sheet)}">`).join('\n');
  fs.writeFileSync(view, `<!doctype html><html><head><meta charset="utf-8">${css}</head><body>
<div class="pdf-panel"><div class="pdf-title"><button class="pager" type="button"><span class="pager-current">1</span><span class="page-total"> / 2</span></button></div></div>
<div class="more-zoom"><div class="more-zoom-ctl"><button class="fit more-zoom-fit" type="button">Ajustar à largura</button></div></div>
<div id="settings-dialog"><form id="settings-form"><div class="set-sec">
<label class="set-check"><input type="checkbox">Avisar ao concluir</label>
<label class="set-check" for="cfg-layout-count-1"><input type="radio" id="cfg-layout-count-1" name="count" value="1">1</label>
<div id="cfg-layout"><button class="layout-presets-open" type="button">Layouts pessoais…</button></div>
</div></form></div>
<div class="op-providers"><div class="op-others"><summary>Outro provedor (OAuth ou chave de API)</summary></div></div>
</body></html>`);
  fs.writeFileSync(main, [
    "const {app, BrowserWindow} = require('electron');",
    `app.setPath('userData', ${JSON.stringify(path.join(dir, 'user-data'))});`,
    'app.whenReady().then(async () => {',
    "  const win = new BrowserWindow({show: false, width: 900, height: 650});",
    `  await win.loadFile(${JSON.stringify(view)});`,
    '});',
    "app.on('window-all-closed', () => app.quit());",
  ].join('\n'));
  const app = await electron.launch({args: [main], cwd: desk, env: {...process.env, XDG_CONFIG_HOME: dir, HOME: dir}});
  try {
    const page = await app.firstWindow();
    await page.waitForSelector('.pager', {timeout: 30000});
    const sizes = await page.evaluate(() => [...document.querySelectorAll('.pager, .more-zoom-fit, .set-check, .layout-presets-open, .op-others summary')]
      .map((el) => ({kind: el.className.baseVal !== undefined ? '' : String(el.className).split(' ')[0] || el.tagName.toLowerCase(), text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30), w: el.offsetWidth, h: el.offsetHeight})));
    assert.ok(sizes.length >= 6, `esperava os 6 alvos da F3, mediu ${sizes.length}`);
    for (const s of sizes) {
      assert.ok(s.w >= MIN_TARGET && s.h >= MIN_TARGET, `${s.kind} "${s.text}" mede ${s.w}×${s.h}, esperado ao menos ${MIN_TARGET}×${MIN_TARGET}`);
    }
  } finally {
    await app.close().catch(() => {});
    fs.rmSync(dir, {recursive: true, force: true});
  }
});
