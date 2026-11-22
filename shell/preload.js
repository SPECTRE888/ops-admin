const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('hq', { on: (ch, fn) => { if (['go', 'reload', 'home', 'back'].includes(ch)) ipcRenderer.on(ch, (_e, a) => fn(a)) } })
