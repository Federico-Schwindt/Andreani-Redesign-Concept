/* Comportamiento global: scroll suave, header, menú, revelados, contadores, videos diferidos y aviso de concepto. */
import Lenis from 'lenis'

const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s)
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)]
export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

/* ---------- Scroll suave (Lenis) ---------- */
export const lenis = reduced ? null : new Lenis({ lerp: 0.1, smoothWheel: true, anchors: { offset: -90 } })
if (lenis) {
  const raf = (t: number) => { lenis.raf(t); requestAnimationFrame(raf) }
  requestAnimationFrame(raf)
  if (document.documentElement.classList.contains('is-loading')) lenis.stop()
  addEventListener('ldr:done', () => lenis.start())
}
;(window as unknown as { __lenis: Lenis | null }).__lenis = lenis

/* ---------- Header ---------- */
const hdr = $('[data-hdr]')
if (hdr) {
  let last = scrollY
  const solidFrom = () => ($('[data-hero]')?.offsetHeight ?? 120) - 90
  const onScroll = () => {
    const y = scrollY
    hdr.classList.toggle('is-solid', hdr.dataset.tone === 'dark' ? y > 10 : y > solidFrom())
    if (!document.documentElement.classList.contains('lock')) hdr.classList.toggle('is-hidden', y > 600 && y > last + 4)
    if (y < last - 4) hdr.classList.remove('is-hidden')
    last = y
  }
  addEventListener('scroll', onScroll, { passive: true })
  onScroll()
}

/* ---------- Menú móvil ---------- */
const menu = $('[data-menu]')
const openBtn = $<HTMLButtonElement>('[data-menu-open]')
const setMenu = (open: boolean) => {
  if (!menu) return
  menu.classList.toggle('is-open', open)
  menu.inert = !open
  openBtn?.setAttribute('aria-expanded', String(open))
  document.documentElement.classList.toggle('lock', open)
  if (open) { lenis?.stop(); $<HTMLElement>('a', menu)?.focus() } else { lenis?.start(); openBtn?.focus() }
}
openBtn?.addEventListener('click', () => setMenu(true))
$('[data-menu-close]')?.addEventListener('click', () => setMenu(false))
menu?.addEventListener('click', (e) => { if ((e.target as Element).closest('a')) setMenu(false) })

/* ---------- Revelado ---------- */
const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.06 })
$$('[data-rv],[data-lines]').forEach((el) => { if (!el.classList.contains('in') && !el.closest('[data-hero]')) io.observe(el) })
const heroIn = () => $$('[data-hero] [data-rv], [data-hero] [data-lines]').forEach((el) => el.classList.add('in'))
if (document.documentElement.classList.contains('hero-in')) heroIn()
else addEventListener('ldr:done', heroIn, { once: true })

/* ---------- Contadores ---------- */
const cio = new IntersectionObserver((es) => es.forEach((e) => {
  if (!e.isIntersecting) return
  cio.unobserve(e.target)
  const el = e.target as HTMLElement
  const end = +el.dataset.count!
  const dec = +(el.dataset.dec || 0)
  const fmt = (v: number) => v.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
  if (reduced) { el.textContent = fmt(end); return }
  const t0 = performance.now(), dur = +(el.dataset.dur || 1800)
  const tick = (t: number) => {
    const k = Math.max(0, Math.min(1, (t - t0) / dur))
    el.textContent = fmt(end * (1 - Math.pow(1 - k, 4)))
    if (k < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}), { threshold: 0.5 })
$$('[data-count]').forEach((el) => cio.observe(el))

/* ---------- Videos: cargan y se reproducen solo en pantalla ---------- */
const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
export const loadVideo = (v: HTMLVideoElement) => {
  if (v.dataset.ok) return
  const narrow = matchMedia('(max-width: 760px)').matches
  const src = (narrow && v.dataset.srcV) || v.dataset.src
  if (src) { v.src = src; v.load(); v.dataset.ok = '1' }
}
const vio = new IntersectionObserver((es) => es.forEach((e) => {
  const v = e.target as HTMLVideoElement
  if (e.isIntersecting) { loadVideo(v); v.play().catch(() => {}) } else v.pause()
}), { rootMargin: '200px' })
if (!reduced && !saveData) $$<HTMLVideoElement>('video[data-src]').forEach((v) => { if (!v.hasAttribute('data-manual')) vio.observe(v) })

/* ---------- Aviso de concepto ---------- */
const notice = $('[data-notice]')
const openNotice = () => { if (!notice) return; notice.inert = false; notice.classList.add('is-open'); lenis?.stop(); $<HTMLElement>('[data-ack-notice]', notice)?.focus() }
const closeNotice = () => { if (!notice) return; notice.classList.remove('is-open'); notice.inert = true; lenis?.start(); try { localStorage.setItem('and-aviso', '1') } catch (e) {} }
document.addEventListener('click', (e) => {
  const t = e.target as Element
  if (t.closest('[data-open-notice]')) openNotice()
  if (t.closest('[data-ack-notice]') || t.closest('[data-close-notice]')) closeNotice()
})
addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return
  if (notice?.classList.contains('is-open')) closeNotice()
  if (menu?.classList.contains('is-open')) setMenu(false)
})
let seen = false
try { seen = localStorage.getItem('and-aviso') === '1' } catch (e) {}
const scheduleNotice = () => setTimeout(() => { if (!seen) openNotice() }, 2600)
if (document.documentElement.classList.contains('hero-in')) scheduleNotice()
else addEventListener('ldr:done', scheduleNotice, { once: true })
