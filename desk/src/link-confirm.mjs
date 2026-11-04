/* Confirmação antes de abrir um link que veio de atividade (#81). A atividade é
   gerada pelo modelo, e um "Ver resposta" pode apontar para phishing: o domínio
   de destino aparece em destaque no `#link-dialog` (do index.html, com o
   casco do padrão dos diálogos) e o navegador só abre com o botão Abrir.
   O diálogo é da Mesa, não do quadro: o iframe não desenha por cima nem
   imita o botão. Os links que a própria Mesa escreve (Sobre, relato, console
   do OpenCode) não passam por aqui. */

/* Caminho mostrado no diálogo: acima de PATH_MAX, sai o meio e fica o começo
   (onde está a página) e o fim (onde costuma estar o arquivo ou o parâmetro). */
const PATH_MAX = 60;
const PATH_HEAD = 36;
const PATH_TAIL = 18;

/** @param {string} path */
function shortenPath(path) {
  if (path.length <= PATH_MAX) return path;
  return `${path.slice(0, PATH_HEAD)}…${path.slice(-PATH_TAIL)}`;
}

/**
 * Domínio e caminho de um link, como o diálogo mostra. O domínio vem do `URL`
 * (com a porta, sem a credencial de `https://user@…`), então é o destino de fato.
 * @param {string} url link https absoluto
 * @returns {{host: string, path: string}}
 * @example linkParts('https://exemplo.com/a/b?x=1') // {host: 'exemplo.com', path: '/a/b?x=1'}
 */
export function linkParts(url) {
  const link = new URL(url);
  return {host: link.host, path: shortenPath(`${link.pathname}${link.search}${link.hash}`)};
}

/**
 * Pergunta antes e só chama `open` com a resposta "Abrir".
 * @param {string} url link https absoluto
 * @param {{confirm: (url: string) => Promise<boolean>, open: (url: string) => unknown}} deps
 * @returns {Promise<boolean>} true quando abriu
 * @example await openConfirmedLink(url, {confirm: confirmOpenLink, open: (u) => window.desk.openExternal(u)});
 */
export async function openConfirmedLink(url, {confirm, open}) {
  if (!(await confirm(url))) return false;
  await open(url);
  return true;
}

/* A pergunta que espera a resposta do diálogo. Uma por vez: o `open` recusa a segunda. */
let waiting = null;

/* Responde a pergunta pendente com o que o diálogo fechou (`returnValue`). */
function settle(dialog) {
  if (!waiting) return;
  const resolve = waiting;
  waiting = null;
  resolve(dialog.returnValue === 'ok');
}

/* O `close` vai para a fila de tarefas: quando chega, a pessoa pode já ter
   reaberto o diálogo para outro link. Com o diálogo aberto, o evento é do
   fechamento anterior e não responde a pergunta atual (#81: sem isso, o
   Abrir do segundo link ficava sem ouvinte e o link não abria). */
function onClose(event) {
  const dialog = event.currentTarget;
  if (!dialog.open) settle(dialog);
}

/**
 * Mostra o destino no diálogo da Mesa e espera a resposta. Com outro diálogo
 * aberto ou sem o `#link-dialog` no HTML, recusa: na dúvida, não abre.
 * @param {string} url link https absoluto
 * @returns {Promise<boolean>} true só com o botão Abrir
 * @example const ok = await confirmOpenLink('https://exemplo.com/x');
 */
export function confirmOpenLink(url) {
  const dialog = document.getElementById('link-dialog');
  if (!dialog || dialog.open) return Promise.resolve(false);
  /* Um fechamento ainda na fila conta com a resposta que ele trouxe, antes de limpar. */
  settle(dialog);
  const {host, path} = linkParts(url);
  dialog.querySelector('#link-host').textContent = host;
  const pathLine = dialog.querySelector('#link-path');
  pathLine.textContent = path;
  /* O endereço inteiro fica no hover: o caminho encurtado não esconde o destino. */
  pathLine.title = url;
  dialog.returnValue = '';
  /* Mesmo ouvinte em cada abertura: `addEventListener` não duplica. */
  dialog.addEventListener('close', onClose);
  return new Promise((resolve) => {
    waiting = resolve;
    /* O foco cai em Cancelar (autofocus no HTML): um Enter de reflexo não abre o link. */
    dialog.showModal();
  });
}
