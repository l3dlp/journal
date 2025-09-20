/**
 * src/app.js — Journal des destinations
 * - Entries CRUD (localStorage)
 * - Timeline + Stats (pays × année)
 * - Journal overlay par destination : treeview (add/rename/delete/order/indent/outdent) + éditeur WYSIWYG
 * - Autosave sur frappe (300ms)
 * - Thème dark/light mémorisé
 */

(() => {
  'use strict';

  // ======== KEYS & DOM HELPERS ========
  const THEME_KEY = 'travelJournal.theme';
  const DATA_KEY  = 'travelJournal.v2';      // destinations
  const DOCS_KEY  = 'travelJournal.docs.v1'; // docs par destination

  const root = document.documentElement;
  const $  = (s, p=document) => p.querySelector(s);
  const $$ = (s, p=document) => Array.from(p.querySelectorAll(s));

  // ======== THEME ========
  function applyTheme(theme) {
    if (theme === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
    try { localStorage.setItem(THEME_KEY, theme); } catch {}
  }
  (function initTheme(){
    let saved;
    try { saved = localStorage.getItem(THEME_KEY); } catch {}
    if (saved === 'light' || saved === 'dark') applyTheme(saved);
    else applyTheme(window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  })();
  $('#themeBtn')?.addEventListener('click', () =>
    applyTheme(root.classList.contains('dark') ? 'light' : 'dark')
  );

  // ======== STORAGE SAFE UTILS ========
  function safeParse(json, fallback) {
    try { return JSON.parse(json); } catch { return fallback; }
  }
  function lsGet(key, fallback) {
    try { const v = localStorage.getItem(key); return v == null ? fallback : safeParse(v, fallback); } catch { return fallback; }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  // ======== ENTRIES (destinations) ========
  /** @type {Array<{id:string,place:string,country:string,start:string,end:string,mood?:string,rating?:number,notes?:string,created:number,updated:number}>} */
  let entries = lsGet(DATA_KEY, []);
  function saveEntries(){ lsSet(DATA_KEY, entries); }

  function upsertEntry(e) {
    const i = entries.findIndex(x => x.id === e.id);
    if (i >= 0) entries[i] = e; else entries.unshift(e);
    saveEntries(); render();
  }
  function removeEntry(id) {
    entries = entries.filter(e => e.id !== id);
    saveEntries(); render();
  }

  function fmtDate(d) {
    return new Date(d).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'2-digit' });
  }
  function daysBetween(a, b) {
    const A = new Date(a).setHours(0,0,0,0);
    const B = new Date(b).setHours(0,0,0,0);
    return Math.max(1, Math.round((B - A) / (1000*60*60*24)) + 1);
  }

  // ======== DOCS (journal par destination) ========
  /**
   * Shape:
   * docsIndex = {
   *   [entryId]: {
   *     tree: Node[],
   *     pages: { [pageId]: { id, title, html, created, updated } },
   *     selectedId?: string
   *   }
   * }
   * Node = { id, title, type:'section'|'page', children?:Node[] }
   */
  let docsIndex = lsGet(DOCS_KEY, {});
  function saveDocs(){ lsSet(DOCS_KEY, docsIndex); }
  function ensureDoc(entryId) {
    if (!docsIndex[entryId]) {
      const pid = crypto.randomUUID();
      docsIndex[entryId] = {
        tree: [ { id: pid, title: 'Page 1', type: 'page' } ],
        pages: { [pid]: { id: pid, title: 'Page 1', html: '', created: Date.now(), updated: Date.now() } },
        selectedId: pid
      };
    }
    return docsIndex[entryId];
  }

  // --- tree helpers
  function findNodePath(tree, id, path=[]) {
    for (let i=0;i<tree.length;i++){
      const n = tree[i];
      const p = path.concat([{ parent: tree, index: i, node: n }]);
      if (n.id === id) return p;
      if (n.children) {
        const r = findNodePath(n.children, id, p);
        if (r) return r;
      }
    }
    return null;
  }
  function insertAfter(arr, index, node){ arr.splice(index+1, 0, node); }
  function removeAt(arr, index){ return arr.splice(index, 1)[0]; }

  // ======== RENDER: LIST / TIMELINE / STATS ========
  const listEl = $('#list');
  const cardTpl = $('#cardTpl');

  function renderList() {
    const q = $('#search')?.value.trim().toLowerCase() || '';
    const sort = $('#sort')?.value || 'start-desc';

    const data = entries
      .filter(e =>
        !q ||
        e.place.toLowerCase().includes(q) ||
        (e.notes||'').toLowerCase().includes(q) ||
        (e.country||'').toLowerCase().includes(q)
      )
      .sort((a,b) => {
        if (sort === 'start-desc') return b.start.localeCompare(a.start);
        if (sort === 'start-asc')  return a.start.localeCompare(b.start);
        if (sort === 'rating-desc') return (b.rating ?? -1) - (a.rating ?? -1);
        if (sort === 'rating-asc')  return (a.rating ?? 99) - (b.rating ?? 99);
        return 0;
      });

    listEl.innerHTML = '';
    if (!data.length) {
      listEl.innerHTML = '<div class="text-center opacity-60 py-16">Aucune entrée.</div>';
      return;
    }

    for (const e of data) {
      const node = cardTpl.content.cloneNode(true);
      $('.place', node).textContent = e.place;
      $('.dates', node).textContent = `${fmtDate(e.start)} → ${fmtDate(e.end)} · ${daysBetween(e.start, e.end)} j`;
      $('.mood', node).textContent  = e.mood || '';
      $('.rating', node).textContent = Number.isFinite(e.rating) ? `★ ${e.rating}` : '';
      $('.country', node).textContent = e.country || '';
      $('.notes', node).textContent = e.notes || '';

      $('.edit', node).addEventListener('click', () => fillForm(e));
      $('.del',  node).addEventListener('click', () => { if (confirm('Supprimer ?')) removeEntry(e.id); });

      // bouton Journal -> overlay
      const journalBtn = document.createElement('button');
      journalBtn.className = 'px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20';
      journalBtn.textContent = 'Journal';
      $('.del', node).after(journalBtn);
      journalBtn.addEventListener('click', () => openJournalOverlay(e.id, `${e.country || ''} · ${e.place}`));

      listEl.appendChild(node);
    }
  }

  function renderTimeline() {
    const host = $('#timeline');
    if (!host) return;
    const byYear = new Map();
    for (const e of entries) {
      const y = new Date(e.start).getFullYear();
      if (!byYear.has(y)) byYear.set(y, []);
      byYear.get(y).push(e);
    }
    const years = Array.from(byYear.keys()).sort((a,b) => b - a);
    host.innerHTML = '';

    for (const y of years) {
      const box = document.createElement('div');
      box.innerHTML = `<div class="text-sm uppercase opacity-70 mb-2">${y}</div>`;
      const wrap = document.createElement('div');
      wrap.className = 'space-y-2';
      const arr = byYear.get(y).sort((a,b) => a.start.localeCompare(b.start));

      for (const e of arr) {
        const d = daysBetween(e.start, e.end);
        const row = document.createElement('div');
        row.className = 'grid grid-cols-12 items-center gap-3';
        row.innerHTML = `
          <div class="col-span-3 text-sm">${fmtDate(e.start)} → ${fmtDate(e.end)}</div>
          <div class="col-span-6">
            <div class="h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
              <div class="h-full bg-neutral-900 dark:bg-white" style="width:${Math.min(100, d/3)}%"></div>
            </div>
          </div>
          <div class="col-span-3 text-sm truncate"><span class="opacity-70">${e.country||''}</span> · ${e.place}</div>
        `;
        wrap.appendChild(row);
      }

      box.appendChild(wrap);
      host.appendChild(box);
    }
  }

  function renderStats() {
    const host = $('#stats');
    if (!host) return;
    const agg = new Map(); // key `${country}|${year}` -> days
    for (const e of entries) {
      const y = new Date(e.start).getFullYear();
      const k = `${(e.country||'—').trim()}|${y}`;
      const d = daysBetween(e.start, e.end);
      agg.set(k, (agg.get(k) || 0) + d);
    }
    const rows = Array.from(agg.entries())
      .map(([k, v]) => { const [country, year] = k.split('|'); return { country, year: Number(year), days: v }; })
      .sort((a,b) => b.year - a.year || b.days - a.days || a.country.localeCompare(b.country));

    host.innerHTML = '';
    let curYear = null, section = null;
    for (const r of rows) {
      if (r.year !== curYear) {
        curYear = r.year;
        section = document.createElement('div');
        section.innerHTML = `<div class="text-sm uppercase opacity-70 mt-4 mb-2">${curYear}</div>`;
        host.appendChild(section);
      }
      const line = document.createElement('div');
      line.className = 'flex items-center gap-3';
      const pct = Math.min(100, Math.round((r.days/365)*100));
      line.innerHTML = `
        <div class="w-36 shrink-0 text-sm">${r.country}</div>
        <div class="flex-1 h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
          <div class="h-full bg-neutral-900 dark:bg-white" style="width:${pct}%"></div>
        </div>
        <div class="w-16 text-right text-sm tabular-nums">${r.days} j</div>
      `;
      section.appendChild(line);
    }
  }

  function render() { renderList(); renderTimeline(); renderStats(); }

  // ======== FORM (création / édition) ========
  const form = $('#entryForm');

  function fillForm(e) {
    $('#entryId').value   = e.id;
    $('#place').value     = e.place;
    $('#country').value   = e.country || '';
    $('#start').value     = e.start;
    $('#end').value       = e.end;
    $('#mood').value      = e.mood || '';
    $('#rating').value    = e.rating ?? '';
    $('#notes').value     = e.notes || '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function clearForm() {
    form?.reset();
    $('#entryId').value = '';
  }

  form?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const now = Date.now();
    const entry = {
      id: $('#entryId').value || crypto.randomUUID(),
      place:   $('#place').value.trim(),
      country: $('#country').value.trim(),
      start:   $('#start').value,
      end:     $('#end').value,
      mood:    $('#mood').value || undefined,
      rating:  $('#rating').value === '' ? undefined : Number($('#rating').value),
      notes:   $('#notes').value.trim() || undefined,
      created: now,
      updated: now
    };
    upsertEntry(entry);
    clearForm();
  });

  $('#resetBtn')?.addEventListener('click', clearForm);
  $('#search')?.addEventListener('input', render);
  $('#sort')?.addEventListener('change', render);

  // ======== EXPORT / IMPORT DESTINATIONS ========
  $('#exportBtn')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type:'application/json' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'journal-destinations.json';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  });

  $('#importInput')?.addEventListener('change', async () => {
    const file = $('#importInput').files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error('Format inattendu');
      for (const e of data) { if (!e.id || !e.place || !e.start || !e.end) throw new Error('Entrée invalide'); }
      entries = data; saveEntries(); render(); alert('Import terminé.');
    } catch (err) {
      alert('Import impossible: ' + err.message);
    } finally {
      $('#importInput').value = '';
    }
  });

  // ======== JOURNAL OVERLAY (Docs par destination) ========
  // Build overlay at runtime to keep index.html clean
  const overlay = document.createElement('div');
  overlay.id = 'journalOverlay';
  overlay.className = 'fixed inset-0 z-[100] hidden';
  overlay.innerHTML = `
    <div class="absolute inset-0 bg-neutral-950/70 backdrop-blur-sm"></div>
    <div class="absolute inset-2 md:inset-6 bg-white dark:bg-neutral-900 rounded-2xl shadow-xl ring-1 ring-neutral-200/70 dark:ring-neutral-800 overflow-hidden flex">
      <!-- Left: tree (desktop) -->
      <aside class="hidden md:block w-[30%] max-w-[300px] border-r border-neutral-200 dark:border-neutral-800 overflow-y-auto" id="treePane"></aside>
      <!-- Right: editor -->
      <section class="flex-1 flex flex-col min-w-0">
        <header class="flex items-center gap-2 p-3 border-b border-neutral-200 dark:border-neutral-800">
          <button id="treeToggle" class="md:hidden px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700">Menu</button>
          <div class="text-sm opacity-70 truncate" id="journalTitle"></div>
          <button id="closeJournal" class="ml-auto px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700">✕</button>
        </header>
        <div class="flex-1 min-h-0 flex">
          <!-- Drawer for mobile tree -->
          <div id="treeDrawer" class="md:hidden fixed inset-y-0 left-0 w-[80%] max-w-[300px] bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 translate-x-[-110%] transition-transform"></div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 p-3 border-b border-neutral-200 dark:border-neutral-800">
              <div class="text-sm opacity-70" id="pagePath"></div>
              <div class="ml-auto inline-flex gap-2">
                <button id="btnBold" class="px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700" title="Gras (Ctrl+B)">B</button>
                <button id="btnIt"   class="px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700" title="Italique (Ctrl+I)">I</button>
                <button id="btnH2"   class="px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700" title="Titre H2">H2</button>
                <button id="btnUl"   class="px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700" title="Liste à puces">• List</button>
              </div>
            </div>
            <div id="editor" class="prose prose-neutral dark:prose-invert max-w-none p-4 outline-none min-h-[60vh]" contenteditable="true" spellcheck="true" aria-label="Éditeur"></div>
          </div>
        </div>
      </section>
    </div>`;
  document.body.appendChild(overlay);

  let currentEntryId = null;
  let currentPageId = null;
  let saveTimer = null;

  function openJournalOverlay(entryId, title) {
    currentEntryId = entryId;
    ensureDoc(entryId);
    buildTreePanels(entryId);
    $('#journalTitle', overlay).textContent = title;
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    selectNode(entryId, docsIndex[entryId].selectedId);
  }
  function closeJournalOverlay() {
    overlay.classList.add('hidden');
    document.body.style.overflow = '';
    currentEntryId = null;
    currentPageId  = null;
  }
  $('#closeJournal', overlay).addEventListener('click', closeJournalOverlay);
  overlay.addEventListener('click', (ev) => {
    // close when clicking the dimmed backdrop (but not inner panel)
    if (ev.target === overlay.firstElementChild) closeJournalOverlay();
  });
  window.addEventListener('keydown', (e) => {
    if (!overlay.classList.contains('hidden') && e.key === 'Escape') closeJournalOverlay();
  });
  $('#treeToggle', overlay).addEventListener('click', () => {
    const d = $('#treeDrawer', overlay);
    d.style.transform = d.style.transform.includes('-110%') ? 'translateX(0)' : 'translateX(-110%)';
  });

  // ---- Tree panels (desktop + mobile share the same renderer)
  function buildTreePanels(entryId) {
    const state = ensureDoc(entryId);
    const hostDesktop = $('#treePane', overlay);
    const hostMobile  = $('#treeDrawer', overlay);
    hostDesktop.innerHTML = hostMobile.innerHTML = '';

    const toolbar = (where) => {
      const bar = document.createElement('div');
      bar.className = 'p-3 flex flex-wrap gap-2 border-b border-neutral-200 dark:border-neutral-800';
      bar.innerHTML = `
        <button data-act="add-page" class="px-3 py-1.5 rounded-lg border">+ Page</button>
        <button data-act="add-sec"  class="px-3 py-1.5 rounded-lg border">+ Section</button>
        <button data-act="rename"   class="px-3 py-1.5 rounded-lg border">Renommer</button>
        <button data-act="del"      class="px-3 py-1.5 rounded-lg border text-rose-700 dark:text-rose-300">Supprimer</button>
        <button data-act="up"       class="px-3 py-1.5 rounded-lg border">↑</button>
        <button data-act="down"     class="px-3 py-1.5 rounded-lg border">↓</button>
        <button data-act="indent"   class="px-3 py-1.5 rounded-lg border">→</button>
        <button data-act="outdent"  class="px-3 py-1.5 rounded-lg border">←</button>`;
      where.appendChild(bar);
      bar.addEventListener('click', (ev) => onTreeAction(ev, entryId));
    };

    const list = (where) => {
      const ul = document.createElement('ul');
      ul.className = 'p-2';
      function renderNodes(arr, parentUl) {
        for (const n of arr) {
          const li  = document.createElement('li'); li.className = 'select-none'; li.dataset.id = n.id;
          const row = document.createElement('div');
          row.className = 'flex items-center gap-2 px-2 py-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer';
          row.innerHTML = `${n.type === 'section' ? '📁' : '📄'} <span class="truncate">${n.title}</span>`;
          if (state.selectedId === n.id) row.classList.add('bg-neutral-100','dark:bg-neutral-800');
          row.addEventListener('click', () => selectNode(entryId, n.id));
          li.appendChild(row);
          if (n.children?.length) {
            const childUl = document.createElement('ul');
            childUl.className = 'ml-4 border-l border-neutral-200 dark:border-neutral-800';
            renderNodes(n.children, childUl);
            li.appendChild(childUl);
          }
          parentUl.appendChild(li);
        }
      }
      renderNodes(state.tree, ul);
      where.appendChild(ul);
    };

    toolbar(hostDesktop); list(hostDesktop);
    toolbar(hostMobile);  list(hostMobile);
  }

  function onTreeAction(ev, entryId) {
    const btn = ev.target.closest('button'); if (!btn) return;
    const action = btn.dataset.act;
    const d = ensureDoc(entryId);

    let selPath = d.selectedId ? findNodePath(d.tree, d.selectedId) : null;
    if (!selPath && action !== 'add-page' && action !== 'add-sec') return;

    const mkPage = (title='Nouvelle page') => {
      const id = crypto.randomUUID();
      d.pages[id] = { id, title, html:'', created: Date.now(), updated: Date.now() };
      return { id, title, type:'page' };
    };
    const mkSec  = (title='Nouvelle section') => ({ id: crypto.randomUUID(), title, type:'section', children: [] });

    if (action === 'add-page' || action === 'add-sec') {
      const node = (action === 'add-page') ? mkPage() : mkSec();
      if (selPath) insertAfter(selPath[selPath.length-1].parent, selPath[selPath.length-1].index, node);
      else d.tree.push(node);
      d.selectedId = node.id; saveDocs(); buildTreePanels(entryId); selectNode(entryId, node.id); return;
    }

    const last = selPath[selPath.length-1];

    if (action === 'rename') {
      const newTitle = prompt('Nouveau titre :', last.node.title);
      if (!newTitle) return;
      last.node.title = newTitle;
      if (last.node.type === 'page') d.pages[last.node.id].title = newTitle;
      saveDocs(); buildTreePanels(entryId); return;
    }

    if (action === 'del') {
      if (!confirm('Supprimer ?')) return;
      const removed = removeAt(last.parent, last.index);
      if (removed.type === 'page') delete d.pages[removed.id];
      d.selectedId = d.tree[0]?.id || null;
      saveDocs(); buildTreePanels(entryId); selectNode(entryId, d.selectedId); return;
    }

    if (action === 'up' && last.index > 0) {
      const arr = last.parent; const [it] = arr.splice(last.index, 1); arr.splice(last.index - 1, 0, it);
      saveDocs(); buildTreePanels(entryId); return;
    }

    if (action === 'down' && last.index < last.parent.length - 1) {
      const arr = last.parent; const [it] = arr.splice(last.index, 1); arr.splice(last.index + 1, 0, it);
      saveDocs(); buildTreePanels(entryId); return;
    }

    if (action === 'indent' && last.index > 0) {
      const prev = last.parent[last.index - 1];
      if (!prev.children) prev.children = [];
      const [it] = last.parent.splice(last.index, 1);
      prev.children.push(it);
      saveDocs(); buildTreePanels(entryId); return;
    }

    if (action === 'outdent' && selPath.length > 1) {
      const parentPath = selPath[selPath.length - 2]; // the parent
      const grand      = selPath[selPath.length - 3]; // parent's parent (maybe undefined)
      const [it] = parentPath.node.children.splice(parentPath.index, 1);
      // insert after the parent node in the grandparent array, or to root
      const arr = grand ? grand.parent : d.tree;
      const idx = grand ? grand.index : -1;
      insertAfter(arr, idx, it); // idx -1 -> push at head via our helper? (index+1 = 0) => ok
      saveDocs(); buildTreePanels(entryId); return;
    }
  }

  // ======== ÉDITEUR (WYSIWYG) ========
  const editorEl = $('#editor', overlay);
  function selectNode(entryId, nodeId) {
    const d = ensureDoc(entryId);
    d.selectedId = nodeId; saveDocs(); buildTreePanels(entryId);
    const nodePath = findNodePath(d.tree, nodeId);
    const node = nodePath?.[nodePath.length-1]?.node;
    const pathStr = nodePath?.map(p => p.node.title).join(' / ') || '';
    $('#pagePath', overlay).textContent = pathStr;

    if (node?.type === 'page') {
      currentPageId = node.id;
      editorEl.innerHTML = d.pages[node.id]?.html || '';
      if (window.innerWidth < 768) $('#treeDrawer', overlay).style.transform = 'translateX(-110%)';
      editorEl.focus();
    } else {
      currentPageId = null;
      editorEl.innerHTML = '<div class="opacity-60">Sélectionne une page pour écrire…</div>';
    }
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (!currentEntryId || !currentPageId) return;
      const d = ensureDoc(currentEntryId);
      const pg = d.pages[currentPageId];
      if (!pg) return;
      pg.html = editorEl.innerHTML;
      pg.updated = Date.now();
      saveDocs();
    }, 300);
  }
  editorEl.addEventListener('input', scheduleSave);

  // Toolbar actions
  $('#btnBold', overlay).addEventListener('click', () => document.execCommand('bold'));
  $('#btnIt',   overlay).addEventListener('click', () => document.execCommand('italic'));
  $('#btnH2',   overlay).addEventListener('click', () => document.execCommand('formatBlock', false, 'h2'));
  $('#btnUl',   overlay).addEventListener('click', () => document.execCommand('insertUnorderedList'));
  // Hotkeys for editor
  editorEl.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); document.execCommand('bold'); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') { e.preventDefault(); document.execCommand('italic'); }
  });

  // ======== SW UPDATE HOOK ========
  $('#forceUpdate')?.addEventListener('click', async () => {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      await reg?.update();
      alert('Vérification des mises à jour effectuée.');
    }
  });

  // ======== BOOT ========
  render();

})();
