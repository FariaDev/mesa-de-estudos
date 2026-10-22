// Fakes nomeados do que o main pega do Electron para menu, notificação e IPC
// (#43 fase 2): os hosts recebem isto por parâmetro nos testes.
import {EventEmitter} from 'node:events';

/** ipcMain que guarda os handlers e deixa o teste chamá-los. */
export function fakeIpcMain() {
  const handlers = new Map();
  return {
    handlers,
    handle(channel, fn) {
      if (handlers.has(channel)) throw Error(`handler repetido: ${channel}`);
      handlers.set(channel, fn);
    },
    invoke: (channel, ...args) => handlers.get(channel)({sender: null}, ...args),
  };
}

/** Menu do Electron que guarda o último template montado. */
export function fakeMenu() {
  const menu = {template: null, builds: 0};
  menu.buildFromTemplate = template => template;
  menu.setApplicationMenu = template => { menu.template = template; menu.builds += 1; };
  return menu;
}

/** Notification do Electron: registra cada uma criada e se foi mostrada. */
export function fakeNotificationClass({supported = true} = {}) {
  const created = [];
  class FakeNotification extends EventEmitter {
    constructor(options) { super(); this.options = options; this.shown = false; created.push(this); }
    show() { this.shown = true; }
    static isSupported() { return supported; }
  }
  FakeNotification.created = created;
  return FakeNotification;
}

/** BrowserWindow mínima: foco, minimizado e o que o clique da notificação chama. */
export function fakeWindow({focused = false, minimized = false} = {}) {
  const calls = [];
  return {calls, sent: [], isDestroyed: () => false, isFocused: () => focused, isMinimized: () => minimized,
    restore: () => calls.push('restore'), show: () => calls.push('show'), focus: () => calls.push('focus'),
    webContents: {send(channel) { calls.push(`send:${channel}`); }, focus() {}}};
}

/** shell do Electron: guarda o que o host pediu para abrir. */
export function fakeShell() {
  const opened = [];
  return {
    opened,
    openPath: async (target) => { opened.push(target); return ''; },
    openExternal: async (url) => { opened.push(url); },
  };
}
