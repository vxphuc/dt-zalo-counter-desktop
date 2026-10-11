const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('counterBubble', { toggle: () => ipcRenderer.send('counter:toggle'), menu: () => ipcRenderer.send('counter:menu') })
