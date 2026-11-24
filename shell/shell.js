// Onglets du haut : 3 vues réunies (données des 3 plateformes) puis le super admin de chaque plateforme.
const PLATFORMS = [
  { id: 'event', name: 'Bar Ops Event', label: 'Event', url: 'https://bar-ops-v2.vercel.app/admin.html' },
  { id: 'venue', name: 'Bar Ops Venue', label: 'Venue', url: 'https://bar-ops-venue.vercel.app/admin.html' },
  { id: 'helm', name: 'Helm Ops', label: 'Helm', url: 'https://spectre888.github.io/Helm-Ops/admin/' },
]
const HQ = [
  { id: 'overview', name: "Vue d'ensemble", label: "Vue d'ensemble" },
  { id: 'health', name: 'Santé des plateformes', label: 'Santé' },
  { id: 'demos', name: 'Rendez-vous de démo', label: 'Rendez-vous' },
]
const TABS = [...HQ, ...PLATFORMS]
const NAME = Object.fromEntries(PLATFORMS.map(p => [p.id, p.name]))
const $ = id => document.getElementById(id)
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const eur = n => (Number(n) || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' €'
const views = {}
let current = null
try { current = localStorage.getItem('hq_tab') } catch (_) {}
if (!TABS.some(p => p.id === current)) current = 'overview'

function addTab(p, extra) {
  const b = document.createElement('button')
  b.className = 'tab'; b.dataset.id = p.id; b.title = p.name + ' (⌘' + (TABS.indexOf(p) + 1) + ')'
  b.innerHTML = esc(p.label) + (extra || '')
  b.onclick = () => show(p.id)
  $('nav').appendChild(b)
}

for (const p of HQ) {
  addTab(p, `<span class="n" id="n-${p.id}" hidden></span>`)
  const v = document.createElement('div')
  v.className = 'hqv'
  $('views').appendChild(v)
  views[p.id] = v
}
$('nav').appendChild(Object.assign(document.createElement('span'), { className: 'sep' }))

for (const p of PLATFORMS) {
  addTab(p, `<span class="dot" id="dot-${p.id}"></span>`)
  const v = document.createElement('webview')
  v.setAttribute('partition', 'persist:' + p.id)
  v.setAttribute('src', p.url)
  const dot = c => { $('dot-' + p.id).className = 'dot ' + c }
  v.addEventListener('did-start-loading', () => dot('load'))
  v.addEventListener('did-stop-loading', () => { dot('ok'); if (p.id === current) bar() })
  v.addEventListener('did-fail-load', e => { if (e.errorCode !== -3 && e.isMainFrame) dot('bad') })
  // Après une connexion Google, la plateforme renvoie vers son app : on revient au super admin
  v.addEventListener('did-navigate', e => { if (/\/app\.html/.test(e.url)) v.loadURL(p.url); else if (p.id === 'helm' && e.url.startsWith('https://spectre888.github.io/Helm-Ops/') && !e.url.startsWith(p.url)) v.loadURL(p.url + (new URL(e.url).hash || '')); else if (p.id === current) bar() })
  v.addEventListener('did-navigate-in-page', () => p.id === current && bar())
  $('views').appendChild(v)
  views[p.id] = v
}

// ── Vues réunies ──────────────────────────────
const badge = (id, n, bad) => { const el = $('n-' + id); el.hidden = !n; el.textContent = n; el.className = 'n' + (bad ? ' bad' : '') }
const openBtn = id => `<button data-go="${id}">Ouvrir</button>`

const render = {
  async overview(v) {
    const d = await window.hq.data('overview')
    const ok = PLATFORMS.filter(p => d[p.id] && !d[p.id].error).map(p => d[p.id])
    const sum = k => ok.reduce((s, o) => s + (Number(o[k]) || 0), 0)
    const watch = PLATFORMS.flatMap(p => (d[p.id]?.watch || []).map(w => ({ ...w, p: p.id })))
    badge('overview', watch.length)
    v.innerHTML = `<h2>Vue d'ensemble</h2><p class="lead">Les trois plateformes réunies. MRR estimé au tarif actuel de chacune.</p>
      <div class="kpis">
        <div class="kpi gold"><b>${eur(sum('mrr'))}</b><span>MRR total</span></div>
        <div class="kpi"><b>${eur(sum('arr'))}</b><span>ARR total</span></div>
        <div class="kpi"><b>${sum('paying')}</b><span>Abonnés payants</span></div>
        <div class="kpi"><b>${sum('users')}</b><span>Utilisateurs</span></div>
        <div class="kpi"><b>${sum('signups30')}</b><span>Inscrits 30 j</span></div>
        <div class="kpi"><b>${sum('active7')}</b><span>Actifs 7 j</span></div>
      </div>
      <h3>Par plateforme</h3><div class="plats">${PLATFORMS.map(p => {
        const o = d[p.id] || {}
        return `<div class="plat"><header><b>${esc(p.name)}</b>${openBtn(p.id)}</header>${o.error ? `<p class="err">${esc(o.error)}</p>` : `<dl>
          <dt>MRR</dt><dd>${eur(o.mrr)}</dd><dt>Abonnés payants</dt><dd>${esc(o.paying)}</dd>
          <dt>Accès offerts</dt><dd>${esc(o.gifted ?? 0)}</dd><dt>Paiements en échec</dt><dd>${esc(o.pastDue ?? 0)}</dd>
          <dt>Utilisateurs</dt><dd>${esc(o.users)}</dd><dt>Sans abonnement</dt><dd>${esc(o.noSub ?? 0)}</dd>
          <dt>Inscrits 7 j / 30 j</dt><dd>${esc(o.signups7)} / ${esc(o.signups30)}</dd><dt>Actifs 7 j / 30 j</dt><dd>${esc(o.active7)} / ${esc(o.active30)}</dd></dl>`}</div>`
      }).join('')}</div>
      <h3>À surveiller (${watch.length})</h3>${watch.length ? `<table><tr><th>Plateforme</th><th>Compte</th><th>Raison</th><th></th></tr>${watch.map(w => `<tr><td><span class="tag gold">${esc(NAME[w.p])}</span></td><td>${esc(w.email)}</td><td>${esc(w.why)}</td><td>${openBtn(w.p)}</td></tr>`).join('')}</table>` : '<p class="muted">Rien à signaler.</p>'}`
  },
  async health(v) {
    const d = await window.hq.data('health')
    let bad = 0
    const issues = []
    const blocks = PLATFORMS.map(p => {
      const h = d[p.id] || {}
      if (h.error) { bad++; issues.push([p.name + ' : injoignable', h.error]); return `<div class="plat"><header><b>${esc(p.name)}</b>${openBtn(p.id)}</header><p class="err">${esc(h.error)}</p></div>` }
      const missing = Object.entries(h.env || {}).filter(([, on]) => !on).map(([k]) => k)
      bad += (h.checks || []).filter(c => !c.ok).length + (missing.length ? 1 : 0)
      ;(h.checks || []).filter(c => !c.ok).forEach(c => issues.push([p.name + ' : ' + c.name, c.detail]))
      if (missing.length) issues.push([p.name + ' : variables manquantes', missing.join(', ')])
      const nko = (h.checks || []).filter(c => !c.ok).length + (missing.length ? 1 : 0)
      const line = (name, ok, detail) => `<li class="${ok ? 'ok' : 'bad'}"><i></i><div><span>${esc(name)}</span>${detail ? `<small>${esc(detail)}</small>` : ''}</div><em class="tag ${ok ? 'ok' : 'bad'}">${ok ? 'OK' : 'Problème'}</em></li>`
      return `<div class="plat"><header><b>${esc(p.name)}</b><span class="tag ${nko ? 'bad' : 'ok'}">${nko ? nko + ' problème' + (nko > 1 ? 's' : '') : 'OK'}</span>${openBtn(p.id)}</header>
        <ul class="checks">${(h.checks || []).map(c => line(c.name, c.ok, c.detail)).join('')}${line('Variables', !missing.length, missing.length ? missing.join(', ') : Object.keys(h.env || {}).length + ' présentes')}</ul></div>`
    })
    badge('health', bad, true)
    alertHealth(issues)
    v.innerHTML = `<h2>Santé</h2><p class="lead">${bad ? bad + ' point' + (bad > 1 ? 's' : '') + ' à regarder.' : 'Tout est au vert.'}</p><div class="plats three">${blocks.join('')}</div>`
  },
  async demos(v) {
    const d = (await window.hq.data('demos')).venue || {}
    if (d.error) return void (v.innerHTML = `<h2>Rendez-vous</h2><p class="err">${esc(d.error)}</p>`)
    const now = Date.now(), CH = { visio: 'Visio Meet', whatsapp: 'WhatsApp', phone: 'Téléphone' }
    const when = s => new Date(s).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    const all = d.bookings || []
    const up = all.filter(b => b.status === 'booked' && Date.parse(b.end_at) > now)
    const past = all.filter(b => !up.includes(b)).reverse()
    badge('demos', up.length)
    alertDemos(all, up, when, CH)
    const row = b => `<tr><td>${esc(when(b.start_at))}</td><td><b style="font-weight:500">${esc(b.name)}</b>${b.bar ? ' · ' + esc(b.bar) : ''}<br><span class="muted">${esc(b.email)}${b.phone ? ' · ' + esc(b.phone) : ''}</span>${b.message ? `<br><span class="muted">${esc(b.message)}</span>` : ''}</td><td><span class="tag ${b.status === 'cancelled' ? 'bad' : 'gold'}">${b.status === 'cancelled' ? 'Annulé' : esc(CH[b.channel] || b.channel)}</span></td></tr>`
    v.innerHTML = `<h2>Rendez-vous</h2><p class="lead">Démos réservées sur Bar Ops Venue (heure de Paris). Réglages et fermetures de créneaux : onglet Démos de Venue. <button data-go="venue" style="margin-left:8px" class="tab">Ouvrir Venue</button></p>
      <h3>À venir (${up.length})</h3>${up.length ? `<table><tr><th>Quand</th><th>Qui</th><th>Canal</th></tr>${up.map(row).join('')}</table>` : '<p class="muted">Aucun rendez-vous à venir.</p>'}
      <h3>Passés et annulés (60 derniers jours)</h3>${past.length ? `<table><tr><th>Quand</th><th>Qui</th><th>Statut</th></tr>${past.map(row).join('')}</table>` : '<p class="muted">Aucun.</p>'}`
  },
}
// Alerte Mac : une notification par nouveau problème, puis une quand tout est revenu au vert
function alertHealth(issues) {
  let seen = []
  try { seen = JSON.parse(localStorage.getItem('hq_alerts') || '[]') } catch (_) {}
  const keys = issues.map(i => i[0])
  const notify = (title, body) => window.hq.notify(title, body, 'health')
  issues.filter(i => !seen.includes(i[0])).forEach(i => notify('⚠️ ' + i[0], i[1]))
  if (seen.length && !keys.length) notify('✅ Ops HQ : tout est revenu au vert')
  try { localStorage.setItem('hq_alerts', JSON.stringify(keys)) } catch (_) {}
}
// Alertes Mac des démos : nouvelle réservation, annulation, et rappel 15 min avant
let upcoming = []
const bid = b => b.id ?? (b.start_at + '|' + b.email)
function alertDemos(all, up, when, CH) {
  upcoming = up.map(b => ({ ...b, label: when(b.start_at), ch: CH[b.channel] || b.channel }))
  let seen = null
  try { seen = JSON.parse(localStorage.getItem('hq_demos')) } catch (_) {}
  const notify = (title, body) => window.hq.notify(title, body, 'demos')
  if (seen) {
    upcoming.filter(b => !seen.includes(bid(b))).forEach(b => notify('📅 Nouvelle démo : ' + b.name, `${b.label} · ${b.ch}${b.bar ? ' · ' + b.bar : ''}`))
    all.filter(b => b.status === 'cancelled' && seen.includes(bid(b))).forEach(b => notify('❌ Démo annulée : ' + b.name, when(b.start_at)))
  }
  try { localStorage.setItem('hq_demos', JSON.stringify(upcoming.map(bid))) } catch (_) {}
}
const reminded = new Set()
setInterval(() => {
  const now = Date.now()
  upcoming.forEach(b => {
    const t = Date.parse(b.start_at) - now
    if (t > 0 && t <= 15 * 60000 && !reminded.has(bid(b))) {
      reminded.add(bid(b))
      window.hq.notify('⏰ Démo dans ' + Math.ceil(t / 60000) + ' min : ' + b.name, `${b.ch}${b.phone ? ' · ' + b.phone : ''}${b.bar ? ' · ' + b.bar : ''}`, 'demos')
    }
  })
}, 60000)
async function load(id) {
  const v = views[id]
  if (!v.innerHTML) v.innerHTML = '<p class="loading">Chargement…</p>'
  try { await render[id](v) } catch (e) { v.innerHTML = `<p class="err">Erreur : ${esc(e.message)}</p>` }
}
document.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) show(b.dataset.go) })

function bar() {
  const p = TABS.find(x => x.id === current), v = views[current]
  $('title').textContent = p.name
  let u = ''
  try { u = v.getURL ? v.getURL() : '' } catch (_) {}
  $('url').textContent = u.replace(/^https:\/\//, '')
}
function show(id) {
  current = id
  try { localStorage.setItem('hq_tab', id) } catch (_) {}
  document.querySelectorAll('.tab[data-id]').forEach(t => t.classList.toggle('on', t.dataset.id === id))
  Object.entries(views).forEach(([k, v]) => v.classList.toggle('on', k === id))
  bar()
  if (render[id]) load(id)
}
const wv = () => views[current]?.reload ? views[current] : null
const act = {
  reload: () => render[current] ? load(current) : wv()?.reload(),
  back: () => { const v = wv(); if (v?.canGoBack()) v.goBack() },
  home: () => { const p = PLATFORMS.find(x => x.id === current); if (p && wv()) wv().loadURL(p.url) },
}
$('reload').onclick = act.reload; $('back').onclick = act.back; $('home').onclick = act.home
window.hq.on('go', show)
// Retour de la connexion Google faite dans le navigateur du Mac (lien opshq://helm#jetons)
window.hq.on('helm-auth', hash => { show('helm'); views.helm.loadURL(PLATFORMS.find(p => p.id === 'helm').url + '?hq=1' + hash) })
window.hq.on('reload', act.reload); window.hq.on('home', act.home); window.hq.on('back', act.back)
// Pastilles des vues réunies chargées au démarrage, puis toutes les 10 min
// (la santé est vérifiée toutes les 5 min, même si son onglet est ouvert, pour les alertes Mac)
const refreshBadges = () => HQ.forEach(p => p.id !== current && load(p.id))
show(current); refreshBadges(); setInterval(refreshBadges, 600000)
setInterval(() => { load('health'); load('demos') }, 300000)
