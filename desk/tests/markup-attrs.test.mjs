// Faixa dos atributos do modelo (#seg-markup) com Electron de verdade: o
// `markup` do chat e o `renderMaterialHtml` do PDF sobre o mesmo corpo de
// ataque e o mesmo corpo honesto. Se o Electron não inicia neste ambiente
// (sandbox), os cenários são PULADOS com o motivo.
// Roda da pasta desk: `node --test tests/markup-attrs.test.mjs`.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {testEnv} from './electron-env.mjs';

const require = createRequire(import.meta.url);
const electronPath = require('electron');
const DESK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNNER = path.join(DESK, 'tests', 'free-pdf-runner.cjs');
const SANDBOX_LIMIT = /mach_port_rendezvous|bootstrap_check_in|sandbox_extension_issue_file_to_process|Process failed to launch/i;

function scenario(name, extraEnv = {}) {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), `mesa-markup-attrs-`));
  const run = spawnSync(electronPath, [RUNNER, runtime, name], {
    cwd: DESK, env: testEnv({DESK_TEST: '1', ...extraEnv}), encoding: 'utf8', timeout: 180000, killSignal: 'SIGKILL', maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${run.stdout || ''}${run.stderr || ''}`;
  const match = /__RESULT__ (\{.*\})\s*$/m.exec(String(run.stdout || ''));
  return {runtime, output, data: match ? JSON.parse(match[1]) : null};
}

const attrs = scenario('markup-attrs');
const skip = !attrs.data && SANDBOX_LIMIT.test(attrs.output)
  ? `Electron não inicia neste ambiente (sandbox): ${attrs.output.split('\n').map((line) => line.trim()).filter(Boolean)[0] || 'sem saída'}`
  : false;

function data() {
  assert.ok(attrs.data?.ok, `o cenário markup-attrs não devolveu resultado:\n${attrs.output.slice(-3000)}`);
  return attrs.data;
}

/* `id` que a Mesa mesma põe depois da faixa: o prefixo da cerca de SVG e o
   `clipPath` do plot. O do modelo nunca chega com o nome que veio. */
const OWN_ID = /^(?:svg|clipPath|linearGradient|.+)?#(msvg\d+-.+|plot-[\w-]+)$/;

/* Foto honesta do corpo honesto (chat, impresso e prévia) antes da faixa
   Allowlist: `MESA_WRITE_HONEST=1` regrava `markup-attrs-honest.json`; o teste
   compara normalizando só os prefixos (`msvgN-`, `plot-H`, `pvN-`). */
const SNAPSHOT = path.join(DESK, 'tests', 'markup-attrs-honest.json');
const normalizeHonest = (html) => String(html || '')
  .replace(/msvg\d+-/g, 'msvgN-')
  .replace(/plot-[0-9a-f]+/g, 'plot-H')
  .replace(/pv\d+-/g, 'pvN-');

if (process.env.MESA_WRITE_HONEST === '1' && attrs.data) {
  fs.writeFileSync(SNAPSHOT, `${JSON.stringify({
    chat: normalizeHonest(attrs.data.honest.html),
    pdf: normalizeHonest(attrs.data.pdfHonest.html),
    preview: normalizeHonest(attrs.data.previewHonest.html),
  }, null, 1)}\n`);
}

function snapshot() {
  assert.ok(fs.existsSync(SNAPSHOT), `foto honesta ausente: rode MESA_WRITE_HONEST=1 (arquivo ${SNAPSHOT})`);
  return JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
}

/* Nenhum ataque clobera `#prompt`/`#link-dialog` nem deixa `name` — nem no
   chat nem no PDF. O `id` que sobra é só o prefixo da cerca de SVG. */
for (const key of Object.keys(data()?.chat || {})) {
  test(`chat: ataque ${key} não deixa id/name do modelo`, {skip}, () => {
    const out = data().chat[key];
    assert.equal(out.promptClobber, false, `${key}: #prompt ou #link-dialog no HTML:\n${out.html}`);
    assert.deepEqual(out.names, [], `${key}: sobrou name:\n${out.html}`);
    for (const id of out.ids) assert.match(id, OWN_ID, `${key}: id do modelo sem prefixo: ${id}\n${out.html}`);
  });
}

for (const key of ['svgId', 'svgGradient']) {
  test(`pdf: ataque ${key} ganha o prefixo da cerca como no chat`, {skip}, () => {
    const out = data().pdfAttack[key];
    assert.equal(out.promptClobber, false, `${key}: clobber no PDF:\n${out.html}`);
    for (const id of out.ids) assert.match(id, OWN_ID, `${key}: id do modelo sem prefixo no PDF: ${id}\n${out.html}`);
  });
}

for (const key of ['svgPosition', 'svgEntityPosition']) {
  test(`pdf: ataque ${key} perde o position pela guarda de SVG`, {skip}, () => {
    const out = data().pdfAttack[key];
    assert.deepEqual(out.styles, [], `${key}: position passou no PDF:\n${out.html}`);
  });
}

/* Contrato do impresso: fora do SVG, `id`/`name`/`style`/`class` do modelo
   ficam no PDF (o H1 cru do conteúdo desce para H2 mantendo atributos, com
   teste próprio em `material-template.test.mjs`). O impresso não roda JS —
   sem composer, sem diálogo, sem rascunho — então não há clobber; o que não
   passa nem lá é manipulador de evento. */
test('pdf: ataque sem on*; o id do modelo fica inerte no impresso', {skip}, () => {
  const {pdfAttack} = data();
  for (const [key, out] of Object.entries(pdfAttack)) assert.deepEqual(out.events, [], `pdf ${key}: sobrou on*:\n${out.html}`);
  assert.ok(pdfAttack.promptTextarea.ids.some((id) => /#prompt$/i.test(id)), 'o contrato do impresso mudou: id sumiu do PDF');
});

test('chat: style do modelo sai em todos os ataques; o da fórmula é o do KaTeX', {skip}, () => {
  for (const [key, out] of Object.entries(data().chat)) {
    if (key === 'svgEntityPosition') assert.deepEqual(out.styles, [], `${key}: position com entidade passou:\n${out.html}`);
    else assert.deepEqual(out.styles, [], `${key}: sobrou style:\n${out.html}`);
  }
  for (const style of data().honest.styles) assert.match(style, /^(span|path)\[style=/, `style fora do KaTeX/plot no corpo honesto: ${style}`);
});

test('chat: class do modelo sai; a isenção por marca falsa não vale', {skip}, () => {
  const {chat} = data();
  assert.deepEqual(chat.katexExempt.classes, [], `katex falso manteve classe:\n${chat.katexExempt.html}`);
  assert.deepEqual(chat.dialogBackdrop.classes, [], `backdrop manteve classe:\n${chat.dialogBackdrop.html}`);
  assert.deepEqual(chat.dataAsset.classes, [], `figure do modelo manteve classe:\n${chat.dataAsset.html}`);
  assert.deepEqual(chat.dataActivity.classes, [], `slot do modelo manteve classe:\n${chat.dataActivity.html}`);
  assert.deepEqual(chat.coladoClass.classes, [], `classe colada em aspa passou:\n${chat.coladoClass.html}`);
  assert.deepEqual(chat.templateNid.classes, [], `classe dentro de template passou:\n${chat.templateNid.html}`);
});

test('chat: data-tex do modelo sai; o do KaTeX continua', {skip}, () => {
  const {chat, honest} = data();
  assert.ok(!chat.dataTex.modelData.some((entry) => entry.endsWith('@data-tex')), `data-tex do modelo passou:\n${chat.dataTex.html}`);
  assert.ok(!chat.coladoDataTex.modelData.some((entry) => entry.endsWith('@data-tex')), `data-tex colado em aspa passou:\n${chat.coladoDataTex.html}`);
  assert.ok(honest.katex >= 1, 'o corpo honesto perdeu o data-tex do KaTeX');
});

test('chat: corpo honesto mantém fórmula, código, tabela, plot e SVG', {skip}, () => {
  const {honest} = data();
  assert.ok(honest.katex >= 1, 'faltou a fórmula');
  assert.ok(honest.codeBlocks >= 1, 'faltou o código realçado');
  assert.ok(honest.html.includes('<table>'), 'faltou a tabela');
  assert.equal(honest.plots, 1, 'faltou a figura do plot');
  assert.ok(honest.html.includes('<details>'), 'faltou o details');
  assert.ok(honest.html.includes('<a href="https://exemplo.com/guia">'), 'faltou o link');
  assert.match(honest.html, /id="msvg\d+-g"/, 'o id do gradiente honesto perdeu o prefixo');
  assert.match(honest.html, /url\(#msvg\d+-g\)/, 'a referência interna do gradiente quebrou');
});

test('pdf: corpo honesto mantém as figuras; sem id do modelo', {skip}, () => {
  const {pdfHonest} = data();
  for (const id of pdfHonest.ids) assert.match(id, OWN_ID, `id do modelo no PDF: ${id}\n${pdfHonest.html}`);
  assert.equal(pdfHonest.promptClobber, false, 'clobber no PDF');
  assert.equal(pdfHonest.plots, 1, 'o PDF perdeu a figura do plot');
});

test('cartão (markupInline): id do modelo não passa', {skip}, () => {
  assert.equal(data().inlinePromptClobber, false, `clobber no cartão:\n${data().inlineAttack}`);
});

/* Item 1 — `label for` do modelo não aciona controle real: o `for` sai pela
   faixa Allowlist e o texto do rótulo fica inerte na conversa. */
test('chat: label for do modelo perde o for e não clobera', {skip}, () => {
  const out = data().chat.labelFor;
  assert.ok(out, 'o cenário labelFor não rodou');
  assert.deepEqual(out.fors, [], `sobrou for:\n${out.html}`);
  assert.deepEqual(out.labels.sort(), ['CLIQUE-CONFERIR', 'CLIQUE-ENVIAR', 'CLIQUE-OK', 'CLIQUE-PARAR', 'CLIQUE-PROMPT'].sort(), `o texto do rótulo some junto (não deveria):\n${out.html}`);
  assert.equal(out.promptClobber, false, `clobber no chat:\n${out.html}`);
});

/* Item 1 — denylist virou Allowlist: o resto sai, incluindo `form`,
   `popover*`, `tabindex`, `accesskey`, `slot`, `is`, `inert`, `hidden`,
   `aria-*`, `data-*` do modelo, `background`, `poster`, `target`, `srcset`. */
test('chat: atributos fora da Allowlist saem (staleAttrs)', {skip}, () => {
  const out = data().chat.staleAttrs;
  assert.ok(out, 'o cenário staleAttrs não rodou');
  const banned = ['for', 'form', 'action', 'popover', 'tabindex', 'accesskey', 'slot', 'is', 'inert', 'hidden', 'background', 'poster', 'target', 'rel', 'srcset', 'ping', 'download', 'formaction'];
  for (const name of banned) assert.ok(!out.attrs.includes(name), `atributo ${name} passou:\n${out.html}`);
  assert.deepEqual(out.attrs.filter((name) => name.startsWith('aria-')), [], `aria-* do modelo passou:\n${out.html}`);
  assert.deepEqual(out.attrs.filter((name) => name.startsWith('data-')), [], `data-* do modelo passou (o ataque não tem KaTeX/código/asset):\n${out.html}`);
  assert.deepEqual(out.modelData.filter((entry) => entry.endsWith('@data-tex')), [], `data-tex plantado passou:\n${out.html}`);
});

/* Item 2 — URL relativa lê arquivo local pela CSP `file:`: em `src`/`href`
   do modelo só passam `https:`, `data:image/*` e `#fragmento`. */
test('chat: src/href relativo e file: saem; https fica', {skip}, () => {
  const {chat} = data();
  for (const key of ['relImg', 'relLink', 'relMedia']) {
    const out = chat[key];
    assert.ok(out, `o cenário ${key} não rodou`);
    assert.deepEqual(out.relUrls, [], `${key}: URL relativa passou:\n${out.html}`);
  }
  assert.deepEqual(chat.relMedia.attrs.filter((name) => ['background', 'poster'].includes(name)), [], `background/poster passaram:\n${chat.relMedia.html}`);
  assert.ok(chat.relMedia.html.includes('REL-TABELA'), 'o texto da tabela sumiu junto (não deveria)');
});

/* Item 3 — cerca SVG: `x="a"id="prompt"` ganha prefixo (parser, não regex);
   `class` e `name` do modelo saem; `image-set` sai do `style`. */
test('chat: cerca colada ganha prefixo; class/name somem', {skip}, () => {
  const {chat} = data();
  const colado = chat.svgColadoId;
  assert.ok(colado, 'o cenário svgColadoId não rodou');
  assert.equal(colado.promptClobber, false, `id colado cloberou:\n${colado.html}`);
  for (const id of colado.ids) assert.match(id, OWN_ID, `id da cerca sem prefixo: ${id}\n${colado.html}`);
  assert.ok(!chat.svgClass.html.includes('palette-backdrop'), `class da cerca virou overlay:\n${chat.svgClass.html}`);
  assert.deepEqual(chat.svgClass.classes.filter((entry) => entry !== 'div.figure'), [], `class no SVG da cerca:\n${chat.svgClass.html}`);
  assert.deepEqual(chat.svgName.names, [], `name da cerca passou:\n${chat.svgName.html}`);
  assert.deepEqual(chat.svgImageSet.styles, [], `style com image-set passou:\n${chat.svgImageSet.html}`);
});

/* Item 4 — prévia viva do Livre: mesma faixa do chat, com `id`/`class` sob
   prefixo `pvN-` em vez de removidos; `style` não entra na janela. */
const PREVIEW_ID = /^(?:svg|clipPath|linearGradient|.+)?#(msvg\d+-.+|plot-[\w-]+|pv\d+-.+)$/;
test('prévia: faixa com prefixo, sem for/url relativa/style/clobber', {skip}, () => {
  const {previewAttack} = data();
  assert.ok(previewAttack, 'o cenário de prévia não rodou');
  for (const [key, out] of Object.entries(previewAttack)) {
    assert.deepEqual(out.fors, [], `prévia ${key}: sobrou for:\n${out.html}`);
    assert.deepEqual(out.relUrls, [], `prévia ${key}: URL relativa passou:\n${out.html}`);
    assert.deepEqual(out.styles, [], `prévia ${key}: sobrou style:\n${out.html}`);
    assert.equal(out.promptClobber, false, `prévia ${key}: clobber (#prompt/#link-dialog sem prefixo):\n${out.html}`);
    for (const id of out.ids) assert.match(id, PREVIEW_ID, `prévia ${key}: id sem prefixo: ${id}\n${out.html}`);
  }
});

/* Item 5 — impresso: `position`/`inset` saem do `style` do modelo para a
   `position:fixed` não cobrir todas as páginas; o contrato do H1 cru fica. */
test('pdf impresso: style do modelo sem position/inset', {skip}, () => {
  const {pdfAttack} = data();
  for (const [key, out] of Object.entries(pdfAttack)) {
    for (const style of out.styles) assert.doesNotMatch(style, /position\s*:|inset[\s:]/i, `pdf ${key}: position/inset passou: ${style}\n${out.html}`);
  }
  const fixed = pdfAttack.printPosition;
  assert.ok(fixed, 'o cenário printPosition não rodou');
  assert.ok(fixed.html.includes('TELA FALSA PDF'), 'o texto do ataque sumiu junto (não deveria: vira conteúdo inline)');
  assert.ok(pdfAttack.promptTextarea.ids.some((id) => /#prompt$/i.test(id)), 'o contrato do impresso mudou: id do H1 cru sumiu do PDF');
  /* Quarta contraprova: `color:#fff` também saiu da allowlist, então o `style`
     do ataque some inteiro — o que importa é o texto continuar. */
  assert.deepEqual(fixed.styles, [], `o style do ataque sobreviveu: ${fixed.styles}`);
});

/* Item 5 — impresso: `--*` do modelo some (redefinia link, título, citação,
   `th` e `pre` só no PDF); o texto continua visível como na prévia. */
test('pdf impresso: variável do modelo some, texto fica', {skip}, () => {
  const {pdfAttack, previewAttack} = data();
  for (const key of ['varLink', 'varTitle', 'varQuote', 'varTh', 'varPre', 'varAnsAttack']) {
    const out = pdfAttack[key];
    assert.ok(out, `o cenário ${key} não rodou`);
    assert.deepEqual(out.styles.filter((style) => /--/.test(style)), [], `pdf ${key}: variável passou:\n${out.html}`);
  }
  assert.ok(pdfAttack.varLink.html.includes('LINK-ESCONDIDO-PDF'), 'o texto do link sumiu junto (não deveria)');
  assert.ok(pdfAttack.varTitle.html.includes('TITULO-ESCONDIDO-PDF'), 'o título sumiu junto (não deveria)');
  assert.ok(pdfAttack.varQuote.html.includes('CITACAO-ESCONDIDA-PDF'), 'a citação sumiu junto (não deveria)');
  assert.ok(pdfAttack.varTh.html.includes('CABECALHO-ESCONDIDO-PDF'), 'o th sumiu junto (não deveria)');
  assert.ok(pdfAttack.varPre.html.includes('CODIGO-ESCONDIDO-PDF'), 'o pre sumiu junto (não deveria)');
  assert.ok(pdfAttack.varAnsAttack.html.includes('RESPOSTA-ESTICADA'), 'o texto da resposta sumiu junto (não deveria)');
  for (const key of ['varLink', 'varTitle', 'varQuote', 'varTh', 'varPre', 'varAnsAttack']) {
    assert.deepEqual(previewAttack[key].styles, [], `prévia ${key}: sobrou style na janela:\n${previewAttack[key].html}`);
  }
});

/* `--ans` do simulado: o do template sobrevive com o valor do núcleo; o do
   modelo acima do teto (200 mm) some. Medido pelo CSSOM da janela. */
test('pdf impresso: --ans do template fica, --ans:9999mm do modelo sai', {skip}, () => {
  const {printVars} = data();
  assert.ok(printVars, 'o bloco printVars não rodou');
  assert.ok(printVars.honest.some((style) => /--ans:36mm/.test(style)), `o --ans honesto sumiu: ${JSON.stringify(printVars.honest)}`);
  for (const style of [...printVars.honest, ...printVars.attack]) {
    for (const match of String(style).matchAll(/--ans:([\d.]+)mm/g)) {
      assert.ok(Number(match[1]) <= 200, `--ans acima do teto: ${style}`);
    }
  }
  assert.ok(!printVars.attack.some((style) => /9999/.test(style)), `--ans de ataque sobreviveu: ${JSON.stringify(printVars.attack)}`);
});

/* Corpo honesto byte a byte (salvo prefixo): tabela, lista, link, imagem
   Markdown (local e remota), details (inclusive open), fórmula, figura, plot,
   asset, citação e cerca honesta com gradiente e `url(#…)`. */
for (const key of ['chat', 'pdf', 'preview']) {
  test(`honesto ${key}: igual à foto de antes da Allowlist`, {skip}, () => {
    const html = key === 'chat' ? data().honest.html : key === 'pdf' ? data().pdfHonest.html : data().previewHonest.html;
    assert.equal(normalizeHonest(html), snapshot()[key], `o corpo honesto ${key} mudou além do prefixo`);
  });
}

test('honesto chat: cobre tabela, lista, link, imagem, details, fórmula, plot, asset, citação e gradiente', {skip}, () => {
  const {honest} = data();
  assert.ok(honest.html.includes('<table>'), 'faltou a tabela');
  assert.ok(honest.html.includes('<li>'), 'faltou a lista');
  assert.ok(honest.html.includes('<a href="https://exemplo.com/guia">'), 'faltou o link https');
  assert.ok(honest.html.includes('<img src="https://exemplo.com/foto.png"'), 'a imagem Markdown remota (https) sumiu');
  assert.ok(honest.html.includes('<figure class="asset" data-asset="'), 'a imagem Markdown local (asset) sumiu');
  assert.match(honest.html, /<details open[\s=">]/, 'o details open sumiu');
  assert.ok(honest.html.includes('colspan="2"'), 'o colspan honesto sumiu');
  assert.ok(honest.html.includes('<blockquote>'), 'faltou a citação');
  assert.match(honest.html, /id="msvg\d+-g"/, 'o id do gradiente honesto perdeu o prefixo');
  assert.match(honest.html, /url\(#msvg\d+-g\)/, 'a referência interna do gradiente quebrou');
});

/* Quarta contraprova — texto escondido só no impresso: `rgba(0,0,0,0)`,
   `hsl(0 0% 0% / 0)` e o par `background:#fff` + `color:#fefefe` perdem o
   `style` inteiro no papel (a `color` saiu da allowlist) e o texto fica, como
   na prévia — medido pelo CSSOM da janela, sem adivinhar contraste. */
test('pdf impresso: cor do modelo some, texto fica como na prévia', {skip}, () => {
  const {pdfAttack, previewAttack} = data();
  const out = pdfAttack.printColorAlpha;
  assert.ok(out, 'o cenário printColorAlpha não rodou');
  assert.deepEqual(out.styles.filter((style) => /color/i.test(style)), [], `cor do modelo passou no papel:\n${out.html}`);
  for (const text of ['SUMIDO-RGBA', 'SUMIDO-HSL', 'SUMIDO-PAR']) {
    assert.ok(out.html.includes(text), `o texto ${text} sumiu junto (não deveria)`);
  }
  assert.deepEqual(previewAttack.printColorAlpha.styles, [], 'prévia printColorAlpha: sobrou style na janela');
});

/* Quarta contraprova — o resto da allowlist não esconde: `vertical-align`
   gigante e `text-decoration`/`font-weight` mantêm o texto visível no papel. */
test('pdf impresso: vertical-align gigante e deco mantêm o texto', {skip}, () => {
  const {pdfAttack} = data();
  const out = pdfAttack.printVertDeco;
  assert.ok(out, 'o cenário printVertDeco não rodou');
  assert.ok(out.html.includes('DESLOCADO-VERT'), 'o texto deslocado sumiu junto (não deveria)');
  assert.ok(out.html.includes('MARCADO-DECO'), 'o texto marcado sumiu junto (não deveria)');
});

/* Quarta contraprova — classe do modelo não fala a língua do CSS do template:
   `class` e `--ans` saem antes da estrutura da casa, então `pdf-resposta`,
   `pdf-run` e `pdf-title` forjados não casam com regra nenhuma. */
test('pdf impresso: classe forjada não casa com o CSS do template', {skip}, () => {
  const {pdfAttack} = data();
  for (const [key, text] of [['respFakeClass', 'RESPOSTA-FORJADA'], ['runFakeClass', 'CORRIDA-FORJADA']]) {
    const out = pdfAttack[key];
    assert.ok(out, `o cenário ${key} não rodou`);
    assert.ok(out.html.includes(text), `o texto ${text} sumiu junto (não deveria)`);
    assert.ok(!out.classes.some((entry) => /(^|\.)pdf-(resposta|run|title|q|gabarito)\b/.test(entry)), `${key}: classe forjada sobreviveu:\n${out.html}`);
    assert.deepEqual(out.styles.filter((style) => /--ans/.test(style)), [], `${key}: --ans forjado sobreviveu:\n${out.html}`);
  }
  const title = pdfAttack.titleFakeClass;
  assert.ok(title && title.html.includes('TITULO-FORJADO'), 'o título forjado sumiu junto (não deveria: vira h2 comum)');
  assert.ok(!title.classes.some((entry) => /(^|\.)pdf-title\b/.test(entry)), `pdf-title forjado sobreviveu:\n${title.html}`);
});

/* Quarta contraprova — `role` hostil no SVG: só `img`, apresentação e
   `graphics-*` passam (cerca, solto e impresso); `aria-label` continua. */
test('chat e pdf: role hostil do SVG sai, img fica', {skip}, () => {
  const {chat, pdfAttack, previewAttack} = data();
  assert.deepEqual(chat.roleHostil.roles, [], `cerca com role hostil no chat:\n${chat.roleHostil.html}`);
  assert.deepEqual(chat.roleSolto.roles, [], `solto com role hostil no chat:\n${chat.roleSolto.html}`);
  assert.deepEqual(pdfAttack.roleHostil.roles, [], `cerca com role hostil no pdf:\n${pdfAttack.roleHostil.html}`);
  assert.deepEqual(pdfAttack.roleSolto.roles, [], `solto com role hostil no pdf:\n${pdfAttack.roleSolto.html}`);
  assert.deepEqual(previewAttack.roleHostil.roles, [], 'cerca com role hostil na prévia');
  assert.ok(chat.roleHostil.html.includes('FALSO-BOTAO'), 'o desenho da cerca sumiu junto (não deveria: só o role sai)');
});
