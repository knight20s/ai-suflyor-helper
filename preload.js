const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (patch) => ipcRenderer.invoke('config:set', patch),
  transcribe: (wav) => ipcRenderer.invoke('transcribe', { wav }),
  onEngine: (cb) => ipcRenderer.on('engine', (e, info) => cb(info)),
  ready: () => ipcRenderer.send('ready'),
  ptyStart: (cols, rows) => ipcRenderer.send('pty:start', { cols, rows }),
  ptyInput: (data) => ipcRenderer.send('pty:input', data),
  ptyResize: (cols, rows) => ipcRenderer.send('pty:resize', { cols, rows }),
  ptyRestart: (cols, rows) => ipcRenderer.send('pty:restart', { cols, rows }),
  onPtyData: (cb) => ipcRenderer.on('pty:data', (e, data) => cb(data)),
  onPtyExit: (cb) => ipcRenderer.on('pty:exit', (e, code) => cb(code)),
  minimize: () => ipcRenderer.send('win:minimize'),
  close: () => ipcRenderer.send('win:close'),
  setLock: (value) => ipcRenderer.invoke('win:lock', value),
  exportSession: (payload) => ipcRenderer.invoke('session:export', payload)
});
