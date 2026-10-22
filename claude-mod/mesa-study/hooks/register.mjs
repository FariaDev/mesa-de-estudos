// hooks/register.mjs — entrada oficial do mod (`export function register`).
//
// O módulo inteiro roda no ambiente de hooks do Claude Code: sem DOM, sem
// Node, sem `require`. Ele importa SOMENTE arquivos deste plugin (`lib/`).
// Nada aqui aprova ferramentas, lê credenciais ou inicia o modelo; o helper
// local só é chamado por ações explícitas do usuário (ver `lib/mesa.mjs`).
//
// APIs usadas (conferidas nos tipos oficiais 2.1.277):
// - `$.command.register({ name, description })` dentro de `session.start`;
// - `on('command.run', { command: 'mesa' }, ...)` devolvendo `{}` quando o
//   painel abriu (silencioso, sem turno do modelo) ou `{ text }` se falhou;
// - `$.ui.open({ id, title, focus, closeOnEscape, columns })`,
//   `$.ui.panes()` (confirmação: `isPlaced`) e `$.ui.invalidate('ui.render')`;
// - `$.prompt.submit({ text })` sem anexos (o pedido pede `Read` do PNG local);
// - `$.store.get/set/delete`, `$.process.run(argv, { timeoutMs })`, `$.fs.stat/list`;
// - `$.plugin.root` para achar `host/cli.mjs`; `$.ui.resolve(e)` para a tabela
//   de elementos da superfície.
//
// Os hooks `ui.open`/`ui.close` chamam `next(e)` ANTES de refletir o estado:
// um hook abaixo pode recusar (`{ deny }`) e o painel não abre/fecha; a Mesa
// só assume o estado quando o resultado não é uma recusa.

import { createMesa } from '../lib/mesa.mjs'

export function register(on, options) {
  const mesa = createMesa(options)

  on('session.start', async ($, e, next) => {
    await mesa.start($)
    try {
      await $.command.register({
        name: 'mesa',
        description: 'Abre a Mesa de Estudos (protótipo local; nada vai ao modelo sem você pedir).',
      })
    } catch (err) {
      try {
        $.ui.log(`mesa-study: falha ao registrar /mesa: ${err && err.message ? err.message : err}`, { to: 'debug' })
      } catch {
        // Log é melhor esforço; a sessão segue.
      }
    }
    return next(e)
  })

  on('command.run', { command: 'mesa' }, ($) => mesa.openPane($))

  on('ui.open', { id: 'mesa-study' }, async ($, e, next) => {
    const result = await next(e)
    mesa.onPaneOpened(e, result)
    return result
  })

  on('ui.close', { id: 'mesa-study' }, async ($, e, next) => {
    const result = await next(e)
    mesa.onPaneClosed(e, result)
    return result
  })

  on('ui.render', { component: 'Pane', requestId: 'mesa-study' }, ($, e) => mesa.render($, e))
}
