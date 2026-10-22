'use strict';
const {contextBridge, ipcRenderer} = require('electron');

/* Mesmo formato que o preload de produção vai expor (a integração do pai deve
   manter os nomes e payloads). Nada além da API de atividade. */
contextBridge.exposeInMainWorld('desk', {
  activityList: () => ipcRenderer.invoke('activity-list'),
  activityRead: (payload) => ipcRenderer.invoke('activity-read', payload),
  activityStateGet: (payload) => ipcRenderer.invoke('activity-state-get', payload),
  activityStateSave: (payload) => ipcRenderer.invoke('activity-state-save', payload),
  activityScope: () => ipcRenderer.invoke('activity-scope'),
  onActivity: (fn) => {
    const handler = (_event, data) => { if (typeof fn === 'function') fn(data); };
    ipcRenderer.on('activity-event', handler);
    return () => ipcRenderer.removeListener('activity-event', handler);
  },
});
