/* Home: video del hero, dock de acciones, viaje del paquete (scroll horizontal fijado), tooltips del mapa, servicios. */
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { loadVideo } from './app'

gsap.registerPlugin(ScrollTrigger)
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s)
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)]

/* Lenis ↔ ScrollTrigger */
const lenis = (window as unknown as { __lenis?: { on: (e: string, f: () => void) => void } }).__lenis
lenis?.on('scroll', ScrollTrigger.update)

/* ---------- Video del hero: arranca cuando se abre la caja ---------- */
const hv = $<HTMLVideoElement>('[data-hero-video]')
if (hv && !reduced) {
  const start = () => {
    loadVideo(hv)
    hv.addEventListener('playing', () => hv.classList.add('on'), { once: true })
    hv.play().catch(() => {})
  }
  if (document.documentElement.classList.contains('hero-in')) setTimeout(start, 300)
  else addEventListener('ldr:opening', start, { once: true })
  new IntersectionObserver(([e]) => (e.isIntersecting ? hv.play().catch(() => {}) : hv.pause())).observe(hv)
}

/* ---------- Dock: pestañas ---------- */
const dock = $('[data-dock]')
if (dock) {
  const tabs = $$<HTMLButtonElement>('[data-dtab]', dock)
  const ind = $('.dock__ind', dock)!
  const select = (i: number, focus = false) => {
    tabs.forEach((t, k) => {
      t.setAttribute('aria-selected', String(k === i))
      t.tabIndex = k === i ? 0 : -1
      const panel = document.getElementById(t.getAttribute('aria-controls')!)!
      panel.hidden = k !== i
    })
    ind.style.setProperty('--t', String(i))
    if (focus) tabs[i].focus()
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => { select(i); $<HTMLInputElement>('input', document.getElementById(t.getAttribute('aria-controls')!)!)?.focus() })
    t.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') select((i + 1) % tabs.length, true)
      if (e.key === 'ArrowLeft') select((i - 1 + tabs.length) % tabs.length, true)
    })
  })
}

/* ---------- Tarjetas con inclinación 3D ---------- */
if (!reduced && matchMedia('(hover: hover)').matches) {
  $$('[data-tilt]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5
      el.style.transform = `rotateY(${x * 10}deg) rotateX(${-y * 10}deg) translateY(-4px)`
    })
    el.addEventListener('pointerleave', () => (el.style.transform = ''))
  })
}

/* ---------- El viaje del paquete: scroll horizontal fijado ---------- */
const jr = $('[data-journey]')
if (jr) {
  const track = $('[data-jtrack]', jr)!
  const fill = $('[data-jfill]', jr)!
  const truck = $('[data-jtruck]', jr)!
  const stops = $$('[data-jstop]', jr)
  const panels = $$('[data-jpanel]', jr)
  const videos = panels.map((p) => $<HTMLVideoElement>('video', p))
  let active = -1
  const setActive = (i: number) => {
    if (i === active) return
    active = i
    stops.forEach((s, k) => s.classList.toggle('on', k <= i))
    videos.forEach((v, k) => {
      if (!v) return
      if (Math.abs(k - i) <= 1 && !reduced) loadVideo(v)
      if (k === i && !reduced) v.play().catch(() => {}); else v.pause()
    })
  }
  ScrollTrigger.matchMedia({
    '(min-width: 901px) and (min-height: 560px)': () => {
      const dist = () => track.scrollWidth - innerWidth
      const tl = gsap.to(track, {
        x: () => -dist(),
        ease: 'none',
        scrollTrigger: {
          trigger: jr,
          pin: '[data-jpin]',
          start: 'top top',
          end: () => `+=${dist() + innerHeight * 0.4}`,
          scrub: reduced ? true : 0.6,
          invalidateOnRefresh: true,
          onUpdate: (st) => {
            const p = st.progress
            fill.style.transform = `scaleX(${p})`
            truck.style.left = `calc(14px + (100% - 28px) * ${p})`
            setActive(Math.round(p * (panels.length - 1)))
          },
        },
      })
      return () => tl.scrollTrigger?.kill()
    },
    '(max-width: 900px), (max-height: 559px)': () => {
      const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) setActive(panels.indexOf(e.target as HTMLElement)) }), { threshold: 0.55 })
      panels.forEach((p) => io.observe(p))
      return () => io.disconnect()
    },
  })
  // las cifras de los paneles cuentan cuando entran (scroll horizontal: se observan con su propio trigger)
  addEventListener('load', () => ScrollTrigger.refresh())
  addEventListener('lines:fit', () => ScrollTrigger.refresh())
}

/* ---------- Mapa de la red: tooltip ---------- */
const net = $('[data-net]')
if (net) {
  const tip = $('[data-net-tip]', net)!
  const box = $('.net__map', net)!
  box.addEventListener('pointerover', (e) => {
    const c = (e.target as Element).closest('circle[data-tip]') as SVGCircleElement | null
    if (!c) return
    const r = c.getBoundingClientRect(), b = box.getBoundingClientRect()
    tip.textContent = c.dataset.tip!
    tip.style.left = `${r.left + r.width / 2 - b.left}px`
    tip.style.top = `${r.top - b.top}px`
    tip.classList.add('on')
  })
  box.addEventListener('pointerout', (e) => { if ((e.target as Element).closest('circle')) tip.classList.remove('on') })
}

/* ---------- Servicios: video al pasar el mouse ---------- */
if (!reduced && matchMedia('(hover: hover)').matches) {
  $$('[data-svc]').forEach((card) => {
    const v = $<HTMLVideoElement>('video', card)!
    card.addEventListener('pointerenter', () => { loadVideo(v); v.play().then(() => card.classList.add('is-playing')).catch(() => {}) })
    card.addEventListener('pointerleave', () => { card.classList.remove('is-playing'); v.pause() })
  })
}
