/* Instruções das ferramentas de quadro do tutor — UM texto para os dois motores
   (extensão do Pi `mesa_criar_atividade`/`mesa_previsualizar_atividade` e
   `criar_atividade`/`previsualizar_atividade` do Claude): mudam juntas, e o
   teste `activity-tools.test.mjs` confere a paridade.

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

const OFFLINE = 'O quadro é isolado e offline: sem rede, CDN, arquivos, eval/new Function nem workers — nada de <script src> ou <img src> com http(s). Bibliotecas embutidas, servidas pela própria Mesa: charts:true carrega o Chart.js 4 (global window.Chart) e katex:true carrega o KaTeX (window.katex.render(tex, elemento)). Também dá para desenhar em SVG ou canvas puro.';

const LAYOUT = 'O quadro não tem cartão nem borda: fica no fundo da coluna do tutor, alinhado à esquerda com o texto da resposta, e só ganha um botão de tela cheia ao passar o mouse. Deixe html, body e o elemento de fora sem fundo, cartão, borda ou título de banner — o quadro é parte da resposta. Use largura fluida, sem padding horizontal no elemento de fora. Se uma caixa precisa de fundo próprio, dê a ela pelo menos 16px de respiro em todos os lados e cantos var(--mesa-radius). Dê ao gráfico uma altura fixa em px; nunca use 100vh nem height:100% em html ou body: o quadro cresce até o conteúdo (de 48 a 1200 px), e alturas presas ao quadro o fazem crescer de novo e de novo.';

const THEME = `Use os tokens, que a Mesa põe no :root e que seguem o tema e o acento ao vivo: ${TOKEN_NAMES.join(', ')} e a paleta categórica --mesa-chart-1 … --mesa-chart-6 (as séries de um gráfico, nessa ordem; a 1 é o acento). --mesa-bg é o fundo da coluna; --mesa-card, o de uma caixa que precisa se destacar. Os nomes padrão do MCP Apps (--color-background-primary, --color-text-primary, --color-border-primary, --color-ring-primary, --font-sans…) também valem. No Chart.js ou no canvas, leia a cor na hora: getComputedStyle(document.documentElement).getPropertyValue("--mesa-chart-1").trim(). Ao trocar o tema ou o acento a Mesa dispara o evento window "mesa-theme": recolora ali o que for seu (as séries); o Chart.js embutido já acompanha sozinho o texto, a grade e a fonte. Monte tabelas com <table> comum (innerHTML de tr/tbody funciona). O quadro já vem com estilo de base da Mesa (botões, campos, sliders, selects, tabelas, títulos e parágrafos): use as tags comuns sem estilizar tudo de novo; button.primary (ou data-primary) destaca a ação principal e button.ghost a discreta.`;

const ORDER = 'Fluxo: monte o quadro completo para o caso, com unidades e cálculos conferidos, rode a ferramenta de prévia e corrija os erros do console e o que o print mostrar; depois mostre — antes de escrever a resposta. O aluno já vê o quadro, então a resposta em texto não o anuncia, não diz onde ele está nem o repete: acrescente só o que ele não diz.';

const FIGURES = 'Para uma figura, prefira uma visualização com os tokens a uma imagem PNG gerada (que continua aceita e aparece sobre um papel claro).';

const CONTRACT = 'Contrato da Mesa no quadro: window.mesa.state(objeto) salva o estado, window.mesa.attempt(objeto) registra a tentativa do aluno, window.mesa.height(px) avisa a altura, window.mesa.ready() confirma a montagem e window.mesa.onMessage(fn) recebe {type,payload,state,attempt} (init/theme/stop são do host; state/attempt você envia). Registre onMessage antes de ready; ao receber init, restaure os controles a partir de message.state e recalcule. getState()/getAttempt() consultam os valores locais; não use state() sem argumento como getter. Chame window.mesa.ready() também numa visualização.';

const PEDAGOGY = 'Uma atividade tem começo, meio e fim: (1) uma PERGUNTA clara no topo; (2) o aluno PREVÊ antes de ver (um campo de previsão ou uma escolha); (3) ele MANIPULA e OBSERVA (sliders, gráfico, números ligados à equação); (4) ao confirmar, a atividade mostra a previsão ao lado do resultado e o que CONCLUIR. Sem pergunta e sem previsão é só um brinquedo: mostre como visualização ou não mostre. Registre a tentativa com window.mesa.attempt({pergunta, previsao, observado, conclusao, ...}) usando chaves curtas e legíveis, na língua desta conversa, e valores simples (números, textos curtos): o botão "Levar ao tutor" transforma esse objeto em linhas legíveis no rascunho do aluno, e é assim que você, tutor, vê o que ele pensou. Cálculos locais são verificação, não avaliação sua.';

const FIELDS = 'No html, scripts não executam (o sanitizador os remove): mantenha o código no campo js. O html é sanitizado (sem iframe/object/embed/srcdoc). Sempre envie alternativeMarkdown com a descrição textual completa (fórmulas, passos e o que observar): ela é a acessibilidade e o fallback. Para revisar um quadro já mostrado NESTA conversa, repita a chamada com o activityId dele (do resultado anterior): isso cria uma versão nova e imutável, preservando a anterior. O total html+css+js+textos cabe em 64 KiB. O campo callRef é preenchido pela Mesa; não use.';

export const KIND_PARAM = 'visualizacao: gráfico, tabela, diagrama ou comparação, sem estado do aluno (só tela cheia). atividade (padrão): exercício com estado, que ganha a linha "Levar ao tutor".';
export const CHARTS_PARAM = 'true carrega o Chart.js 4 embutido (window.Chart), sem rede.';
export const KATEX_PARAM = 'true carrega o KaTeX embutido (window.katex), sem rede.';
export const THEME_PARAM = 'Tema da prévia: "claro" (padrão) ou "escuro".';
export const WIDTH_PARAM = 'Largura da prévia em px, de 240 a 1600. Padrão: a do texto da resposta na coluna do tutor; use ~390 para conferir o estreito.';

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
  callRef: {type: 'string', max: 80, optional: true},
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
  'Mostre na conversa um quadro: uma visualização (gráfico, tabela, diagrama, comparação) ou uma atividade interativa (o aluno explora, manipula, prevê ou testa algo), quando isso ajudar mais que texto.',
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
  'Prévia do quadro, antes de mostrar: a Mesa monta o mesmo html/css/js numa janela invisível e offline, com o mesmo isolamento do quadro da conversa, e devolve um print PNG, contentHeight (a altura que o conteúdo pede nessa largura) e as mensagens do console — log, info, warning, error e exceções, com a linha. console.log é um bom jeito de relatar suas próprias checagens. Nada é gravado nem aparece na conversa.',
  'Os campos e os recursos do quadro são os da ferramenta de mostrar (aqui title, objective e alternativeMarkdown são opcionais), mais theme e width.',
].join(' ');

/* O texto que o tutor recebe de volta da prévia, junto do print. */
export function previewText(result) {
  const lines = [`Prévia em ${result.width}px (${result.theme}): o conteúdo pede ${result.contentHeight}px de altura.`];
  const messages = Array.isArray(result.consoleMessages) ? result.consoleMessages : [];
  if (!messages.length) lines.push('Console: nada.');
  else {
    lines.push(`Console (${messages.length}):`);
    for (const message of messages.slice(0, 50)) lines.push(`- [${message.level}] ${message.text}`);
  }
  const errors = messages.filter((message) => message.level === 'error').length;
  lines.push(errors ? `Corrija os ${errors} erro(s) antes de mostrar.` : 'Sem erros no console.');
  return lines.join('\n');
}

/* O texto que o tutor recebe de volta ao mostrar um quadro — o mesmo nos dois
   motores. Leva o id e a versão (para revisar com activityId) e lembra que o
   aluno já vê o quadro. */
export function publishedText(result, kind) {
  const what = kind === 'visualizacao' ? 'Visualização' : 'Atividade';
  return `${what} “${result.title}” mostrada na conversa (${result.id} v${result.version}). O aluno já a vê: não a anuncie nem a repita na resposta; não diga que ele respondeu ou que algo foi avaliado.`;
}
