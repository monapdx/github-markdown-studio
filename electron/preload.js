import { contextBridge, ipcRenderer } from 'electron';

console.log('[preload] loaded');

contextBridge.exposeInMainWorld('api', {
  ping: () => 'pong',
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (content) => ipcRenderer.invoke('dialog:saveFile', content),
  saveFileAs: (content) => ipcRenderer.invoke('dialog:saveFileAs', content),
});