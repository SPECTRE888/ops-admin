// Ops HQ — coque Mac qui regroupe les super admins des plateformes Ops Suite.
// Chaque plateforme tourne dans sa propre <webview>, avec une session persistante séparée
// (partition persist:<id>) : la connexion à Event ne se mélange pas avec Venue ou Helm.
const { app, BrowserWindow, shell, Menu, session, ipcMain } = require('electron')
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
    title: 'Ops HQ', backgroundColor: '#080808', titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 16, y: 16 },
    webPreferences: { preload: path.join(__dirname, 'shell', 'preload.js'), contextIsolation: true, nodeIntegration: false, webviewTag: true, sandbox: true },
  })
  win.loadFile(path.join(__dirname, 'shell', 'index.html'))
  win.webContents.on('did-finish-load', () => setTimeout(deliverAuth, 300))
  win.webContents.on('will-navigate', e => e.preventDefault())
  win.webContents.setWindowOpenHandler(({ url }) => { openOut(url); return { action: 'deny' } })
}

app.on('web-contents-created', (_e, wc) => {
  if (wc.getType() !== 'webview') return
  wc.setUserAgent(CHROME_UA)
  // Liens target=_blank (Stripe, Vercel, Supabase…) : navigateur du Mac
  wc.setWindowOpenHandler(({ url }) => { openOut(url); return { action: 'deny' } })
  // Navigation hors des plateformes et de la connexion Google : navigateur du Mac
  // Google refuse la connexion dans une webview Electron (« navigateur non sécurisé ») : pour Helm,
  // la connexion se fait dans le navigateur du Mac, puis la page admin renvoie ici via opshq://helm
  wc.on('will-navigate', (e, url) => { if (/^https:\/\/chlmqnrvnrgeaihryreb\.supabase\.co\/auth\/v1\/authorize/.test(url)) { e.preventDefault(); openOut(url); return }
    if (!inApp(url)) { e.preventDefault(); openOut(url) } })
})
// Les webviews ne peuvent charger que des adresses https autorisées, sans Node
app.on('web-contents-created', (_e, wc) => {
  wc.on('will-attach-webview', (e, prefs, params) => {
    delete prefs.preload
    prefs.nodeIntegration = false; prefs.contextIsolation = true; prefs.sandbox = true
    if (!inApp(params.src) && !params.src.startsWith('data:')) e.preventDefault()
  })
})

// Lien opshq://helm#access_token=… : jetons Supabase de la connexion Helm faite dans le navigateur
app.setAsDefaultProtocolClient('opshq')
let pendingAuth = null
const deliverAuth = () => { if (pendingAuth && win && !win.webContents.isLoading()) { win.webContents.send('helm-auth', pendingAuth); pendingAuth = null; win.show(); win.focus() } }
app.on('open-url', (e, url) => {
  e.preventDefault()
  const m = /^opshq:\/\/helm\/?(#access_token=[A-Za-z0-9_\-.=&%/+]+)$/.exec(url)
  if (!m) return
  pendingAuth = m[1]
  if (app.isReady()) deliverAuth()
})

// Clés admin (fichier local, lisible par l'utilisateur seul) : ajoutées uniquement aux appels de l'API
// d'admin de chaque plateforme, dans son propre onglet. Pas de connexion Google à faire.
const fs = require('fs')
const ADMIN_API = {
  event: 'https://bar-ops-v2.vercel.app/api/admin*',
  venue: 'https://bar-ops-venue.vercel.app/api/admin*',
  helm: 'https://chlmqnrvnrgeaihryreb.supabase.co/functions/v1/admin*',
}
function adminKeys() {
  try { return JSON.parse(fs.readFileSync(path.join(app.getPath('appData'), 'Ops HQ', 'admin-keys.json'), 'utf8')) } catch (_) { return {} }
}

// Vues réunies d'Ops HQ (vue d'ensemble, santé, rendez-vous) : le process principal interroge l'API
// d'admin de chaque plateforme avec sa clé. Seules des vues en lecture sont permises ici.
const API_BASE = { event: 'https://bar-ops-v2.vercel.app/api/admin', venue: 'https://bar-ops-venue.vercel.app/api/admin', helm: 'https://chlmqnrvnrgeaihryreb.supabase.co/functions/v1/admin' }
const HQ_VIEWS = { overview: ['event', 'venue', 'helm'], health: ['event', 'venue', 'helm'], demos: ['venue'] }
ipcMain.handle('hq-data', async (_e, view) => {
  if (!HQ_VIEWS[view]) return {}
  const keys = adminKeys(), out = {}
  await Promise.all(HQ_VIEWS[view].map(async id => {
    if (!keys[id]) return (out[id] = { error: 'Clé absente' })
    try {
      const r = await fetch(API_BASE[id] + '?view=' + view, { headers: { 'x-admin-key': keys[id] }, signal: AbortSignal.timeout(20000) })
      const j = await r.json().catch(() => ({}))
      out[id] = r.ok ? j : { error: j.error || 'HTTP ' + r.status }
    } catch (e) { out[id] = { error: e.message } }
  }))
  return out
})

app.whenReady().then(() => {
  const keys = adminKeys()
  for (const [id, url] of Object.entries(ADMIN_API)) {
    if (!keys[id]) continue
    session.fromPartition('persist:' + id).webRequest.onBeforeSendHeaders({ urls: [url] }, (d, cb) => cb({ requestHeaders: { ...d.requestHeaders, 'x-admin-key': keys[id] } }))
  }
  for (const id of ['event', 'venue', 'helm']) session.fromPartition('persist:' + id).setPermissionRequestHandler((_wc, _p, cb) => cb(false))
  const send = ch => () => win && win.webContents.send(ch)
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: 'appMenu' },
    { role: 'editMenu' },
    { label: 'Plateformes', submenu: [
      { label: "Vue d'ensemble", accelerator: 'Cmd+1', click: () => win.webContents.send('go', 'overview') },
      { label: 'Santé', accelerator: 'Cmd+2', click: () => win.webContents.send('go', 'health') },
      { label: 'Rendez-vous', accelerator: 'Cmd+3', click: () => win.webContents.send('go', 'demos') },
      { type: 'separator' },
      { label: 'Bar Ops Event', accelerator: 'Cmd+4', click: () => win.webContents.send('go', 'event') },
      { label: 'Bar Ops Venue', accelerator: 'Cmd+5', click: () => win.webContents.send('go', 'venue') },
      { label: 'Helm Ops', accelerator: 'Cmd+6', click: () => win.webContents.send('go', 'helm') },
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
