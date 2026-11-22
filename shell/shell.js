// Liste des plateformes : ajouter une ligne ici quand une plateforme a son super admin.
const PLATFORMS = [
  { id: 'event', name: 'Bar Ops Event', short: 'EV', label: 'Event', url: 'https://bar-ops-v2.vercel.app/admin.html' },
  { id: 'venue', name: 'Bar Ops Venue', short: 'VE', label: 'Venue', url: 'https://bar-ops-venue.vercel.app/admin.html' },
  { id: 'helm', name: 'Helm Ops', short: 'HE', label: 'Helm', url: null,
    placeholder: 'Le super admin de Helm Ops n\'existe pas encore : Helm Ops a sa propre base et pas de serveur Vercel. Dès qu\'il sera en ligne, il suffira d\'ajouter son adresse dans shell/shell.js.' },
]
const $ = id => document.getElementById(id)
const views = {}
let current = null
try { current = localStorage.getItem('hq_tab') } catch (_) {}
if (!PLATFORMS.some(p => p.id === current)) current = PLATFORMS[0].id

for (const p of PLATFORMS) {
  const b = document.createElement('button')
  b.className = 'tab'; b.dataset.id = p.id; b.title = p.name + ' (⌘' + (PLATFORMS.indexOf(p) + 1) + ')'
  b.innerHTML = `<span class="ic">${p.short}</span>${p.label}<span class="dot" id="dot-${p.id}"></span>`
  b.onclick = () => show(p.id)
  $('nav').appendChild(b)

  let v
  if (p.url) {
    v = document.createElement('webview')
    v.setAttribute('partition', 'persist:' + p.id)
    v.setAttribute('src', p.url)
    const dot = c => { $('dot-' + p.id).className = 'dot ' + c }
    v.addEventListener('did-start-loading', () => dot('load'))
    v.addEventListener('did-stop-loading', () => { dot('ok'); if (p.id === current) bar() })
    v.addEventListener('did-fail-load', e => { if (e.errorCode !== -3 && e.isMainFrame) dot('bad') })
    // Après la connexion Google, la plateforme renvoie vers son app : on revient au super admin
    v.addEventListener('did-navigate', e => { if (/\/app\.html/.test(e.url)) v.loadURL(p.url); else if (p.id === current) bar() })
    v.addEventListener('did-navigate-in-page', () => p.id === current && bar())
  } else {
    v = document.createElement('div')
    v.className = 'ph'
    v.innerHTML = `<b>${p.name}</b><p>${p.placeholder}</p>`
  }
  $('views').appendChild(v)
  views[p.id] = v
}

function bar() {
  const p = PLATFORMS.find(x => x.id === current), v = views[current]
  $('title').textContent = p.name
  let u = ''
  try { u = v.getURL ? v.getURL() : '' } catch (_) {}
  $('url').textContent = u.replace(/^https:\/\//, '')
}
function show(id) {
  current = id
  try { localStorage.setItem('hq_tab', id) } catch (_) {}
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.id === id))
  Object.entries(views).forEach(([k, v]) => v.classList.toggle('on', k === id))
  bar()
}
const wv = () => views[current]?.reload ? views[current] : null
const act = {
  reload: () => wv()?.reload(),
  back: () => { const v = wv(); if (v?.canGoBack()) v.goBack() },
  home: () => { const p = PLATFORMS.find(x => x.id === current); if (p.url && wv()) wv().loadURL(p.url) },
}
$('reload').onclick = act.reload; $('back').onclick = act.back; $('home').onclick = act.home
window.hq.on('go', show); window.hq.on('reload', act.reload); window.hq.on('home', act.home); window.hq.on('back', act.back)
show(current)
