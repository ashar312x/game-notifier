const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('config:get-all'),
  saveConfig: (partial) => ipcRenderer.invoke('config:save', partial),
  testSend: (opts) => ipcRenderer.invoke('test:send', opts),
});
