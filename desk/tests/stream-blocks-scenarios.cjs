'use strict';

/* Cenário Electron da equivalência do stream incremental: para cada prefixo
   do corpus, o HTML pintado pelo caminho incremental tem de ser idêntico ao
   do desenho vivo de uma vez (`paintMessageBody` com `live=true` num corpo
   novo). O vivo se compara com o vivo porque a fórmula aberta é linha quieta
   no vivo e texto cru no final (D3 da rodada 5). Precisa de DOM de verdade por
   causa do DOMPurify/KaTeX; roda numa janela escondida. */

const path = require('node:path');
const {pathToFileURL} = require('node:url');

const DESK = path.resolve(__dirname, '..');
const url = (relative) => pathToFileURL(path.join(DESK, relative)).href;

async function scenarioStreamBlocks({electron}) {
  const win = new electron.BrowserWindow({show: false, webPreferences: {sandbox: true, contextIsolation: true}});
  try {
    await win.loadFile(path.join(__dirname, 'figures-page.html'));
    return await win.webContents.executeJavaScript(`(async () => {
      const {paintMessageBody, resetStreamPaintStats, streamPaintStats} = await import(${JSON.stringify(url('src/chat-stream-view.mjs'))});
      const {STREAM_BLOCKS_FIXTURES} = await import(${JSON.stringify(url('tests/stream-blocks-fixtures.mjs'))});
      const compare = (text) => {
        const inc = document.createElement('div');
        const failures = [];
        for (let i = 0; i <= text.length; i += 1) {
          const prefix = text.slice(0, i);
          paintMessageBody(inc, prefix, [], true);
          /* Referência: um desenho vivo novo para o mesmo prefixo (a fórmula
             aberta vira linha quieta no vivo e texto cru no final — D3 da
             rodada 5 — então o vivo se compara com o vivo). */
          const ref = document.createElement('div');
          paintMessageBody(ref, prefix, [], true);
          if (inc.innerHTML !== ref.innerHTML) {
            failures.push({at: i, prefix: JSON.stringify(prefix.slice(-40)), expected: ref.innerHTML.slice(0, 600), got: inc.innerHTML.slice(0, 600)});
            break;
          }
        }
        const before = inc.innerHTML;
        paintMessageBody(inc, text, [], false);
        const after = inc.innerHTML;
        return {
          failures,
          finalSame: before === after,
          unsafe: /<script|\son\w+=/i.test(inc.innerHTML),
        };
      };
      const out = {ok: true, cases: {}};
      for (const fixture of STREAM_BLOCKS_FIXTURES) out.cases[fixture.name] = compare(fixture.text);

      /* Propriedade com cortes aleatórios semeados: o mesmo documento misto,
         prefixos sorteados (em ordem crescente, como o stream). */
      let seed = 20261104;
      const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
      const blocks = [
        '# Passo',
        'Parágrafo com $x^2$ e **negrito**.',
        '- item um\\n- item dois\\n- item três',
        '\`\`\`js\\nconst x = 1;\\n\`\`\`',
        '$$\\\\int_0^1 x^2\\\\,dx=\\\\frac{1}{3}$$',
        '| a | b |\\n| - | - |\\n| 1 | 2 |',
        '> citação\\n> em duas linhas',
      ];
      const doc = Array.from({length: 14}, (_, i) => { const block = blocks[Math.floor(random() * blocks.length)]; return block.startsWith('\`\`\`') ? block : block + ' ' + i; }).join('\\n\\n') + '\\n';
      const cuts = Array.from({length: 120}, () => Math.floor(random() * (doc.length + 1))).sort((a, b) => a - b);
      const randomInc = document.createElement('div');
      const randomFailures = [];
      for (const at of cuts) {
        const prefix = doc.slice(0, at);
        paintMessageBody(randomInc, prefix, [], true);
        const randomRef = document.createElement('div');
        paintMessageBody(randomRef, prefix, [], true);
        if (randomInc.innerHTML !== randomRef.innerHTML) { randomFailures.push({at, expected: randomRef.innerHTML.slice(0, 400), got: randomInc.innerHTML.slice(0, 400)}); break; }
      }
      out.random = {cuts: cuts.length, failures: randomFailures};

      /* Regressão de trabalho: 40 parágrafos, um prefixo a cada 25 caracteres.
         O incremental não pode reparar mais que poucos blocos por repintura. */
      const long = Array.from({length: 40}, (_, i) => 'Parágrafo ' + i + ': texto com $x^2$ e **negrito**.').join('\\n\\n') + '\\n';
      const body = document.createElement('div');
      resetStreamPaintStats();
      const step = Math.max(1, Math.ceil(long.length / 80));
      for (let i = 0; i < long.length; i += step) paintMessageBody(body, long.slice(0, i), [], true);
      paintMessageBody(body, long, [], true);
      out.long = {stats: streamPaintStats(), text: body.textContent.length};

      /* O texto vivo pode mudar no começo (o motor corrige o bloco, o
         displayUserText passa a esconder um trecho): o prefixo guardado não vale. */
      const rewrite = (first, second) => {
        const inc = document.createElement('div');
        const ref = document.createElement('div');
        paintMessageBody(inc, first, [], true);
        paintMessageBody(inc, second, [], true);
        paintMessageBody(ref, second, [], true);
        return inc.innerHTML === ref.innerHTML;
      };
      out.rewrite = {
        reusable: rewrite('Alfa um.\\n\\nBeta dois.\\n\\nGama', 'Alfo um.\\n\\nBeta dois.\\n\\nGama três'),
        openMath: rewrite('Alfa um.\\n\\nBeta dois.\\n\\nGama', 'Alfo um.\\n\\nBeta dois.\\n\\n$$x+1'),
      };

      /* Fórmula cortada no meio (auditoria rodada 5, D3): a resposta chega em
         pedaços; com o delimitador aberto o vivo mostra a linha quieta (sem a
         fonte crua), fechou renderiza, e o desenho final do turno cortado
         mostra o texto como está. Preço ("custa $5 e $6") nunca é fórmula. */
      const formula = 'Veja:\\n\\n$$\\\\int_0^1 x^{2}\\\\,dx=\\\\frac{1}{3}$$\\n\\nPronto.\\n';
      const formulaBody = document.createElement('div');
      const chunks = [];
      for (let i = 0; i < formula.length; i += 7) {
        const prefix = formula.slice(0, i);
        paintMessageBody(formulaBody, prefix, [], true);
        chunks.push({at: i, pending: formulaBody.querySelector('.math-pending') !== null, raw: (formulaBody.textContent || '').includes('$$'), katex: formulaBody.querySelector('.katex') !== null});
      }
      paintMessageBody(formulaBody, formula, [], true);
      const closedLive = {pending: formulaBody.querySelector('.math-pending') !== null, katex: formulaBody.querySelector('.katex') !== null};
      const cut = formula.slice(0, formula.indexOf('\\\\frac'));
      const cutLive = document.createElement('div');
      paintMessageBody(cutLive, cut, [], true);
      const cutFinal = document.createElement('div');
      paintMessageBody(cutFinal, cut, [], false);
      const price = document.createElement('div');
      paintMessageBody(price, 'custa $5 e $6', [], true);
      const priceFinal = document.createElement('div');
      paintMessageBody(priceFinal, 'custa $5 e $6', [], false);
      const singleCut = document.createElement('div');
      paintMessageBody(singleCut, 'a fórmula $x+y', [], true);
      out.formula = {
        chunks,
        closedLive,
        cutLive: {pending: cutLive.querySelector('.math-pending') !== null, raw: (cutLive.textContent || '').includes('$$')},
        cutFinal: {raw: (cutFinal.textContent || '').includes('\\\\int'), kept: (cutFinal.textContent || '').includes('dx=')},
        price: {pending: price.querySelector('.math-pending') !== null, same: price.innerHTML === priceFinal.innerHTML, text: price.textContent || '', finalText: priceFinal.textContent || ''},
        singleCut: {pending: singleCut.querySelector('.math-pending') !== null, raw: (singleCut.textContent || '').includes('$x')},
      };
      return out;
    })()`);
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

module.exports = {runStreamBlocksScenario: scenarioStreamBlocks};
