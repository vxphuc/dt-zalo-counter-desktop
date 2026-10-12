const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('counterBubble', {
  toggle: () => ipcRenderer.send('counter:toggle'),
  menu: () => ipcRenderer.send('counter:menu'),
  startDrag: () => ipcRenderer.send('counter:drag-start'),
  moveDrag: () => ipcRenderer.send('counter:drag-move'),
  endDrag: () => ipcRenderer.send('counter:drag-end'),
})
