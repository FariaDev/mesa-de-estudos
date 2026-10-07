import {markup} from '../markdown.mjs';

/* Página de impressão do material (aba Livre). Roda em janela escondida,
   sandbox e sem Node: recebe {token, title, markdown}, renderiza com a MESMA
   `markup` do chat e só então avisa o main. `allowAssets=false` transforma
   figura/asset em código — nada local fora do app e nada de rede.

   A espera de fonte é real: depois do HTML entrar, força layout e espera
   `document.fonts` (as famílias do KaTeX) antes de dizer "ok", senão o PDF sai
   com fórmula em fonte errada ou espaço em branco. */

const MAX_CHARS = 262144;
const doc = document.getElementById('doc');

let token = '';
let finished = false;

function report(ok, extra = {}) {
  if (finished) return;
  finished = true;
  try {
    window.materialPrint.done({token, ok, ...extra});
  } catch { /* a página está sendo destruída */ }
}

async function settleFonts(root) {
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  void root.offsetHeight;
  const families = new Set();
  try {
    for (const face of document.fonts) {
      if (face.family) families.add(face.family);
    }
  } catch { /* sem FontFaceSet: segue com o que der */ }
  const loads = [];
  for (const family of families) {
    for (const spec of ['16px', 'italic 16px', 'bold 16px', 'bold italic 16px']) {
      loads.push(Promise.resolve(document.fonts.load(`${spec} "${family}"`)).catch(() => null));
    }
  }
  await Promise.all(loads);
  try { await document.fonts.ready; } catch { /* segue */ }
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

if (window.materialPrint) {
  window.materialPrint.onRender(async (payload) => {
    token = String(payload?.token ?? '');
    finished = false;
    try {
      const markdown = String(payload?.markdown ?? '');
      const title = String(payload?.title ?? '').slice(0, 200);
      if (markdown.length > MAX_CHARS) throw new Error('conteúdo acima do teto');
      document.title = title || 'Mesa de Estudos';
      doc.innerHTML = markup(markdown, false);
      await settleFonts(doc);
      report(true);
    } catch (error) {
      doc.textContent = '';
      report(false, {message: String(error?.message || error)});
    }
  });
}

window.addEventListener('error', (event) => report(false, {message: String(event.message || 'erro ao renderizar o PDF')}));
window.addEventListener('unhandledrejection', (event) => report(false, {message: String(event.reason?.message || event.reason || 'erro ao renderizar o PDF')}));
