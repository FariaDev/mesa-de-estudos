/* Leitores vazios identificáveis (auditoria de UI/UX, rodada 4, F2; revisão
   rodada 5): sem material não há página à vista e o rótulo é o único texto que
   diz qual leitor é qual. A regra antiga valia só até `@container 290px` e
   acima dela o teto de 28–34% cortava o rótulo (900×650 com chat em 500: barra
   de 158 px, "Formulário & apoio" com 84 px; 1440×900 com chat em 650: teto de
   34% cortava 12 px). A correção é na classe (sem teto e sem mínimo para o
   leitor vazio, em toda largura), não em mais uma exceção: o teste varre o
   `--chat` do mínimo ao máximo (310 a 650, a faixa do divisor) em 900×650 e
   1440×900, nos dois temas, e cobra em CADA ponto, só com medida do navegador
   real e CSSOM (sem regex de folha):
   - o rótulo pinta na largura natural (sem teto de CSS), o seletor segue no
     DOM com "Nenhum material" e sem mínimo inútil;
   - onde a barra comporta os controles fixos (rótulo + Mais opções), o rótulo
     aparece inteiro dentro do painel, sem reticências, e o Mais opções segue
     à vista. Numa faixa estreita em 900 (o 1º leitor é fixo em 240 px e o 2º
     fica com o resto) a barra não comporta rótulo inteiro + Mais opções ao
     mesmo tempo: o rótulo tem prioridade (é a identificação do leitor) e o
     teste prova que ele pinta inteiro mesmo ali — prova geométrica: barra de
     158 px não cabe rótulo de 130 + botão de 24 + recuos, em nenhuma regra de
     uma linha só. */
import assert from 'node:assert/strict';
import {withArtifacts,newRuntime,seedCourse,writeConfigJson,launchDesk,statusOnline,freezeMotion,resizeWindow,setTheme} from './helpers.mjs';
import {settle} from './layout-measure.mjs';

const CHATS = [310, 400, 500, 575, 650];
const SIZES = [[1440, 900], [900, 650]];
/* PT e EN: o rótulo do 2º leitor muda de tamanho ("Formulário & apoio" ×
   "Formula sheet & support") e o status muda junto ("Nenhum material" × "No
   material") — a regra do status tem de valer nos dois. */
const LOCALES = [
  {locale: 'pt-BR', env: {}, labels: ['Enunciado', 'Formulário & apoio'], status: 'Nenhum material'},
  {locale: 'en', env: {LEARNING_DESK_LOCALE: 'en-US'}, labels: ['Problems', 'Formula sheet & support'], status: 'No material'},
];

async function bars(page) {
  return page.evaluate(() => [...document.querySelectorAll('#pdf-grid .pdf-panel')].map((panel) => {
    const bar = panel.querySelector(':scope > .pdf-title');
    const strong = panel.querySelector(':scope > .pdf-title > strong');
    const select = panel.querySelector(':scope > .pdf-title > .pdf-select');
    const more = panel.querySelector(':scope > .pdf-title > .more');
    const rect = (el) => { const r = el.getBoundingClientRect(); return {x: r.x, w: r.width}; };
    const barRect = bar.getBoundingClientRect();
    /* Largura natural do status: um span com a mesma fonte e recuos do
       seletor, com o texto da opção selecionada (sem pintar nada no meio: o
       evaluate é síncrono, sem frame entre medir e remover). */
    let statusNatural = 0;
    if (select) {
      const cs = getComputedStyle(select);
      const probe = document.createElement('span');
      probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${cs.font};letter-spacing:${cs.letterSpacing};padding:${cs.padding};border:0;`;
      probe.textContent = select.selectedOptions[0]?.textContent || '';
      document.body.append(probe);
      statusNatural = probe.getBoundingClientRect().width
        + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
      probe.remove();
    }
    const selectStyle = select ? getComputedStyle(select) : null;
    return {
      noMaterial: panel.hasAttribute('data-no-material'),
      strongText: strong?.textContent.trim() || '',
      strongRect: strong ? rect(strong) : {x: 0, w: 0},
      strongScroll: strong ? strong.scrollWidth : 0,
      strongClient: strong ? strong.clientWidth : 0,
      strongMaxWidth: strong ? getComputedStyle(strong).maxWidth : '',
      selectInDom: !!select,
      selectValue: select?.selectedOptions[0]?.textContent.trim() || '',
      selectName: select?.getAttribute('aria-label') || '',
      selectMinWidth: select ? getComputedStyle(select).minWidth : '',
      selectRect: select ? rect(select) : {x: 0, w: 0},
      /* Escondido visual: some da vista (clip de 1px) mas segue no DOM com
         nome acessível — nunca um fragmento ("Nenhu…"/"N…"). */
      statusHidden: select ? select.getBoundingClientRect().width <= 2 : false,
      statusNatural,
      statusPosition: selectStyle?.position || '',
      statusClip: selectStyle?.clipPath || '',
      moreRect: more ? rect(more) : {x: 0, w: 0},
      panelRight: panel.getBoundingClientRect().right,
      barW: barRect.width,
    };
  }));
}

await withArtifacts('leitor-vazio-rotulo', async (ctx) => {
  let narrow = 0;
  for (const {locale, env, labels: EXPECTED, status: STATUS} of LOCALES) {
  const runtime = ctx.runtime = newRuntime(`leitor-vazio-rotulo-${locale}`);
  const course = seedCourse(runtime, 'calc');
  writeConfigJson(runtime, {vaultPath: runtime, courses: [{id: 'calc', name: 'Cálculo I', path: course}], desk: {pinnedExtensions: false}});
  ctx.app = await launchDesk({runtime, env});
  const page = await ctx.app.firstWindow();
  await statusOnline(page);
  await page.waitForSelector('.pdf-panel .reader-sheet', {timeout: 25000});
  if (locale === 'en') await page.waitForFunction(() => document.documentElement.lang === 'en', undefined, {timeout: 15000});
  await freezeMotion(page);
  for (const [theme] of [['light'], ['dark']]) {
    await setTheme(page, theme);
    for (const size of SIZES) {
      await resizeWindow(ctx.app, page, size[0], size[1]);
      for (const chat of CHATS) {
        await page.evaluate((px) => document.documentElement.style.setProperty('--chat', `${px}px`), chat);
        await settle(page);
        const list = await bars(page);
        const tag = `${theme} ${size[0]}x${size[1]} chat=${chat}`;
        assert.equal(list.length, 2, `${tag}: 2 leitores à vista`);
        for (const [i, item] of list.entries()) {
          const label = `${tag} leitor ${i + 1}`;
          assert.equal(item.noMaterial, true, `${label}: sem material`);
          assert.equal(item.strongText, EXPECTED[i], `${label}: o rótulo é "${EXPECTED[i]}"`);
          /* Sem controle de largura inútil, em toda largura: sem teto para o
             rótulo e sem mínimo para o seletor. */
          assert.equal(item.strongMaxWidth, 'none', `${label}: o rótulo não tem teto de largura (veio max-width ${item.strongMaxWidth})`);
          assert.equal(item.selectMinWidth, '0px', `${label}: o seletor não tem mínimo inútil (veio min-width ${item.selectMinWidth})`);
          assert.ok(item.selectInDom, `${label}: o seletor segue no DOM`);
          assert.equal(item.selectValue, STATUS, `${label}: o seletor segue com "${STATUS}"`);
          assert.ok(item.selectName.length > 0, `${label}: o seletor segue com nome acessível`);
          /* Regra do status (auditoria rodada 6, P1): aparece inteiro ou some
             da vista (no DOM, com nome) — nunca truncado ("Nenhu…"/"N…"). */
          if (item.statusHidden) {
            assert.ok(item.selectRect.w <= 2, `${label}: escondido some da vista (pintou ${item.selectRect.w}px)`);
          } else {
            assert.ok(item.selectRect.w + 1 >= item.statusNatural, `${label}: o status aparece inteiro (pintou ${item.selectRect.w}px de ${item.statusNatural}px)`);
          }
          /* O "Mais opções" continua como está: sempre à vista, sem encolher.
             (Em faixa ultraestreita o rótulo tem prioridade e o ⋯ pode pintar
             para fora do painel — limite conhecido, fora do P1.) */
          assert.ok(item.moreRect.w >= 20, `${label}: o Mais opções continua à vista (largura ${item.moreRect.w}px)`);
          /* O rótulo pinta na largura natural: nenhuma regra de CSS o encolhe
             (vale até na faixa estreita, onde a barra não comporta tudo). */
          assert.ok(item.strongRect.w >= item.strongScroll - 1, `${label}: o rótulo pinta inteiro na largura natural (pintou ${item.strongRect.w}px de ${item.strongScroll}px)`);
          /* Onde a barra comporta os controles fixos, o rótulo aparece inteiro
             dentro do painel e o Mais opções segue à vista. */
          const moreFits = item.moreRect.x + item.moreRect.w <= item.panelRight + 1;
          if (moreFits) {
            assert.ok(item.strongScroll <= item.strongClient + 1, `${label}: o rótulo aparece inteiro, sem reticências`);
            assert.ok(item.strongRect.x + item.strongRect.w <= item.panelRight + 1, `${label}: o rótulo fica dentro do painel`);
          } else {
            narrow++;
          }
        }
      }
    }
  }
  await page.evaluate(() => document.documentElement.style.removeProperty('--chat'));
  await setTheme(page, 'light');
  await ctx.app.close();
  }
  console.log(`READER EMPTY LABEL UI PASSED: rótulo inteiro e sem teto, status inteiro ou fora de vista, em ${SIZES.length * CHATS.length * 2 * LOCALES.length} pontos (faixa estreita em ${narrow} leituras, com o rótulo em prioridade).`);
});
