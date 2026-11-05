/** Seguimiento (demo): genera un recorrido creíble a partir del número, siempre igual para el mismo número. */
import localidades from '../data/localidades.json'
import { arc, haversine, project } from '../lib/geo'

type Place = { l: string; p: string; la: number; lo: number }
const L = localidades as Place[]
const $ = <T extends Element = HTMLElement>(s: string) => document.querySelector<T>(s)!
const t = (k: string) => document.querySelector<HTMLElement & SVGElement>(`[data-t="${k}"]`)!
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
let anim: Animation | null = null

function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296 }
}
const hash = (s: string) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261)
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
/** Lugar pasado por la URL (lo genera la etiqueta del cotizador): "Rosario, Santa Fe" + "-32.97,-60.67" */
const placeFrom = (v: string | null, c: string | null): Place | null => {
  if (!v || !c) return null
  const [la, lo] = c.split(',').map(Number)
  if (!(la < -20 && la > -56 && lo < -52 && lo > -75)) return null
  const [l, p = ''] = v.split(', ')
  return { l: l.slice(0, 60), p: p.slice(0, 40), la, lo }
}
const full = (p: { l: string; p: string }) => (p.l === p.p || !p.p ? p.l : `${p.l}, ${p.p}`)
const fmt = (d: Date) => d.toLocaleString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

function track(n: string) {
  const err = $('[data-trk-err]'), out = $('[data-trk-out]')
  const clean = n.replace(/\D/g, '')
  if (clean.length < 10 || clean.length > 20) {
    err.textContent = 'Ingresá un número de seguimiento válido: solo números, sin guiones ni puntos.'
    err.hidden = false; out.hidden = true
    return
  }
  err.hidden = true
  const r = rng(hash(clean))
  const P = new URLSearchParams(location.search)
  const own = P.get('n') === clean ? { o: placeFrom(P.get('o'), P.get('oc')), d: placeFrom(P.get('d'), P.get('dc')) } : null
  const mine = !!(own?.o && own.d)
  const big = L.filter((p) => ['CABA', 'Córdoba', 'Rosario', 'Mendoza', 'La Plata', 'Mar del Plata'].includes(p.l))
  let from = big.length ? big[Math.floor(r() * big.length)] : L[0]
  let to = L[Math.floor(r() * L.length)]
  while (haversine(from, to) < 80) to = L[Math.floor(r() * L.length)]
  if (mine) { from = own!.o!; to = own!.d! }
  const km = Math.round(haversine(from, to) * 1.22)
  const stage = mine ? 0 : clean === '360002614871055' ? 3 : Math.floor(r() * 5)
  const progress = [0.02, 0.1, 0.3, 0.55 + r() * 0.3, 1][stage]
  const statuses = ['Preparado para despachar', 'Despachado', 'En planta de clasificación', 'En camino', 'Entregado']
  t('code').textContent = clean
  t('status').textContent = statuses[stage]
  t('from').textContent = full(from)
  t('to').textContent = full(to)
  const now = new Date()
  const etaDays = stage === 4 ? 0 : Math.max(1, Math.round((km / 500) * (1 - progress)) + 1)
  const eta = new Date(now.getTime() + etaDays * 86400000)
  t('eta').textContent = stage === 4 ? `Entregado el ${fmt(new Date(now.getTime() - 3600000 * 3))}.` : `Llega ${etaDays === 1 ? 'mañana' : 'el ' + eta.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}, entre las 9 y las 18 h.`
  document.querySelectorAll<HTMLElement>('[data-stage]').forEach((li, i) => { li.classList.toggle('done', i < stage || stage === 4); li.classList.toggle('now', i === stage && stage < 4) })
  // eventos (más reciente arriba)
  const evs = [
    { s: 0, b: 'Envío creado', d: `Etiqueta generada en ${from.l}` },
    { s: 1, b: 'Recibido en sucursal', d: full(from) },
    { s: 2, b: 'Clasificado en Planta Pacheco', d: 'Ruta asignada automáticamente' },
    { s: 3, b: 'En viaje al centro de distribución', d: `Destino: ${to.l}` },
    { s: 3, b: 'En reparto', d: 'El paquete salió con el repartidor' },
    { s: 4, b: 'Entregado', d: `Recibido en ${to.l}` },
  ].filter((e) => e.s <= stage)
  let tt = now.getTime() - 3600000 * (1 + r() * 2)
  if (mine) tt = now.getTime() - 60000
  const rows = evs.reverse().map((e) => { const row = `<li><time>${fmt(new Date(tt))}</time><span><b>${esc(e.b)}</b><small>${esc(e.d)}</small></span></li>`; tt -= 3600000 * (5 + r() * 14); return row })
  t('events').innerHTML = rows.join('')
  const svc = mine ? (P.get('s') === 'prio' ? 'Prioritario' : 'Estándar') : stage % 2 ? 'Estándar' : 'Prioritario'
  const bultos = mine ? String(Math.max(1, Math.min(50, parseInt(P.get('b') || '1', 10) || 1))) : '1'
  const entrega = mine ? (P.get('e') === 'sucursal' ? 'En sucursal' : 'A domicilio') : r() > 0.4 ? 'A domicilio' : 'En sucursal'
  t('meta').innerHTML = [['Servicio', svc], ['Distancia', `≈ ${km.toLocaleString('es-AR')} km`], ['Bultos', bultos], ['Entrega', entrega]].map(([a, b]) => `<div><span>${a}</span><b>${esc(b)}</b></div>`).join('')
  // mapa
  const a = project(from.la, from.lo), b = project(to.la, to.lo)
  const d = arc(a, b)
  t('arc').setAttribute('d', d); t('arcbg').setAttribute('d', d)
  const arcEl = t('arc') as unknown as SVGPathElement
  const len = arcEl.getTotalLength()
  arcEl.style.strokeDasharray = `${len}`
  arcEl.style.strokeDashoffset = `${len}`
  t('mo').setAttribute('transform', `translate(${a.x} ${a.y})`)
  t('md').setAttribute('transform', `translate(${b.x} ${b.y})`)
  out.hidden = false
  out.classList.remove('in-anim'); void out.offsetWidth; out.classList.add('in-anim')
  anim?.cancel()
  const truck = t('truck')
  truck.style.offsetPath = `path("${d}")`
  truck.style.offsetRotate = '0deg'
  if (reduced) {
    arcEl.style.strokeDashoffset = `${len * (1 - progress)}`
    truck.style.offsetDistance = `${progress * 100}%`
  } else {
    arcEl.animate([{ strokeDashoffset: len }, { strokeDashoffset: len * (1 - progress) }], { duration: 2200, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' })
    anim = truck.animate([{ offsetDistance: '0%' }, { offsetDistance: `${progress * 100}%` }], { duration: 2200, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' })
  }
  if (!mine) history.replaceState(null, '', `?n=${clean}`)
}

const form = $<HTMLFormElement>('[data-trk-form]')
const input = $<HTMLInputElement>('#trk-n')
form.addEventListener('submit', (e) => { e.preventDefault(); track(input.value) })
$('[data-trk-ex]').addEventListener('click', () => { input.value = '360002614871055'; track(input.value) })
const q = new URLSearchParams(location.search).get('n')
if (q) {
  input.value = q
  track(q)
  // llegó desde un enlace o un QR: mostrar el resultado directamente
  setTimeout(() => {
    const out = $('[data-trk-out]')
    if (out.hidden) return
    const l = (window as unknown as { __lenis?: { scrollTo: (t: Element, o?: object) => void } }).__lenis
    if (l) l.scrollTo(out, { offset: -110, duration: 1.1 }); else scrollTo({ top: out.getBoundingClientRect().top + scrollY - 110, behavior: reduced ? 'auto' : 'smooth' })
  }, 450)
}
