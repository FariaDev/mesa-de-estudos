/* Ações do vazio do Livre (auditoria de UI/UX, rodada 6, G2): as três quebravam
   em 2+1 em 900×650. Cabem numa linha em 900 e 1440, PT e EN, sem truncar
   rótulo e sem alvo abaixo de 24 px; o primário continua único. Em EN, se não
   couber numa linha, a quebra é equilibrada (1+1+1, nunca 2+1). Medido na
   janela real. */
import assert from 'node:assert/strict';
import {
  withArtifacts,launchDesk,newRuntime,seedCourse,writeConfigJson,writeDeskJson,resizeWindow,
} from './helpers.mjs';
import {layoutStable} from './waits.mjs';

async function freeEmpty(page) {
  await page.evaluate(async () => {
    const data = {
      state: {}, library: [], course: 'Livre', courseId: 'mesa-free',
      courses: [{id: 'Mesa', name: 'Mesa'}, {id: 'mesa-free', name: 'Livre'}], preferred: [], pending: {items: []},
      workspace: {kind: 'free', id: 'mesa-free', title: 'Sessão sintética', materials: []},
      session: 'pi-livre-1.jsonl', sessions: [{label: 'Livre 1', path: 'pi-livre-1.jsonl'}],
    };
    await (await import('./src/state.mjs')).loadCourse(data);
  });
  await page.waitForSelector('#free-empty:not([hidden])');
}

function rowState(page) {
  return page.evaluate(() => [...document.querySelectorAll('.free-start-actions>button')].map((button) => {
    const rect = button.getBoundingClientRect();
    return {
      id: button.id, top: Math.round(rect.top), height: rect.height,
      truncated: button.scrollWidth > button.clientWidth + 1,
      primary: button.classList.contains('primary'),
    };
  }));
}

await withArtifacts('livre-acoes', async (ctx) => {
  const outcomes = [];
  for (const {locale, env} of [{locale: 'pt-BR', env: {}}, {locale: 'en', env: {LEARNING_DESK_LOCALE: 'en-US'}}]) {
    const runtime = ctx.runtime = newRuntime(`livre-acoes-${locale}`);
    const course = seedCourse(runtime, 'Mesa');
    writeConfigJson(runtime, {runtimePath: runtime, vaultPath: runtime, courses: [{id: 'Mesa', name: 'Mesa', path: course}], desk: {title: 'Mesa teste', panels: [{label: 'Enunciado'}, {label: 'Formulário'}]}});
    writeDeskJson(runtime, {courseId: 'Mesa'});
    ctx.app = await launchDesk({runtime, env});
    const page = await ctx.app.firstWindow();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.waitForSelector('.pdf-panel');
    await layoutStable(page, '.pdf-panel');
    try {
      await freeEmpty(page);
      for (const [width, height] of [[900, 650], [1440, 900]]) {
        await resizeWindow(ctx.app, page, width, height);
        await layoutStable(page, 'main');
        const buttons = await rowState(page);
        const tag = `${locale} ${width}x${height}`;
        assert.deepEqual(buttons.map((button) => button.id), ['free-empty-open', 'free-empty-tutor', 'free-empty-promote'], `${tag}: os três caminhos, nesta ordem`);
        assert.deepEqual(buttons.map((button) => button.primary), [false, true, false], `${tag}: o primário continua único`);
        for (const button of buttons) {
          assert.ok(button.height >= 24, `${tag} ${button.id}: alvo de ao menos 24 px (altura ${button.height}px)`);
          assert.equal(button.truncated, false, `${tag} ${button.id}: rótulo sem truncar`);
        }
        const tops = [...new Set(buttons.map((button) => button.top))];
        if (locale === 'pt-BR') {
          assert.equal(tops.length, 1, `${tag}: as três ações numa linha (topos ${tops.join(',')})`);
          outcomes.push(`${tag}: uma linha`);
        } else if (width === 1440) {
          assert.equal(tops.length, 1, `${tag}: as três ações numa linha (topos ${tops.join(',')})`);
          outcomes.push(`${tag}: uma linha`);
        } else {
          /* EN em 900: cabe numa linha ou quebra equilibrada (1+1+1); 2+1 não. */
          assert.ok(tops.length === 1 || tops.length === 3, `${tag}: uma linha ou quebra equilibrada (topos ${tops.join(',')})`);
          outcomes.push(`${tag}: ${tops.length === 1 ? 'uma linha' : 'quebra equilibrada 1+1+1'}`);
        }
      }
      assert.deepEqual(errors, [], 'nenhum erro de página durante o fluxo');
    } finally {
      await ctx.app.close();
      ctx.app = null;
    }
  }
  console.log(`FREE EMPTY ACTIONS UI PASSED — ${outcomes.join('; ')}.`);
});
