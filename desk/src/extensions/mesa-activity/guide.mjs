/* Instruções das ferramentas de quadro do tutor — UM texto para os dois motores
   (extensão do Pi `mesa_criar_atividade`/`mesa_previsualizar_atividade` e
   `criar_atividade`/`previsualizar_atividade` do Claude): mudam juntas, e o
   teste `activity-tools.test.mjs` confere a paridade.

   Descrição e campos são SEMPRE em inglês; os resultados (`previewText`,
   `publishedText`) seguem como estavam, no idioma do tutor.

   As regras de layout e de tema foram adaptadas das guias do T3 Code
   (`HTML_RENDER_LAYOUT_GUIDE`/`HTML_RENDER_THEME_GUIDE` em
   pingdotgg/t3code, MIT, © T3 Tools Inc.) para o quadro offline da Mesa. Os
   nomes dos tokens e o tipo são os de `core/activityview.bend`. */

export const KINDS = ['visualizacao', 'atividade'];
export const THEMES = ['claro', 'escuro'];
export const LIBRARIES = Object.freeze({charts: 'Chart.js 4 (global window.Chart)', katex: 'KaTeX (window.katex.render)'});
export const TOKEN_NAMES = [
  '--mesa-bg', '--mesa-fg', '--mesa-muted', '--mesa-card', '--mesa-border', '--mesa-input', '--mesa-ring',
  '--mesa-accent', '--mesa-accent-fg', '--mesa-accent-text', '--mesa-good', '--mesa-good-surface', '--mesa-warn',
  '--mesa-warn-surface', '--mesa-bad', '--mesa-bad-surface', '--mesa-code-bg', '--mesa-code-fg', '--mesa-radius',
  '--mesa-font-sans', '--mesa-font-serif', '--mesa-font-mono',
];

const OFFLINE = 'The board is isolated and offline: no network, CDN, files, eval/new Function or workers — no <script src> or http(s) <img src>. charts:true embeds Chart.js 4 (window.Chart) and katex:true embeds KaTeX (window.katex.render(tex, element)); plain SVG or canvas works too.';

const LAYOUT = 'The board sits at the bottom of the column, aligned with the text, with no card, border or title; full screen only on hover. Leave html, body and the outer element without background, card, border or horizontal padding, with fluid width. A box with a background gets 16px padding and var(--mesa-radius) corners. Charts get a fixed height in px; never 100vh or height:100% on html or body: the board grows to its content (48 to 1200 px) and fixed heights make it grow.';

const TOKEN_SUMMARY = '--mesa-bg/fg/muted/card/border/input/ring, --mesa-accent, --mesa-accent-fg, --mesa-accent-text, --mesa-good/warn/bad (with -surface), --mesa-code-bg/fg, --mesa-radius, --mesa-font-sans/serif/mono';

const THEME = `Use the :root tokens (they follow the live theme and accent): ${TOKEN_SUMMARY}; --mesa-chart-1 … --mesa-chart-6 are the chart series in order (1 is the accent). MCP Apps names (--color-background-primary, --color-text-primary, --color-border-primary, --color-ring-primary, --font-sans…) also work. In Chart.js or canvas, read the color at draw time: getComputedStyle(document.documentElement).getPropertyValue("--mesa-chart-1").trim(). On theme or accent change the desk fires window "mesa-theme": recolor what is yours; the embedded Chart.js follows text, grid and font. Use a plain <table> and the base styles (buttons, fields, sliders, selects, tables, headings, paragraphs) without restyling; button.primary (or data-primary) highlights the action and button.ghost the quiet one.`;

const ORDER = 'Flow: build the board for the case, with units and checked calculations; preview it and fix console and print; publish with the returned previaId before writing the reply. The student already sees the board: do not announce it, say where it is or repeat it; add only what it does not say.';

const FIGURES = 'For a figure, prefer a visualization with the tokens over a generated PNG (accepted, on light paper).';

const CONTRACT = 'Contract: window.mesa.state(obj) saves state, attempt(obj) records an attempt, height(px) reports height, ready() confirms the mount and onMessage(fn) receives {type,payload,state,attempt} (init/theme/stop come from the host). Register onMessage before ready; on init restore controls from message.state and recompute. getState()/getAttempt() read local values; state() without an argument is not a getter. Call ready() in a visualization too.';

const PEDAGOGY = 'An activity has a clear question at the top, a prediction before seeing, manipulation with observation, and on confirm, the prediction beside the result and a conclusion. Without a question and a prediction it is just a toy: show it as a visualization or not at all. Record the attempt with attempt({pergunta, previsao, observado, conclusao, ...}), short readable keys in the language of this conversation, and simple values: "Levar ao tutor" becomes lines in the student\'s draft, and that is how you see what they thought. Local calculations verify; they are not your assessment.';

const FIELDS = 'In html, scripts do not run (the sanitizer removes them): keep code in the js field; no iframe/object/embed/srcdoc. Always send alternativeMarkdown with the complete textual description (formulas, steps and what to observe): it is the accessibility and fallback. html+css+js+texts fit in 64 KiB. To publish what was previewed, send previaId instead of html/css/js; without a preview, html/css/js still works.';

export const KIND_PARAM = 'visualizacao: chart, table, diagram or comparison, without student state (full screen only). atividade (default): exercise with state, which gains the "Levar ao tutor" line.';
export const CHARTS_PARAM = 'true loads the embedded Chart.js 4 (window.Chart), no network.';
export const KATEX_PARAM = 'true loads the embedded KaTeX (window.katex), no network.';
export const THEME_PARAM = 'Preview theme: "claro" (default) or "escuro".';
export const WIDTH_PARAM = 'Preview width in px, from 240 to 1600. Default: the reply text width in the tutor column; use ~390 to check narrow.';

/* Campos das duas ferramentas (`tool-fields.mjs` monta o zod do Claude e o
   TypeBox do Pi). O conteúdo é o mesmo; a prévia não exige os textos. */
const CONTENT_FIELDS = {
  html: {type: 'string', max: 51200, default: ''},
  css: {type: 'string', max: 32768, default: ''},
  js: {type: 'string', max: 32768, default: ''},
  katex: {type: 'boolean', default: false, description: KATEX_PARAM},
  charts: {type: 'boolean', default: false, description: CHARTS_PARAM},
  kind: {type: 'enum', values: KINDS, optional: true, description: KIND_PARAM},
};
export const CREATE_FIELDS = {
  title: {type: 'string', min: 1, max: 160, trim: true},
  objective: {type: 'string', min: 1, max: 300, trim: true},
  alternativeMarkdown: {type: 'string', min: 1, max: 8000, trim: true},
  ...CONTENT_FIELDS,
  activityId: {type: 'string', max: 64, optional: true},
  previaId: {type: 'string', max: 80, optional: true},
};
export const PREVIEW_FIELDS = {
  title: {type: 'string', max: 160, optional: true},
  objective: {type: 'string', max: 300, optional: true},
  alternativeMarkdown: {type: 'string', max: 8000, optional: true},
  ...CONTENT_FIELDS,
  theme: {type: 'enum', values: THEMES, optional: true, description: THEME_PARAM},
  width: {type: 'integer', min: 240, max: 1600, optional: true, description: WIDTH_PARAM},
};

/* O texto de `kind`, do tema e da largura vai só no campo (`*_FIELDS`), e o
   do quadro offline só na ferramenta de mostrar, que sempre anda junto da
   prévia: o modelo recebe as duas descrições em todo turno (#40). */
export const CREATE_DESCRIPTION = [
  'Show a board in the conversation: a visualization (chart, table, diagram, comparison) or an interactive activity (the student explores, predicts or tests), when it helps more than text.',
  ORDER,
  OFFLINE,
  LAYOUT,
  THEME,
  FIGURES,
  CONTRACT,
  PEDAGOGY,
  FIELDS,
].join(' ');

export const PREVIEW_DESCRIPTION = [
  'Preview of the board before showing it: the desk renders the same html/css/js in an invisible offline window, with the same isolation as the conversation board, and returns a PNG print, contentHeight (the height the content requests at that width) and the console messages — log, info, warning, error and exceptions, with the line. console.log is a good way to report your checks. Nothing is saved or shown in the conversation.',
  'The fields and board features are those of the show tool (here title, objective and alternativeMarkdown are optional), plus theme and width. The result carries previaId: publish it with criar_atividade and that id (without html/css/js) to show exactly what was previewed.',
].join(' ');

/* M4: a prévia guarda até 200 mensagens, mas só 50 voltam. Erros primeiro,
   depois avisos, depois o resto: o que quebra o quadro não pode ficar de fora
   enquanto um log irrelevante ocupa a cota. */
const CONSOLE_SHOWN = 50;
const CONSOLE_RANK = {error: 0, warning: 1};
function consolePreview(messages) {
  if (messages.length <= CONSOLE_SHOWN) return messages;
  return messages
    .map((message, index) => ({message, index}))
    .sort((a, b) => (CONSOLE_RANK[a.message.level] ?? 2) - (CONSOLE_RANK[b.message.level] ?? 2) || a.index - b.index)
    .slice(0, CONSOLE_SHOWN)
    .map((entry) => entry.message);
}

/* O texto que o tutor recebe de volta da prévia, junto do print. */
export function previewText(result) {
  const lines = [`Prévia em ${result.width}px (${result.theme}): o conteúdo pede ${result.contentHeight}px de altura.`];
  if (result.previaId) lines.push(`Para publicar, chame criar_atividade com previaId "${result.previaId}" no lugar de html/css/js.`);
  const messages = Array.isArray(result.consoleMessages) ? result.consoleMessages : [];
  if (!messages.length) lines.push('Console: nada.');
  else {
    lines.push(`Console (${messages.length}):`);
    for (const message of consolePreview(messages)) lines.push(`- [${message.level}] ${message.text}`);
    if (messages.length > CONSOLE_SHOWN) lines.push(`(mostrando ${CONSOLE_SHOWN} de ${messages.length} mensagens; as demais ficaram no console da prévia)`);
  }
  const errors = messages.filter((message) => message.level === 'error').length;
  lines.push(errors ? `Corrija os ${errors} erro(s) antes de mostrar.` : 'Sem erros no console.');
  return lines.join('\n');
}

/* O texto que o tutor recebe de volta ao mostrar um quadro — o mesmo nos dois
   motores. Leva o id e a versão (para revisar com activityId) e lembra que o
   aluno já vê o quadro. */
export function publishedText(result, kind) {
  const what = (result.view || kind) === 'visualizacao' ? 'Visualização' : 'Atividade';
  const revision = result.id ? ` Para revisar, repita a chamada com activityId "${result.id}".` : '';
  const warning = result.measureFailed ? ' Aviso: a Mesa não conseguiu medir o quadro; a altura pode demorar a assentar.' : '';
  return `${what} “${result.title}” mostrada na conversa (${result.id} v${result.version}). O aluno já a vê: não a anuncie nem a repita na resposta; não diga que ele respondeu ou que algo foi avaliado.${revision}${warning}`;
}
