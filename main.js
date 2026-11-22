// Ops HQ — coque Mac qui regroupe les super admins des plateformes Ops Suite.
// Chaque plateforme tourne dans sa propre <webview>, avec une session persistante séparée
// (partition persist:<id>) : la connexion à Event ne se mélange pas avec Venue ou Helm.
const { app, BrowserWindow, shell, Menu, session } = require('electron')
const path = require('path')

// Google refuse la connexion dans un navigateur intégré qui s'annonce comme Electron :
// on présente l'agent utilisateur d'un Chrome standard.
const CHROME_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
const ALLOWED = [/^https:\/\/bar-ops-v2\.vercel\.app\//, /^https:\/\/bar-ops-venue\.vercel\.app\//, /^https:\/\/spectre888\.github\.io\/Helm-Ops\//, /^https:\/\/[a-z0-9]+\.supabase\.co\//, /^https:\/\/accounts\.google\.com\//, /^https:\/\/[a-z.]*google\.com\//, /^https:\/\/[a-z.]*gstatic\.com\//]
const inApp = u => ALLOWED.some(r => r.test(u))
const openOut = u => { if (/^(https?|mailto|tel):/.test(u)) shell.openExternal(u) }

let win
function create() {
  win = new BrowserWindow({
    width: 1480, height: 960, minWidth: 900, minHeight: 600,
    title: 'Ops HQ', backgroundColor: '#080808', titleBarStyle: 'hiddenInset',
    webPreferences: { preload: path.join(__dirname, 'shell', 'preload.js'), contextIsolation: true, nodeIntegration: false, webviewTag: true, sandbox: true },
  })
  win.loadFile(path.join(__dirname, 'shell', 'index.html'))
  win.webContents.on('will-navigate', e => e.preventDefault())
  win.webContents.setWindowOpenHandler(({ url }) => { openOut(url); return { action: 'deny' } })
}

app.on('web-contents-created', (_e, wc) => {
  if (wc.getType() !== 'webview') return
  wc.setUserAgent(CHROME_UA)
  // Liens target=_blank (Stripe, Vercel, Supabase…) : navigateur du Mac
  wc.setWindowOpenHandler(({ url }) => { openOut(url); return { action: 'deny' } })
  // Navigation hors des plateformes et de la connexion Google : navigateur du Mac
  wc.on('will-navigate', (e, url) => { if (!inApp(url)) { e.preventDefault(); openOut(url) } })
})
// Les webviews ne peuvent charger que des adresses https autorisées, sans Node
app.on('web-contents-created', (_e, wc) => {
  wc.on('will-attach-webview', (e, prefs, params) => {
    delete prefs.preload
    prefs.nodeIntegration = false; prefs.contextIsolation = true; prefs.sandbox = true
    if (!inApp(params.src) && !params.src.startsWith('data:')) e.preventDefault()
  })
})

app.whenReady().then(() => {
  for (const id of ['event', 'venue', 'helm']) session.fromPartition('persist:' + id).setPermissionRequestHandler((_wc, _p, cb) => cb(false))
  const send = ch => () => win && win.webContents.send(ch)
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: 'appMenu' },
    { role: 'editMenu' },
    { label: 'Plateformes', submenu: [
      { label: 'Bar Ops Event', accelerator: 'Cmd+1', click: () => win.webContents.send('go', 'event') },
      { label: 'Bar Ops Venue', accelerator: 'Cmd+2', click: () => win.webContents.send('go', 'venue') },
      { label: 'Helm Ops', accelerator: 'Cmd+3', click: () => win.webContents.send('go', 'helm') },
      { type: 'separator' },
      { label: 'Actualiser', accelerator: 'Cmd+R', click: send('reload') },
      { label: 'Revenir au super admin', accelerator: 'Cmd+Shift+H', click: send('home') },
      { label: 'Précédent', accelerator: 'Cmd+[', click: send('back') },
    ] },
    { role: 'windowMenu' },
  ]))
  create()
  // Test : HQ_SHOT=/chemin.png capture la fenêtre après chargement, puis quitte
  if (process.env.HQ_SHOT) setTimeout(async () => { require('fs').writeFileSync(process.env.HQ_SHOT, (await win.capturePage()).toPNG()); app.quit() }, 9000)
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) create() })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
