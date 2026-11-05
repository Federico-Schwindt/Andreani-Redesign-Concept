/** Proyección del mapa (misma que generó src/data/ar-map.json) y utilidades geográficas. */
export const MAP = { w: 600, h: 1255.4, lonMin: -73.8, latMax: -21.6, k: 0.7880107536067219, s: 37.14199653870963 }

export const project = (lat: number, lng: number) => ({
  x: (lng - MAP.lonMin) * MAP.k * MAP.s,
  y: (MAP.latMax - lat) * MAP.s,
})

export const haversine = (a: { la: number; lo: number }, b: { la: number; lo: number }) => {
  const R = 6371
  const dLa = ((b.la - a.la) * Math.PI) / 180
  const dLo = ((b.lo - a.lo) * Math.PI) / 180
  const x = Math.sin(dLa / 2) ** 2 + Math.cos((a.la * Math.PI) / 180) * Math.cos((b.la * Math.PI) / 180) * Math.sin(dLo / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

/** Arco curvo entre dos puntos del mapa (curva cuadrática hacia el oeste/arriba) */
export const arc = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
  const dx = b.x - a.x, dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const bend = Math.min(160, len * 0.32)
  const cx = mx - (dy / len) * bend, cy = my + (dx / len) * bend * (dx > 0 ? -1 : 1)
  return `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`
}

export const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
