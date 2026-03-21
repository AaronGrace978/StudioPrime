const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('studio', {
  getSources: () => ipcRenderer.invoke('sources:get'),

  saveDialog: (defaultName, format) =>
    ipcRenderer.invoke('file:save-dialog', { defaultName, format }),
  saveBuffer: (filePath, buffer) =>
    ipcRenderer.invoke('file:save-buffer', { filePath, buffer }),
  saveTempBuffer: (buffer) =>
    ipcRenderer.invoke('file:save-temp', buffer),
  convertFile: (tempPath, outputPath, format) =>
    ipcRenderer.invoke('convert:start', { tempPath, outputPath, format }),
  revealFile: (filePath) => ipcRenderer.invoke('file:reveal', filePath),

  minimize: () => ipcRenderer.invoke('win:minimize'),
  maximize: () => ipcRenderer.invoke('win:maximize'),
  close: () => ipcRenderer.invoke('win:close'),
  isMaximized: () => ipcRenderer.invoke('win:is-maximized'),

  onWindowState: (cb) =>
    ipcRenderer.on('window-state', (_, maximized) => cb(maximized)),
  onShortcut: (cb) =>
    ipcRenderer.on('shortcut', (_, action) => cb(action)),
  onConvertProgress: (cb) =>
    ipcRenderer.on('convert:progress', (_, pct) => cb(pct)),
});
