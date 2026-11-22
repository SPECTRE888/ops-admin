const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('hq', {
  on: (ch, fn) => { if (['go', 'reload', 'home', 'back', 'helm-auth'].includes(ch)) ipcRenderer.on(ch, (_e, a) => fn(a)) },
  data: view => ipcRenderer.invoke('hq-data', view),
})
