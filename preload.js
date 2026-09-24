const { contextBridge, ipcRenderer, webUtils } = require('electron');

function pathToFileURL(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`;
  const encoded = encodeURI(withLeadingSlash).replace(/#/g, '%23').replace(/\?/g, '%3F');
  return `file://${encoded}`;
}

contextBridge.exposeInMainWorld('shellAPI', {
  minimize: () => ipcRenderer.send('window:minimize'),
  close: () => ipcRenderer.send('window:close'),
  openFiles: () => ipcRenderer.invoke('dialog:openFiles'),
  getMetadata: (filePath) => ipcRenderer.invoke('audio:getMetadata', filePath),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  pathToFileURL,
  toggleDockPanel: (isOpen) => ipcRenderer.send('window:toggleDockPanel', isOpen),
});

contextBridge.exposeInMainWorld('libraryAPI', {
  openFolderDialog: () => ipcRenderer.invoke('dialog:openFolder'),
  scanFolder: (folderPath) => ipcRenderer.invoke('library:scanFolder', folderPath),
  getAll: () => ipcRenderer.invoke('library:getAll'),
  removeEntries: (ids) => ipcRenderer.invoke('library:removeEntries', ids),
  showInExplorer: (filePath) => ipcRenderer.send('library:showInExplorer', filePath),
});

contextBridge.exposeInMainWorld('playlistAPI', {
  save: (filePaths) => ipcRenderer.invoke('playlist:save', filePaths),
  load: () => ipcRenderer.invoke('playlist:load'),
});

contextBridge.exposeInMainWorld('themeAPI', {
  save: (themeState) => ipcRenderer.invoke('theme:save', themeState),
  load: () => ipcRenderer.invoke('theme:load'),
  openThemeFile: () => ipcRenderer.invoke('dialog:openThemeFile'),
  saveThemeFile: (variables) => ipcRenderer.invoke('dialog:saveThemeFile', variables),
});

contextBridge.exposeInMainWorld('settingsAPI', {
  save: (partialSettings) => ipcRenderer.invoke('settings:save', partialSettings),
  load: () => ipcRenderer.invoke('settings:load'),
});
