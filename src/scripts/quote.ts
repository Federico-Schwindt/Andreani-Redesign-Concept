/**
 * Cotizador y reserva en 6 pasos: bultos (filas o planilla CSV) y ruta con autocompletado (lista local + Georef),
 * precios al instante que se actualizan en vivo, sucursales reales más cercanas, resumen, pago (demo) y etiqueta
 * con un QR que abre el seguimiento de ese mismo envío. Precios: estimación de demostración.
 */
import localidades from '../data/localidades.json'
import { MAP, arc, haversine, project, strip } from '../lib/geo'

type Place = { l: string; p: string; cp?: string; la: number; lo: number }
type Item = { q: number; kg: number; l: number; a: number; h: number; b: number }
type Suc = { n: string; t: string; a: string; l: string; p: string; cp: string; la: number; lo: number; h: string; b: number }
type Near = Suc & { km: number }
type Tipo = 'paquete' | 'sobre' | 'vinos' | 'bigger'
type K = 'o' | 'd'

const LOCAL = localidades as Place[]
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
const money = (v: number) => '$ ' + (Math.round(v / 10) * 10).toLocaleString('es-AR')
const num = (v: number, d = 1) => v.toLocaleString('es-AR', { maximumFractionDigits: d })
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const FULL = [-40, -20, MAP.w + 80, MAP.h + 40]
const STEPS = ['Bultos', 'Origen', 'Destino', 'Contacto', 'Pago', 'Etiqueta']

/* ---------- bultos ---------- */
const BOTELLAS = [1, 2, 3, 4, 6]
const wine = (b: number) => ({ kg: b * 1.45 + 0.4, l: b >= 4 ? 27 : b >= 2 ? 18 : 10, a: b >= 4 ? 18 : 10, h: 34 })
const PRESET: Record<string, Item> = {
  paquete: { q: 1, kg: 3, l: 40, a: 30, h: 20, b: 0 },
  sobre: { q: 1, kg: 0.3, l: 35, a: 25, h: 1, b: 0 },
  vinos: { q: 1, kg: 0, l: 0, a: 0, h: 0, b: 6 },
  caja: { q: 1, kg: 40, l: 80, a: 60, h: 60, b: 0 },
  pallet: { q: 1, kg: 300, l: 120, a: 100, h: 150, b: 0 },
}
const LIMIT: Record<Tipo, { kg: number; side: number }> = { paquete: { kg: 50, side: 150 }, sobre: { kg: 0.5, side: 35 }, vinos: { kg: 30, side: 60 }, bigger: { kg: 1200, side: 240 } }
const dimsOf = (tipo: Tipo, it: Item) => (tipo === 'vinos' ? wine(it.b) : tipo === 'sobre' ? { l: 35, a: 25, h: 1 } : it)
const realKg = (tipo: Tipo, it: Item) => (tipo === 'vinos' ? wine(it.b).kg : it.kg)
const billable = (tipo: Tipo, it: Item) => {
  if (tipo === 'sobre') return it.kg
  const d = dimsOf(tipo, it)
  return Math.max(realKg(tipo, it), (d.l * d.a * d.h) / 4000)
}

/* ---------- precios y plazos (modelo de demo) ---------- */
function calc(km: number, tipo: Tipo, items: Item[], desp: string, ent: string) {
  const bultos = items.reduce((s, it) => s + it.q, 0)
  const kg = items.reduce((s, it) => s + it.q * billable(tipo, it), 0)
  const real = items.reduce((s, it) => s + it.q * realKg(tipo, it), 0)
  let p = tipo === 'sobre'
    ? 4900 + (bultos - 1) * 1600 + Math.max(0, kg - 0.5 * bultos) * 900
    : 7400 + (bultos - 1) * 3600 + Math.max(0, kg - bultos) * (tipo === 'bigger' ? 640 : 1150)
  p *= 1 + Math.min(km, 3600) / 1600
  if (tipo === 'vinos') p *= 1.12
  const dom = p * 0.18
  if (ent === 'domicilio') p += dom
  if (desp === 'retiro') p += 3900
  return { bultos, kg, real, std: p, prio: p * 1.38, ahorro: ent === 'domicilio' ? dom : 0 }
}
function etaDays(km: number, prio: boolean) {
  let [a, b] = km < 60 ? [1, 1] : km < 400 ? [1, 2] : km < 1200 ? [2, 4] : [3, 6]
  if (prio) { a = Math.max(1, a - 1); b = Math.max(1, Math.ceil(b * 0.55)) }
  return [a, b]
}

/* ---------- fechas (días hábiles) ---------- */
const fmtD = (d: Date) => d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '').replace(',', '')
const addBiz = (d: Date, n: number) => { const x = new Date(d); while (n > 0) { x.setDate(x.getDate() + 1); if (x.getDay() % 6) n-- } return x }
const DAYS = (() => { const out: Date[] = []; const d = new Date(); d.setHours(12, 0, 0, 0); while (out.length < 6) { d.setDate(d.getDate() + 1); if (d.getDay() % 6) out.push(new Date(d)) } return out })()
const isTomorrow = (d: Date) => { const t = new Date(); t.setDate(t.getDate() + 1); return t.toDateString() === d.toDateString() }

/* ---------- localidades ---------- */
const SMALL = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'el'])
const title = (s: string) => s.toLocaleLowerCase('es-AR').split(' ').map((w, i) => (i && SMALL.has(w) ? w : w.charAt(0).toLocaleUpperCase('es-AR') + w.slice(1))).join(' ')
async function georef(q: string, signal: AbortSignal): Promise<Place[]> {
  const u = `https://apis.datos.gob.ar/georef/api/localidades?nombre=${encodeURIComponent(q)}&max=8&campos=nombre,provincia.nombre,centroide&orden=nombre`
  const r = await fetch(u, { signal })
  if (!r.ok) return []
  const d = await r.json()
  return (d.localidades || []).map((x: { nombre: string; provincia: { nombre: string }; centroide: { lat: number; lon: number } }) => ({
    l: title(x.nombre),
    p: x.provincia.nombre.replace('Ciudad Autónoma de Buenos Aires', 'CABA').replace('Tierra del Fuego, Antártida e Islas del Atlántico Sur', 'Tierra del Fuego'),
    la: x.centroide.lat, lo: x.centroide.lon,
  }))
}
function localSearch(q: string): Place[] {
  const s = strip(q)
  if (!s) return []
  if (/^\d{4}$/.test(s)) {
    const exact = LOCAL.filter((x) => x.cp === s)
    if (exact.length) return exact.slice(0, 6)
    const n = +s
    return [...LOCAL].filter((x) => x.cp).sort((a, b) => Math.abs(+a.cp! - n) - Math.abs(+b.cp! - n)).slice(0, 4)
  }
  return LOCAL.filter((x) => strip(x.l).startsWith(s)).concat(LOCAL.filter((x) => !strip(x.l).startsWith(s) && strip(`${x.l} ${x.p}`).includes(s))).slice(0, 8)
}

/* ---------- rutas frecuentes (ticker y lista del mapa) ---------- */
const LANES: [string, string][] = [['CABA', 'Córdoba'], ['CABA', 'Rosario'], ['Rosario', 'Mendoza'], ['CABA', 'Mar del Plata'], ['Córdoba', 'San Miguel de Tucumán'], ['CABA', 'Neuquén'], ['La Plata', 'Bahía Blanca'], ['CABA', 'Salta'], ['Mendoza', 'CABA'], ['Córdoba', 'Posadas'], ['CABA', 'San Carlos de Bariloche'], ['CABA', 'Ushuaia']]
const SHORT: Record<string, string> = { 'San Miguel de Tucumán': 'Tucumán', 'San Carlos de Bariloche': 'Bariloche' }
const short = (l: string) => SHORT[l] ?? l
/** "Rosario, Santa Fe"; si la localidad y la provincia coinciden (CABA), una sola vez */
const full = (p: { l: string; p: string }) => (p.l === p.p ? p.l : `${p.l}, ${p.p}`)
const LANE_DATA = LANES.map(([a, b]) => {
  const o = LOCAL.find((x) => x.l === a), d = LOCAL.find((x) => x.l === b)
  if (!o || !d) return null
  const km = Math.round(haversine(o, d) * 1.22)
  return { o, d, km, p: calc(km, 'paquete', [{ q: 1, kg: 5, l: 40, a: 30, h: 20, b: 0 }], 'sucursal', 'domicilio').std }
}).filter(Boolean) as { o: Place; d: Place; km: number; p: number }[]

export function initQuote(root: HTMLElement) {
  const $ = <T extends Element = HTMLElement>(s: string) => root.querySelector<T>(s)!
  const $$ = <T extends Element = HTMLElement>(s: string) => [...root.querySelectorAll<T>(s)]
  const form = $<HTMLFormElement>('[data-qform]')
  const panel = $('[data-qpanel]')
  const panes = $$('[data-pane]')
  const stepBtns = $$<HTMLButtonElement>('.qt__st')
  const stage = $('[data-qstage]'), svg = $<SVGSVGElement>('[data-qsvg]')
  const cube = $('.qbox__c'), qbox = $('[data-qbox]'), qn = $('[data-qn]')
  const arcEl = $<SVGPathElement>('[data-qarc]'), arc2 = $<SVGPathElement>('[data-qarc2]'), van = $<SVGGElement>('[data-qvan]')
  const lanesG = $('[data-qlanes]'), candsG = $('[data-qcands]')
  const live = $('[data-qlive] span'), routeTxt = $('[data-qroute]'), vw = $('[data-qvw]')
  const rowsEl = $('[data-qrows]'), sumEl = $('[data-qsum]'), unitEl = $('[data-qunit]'), bulk = $('[data-qbulk]'), addBtn = $<HTMLButtonElement>('[data-qadd]')
  const rates = $('[data-qrates]'), rh = $('[data-qrh] span'), saveBtn = $<HTMLButtonElement>('[data-qsave]'), nextBtn = $<HTMLButtonElement>('[data-qnext]'), nextT = $('[data-qnext-t]')
  const err = $('[data-qerr]'), goBtn = $<HTMLButtonElement>('[data-qgo]'), goT = $('[data-qgo-t]'), toastEl = $('[data-qtoast]')
  const dateEl = $('[data-qdate]'), dateBtn = $<HTMLButtonElement>('[data-qdate-btn]'), daysEl = $('[data-qdays]')
  const lbl = $('[data-qlbl]')
  const L = (k: string) => $(`[data-l="${k}"]`)

  const sel: Record<K, Place | null> = { o: null, d: null }
  const near: Record<K, Near[]> = { o: [], d: [] }
  const pick: Record<K, number> = { o: 0, d: 0 }
  let sucs: Suc[] | null = null
  let tipo: Tipo = 'paquete', unit: 'caja' | 'pallet' = 'caja'
  let items: Item[] = [{ ...PRESET.paquete }]
  let day = 0, step = 0, maxStep = 0
  let quoted = false, busy = false, booked = false
  let vanAnim: Animation | null = null
  let vb = [...FULL]

  const radio = (n: string) => (form.elements.namedItem(n) as RadioNodeList).value
  const km = () => (sel.o && sel.d ? Math.round(haversine(sel.o, sel.d) * 1.22) : 0)
  const current = () => calc(km(), tipo, items, radio('desp'), radio('ent'))
  const setLive = (t: string) => { live.textContent = t }
  const toast = (t: string) => {
    toastEl.textContent = t
    toastEl.hidden = false
    toastEl.animate([{ transform: 'translate(-50%, 20px)', opacity: 0 }, { transform: 'translate(-50%, 0)', opacity: 1 }], { duration: 400, easing: 'cubic-bezier(.16,1,.3,1)' })
    clearTimeout((toast as unknown as { t: number }).t)
    ;(toast as unknown as { t: number }).t = window.setTimeout(() => (toastEl.hidden = true), 4200)
  }
  const scrollToEl = (el: Element, offset = -110) => {
    const l = (window as unknown as { __lenis?: { scrollTo: (t: Element, o?: object) => void } }).__lenis
    if (l) l.scrollTo(el, { offset, duration: 0.9 }); else scrollTo({ top: el.getBoundingClientRect().top + scrollY + offset, behavior: reduced ? 'auto' : 'smooth' })
  }
  const countUp = (el: HTMLElement, to: number, dur = 750) => {
    if (reduced) { el.textContent = money(to); return }
    const t0 = performance.now()
    const tick = (t: number) => { const k = clamp((t - t0) / dur, 0, 1); el.textContent = money(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(tick) }
    requestAnimationFrame(tick)
  }

  /* ---------- mapa: zoom por viewBox con marcadores de tamaño constante ---------- */
  const zoomOut = (v: number[]) => {
    const r = svg.getBoundingClientRect()
    if (!r.width || !r.height) return 1
    const s = (w: number, h: number) => Math.min(r.width / w, r.height / h)
    return s(FULL[2], FULL[3]) / s(v[2], v[3])
  }
  const setVB = (v: number[]) => { vb = v; svg.setAttribute('viewBox', v.map((n) => n.toFixed(2)).join(' ')); svg.style.setProperty('--z', zoomOut(v).toFixed(4)) }
  function animateVB(to: number[]) {
    const from = [...vb]
    if (reduced) return setVB(to)
    const t0 = performance.now(), dur = 950
    const tick = (t: number) => {
      const k = clamp((t - t0) / dur, 0, 1), e = 1 - Math.pow(1 - k, 4)
      setVB(from.map((f, i) => f + (to[i] - f) * e))
      if (k < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }
  function fitPoints(pts: { x: number; y: number }[]) {
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y)
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
    let w = Math.max(16, (x1 - x0) * 2.2), h = Math.max(20, (y1 - y0) * 2.2)
    const r = svg.getBoundingClientRect(), ratio = r.width / Math.max(1, r.height)
    if (w / h < ratio) w = h * ratio; else h = w / ratio
    animateVB([(x0 + x1) / 2 - w / 2, (y0 + y1) / 2 - h / 2, w, h])
  }
  addEventListener('resize', () => setVB(vb), { passive: true })

  function updateMap() {
    for (const k of ['o', 'd'] as const) {
      const g = $<SVGGElement>(`[data-mk="${k}"]`), p = sel[k]
      g.classList.toggle('on', !!p)
      if (p) { const { x, y } = project(p.la, p.lo); g.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(var(--z))` }
    }
    vanAnim?.cancel(); van.style.opacity = '0'
    const both = !!(sel.o && sel.d)
    stage.classList.toggle('has-route', both)
    if (sel.o && sel.d) {
      const d = arc(project(sel.o.la, sel.o.lo), project(sel.d.la, sel.d.lo))
      for (const el of [arcEl, arc2]) {
        el.setAttribute('d', d); el.setAttribute('pathLength', '1')
        el.classList.remove('drawn'); void el.getBoundingClientRect(); el.classList.add('drawn')
      }
      const k = km()
      routeTxt.textContent = `${sel.o.l} → ${sel.d.l} · ≈ ${k.toLocaleString('es-AR')} km por ruta`
      if (step === 0) setLive(`Ruta trazada · ${short(sel.o.l)} → ${short(sel.d.l)}`)
      if (!reduced) {
        van.style.opacity = '1'
        van.style.offsetPath = `path("${d}")`
        vanAnim = van.animate([{ offsetDistance: '0%' }, { offsetDistance: '100%' }], { duration: Math.min(5200, 1800 + k), delay: 900, iterations: booked ? 1 : Infinity, easing: 'ease-in-out', fill: 'forwards' })
      }
    } else {
      arcEl.classList.remove('drawn'); arc2.classList.remove('drawn')
      routeTxt.textContent = sel.o || sel.d ? 'Falta ' + (sel.o ? 'el destino' : 'el origen') : 'Elegí origen y destino'
      setLive('Mapa en vivo · rutas más cotizadas')
    }
  }

  /* ---------- rutas frecuentes ---------- */
  $('[data-qtick]').innerHTML = [0, 1].map((r) => `<div class="qt__tick-g"${r ? ' aria-hidden="true"' : ''}>${LANE_DATA.map((x, i) => `<button type="button" class="qt__lane" data-lane="${i}"${r ? ' tabindex="-1"' : ''}>${esc(short(x.o.l))} → ${esc(short(x.d.l))} <b>${money(x.p)}</b><span>Cotizar →</span></button>`).join('')}</div>`).join('')
  const maxKm = Math.max(...LANE_DATA.slice(0, 5).map((x) => x.km))
  $('[data-qtoplist]').innerHTML = LANE_DATA.slice(0, 5).map((x, i) => `<li><button type="button" data-lane="${i}"><span>${esc(short(x.o.l))} → ${esc(short(x.d.l))}</span><b>${money(x.p)}</b><small>Caja de 5 kg · ≈ ${x.km.toLocaleString('es-AR')} km · ${etaDays(x.km, false).join(' a ')} días hábiles</small><i style="--w:${Math.round((x.km / maxKm) * 100)}%"></i></button></li>`).join('')
  const ends = new Map<string, Place>()
  LANE_DATA.forEach((x) => { ends.set(x.o.l, x.o); ends.set(x.d.l, x.d) })
  lanesG.innerHTML = LANE_DATA.map((x, i) => `<path d="${arc(project(x.o.la, x.o.lo), project(x.d.la, x.d.lo))}" pathLength="1" data-l="${i}" style="animation-delay:${(-i * 0.37).toFixed(2)}s"/>`).join('')
    + [...ends.values()].map((p) => { const { x, y } = project(p.la, p.lo); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5"/>` }).join('')
  root.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('[data-lane]')
    if (b) applyLane(+b.dataset.lane!)
  })
  const hot = (e: Event, on: boolean) => {
    const b = (e.target as Element).closest<HTMLElement>('.qt__top [data-lane]')
    if (b) lanesG.querySelector(`[data-l="${b.dataset.lane}"]`)?.classList.toggle('hot', on)
  }
  $('[data-qtop]').addEventListener('pointerover', (e) => hot(e, true))
  $('[data-qtop]').addEventListener('pointerout', (e) => hot(e, false))
  function applyLane(i: number) {
    const x = LANE_DATA[i]
    if (!x) return
    if (booked) resetBooking()
    if (step !== 0) setStep(0, false)
    for (const k of ['o', 'd'] as const) {
      const p = k === 'o' ? x.o : x.d
      sel[k] = p
      const box = $(`[data-ac="${k}"]`)
      box.querySelector<HTMLInputElement>('input')!.value = full(p)
      box.classList.add('is-set')
    }
    updateMap()
    runQuote()
  }

  /* ---------- autocompletado ---------- */
  $$('[data-ac]').forEach((box) => {
    const k = box.dataset.ac as K
    const input = box.querySelector<HTMLInputElement>('[data-ac-input]')!
    const list = box.querySelector<HTMLUListElement>('[data-ac-list]')!
    let opts: Place[] = [], active = -1, ctrl: AbortController | null = null, timer = 0
    const render = () => {
      list.innerHTML = opts.map((p, i) => `<li role="option" id="${list.id}-${i}" aria-selected="${i === active}" data-i="${i}"><b>${esc(p.l)}</b><small>${esc(p.p)}${p.cp ? ' · ' + p.cp : ''}</small></li>`).join('')
      list.hidden = !opts.length
      input.setAttribute('aria-expanded', String(!!opts.length))
      if (active >= 0) input.setAttribute('aria-activedescendant', `${list.id}-${active}`)
      else input.removeAttribute('aria-activedescendant')
    }
    const choose = (p: Place, auto = false) => {
      clearTimeout(timer); ctrl?.abort()
      input.value = full(p)
      opts = []; active = -1; render()
      sel[k] = p
      box.classList.add('is-set'); box.classList.remove('bad')
      err.hidden = true
      updateMap(); refresh()
      if (!auto && k === 'o' && !sel.d) $<HTMLInputElement>('[data-ac="d"] input').focus()
    }
    input.addEventListener('input', () => {
      if (sel[k]) { sel[k] = null; box.classList.remove('is-set'); updateMap(); refresh() }
      const q = input.value.trim()
      opts = localSearch(q); active = -1; render()
      clearTimeout(timer)
      if (q.length < 3 || /^\d+$/.test(q)) return
      timer = window.setTimeout(async () => {
        ctrl?.abort(); ctrl = new AbortController()
        try {
          const remote = await georef(q, ctrl.signal)
          if (input.value.trim() !== q || document.activeElement !== input) return
          const seen = new Set(opts.map((p) => strip(p.l + p.p)))
          opts = opts.concat(remote.filter((p) => !seen.has(strip(p.l + p.p)))).slice(0, 8)
          render()
        } catch { /* sin conexión: queda la lista local */ }
      }, 220)
    })
    input.addEventListener('keydown', (e) => {
      if (!opts.length) return
      if (e.key === 'ArrowDown') { active = (active + 1) % opts.length; render(); e.preventDefault() }
      else if (e.key === 'ArrowUp') { active = (active - 1 + opts.length) % opts.length; render(); e.preventDefault() }
      else if (e.key === 'Enter') { e.preventDefault(); choose(opts[Math.max(0, active)]) }
      else if (e.key === 'Escape') { opts = []; render() }
    })
    list.addEventListener('mousedown', (e) => {
      const li = (e.target as Element).closest<HTMLElement>('li')
      if (li) { e.preventDefault(); choose(opts[+li.dataset.i!]) }
    })
    input.addEventListener('blur', () => setTimeout(() => { opts = []; render() }, 120))
    ;(box as HTMLElement & { _set?: (q: string) => Promise<boolean> })._set = async (q: string) => {
      input.value = q
      let r = localSearch(q)
      if (!r.length) { try { r = await georef(q, new AbortController().signal) } catch { r = [] } }
      if (r[0]) { choose(r[0], true); return true }
      return false
    }
  })
  $('[data-swap]').addEventListener('click', () => {
    const io = $<HTMLInputElement>('[data-ac="o"] input'), id = $<HTMLInputElement>('[data-ac="d"] input')
    ;[io.value, id.value] = [id.value, io.value]
    ;[sel.o, sel.d] = [sel.d, sel.o]
    $('[data-ac="o"]').classList.toggle('is-set', !!sel.o); $('[data-ac="d"]').classList.toggle('is-set', !!sel.d)
    updateMap(); refresh()
  })

  /* ---------- filas de bultos ---------- */
  const presetItem = (): Item => ({ ...(tipo === 'bigger' ? PRESET[unit] : PRESET[tipo]) })
  const fld = (f: string, label: string, v: number, attrs: string) => `<label class="qr__f"><span>${label}</span><input type="number" ${attrs} data-f="${f}" value="${v}" /></label>`
  function renderRows() {
    const lim = LIMIT[tipo]
    rowsEl.innerHTML = items.map((it, i) => {
      const x = `<button type="button" class="qr__x" data-del="${i}" aria-label="Quitar bulto ${i + 1}"${items.length < 2 ? ' disabled' : ''}>×</button>`
      const q = fld('q', tipo === 'vinos' ? 'Cajas' : 'Cant.', it.q, `inputmode="numeric" min="1" max="${tipo === 'vinos' ? 10 : 50}" step="1"`)
      if (tipo === 'sobre') return `<div class="qr qr--sobre" data-i="${i}">${q}${fld('kg', 'Kg c/u', it.kg, 'inputmode="decimal" min="0.1" max="0.5" step="0.1"')}<p class="qr__info">Hasta <b>500 g</b> y 35 × 25 cm. Ideal para documentación.</p>${x}</div>`
      if (tipo === 'vinos') {
        const w = wine(it.b)
        return `<div class="qr qr--vinos" data-i="${i}">${q}<label class="qr__f"><span>Botellas por caja</span><select data-f="b">${BOTELLAS.map((b) => `<option value="${b}"${b === it.b ? ' selected' : ''}>${b}</option>`).join('')}</select></label><p class="qr__info" data-winfo>≈ <b>${num(w.kg)} kg</b> por caja<br />${w.l} × ${w.a} × ${w.h} cm</p>${x}</div>`
      }
      const dims = (['l', 'a', 'h'] as const).map((k) => fld(k, { l: 'Largo', a: 'Ancho', h: 'Alto' }[k] + ' cm', it[k], `inputmode="numeric" min="1" max="${lim.side}" step="1"`)).join('')
      return `<div class="qr" data-i="${i}">${q}${fld('kg', 'Kg c/u', it.kg, `inputmode="decimal" min="0.1" max="${lim.kg}" step="0.1"`)}<div class="qr__dims">${dims}</div>${x}</div>`
    }).join('')
    addBtn.disabled = items.length >= 50
  }
  rowsEl.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement | HTMLSelectElement
    const row = t.closest<HTMLElement>('.qr')
    if (!row || !t.dataset.f) return
    const it = items[+row.dataset.i!], f = t.dataset.f as keyof Item
    const v = parseFloat(t.value.replace(',', '.'))
    if (!isNaN(v) && v > 0) it[f] = v
    if (f === 'b') { const w = wine(it.b); row.querySelector('[data-winfo]')!.innerHTML = `≈ <b>${num(w.kg)} kg</b> por caja<br />${w.l} × ${w.a} × ${w.h} cm` }
    refresh()
  })
  rowsEl.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement
    const row = t.closest<HTMLElement>('.qr')
    if (!row || t.tagName !== 'INPUT') return
    const it = items[+row.dataset.i!], f = t.dataset.f as keyof Item
    let v = parseFloat(t.value.replace(',', '.'))
    if (isNaN(v)) v = presetItem()[f]
    v = clamp(v, +t.min, +t.max)
    v = f === 'kg' ? Math.round(v * 10) / 10 : Math.round(v)
    it[f] = v; t.value = String(v)
    refresh()
  })
  rowsEl.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('[data-del]')
    if (!b || items.length < 2) return
    items.splice(+b.dataset.del!, 1)
    renderRows(); refresh()
  })
  addBtn.addEventListener('click', () => {
    items.push(presetItem())
    renderRows(); refresh()
    rowsEl.scrollTop = rowsEl.scrollHeight
    rowsEl.lastElementChild?.querySelector<HTMLInputElement>('input')?.focus()
    bump()
  })
  function setTipo(t: string) {
    tipo = (['paquete', 'sobre', 'vinos', 'bigger'].includes(t) ? t : 'paquete') as Tipo
    unitEl.hidden = tipo !== 'bigger'
    bulk.hidden = tipo === 'sobre' || tipo === 'vinos'
    items = [presetItem()]
    renderRows(); refresh(); bump()
  }
  function setUnit(u: string) {
    unit = u === 'pallet' ? 'pallet' : 'caja'
    items = items.map((it) => ({ ...PRESET[unit], q: it.q }))
    renderRows(); refresh(); bump()
  }

  /* ---------- planilla CSV ---------- */
  function parseCSV(txt: string): Item[] {
    const out: Item[] = []
    const lim = LIMIT[tipo === 'bigger' ? 'bigger' : 'paquete']
    for (const line of txt.split(/\r?\n/)) {
      const sep = /[;\t]/.test(line) ? /[;\t]/ : /,/
      const c = line.split(sep).map((s) => parseFloat(s.trim().replace(',', '.')))
      if (c.length < 5 || c.slice(0, 5).some((n) => isNaN(n) || n <= 0)) continue
      out.push({ q: clamp(Math.round(c[0]), 1, 50), kg: clamp(Math.round(c[1] * 10) / 10, 0.1, lim.kg), l: clamp(Math.round(c[2]), 1, lim.side), a: clamp(Math.round(c[3]), 1, lim.side), h: clamp(Math.round(c[4]), 1, lim.side), b: 0 })
      if (out.length >= 50) break
    }
    return out
  }
  async function importFile(f?: File | null) {
    if (!f) return
    if (f.size > 400_000) { toast('El archivo es muy grande. Hasta 50 bultos por envío.'); return }
    const its = parseCSV(await f.text())
    if (!its.length) { toast('No encontramos bultos en el archivo. Usá la plantilla: cantidad, kg, largo, ancho, alto.'); return }
    items = its
    renderRows(); refresh(); bump()
    toast(`Listo: ${its.length} ${its.length === 1 ? 'fila importada' : 'filas importadas'}, ${its.reduce((s, x) => s + x.q, 0)} bultos en total.`)
  }
  const drop = $('[data-qdrop]'), file = $<HTMLInputElement>('[data-qfile]')
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over') })
  drop.addEventListener('dragleave', () => drop.classList.remove('over'))
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); importFile(e.dataTransfer?.files[0]) })
  file.addEventListener('change', () => { importFile(file.files?.[0]); file.value = '' })
  $('[data-qtpl]').addEventListener('click', () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['cantidad,kg,largo,ancho,alto\n2,3,40,30,20\n1,8.5,60,40,40\n4,1.2,25,20,10\n'], { type: 'text/csv' }))
    a.download = 'plantilla-bultos-andreani.csv'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  })

  /* ---------- caja 3D ---------- */
  const bump = () => { if (reduced) return; qbox.classList.remove('bump'); void qbox.offsetWidth; qbox.classList.add('bump') }
  function updateBox() {
    const ds = items.map((it) => dimsOf(tipo, it))
    const big = ds.reduce((m, d) => (d.l * d.a * d.h > m.l * m.a * m.h ? d : m), ds[0])
    const narrow = innerWidth < 640
    const k = Math.min(narrow ? 3 : 4.4, (narrow ? 120 : 190) / Math.max(big.l, big.a, big.h))
    cube.style.setProperty('--w', `${Math.max(16, big.l * k)}px`)
    cube.style.setProperty('--h', `${Math.max(4, big.h * k)}px`)
    cube.style.setProperty('--d', `${Math.max(16, big.a * k)}px`)
    qbox.classList.toggle('pallet', tipo === 'bigger' && unit === 'pallet')
  }

  /* ---------- fecha de despacho ---------- */
  daysEl.innerHTML = DAYS.map((d, i) => `<label class="qt__day"><input type="radio" name="${root.id}-day" value="${i}"${i === 0 ? ' checked' : ''} /><span>${d.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '')}<b>${d.getDate()}</b>${d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')}</span></label>`).join('')
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  const dayChip = () => (isTomorrow(DAYS[day]) ? `Mañana, ${fmtD(DAYS[day])}` : cap(fmtD(DAYS[day])))
  const dayTxt = () => (isTomorrow(DAYS[day]) ? `mañana, ${fmtD(DAYS[day])}` : `el ${fmtD(DAYS[day])}`)
  dateEl.textContent = dayChip()
  dateBtn.addEventListener('click', () => {
    daysEl.hidden = !daysEl.hidden
    dateBtn.setAttribute('aria-expanded', String(!daysEl.hidden))
    dateBtn.textContent = daysEl.hidden ? 'Cambiar' : 'Listo'
  })

  /* ---------- resumen y precios ---------- */
  function refresh() {
    const c = current()
    sumEl.innerHTML = `<b>${c.bultos} ${c.bultos === 1 ? 'bulto' : 'bultos'}</b> · ${c.kg > c.real + 0.05 ? `${num(c.real)} kg reales · ` : ''}<b>${num(c.kg)} kg</b> a cobrar`
    vw.textContent = `Peso a cobrar: ${num(c.kg)} kg`
    qn.textContent = `× ${c.bultos} ${c.bultos === 1 ? 'bulto' : 'bultos'}`
    updateBox()
    if (quoted) { if (sel.o && sel.d) fillRates(false); else clearRates() }
  }
  const etaTxt = (prio: boolean) => {
    const [a, b] = etaDays(km(), prio)
    const d1 = addBiz(DAYS[day], a), d2 = addBiz(DAYS[day], b)
    return a === b ? `Llega el ${fmtD(d1)}` : `Llega entre el ${fmtD(d1)} y el ${fmtD(d2)}`
  }
  const vel = () => radio('vel') as 'std' | 'prio'
  const svcName = () => (vel() === 'prio' ? 'Prioritario' : 'Estándar')
  function updateNext() { nextT.textContent = `${svcName()} · ${money(current()[vel()])}` }
  function clearRates() {
    quoted = false
    rates.classList.remove('is-ready', 'is-loading', 'flash')
    rh.textContent = 'Completá origen y destino para ver los precios'
    $$<HTMLInputElement>('input[name="vel"]').forEach((r) => (r.disabled = true))
    $$('[data-price]').forEach((el) => (el.textContent = 'Ingresá la ruta'))
    $$('[data-eta]').forEach((el) => (el.textContent = 'Plazo según la ruta'))
    saveBtn.hidden = true; nextBtn.hidden = true
    goT.textContent = 'Ver precios'
    if (maxStep > 0) { maxStep = 0; paintSteps() }
  }
  function fillRates(count: boolean) {
    const c = current()
    for (const k of ['std', 'prio'] as const) {
      const el = $(`[data-price="${k}"]`)
      if (count) countUp(el, c[k]); else el.textContent = money(c[k])
      $(`[data-eta="${k}"]`).textContent = etaTxt(k === 'prio')
    }
    $$<HTMLInputElement>('input[name="vel"]').forEach((r) => (r.disabled = false))
    saveBtn.hidden = !(c.ahorro > 0)
    if (c.ahorro > 0) saveBtn.innerHTML = `<span aria-hidden="true">↓</span><span>Si lo retiran en sucursal, pagás <b>${money(c.ahorro)}</b> menos. <u>Cambiar</u></span>`
    nextBtn.hidden = false
    updateNext()
    rates.classList.add('is-ready')
    if (!count && sel.o && sel.d) rh.textContent = `Precios para ${short(sel.o.l)} → ${short(sel.d.l)} · se actualizan en vivo`
    if (!count && !reduced) { rates.classList.remove('flash'); void rates.offsetWidth; rates.classList.add('flash') }
  }
  async function runQuote() {
    err.hidden = true
    if (!sel.o || !sel.d) {
      const k: K = !sel.o ? 'o' : 'd'
      err.textContent = k === 'o' ? 'Elegí el origen de la lista de sugerencias.' : 'Elegí el destino de la lista de sugerencias.'
      err.hidden = false
      const box = $(`[data-ac="${k}"]`)
      box.classList.remove('bad'); void box.offsetWidth; box.classList.add('bad')
      box.querySelector<HTMLInputElement>('input')!.focus()
      return
    }
    if (busy) return
    busy = true
    goBtn.disabled = true; goBtn.classList.add('is-busy')
    rates.classList.remove('is-ready'); rates.classList.add('is-loading')
    const t0 = performance.now()
    const r = rates.getBoundingClientRect()
    if (r.top > innerHeight - 160) scrollToEl(rates, -140)
    if (!reduced) for (const m of ['Trazando la ruta…', 'Buscando el centro de distribución más cercano…', 'Calculando el peso a cobrar…']) { rh.textContent = m; await wait(340) }
    rates.classList.remove('is-loading')
    quoted = true
    fillRates(true)
    rh.textContent = `Precios para ${short(sel.o.l)} → ${short(sel.d.l)} · cotizado en ${num(Math.max(0.1, (performance.now() - t0) / 1000))} s`
    busy = false
    goBtn.disabled = false; goBtn.classList.remove('is-busy')
    goT.textContent = 'Actualizar precios'
    bump()
  }
  form.addEventListener('submit', (e) => { e.preventDefault(); runQuote() })
  form.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement
    if (t.name === 'tipo') setTipo(t.value)
    else if (t.name === 'unit') setUnit(t.value)
    else if (t.name === 'desp' || t.name === 'ent') refresh()
    else if (t.name === 'vel') updateNext()
    else if (t.name === `${root.id}-day`) { day = +t.value; dateEl.textContent = dayChip(); refresh() }
  })
  saveBtn.addEventListener('click', () => {
    const r = form.querySelector<HTMLInputElement>('input[name="ent"][value="sucursal"]')!
    r.checked = true
    refresh()
    toast('Cambiamos la entrega a retiro en sucursal. Elegís cuál en el paso 3.')
  })
  nextBtn.addEventListener('click', () => { if (quoted) setStep(1) })

  /* ---------- pasos ---------- */
  function paintSteps() {
    stepBtns.forEach((b, i) => {
      b.classList.toggle('done', booked ? i < 5 : i < maxStep && i !== step)
      if (i === step) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current')
      b.disabled = booked || i === step || i > maxStep
    })
  }
  function setStep(n: number, focus = true) {
    const prev = step
    step = n
    maxStep = Math.max(maxStep, n)
    panes.forEach((p, i) => p.classList.toggle('is-on', i === n))
    if (!reduced && prev !== n) panes[n].animate([{ opacity: 0, transform: `translateX(${n > prev ? 32 : -32}px)` }, { opacity: 1, transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.16,1,.3,1)' })
    paintSteps()
    enter(n)
    if (focus) {
      const r = panel.getBoundingClientRect()
      if (r.top < 0) scrollToEl(panel, -100)
      const h = panes[n].querySelector<HTMLElement>('.qt__h')
      if (h) h.focus({ preventScroll: true })
      else if (!nextBtn.hidden) nextBtn.focus({ preventScroll: true })
    }
  }
  stepBtns.forEach((b, i) => b.addEventListener('click', () => { if (!b.disabled) setStep(i) }))
  $$('.qt__place').forEach((b) => b.addEventListener('click', () => { setStep(0); $<HTMLInputElement>('[data-ac="o"] input').focus({ preventScroll: true }) }))
  $$('[data-back]').forEach((b) => b.addEventListener('click', () => setStep(Math.max(0, step - 1))))

  const leaveZoom = () => { candsG.innerHTML = ''; stage.classList.remove('is-zoom'); animateVB(FULL) }
  function enter(n: number) {
    if (n !== 1 && n !== 2) leaveZoom()
    if (n === 0) { setLive(sel.o && sel.d ? `Ruta trazada · ${short(sel.o.l)} → ${short(sel.d.l)}` : 'Mapa en vivo · rutas más cotizadas'); return }
    if (n === 5) { setLive('Envío creado · listo para despachar'); updateMap(); return }
    setLive(`Paso ${n + 1} de 6 · ${STEPS[n]}`)
    if (n === 1 || n === 2) {
      const k: K = n === 1 ? 'o' : 'd'
      const mode = n === 1 ? radio('desp') : radio('ent')
      const pane = panes[n]
      pane.querySelector(`[data-qp="${k}"]`)!.textContent = sel[k] ? full(sel[k]!) : '—'
      pane.querySelectorAll<HTMLElement>('[data-mode]').forEach((m) => (m.hidden = m.dataset.mode !== mode))
      if (n === 1) pane.querySelector('[data-qdate2]')!.textContent = dayTxt()
      if (mode === 'sucursal') loadNear(k); else leaveZoom()
    }
    if (n === 4) buildBill()
  }

  /* ---------- sucursales reales más cercanas ---------- */
  const hours = (h: string) => h.replace(/\s*Hs\.?\b/gi, ' h').replace(/;\s*$/, '').replace(/;/g, ' · ').trim()
  async function loadNear(k: K) {
    const box = $(`[data-sucs="${k}"]`)
    box.innerHTML = '<div class="qt__sk"></div>'.repeat(3)
    try { if (!sucs) sucs = (await import('../data/sucursales.json')).default as Suc[] } catch { box.innerHTML = '<p class="qt__hint">No pudimos cargar las sucursales. Probá de nuevo.</p>'; return }
    const p = sel[k]
    if (!p || step !== (k === 'o' ? 1 : 2)) return
    near[k] = sucs.filter((s) => s.t !== 'Centro de distribución' && s.t !== 'Planta').map((s) => ({ ...s, km: haversine(p, s) })).sort((a, b) => a.km - b.km).slice(0, 3)
    if (pick[k] >= near[k].length) pick[k] = 0
    box.innerHTML = near[k].map((s, i) => `<label class="qt__suc"><input type="radio" name="${root.id}-suc-${k}" value="${i}"${i === pick[k] ? ' checked' : ''} /><span><i>${i + 1}</i><b>${esc(s.n)}</b><em>${s.km < 10 ? num(s.km) : Math.round(s.km)} km</em><small>${esc(s.a)} · ${esc(full(s))}</small>${s.h ? `<small>${esc(hours(s.h))}</small>` : ''}</span></label>`).join('')
    candsG.innerHTML = near[k].map((s, i) => { const { x, y } = project(s.la, s.lo); return `<g data-c="${i}" class="${i === pick[k] ? 'on' : ''}" style="transform:translate(${x.toFixed(2)}px,${y.toFixed(2)}px) scale(var(--z));animation-delay:${i * 90}ms"><circle r="26"/><text>${i + 1}</text></g>` }).join('')
    stage.classList.add('is-zoom')
    fitPoints([project(p.la, p.lo), ...near[k].map((s) => project(s.la, s.lo))])
    setLive(`${k === 'o' ? 'Despacho' : 'Retiro'} cerca de ${short(p.l)} · ${near[k].length} sucursales`)
  }
  const choosePick = (k: K, i: number) => {
    pick[k] = i
    candsG.querySelectorAll('g').forEach((g) => g.classList.toggle('on', g.getAttribute('data-c') === String(i)))
    const r = root.querySelector<HTMLInputElement>(`input[name="${root.id}-suc-${k}"][value="${i}"]`)
    if (r) r.checked = true
  }
  root.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement
    const m = t.name?.match(/-suc-([od])$/)
    if (m) choosePick(m[1] as K, +t.value)
  })
  candsG.addEventListener('click', (e) => {
    const g = (e.target as Element).closest('g[data-c]')
    if (g && (step === 1 || step === 2)) choosePick(step === 1 ? 'o' : 'd', +g.getAttribute('data-c')!)
  })

  /* ---------- datos de los pasos 2 a 4 ---------- */
  const f = (pane: number, name: string) => panes[pane].querySelector<HTMLInputElement>(`[name="${name}"]`)!
  const visible = (el: Element) => !el.closest('[hidden]')
  function validate(pane: HTMLElement) {
    let first: HTMLInputElement | null = null
    pane.querySelectorAll<HTMLInputElement>('[data-req]').forEach((inp) => {
      if (!visible(inp)) return
      const v = inp.value.trim()
      const bad = !v || (inp.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v))
      inp.closest('.qt__fld')!.classList.toggle('bad', bad)
      if (bad && !first) first = inp
    })
    const e = pane.querySelector<HTMLElement>('[data-perr]')
    if (e) { e.hidden = !first; e.textContent = first ? 'Revisá los campos marcados.' : '' }
    ;(first as HTMLInputElement | null)?.focus()
    return !first
  }
  root.addEventListener('input', (e) => (e.target as Element).closest('.qt__fld')?.classList.remove('bad'))
  const EX: Record<number, Record<string, () => string>> = {
    1: { calle: () => 'Av. Pellegrini 1250', cp: () => sel.o?.cp ?? '' },
    2: { nombre: () => 'Lucía Fernández', calle: () => 'San Martín 455', cp: () => sel.d?.cp ?? '' },
    3: { email: () => 'demo@ejemplo.com', cel: () => '11 5555 5555' },
  }
  $$('[data-fill]').forEach((b) => b.addEventListener('click', () => {
    const n = panes.indexOf(b.closest<HTMLElement>('[data-pane]')!)
    for (const [name, v] of Object.entries(EX[n] ?? {})) {
      const inp = f(n, name)
      if (inp && visible(inp)) { inp.value = v(); inp.closest('.qt__fld')?.classList.remove('bad') }
    }
    panes[n].querySelector<HTMLElement>('[data-perr]')?.setAttribute('hidden', '')
  }))
  panes.forEach((p, i) => {
    if (i === 0 || i === 5) return
    p.addEventListener('submit', (e) => {
      e.preventDefault()
      if (i === 4) { pay(); return }
      if (validate(p)) setStep(i + 1)
    })
  })

  const sucOf = (k: K) => near[k][pick[k]]
  const destAddr = () => {
    const calle = f(2, 'calle').value.trim(), piso = f(2, 'piso').value.trim(), cp = f(2, 'cp').value.trim()
    return `${calle}${piso ? ', ' + piso : ''} · ${sel.d!.l}${cp ? ` (${cp})` : ''}`
  }
  const origAddr = () => {
    const calle = f(1, 'calle').value.trim(), piso = f(1, 'piso').value.trim()
    return `${calle}${piso ? ', ' + piso : ''} · ${sel.o!.l}`
  }
  function buildBill() {
    if (!sel.o || !sel.d) return
    const c = current(), v = vel()
    const so = sucOf('o'), sd = sucOf('d')
    const rows: [string, string][] = [
      ['Servicio', svcName()],
      ['Ruta', `${sel.o.l} → ${sel.d.l} · ≈ ${km().toLocaleString('es-AR')} km`],
      ['Bultos', `${c.bultos} · ${num(c.kg)} kg a cobrar`],
      ['Despacho', radio('desp') === 'retiro' ? `Retiro ${dayTxt()} · ${origAddr()}` : `Sucursal ${so ? so.n : sel.o.l} · desde ${dayTxt()}`],
      ['Entrega', radio('ent') === 'domicilio' ? `A domicilio · ${destAddr()}` : `Retira en sucursal ${sd ? sd.n : sel.d.l}`],
      ['Plazo', etaTxt(v === 'prio')],
    ]
    $('[data-qbill]').innerHTML = rows.map(([a, b]) => `<div><dt>${a}</dt><dd>${esc(b)}</dd></div>`).join('')
    countUp($('[data-qtotal]'), c[v], 600)
    $('[data-qpay-t]').textContent = money(c[v])
  }

  /* ---------- pago (demo) y etiqueta ---------- */
  async function pay() {
    const btn = $<HTMLButtonElement>('[data-qpay]')
    btn.disabled = true; btn.classList.add('is-busy')
    await wait(reduced ? 150 : 1100)
    btn.disabled = false; btn.classList.remove('is-busy')
    booked = true
    await buildLabel()
    setStep(5)
    lbl.classList.remove('print'); void lbl.offsetWidth; if (!reduced) lbl.classList.add('print')
    bump()
  }
  async function buildLabel() {
    if (!sel.o || !sel.d) return
    const c = current(), v = vel()
    const n = '36000' + String(Math.floor(Math.random() * 1e10)).padStart(10, '0')
    const so = sucOf('o'), sd = sucOf('d')
    L('svc').textContent = svcName()
    L('from').textContent = full(sel.o)
    L('froma').textContent = radio('desp') === 'retiro' ? `Retiro: ${origAddr()}` : `Despacha en sucursal ${so ? so.n : sel.o.l}`
    L('to').textContent = f(2, 'nombre').value.trim() || full(sel.d)
    L('toa').textContent = radio('ent') === 'domicilio' ? destAddr() : `Retira en sucursal ${sd ? `${sd.n} · ${sd.a}, ${sd.l}` : sel.d.l}`
    L('n').textContent = n.replace(/(\d{4})(\d{4})(\d{4})(\d+)/, '$1 $2 $3 $4')
    L('code').textContent = strip(sel.d.l).replace(/[^a-z]/g, '').slice(0, 3).toUpperCase()
    const [, b] = etaDays(km(), v === 'prio')
    L('meta').textContent = `${c.bultos} ${c.bultos === 1 ? 'bulto' : 'bultos'} · ${num(c.kg)} kg · llega hasta el ${fmtD(addBiz(DAYS[day], b))}`
    const qs = new URLSearchParams({ n, o: `${sel.o.l}, ${sel.o.p}`, d: `${sel.d.l}, ${sel.d.p}`, oc: `${sel.o.la.toFixed(4)},${sel.o.lo.toFixed(4)}`, dc: `${sel.d.la.toFixed(4)},${sel.d.lo.toFixed(4)}`, s: v, b: String(c.bultos), e: radio('ent') })
    const href = `${root.dataset.trk}?${qs}`
    L('track').setAttribute('href', href)
    const qr = L('qr')
    qr.innerHTML = ''
    try {
      const QR = (await import('qrcode')).default
      qr.innerHTML = await QR.toString(new URL(href, location.href).href, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#0f1012', light: '#ffffff' } })
    } catch { /* sin QR: queda el enlace */ }
  }
  function resetBooking() {
    booked = false; maxStep = 0
    panes.slice(1, 4).forEach((p) => (p as HTMLFormElement).reset())
    $$('.qt__fld.bad').forEach((x) => x.classList.remove('bad'))
  }
  $('[data-qnew]').addEventListener('click', () => { resetBooking(); setStep(0); updateMap() })
  $('[data-qpdf]').addEventListener('click', () => toast('Demo: en el sitio real se descarga el PDF para imprimir en A4 o en impresora térmica.'))

  /* ---------- inicio ---------- */
  renderRows()
  refresh()
  updateMap()
  setVB(FULL)

  const params = new URLSearchParams(location.search)
  const t = params.get('tipo')
  if (t && ['paquete', 'sobre', 'vinos', 'bigger'].includes(t)) {
    const r = form.querySelector<HTMLInputElement>(`input[name="tipo"][value="${t}"]`)
    if (r) { r.checked = true; setTipo(t) }
  }
  type AcBox = HTMLElement & { _set?: (q: string) => Promise<boolean> }
  ;(async () => {
    let ok = 0
    for (const k of ['o', 'd'] as const) {
      const q = params.get(k)?.slice(0, 80)
      if (q && (await ($(`[data-ac="${k}"]`) as AcBox)._set?.(q))) ok++
    }
    if (ok === 2) runQuote()
  })()
}

document.querySelectorAll<HTMLElement>('[data-quote]').forEach(initQuote)
