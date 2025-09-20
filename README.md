# Journal des destinations

Tags: Tailwind, PWA, offline, timeline, stats

---

**Architecture**
```
journal/
├─ package.json
├─ tailwind.config.js
├─ public/
│  ├─ index.html
│  ├─ assets/
│  │  ├─ app.css          (build Tailwind)
│  │  └─ app.js           (bundle/minified)
│  ├─ manifest.webmanifest
│  ├─ favicon.svg
│  ├─ icon-192.png        (génère depuis le SVG)
│  ├─ icon-512.png        (génère depuis le SVG)
│  ├─ icon-512-maskable.png (maskable, pour Android)
│  └─ sw.js               (service worker)
├─ src/
│  ├─ index.html          (dev preview, optionnel)
│  ├─ styles.css          (@tailwind directives)
│  └─ app.js              (code appli — logique + UI)
└─ README.md              (ce bloc)
```

---

## Scripts & build

```json
{
  "name": "journal-destinations",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "serve public -p 5173 -s",
    "build:css": "tailwindcss -c tailwind.config.js -i src/styles.css -o public/assets/app.css --minify",
    "build:js": "esbuild src/app.js --bundle --minify --format=esm --outfile=public/assets/app.js",
    "build": "npm run build:css && npm run build:js",
    "clean": "rimraf public/assets && mkdir -p public/assets"
  },
  "devDependencies": {
    "esbuild": "^0.23.0",
    "rimraf": "^6.0.0",
    "serve": "^14.2.1",
    "tailwindcss": "^3.4.13"
  }
}
```

**Tailwind config (purge via `content`)**
```js
// tailwind.config.js
export default {
  darkMode: 'class',
  content: [
    './public/**/*.html',
    './src/**/*.{html,js}'
  ],
  theme: {
    extend: {
      container: { center: true, padding: '1rem' },
      fontFamily: { display: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] }
    }
  },
  plugins: []
}
```

---

## PWA: manifest + favicon + SW

**`public/manifest.webmanifest`**
```json
{
  "name": "Journal des destinations",
  "short_name": "Journal",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#0a0a0a",
  "description": "Journal de destinations — localStorage, offline, clair/sombre, timeline & stats.",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable any" },
    { "src": "/favicon.svg", "sizes": "any", "type": "image/svg+xml" }
  ]
}
```

---

## Instructions

1) **Installer**
```
npm i
```
2) **Build prod**
```
npm run clean && npm run build
```
3) **Servir** (test offline + PWA)
```
npm run dev   # http://localhost:5173
```
4) **Générer les icônes PNG** depuis `favicon.svg` (exemples):
- 192×192, 512×512, 512×512 maskable (voir maskable.app)

---

## Notes source & bonnes pratiques (références)
- Build Tailwind & purge (flag `--minify`, config `content`).
- Web App Manifest (nom, icônes, couleurs, `display`).
- PWA / Service Worker (offline‑first, stratégies cache).
- Favicon modernes (SVG + PNG, maskable).


