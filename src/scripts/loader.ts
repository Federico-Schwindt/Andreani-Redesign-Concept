/**
 * Coordina la pantalla de carga: progreso (tiempo de la animación + carga real de la página),
 * zoom de cámara a la caja objetivo y apertura de las solapas sobre el hero.
 * Sin pantalla de carga (visita repetida, movimiento reducido) avisa enseguida con 'ldr:done'.
 */
const done = () => {
  document.documentElement.classList.remove('is-loading')
  document.documentElement.classList.add('hero-in')
  window.dispatchEvent(new Event('ldr:done'))
}

const ldr = document.getElementById('ldr')
if (!ldr) {
  done()
} else {
  const pct = ldr.querySelector<HTMLElement>('[data-pct]')!
  const bar = ldr.querySelector<HTMLElement>('[data-bar]')!
  const msg = ldr.querySelector<HTMLElement>('[data-msg]')!
  const scene = ldr.querySelector<SVGSVGElement>('[data-scene]')!
  const face = ldr.querySelector<HTMLElement>('[data-face]')!
  const target = ldr.querySelector<SVGUseElement>('[data-box="target"]')!
  const MSGS = ['Cargando tu envío', 'Escaneando paquetes', 'Asignando la mejor ruta', 'Listo para salir']
  const LOAD_MS = 3000 // dura lo mismo que la carga de cajas en CSS
  const t0 = performance.now()
  let pageReady = document.readyState === 'complete'
  addEventListener('load', () => (pageReady = true), { once: true })
  setTimeout(() => (pageReady = true), 6500) // nunca esperar más que esto

  let shown = 0
  const tick = () => {
    const t = performance.now() - t0
    const timeP = Math.min(1, t / LOAD_MS)
    const goal = pageReady ? timeP : Math.min(timeP, 0.94)
    shown += (goal - shown) * 0.18
    if (goal >= 1 && shown > 0.995) shown = 1
    const v = Math.round(shown * 100)
    pct.textContent = String(v)
    bar.style.transform = `scaleX(${shown})`
    msg.textContent = MSGS[Math.min(MSGS.length - 1, Math.floor(shown * MSGS.length))]
    if (shown < 1) requestAnimationFrame(tick)
    else setTimeout(zoom, 260)
  }
  requestAnimationFrame(tick)

  const zoom = () => {
    try { sessionStorage.setItem('and-ldr', '1') } catch (e) {}
    ldr.classList.add('is-zoom')
    const s = scene.getBoundingClientRect()
    const b = target.getBoundingClientRect()
    const ox = b.left + b.width / 2 - s.left
    const oy = b.top + b.height / 2 - s.top
    // la caja tiene que cubrir la pantalla: escala según el lado que más falte
    const k = Math.max(innerWidth / b.width, innerHeight / b.height) * 1.25
    // llevar la caja al centro mientras escala
    const dx = innerWidth / 2 - (b.left + b.width / 2)
    const dy = innerHeight / 2 - (b.top + b.height / 2)
    scene.style.transformOrigin = `${ox}px ${oy}px`
    const z = scene.animate(
      [{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${dx}px, ${dy}px) scale(${k})` }],
      { duration: 1100, easing: 'cubic-bezier(.75,0,.85,.25)', fill: 'forwards' },
    )
    face.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380, delay: 760, easing: 'linear', fill: 'forwards' })
    z.finished.then(open)
  }

  const open = () => {
    ldr.classList.add('is-open')
    const top = face.querySelector<HTMLElement>('.ldr__flap--t')!
    const bot = face.querySelector<HTMLElement>('.ldr__flap--b')!
    const label = face.querySelector<HTMLElement>('.ldr__label')!
    const ease = 'cubic-bezier(.7,0,.2,1)'
    window.dispatchEvent(new Event('ldr:opening'))
    label.animate([{ transform: 'rotate(-4deg)', opacity: 1 }, { transform: 'translate(30vw,-60vh) rotate(24deg)', opacity: 0 }], { duration: 700, easing: 'cubic-bezier(.6,0,.4,1)', fill: 'forwards' })
    top.animate([{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(118deg)' }], { duration: 1050, delay: 120, easing: ease, fill: 'forwards' })
    const last = bot.animate([{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(-118deg)' }], { duration: 1050, delay: 120, easing: ease, fill: 'forwards' })
    setTimeout(done, 520)
    last.finished.then(() => {
      ldr.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards' }).finished.then(() => ldr.remove())
    })
  }
}
