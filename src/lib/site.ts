/** Contenido y datos del concepto. Cifras: Reporte de Sustentabilidad Andreani 2025 (Resumen Ejecutivo) y andreani.com. */

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')
export const url = (p = '/') => (/^(https?:|mailto:|tel:|#)/.test(p) ? p : `${BASE}${p.startsWith('/') ? p : `/${p}`}`)
export const media = (f: string) => url(`/media/${f}`)

export const AUTHOR = {
  name: 'Federico Schwindt',
  email: 'leonel.sch2003@gmail.com',
  portfolio: 'https://federico-schwindt.github.io/portfolio-FEDERICOSCH/',
}

export const nav = [
  { href: '/enviar/', label: 'Enviar' },
  { href: '/seguimiento/', label: 'Seguir envío' },
  { href: '/sucursales/', label: 'Sucursales' },
  { href: '/empresas/', label: 'Empresas' },
  { href: '/nosotros/', label: 'Nosotros' },
]

export const company = {
  legal: 'Andreani Grupo Logístico',
  founded: 1945,
  phone: '0800-122-1112',
  phoneHref: 'tel:08001221112',
  email: 'atenciondigital@andreani.com',
  official: 'https://www.andreani.com',
}

/** Cifras 2025 (Resumen Ejecutivo de Sustentabilidad) */
export const stats = {
  envios: 54.6,        // millones procesados en Argentina
  sucursales: 153,
  hop: 2850,
  hubs: 36,
  plantasAmba: 8,
  vehiculos: 4192,
  km: 163.2,           // millones
  domicilios: 21.3,    // millones visitados
  superficie: 760839,  // m²
  unidades: 677,       // millones gestionadas en almacenes
  pedidos: 1.97,       // millones
  crossBorder: 2.7,    // millones
  porHora: 26000,      // envíos/hora, Planta Pacheco
  destinatarios: 5,    // millones por mes
  pymes: 200000,
  empresas: 2500,
  diarios: 928000,     // productos procesados por día
  colaboradores: 5952, // Argentina y Brasil
}

export const ticker = [
  `${stats.envios.toLocaleString('es-AR')} M envíos al año`,
  `${stats.sucursales} sucursales`,
  `${stats.hop.toLocaleString('es-AR')} puntos HOP`,
  `${stats.hubs} hubs logísticos`,
  `${stats.vehiculos.toLocaleString('es-AR')} vehículos`,
  `${stats.km.toLocaleString('es-AR')} M de km recorridos`,
  `${stats.porHora.toLocaleString('es-AR')} envíos por hora en Pacheco`,
  'N.º 1 en logística · MERCO 2025',
]

/** Qué se puede enviar (catálogo real de andreani.com) */
export const productos = [
  { k: 'paquete', t: 'Paquetería', d: 'Hasta 50 kg', icon: 'box' },
  { k: 'sobre', t: 'Sobre', d: 'Hasta 500 g', icon: 'mail' },
  { k: 'carta', t: 'Carta documento', d: 'Comunicación de carácter legal', icon: 'doc' },
  { k: 'vinos', t: 'Vinos', d: 'Cajas de 1 a 6 botellas, máximo 10 cajas', icon: 'wine' },
  { k: 'bigger', t: 'Bigger', d: 'Desde 50 kg en varios bultos', icon: 'boxes' },
  { k: 'pallet', t: 'Pallet', d: 'Desde 50 kg en un mismo contenedor', icon: 'pallet' },
  { k: 'cambios', t: 'Cambios', d: 'Retiro y nueva entrega del producto', icon: 'swap' },
  { k: 'devol', t: 'Devoluciones', d: 'Gestioná el retiro del producto', icon: 'back' },
]

export const industrias = ['Salud y cosmética', 'Retail', 'Fashion', 'Tecnología', 'Telecomunicaciones', 'Financiero', 'Alimentos y bebidas', 'Energía y minería', 'Agroindustria', 'Movilidad', 'Máquinas y herramientas', 'Gobierno', 'Desarrollos inmobiliarios']

export const servicios = [
  { k: 'integral', t: 'Logística integral', d: 'Distribución física y gestión de almacenes que integran producción, distribución y logística inversa en una sola operación.', video: 'centro', stat: `${stats.superficie.toLocaleString('es-AR')} m² operativos` },
  { k: 'almacenes', t: 'Almacenes y fulfillment', d: 'Recepción, guarda, preparación de pedidos y despacho. Tu stock, visible en tiempo real.', video: 'deposito', stat: `${stats.unidades} M de unidades gestionadas` },
  { k: 'ecommerce', t: 'E-commerce', d: 'Integración con tu tienda, etiquetas automáticas, entregas a domicilio o en un punto HOP y cambios sin fricción.', video: 'entrega', stat: `+${stats.pymes.toLocaleString('es-AR')} pymes y emprendedores` },
  { k: 'salud', t: 'Salud', d: 'Plantas especializadas para productos farmacéuticos y cadena de frío controlada de punta a punta.', video: 'frio', stat: 'Cadena de frío de 2 a 8 °C' },
  { k: 'aerea', t: 'Aérea y cross-border', d: 'Centros de operaciones en Aeroparque y Ezeiza, courier internacional y carga con Andreani GlobAll Pack.', video: 'aereo', stat: `${stats.crossBorder.toLocaleString('es-AR')} M de envíos cross-border` },
  { k: 'hub', t: 'Distribución nacional', d: 'Una red de hubs y sucursales que conecta las 24 jurisdicciones con salidas diarias.', video: 'hub', stat: `${stats.hubs} hubs logísticos` },
]

export const historia = [
  { y: '1945', t: 'Casilda, Santa Fe', d: 'Umberto Andreani y sus hermanos arman una empresa de transporte de cargas para unir Casilda con Rosario.' },
  { y: '1990', t: 'Fundación Andreani', d: 'Los pedidos de envíos solidarios dan origen a la Fundación, que hoy acompaña el arte y la cultura.' },
  { y: '2001', t: 'Llegada a Brasil', d: 'El grupo cruza la frontera acompañando a un cliente de telefonía móvil y se especializa en salud.' },
  { y: '2012', t: 'Planta propia en San Pablo', d: 'Primera planta en Embu das Artes. Hoy opera en San Pablo, Río de Janeiro y Espírito Santo.' },
  { y: '2021', t: 'Vacunas para todo el país', d: 'Operador logístico de la distribución de vacunas contra el COVID-19 en toda la Argentina.' },
  { y: '2024', t: 'Al mundo', d: 'Suma courier internacional y carga con Andreani GlobAll Pack.' },
  { y: '2025', t: '80 años y Planta Pacheco', d: 'El hub más automatizado del país: 26.000 envíos por hora con inducción por inteligencia artificial.' },
]

export const sustentabilidad = [
  { v: '11', l: 'Unidades eléctricas para media distancia y última milla' },
  { v: '3,4 M', l: 'Kilómetros recorridos con biodiésel en 2025' },
  { v: '80 %', l: 'De la flota de larga distancia con telemetría' },
  { v: '17,7 M', l: 'Unidades de packaging con plástico recuperado' },
]
