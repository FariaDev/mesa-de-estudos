'use strict';

/* PROVA — texto perdido no stream vivo (auditoria rodada 5, D3): `markupLive`
   cortava em `range.start` e jogava fora TUDO que vem depois, mas o contrato
   de `openMathRange` para o `$` solto é que a fórmula candidata só vai "até
   a quebra de linha" (o próprio teste puro diz: "o resto continua texto", e
   devolve `end` = fim da linha). `end` não era usado por ninguém — o resto
   sumia da tela enquanto o turno corria, e só voltava no desenho final.

   Também mede o falso positivo em código: `$`/`\(` dentro de cerca ou crase
   vira "fórmula em chegada" e engole o resto da mensagem no vivo. Preço
   ("custa $5 e $6") nunca é fórmula, no vivo nem no final.

   Roda: DISPLAY=:0 desk/node_modules/.bin/electron desk/tests/markup-live-loss-scenarios.cjs
   Sai com __RESULT__ JSON; as asserções ficam em markup-live-loss.test.mjs. */
const {app, BrowserWindow} = require('electron');
const path = require('node:path');
const {pathToFileURL} = require('node:url');

const DESK = path.resolve(__dirname, '..');
const url = (relative) => pathToFileURL(path.join(DESK, relative)).href;

app.on('window-all-closed', () => {});

app.whenReady().then(async () => {
  const win = new BrowserWindow({show: false, webPreferences: {sandbox: true, contextIsolation: true}});
  await win.loadFile(path.join(DESK, 'tests', 'figures-page.html'));
  const data = await win.webContents.executeJavaScript(`(async () => {
    const {markupLive, markup} = await import(${JSON.stringify(url('src/markdown.mjs'))});
    const {openMathRange} = await import(${JSON.stringify(url('src/stream-blocks.mjs'))});
    const textOf = (html) => {
      const root = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html').body;
      return {text: root.textContent || '', pending: root.querySelector('.math-pending') !== null};
    };
    const measure = (text) => {
      const live = textOf(markupLive(text, true));
      return {range: openMathRange(text), text: live.text, pending: live.pending};
    };
    const measureFinal = (text) => textOf(markup(text, true)).text;
    return {
      dollarLine: measure('a $x+y\\n\\npróximo parágrafo continua\\n'),
      dollarLineFinal: measureFinal('a $x+y\\n\\npróximo parágrafo continua\\n'),
      codeDollar: measure('use \`echo $HOME\` no terminal\\ne mais texto aqui\\n'),
      codeDollarFinal: measureFinal('use \`echo $HOME\` no terminal\\ne mais texto aqui\\n'),
      codeParen: measure('rode \`grep \\\\( arquivo\` e siga\\n'),
      codeParenFinal: measureFinal('rode \`grep \\\\( arquivo\` e siga\\n'),
      fenceDollar: measure('\`\`\`\\necho $x\\n\`\`\`\\nfim do bloco\\n'),
      fenceDollarFinal: measureFinal('\`\`\`\\necho $x\\n\`\`\`\\nfim do bloco\\n'),
      price: measure('custa $5 e $6'),
      priceFinal: measureFinal('custa $5 e $6'),
      openDisplay: measure('veja $$\\\\int_0^1'),
    };
  })()`);
  console.log('__RESULT__ ' + JSON.stringify(data));
  app.exit(0);
}).catch((error) => { console.error(error); app.exit(1); });
