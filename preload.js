const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('config:get-all'),
  saveConfig: (partial) => ipcRenderer.invoke('config:save', partial),
  testSend: (opts) => ipcRenderer.invoke('test:send', opts),
  onLogsInit: (cb) => ipcRenderer.once('logs:init', (_e, lines) => cb(lines)),
  onLog: (cb) => {
    const handler = (_e, line) => cb(line);
    ipcRenderer.on('logs:line', handler);
    return () => ipcRenderer.removeListener('logs:line', handler);
  },
});
