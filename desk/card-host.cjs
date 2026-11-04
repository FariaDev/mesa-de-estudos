// @ts-check
'use strict';

/* Host dos cartões `quiz`/`perguntar` da conversa principal (#92): IPC da
   janela e roteamento do evento `desk-card`. O serviço por conversa mora em
   `card-session.cjs`; o chat lateral usa o mesmo serviço com o id do descritor. */

const {createCardSession} = require('./card-session.cjs');

/**
 * Cria o host dos cartões da conversa ativa.
 * @param {{ipcMain: import('./types/host-deps').IpcMain, runtime: string,
 *   live: import('./main.cjs').DeskLive,
 *   emit: (payload: object) => void,
 *   sendText: (text: string, target?: string) => Promise<object>,
 *   appendLog?: import('./types/host-deps').AppendLog}} options
 * @returns {{show: (scope: {conversationId: string}, raw: {kind?: unknown, args?: unknown}) => object,
 *   list: (session?: string) => object[], sendText: (text: string, target?: string) => Promise<object>,
 *   conclude: (id: string) => Promise<object>}}
 * @example const cardHost = createCardHost({ipcMain, runtime, live, emit, sendText});
 */
function createCardHost({ipcMain, runtime, live, emit, sendText, appendLog = () => {}}) {
  const cards = createCardSession({runtime, conversation: () => String(live.session || ''), sendText, emit, appendLog});

  function show(scope, raw) {
    return cards.show(raw, String(scope?.conversationId || ''));
  }

  ipcMain.handle('card-list', () => cards.list());
  ipcMain.handle('card-draft', (_event, payload) => cards.draft(payload));
  ipcMain.handle('card-answer', (_event, payload) => cards.answer(payload));
  ipcMain.handle('card-dismiss', (_event, payload) => cards.dismiss(payload));
  ipcMain.handle('card-conclude', (_event, payload) => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw Error('cartão inválido; esperado object {id}');
    return cards.conclude(String(payload.id || ''));
  });

  return {show, list: (session) => cards.list(session), sendText, conclude: (id) => cards.conclude(id)};
}

module.exports = {createCardHost};
