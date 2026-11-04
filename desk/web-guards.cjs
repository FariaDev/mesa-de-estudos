'use strict';

/* Guardas das janelas web (revisão de segurança): nenhuma página ganha
   permissão que o app não usa, e a view do GeoGebra não sai da própria página.
   O que o app usa de verdade fica numa lista; o resto é negado por padrão. */

/* A cópia do chat, das notas e do Conferir (`navigator.clipboard.writeText` e
   `write` em src/*.mjs). Câmera, microfone, localização, notificação da página,
   tela cheia e o resto ficam negados. A notificação do sistema sai do processo
   principal (`desk-notify-host.cjs`), não da página. */
const ALLOWED_PERMISSIONS = Object.freeze(['clipboard-sanitized-write']);

/**
 * Nega as permissões da sessão: pedido e consulta só passam para `allowed`.
 * @param {{setPermissionRequestHandler: Function, setPermissionCheckHandler?: Function}} ses
 * @param {readonly string[]} [allowed]
 * @example guardPermissions(require('electron').session.defaultSession);
 */
function guardPermissions(ses, allowed = ALLOWED_PERMISSIONS) {
  const ok = new Set(allowed);
  ses.setPermissionRequestHandler((_webContents, permission, callback) => callback(ok.has(permission)));
  if (typeof ses.setPermissionCheckHandler === 'function') {
    ses.setPermissionCheckHandler((_webContents, permission) => ok.has(permission));
  }
}

/* Só `https:` sai para o navegador do sistema. http, file, javascript e o
   esquema interno do app não abrem nada por aqui. */
function isExternalLink(url) {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

/* Documento sem fragmento: `#trecho` continua na mesma página. Compara-se o
   documento, não o `origin`: em `file:` o origin é `null` para todo arquivo. */
function documentOf(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.href;
  } catch {
    return '';
  }
}

/**
 * Prende a página: a navegação iniciada pela página só vai para o próprio
 * documento, nenhuma janela nova abre, e link `https:` vai ao navegador do
 * sistema só depois da confirmação da Mesa (#81).
 * @param {{setWindowOpenHandler: Function, on: Function, getURL: () => string}} contents
 * @param {{openExternal?: (url: string) => unknown, confirmLink?: (url: string) => boolean | Promise<boolean>}} [options]
 *   `confirmLink` é o `confirmOpenLink` do renderer; sem ele, ou recusando, o link não abre.
 * @example guardPage(view.webContents, {openExternal: openExternalLink, confirmLink: confirmOpenLink});
 */
function guardPage(contents, {openExternal = () => {}, confirmLink = () => false} = {}) {
  contents.setWindowOpenHandler(({url}) => {
    if (isExternalLink(url)) {
      Promise.resolve()
        .then(() => confirmLink(url))
        .then((ok) => { if (ok === true) openExternal(url); })
        .catch(() => { /* confirmação indisponível: não abre */ });
    }
    return {action: 'deny'};
  });
  contents.on('will-navigate', (event, url) => {
    const here = documentOf(contents.getURL());
    if (!here || documentOf(url) !== here) event.preventDefault();
  });
}

module.exports = {ALLOWED_PERMISSIONS, guardPermissions, guardPage, isExternalLink};
