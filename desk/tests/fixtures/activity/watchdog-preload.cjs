'use strict';
const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('__ping', () => ipcRenderer.invoke('wd-ping'));
