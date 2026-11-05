/** Buscador de sucursales: texto, cercanía (geolocalización), filtros y zoom del mapa a la sucursal elegida. */
import sucursales from '../data/sucursales.json'
import { MAP, haversine, project, strip } from '../lib/geo'

type S = { n: string; t: string; a: string; l: string; p: string; cp: string; la: number; lo: number; h: string; b: number }
const ALL = sucursales as S[]
const root = document.querySelector<HTMLElement>('[data-finder]')!
const q = root.querySelector<HTMLInputElement>('[data-fnd-q]')!
const listEl = root.querySelector<HTMLOListElement>('[data-fnd-list]')!
const count = root.querySelector<HTMLElement>('[data-fnd-count]')!
const svg = root.querySelector<SVGSVGElement>('[data-fnd-svg]')!
const dots = [...root.querySelectorAll<SVGCircleElement>('.fnd__dots circle')]
const me = root.querySelector<SVGGElement>('[data-fnd-me]')!
const selMk = root.querySelector<SVGGElement>('[data-fnd-sel]')!
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
const FULL = [-30, -10, MAP.w + 60, MAP.h + 20]
let vb = [...FULL]
let types = new Set<string>()
let here: { la: number; lo: number } | null = null
let shown: { s: S; i: number; km?: number }[] = []

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

function animateVB(to: number[]) {
  const from = [...vb]
  if (reduced) { vb = to; svg.setAttribute('viewBox', vb.join(' ')); return }
  const t0 = performance.now(), dur = 900
  const step = (t: number) => {
    const k = Math.max(0, Math.min(1, (t - t0) / dur)), e = 1 - Math.pow(1 - k, 4)
    vb = from.map((f, i) => f + (to[i] - f) * e)
    svg.setAttribute('viewBox', vb.map((v) => v.toFixed(2)).join(' '))
    if (k < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}
const focusPoint = (x: number, y: number, w = 150) => animateVB([x - w / 2, y - w * 0.7, w, w * 1.4])
function fitPoints(pts: { x: number; y: number }[]) {
  if (!pts.length) return animateVB(FULL)
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y)
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
  const pad = 40
  let w = Math.max(120, x1 - x0 + pad * 2), h = Math.max(170, y1 - y0 + pad * 2)
  // mantener la proporción del contenedor
  const r = svg.clientWidth / Math.max(1, svg.clientHeight)
  if (w / h < r) w = h * r; else h = w / r
  animateVB([(x0 + x1) / 2 - w / 2, (y0 + y1) / 2 - h / 2, w, h])
}

function render() {
  const s = strip(q.value)
  let res = ALL.map((x, i) => ({ s: x, i, km: here ? haversine(here, x) : undefined }))
  if (s) res = res.filter(({ s: x }) => strip(`${x.n} ${x.l} ${x.p} ${x.cp} ${x.a}`).includes(s) || x.cp.startsWith(s))
  if (types.size) res = res.filter(({ s: x }) => types.has(x.t))
  if (here) res.sort((a, b) => a.km! - b.km!)
  shown = res
  const hit = new Set(res.map((r) => r.i))
  dots.forEach((d, i) => { d.classList.toggle('hit', hit.has(i) && res.length < ALL.length); d.classList.toggle('off', !hit.has(i)) })
  count.textContent = res.length === ALL.length && !here ? `${ALL.length} puntos de atención` : `${res.length} resultado${res.length === 1 ? '' : 's'}${here ? ' · ordenados por cercanía' : ''}`
  listEl.innerHTML = res.slice(0, 120).map(({ s: x, i, km }) => `
    <li tabindex="0" data-i="${i}">
      <div class="fi__top"><span class="fi__n">${esc(x.n)}</span>${km !== undefined ? `<span class="fi__km">${km < 10 ? km.toFixed(1) : Math.round(km)} km</span>` : ''}</div>
      <span class="fi__t">${esc(x.t)}${x.b ? ' · buzón inteligente' : ''}</span>
      <span class="fi__a">${esc(x.a)} · ${esc(x.l)}, ${esc(x.p)}${x.cp ? ' · CP ' + esc(x.cp) : ''}</span>
      ${x.h ? `<span class="fi__h">${esc(x.h.replace(/;\s*$/, '').replace(/;/g, ' · '))}</span>` : ''}
      <a class="fi__go" href="https://www.google.com/maps/dir/?api=1&destination=${x.la},${x.lo}" target="_blank" rel="noopener">Cómo llegar ↗</a>
    </li>`).join('') + (res.length > 120 ? `<li class="fi__more mono">Y ${res.length - 120} más. Afiná la búsqueda.</li>` : '') + (res.length ? '' : '<li class="mono">No encontramos sucursales con esa búsqueda. Probá con la provincia.</li>')
  if (s || types.size) fitPoints(res.map(({ s: x }) => project(x.la, x.lo)))
}

function select(i: number) {
  const x = ALL[i]
  const p = project(x.la, x.lo)
  selMk.setAttribute('transform', `translate(${p.x} ${p.y})`)
  selMk.classList.add('on')
  listEl.querySelectorAll('li').forEach((li) => li.classList.toggle('on', li.dataset.i === String(i)))
  focusPoint(p.x, p.y)
}

let timer = 0
q.addEventListener('input', () => { clearTimeout(timer); timer = window.setTimeout(render, 140) })
listEl.addEventListener('click', (e) => {
  if ((e.target as Element).closest('a')) return
  const li = (e.target as Element).closest<HTMLElement>('li[data-i]')
  if (li) select(+li.dataset.i!)
})
listEl.addEventListener('keydown', (e) => {
  const li = (e.target as Element).closest<HTMLElement>('li[data-i]')
  if (li && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(+li.dataset.i!) }
})
svg.addEventListener('click', (e) => {
  const c = (e.target as Element).closest<SVGCircleElement>('circle[data-i]')
  if (!c) return
  const i = +c.dataset.i!
  select(i)
  listEl.querySelector<HTMLElement>(`li[data-i="${i}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
})
root.querySelectorAll<HTMLButtonElement>('[data-fnd-type]').forEach((b) => b.addEventListener('click', () => {
  const t = b.dataset.fndType!
  if (types.has(t)) types.delete(t); else types.add(t)
  b.setAttribute('aria-pressed', String(types.has(t)))
  render()
}))
root.querySelector('[data-fnd-reset]')!.addEventListener('click', () => { selMk.classList.remove('on'); animateVB(FULL) })
const geoBtn = root.querySelector<HTMLButtonElement>('[data-fnd-geo]')!
geoBtn.addEventListener('click', () => {
  if (!navigator.geolocation) { count.textContent = 'Tu navegador no permite ubicarte.'; return }
  count.textContent = 'Buscando tu ubicación…'
  navigator.geolocation.getCurrentPosition((pos) => {
    here = { la: pos.coords.latitude, lo: pos.coords.longitude }
    const p = project(here.la, here.lo)
    me.setAttribute('transform', `translate(${p.x} ${p.y})`); me.classList.add('on')
    q.value = ''
    render()
    const near = shown.slice(0, 5)
    fitPoints([p, ...near.map(({ s: x }) => project(x.la, x.lo))])
    if (near[0]) select(near[0].i)
  }, () => { count.textContent = 'No pudimos acceder a tu ubicación. Buscá por localidad.' }, { enableHighAccuracy: false, timeout: 8000 })
})

const init = new URLSearchParams(location.search).get('q')
if (init) q.value = init
render()
