import { defineConfig } from 'astro/config'

// El workflow de Pages pasa SITE y BASE (configure-pages). En local: valores por defecto.
const site = process.env.SITE || 'https://federico-schwindt.github.io'
const base = process.env.BASE ?? '/Andreani-Redesign-Concept'

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
  output: 'static',
  compressHTML: true,
  build: { format: 'directory', inlineStylesheets: 'always', assets: '_assets' },
  vite: { build: { assetsInlineLimit: 2048 } },
})
