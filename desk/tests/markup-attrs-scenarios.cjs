'use strict';

/* Cenários Electron da faixa dos atributos do modelo (#seg-markup), chamados
   por `free-pdf-runner.cjs` (`markup-attrs`). O `markup` do chat precisa de um
   DOM de verdade (DOMPurify + KaTeX), então roda numa janela escondida que
   importa `markdown.mjs` e o `template.mjs` do PDF; o mesmo corpo de ataque
   passa pelos dois. Tudo inventado; domínio de teste (`exemplo.com`). */

const path = require('node:path');
const {pathToFileURL} = require('node:url');

const DESK = path.resolve(__dirname, '..');
const url = (relative) => pathToFileURL(path.join(DESK, relative)).href;

/* Roda `body` na página de teste: `body` recebe `{markup, markupInline,
   renderMaterialHtml}` e devolve JSON. */
async function inPage(electron, body) {
  const win = new electron.BrowserWindow({show: false, webPreferences: {sandbox: true, contextIsolation: true}});
  try {
    await win.loadFile(path.join(__dirname, 'markup-attrs-page.html'));
    return await win.webContents.executeJavaScript(`(async () => {
      const {markup, markupInline} = await import(${JSON.stringify(url('src/markdown.mjs'))});
      const {renderMaterialHtml} = await import(${JSON.stringify(url('src/materials/template.mjs'))});
      const inspect = (html) => {
        const root = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html').body;
        /* O asterisco não desce no conteúdo de template aninhado: recolhe de
           lá também (até o fundo), senão um id escondido passa batido. */
        const all = [...root.querySelectorAll('*')];
        for (let at = 0; at < all.length; at++) {
          const tpl = all[at];
          if (tpl.localName === 'template' && tpl.content) for (const node of tpl.content.querySelectorAll('*')) {
            if (!all.includes(node)) all.push(node);
          }
        }
        const attrNames = (node) => [...node.attributes].map((attribute) => attribute.name.toLowerCase());
        const isSafeUrl = (value) => {
          const text = String(value || '').trim();
          return text.startsWith('#') || /^https:/i.test(text.replace(/^[\\x00-\\x20]+/, '').replace(/[\\t\\n\\r]/g, '')) || /^data:image\\//i.test(text);
        };
        return {
          html,
          ids: all.filter((node) => node.hasAttribute('id')).map((node) => node.localName + '#' + node.getAttribute('id')),
          names: all.filter((node) => node.hasAttribute('name')).map((node) => node.localName + '[name=' + node.getAttribute('name') + ']'),
          styles: all.filter((node) => node.hasAttribute('style')).map((node) => node.localName + '[style=' + node.getAttribute('style') + ']'),
          classes: all.filter((node) => node.hasAttribute('class')).map((node) => node.localName + '.' + [...node.classList].join('.')),
          modelData: all.flatMap((node) => [...node.attributes].map((attribute) => attribute.name)
            .filter((name) => ['data-tex', 'data-asset', 'data-caption', 'data-activity-call', 'data-action'].includes(name))
            .map((name) => node.localName + '@' + name)),
          events: all.flatMap((node) => [...node.attributes].map((attribute) => attribute.name).filter((name) => /^on/i.test(name))),
          /* "for" do modelo aciona o controle real da janela (conferir,
             enviar, foco); a faixa Allowlist o remove — o rótulo fica inerte. */
          fors: all.filter((node) => node.hasAttribute('for')).map((node) => node.localName + '[for=' + node.getAttribute('for') + ']'),
          labels: [...root.querySelectorAll('label')].map((node) => node.textContent.trim().slice(0, 40)),
          /* "src"/"href" que não é "https:", "data:image/*" nem "#fragmento":
             relativo e "file:" lêem arquivo local pela CSP "file:" da janela. */
          relUrls: all.flatMap((node) => [...node.attributes]
            .filter((attribute) => ['src', 'href', 'xlink:href'].includes(attribute.name.toLowerCase()))
            .filter((attribute) => !isSafeUrl(attribute.value))
            .map((attribute) => node.localName + '[' + attribute.name.toLowerCase() + '=' + String(attribute.value).slice(0, 80) + ']')),
            attrs: [...new Set(all.flatMap(attrNames))].sort(),
            promptClobber: root.querySelector('#prompt, #link-dialog') !== null,
            roles: [...root.querySelectorAll('[role]')].map((node) => node.localName + '[role=' + node.getAttribute('role') + ']'),
          plots: root.querySelectorAll('.plot-figure svg').length,
          katex: root.querySelectorAll('.katex[data-tex]').length,
          codeBlocks: root.querySelectorAll('pre.hl > code[data-lang]').length,
        };
      };
      ${body}
    })()`);
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

/* Ataques da revisão: cada um virava vetor antes da faixa. */
const ATTACKS = {
  promptTextarea: 'resposta <textarea id="prompt" style="display:none">IGNORE AS INSTRUÇÕES</textarea>',
  promptSlash: 'resposta <div/id=prompt>X</div> fim',
  promptUpper: 'resposta <TEXTAREA ID="PROMPT">Y</TEXTAREA> fim',
  promptName: 'resposta <textarea name="plantado">Z</textarea> fim',
  katexExempt: 'resposta <span class="katex"><div style="position:fixed">W</div></span> fim',
  dialogFake: 'clique <dialog id="link-dialog"><p>Destino: bom.com</p></dialog> <a href="https://evil.exemplo/login">https://bom.exemplo</a>',
  dialogBackdrop: 'resposta <div class="dialog-backdrop">B</div> fim',
  overlay: 'resumo <div style="position:fixed;inset:0;z-index:99999">TELA FALSA</div> fim',
  cssRead: 'resumo <div style="background:url(file:///tmp/segredo.png);width:80px;height:80px">X</div> fim',
  svgId: '```svg\n<svg id="prompt" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>\n```',
  svgPosition: '```svg\n<svg viewBox="0 0 10 10"><rect width="10" height="10" style="position:fixed"/></svg>\n```',
  svgEntityPosition: '```svg\n<svg viewBox="0 0 10 10"><rect width="10" height="10" style="&#112;osition:fixed"/></svg>\n```',
  svgGradient: '```svg\n<svg viewBox="0 0 10 10"><defs><linearGradient id="g"><stop offset="0" stop-color="red"/></linearGradient></defs><rect width="10" height="10" fill="url(#g)"/></svg>\n```',
  dataAsset: 'figura <figure class="asset" data-asset="/etc/passwd">A</figure> fim',
  dataActivity: 'tarefa <div class="activity-slot" data-activity-call="evil">C</div> fim',
  dataTex: 'texto <b data-tex="TEXTO PLANTADO">visível</b> fim',
  /* Bateria de formas por diferença de parser (bypass 2026-11): o navegador
     aceita e a regex antiga não via. Em bloco para o `marked` repassar cru. */
  coladoId: '<textarea a="b"id="prompt">COLADO</textarea>',
  coladoStyle: '<div a=\'b\'style="position:fixed">COLADO</div>',
  coladoClass: '<div a="b"class="dialog-backdrop">COLADO</div>',
  coladoName: '<div a="b"name="plantado">COLADO</div>',
  coladoDataTex: '<b a="c"data-tex="FALSO">COLADO</b>',
  aspaSolta: '<textarea x=a" id="prompt">SOLTA</textarea>\n\nfim',
  tabId: '<div\tid="prompt">TAB</div>',
  ffId: '<div\fid="prompt">FF</div>',
  crId: '<div\rid="prompt">CR</div>',
  maiuscStyle: '<TEXTAREA ID="PROMPT" STYLE="position:fixed">MAIUSC</TEXTAREA>',
  gtValor: '<div title="a>b" id="prompt">GT</div>',
  semFim: '<textarea id="prompt">texto sem fechar',
  semFecharEof: '<div id="prompt"',
  emTabela: '<table><tr><td><div id="prompt">TAB</div></td></tr></table>',
  emLista: '<ul><li><div id="prompt">LISTA</div></li></ul>',
  emDetails: '<details><summary>S</summary><div id="prompt" style="color:red">DET</div></details>',
  svgInline: '<svg viewBox="0 0 10 10"><rect id="prompt" style="position:fixed" width="1" height="1"/></svg>',
  mathInline: '<math><mi id="prompt">M</mi></math>',
  templateNid: '<template><div id="prompt" class="x">TPL</div></template>',
  condComment: '<![if x]><div id="prompt">COND</div><![endif]>',
  noscriptNid: '<noscript><div id="prompt">NOSCRIPT</div></noscript>',
  cdataNid: '<![CDATA[<div id="prompt">x</div>]]>',
  duplicado: '<div id="a" id="prompt">DUP</div>',
  semValorId: '<div id>SEMVALOR</div>',
  semValorStyle: '<div style>SEMVALOR</div>',
  entidadeNome: '<div &#105;d="prompt">ENT</div>',
  tagColadaAspas: '<div"id"="prompt">COLADA</div>',
  inlineColado: 'resposta <textarea a="b"id="prompt">X</textarea> fim',
  inlineSolta: 'resposta <textarea x=a" id="prompt">X</textarea> fim',
  /* Achados confirmados em janela (#seg-markup): `label for` aciona o controle
     real (conferir captura o Xournal++, enviar manda o rascunho); URL relativa
     em `src`/`href` (e em `background`/`poster`) lê `file:///tmp/…` pela CSP;
     a cerca escapa do prefixo quando o `id` cola na aspa e `class` vira overlay. */
  labelFor: [
    'A <label for="send">CLIQUE-ENVIAR</label> fim.',
    'B <label for="check">CLIQUE-CONFERIR</label> fim.',
    'C <label for="prompt">CLIQUE-PROMPT</label> fim.',
    'D <label for="stop">CLIQUE-PARAR</label> fim.',
    'E <label for="dialog-ok">CLIQUE-OK</label> fim.',
  ].join('\n\n'),
  relImg: 'IMG <img src="../../../../../../../tmp/mesa-review/marker.png" alt="REL-IMG" width="8" height="8"> fim',
  relLink: 'LINK <a href="../../../../../../../tmp/mesa-review/marker.png">REL-LINK</a> fim',
  relMedia: [
    '<table background="../../../../../../../tmp/mesa-review/marker.png"><tr><td>REL-TABELA</td></tr></table>',
    '<video poster="../../../../../../../tmp/mesa-review/marker.png" width="8" height="8"></video>',
    '<audio src="../../../../../../../tmp/mesa-review/marker.png"></audio>',
    '<video width="8" height="8"><source src="../../../../../../../tmp/mesa-review/marker.png" type="image/png"></video>',
  ].join('\n\n'),
  staleAttrs: '<div for="send" form="f" popover="manual" tabindex="1" accesskey="b" slot="s" is="x" inert hidden aria-label="w" aria-hidden="false" data-q="1" data-tex="FALSO" background="https://evil.exemplo/bg.png" poster="https://evil.exemplo/p.png" target="_blank" rel="opener" srcset="https://evil.exemplo/a.png 1x" ping="https://evil.exemplo/p">ATRIBUTOS</div>',
  svgColadoId: '```svg\n<svg viewBox="0 0 10 10"><rect x="a"id="prompt" width="10" height="10" fill="red"/></svg>\n```\n\n```svg\n<svg viewBox="0 0 10 10"><rect x="b"id="link-dialog" width="10" height="10"/></svg>\n```',
  svgClass: '```svg\n<svg class="palette-backdrop" viewBox="0 0 100 30"><text x="10" y="20" fill="black">SESSAO</text></svg>\n```',
  svgName: '```svg\n<svg viewBox="0 0 10 10"><rect name="plantado" width="10" height="10"/></svg>\n```',
  svgImageSet: [
    '```svg',
    '<svg viewBox="0 0 10 10" style=\'background-image:image-set("file:///tmp/mesa-review/marker.png" 1x)\'><rect width="10" height="10"/></svg>',
    '```',
    '',
    '```svg',
    '<svg viewBox="0 0 10 10" style=\'background-image:-webkit-image-set("file:///tmp/mesa-review/marker.png" 1x)\'><rect width="10" height="10"/></svg>',
    '```',
    '',
    '```svg',
    '<svg viewBox="0 0 10 10" style=\'background-image:image("file:///tmp/mesa-review/marker.png")\'><rect width="10" height="10"/></svg>',
    '```',
  ].join('\n'),
  printPosition: '<div style="position:fixed;inset:0;z-index:99999;background:#fff">TELA FALSA PDF</div>',
  /* Cercas hostis da rodada (item 1/2): irmão HTML, comentário abrupto,
     `--!>`, CDATA, `foreignObject`, `</svg>` duplo, texto solto e `<svg>`
     aninhado. Todas viram código, sem overlay nem `for` ativo. */
  fenceIrmao: '```svg\n<svg></svg><div class="palette-backdrop"><label for="send">CLIQUE</label></div></svg>\n```',
  fenceAbrupto: '```svg\n<svg viewBox="0 0 10 10"><!--><div><textarea id="prompt">PLANTADO-ABRUPTO</textarea></div></svg>\n```',
  fenceBang: '```svg\n<svg viewBox="0 0 10 10"><!-- --!><div><textarea id="prompt">PLANTADO-BANG</textarea></div></svg>\n```',
  fenceCdata: '```svg\n<svg viewBox="0 0 10 10"></svg><![CDATA[x><div><textarea id="prompt">PLANTADO-CDATA</textarea></div>]]></svg>\n```',
  fenceForeign: '```svg\n<svg viewBox="0 0 10 10"><foreignObject><div><label for="send">CLIQUE-ENV</label></div></foreignObject></svg>\n```',
  fenceDuplo: '```svg\n<svg viewBox="0 0 10 10"><rect width="1" height="1"/></svg></svg>\n```',
  fenceTexto: '```svg\ntexto solto <svg viewBox="0 0 10 10"><rect width="1" height="1"/></svg>\n```',
  fenceAninhado: '```svg\n<svg viewBox="0 0 10 10"><svg viewBox="0 0 5 5"><rect width="1" height="1"/></svg></svg>\n```',
  fenceEscapeCss: '```svg\n<svg viewBox="0 0 10 10"><rect width="10" height="10" style="\\70 osition:fixed;top:0;left:0;width:100vw;height:100vh"/></svg>\n```',
  fenceComentCss: '```svg\n<svg viewBox="0 0 10 10"><rect width="10" height="10" style="position/**/:fixed;top:0;left:0;width:100vw;height:100vh"/></svg>\n```',
  /* `label for` nos quatro alvos (item 7): nenhum ativa controle real. */
  labelQuatro: [
    '<label for="send">L-SEND</label>',
    '<label for="check">L-CHECK</label>',
    '<label for="dialog-ok">L-OK</label>',
    '<label for="free-pdf-save">L-SAVE</label>',
  ].join(' '),
  /* Impresso que esconde (item 4): nada disso passa na allowlist. */
  printHide: '<div style="display:none">SEGREDO-DISPLAY</div><div style="opacity:0">SEGREDO-OPACO</div><div style="visibility:hidden">SEGREDO-VIS</div><div style="position:fixed">SEGREDO-POS</div><div style="transform:translateX(9999px)">SEGREDO-TRANS</div><div style="float:left;width:9999px">SEGREDO-FLOAT</div><div style="margin-left:-9999px">SEGREDO-MARGEM</div><div style="font-size:0">SEGREDO-FONTE</div><div style="color:#fff">SEGREDO-BRANCO</div><div style="clip-path:inset(0 0 100% 0)">SEGREDO-CLIP</div><div style="overflow:hidden;height:0">SEGREDO-OVER</div>',
  /* Quarta contraprova — texto escondido só no impresso: `color` e
     `background-color` saíram da allowlist, então o `style` some inteiro e o
     texto fica visível como na prévia. */
  printColorAlpha: '<p><span style="color:rgba(0,0,0,0)">SUMIDO-RGBA</span> visível.</p><p><span style="color:hsl(0 0% 0% / 0)">SUMIDO-HSL</span> visível.</p><p><span style="background-color:#ffffff;color:#fefefe">SUMIDO-PAR</span> visível.</p>',
  /* Quarta contraprova — o restante da allowlist não esconde: `vertical-align`
     com valor gigante só abre espaço (a caixa de linha cresce junto), e
     `font-weight`/`text-decoration` não tiram texto da página. */
  printVertDeco: '<p><span style="vertical-align:9999px">DESLOCADO-VERT</span> visível.</p><p><span style="text-decoration:underline;font-weight:700">MARCADO-DECO</span> visível.</p>',
  /* Quarta contraprova — classe do modelo no impresso: o `scrubModelTokens`
     tira `class` e `--ans` antes da estrutura da casa, então nada casa com o
     CSS do template (nem `pdf-resposta` + `--ans`, nem `pdf-run` com
     `display:none` no impresso, nem `pdf-title` com `display:none` na lista). */
  respFakeClass: '<div class="pdf-resposta" style="--ans:200mm">RESPOSTA-FORJADA</div>',
  runFakeClass: '<div class="pdf-run">CORRIDA-FORJADA</div>',
  titleFakeClass: '<h1 class="pdf-title">TITULO-FORJADO</h1>',
  /* Quarta contraprova — `role` hostil no SVG (cerca, solto e impresso): só
     `img`, apresentação e `graphics-*` passam; `aria-label` continua. */
  roleHostil: '```svg\n<svg viewBox="0 0 100 30" role="button" aria-label="Clique para enviar"><text y="12">FALSO-BOTAO</text></svg>\n```',
  roleSolto: 'solto <svg viewBox="0 0 100 30" role="alert" aria-label="Nota 10"><text y="12">FALSO-ALERTA</text></svg> fim',
  /* Variável do modelo no impresso (rodada 2026-11): `--*` redefinia a cor
     do link, do título, da citação, do `th` e do `pre` só no PDF — o texto
     que a prévia mostrava sumia no papel. Só `--ans` sobrevive, validado. */
  varLink: '<a href="https://exemplo.com/guia" style="--accent-paper:#fff">LINK-ESCONDIDO-PDF</a>',
  varTitle: '<h2 style="--ink-soft:#fff">TITULO-ESCONDIDO-PDF</h2>',
  varQuote: '<blockquote style="--muted:#fff">CITACAO-ESCONDIDA-PDF</blockquote>',
  varTh: '<table><tr><th style="--panel:#000">CABECALHO-ESCONDIDO-PDF</th><th>VISIVEL</th></tr></table>',
  varPre: '<pre style="--panel:#000"><code>CODIGO-ESCONDIDO-PDF</code></pre>',
  varAnsAttack: '<div style="--ans:9999mm">RESPOSTA-ESTICADA</div>',
  /* Imagem gigante (item 6): o atributo sai e o CSS limita. */
  imgGigante: '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" width="20000" height="20000" alt="GIGANTE">',
};

/* Corpo honesto: fórmula, código, tabela, plot e SVG precisam sair iguais. */
const HONEST = [
  '# Revisão',
  '',
  'A derivada de $f(x)=x^2$ é $f\'(x)=2x$ e a integral',
  '',
  '$$\\int_0^1 x^2\\,dx=\\frac{1}{3}$$',
  '',
  '```js',
  'const passo = (x) => x * x + 1;',
  '```',
  '',
  '| x | f(x) |',
  '| --- | --- |',
  '| 0 | 0 |',
  '| 1 | 2 |',
  '',
  '```plot',
  'x: -2..2',
  'funcao: x^2',
  '```',
  '',
  '```svg',
  '<svg viewBox="0 0 10 10"><defs><linearGradient id="g"><stop offset="0" stop-color="red"/></linearGradient></defs><rect width="10" height="10" fill="url(#g)"/></svg>',
  '```',
  '',
 '<details><summary>Dica</summary><p>derive termo a termo</p></details>',
 '',
 '<details open><summary>Lembrete</summary><p>revise os sinais</p></details>',
 '',
 '> Citação honesta da aula, com continuação.',
 '>',
 '> Segundo parágrafo citado.',
 '',
 '- item um da lista',
 '- item dois da lista',
 '',
 '![foto](./foto.png)',
 '',
 '![remota](https://exemplo.com/foto.png)',
 '',
 '<table><tr><td colspan="2">ampla</td></tr></table>',
 '',
 'H<sub>2</sub>O, x<sup>2</sup>, <kbd>Ctrl</kbd>, <mark>importante</mark>,',
 'veja o [guia](https://exemplo.com/guia).',
 '',
].join('\n');

async function scenarioMarkupAttrs({electron}) {
  const data = await inPage(electron, `
    const chat = {};
    ${Object.keys(ATTACKS).map((key) => `chat[${JSON.stringify(key)}] = inspect(markup(${JSON.stringify(ATTACKS[key])}, true));`).join('\n    ')}
    const honest = inspect(markup(${JSON.stringify(HONEST)}, true));
    const pdfHonest = renderMaterialHtml({markdown: ${JSON.stringify(HONEST)}});
    const pdfAttack = {};
    ${Object.keys(ATTACKS).map((key) => `pdfAttack[${JSON.stringify(key)}] = inspect(renderMaterialHtml({markdown: ${JSON.stringify(ATTACKS[key])}}).html);`).join('\n    ')}
    /* Prévia viva do Livre: o mesmo renderMaterialHtml, mas com a faixa do
       chat ligada ("preview:true", "id"/"class" sob prefixo) antes de entrar
       no DOM da janela principal. */
    const previewHonest = inspect(renderMaterialHtml({markdown: ${JSON.stringify(HONEST)}, preview: true}).html);
    const previewAttack = {};
    ${Object.keys(ATTACKS).map((key) => `previewAttack[${JSON.stringify(key)}] = inspect(renderMaterialHtml({markdown: ${JSON.stringify(ATTACKS[key])}, preview: true}).html);`).join('\n    ')}
    const inlineAttack = markupInline('opção <b id="prompt">texto</b> fim');
    /* "--ans" do simulado (rodada 2026-11): o do template ("--ans:36mm",
       médio sem longa) sobrevive validado; o do modelo ("--ans:9999mm",
       41 páginas) some. Medido pelo CSSOM da janela, não por regex. */
    const simuladoHonest = renderMaterialHtml({title: 'S', markdown: '## Questão 1 (2,0)\\n\\nEnunciado curto.\\n\\n## Gabarito\\n\\nR.', model: 'simulado'});
    const simuladoAttack = renderMaterialHtml({title: 'S', markdown: '## Questão 1 (2,0)\\n\\nEnunciado curto.\\n\\n<div style="--ans:9999mm">\\n\\nTexto.\\n\\n## Gabarito\\n\\nR.', model: 'simulado'});
    const ansStyles = (html) => {
      const found = [];
      const root = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html').body;
      for (const node of root.querySelectorAll('[style]')) found.push(node.getAttribute('style'));
      return found;
    };
    return {
      ok: true,
      chat,
      honest,
      pdfHonest: inspect(pdfHonest.html),
      pdfAttack,
      previewHonest: inspect(renderMaterialHtml({markdown: ${JSON.stringify(HONEST)}, preview: true}).html),
      previewAttack,
      inlineAttack,
      printVars: {
        honest: ansStyles(simuladoHonest.html),
        attack: ansStyles(simuladoAttack.html),
      },
      inlinePromptClobber: new DOMParser().parseFromString('<body>' + inlineAttack + '</body>', 'text/html').body.querySelector('#prompt') !== null,
    };
  `);
  return data;
}

function runMarkupAttrsScenario(name, context) {
  if (name === 'markup-attrs') return scenarioMarkupAttrs(context);
  return {ok: false, error: {code: 'BAD_SCENARIO', message: `cenário desconhecido: ${name}`}};
}

module.exports = {runMarkupAttrsScenario, ATTACKS};
