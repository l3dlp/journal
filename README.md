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

**`public/favicon.svg`** (simple, adaptable)
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#fbbf24"/>
      <stop offset="1" stop-color="#ef4444"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="url(#g)"/>
  <path d="M18 20h28v6H18zm0 10h22v6H18zm0 10h16v6H18z" fill="#111" opacity=".9"/>
</svg>
```

**`public/sw.js`** (App‑shell + runtime cache KISS)
```js
const VERSION = 'v1.0.0';
const APP_SHELL = [
  '/',
  '/assets/app.css',
  '/assets/app.js',
  '/manifest.webmanifest',
  '/favicon.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => (k !== VERSION ? caches.delete(k) : null)))).then(() => self.clients.claim())
  );
});

// Network-first for HTML, cache-first for assets
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put('/', copy));
        return res;
      }).catch(() => caches.match('/'))
    );
    return;
  }
  if (url.origin === location.origin && url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
        return res;
      }))
    );
  }
});
```

---

## HTML (public)

**`public/index.html`**
```html
<!doctype html>
<html lang="fr" class="h-full">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Journal des destinations</title>
    <meta name="theme-color" content="#0a0a0a" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/icon-192.png" />
    <link rel="preload" href="/assets/app.css" as="style" />
    <link rel="stylesheet" href="/assets/app.css" />
  </head>
  <body class="h-full bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
    <div class="min-h-screen">
      <header class="backdrop-blur bg-white/90 dark:bg-neutral-900/90 sticky top-0 z-50 border-b border-neutral-200/60 dark:border-neutral-800">
        <div class="container max-w-5xl py-4 flex items-center gap-3">
          <div class="size-9 rounded-2xl bg-gradient-to-br from-amber-400 to-rose-500"></div>
          <h1 class="font-semibold text-xl tracking-tight">Journal des destinations</h1>
          <span class="ml-auto inline-flex items-center gap-2 text-sm opacity-75">
            <button id="themeBtn" class="rounded-xl border border-neutral-200 dark:border-neutral-800 px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition" aria-label="Basculer le thème">🌞/🌚</button>
            <button id="exportBtn" class="rounded-xl border border-neutral-200 dark:border-neutral-800 px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition">Exporter</button>
            <label class="rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 px-3 py-1.5 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition">
              Importer JSON<input id="importInput" type="file" accept="application/json" class="sr-only" />
            </label>
          </span>
        </div>
      </header>

      <main class="container max-w-5xl py-10 space-y-10">
        <section class="prose prose-neutral dark:prose-invert max-w-none">
          <p class="text-lg leading-relaxed">Minimal, aéré, local‑first. Écris vite, re‑lis mieux. PWA offline, timeline & stats par pays/an.</p>
        </section>

        <!-- FORM: pays distinct du lieu -->
        <section class="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm ring-1 ring-neutral-200/70 dark:ring-neutral-800 p-6">
          <form id="entryForm" class="grid md:grid-cols-2 gap-4">
            <input type="hidden" id="entryId" />

            <div class="md:col-span-2 grid md:grid-cols-3 gap-4">
              <div class="md:col-span-2">
                <label for="place" class="block text-sm opacity-80 mb-1">Lieu</label>
                <input id="place" required placeholder="Ville / village, région" class="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white/70 dark:bg-neutral-900/70 px-4 py-2.5" />
              </div>
              <div>
                <label for="country" class="block text-sm opacity-80 mb-1">Pays</label>
                <input id="country" required placeholder="Ex: Portugal" class="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white/70 dark:bg-neutral-900/70 px-4 py-2.5" />
              </div>
            </div>

            <div>
              <label for="start" class="block text-sm opacity-80 mb-1">Début</label>
              <input id="start" type="date" required class="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white/70 dark:bg-neutral-900/70 px-4 py-2.5" />
            </div>
            <div>
              <label for="end" class="block text-sm opacity-80 mb-1">Fin</label>
              <input id="end" type="date" required class="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white/70 dark:bg-neutral-900/70 px-4 py-2.5" />
            </div>

            <div>
              <label for="mood" class="block text-sm opacity-80 mb-1">Humeur</label>
              <select id="mood" class="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white/70 dark:bg-neutral-900/70 px-4 py-2.5">
                <option value="">—</option>
                <option>👌 Parfait</option>
                <option>🙂 Bien</option>
                <option>😐 Mitigé</option>
                <option>😵 Difficile</option>
              </select>
            </div>
            <div>
              <label for="rating" class="block text-sm opacity-80 mb-1">Note (0‑5)</label>
              <input id="rating" type="number" min="0" max="5" step="0.5" placeholder="4.5" class="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white/70 dark:bg-neutral-900/70 px-4 py-2.5" />
            </div>

            <div class="md:col-span-2">
              <label for="notes" class="block text-sm opacity-80 mb-1">Notes</label>
              <textarea id="notes" rows="5" placeholder="Climat, logistique, gens, bouffe, anecdotes, comparaisons…" class="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white/70 dark:bg-neutral-900/70 px-4 py-3"></textarea>
            </div>

            <div class="md:col-span-2 flex items-center gap-3 pt-2">
              <button class="px-5 py-2.5 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90 transition" type="submit">Enregistrer</button>
              <button id="resetBtn" class="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition" type="button">Réinitialiser</button>
              <div class="ml-auto flex items-center gap-2">
                <input id="search" placeholder="Recherche… (lieu, notes, pays)" class="w-64 max-w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white/70 dark:bg-neutral-900/70 px-4 py-2.5" />
                <select id="sort" class="rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white/70 dark:bg-neutral-900/70 px-3 py-2.5">
                  <option value="start-desc">Récents d’abord</option>
                  <option value="start-asc">Anciens d’abord</option>
                  <option value="rating-desc">Meilleures notes</option>
                  <option value="rating-asc">Moindres notes</option>
                </select>
              </div>
            </div>
          </form>
        </section>

        <!-- LIST -->
        <section>
          <div id="list" class="grid gap-4 md:gap-6"></div>
          <template id="cardTpl">
            <article class="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm ring-1 ring-neutral-200/70 dark:ring-neutral-800 p-5 flex flex-col gap-3">
              <div class="flex items-start gap-3">
                <div class="size-10 shrink-0 rounded-2xl bg-neutral-100 dark:bg-neutral-800 grid place-items-center text-xl">📍</div>
                <div class="flex-1">
                  <h3 class="font-semibold text-lg leading-tight place"></h3>
                  <p class="text-sm opacity-70 dates"></p>
                </div>
                <div class="text-right">
                  <div class="text-base font-medium rating"></div>
                  <div class="text-sm opacity-70 mood"></div>
                  <div class="text-xs opacity-70 country"></div>
                </div>
              </div>
              <p class="notes whitespace-pre-wrap leading-relaxed"></p>
              <div class="flex gap-2 pt-1">
                <button class="edit px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800">Éditer</button>
                <button class="del px-3 py-1.5 rounded-lg border border-rose-300 text-rose-700 dark:border-rose-800 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/20">Supprimer</button>
              </div>
            </article>
          </template>
        </section>

        <!-- TIMELINE -->
        <section class="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm ring-1 ring-neutral-200/70 dark:ring-neutral-800 p-6">
          <h2 class="font-semibold text-lg mb-4">Timeline</h2>
          <div id="timeline" class="space-y-6"></div>
        </section>

        <!-- STATS PAYS / AN -->
        <section class="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm ring-1 ring-neutral-200/70 dark:ring-neutral-800 p-6">
          <h2 class="font-semibold text-lg mb-4">Stats par pays par année</h2>
          <div id="stats" class="space-y-4"></div>
        </section>
      </main>

      <footer class="container max-w-5xl py-12 text-sm opacity-70">
        <p>LocalStorage, PWA offline. <button id="forceUpdate" class="underline">Vérifier mise à jour</button></p>
      </footer>
    </div>

    <script type="module" src="/assets/app.js"></script>
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
      }
    </script>
  </body>
</html>
```

---

## CSS (src)

**`src/styles.css`**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
html { color-scheme: light dark; }
```

---

## App JS (src)

**`src/app.js`**
```js
// === Constants & Helpers ===
const THEME_KEY = 'travelJournal.theme';
const DATA_KEY = 'travelJournal.v2'; // entries
const DOCS_KEY = 'travelJournal.docs.v1'; // per-destination docs

const root = document.documentElement;
const $ = (s, p=document) => p.querySelector(s);
const $$ = (s, p=document) => Array.from(p.querySelectorAll(s));

function applyTheme(theme) {
  if (theme === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
  localStorage.setItem(THEME_KEY, theme);
}
(function initTheme(){
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light' || saved === 'dark') applyTheme(saved);
  else applyTheme(window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark':'light');
})();

$('#themeBtn')?.addEventListener('click', () => applyTheme(root.classList.contains('dark') ? 'light' : 'dark'));

// === Entries CRUD ===
let entries = [];
function loadEntries(){ try{ entries = JSON.parse(localStorage.getItem(DATA_KEY)||'[]'); }catch{ entries=[]; } }
function saveEntries(){ localStorage.setItem(DATA_KEY, JSON.stringify(entries)); }
function upsertEntry(e){ const i = entries.findIndex(x=>x.id===e.id); if(i>=0) entries[i]=e; else entries.unshift(e); saveEntries(); render(); }
function removeEntry(id){ entries = entries.filter(e=>e.id!==id); saveEntries(); render(); }

function fmtDate(d){ return new Date(d).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'2-digit'}); }
function daysBetween(a,b){ return Math.max(1, Math.round((new Date(b)-new Date(a))/(1000*60*60*24))+1); }

// === Docs model per destination ===
/**
 * Store shape per entryId in DOCS_KEY:
 * {
 *   [entryId]: {
 *     tree: Node[]; // hierarchical
 *     pages: { [pageId]: { id, title, html, created, updated } }
 *     selectedId?: string
 *   }
 * }
 * Node = { id, title, type: 'section'|'page', children?: Node[] }
 */
let docsIndex = {};
function loadDocs(){ try{ docsIndex = JSON.parse(localStorage.getItem(DOCS_KEY)||'{}'); }catch{ docsIndex = {}; } }
function saveDocs(){ localStorage.setItem(DOCS_KEY, JSON.stringify(docsIndex)); }
function ensureDoc(entryId){
  if(!docsIndex[entryId]){
    const pid = crypto.randomUUID();
    docsIndex[entryId] = {
      tree: [ { id: pid, title: 'Page 1', type: 'page' } ],
      pages: { [pid]: { id: pid, title: 'Page 1', html: '', created: Date.now(), updated: Date.now() } },
      selectedId: pid
    };
  }
  return docsIndex[entryId];
}

// Tree utils
function findNodePath(tree, id, path=[]) {
  for (let i=0;i<tree.length;i++){
    const n = tree[i];
    const p = path.concat([{parent: tree, index:i, node:n}]);
    if (n.id===id) return p;
    if (n.children){ const r = findNodePath(n.children, id, p); if (r) return r; }
  }
  return null;
}
function insertAfter(parentArr, index, node){ parentArr.splice(index+1, 0, node); }
function removeAt(parentArr, index){ return parentArr.splice(index,1)[0]; }

// === Rendering: list, timeline, stats ===
const listEl = $('#list');
const cardTpl = $('#cardTpl');

function renderList(){
  const q = $('#search').value.trim().toLowerCase();
  const sort = $('#sort').value;
  const data = entries.slice().filter(e => !q || e.place.toLowerCase().includes(q) || (e.notes||'').toLowerCase().includes(q) || (e.country||'').toLowerCase().includes(q))
    .sort((a,b)=>{
      if (sort==='start-desc') return b.start.localeCompare(a.start);
      if (sort==='start-asc') return a.start.localeCompare(b.start);
      if (sort==='rating-desc') return (b.rating??-1)-(a.rating??-1);
      if (sort==='rating-asc') return (a.rating??99)-(b.rating??99);
      return 0;
    });
  listEl.innerHTML = '';
  if (!data.length){ listEl.innerHTML = '<div class="text-center opacity-60 py-16">Aucune entrée.</div>'; return; }
  for (const e of data){
    const node = cardTpl.content.cloneNode(true);
    $('.place',node).textContent = e.place;
    $('.dates',node).textContent = `${fmtDate(e.start)} → ${fmtDate(e.end)} · ${daysBetween(e.start,e.end)} j`;
    $('.mood',node).textContent = e.mood||'';
    $('.rating',node).textContent = Number.isFinite(e.rating) ? `★ ${e.rating}` : '';
    $('.country',node).textContent = e.country || '';
    $('.notes',node).textContent = e.notes||'';
    $('.edit',node).addEventListener('click', ()=>fillForm(e));
    $('.del',node).addEventListener('click', ()=>{ if(confirm('Supprimer ?')) removeEntry(e.id); });
    // Journal button -> overlay
    const journalBtn = document.createElement('button');
    journalBtn.className = 'px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20';
    journalBtn.textContent = 'Journal';
    $('.del',node).after(journalBtn);
    journalBtn.addEventListener('click', ()=> openJournalOverlay(e.id, `${e.country||''} · ${e.place}`));
    listEl.appendChild(node);
  }
}

function renderTimeline(){
  const byYear = new Map();
  for (const e of entries){ const y = new Date(e.start).getFullYear(); if(!byYear.has(y)) byYear.set(y,[]); byYear

**`src/index.html`** (sert juste pendant le dev si tu veux live-reload avec un simple serveur)
```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dev — Journal</title>
    <link rel="stylesheet" href="/assets/app.css" />
  </head>
  <body>
    <script type="module" src="/assets/app.js"></script>
  </body>
</html>
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


