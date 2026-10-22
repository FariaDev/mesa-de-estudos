/* QoL da Mesa — UI isolada (Playwright + fake Pi + runtime temporário).

   Cobre:
   1. Esc com o turno aberto: fecha menu, fecha a busca do PDF e só cancela o
      tutor quando NENHUMA camada dismissível está aberta;
   2. paleta ⌘K: abre, filtra sem acento, setas/Enter/Esc, foco restaurado,
      item disabled com o turno aberto e troca de matéria disponível;
   3. layouts pessoais: embutidos aplicam só view (chat/calculadora/apoio) e o
      guardar/renomear/excluir funciona pelos handlers reais do processo principal.

   NUNCA roda o app real: helpers.mjs aponta LEARNING_DESK_RUNTIME para um
   runtime temporário. Uso: node tests/qol-actions-ui.mjs */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {launchDesk, newRuntime, seedCourse, writeDeskJson, writeConfigJson, tinyPdf, statusOnline, currentSession, openStudyContext,pageWindow} from './helpers.mjs';

const failOnPageErrors = [];
let app = null;
let page = null;

async function step(name, fn) {
  try {
    await fn();
    console.log(`  ok   ${name}`);
  } catch (error) {
    console.log(`  FAIL ${name}\n       ${String(error?.message || error).slice(0, 400)}`);
    throw error;
  }
}

const valueOf = (prop) => page.evaluate((name) => getComputedStyle(document.documentElement).getPropertyValue(name), prop);

async function openHeldTurn(text = 'responda devagar') {
  await page.locator('#prompt').fill(text);
  await page.locator('#send').click();
  await page.waitForFunction(() => document.querySelector('#send').disabled, undefined, {timeout: 10000});
  await page.waitForFunction(() => !document.querySelector('#stop').hidden, undefined, {timeout: 10000});
}

async function waitIdle() {
  await page.waitForFunction(() => document.querySelector('#stop').hidden && !document.querySelector('#send').disabled, undefined, {timeout: 15000});
}

async function closeAnyDialog() {
  await page.evaluate(() => {
    for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
  });
}

const runtime = newRuntime('qol-actions');
const courseA = seedCourse(runtime, 'A');
const courseB = seedCourse(runtime, 'B');
fs.writeFileSync(path.join(courseA, 'Limites.pdf'), tinyPdf('Exercise'));
fs.writeFileSync(path.join(courseA, 'Formulario.pdf'), tinyPdf('Support'));
writeDeskJson(runtime, {courseId: 'A',layoutPresets:{version:1,presets:[{id:'p-synthetic',name:'Pessoal do boot',layout:{
 chatWidth:400,calcHeight:240,pdfSplit:.5,chatCollapsed:false,calculatorCollapsed:false,referenceVisible:false,minimized:[false,false]
}}]}});
writeConfigJson(runtime, {
  vaultPath: runtime,
  courses: [
    {id: 'A', name: 'Matéria A', path: courseA},
    {id: 'B', name: 'Matéria B', path: courseB},
  ],
});

try {
  app = await launchDesk({runtime, env: {FAKE_PI_QUEUE_LOG: path.join(runtime, 'queue.jsonl'), FAKE_PI_QUEUE_HOLD_MS: '30000'}});
  page = await app.firstWindow();
  page.on('pageerror', (error) => failOnPageErrors.push(String(error?.message || error)));
  await page.waitForSelector('.pdf-panel', {timeout: 30000});
  await statusOnline(page);

  await step('layout pessoal aparece na paleta após boot sem abrir Configurações', async()=>{
    await page.keyboard.press('ControlOrMeta+k');
    await page.waitForSelector('#command-palette:not([hidden])');
    await page.locator('.palette-input').fill('Pessoal do boot');
    await page.waitForFunction(()=>[...document.querySelectorAll('#command-palette .palette-item .label')].some(el=>el.textContent.includes('Pessoal do boot')));
    await page.keyboard.press('Escape');
  });

  await step('Esc fecha o popover do contexto sem abortar o turno', async()=>{
    await openHeldTurn('segure para referências');
    await openStudyContext(page);
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>document.querySelector('#context-pop').hidden);
    await page.waitForTimeout(250);// espera fixa: "nada acontece em 0,25 s" — Esc no popover de contexto não cancela o turno
    assert.equal(await page.locator('#stop').isHidden(),false);
    assert.equal(await page.locator('#send').isDisabled(),true);
    await page.keyboard.press('Escape');
    await waitIdle();
  });

  await step('override antigo de ⌘K vence o default novo da paleta, sem ser apagado', async () => {
    await page.evaluate(() => localStorage.setItem('mesa.keys', JSON.stringify({v: 1, overrides: {'pdf-find': 'Mod+k'}})));
    await page.reload();
    await page.waitForSelector('.pdf-panel', {timeout: 30000});
    await statusOnline(page);
    const keys = await page.evaluate(() => ({
      palette: window.mesaKeys.effective('command-palette'),
      find: window.mesaKeys.effective('pdf-find'),
      stored: JSON.parse(localStorage.getItem('mesa.keys') || '{}').overrides,
    }));
    assert.equal(keys.find, 'Mod+k', 'o override antigo continua gravado');
    assert.equal(keys.stored['pdf-find'], 'Mod+k');
    assert.notEqual(keys.palette, 'Mod+k', 'a paleta não rouba o combo em uso (fica sem atalho)');
    await page.locator('#prompt').click();
    await page.keyboard.press('ControlOrMeta+k');
    await page.waitForFunction(() => {
      const form = document.querySelector('.pdf-panel .pdf-find');
      return form && !form.hidden && document.activeElement === form.querySelector('input');
    }, undefined, {timeout: 5000});
    assert.equal(await page.evaluate(() => !!document.querySelector('#command-palette:not([hidden])')), false, '⌘K abre a busca, não a paleta');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('.pdf-panel .pdf-find').hidden);
    await page.evaluate(() => localStorage.removeItem('mesa.keys'));
    await page.reload();
    await page.waitForSelector('.pdf-panel', {timeout: 30000});
    await statusOnline(page);
    const restored = await page.evaluate(() => window.mesaKeys.effective('command-palette'));
    assert.equal(String(restored).toLowerCase(), 'mod+k', 'sem override, a paleta volta ao default');
  });

  await step('Esc com o turno aberto fecha o menu e não cancela o tutor', async () => {
    await openHeldTurn('segure o turno');
    await page.locator('#settings-menu .nav-trigger').click();
    await page.waitForFunction(() => document.querySelector('#settings-menu')?.classList.contains('open'));
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#settings-menu')?.classList.contains('open'));
    await page.waitForTimeout(250);// espera fixa: "nada acontece em 0,25 s" — Esc no menu não cancela o turno
    assert.equal(await page.locator('#stop').isHidden(), false, 'o turno segue aberto');
    assert.equal(await page.locator('#send').isDisabled(), true, 'o composer segue no turno');
    await page.keyboard.press('Escape'); // nada aberto: agora cancela
    await waitIdle();
  });

  await step('Esc com o turno aberto fecha a busca do PDF e não cancela o tutor', async () => {
    await openHeldTurn('segure de novo');
    await page.locator('.pdf-panel .find-toggle').first().click();
    await page.waitForFunction(() => !document.querySelector('.pdf-panel .pdf-find').hidden);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('.pdf-panel .pdf-find').hidden);
    await page.waitForTimeout(250);// espera fixa: "nada acontece em 0,25 s" — Esc na busca não cancela o turno
    assert.equal(await page.locator('#stop').isHidden(), false, 'o turno segue aberto depois do find');
    await page.keyboard.press('Escape');
    await waitIdle();
  });

  await step('paleta abre no ⌘K, aceita filtro sem acento e restaura o foco', async () => {
    assert.equal(await page.evaluate(() => typeof window.mesaPalette?.open), 'function');
    await page.locator('#prompt').click();
    await page.keyboard.press('ControlOrMeta+k');
    await page.waitForFunction(() => !document.querySelector('#command-palette').hidden);
    assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('palette-input')), true, 'o campo recebe o foco');
    await page.locator('.palette-input').fill('anotacoes');
    await page.waitForFunction(() => [...document.querySelectorAll('#command-palette .palette-item .label')].some((el) => el.textContent.includes('Anotações')));
    assert.ok(await page.locator('#command-palette .palette-item mark').count() > 0, 'o trecho casado fica marcado');
    await page.locator('.palette-input').evaluate(input=>input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,isComposing:true})));
    assert.equal(await page.locator('#command-palette').isVisible(),true,'Enter de composição não executa a ação');
    assert.equal(await page.locator('#study-notes-dialog[open]').count(),0,'nenhum diálogo da ação abre durante composição');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('#command-palette').hidden);
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'prompt', 'o foco volta para quem abriu');
  });

  await step('paleta executa ação com Enter e abre as Configurações', async () => {
    await page.keyboard.press('ControlOrMeta+k');
    await page.waitForFunction(() => !document.querySelector('#command-palette').hidden);
    await page.locator('.palette-input').fill('configuracoes');
    await page.waitForFunction(() => {
      const items = [...document.querySelectorAll('#command-palette .palette-item')];
      return items.some((el) => el.classList.contains('active') && el.textContent.includes('Configurações'));
    });
    await page.keyboard.press('Enter');
    await page.waitForSelector('#settings-dialog[open]', {timeout: 5000});
    await closeAnyDialog();
  });

  await step('paleta com o turno aberto: item disabled não executa e Esc fecha a paleta', async () => {
    await openHeldTurn('segure para a paleta');
    await page.keyboard.press('ControlOrMeta+k');
    await page.waitForFunction(() => !document.querySelector('#command-palette').hidden);
    await page.locator('.palette-input').fill('conferir');
    await page.waitForFunction(() => {
      const item = [...document.querySelectorAll('#command-palette .palette-item')].find((el) => el.textContent.includes('Conferir'));
      return !!item && item.classList.contains('disabled');
    });
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => !document.querySelector('#command-palette').hidden), true, 'item disabled não fecha/executa');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('#command-palette').hidden);
    await page.waitForTimeout(200);// espera fixa: "nada acontece em 0,2 s" — fechar a paleta não cancela o turno
    assert.equal(await page.locator('#stop').isHidden(), false, 'fechar a paleta não cancela o turno');
    await page.keyboard.press('Escape');
    await waitIdle();
  });

  await step('paleta troca para a matéria disponível com Enter', async () => {
    await page.keyboard.press('ControlOrMeta+k');
    await page.waitForFunction(() => !document.querySelector('#command-palette').hidden);
    await page.locator('.palette-input').fill('materia b');
    await page.waitForFunction(() => [...document.querySelectorAll('#command-palette .palette-item .label')].some((el) => el.textContent.includes('Matéria B')));
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('#course-tabs button.active')?.dataset.id === 'B', undefined, {timeout: 20000});
  });

  await step('layouts: embutido Exercícios aplica só view (chat, calculadora e apoio)', async () => {
    await page.keyboard.press('ControlOrMeta+,');
    await page.waitForSelector('#settings-dialog[open]', {timeout: 10000});
    await page.locator('#settings-tab-leitores').click();
    await page.locator('#layout-presets-open').click();
    await page.waitForSelector('#layout-presets-dialog[open]');
    await page.selectOption('#layout-preset-select', 'mesa-exercicios');
    await page.locator('#layout-preset-apply').click();
    await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--chat').trim() === '360px');
    assert.equal((await valueOf('--chat')).trim(), '360px');
    assert.equal((await valueOf('--calc')).trim(), '420px');
    assert.equal(await page.locator('#reference-toggle').getAttribute('aria-pressed'), 'true', 'o Formulário fica visível');
    assert.equal(await page.locator('#calc-toggle').getAttribute('aria-expanded'), 'true');
  });

  await step('layouts: Leitura esconde o Formulário sem trocar de conversa', async () => {
    const sessionBefore = await currentSession(page);
    await page.selectOption('#layout-preset-select', 'mesa-leitura');
    await page.locator('#layout-preset-apply').click();
    await page.waitForFunction(() => document.querySelector('#reference-toggle').getAttribute('aria-pressed') === 'false');
    assert.equal((await valueOf('--chat')).trim(), '420px');
    assert.equal(await currentSession(page), sessionBefore, 'a sessão não muda');
  });

  await step('layouts: guardar/renomear/excluir no backend disponível', async () => {
    /* Falhar se o processo principal não responder: sem backend em memória. */
    const usingReal = await page.evaluate(async () => {
      try {
        if (typeof window.desk.layoutPresetsGet !== 'function' || typeof window.desk.layoutPresetsSave !== 'function') return false;
        await window.desk.layoutPresetsGet();
        return true;
      } catch {
        return false;
      }
    });
    assert.equal(usingReal, true, 'layouts usam os handlers reais do Electron');
    await page.locator('#layout-presets-close').click();
    await page.waitForFunction(() => !document.querySelector('#layout-presets-dialog').open);
    await page.evaluate(() => window.mesaLayoutPresets.refresh());
    await page.locator('#layout-presets-open').click();
    await page.waitForSelector('#layout-presets-dialog[open]');
    await page.locator('#layout-preset-name').fill('Revisão QoL');
    await page.locator('#layout-preset-save').click();
    await page.waitForFunction(() => [...document.querySelectorAll('#layout-preset-select option')].some((option) => option.textContent.includes('Revisão QoL')));
    await page.evaluate(() => {
      const select = document.querySelector('#layout-preset-select');
      select.value = [...select.options].find((option) => option.textContent.includes('Revisão QoL')).value;
      select.dispatchEvent(new Event('change'));
    });
    await page.locator('#layout-preset-name').fill('Revisão 2');
    await page.locator('#layout-preset-rename').click();
    await page.waitForFunction(() => [...document.querySelectorAll('#layout-preset-select option')].some((option) => option.textContent.includes('Revisão 2')));
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('#layout-preset-delete').click();
    await page.waitForFunction(() => ![...document.querySelectorAll('#layout-preset-select option')].some((option) => option.textContent.includes('Revisão 2')));
    await page.locator('#layout-presets-close').click();
    await page.waitForFunction(() => !document.querySelector('#layout-presets-dialog').open);
    await page.locator('#settings-dialog button[value="cancel"]').last().click();
    await page.waitForFunction(() => !document.querySelector('#settings-dialog').open);
  });

  await step('desk-layout-ready reaplica só a view depois de recompor os leitores', async () => {
    const sessionBefore = await currentSession(page);
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('desk-layout-ready', {detail: {layout: {
        chatWidth: 333,
        calcHeight: 333,
        pdfSplit: 0.3,
        chatCollapsed: false,
        calculatorCollapsed: true,
        minimized: [true, false],
      }}}));
    });
    await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--chat').trim() === '333px');
    assert.equal((await valueOf('--calc')).trim(), '333px');
    assert.equal(await page.locator('#calc-toggle').getAttribute('aria-expanded'), 'false', 'a calculadora recolhe');
    await page.waitForFunction(() => document.querySelector('.pdf-panel')?.classList.contains('minimized'));
    assert.equal(await currentSession(page), sessionBefore, 'o reapply da view não troca a sessão');
  });

  await step('menu nativo abre paleta sobre GeoGebra e restaura a vista ao fechar', async () => {
    await page.locator('#course-tabs button[data-id="geogebra"]').click();
    await page.waitForFunction(()=>document.querySelector('#references').classList.contains('ggb'));
    async function nativeVisible(expected){
      for(let attempt=0;attempt<50;attempt++){
        const visible=await (await pageWindow(app,page)).evaluate(win=>{
          return win.contentView.children.find(view=>view.webContents&&view.webContents!==win.webContents)?.getVisible();
        });
        if(visible===expected)return;
        await page.waitForTimeout(50);// espera fixa: intervalo do polling da vista nativa
      }
      throw Error(`Vista nativa não ficou visible=${expected}`);
    }
    await nativeVisible(true);
    await app.evaluate(({Menu},win)=>{
      win.contentView.children.find(view=>view.webContents&&view.webContents!==win.webContents).webContents.focus();
      Menu.getApplicationMenu().getMenuItemById('command-palette').click();
    },await pageWindow(app,page));
    await page.waitForSelector('#command-palette:not([hidden])');await nativeVisible(false);
    await page.locator('.palette-input').fill('configurações');
    await page.keyboard.press('Enter');await page.waitForSelector('#settings-dialog[open]');await nativeVisible(false);
    await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);await nativeVisible(true);
  });

  await step('sem erros de página', async () => {
    assert.deepEqual(failOnPageErrors, []);
  });

  console.log('PASS: qol-actions (esc, paleta e layouts)');
} finally {
  try {
    await app?.close();
  } catch {}
  try {
    fs.rmSync(runtime, {recursive: true, force: true});
  } catch {}
}
