/* Enviar sem rede (auditoria de UI/UX, rodada 4, sem-conexão): a Mesa é local
   e não tem faixa permanente — o estado aparece no momento que importa. Com o
   provedor fora do ar (DNS), o turno falha e a conversa mostra erro claro em
   português (falta de conexão + como tentar), sem perder o texto (na bolha)
   nem a conversa, e o Enviar segue habilitado para a nova tentativa. Só
   medidas do navegador real, sem regex. */
import assert from 'node:assert/strict';
import path from 'node:path';
import {withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,freezeMotion,resizeWindow,setTheme,tinyPdf} from './helpers.mjs';
import {settle} from './layout-measure.mjs';

const TEXT = 'explique derivadas sem rede';

await withArtifacts('offline-send', async (ctx) => {
  const runtime = ctx.runtime = newRuntime('offline-send');
  const course = seedCourse(runtime, 'calc');
  const pdf = path.join(course, 'Limites.pdf');
  const {writeFileSync} = await import('node:fs');
  writeFileSync(pdf, tinyPdf('Limites e derivadas'));
  writeConfigJson(runtime, {runtimePath: runtime, vaultPath: runtime, courses: [{id: 'calc', name: 'Cálculo I', path: course}]});
  writeDeskJson(runtime, {courseId: 'calc', courseStates: {calc: {pdfs: [{path: pdf, page: 1}], study: {title: '', xopp: ''}}}});
  ctx.app = await launchDesk({runtime, env: {FAKE_OPENCODE_FAIL: 'network'}});
  const page = await ctx.app.firstWindow();
  await statusOnline(page);
  await freezeMotion(page);
  await page.waitForSelector('.pdf-panel canvas', {timeout: 30000});
  for (const [width, height] of [[1440, 900], [900, 650]]) {
    await resizeWindow(ctx.app, page, width, height);
    const tag = `${width}x${height}`;
    await page.locator('#prompt').fill(TEXT);
    await page.locator('#send').click();
    await page.waitForFunction(() => [...document.querySelectorAll('#messages *')].some((el) => el.children.length === 0 && el.textContent.includes('Sem conexão')), undefined, {timeout: 60000});
    await page.waitForFunction(() => !document.querySelector('#send').disabled, undefined, {timeout: 30000});
    await settle(page);
    const state = await page.evaluate(() => ({
      error: [...document.querySelectorAll('#messages *')].filter((el) => el.children.length === 0 && el.textContent.includes('Sem conexão')).map((el) => el.textContent.trim())[0] || '',
      user: [...document.querySelectorAll('#messages .message.user')].map((el) => el.textContent.replace(/\s+/g, ' ').trim()),
      sendEnabled: !document.querySelector('#send').disabled,
      toasts: [...document.querySelectorAll('#toast *')].filter((el) => el.children.length === 0 && el.textContent.includes('Sem conexão') && el.getBoundingClientRect().height > 0).length,
    }));
    assert.match(state.error, /Sem conexão/, `${tag}: erro em português à vista`);
    assert.match(state.error, /envie de novo/i, `${tag}: o erro diz como tentar de novo`);
    assert.ok(state.user.some((t) => t.includes(TEXT)), `${tag}: o texto segue na conversa (${JSON.stringify(state.user).slice(0, 120)})`);
    assert.equal(state.sendEnabled, true, `${tag}: o Enviar segue habilitado para a nova tentativa`);
    assert.equal(state.toasts, 0, `${tag}: o cartão já diz "Sem conexão"; o aviso flutuante não repete (G7)`);
  }
  await setTheme(page, 'light');
  console.log('OFFLINE SEND UI PASSED: erro de sem-conexão em PT, texto e conversa preservados.');
});
