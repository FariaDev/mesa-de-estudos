const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('desk',{
 init:()=>ipcRenderer.invoke('init'),switchCourse:id=>ipcRenderer.invoke('switch-course',id),settings:change=>ipcRenderer.invoke('pi-settings',change),openPDF:()=>ipcRenderer.invoke('open-pdf'),readPDF:p=>ipcRenderer.invoke('read-pdf',p),save:s=>ipcRenderer.invoke('save-state',s),
 connect:()=>ipcRenderer.invoke('pi-connect'),prompt:p=>ipcRenderer.invoke('pi-prompt',p),abort:()=>ipcRenderer.invoke('pi-abort'),respond:d=>ipcRenderer.invoke('pi-response',d),newSession:()=>ipcRenderer.invoke('new-session'),openSession:p=>ipcRenderer.invoke('open-session',p),captureReady:()=>ipcRenderer.invoke('capture-ready'),openXournal:()=>ipcRenderer.invoke('open-xournal'),
 getConfig:()=>ipcRenderer.invoke('get-config'),saveConfig:c=>ipcRenderer.invoke('save-config',c),pickFolder:()=>ipcRenderer.invoke('pick-folder'),pickFile:()=>ipcRenderer.invoke('pick-file'),detectPi:()=>ipcRenderer.invoke('detect-pi'),
 onEvent:fn=>ipcRenderer.on('pi-event',(_e,data)=>fn(data)),
 onMenuCheck:fn=>ipcRenderer.on('menu-check',fn),
 onMenuStop:fn=>ipcRenderer.on('menu-stop',fn),
 onMenuHelp:fn=>ipcRenderer.on('menu-help',fn),
 onMenuSettings:fn=>ipcRenderer.on('menu-settings',fn)
});
