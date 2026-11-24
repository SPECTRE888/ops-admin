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

let demoDay = null
const toast = (msg, bad) => { let t = $('toast'); if (!t) { t = Object.assign(document.createElement('div'), { id: 'toast' }); document.body.appendChild(t) } t.textContent = msg; t.className = 'show' + (bad ? ' bad' : ''); clearTimeout(t._h); t._h = setTimeout(() => t.className = '', 2800) }
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
    // Menu « Simuler un problème de santé » : faux problème sur Helm → Stripe, sans toucher aux alertes vues
    const fake = fakeHealth && d.helm?.checks?.[2]
    if (fake) { fakeHealth = false; Object.assign(d.helm.checks[2], { ok: false, detail: 'FAUX PROBLÈME pour tester, rien de cassé' }) }
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
    if (fake) { let old = null; try { old = localStorage.getItem('hq_alerts'); localStorage.setItem('hq_alerts', '[]') } catch (_) {}; alertHealth(issues); try { localStorage.setItem('hq_alerts', old || '[]') } catch (_) {} } else alertHealth(issues)
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
    // Même écran que l'onglet Démos du super admin Venue, avec ses actions (passées par l'app Mac avec la clé admin)
    const WD = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'], days = d.days || [], st = d.settings || { open_days: [] }
    if (!demoDay || !days.some(x => x.date === demoDay)) demoDay = days[0]?.date
    const day = days.find(x => x.date === demoDay) || { slots: [] }
    const dayBlock = day.slots.length && day.slots.every(s => s.state === 'blocked' && s.blockId === day.slots[0].blockId) ? day.slots[0].blockId : null
    const dshort = s => new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
    const ctitle = (t, extra = '') => `<div class="ctitle">${t}<span class="ctitle-rule"></span>${extra}</div>`
    const bk = (b, actions) => `<div class="bk"><div class="when">${esc(when(b.start_at))}</div>
      <div class="who"><strong>${esc(b.name)}</strong>${b.bar ? ' · ' + esc(b.bar) : ''} <span class="tag plain ${b.status === 'cancelled' ? 'bad' : 'gold'}">${b.status === 'cancelled' ? 'Annulé' + (b.cancelled_by === 'client' ? ' par le client' : '') : esc(CH[b.channel] || b.channel)}</span><br>
      <span class="muted">${esc(b.phone || '')}${b.phone ? ' · ' : ''}${esc(b.email)}</span>${b.message ? `<div class="muted">« ${esc(b.message)} »</div>` : ''}</div>
      ${actions ? `<button class="btn btn-sm btn-danger" data-cancel="${esc(b.id)}">Annuler</button>` : ''}</div>`
    const warn = [d.notify === false && 'Aucune adresse pour vos e-mails (DEMO_NOTIFY_EMAIL ou SUPER_ADMIN_EMAILS)', d.cron === false && 'CRON_SECRET absent : le récap du matin ne partira pas', d.settings && !st.meet_link && 'Pas de lien Meet : la visio n\'est pas proposée aux clients'].filter(Boolean)
    // Réglages repliés quand tout va bien, avec leur résumé sur une ligne
    const od = [1, 2, 3, 4, 5, 6, 0].filter(n => (st.open_days || []).includes(n)).map(n => WD[n])
    const setSum = d.settings ? `${od.length === 7 ? 'Tous les jours' : od.join(' ')} · ${st.start_time}–${st.end_time} · ${st.slot_minutes} min · ${st.horizon_days} jours${st.meet_link ? ' · Meet' : ''}` : ''
    const blocks = {}; days.forEach(x => x.slots.forEach(s => { if (!s.blockId) return; const k = blocks[s.blockId] = blocks[s.blockId] || { id: s.blockId, from: x.date, to: x.date, n: 0 }; k.to = x.date; k.n++ }))
    const big = Object.values(blocks).filter(k => k.n > 1)
    v.innerHTML = `<h2>Rendez-vous</h2><p class="lead">Démos réservées sur Bar Ops Venue, en heure de Paris. Les changements faits ici s'appliquent directement à Venue.</p>
      ${warn.length ? `<div class="card" style="border-color:var(--red-bg)">${warn.map(w => `<div class="row"><span class="dot bad"></span>${esc(w)}</div>`).join('')}</div>` : ''}
      <div class="card">${ctitle('Rendez-vous à venir', `<span class="cnt">${up.length}</span>`)}
        ${up.length ? up.map(b => bk(b, true)).join('') : '<div class="empty">Aucune démo prévue</div>'}
        <div class="hint">Page publique : bar-ops-venue.vercel.app/demo.html · Récap par e-mail chaque matin vers 7 h s'il y a des démos dans la journée.</div></div>
      ${days.length ? `<div class="card">${ctitle('Créneaux', '<span class="cnt">cliquez un créneau pour le fermer ou le rouvrir</span>')}
        <div class="days">${days.map(x => { const dd = new Date(x.date + 'T12:00:00Z'), free = x.slots.filter(s => s.state === 'free').length, nb = x.slots.filter(s => s.state === 'booked').length
          return `<button class="day${x.date === demoDay ? ' on' : ''}${x.open && free + nb ? '' : ' shut'}" data-day="${x.date}">${WD[x.weekday]}<b>${dd.getUTCDate()}</b><small>${!x.open || (!free && !nb && x.slots.some(s => s.state === 'blocked')) ? 'fermé' : nb ? nb + ' rdv' : free ? free + ' libre' + (free > 1 ? 's' : '') : 'complet'}</small></button>` }).join('')}</div>
        <div class="slots">${day.slots.map(s => `<button class="slot ${s.state}" data-slot="${esc(s.start)}" data-block="${esc(s.blockId || '')}" ${['booked', 'past', 'closed'].includes(s.state) ? 'disabled' : ''}>${s.time}<small>${{ free: 'libre', blocked: 'fermé', booked: 'réservé', past: 'passé', closed: 'jour fermé' }[s.state]}</small></button>`).join('') || '<div class="empty">Aucun créneau ce jour-là</div>'}</div>
        <div class="bar" style="margin:16px 0 0">
          ${dayBlock ? '<button class="btn" id="dayOpen">Rouvrir la journée</button>' : '<button class="btn btn-danger" id="dayShut">Fermer la journée</button>'}
          <span class="muted" style="font-size:11px;margin-left:8px">Fermer une période :</span>
          <input type="date" id="pFrom" min="${days[0]?.date || ''}"><input type="date" id="pTo" min="${days[0]?.date || ''}">
          <input id="pNote" placeholder="Motif (facultatif)" maxlength="120" style="width:160px">
          <button class="btn" id="pShut">Fermer</button>
        </div>
        ${big.length ? `<div class="hint">Fermetures en cours : ${big.map(k => `${dshort(k.from)}${k.to !== k.from ? ' → ' + dshort(k.to) : ''} <a href="#" data-unblock="${esc(k.id)}" style="color:var(--gold)">rouvrir</a>`).join(' · ')}</div>` : ''}
      </div>` : ''}
      ${d.settings ? `<details class="card set"${!st.meet_link || !(st.open_days || []).length ? ' open' : ''}><summary>${ctitle('Réglages', `<span class="cnt">${esc(setSum)}</span><span class="chev"></span>`)}</summary>
        <div class="wd">${[1, 2, 3, 4, 5, 6, 0].map(n => `<label><input type="checkbox" class="owd" value="${n}" ${st.open_days.includes(n) ? 'checked' : ''}>${WD[n]}</label>`).join('')}</div>
        <div class="fgrid">
          <label>Début<input type="time" id="sStart" value="${esc(st.start_time)}" step="900"></label>
          <label>Fin<input type="time" id="sEnd" value="${esc(st.end_time)}" step="900"></label>
          <label>Durée d'une démo<select id="sDur">${[15, 20, 30, 45, 60].map(n => `<option value="${n}" ${n === st.slot_minutes ? 'selected' : ''}>${n} min</option>`).join('')}</select></label>
          <label>Délai minimum<select id="sNotice">${[[0, 'Aucun'], [1, '1 h'], [2, '2 h'], [3, '3 h'], [6, '6 h'], [12, '12 h'], [24, '24 h'], [48, '48 h']].map(([n, l]) => `<option value="${n}" ${n === st.min_notice_hours ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label>Réservable sur<select id="sHor">${[7, 14, 30, 60, 90].map(n => `<option value="${n}" ${n === st.horizon_days ? 'selected' : ''}>${n} jours</option>`).join('')}</select></label>
        </div>
        <label class="flab">Lien Google Meet fixe<input id="sMeet" value="${esc(st.meet_link || '')}" placeholder="https://meet.google.com/abc-defg-hij"></label>
        <div class="bar" style="margin:14px 0 0"><button class="btn btn-gold" id="sSave">Enregistrer</button></div>
        <div class="hint">Changer les horaires ne touche pas aux rendez-vous déjà pris.</div></details>` : ''}
      ${past.length ? `<div class="card">${ctitle('Passés et annulés', '<span class="cnt">60 derniers jours</span>')}${past.map(b => bk(b, false)).join('')}</div>` : ''}`

    const $v = sel => v.querySelector(sel), all$ = sel => v.querySelectorAll(sel)
    const post = async (body, okMsg) => { const r = await window.hq.demo(body); if (r?.error) return toast(r.error, true); toast(okMsg); load('demos') }
    all$('[data-day]').forEach(x => x.onclick = () => { demoDay = x.dataset.day; load('demos') })
    all$('.slot.free').forEach(x => x.onclick = () => post({ action: 'demo_block', start: x.dataset.slot }, 'Créneau fermé'))
    all$('.slot.blocked').forEach(x => x.onclick = () => {
      const n = day.slots.filter(s => s.blockId === x.dataset.block).length
      if (n > 1 && !confirm('Ce créneau fait partie d\'une fermeture plus large. Rouvrir toute la fermeture ?')) return
      post({ action: 'demo_unblock', id: x.dataset.block }, 'Créneau rouvert')
    })
    all$('[data-unblock]').forEach(x => x.onclick = e => { e.preventDefault(); if (confirm('Rouvrir cette période ?')) post({ action: 'demo_unblock', id: x.dataset.unblock }, 'Période rouverte') })
    if ($v('#dayShut')) $v('#dayShut').onclick = () => { if (day.slots.some(s => s.state === 'booked') && !confirm('Des démos sont déjà prévues ce jour-là : elles restent maintenues. Fermer le reste de la journée ?')) return; post({ action: 'demo_block', date: demoDay }, 'Journée fermée') }
    if ($v('#dayOpen')) $v('#dayOpen').onclick = () => post({ action: 'demo_unblock', id: dayBlock }, 'Journée rouverte')
    if ($v('#pShut')) $v('#pShut').onclick = () => {
      const f = $v('#pFrom').value, t = $v('#pTo').value || f
      if (!f) return toast('Choisissez la date de début', true)
      if (t < f) return toast('La date de fin est avant la date de début', true)
      post({ action: 'demo_block', date: f, dateTo: t, note: $v('#pNote').value }, 'Période fermée')
    }
    all$('[data-cancel]').forEach(x => x.onclick = () => {
      const b = all.find(y => y.id === x.dataset.cancel)
      if (!confirm(`Annuler la démo de ${b.name} (${when(b.start_at)}) ?`)) return
      const notify = confirm('Prévenir le client par e-mail ?')
      post({ action: 'demo_cancel', id: b.id, notify }, notify ? 'Démo annulée, client prévenu' : 'Démo annulée')
    })
    if ($v('#sSave')) $v('#sSave').onclick = () => post({ action: 'demo_settings', open_days: [...all$('.owd:checked')].map(i => Number(i.value)),
      start_time: $v('#sStart').value, end_time: $v('#sEnd').value, slot_minutes: Number($v('#sDur').value), min_notice_hours: Number($v('#sNotice').value),
      horizon_days: Number($v('#sHor').value), meet_link: $v('#sMeet').value.trim() }, 'Réglages enregistrés')
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
let fakeHealth = false
window.hq.on('fake-health', () => { fakeHealth = true; show('health') })
// Menu « Simuler une démo » : fausse démo dans 10 min → alerte « Nouvelle démo » puis rappel dans la minute
window.hq.on('fake-demo', () => {
  const when = s => new Date(s).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  const fake = { id: 'fake-' + Date.now(), name: 'Démo test', bar: 'Le Bar Test', email: 'test@example.com', phone: '06 00 00 00 00', channel: 'visio', status: 'booked', start_at: new Date(Date.now() + 10 * 60000).toISOString() }
  const list = [...upcoming, fake]
  try { localStorage.setItem('hq_demos', JSON.stringify(upcoming.map(bid))) } catch (_) {}
  alertDemos(list, list, when, { visio: 'Visio Meet', whatsapp: 'WhatsApp', phone: 'Téléphone' })
})
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
