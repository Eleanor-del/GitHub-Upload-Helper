const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  readFileBase64: (filePath) => ipcRenderer.invoke('read-file-base64', filePath),
  selectSingleFile: () => ipcRenderer.invoke('select-single-file'),
  createRelease: (cfg) => ipcRenderer.invoke('gh-create-release', cfg),
  uploadAsset: (cfg) => ipcRenderer.invoke('gh-upload-asset', cfg)
});
