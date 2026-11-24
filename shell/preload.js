const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('hq', {
  on: (ch, fn) => { if (['go', 'reload', 'home', 'back', 'helm-auth', 'fake-health', 'fake-demo'].includes(ch)) ipcRenderer.on(ch, (_e, a) => fn(a)) },
  notify: (title, body, go) => ipcRenderer.send('hq-notify', String(title), String(body || ''), String(go || '')),
  demo: body => ipcRenderer.invoke('hq-demo', JSON.parse(JSON.stringify(body))),
  data: view => ipcRenderer.invoke('hq-data', view),
})
