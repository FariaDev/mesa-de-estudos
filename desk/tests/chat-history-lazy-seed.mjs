/* Semente compartilhada dos `chat-history-lazy-*-ui.mjs` (#118): conversas
   sintéticas longas (texto + Markdown + KaTeX, como a sonda
   `perf-long-history.mjs`) e abertura pronta na janela com o fake OpenCode.
   Uma fonte só para os três arquivos não duplicarem o builder. */
import fs from 'node:fs';
import path from 'node:path';
import {launchDesk,newRuntime,seedCourse,seedNativeSession,writeConfigJson,writeDeskJson,statusOnline,freezeMotion,resizeWindow,tinyPdfPages,PLOT_PNG} from './helpers.mjs';

export function lazyAssistantBody(t) {
  return `## Resposta ${t}\n\nComece pela definição. A derivada de $f(x)=x^${t % 9 + 1}+${t}$ é $f'(x)=${t % 9 + 1}x^${t % 9}$. Depois use\n\n$$\\int_0^1 x^{${t % 20 + 1}}\\,dx=\\frac{1}{${t % 20 + 2}}$$\n\n\`\`\`js\nfunction passo${t}(x) {\n  return x * ${t} + Math.pow(x, ${t % 5 + 1});\n}\n\`\`\`\n\n- passo 1: escreva a expressão\n- passo 2: confira o sinal\n\nO resultado aproximado é ${(t * 1.2345).toFixed(4)}.`;
}

/**
 * Monta mensagens válidas para o descritor (o formato que o `historyTurns`
 * entende: usuário, assistente, `toolResult`, fechamento).
 * @param {number} turns quantos turnos (×4 mensagens)
 * @param {{imagesEvery?: number, toolCalls?: boolean, plotAt?: number, svgAt?: number, quoteRef?: {name: string, page: number}|null, dangerAt?: number, imageOnlyLast?: boolean}} [options]
 * @returns {Array<object>} ex.: buildLazyMessages(300).length // 1200
 */
export function buildLazyMessages(turns, options = {}) {
  const {imagesEvery = 0, toolCalls = false, plotAt = 0, svgAt = 0, quoteRef = null, dangerAt = 0, imageOnlyLast = false} = options;
  const out = [];
  for (let t = 1; t <= turns; t++) {
    const user = [{type: 'text', text: `Pergunta ${t}: como resolvo a questão ${t}?\n\nConsidere $f(x)=x^${t % 9 + 1}+${t}$ e explique o passo a passo.`}];
    if (imagesEvery > 0 && t % imagesEvery === 0) user.push({type: 'image', data: PLOT_PNG, mimeType: 'image/png'});
    out.push({role: 'user', content: user});
    let answer = lazyAssistantBody(t);
    if (quoteRef && t === 1) answer += `\n\nVeja ${quoteRef.name}, p. ${quoteRef.page} para a definição.`;
    if (t === plotAt) answer += '\n\n```plot\nx: -2..2\nfuncao: x^2\n```\n';
    if (t === svgAt) answer += '\n\n```svg\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>\n```\n';
    if (t === dangerAt) answer += '\n\nTexto com <script>window.__lazyXss = 1</script> e [clique](javascript:alert(1)) que não pode executar.';
    const assistant = [{type: 'text', text: answer}];
    if (toolCalls && t % 10 === 0) assistant.push({type: 'toolCall', id: `atividade-${t}`, name: 'mesa_criar_atividade', arguments: {titulo: `Atividade ${t}`}});
    out.push({role: 'assistant', content: assistant});
    if (toolCalls && t % 10 === 0) out.push({role: 'toolResult', content: [{type: 'text', text: `atividade ${t} criada`} ], toolCallId: `atividade-${t}`});
    else out.push({role: 'toolResult', content: [{type: 'text', text: t % 50 === 0 ? 'linha de resultado com número e texto; '.repeat(40) : `ok ${t}`}], toolCallId: `t${t}`});
    out.push({role: 'assistant', content: [{type: 'text', text: `Fechando a resposta ${t}: o sinal fica positivo e a integral vale $\\frac{1}{${t % 20 + 2}}$.`}]});
  }
  if (imageOnlyLast) out.push({role: 'user', content: [{type: 'image', data: PLOT_PNG, mimeType: 'image/png'}]});
  return out;
}

/**
 * Abre a Mesa com a conversa semeada e espera a última resposta à vista.
 * @param {number} turns turnos da conversa
 * @param {{options?: object, tag?: string, env?: object, pdfSeed?: string|null}} [config]
 * @returns {Promise<{runtime: string, app: object, page: object, messages: Array<object>}>}
 * @example const {page} = await openLazyDesk(300)
 */
export async function openLazyDesk(turns, {options = {}, tag = 'lazy', env = {}, pdfSeed = null} = {}) {
  const runtime = newRuntime(`lazy-${tag}`);
  const course = seedCourse(runtime, 'calc');
  let pdfPath = null;
  if (pdfSeed) {
    pdfPath = path.join(course, pdfSeed);
    fs.writeFileSync(pdfPath, tinyPdfPages(10, 'pagina'));
  }
  const messages = buildLazyMessages(turns, options);
  const session = seedNativeSession(runtime, messages, {courseId: 'calc', started: Date.now() - 86400000, preview: `sintético ${messages.length}`});
  writeConfigJson(runtime, {runtimePath: runtime, vaultPath: runtime, courses: [{id: 'calc', name: 'Cálculo I', path: course}]});
  writeDeskJson(runtime, {courseId: 'calc', session, courseStates: {calc: {session, sessions: [{path: session, started: Date.now() - 86400000}], pdfs: pdfPath ? [{path: pdfPath, page: 1, zoom: 1, scrollX: 0, scrollY: 0}] : [], study: {title: '', xopp: ''}}}});
  const app = await launchDesk({runtime, env});
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await statusOnline(page, {timeout: 90000});
  /* O último fechamento é o do turno pedido (`imageOnlyLast` põe uma mensagem
     só com imagem depois dele, então `messages.length/4` mira um texto que não
     existe). */
  const last = turns;
  /* A abertura de 5.000 sob carga passa de 2 min (a sonda mede 16–39 s só de
     boot→estável com a máquina disputada); o teto cobre o pico sem afrouxar o teste. */
  await page.waitForFunction((text) => document.querySelector('#messages')?.textContent.includes(text), `Fechando a resposta ${last}`, {timeout: 300000});
  await page.waitForFunction(() => document.querySelectorAll('#messages .message').length > 0, undefined, {timeout: 30000});
  await resizeWindow(app, page, 1440, 900);
  await freezeMotion(page);
  return {runtime, app, page, errors, messages, session, last, pdfPath};
}
