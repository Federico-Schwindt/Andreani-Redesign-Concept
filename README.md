# Andreani · Concepto de rediseño

Rediseño conceptual y **no oficial** de [andreani.com](https://www.andreani.com): un sitio completo y navegable, pensado para vender más envíos y mostrar la red logística más grande de la Argentina.

**Sitio:** https://federico-schwindt.github.io/Andreani-Redesign-Concept/
**Propuesta (antes/después y métricas):** https://federico-schwindt.github.io/Andreani-Redesign-Concept/pitch/

> Proyecto independiente de Federico Schwindt, sin afiliación con Andreani Grupo Logístico. La marca, el logotipo y la librea pertenecen a sus dueños y se usan solo para ilustrar la propuesta. Los precios del cotizador son estimaciones de demostración. El sitio tiene la indexación desactivada.

## Qué incluye

- **Carga de apertura:** el camión con la librea de Andreani entra, se cargan las cajas, la cámara entra en una y las solapas se abren sobre el inicio. Una vez por sesión, y se omite con movimiento reducido.
- **Cotizador y reserva en 6 pasos** (inicio y `/enviar/`): bultos (filas o planilla CSV de hasta 50), ruta con autocompletado de localidades reales, precios al instante que se actualizan en vivo, sucursales reales más cercanas, contacto, pago (demo, sin datos de pago) y etiqueta impresa con un QR que abre el seguimiento de ese envío.
- **Seguimiento** (`/seguimiento/`): etapas, eventos y el camión avanzando en el mapa.
- **Sucursales** (`/sucursales/`): 291 puntos reales con búsqueda, filtros, “cerca mío” y cómo llegar.
- **Empresas** y **Nosotros**: servicios B2B, la planta de Pacheco, historia desde 1945, Brasil y sustentabilidad.
- **Propuesta** (`/pitch/`): carta, comparador antes/después, métricas de Lighthouse medidas, el cotizador explicado, implementación y contacto.

## Datos

- Sucursales: API pública de Andreani (`apis.andreani.com/v2/sucursales`), guardadas en `src/data/sucursales.json`.
- Localidades: [Georef](https://datosgobar.github.io/georef-ar-api/) (datos abiertos del Estado argentino) en vivo, más una lista local para respuestas instantáneas.
- Mapa: provincias del IGN, simplificadas a un SVG propio.
- Cifras de la red: Reporte de Sustentabilidad Andreani 2025.
- Videos: generados para el concepto, en bucle y cargados solo cuando se ven.

## Stack

[Astro](https://astro.build) estático, GSAP + ScrollTrigger (recorrido horizontal), Lenis (scroll suave) y TypeScript sin frameworks de interfaz. Tipografías Archivo (expandida e itálica, como el logo) y JetBrains Mono.

```bash
npm install
npm run dev      # http://localhost:4321/Andreani-Redesign-Concept/
npm run build    # genera dist/
```

Se publica en GitHub Pages con `.github/workflows/deploy.yml` en cada push a `main` (en el repositorio: Settings → Pages → Source: **GitHub Actions**).

## Contacto

Federico Schwindt · leonel.sch2003@gmail.com · [portfolio](https://federico-schwindt.github.io/portfolio-FEDERICOSCH/)
