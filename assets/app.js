/**
 * Lookit Media Master — WordPress Plugin JS
 * v3.11 · Lookit AI platform integration (n8n → AWS Bedrock)
 *
 * Tabs: Image Resizer (upload + library resize) | Alt Text Manager | Title Manager
 */
(function () {
  'use strict';

  const AJAX  = window.LMT?.ajax  || '';
  const NONCE = window.LMT?.nonce || '';

  /* ══════════════════════════════════════════════════════
     THEME SWITCHER  (light / dark)
     Persists via localStorage. Applies .lmt-light on the
     wrap and .lmt-light-page / .lmt-dark-page on <body>
     so WP admin background colours update too.
  ══════════════════════════════════════════════════════ */

  const THEME_KEY  = 'lmt_theme';
  const root       = document.getElementById('lmt-root');
  const body       = document.body;
  const toggleBtn  = document.getElementById('lmt-theme-toggle');

  function applyTheme(theme) {
    const isLight = theme === 'light';
    root?.classList.toggle('lmt-light', isLight);
    body.classList.toggle('lmt-light-page', isLight);
    body.classList.toggle('lmt-dark-page',  !isLight);
    // Also update the admin page wrapper bg directly for instant feedback
    const adminPage = document.querySelector('.lmt-admin-page');
    if (adminPage) adminPage.style.background = isLight ? '#f0f2f5' : '#0d1117';
  }

  function toggleTheme() {
    const current = localStorage.getItem(THEME_KEY) || 'dark';
    const next    = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  }

  // Apply saved preference immediately on load
  applyTheme(localStorage.getItem(THEME_KEY) || 'dark');
  toggleBtn?.addEventListener('click', toggleTheme);

  /* v3.27.1 — Colour mode now lives in Settings → Appearance as a pair of
     option tiles, alongside Text size. The old topbar toggle is gone but its
     handler stays above, so nothing breaks if it is ever put back. */
  function syncThemeOpts(theme) {
    document.querySelectorAll('#lmt-theme-opts .lmt-fs-opt').forEach(b => {
      b.classList.toggle('active', b.dataset.theme === theme);
    });
  }
  document.getElementById('lmt-theme-opts')?.addEventListener('click', function (e) {
    const btn = e.target.closest('.lmt-fs-opt');
    if (!btn) return;
    const theme = btn.dataset.theme === 'light' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, theme);
    applyTheme(theme);
    syncThemeOpts(theme);
  });
  syncThemeOpts(localStorage.getItem(THEME_KEY) || 'dark');

  /* ══════════════════════════════════════════════════════
     CORNER STYLE  (rounded / square)
     Persists via localStorage. Applies .lmt-square on the
     wrap, which zeroes the border-radius tokens.
  ══════════════════════════════════════════════════════ */

  const CORNERS_KEY = 'lmt_corners';
  const cornersBtn  = document.getElementById('lmt-corners-toggle');

  function applyCorners(mode) {
    const square = mode === 'square';
    root?.classList.toggle('lmt-square', square);
    const lbl = document.getElementById('lmt-corners-label');
    if (lbl) lbl.textContent = square ? 'Rounded Corners' : 'Square Corners';
  }
  function toggleCorners() {
    const current = localStorage.getItem(CORNERS_KEY) || 'rounded';
    const next    = current === 'rounded' ? 'square' : 'rounded';
    localStorage.setItem(CORNERS_KEY, next);
    applyCorners(next);
  }
  applyCorners(localStorage.getItem(CORNERS_KEY) || 'rounded');

  /* v3.27.1 — Corner style, same treatment as colour mode. */
  function syncCornerOpts(mode) {
    document.querySelectorAll('#lmt-corners-opts .lmt-fs-opt').forEach(b => {
      b.classList.toggle('active', b.dataset.corners === mode);
    });
  }
  document.getElementById('lmt-corners-opts')?.addEventListener('click', function (e) {
    const btn = e.target.closest('.lmt-fs-opt');
    if (!btn) return;
    const mode = btn.dataset.corners === 'square' ? 'square' : 'rounded';
    localStorage.setItem(CORNERS_KEY, mode);
    applyCorners(mode);
    syncCornerOpts(mode);
  });
  syncCornerOpts(localStorage.getItem(CORNERS_KEY) || 'rounded');

  /* ══════════════════════════════════════════════════════
     v3.23.0 — TEXT SIZE
     Every font-size in style.css is calc(Npx * var(--lmt-fs,1)),
     so one custom property scales the whole plugin. Stored per
     browser next to the theme and corner preferences; nothing is
     written to the database and no request is made.
     ══════════════════════════════════════════════════════ */
  const FS_KEY    = 'lmt_text_scale';
  const FS_STEPS  = ['0.92', '1', '1.15', '1.3'];

  function applyTextScale(scale) {
    const val = FS_STEPS.indexOf(String(scale)) === -1 ? '1' : String(scale);
    document.querySelectorAll('.lmt-wrap').forEach(el => {
      el.style.setProperty('--lmt-fs', val);
    });
    document.querySelectorAll('#lmt-fs-opts .lmt-fs-opt').forEach(b => {
      const on = b.dataset.scale === val;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    return val;
  }

  let savedScale = null;
  try { savedScale = localStorage.getItem(FS_KEY); } catch (e) { /* private mode */ }
  applyTextScale(savedScale || '1');

  document.getElementById('lmt-fs-opts')?.addEventListener('click', function (e) {
    const btn = e.target.closest('.lmt-fs-opt');
    if (!btn) return;
    const val = applyTextScale(btn.dataset.scale);
    try { localStorage.setItem(FS_KEY, val); } catch (err) { /* private mode */ }
  });

  /* ══════════════════════════════════════════════════════
     v3.23.0 — PAGE MEMORY
     Each tool remembers the page it was left on, so reopening a
     tool — or coming back from an image page — lands where you
     were rather than at the top of the library. Per browser, and
     switchable off in Settings › Appearance.
     ══════════════════════════════════════════════════════ */
  const PAGE_KEY   = 'lmt_page_';
  const REMEMBER_K = 'lmt_remember_page';

  window.LMTPages = {
    enabled: function () {
      try { return localStorage.getItem(REMEMBER_K) !== '0'; } catch (e) { return false; }
    },
    remember: function (tool, page) {
      if (!this.enabled()) return;
      try { localStorage.setItem(PAGE_KEY + tool, String(parseInt(page, 10) || 1)); } catch (e) { /* private mode */ }
    },
    recall: function (tool) {
      if (!this.enabled()) return 1;
      let v = null;
      try { v = localStorage.getItem(PAGE_KEY + tool); } catch (e) { return 1; }
      const n = parseInt(v, 10);
      return n > 0 ? n : 1;
    },
    clear: function () {
      ['mlr', 'alt', 'title'].forEach(t => {
        try { localStorage.removeItem(PAGE_KEY + t); } catch (e) { /* private mode */ }
      });
    }
  };

  /* Settings toggle. Turning it off clears what's already stored, so the
     next visit genuinely starts at page 1 rather than at a stale page. */
  const rememberBox = document.getElementById('lmt-remember-page');
  if (rememberBox) {
    rememberBox.checked = window.LMTPages.enabled();
    rememberBox.addEventListener('change', function () {
      try { localStorage.setItem(REMEMBER_K, this.checked ? '1' : '0'); } catch (e) { /* private mode */ }
      if (!this.checked) window.LMTPages.clear();
    });
  }

  /* Read-only navigation hints set by the image page's Back link:
     ?paged= which page to reopen, ?hl= which card to scroll to. */
  window.LMTReturn = { paged: 0, hl: 0 };
  try {
    const q = new URLSearchParams(window.location.search);
    window.LMTReturn.paged = parseInt(q.get('paged'), 10) || 0;
    window.LMTReturn.hl    = parseInt(q.get('hl'), 10) || 0;
  } catch (e) { /* older browser */ }

  /* Scroll the card you came back from into view and flash it once, so a
     page of near-identical thumbnails doesn't lose your place. */
  window.lmtHighlightReturn = function (prefix) {
    const id = window.LMTReturn.hl;
    if (!id) return;
    const card = document.getElementById(prefix + '-card-' + id);
    if (!card) return;
    window.LMTReturn.hl = 0;
    card.scrollIntoView({ block: 'center', behavior: 'smooth' });
    card.classList.add('lmt-card-returned');
    setTimeout(() => card.classList.remove('lmt-card-returned'), 2400);
  };

  /* Build the "Edit details" link for a card: the plugin's own image page,
     carrying enough context to come back to this exact spot. */
  window.lmtDetailUrl = function (img, tool, page) {
    if (!img || !img.detail_url) return (img && img.edit_url) || '#';
    const sep = img.detail_url.indexOf('?') === -1 ? '?' : '&';
    return img.detail_url + sep + 'from=' + encodeURIComponent(tool) + '&paged=' + (parseInt(page, 10) || 1);
  };
  cornersBtn?.addEventListener('click', toggleCorners);

  /* ══════════════════════════════════════════════════════
     SHARED HELPERS
  ══════════════════════════════════════════════════════ */

  function post(action, data = {}) {
    const body = new URLSearchParams({ action, nonce: NONCE, ...data });
    return fetch(AJAX, { method: 'POST', body }).then(r => r.json());
  }

  function formatBytes(bytes) {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function escHtml(s) {
    return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function usageChipHtml(id, count) {
    return count > 0
      ? `<span class="lmt-chip lmt-chip-use lmt-chip-clickable" onclick="window.lmtShowUsage(${id})" title="See where this image is used">📄 Used in ${count}</span>`
      : `<span class="lmt-chip lmt-chip-muted" title="Not embedded in any post or page">Unused</span>`;
  }

  /* Cross-tab "needs attention" chip row. Shows warnings for missing alt /
     auto title, and an image-usage count, so every grid reads as a worklist. */
  function attentionChips(img, opts) {
    opts = opts || {};
    const chips = [];
    if (!opts.skipAlt   && img.has_alt === false) chips.push('<span class="lmt-chip lmt-chip-warn">⚠ No alt</span>');
    if (!opts.skipTitle && img.is_auto === true)  chips.push('<span class="lmt-chip lmt-chip-warn">⚠ Auto title</span>');
    if (typeof img.used === 'number') {
      chips.push(usageChipHtml(img.id, img.used));
    } else if (img.used === null) {
      /* v3.39.0 — usage counts are fetched after the grid renders, so a slow
         content-table scan no longer holds up the whole page. Placeholder
         keeps the card height stable until fillUsageCounts fills it. */
      chips.push(`<span class="lmt-chip lmt-chip-muted lmt-usage-slot" data-usage-id="${img.id}">Checking usage…</span>`);
    }
    return chips.length ? `<div class="lmt-chips">${chips.join('')}</div>` : '';
  }

  /* v3.39.3 — fills a placeholder chip in place using plain DOM properties.
     Deliberately avoids rewriting the element from a markup string: the text is
     set with textContent, so nothing here can be read as markup. */
  function applyUsageChip(slot, id, count) {
    if (count > 0) {
      slot.className = 'lmt-chip lmt-chip-use lmt-chip-clickable';
      slot.textContent = `📄 Used in ${count}`;
      slot.title = 'See where this image is used';
      slot.addEventListener('click', () => window.lmtShowUsage(id));
    } else {
      slot.className = 'lmt-chip lmt-chip-muted';
      slot.textContent = 'Unused';
      slot.title = 'Not embedded in any post or page';
    }
    slot.removeAttribute('data-usage-id');
  }

  /* v3.39.0 — ask for usage counts for the page that just rendered and drop
     them into their placeholder chips. Failure is silent: the placeholders are
     removed and the grid stays usable. */
  function fillUsageCounts(items) {
    const ids = (items || []).filter(i => i && i.used === null).map(i => i.id);
    if (!ids.length) return;

    const clearSlots = batch => batch.forEach(id => {
      document.querySelectorAll(`.lmt-usage-slot[data-usage-id="${id}"]`).forEach(el => el.remove());
    });

    for (let offset = 0; offset < ids.length; offset += 100) {
      const batch = ids.slice(offset, offset + 100);
      const body = new URLSearchParams({ action: 'lmt_usage_counts', nonce: NONCE });
      batch.forEach(id => body.append('ids[]', id));

      fetch(AJAX, { method: 'POST', body }).then(r => r.json()).then(res => {
        if (!res || !res.success) { clearSlots(batch); return; }
        const counts = res.data.counts || {};
        batch.forEach(id => {
          const slot = document.querySelector(`.lmt-usage-slot[data-usage-id="${id}"]`);
          if (!slot) return;
          const c = counts[id];
          if (typeof c !== 'number') { slot.remove(); return; }
          applyUsageChip(slot, id, c);
        });
      }).catch(() => clearSlots(batch));
    }
  }

  /* Rough resize savings estimate. File size for photos scales ~with pixel
     count, so we scale by the area ratio. Labelled "~" — it's an estimate.
     We show only the savings at the target size (not before/after file sizes). */
  /* v3.28.0 — Resize target is a mode plus one or two numbers:
       { mode: 'w',  w: 1200 }            cap the width, height follows
       { mode: 'h',  h: 1200 }            cap the height, width follows
       { mode: 'wh', w: 1200, h: 800 }    fit inside the box, aspect kept
     lmtFitScale returns the scale factor, never above 1 (no upscaling). */
  function lmtFitScale(w, h, t) {
    if (!w || !h || !t) return 1;
    let scale = 1;
    if (t.mode === 'h')       scale = t.h ? t.h / h : 1;
    else if (t.mode === 'wh') scale = Math.min(t.w ? t.w / w : 1, t.h ? t.h / h : 1);
    else                      scale = t.w ? t.w / w : 1;
    return Math.min(1, scale);
  }

  function lmtTargetLabel(t) {
    if (!t) return '—';
    if (t.mode === 'h')  return `${t.h}px tall`;
    if (t.mode === 'wh') return `${t.w}×${t.h}px`;
    return `${t.w}px wide`;
  }

  function resizeEstimate(img, target) {
    const w = img.width || 0, h = img.height || 0;
    if (!w || !h || !img.filesize) return null;
    const scale = lmtFitScale(w, h, target);
    if (scale >= 1) {
      // Name the dimension that was measured, so "no change" is never a mystery.
      const now = target.mode === 'h'  ? `${h}px tall`
                : target.mode === 'wh' ? `${w}\u00d7${h}`
                :                        `${w}px wide`;
      return { changed: false, saved: 0, text: `No change — ${now} already fits ${lmtTargetLabel(target)}` };
    }
    const estBytes = Math.round(img.filesize * scale * scale);
    const saved    = Math.max(0, img.filesize - estBytes);
    return {
      changed: true,
      saved,
      text: `↓ Save ~${formatBytes(saved)} at ${Math.round(w * scale)}×${Math.round(h * scale)}`
    };
  }

  /* ── Usage modal: shows where an image is embedded, with links ──── */
  function lmtEnsureModal() {
    let overlay = document.getElementById('lmt-modal-overlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'lmt-modal-overlay';
    overlay.className = 'lmt-modal-overlay lmt-hidden';
    overlay.innerHTML =
      `<div class="lmt-modal" role="dialog" aria-modal="true">
         <div class="lmt-modal-head">
           <span class="lmt-modal-title" id="lmt-modal-title">Image usage</span>
           <button type="button" class="lmt-modal-close" id="lmt-modal-close" aria-label="Close">&times;</button>
         </div>
         <div class="lmt-modal-body" id="lmt-modal-body"></div>
       </div>`;
    // Mount inside the plugin root (.lmt-wrap) so the modal inherits the theme
    // CSS variables and light/dark mode — appending to <body> leaves it unstyled.
    (document.getElementById('lmt-root') || document.body).appendChild(overlay);
    const close = () => overlay.classList.add('lmt-hidden');
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('#lmt-modal-close').addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    return overlay;
  }

  window.lmtShowUsage = async function(id) {
    const overlay = lmtEnsureModal();
    const body    = overlay.querySelector('#lmt-modal-body');
    const title   = overlay.querySelector('#lmt-modal-title');
    title.textContent = 'Image usage';
    body.innerHTML = '<div class="lmt-modal-loading">Looking up where this image is used…</div>';
    overlay.classList.remove('lmt-hidden');

    try {
      const res = await post('lmt_usage_list', { id });
      if (!res.success) throw new Error(res.data || 'Lookup failed');
      const items = res.data.items || [];
      title.textContent = `Used in ${items.length} place${items.length === 1 ? '' : 's'}`;
      if (!items.length) {
        body.innerHTML = '<div class="lmt-modal-empty">This image isn’t embedded in any post or page.</div>';
        return;
      }
      body.innerHTML = '<ul class="lmt-usage-list">' + items.map(it => {
        const view = it.view ? `<a href="${escHtml(it.view)}" target="_blank" rel="noopener">View</a>` : '';
        const edit = it.edit ? `<a href="${escHtml(it.edit)}" target="_blank" rel="noopener">Edit</a>` : '';
        const status = it.status && it.status !== 'publish' ? ` <span class="lmt-usage-status">${escHtml(it.status)}</span>` : '';
        return `<li>
                  <div class="lmt-usage-main">
                    <span class="lmt-usage-type">${escHtml(it.type)}</span>
                    <span class="lmt-usage-name">${escHtml(it.title)}</span>${status}
                  </div>
                  <div class="lmt-usage-links">${view}${edit}</div>
                </li>`;
      }).join('') + '</ul>';
    } catch (err) {
      body.innerHTML = `<div class="lmt-modal-empty">Couldn’t load usage: ${escHtml(err.message || 'error')}</div>`;
    }
  };

  function buildPagination(containerId, currentPage, totalPages, onPageFn) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (totalPages <= 1) { el.innerHTML = ''; return; }
    let html = `<button ${currentPage===1?'disabled':''} onclick="(${onPageFn.toString()})(${currentPage-1})">‹ Prev</button>`;
    const range = [];
    for (let i = Math.max(1, currentPage-3); i <= Math.min(totalPages, currentPage+3); i++) range.push(i);
    if (range[0] > 1) { html += `<button onclick="(${onPageFn.toString()})(1)">1</button>`; if (range[0] > 2) html += '<span>…</span>'; }
    range.forEach(i => { html += `<button class="${i===currentPage?'active':''}" onclick="(${onPageFn.toString()})(${i})">${i}</button>`; });
    if (range[range.length-1] < totalPages) { if (range[range.length-1] < totalPages-1) html += '<span>…</span>'; html += `<button onclick="(${onPageFn.toString()})(${totalPages})">${totalPages}</button>`; }
    html += `<button ${currentPage===totalPages?'disabled':''} onclick="(${onPageFn.toString()})(${currentPage+1})">Next ›</button>`;
    el.innerHTML = html;
  }

  /* ══════════════════════════════════════════════════════
     TAB SWITCHER
  ══════════════════════════════════════════════════════ */

  const TAB_KEY = 'lmt_tab';
  const tabs    = document.querySelectorAll('.lmt-tab');
  const panels  = document.querySelectorAll('.lmt-panel');

  function activateTab(name, remember) {
    const tab   = document.querySelector('.lmt-tab[data-tab="' + name + '"]');
    const panel = document.getElementById('lmt-panel-' + name);
    if (!tab || !panel) return false;

    tabs.forEach(t => t.classList.remove('active'));
    panels.forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    panel.classList.add('active');

    if (remember) {
      try { localStorage.setItem(TAB_KEY, name); } catch (e) { /* private mode */ }
    }
    return true;
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => activateTab(tab.dataset.tab, true));
  });

  /* Reopen on whichever tab was last used. A saved tab that no longer
     exists (renamed or removed in an update) just falls through to the
     default already marked active in the markup. */
  (function restoreTab() {
    // v3.21.0 — an explicit ?tab= in the URL wins over the remembered tab.
    // This is how the old settings URL lands on the Settings panel.
    const root = document.getElementById('lmt-root');
    const fromUrl = root?.dataset.initialTab || null;
    const filterFromUrl = root?.dataset.initialFilter || null;
    if (fromUrl && activateTab(fromUrl, false)) {
      /* The tool's filter setter is wired further down this file, so instead of
         calling it we set the <select> the loader already reads. The tool's
         first load then comes back filtered — no second request — and the tiles
         are synced once the setters exist. */
      if (filterFromUrl) {
        const sel = document.getElementById(fromUrl + '-filter');
        if (sel && sel.querySelector('[value="' + filterFromUrl + '"]')) {
          sel.value = filterFromUrl;
          window.LMTDeepFilter = { tab: fromUrl, filter: filterFromUrl };
          setTimeout(function () { window.lmtSyncTiles?.(fromUrl, filterFromUrl); }, 0);
        }
      }
      return;
    }

    let saved = null;
    try { saved = localStorage.getItem(TAB_KEY); } catch (e) { /* private mode */ }
    if (saved) activateTab(saved, false);
  })();

  // "⚙ Settings" buttons inside the AI banners jump to the panel rather
  // than leaving the screen.
  document.querySelectorAll('.lmt-goto-settings').forEach(function (b) {
    b.addEventListener('click', function () { activateTab('settings', true); });
  });
  window.lmtGotoSettings = function () { activateTab('settings', true); };

  /* v3.23.0 — which tool is on screen. Used to decide whether a ?paged=
     in the URL belongs to this tab. */
  function lmtActiveTabName() {
    const active = document.querySelector('.lmt-tab.active');
    return active ? active.dataset.tab : '';
  }
  window.lmtActiveTabName = lmtActiveTabName;

  /* v3.23.0 — the All tasks cards are shortcuts to the tools.
     v3.36.0 — a card may also carry data-goto-filter, in which case the tool
     opens with that slice already selected. The filter is applied after the
     tab switch so the grid reloads against the right filter, not twice. */
  function lmtApplyToolFilter(tab, filter) {
    if (!filter) return;
    if (tab === 'alt'   && window.lmtAltFilter)   window.lmtAltFilter(filter);
    if (tab === 'title' && window.lmtTitleFilter) window.lmtTitleFilter(filter);
  }
  window.lmtApplyToolFilter = lmtApplyToolFilter;

  document.querySelectorAll('[data-goto-tab]').forEach(function (card) {
    card.addEventListener('click', function () {
      const tab = card.dataset.gotoTab;
      activateTab(tab, true);
      lmtApplyToolFilter(tab, card.dataset.gotoFilter);
    });
  });

  /* Each card says how much work is waiting, and where you left off. The
     numbers come from the stats endpoints the rail badges already call;
     lmtHomeCounts() is invoked from those handlers once the data lands. */
  window.lmtHomeCounts = function (part, d) {
    const set = function (id, text) {
      const el = document.getElementById(id);
      if (el) el.innerHTML = text;
    };
    const resume = function (tool) {
      const p = window.LMTPages.recall(tool);
      return p > 1 ? ' <span class="lmt-home-resume">back to page ' + p + '</span>' : '';
    };

    if (part === 'alt' && d) {
      const missing = d.missing || 0;
      const misCap  = typeof d.missing_caption === 'number'
        ? d.missing_caption : Math.max(0, (d.total || 0) - (d.has_caption || 0));
      const misDesc = typeof d.missing_desc === 'number'
        ? d.missing_desc : Math.max(0, (d.total || 0) - (d.has_desc || 0));

      set('lmt-home-stat-alt', (missing
        ? missing + (missing === 1 ? ' image has no alt text' : ' images have none')
        : 'Every image has alt text') + ' &rarr;' + resume('alt'));
      set('lmt-home-stat-cap', (misCap
        ? misCap + (misCap === 1 ? ' image has no caption' : ' images have none')
        : 'Every image has a caption') + ' &rarr;');
      set('lmt-home-stat-desc', (misDesc
        ? misDesc + (misDesc === 1 ? ' image has no description' : ' images have none')
        : 'Every image has a description') + ' &rarr;');
      set('lmt-home-stat-mlr', (d.total || 0) + ' images in your library &rarr;' + resume('mlr'));

      set('lmt-home-n-total', d.total || 0);
      set('lmt-home-n-alt', d.has_alt || 0);
      set('lmt-home-n-missing', missing);
      set('lmt-home-n-cap', misCap);
      set('lmt-home-n-cap-have', d.has_caption || 0);
      set('lmt-home-n-desc', misDesc);
      set('lmt-home-n-desc-have', d.has_desc || 0);
      /* v3.37.0 — the strip renders straight away with placeholders now that
         it sits above the cards, so there is no reveal to do. Kept as a no-op
         guard for anyone landing here from an older cached page. */
      const wrap = document.getElementById('lmt-home-stats');
      if (wrap && wrap.hidden) wrap.hidden = false;
      const lede = document.getElementById('lmt-home-lede');
      if (lede && d.total) {
        lede.textContent = d.total + ' images in your library. Pick a job below — you will come back to whatever page you were on.';
      }
    }

    if (part === 'title' && d) {
      const auto = d.auto || 0;
      set('lmt-home-stat-title', (auto
        ? auto + (auto === 1 ? ' title is still a filename' : ' titles are still filenames')
        : 'Every image has a real title') + ' &rarr;' + resume('title'));
      set('lmt-home-n-titles', auto);
      set('lmt-home-n-titles-custom', d.custom || 0);
    }
  };

  /* ══════════════════════════════════════════════════════
     COMBINED TAB — UPLOAD ↔ LIBRARY SUB-VIEW TOGGLE
     The Image Resizer tab now hosts both the media-library
     resize grid (#lmt-library-view, default) and the upload
     & compress panel (#lmt-upload-view). "Upload Images"
     shows the uploader; "Back to Library" returns.
  ══════════════════════════════════════════════════════ */

  const uploadView  = document.getElementById('lmt-upload-view');
  const libraryView = document.getElementById('lmt-library-view');

  function showUploadView(show) {
    if (libraryView) libraryView.style.display = show ? 'none' : '';
    if (uploadView)  uploadView.style.display  = show ? '' : 'none';
  }
  document.getElementById('mlr-btn-upload-view')?.addEventListener('click', () => document.querySelector('.lmt-tab[data-tab="import"]')?.click());
  document.getElementById('lkir-back-btn')?.addEventListener('click', () => showUploadView(false));

  /* Dismissible resize warning — stays hidden across refreshes once closed.
     The same notice lives permanently on the Settings page as a reminder. */
  (function () {
    const warn = document.getElementById('lmt-resize-warn');
    const x    = document.getElementById('lmt-resize-warn-x');
    if (warn && localStorage.getItem('lmt_resize_warn_dismissed') === '1') {
      warn.style.display = 'none';
    }
    x?.addEventListener('click', () => {
      if (warn) warn.style.display = 'none';
      localStorage.setItem('lmt_resize_warn_dismissed', '1');
    });
  })();

  /* ══════════════════════════════════════════════════════
     SHARED — LOAD MORE renderer
     Renders an append-style "Load More" control + a
     "showing X of Y" info line into the given container.
  ══════════════════════════════════════════════════════ */

  function renderLoadMore(elId, page, pages, loaded, total, onMore) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (page >= pages) {
      el.innerHTML = total ? `<span class="lmt-loadmore-info">Showing all ${total}</span>` : '';
      return;
    }
    el.innerHTML = `<button type="button" class="lmt-btn lmt-loadmore-btn">↓ Load More</button>` +
                   `<span class="lmt-loadmore-info">Showing ${loaded} of ${total}</span>`;
    el.querySelector('.lmt-loadmore-btn').addEventListener('click', () => onMore(page + 1));
  }

  /* ══════════════════════════════════════════════════════
     SHARED — VIEW CONTROLS (grid/list · size · per-page)
     Wires the per-tab view bar. View mode and card size are
     persisted per tab in localStorage; card size is applied
     as the --lmt-card-min CSS var on the grid wrap.
  ══════════════════════════════════════════════════════ */

  /* ══════════════════════════════════════════════════════
     SHARED — FILTER TILES  (v3.27.0)
     The counts above each grid are the filter. A tile sets the tab's
     filter <select>, marks itself active, and names the current slice in
     a clearable pill so it is never ambiguous what is on screen.
  ══════════════════════════════════════════════════════ */

  const LMT_TILE_LABELS = {
    alt: {
      all: 'All images', missing: 'Missing alt text', has: 'Have alt text',
      missing_caption: 'Missing caption', missing_desc: 'Missing description',
      has_caption: 'Have caption', has_desc: 'Have description',
      missing_any: 'Missing anything', complete: 'Complete (all three)'
    },
    title: { all: 'All images', auto: 'Still a filename', custom: 'Given a real title' }
  };

  function lmtSyncTiles(group, val) {
    const wrap = document.querySelector(`[data-tilegroup="${group}"]`);
    if (wrap) {
      wrap.querySelectorAll('.lmt-tile').forEach(t => {
        t.setAttribute('aria-pressed', String(t.dataset.filter === val));
      });
    }
    const pill = document.getElementById(group + '-filter-pill');
    const text = document.getElementById(group + '-filter-pill-text');
    if (!pill || !text) return;
    if (!val || val === 'all') { pill.hidden = true; return; }
    const label = (LMT_TILE_LABELS[group] || {})[val] || val;
    const tile  = wrap?.querySelector(`.lmt-tile[data-filter="${val}"] b`);
    const count = tile ? tile.textContent.trim() : '';
    text.textContent = count && count !== '\u2014' ? `${label} \u00b7 ${count} shown` : label;
    pill.hidden = false;
  }
  window.lmtSyncTiles = lmtSyncTiles;

  document.addEventListener('click', function(e) {
    const tile = e.target.closest('[data-tilegroup] .lmt-tile, [data-tilefilter]');
    if (tile) {
      const group = tile.dataset.tilefilter || tile.closest('[data-tilegroup]')?.dataset.tilegroup;
      const val   = tile.dataset.filter;
      if (group === 'alt')   window.lmtAltFilter(val);
      if (group === 'title') window.lmtTitleFilter(val);
      return;
    }
    const clear = e.target.closest('[data-tileclear]');
    if (clear) {
      const group = clear.dataset.tileclear;
      if (group === 'alt')   window.lmtAltFilter('all');
      if (group === 'title') window.lmtTitleFilter('all');
    }
  });

  /* v3.27.0 — Card size is one preference for the whole plugin, not one per
     tab. Every slider and every grid follows the same value, so shrinking the
     thumbnails on Resize keeps them shrunk on Alt text and Titles. Grid/list
     view stays per tab, since the two tabs are used differently. */
  const LMT_SIZE_KEY = 'lmt_size';

  function lmtReadCardSize() {
    // Falls back to the old per-tab keys once, so nobody's setting resets.
    const v = localStorage.getItem(LMT_SIZE_KEY)
           || localStorage.getItem('lmt_size_mlr')
           || localStorage.getItem('lmt_size_alt')
           || localStorage.getItem('lmt_size_title');
    const n = parseInt(v, 10);
    return (n >= 140 && n <= 360) ? n : 200;
  }

  function lmtApplyCardSize(val) {
    document.querySelectorAll('.lmt-size-range').forEach(s => {
      if (s.value !== String(val)) s.value = val;
    });
    document.querySelectorAll('.lmt-image-grid-wrap').forEach(w => {
      w.style.setProperty('--lmt-card-min', val + 'px');
    });
    localStorage.setItem(LMT_SIZE_KEY, String(val));
  }
  window.lmtApplyCardSize = lmtApplyCardSize;

  function initViewControls(prefix, reload) {
    const wrap    = document.getElementById(prefix + '-grid-wrap');
    const gridBtn = document.getElementById(prefix + '-view-grid');
    const listBtn = document.getElementById(prefix + '-view-list');
    const sizeSld = document.getElementById(prefix + '-size');
    const perPage = document.getElementById(prefix + '-perpage');

    function setView(mode) {
      if (wrap) wrap.classList.toggle('lmt-list', mode === 'list');
      gridBtn?.classList.toggle('active', mode !== 'list');
      listBtn?.classList.toggle('active', mode === 'list');
      localStorage.setItem('lmt_view_' + prefix, mode);
    }

    setView(localStorage.getItem('lmt_view_' + prefix) || 'grid');
    lmtApplyCardSize(lmtReadCardSize());

    gridBtn?.addEventListener('click', () => setView('grid'));
    listBtn?.addEventListener('click', () => setView('list'));
    sizeSld?.addEventListener('input', () => lmtApplyCardSize(sizeSld.value));
    // Changing per-page reloads a fresh first batch — but only if a grid
    // has already been loaded (the library tab waits for "Load Images").
    perPage?.addEventListener('change', () => {
      if (document.getElementById(prefix + '-grid')) reload(1);
    });
  }

  /* ══════════════════════════════════════════════════════
     TAB 1 — IMAGE RESIZER (client-side)
  ══════════════════════════════════════════════════════ */

  const TARGET_DPI = 96;

  const dropZone    = document.getElementById('lkir-drop');
  const fileInput   = document.getElementById('lkir-input');
  const filenameLbl = document.getElementById('lkir-filename');
  const filelistLbl = document.getElementById('lkir-filelist');
  const formatSel   = document.getElementById('lkir-format');
  const qualitySldr = document.getElementById('lkir-quality');
  const qualityBub  = document.getElementById('lkir-quality-bubble');
  const qualityNote = document.getElementById('lkir-quality-note');
  const renameFld   = document.getElementById('lkir-rename');
  const statusLbl   = document.getElementById('lkir-status');
  const previewImg  = document.getElementById('lkir-preview-img');
  const metaDiv     = document.getElementById('lkir-meta');
  const customPxFld = document.getElementById('lkir-custom-px');

  function setStatus(msg) { if (statusLbl) statusLbl.textContent = msg || ''; }

  function sanitizeFilename(name) {
    name = (name||'').trim().replace(/\s+/g,'-').replace(/[^A-Za-z0-9._-]+/g,'').replace(/^[._-]+|[._-]+$/g,'');
    return name || 'resized-image';
  }

  function getSelectedSize() {
    const checked = document.querySelector('input[name="lkir_size"]:checked');
    if (!checked) return 1200;
    if (checked.value === 'custom') { const v = parseInt(customPxFld?.value, 10); return (v >= 16 && v <= 8000) ? v : 1200; }
    return parseInt(checked.value, 10);
  }

  function currentFormat() { return (formatSel?.value || 'WEBP').toUpperCase(); }
  function currentQuality() { return parseInt(qualitySldr?.value || '82', 10); }

  function mimeForFmt(fmt) { return fmt==='PNG'?'image/png':fmt==='JPEG'?'image/jpeg':'image/webp'; }
  function extForFmt(fmt)  { return fmt==='PNG'?'png':fmt==='JPEG'?'jpg':'webp'; }

  function outputFilenameFor(file, target, fmt) {
    const ext = extForFmt(fmt);
    const orig = sanitizeFilename(file.name.replace(/\.[^.]+$/,''));
    const pfx  = sanitizeFilename(renameFld?.value||'');
    const base = pfx ? (pfx===orig?pfx:`${pfx}-${orig}`) : orig;
    return `${base}-${target}.${ext}`;
  }

  function computeDims(w, h, target) {
    const longest = Math.max(w,h); if (!longest) return {w,h};
    const scale = target/longest;
    return { w: Math.max(1, Math.round(w*scale)), h: Math.max(1, Math.round(h*scale)) };
  }

  async function renderToCanvas(file, target) {
    let bitmap;
    try { bitmap = await createImageBitmap(file); } catch(_) {
      const dataUrl = await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); });
      bitmap = await new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=dataUrl; });
    }
    const ow=bitmap.width, oh=bitmap.height;
    const {w:nw,h:nh} = computeDims(ow,oh,target);
    const canvas=document.createElement('canvas'); canvas.width=nw; canvas.height=nh;
    const ctx=canvas.getContext('2d',{alpha:true});
    ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
    ctx.clearRect(0,0,nw,nh); ctx.drawImage(bitmap,0,0,nw,nh);
    return {canvas,ow,oh,nw,nh};
  }

  // DPI injection helpers
  async function setJpegDpi(blob,dpi) {
    const buf=await blob.arrayBuffer(); const v=new DataView(buf);
    if(v.getUint8(0)!==0xFF||v.getUint8(1)!==0xD8) return blob;
    if(v.byteLength>18&&v.getUint8(6)===0x4A&&v.getUint8(7)===0x46&&v.getUint8(8)===0x49&&v.getUint8(9)===0x46){
      v.setUint8(13,1); v.setUint16(14,dpi); v.setUint16(16,dpi);
      return new Blob([buf],{type:'image/jpeg'});
    }
    return blob;
  }

  const CRC_TABLE=(()=>{ const t=new Uint32Array(256); for(let i=0;i<256;i++){ let c=i; for(let k=0;k<8;k++) c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1); t[i]=c>>>0; } return t; })();
  function crc32(b){ let c=0xFFFFFFFF; for(let i=0;i<b.length;i++) c=CRC_TABLE[(c^b[i])&0xFF]^(c>>>8); return(c^0xFFFFFFFF)>>>0; }
  function u32be(n){ const b=new Uint8Array(4); b[0]=(n>>>24)&0xFF;b[1]=(n>>>16)&0xFF;b[2]=(n>>>8)&0xFF;b[3]=n&0xFF; return b; }
  function str4(s){ return new Uint8Array([s.charCodeAt(0),s.charCodeAt(1),s.charCodeAt(2),s.charCodeAt(3)]); }
  function cat(...p){ const t=p.reduce((s,x)=>s+x.length,0),o=new Uint8Array(t); let f=0; for(const x of p){o.set(x,f);f+=x.length;} return o; }

  async function setPngDpi(blob,dpi) {
    const buf=await blob.arrayBuffer(); const png=new Uint8Array(buf);
    const sig=[137,80,78,71,13,10,26,10]; for(let i=0;i<8;i++) if(png[i]!==sig[i]) return blob;
    const chunks=[]; let off=8;
    while(off+8<=png.length){ const len=(png[off]<<24)|(png[off+1]<<16)|(png[off+2]<<8)|png[off+3]; const type=String.fromCharCode(png[off+4],png[off+5],png[off+6],png[off+7]); const ce=off+8+len+4; if(ce>png.length)break; chunks.push({type,chunkStart:off,chunkEnd:ce}); off=ce; if(type==='IEND')break; }
    const ppm=Math.round(dpi/0.0254); const data=cat(u32be(ppm),u32be(ppm),new Uint8Array([1])); const type=str4('pHYs'); const physChunk=cat(u32be(data.length),type,data,u32be(crc32(cat(type,data))));
    const ihdr=chunks.find(c=>c.type==='IHDR'); if(!ihdr) return blob;
    const ex=chunks.find(c=>c.type==='pHYs');
    const out=ex?cat(png.slice(0,ex.chunkStart),physChunk,png.slice(ex.chunkEnd)):cat(png.slice(0,ihdr.chunkEnd),physChunk,png.slice(ihdr.chunkEnd));
    return new Blob([out],{type:'image/png'});
  }

  async function canvasToBlob(canvas, fmt, q) {
    let blob = await new Promise(res => canvas.toBlob(b=>res(b), mimeForFmt(fmt), fmt==='PNG'?undefined:q/100));
    if (!blob) return null;
    if (fmt==='JPEG') blob = await setJpegDpi(blob,TARGET_DPI);
    else if (fmt==='PNG') blob = await setPngDpi(blob,TARGET_DPI);
    return blob;
  }

  // Quality slider sync
  function syncQualityUI() {
    const isPng = currentFormat() === 'PNG';
    if (qualitySldr) qualitySldr.disabled = isPng;
    if (qualityNote) qualityNote.textContent = isPng ? 'PNG is lossless — quality has no effect.' : 'Lower = smaller file. Recommended: 75–90.';
    if (qualityBub)  { qualityBub.textContent = isPng ? '—' : qualitySldr.value; qualityBub.style.opacity = isPng ? '0.4' : '1'; }
  }

  qualitySldr?.addEventListener('input', () => {
    if (qualityBub) qualityBub.textContent = qualitySldr.value;
    clearTimeout(qualitySldr._t); qualitySldr._t = setTimeout(updatePreview, 400);
  });
  formatSel?.addEventListener('change', () => { syncQualityUI(); updatePreview(); });
  syncQualityUI();

  // Drag & drop
  dropZone?.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('lmt-dragover'); });
  dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('lmt-dragover'));
  dropZone?.addEventListener('drop', e => {
    e.preventDefault(); dropZone.classList.remove('lmt-dragover');
    if (e.dataTransfer?.files?.length) { const dt=new DataTransfer(); for(const f of e.dataTransfer.files) dt.items.add(f); fileInput.files=dt.files; onFileChosen(); }
  });
  fileInput?.addEventListener('change', onFileChosen);

  function onFileChosen() {
    const files = Array.from(fileInput?.files||[]);
    if (!files.length) return;
    if (filenameLbl) filenameLbl.textContent = files.length===1 ? files[0].name : `${files.length} files selected`;
    if (filelistLbl) {
      const maxShow=10; const shown=files.slice(0,maxShow).map(f=>f.name);
      filelistLbl.textContent = shown.join('  ·  ') + (files.length>maxShow?`  · +${files.length-maxShow} more`:'');
    }
    if (renameFld && files.length===1 && !renameFld.value.trim()) renameFld.value = files[0].name.replace(/\.[^.]+$/,'');
    updatePreview();
  }

  document.querySelectorAll('input[name="lkir_size"]').forEach(r => {
    r.addEventListener('change', () => { if(customPxFld) customPxFld.disabled=(r.value!=='custom'); updatePreview(); });
  });
  if (customPxFld) { customPxFld.disabled=true; customPxFld.addEventListener('change', updatePreview); }

  let lastPreviewUrl = null;

  async function updatePreview() {
    const files = Array.from(fileInput?.files||[]); const f = files[0];
    if (!f) { setStatus('Choose an image first.'); previewImg?.classList.add('lmt-hidden'); metaDiv?.classList.add('lmt-hidden'); return; }
    setStatus('Rendering…');
    try {
      const target=getSelectedSize(), fmt=currentFormat(), q=currentQuality();
      const {canvas,ow,oh,nw,nh} = await renderToCanvas(f,target);
      const blob = await canvasToBlob(canvas,fmt,q);
      if(!blob) throw new Error('Render failed.');
      if(lastPreviewUrl) URL.revokeObjectURL(lastPreviewUrl);
      lastPreviewUrl = URL.createObjectURL(blob);
      if(previewImg){ previewImg.src=lastPreviewUrl; previewImg.classList.remove('lmt-hidden'); }
      const savings = Math.round((1-blob.size/f.size)*100);
      const badgeCls = savings>0?'lmt-savings':'lmt-savings lmt-savings-bad';
      const badgeTxt = savings>0?`↓ ${savings}% smaller`:`↑ ${Math.abs(savings)}% larger`;
      if(metaDiv){
        metaDiv.innerHTML =
          `<span class="lmt-chip"><strong>${ow}</strong>×<strong>${oh}</strong> → <strong>${nw}</strong>×<strong>${nh}</strong></span>` +
          `<span class="lmt-chip"><strong>${fmt}</strong>${fmt!=='PNG'?' Q'+q:''}</span>` +
          `<span class="lmt-chip">${formatBytes(f.size)} → <strong>${formatBytes(blob.size)}</strong></span>` +
          `<span class="${badgeCls}">${badgeTxt}</span>` +
          (files.length>1?`<span class="lmt-chip"><strong>${files.length}</strong> files</span>`:'');
        metaDiv.classList.remove('lmt-hidden');
      }
      setStatus('Preview ready.');
    } catch(err) { console.error(err); setStatus('Preview failed.'); }
  }

  async function downloadImage() {
    const files=Array.from(fileInput?.files||[]); const f=files[0];
    if(!f){setStatus('Choose an image first.');return;}
    setStatus('Preparing…');
    try {
      const target=getSelectedSize(),fmt=currentFormat(),q=currentQuality();
      const {canvas}=await renderToCanvas(f,target);
      const blob=await canvasToBlob(canvas,fmt,q);
      if(!blob) throw new Error('Failed');
      triggerDownload(blob, outputFilenameFor(f,target,fmt));
      setStatus('Downloaded.');
    } catch(err){console.error(err);setStatus('Failed.');}
  }

  async function downloadZip() {
    const files=Array.from(fileInput?.files||[]);
    if(!files.length){setStatus('Choose images first.');return;}
    if(typeof JSZip==='undefined'){setStatus('JSZip missing — reload.');return;}
    setStatus(`Building ZIP… 0/${files.length}`);
    try {
      const target=getSelectedSize(),fmt=currentFormat(),q=currentQuality();
      const zip=new JSZip(); let done=0;
      for(const file of files){
        if(!file.type?.startsWith('image/')) continue;
        setStatus(`Processing ${done+1}/${files.length}…`);
        const {canvas}=await renderToCanvas(file,target);
        const blob=await canvasToBlob(canvas,fmt,q);
        if(!blob) throw new Error(`Failed: ${file.name}`);
        zip.file(outputFilenameFor(file,target,fmt),blob);
        done++;
      }
      if(!done) throw new Error('No valid images.');
      setStatus('Compressing…');
      const zipBlob=await zip.generateAsync({type:'blob'},m=>{if(m?.percent!=null)setStatus(`Zipping ${Math.floor(m.percent)}%…`);});
      triggerDownload(zipBlob,`resized-${target}-${fmt.toLowerCase()}.zip`);
      setStatus(`Done — ${done} file${done!==1?'s':''}.`);
    } catch(err){console.error(err);setStatus('ZIP failed: '+(err.message||err));}
  }

  function triggerDownload(blob, filename) {
    const url=URL.createObjectURL(blob);
    const a=Object.assign(document.createElement('a'),{href:url,download:filename});
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),5000);
  }

  async function uploadToLibrary() {
    const files=Array.from(fileInput?.files||[]); const f=files[0];
    if(!f){setStatus('Choose an image first.');return;}
    const btn=document.getElementById('lkir-btn-upload');
    if(btn) btn.disabled=true;
    setStatus('Compressing for upload…');
    try {
      const target=getSelectedSize(),fmt=currentFormat(),q=currentQuality();
      const {canvas}=await renderToCanvas(f,target);
      const blob=await canvasToBlob(canvas,fmt,q);
      if(!blob) throw new Error('Render failed');
      const filename=outputFilenameFor(f,target,fmt);
      const fd=new FormData();
      fd.append('action','lmt_ir_upload');
      fd.append('nonce',LMT.nonce);
      fd.append('file',blob,filename);
      setStatus('Uploading to Media Library…');
      const res=await fetch(LMT.ajax,{method:'POST',body:fd,credentials:'same-origin'});
      const data=await res.json();
      if(!data||!data.success) throw new Error(data?.data?.message||'Upload failed');
      setStatus(`Uploaded ✓ ${data.data.filename} (ID ${data.data.id})`);
    } catch(err){console.error(err);setStatus('Upload failed: '+(err.message||err));}
    finally { if(btn) btn.disabled=false; }
  }

  document.getElementById('lkir-btn-preview')?.addEventListener('click', updatePreview);
  document.getElementById('lkir-btn-upload')?.addEventListener('click', uploadToLibrary);
  document.getElementById('lkir-btn-download')?.addEventListener('click', downloadImage);
  document.getElementById('lkir-btn-zip')?.addEventListener('click', downloadZip);

  /* ══════════════════════════════════════════════════════
     TAB 2 — MEDIA LIBRARY RESIZE
  ══════════════════════════════════════════════════════ */

  let mlrPage = 1, mlrTotalPages = 1;
  let mlrRunning = false, mlrStop = false;
  const mlrSelected = new Set();

  const mlrStatus      = document.getElementById('mlr-status');
  const mlrGridWrap    = document.getElementById('mlr-grid-wrap');
  const mlrProgressWrap= document.getElementById('mlr-progress-wrap');
  const mlrProgressFill= document.getElementById('mlr-progress-fill');
  const mlrProgressLbl = document.getElementById('mlr-progress-label');
  const mlrProgressPct = document.getElementById('mlr-progress-pct');
  const mlrProgressCnt = document.getElementById('mlr-progress-count');
  const mlrBulkBtn     = document.getElementById('mlr-btn-bulk');
  const mlrStopBtn     = document.getElementById('mlr-btn-stop');
  const mlrSelectAll   = document.getElementById('mlr-select-all');

  function setMlrStatus(msg) { if(mlrStatus) mlrStatus.textContent = msg||''; }

  function getMlrSize() {
    const checked = document.querySelector('input[name="mlr_size"]:checked');
    const v = parseInt(checked?.value, 10);
    return (v >= 16 && v <= 8000) ? v : 1200;
  }

  /* v3.31.0 — Resize & compress has one behaviour: fit each image inside a
     width x height box. The Width / Height / Both switch has gone, so this
     always reports 'wh'. lmtFitScale() still understands 'w' and 'h', which
     the upload-view resizer and any future mode can use. */
  function getMlrMode() { return 'wh'; }

  /* v3.30.0 — In Both mode a preset is a landscape box at 4:3, so the numbers
     pair sensibly (1200x900, 800x600) instead of every width being married to
     one shared height. A saved box carries its own height and overrides this. */
  const MLR_BOX_RATIO = 3 / 4;
  function mlrBoxHeight(w) { return Math.max(1, Math.round(w * MLR_BOX_RATIO)); }

  function getMlrTarget() {
    const mode = getMlrMode();
    const n    = getMlrSize();
    if (mode === 'h') return { mode: 'h', h: n };
    if (mode === 'wh') {
      const checked = document.querySelector('input[name="mlr_size"]:checked');
      const savedH  = parseInt(checked?.dataset.h, 10);
      const h = (savedH >= 16 && savedH <= 8000) ? savedH : mlrBoxHeight(n);
      return { mode: 'wh', w: n, h };
    }
    return { mode: 'w', w: n };
  }

  function updateMlrBulkBtn() {
    if(mlrBulkBtn) mlrBulkBtn.disabled = mlrSelected.size===0;
    updateResizeEstimates();
  }

  let mlrLoaded = 0;
  function mlrPerPage() { return document.getElementById('mlr-perpage')?.value || '30'; }

  function mlrCardHtml(img) {
    const size = img.width && img.height ? `${img.width}×${img.height}` : '—';
    const fs   = formatBytes(img.filesize);
    const est  = resizeEstimate(img, getMlrTarget());
    const estClass = est && est.changed ? ' lmt-est-save' : '';
    return `
        <div class="lmt-img-card${img.has_backup ? ' lmt-card-done' : ''}" id="mlr-card-${img.id}">
          <div class="lmt-img-thumb-wrap">
            <input type="checkbox" class="lmt-img-select" id="mlr-chk-${img.id}" data-id="${img.id}" onchange="window.mlrToggleSelect(${img.id},this.checked)">
            <a class="lmt-thumb-link" href="${escHtml(window.lmtDetailUrl(img, 'mlr', mlrPage))}" title="Open ${escHtml(img.filename)}">
              ${img.thumb ? `<img class="lmt-img-thumb" src="${escHtml(img.thumb)}" alt="" loading="lazy">` : '<div class="lmt-img-thumb" style="background:var(--s3)"></div>'}
            </a>
          </div>
          <div class="lmt-img-body">
            <div class="lmt-img-filename" title="${escHtml(img.filename)}">${escHtml(img.filename)}</div>
            <div class="lmt-img-dims" id="mlr-dims-${img.id}">${size} &nbsp;·&nbsp; ${fs}</div>
            ${attentionChips(img)}
            <div class="lmt-resize-est${estClass}" id="mlr-est-${img.id}" data-bytes="${img.filesize || 0}" data-w="${img.width || 0}" data-h="${img.height || 0}">${est ? escHtml(est.text) : ''}</div>
            ${img.has_backup ? `<button class="lmt-restore-btn" onclick="window.mlrRestore(${img.id})">↩ Restore Original</button>` : ''}
            <div class="lmt-card-actions">
              <a class="lmt-edit-btn" href="${escHtml(window.lmtDetailUrl(img, 'mlr', mlrPage))}" title="Open this image in Media Master">
                ✎ Edit details
              </a>
            </div>
          </div>
        </div>`;
  }

  /* Recompute per-card resize estimates + the selection total. Called on
     render, target change, and selection change. */
  function updateResizeEstimates() {
    const target = getMlrTarget();
    let selBytes = 0, selSaved = 0, selCount = 0;
    document.querySelectorAll('.lmt-resize-est').forEach(el => {
      const bytes = parseInt(el.dataset.bytes, 10) || 0;
      const w     = parseInt(el.dataset.w, 10) || 0;
      const h     = parseInt(el.dataset.h, 10) || 0;
      const est = resizeEstimate({ width: w, height: h, filesize: bytes }, target);
      if (est) el.textContent = est.text;
      el.classList.toggle('lmt-est-save', !!(est && est.changed));
      const id  = parseInt(el.id.replace('mlr-est-', ''), 10);
      if (mlrSelected.has(id) && est && est.changed) {
        selBytes += bytes; selSaved += est.saved; selCount++;
      }
    });
    const summary = document.getElementById('mlr-resize-summary');
    if (summary) {
      summary.textContent = selCount
        ? `Resize ${selCount} → save ~${formatBytes(selSaved)}`
        : '';
    }
    updateRunSummary();
  }

  /* v3.27.0 — One plain-English line describing exactly what pressing the
     button will do. Replaces the three separate hint paragraphs that used to
     sit under the Output, Quality and Backup controls. */
  function updateRunSummary() {
    const el = document.getElementById('mlr-run-summary');
    if (!el) return;
    const target  = getMlrTarget();
    const fit     = target.mode === 'wh' ? `fitted inside ${target.w}×${target.h}px`
                  : target.mode === 'h'  ? `${target.h}px tall`
                  :                        `${target.w}px wide`;
    const quality = document.getElementById('mlr-quality')?.value || '82';
    const webp    = document.getElementById('mlr-output-fmt')?.value === 'webp';
    const backup  = !!document.getElementById('mlr-backup')?.checked;
    el.textContent = webp
      ? `Creating a new WebP copy of each image at ${fit}, quality ${quality}. Originals are left untouched and URLs do not change.`
      : `Resizing to ${fit}, keeping the original format at quality ${quality}, overwriting in place. `
        + (backup ? 'Originals are backed up first and can be restored per image.'
                  : 'No backup — originals cannot be restored afterwards.');
    el.classList.toggle('lmt-run-summary-warn', !webp && !backup);
  }

  async function mlrLoadImages(page=1, append=false) {
    mlrPage = page;
    window.LMTPages.remember('mlr', page);   // v3.23.0
    if (!append) {
      mlrSelected.clear(); updateMlrBulkBtn();
      if(mlrSelectAll) mlrSelectAll.checked = false;
      mlrLoaded = 0;
      if(mlrGridWrap) mlrGridWrap.innerHTML = '<div class="lmt-loading">Loading images…</div>';
    }
    setMlrStatus('Loading…');

    const search = document.getElementById('mlr-search')?.value || '';
    const filter = document.getElementById('mlr-filter')?.value || 'all';

    const sort = document.getElementById('mlr-sort')?.value || 'date_desc';
    const type = document.getElementById('mlr-type')?.value || 'all';
    const res = await post('lmt_mlr_get_images', { page, search, filter, sort, type, per_page: mlrPerPage() });
    if (!res.success) { setMlrStatus('Load failed.'); return; }

    const d = res.data;
    mlrTotalPages = d.pages;

    if (!append && !d.items.length) {
      mlrGridWrap.innerHTML = '<div class="lmt-grid-empty">No images found.</div>';
      setMlrStatus('');
      document.getElementById('mlr-loadmore').innerHTML = '';
      return;
    }

    if (!append) {
      mlrGridWrap.innerHTML = `<p class="lmt-count-label" id="mlr-count-label"></p><div class="lmt-image-grid" id="mlr-grid"></div>`;
    }
    const grid = document.getElementById('mlr-grid');
    if (grid) grid.insertAdjacentHTML('beforeend', d.items.map(mlrCardHtml).join(''));
    mlrLoaded += d.items.length;

    const label = document.getElementById('mlr-count-label');
    if (label) label.textContent = `${d.total} image(s) — showing ${mlrLoaded}`;

    fillUsageCounts(d.items);   // v3.39.0 — deferred usage counts
    renderLoadMore('mlr-loadmore', mlrPage, mlrTotalPages, mlrLoaded, d.total, n => mlrLoadImages(n, true));
    window.lmtHighlightReturn('mlr');   // v3.23.0
    setMlrStatus('');
    updateResizeEstimates();
  }

  window.mlrToggleSelect = function(id, checked) {
    if (checked) mlrSelected.add(id); else mlrSelected.delete(id);
    updateMlrBulkBtn();
  };

  mlrSelectAll?.addEventListener('change', function() {
    document.querySelectorAll('#mlr-grid-wrap .lmt-img-select').forEach(chk => {
      const id = parseInt(chk.dataset.id, 10);
      chk.checked = this.checked;
      if (this.checked) mlrSelected.add(id); else mlrSelected.delete(id);
    });
    updateMlrBulkBtn();
  });

  document.getElementById('mlr-btn-load')?.addEventListener('click', () => mlrLoadImages(1));
  document.getElementById('mlr-search')?.addEventListener('keydown', e => { if(e.key==='Enter') mlrLoadImages(1); });
  // Auto-load the library on page load so the Resizer isn't empty on every refresh.
  // (Image Resizer is the default active tab; "Load Images" still works as a manual reload.)
  if (document.getElementById('mlr-grid-wrap')) {
    // v3.23.0 — reopen on the remembered page, or on the page a Back link asked for.
    const mlrStart = (window.LMTReturn.paged > 1 && lmtActiveTabName() === 'mlr')
      ? window.LMTReturn.paged
      : window.LMTPages.recall('mlr');
    mlrLoadImages(mlrStart);
  }
  ['mlr-sort','mlr-type'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => { if (document.getElementById('mlr-grid')) mlrLoadImages(1); });
  });

  document.querySelectorAll('input[name="mlr_size"]').forEach(r => {
    r.addEventListener('change', updateResizeEstimates);
  });

  /* v3.28.0 — Width / Height / Both. The chips stay the same in every mode;
     only what the number means changes. "Both" reveals a second field and
     fits each image inside the box, never stretching it. */
  /* v3.29.0 — In Both mode a preset is a box, not a single number, so each
     chip shows the box it will produce (e.g. 1200x900). Width and Height mode
     put the original label back. */
  function relabelSizeChips(mode) {
    document.querySelectorAll('.lmt-size-chips > label').forEach(lab => {
      const radio = lab.querySelector('input[name="mlr_size"]');
      const span  = lab.querySelector('span');
      if (!radio || !span || radio.value === 'custom') return;
      if (span.dataset.base === undefined) span.dataset.base = span.textContent;
      const n = parseInt(radio.value, 10);
      span.textContent = (mode === 'wh' && n)
        ? `${n}\u00d7${mlrBoxHeight(n)}`
        : span.dataset.base;
    });
  }

  function applyMlrMode(mode) {
    relabelSizeChips(mode);
    updateResizeEstimates();
  }
  applyMlrMode(getMlrMode());

  document.getElementById('mlr-quality')?.addEventListener('input', function() {
    const b = document.getElementById('mlr-quality-bubble');
    const v = document.getElementById('mlr-quality-val');
    if(b) b.textContent = this.value;
    if(v) v.textContent = this.value;
    updateRunSummary();
  });
  document.getElementById('mlr-backup')?.addEventListener('change', updateRunSummary);

  // Output-format (keep original vs WebP copy) reactivity
  const mlrOutFmt = document.getElementById('mlr-output-fmt');
  function syncMlrOutput() {
    const webp = mlrOutFmt?.value === 'webp';
    const note = document.getElementById('mlr-output-note');
    const backupRow  = document.getElementById('mlr-backup-row');
    const backupNote = document.getElementById('mlr-backup-note');
    if (note) note.textContent = webp
      ? 'Creates a new WebP copy in the media library for each image. Originals are left untouched.'
      : 'Resizes and overwrites the original file. URLs stay the same.';
    if (backupRow)  backupRow.style.display  = webp ? 'none' : '';
    if (backupNote) backupNote.style.display = webp ? 'none' : '';
    if (mlrBulkBtn) mlrBulkBtn.innerHTML = webp ? '\u25B6 Create WebP Copies' : '\u25B6 Resize Selected';
    updateRunSummary();
  }
  mlrOutFmt?.addEventListener('change', syncMlrOutput);
  syncMlrOutput();
  updateRunSummary();

  /* ── Saved custom sizes (named, reorderable, stored per browser) ── */
  const SAVED_SIZES_KEY = 'lmt_saved_sizes';
  function getSavedSizes() {
    try { return JSON.parse(localStorage.getItem(SAVED_SIZES_KEY) || '[]'); } catch(_) { return []; }
  }
  function setSavedSizes(arr) { localStorage.setItem(SAVED_SIZES_KEY, JSON.stringify(arr)); }

  /* A saved entry shows as a box whenever Both is the active mode: its own
     height if it has one, otherwise the 4:3 box its width implies. */
  function savedLabel(s) {
    if (getMlrMode() === 'wh') return `${s.px}\u00d7${s.h || mlrBoxHeight(s.px)}`;
    return s.h ? `${s.px}\u00d7${s.h}` : `${s.px}px`;
  }

  function renderSavedSizes() {
    const wrap = document.getElementById('mlr-saved-sizes');
    if (!wrap) return;
    const sizes = getSavedSizes();
    wrap.innerHTML = sizes.map((s, i) => `
      <label class="lmt-saved-row" draggable="true" data-idx="${i}">
        <span class="lmt-saved-handle" title="Drag to reorder">⠿</span>
        <input type="radio" name="mlr_size" value="${s.px}" data-h="${s.h || ''}">
        <span>${escHtml(s.name)}</span>
        <em>${savedLabel(s)}</em>
        <button type="button" class="lmt-saved-del" data-idx="${i}" title="Remove this size" aria-label="Remove">&times;</button>
      </label>`).join('');

    wrap.querySelectorAll('input[name="mlr_size"]').forEach(r => {
      r.addEventListener('change', () => {
        relabelSizeChips(getMlrMode());
        updateResizeEstimates();
      });
    });
    wrap.querySelectorAll('.lmt-saved-del').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        const arr = getSavedSizes(); arr.splice(parseInt(btn.dataset.idx, 10), 1);
        setSavedSizes(arr); renderSavedSizes();
      });
    });

    let dragIdx = null;
    wrap.querySelectorAll('.lmt-saved-row').forEach(row => {
      row.addEventListener('dragstart', () => { dragIdx = parseInt(row.dataset.idx, 10); row.classList.add('lmt-dragging'); });
      row.addEventListener('dragend',   () => row.classList.remove('lmt-dragging'));
      row.addEventListener('dragover',  e => e.preventDefault());
      row.addEventListener('drop', e => {
        e.preventDefault();
        const dropIdx = parseInt(row.dataset.idx, 10);
        if (dragIdx === null || dragIdx === dropIdx) return;
        const arr = getSavedSizes();
        const [moved] = arr.splice(dragIdx, 1);
        arr.splice(dropIdx, 0, moved);
        setSavedSizes(arr); renderSavedSizes();
      });
    });
  }

  document.getElementById('mlr-saved-add-btn')?.addEventListener('click', () => {
    const nameEl = document.getElementById('mlr-saved-name');
    const pxEl   = document.getElementById('mlr-saved-px');
    const hEl  = document.getElementById('mlr-saved-h');
    const name = (nameEl?.value || '').trim();
    const px   = parseInt(pxEl?.value, 10);
    if (!name) { alert('Give the size a name first.'); return; }
    if (!(px >= 16 && px <= 8000)) { alert('Enter a pixel size between 16 and 8000.'); return; }
    const h = parseInt(hEl?.value, 10);
    if (!(h >= 16 && h <= 8000)) { alert('Enter a height between 16 and 8000.'); return; }
    const arr = getSavedSizes();
    arr.push({ name, px, h });
    setSavedSizes(arr);
    if (nameEl) nameEl.value = '';
    if (pxEl)   pxEl.value = '';
    if (hEl)    hEl.value = '';
    renderSavedSizes();
    relabelSizeChips(getMlrMode());
  });
  renderSavedSizes();

  // Bulk resize
  mlrBulkBtn?.addEventListener('click', async function() {
    if (mlrRunning || mlrSelected.size===0) return;
    const ids     = [...mlrSelected];
    const target  = getMlrTarget();
    const quality = parseInt(document.getElementById('mlr-quality')?.value||'82',10);
    const backup  = document.getElementById('mlr-backup')?.checked ? '1' : '0';
    const outFmt  = document.getElementById('mlr-output-fmt')?.value || 'keep';
    const toWebp  = outFmt === 'webp';

    const fitMsg = target.mode === 'wh' ? `fitted inside ${target.w}\u00d7${target.h}px`
                 : target.mode === 'h'  ? `${target.h}px tall`
                 :                        `${target.w}px wide`;
    const confirmMsg = toWebp
      ? `Create a WebP copy of ${ids.length} image(s) at ${fitMsg}?\n\nThis adds a new .webp file to your media library for each one. The originals are left unchanged.`
      : `Resize ${ids.length} image(s) to ${fitMsg}?\n\nThis overwrites files on the server. ${backup==='1'?'Originals will be backed up.':'NO BACKUP will be made.'}`;
    if (!confirm(confirmMsg)) return;

    mlrRunning=true; mlrStop=false;
    mlrBulkBtn.style.display='none'; mlrStopBtn.style.display='';
    mlrProgressWrap.classList.remove('lmt-hidden');
    if(mlrProgressFill) mlrProgressFill.style.width='0%';

    let done=0, ok=0, failed=0;

    const setP = (label) => {
      const pct = ids.length ? Math.round((done/ids.length)*100) : 0;
      if(mlrProgressFill) mlrProgressFill.style.width=pct+'%';
      if(mlrProgressPct)  mlrProgressPct.textContent=pct+'%';
      if(mlrProgressCnt)  mlrProgressCnt.textContent=`${done}/${ids.length} — ${ok} resized · ${failed} failed`;
      if(mlrProgressLbl)  mlrProgressLbl.textContent=label||(mlrStop?'Stopping…':`Processing ${done+1} of ${ids.length}…`);
    };

    setP(`Starting — 0 of ${ids.length}…`);

    for (const id of ids) {
      if (mlrStop) break;

      try {
        // ── Step 1: Ask PHP to read the full image from disk and return base64 ──
        // This bypasses all CORS/auth issues with fetching image URLs directly.
        setP(`Reading image ${done+1}/${ids.length} from server…`);
        const dataRes = await post('lmt_mlr_get_image_data', { id });

        if (!dataRes.success) {
          console.warn(`#${id} data fetch failed:`, dataRes.data);
          failed++;
          document.querySelector(`#mlr-card-${id}`)?.classList.add('lmt-card-error');
          const dimsEl = document.getElementById(`mlr-dims-${id}`);
          if(dimsEl) dimsEl.textContent += ' ✗ ' + (dataRes.data||'read failed');
          done++; setP(); continue;
        }

        const { data: dataUri, mime } = dataRes.data;

        // ── Step 2: Draw full image onto canvas and resize ──
        setP(`${toWebp ? 'Converting' : 'Resizing'} image ${done+1}/${ids.length}…`);
        const bitmap = await createImageBitmap(await (await fetch(dataUri)).blob());

        // v3.28.0 — one scale factor for all three modes, capped at 1 so an
        // image is never enlarged to meet the target.
        const scale = lmtFitScale(bitmap.width, bitmap.height, target);
        if (!toWebp && scale >= 1) {
          // Keep-format mode: already within the target — skip without error
          const dimsEl = document.getElementById(`mlr-dims-${id}`);
          if(dimsEl) dimsEl.textContent += ' (skipped — already small)';
          done++; setP(); continue;
        }

        const nw = Math.max(1, Math.round(bitmap.width  * scale));
        const nh = Math.max(1, Math.round(bitmap.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width=nw; canvas.height=nh;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
        ctx.drawImage(bitmap, 0, 0, nw, nh);

        // WebP mode → image/webp; otherwise keep original format (PNG stays lossless)
        const outMime = toWebp ? 'image/webp'
                      : mime.includes('png') ? 'image/png'
                      : mime.includes('webp') ? 'image/webp' : 'image/jpeg';
        const q = outMime==='image/png' ? undefined : quality/100;
        const resizedBlob = await new Promise(res => canvas.toBlob(b => res(b), outMime, q));
        if (!resizedBlob) throw new Error('canvas.toBlob returned null');

        // ── Step 3: Convert resized canvas blob back to base64 data URI ──
        const outDataUri = await new Promise(res => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result);
          reader.readAsDataURL(resizedBlob);
        });

        // ── Step 4: Save — overwrite original, or create a new WebP copy ──
        setP(`Saving image ${done+1}/${ids.length} to server…`);
        const saveRes = toWebp
          ? await post('lmt_mlr_save_webp', { id, data: outDataUri, max_width: target.w, max_height: target.h })
          : await post('lmt_mlr_save', { id, data: outDataUri, backup, max_width: target.w, max_height: target.h });

        if (saveRes.success) {
          ok++;
          if (toWebp) {
            const body = document.querySelector(`#mlr-card-${id} .lmt-img-body`);
            if (body && !body.querySelector('.lmt-webp-note')) {
              const note = document.createElement('div');
              note.className = 'lmt-resize-est lmt-est-save lmt-webp-note';
              const link = saveRes.data.edit
                ? ` — <a href="${escHtml(saveRes.data.edit)}" target="_blank" rel="noopener">open</a>`
                : '';
              note.innerHTML = `✓ WebP copy created (${formatBytes(saveRes.data.filesize)})${link}`;
              body.appendChild(note);
            }
            document.querySelector(`#mlr-card-${id}`)?.classList.add('lmt-card-done');
          } else {
            const dimsEl = document.getElementById(`mlr-dims-${id}`);
            if(dimsEl) dimsEl.textContent = `${saveRes.data.width}×${saveRes.data.height} · ${formatBytes(saveRes.data.filesize)} ✓`;
            document.querySelector(`#mlr-card-${id}`)?.classList.add('lmt-card-done');
            if (saveRes.data.backed_up) {
              const body = document.querySelector(`#mlr-card-${id} .lmt-img-body`);
              if (body && !body.querySelector('.lmt-restore-btn')) {
                const btn = document.createElement('button');
                btn.className='lmt-restore-btn'; btn.textContent='↩ Restore Original';
                btn.onclick=()=>mlrRestore(id); body.appendChild(btn);
              }
            }
          }
        } else {
          failed++;
          console.warn(`#${id} save failed:`, saveRes.data);
          document.querySelector(`#mlr-card-${id}`)?.classList.add('lmt-card-error');
          const dimsEl = document.getElementById(`mlr-dims-${id}`);
          if(dimsEl) dimsEl.textContent += ' ✗ ' + (saveRes.data||'save failed');
        }

      } catch(err) {
        console.error(`#${id} error:`, err);
        failed++;
        document.querySelector(`#mlr-card-${id}`)?.classList.add('lmt-card-error');
        const dimsEl = document.getElementById(`mlr-dims-${id}`);
        if(dimsEl) dimsEl.textContent += ' ✗ ' + (err.message||'unknown error');
      }

      done++; setP();
    }

    const stopped = mlrStop ? ' (stopped)' : '';
    if(mlrProgressLbl) mlrProgressLbl.textContent = `Done${stopped} — ${ok} resized · ${failed} failed`;
    mlrRunning=false; mlrStop=false;
    mlrBulkBtn.style.display=''; mlrStopBtn.style.display='none';
    setMlrStatus(`Completed: ${ok} resized, ${failed} failed.`);
  });

  mlrStopBtn?.addEventListener('click', function() {
    mlrStop=true; this.textContent='Stopping…'; this.disabled=true;
    setTimeout(()=>{ this.textContent='⏹ Stop'; this.disabled=false; },3000);
  });

  window.mlrRestore = async function(id) {
    if (!confirm('Restore the original backup for this image? The resized version will be overwritten.')) return;
    const res = await post('lmt_mlr_restore', { id });
    if (res.success) {
      const card = document.getElementById(`mlr-card-${id}`);
      if (card) { card.classList.remove('lmt-card-done','lmt-card-error'); card.querySelector('.lmt-restore-btn')?.remove(); }
      setMlrStatus(`#${id} restored.`);
    } else {
      alert('Restore failed: ' + (res.data || 'Unknown error'));
    }
  };

  /* ══════════════════════════════════════════════════════
     TAB 3 — ALT TEXT MANAGER
  ══════════════════════════════════════════════════════ */

  let altPage=1, altTotalPages=1, altBulkRunning=false, altBulkStop=false;

  const altStatus       = document.getElementById('alt-status');
  const altGridWrap     = document.getElementById('alt-grid-wrap');
  const altProgressWrap = document.getElementById('alt-progress-wrap');
  const altProgressFill = document.getElementById('alt-progress-fill');
  const altProgressLbl  = document.getElementById('alt-progress-label');
  const altProgressPct  = document.getElementById('alt-progress-pct');
  const altProgressCnt  = document.getElementById('alt-progress-count');
  const altLog          = document.getElementById('alt-log');

  function loadAltStats() {
    post('lmt_alt_stats').then(res => {
      if (!res.success) return;
      const d=res.data, total=d.total||1;
      window.lmtHomeCounts('alt', d);   // v3.23.0 — All tasks cards
      document.getElementById('alt-stat-total').textContent  = d.total;
      document.getElementById('alt-stat-has').textContent    = d.has_alt;
      document.getElementById('alt-stat-missing').textContent= d.missing;
      const hasPct = Math.round((d.has_alt/total)*100);
      const misPct = Math.round((d.missing/total)*100);
      if(document.getElementById('alt-bar-has'))     document.getElementById('alt-bar-has').style.width=hasPct+'%';
      if(document.getElementById('alt-bar-missing')) document.getElementById('alt-bar-missing').style.width=misPct+'%';

      // v3.20.0 — rail badge: anything missing alt, caption or description.
      const gaps = (d.missing || 0) + (d.missing_caption || 0) + (d.missing_desc || 0);
      const ct = document.getElementById('lmt-rail-ct-alt');
      if (ct) {
        ct.textContent = gaps > 999 ? '999+' : String(gaps);
        ct.hidden = gaps === 0;
        ct.title = `${d.missing || 0} missing alt · ${d.missing_caption || 0} missing caption · ${d.missing_desc || 0} missing description`;
      }
      if (typeof d.has_caption === 'number') {
        const cs = document.getElementById('alt-stat-captions');
        if (cs) cs.textContent = d.has_caption;
      }
      if (typeof d.has_desc === 'number') {
        const ds = document.getElementById('alt-stat-descs');
        if (ds) ds.textContent = d.has_desc;
      }

      // v3.27.0 — tile headline numbers + "% of library" sub-lines.
      const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      setTxt('alt-stat-missing-caption', typeof d.missing_caption === 'number'
        ? d.missing_caption : Math.max(0, (d.total || 0) - (d.has_caption || 0)));
      setTxt('alt-stat-missing-desc', typeof d.missing_desc === 'number'
        ? d.missing_desc : Math.max(0, (d.total || 0) - (d.has_desc || 0)));
      setTxt('alt-sub-missing', d.total ? misPct + '% of library' : '\u00a0');
      setTxt('alt-sub-has',     d.total ? hasPct + '% of library' : '\u00a0');
      lmtSyncTiles('alt', document.getElementById('alt-filter')?.value || 'all');
    });
  }

  let altLoaded = 0;
  function altPerPage() { return document.getElementById('alt-perpage')?.value || '30'; }

  function altCardHtml(img) {
    const badge = img.has_alt
      ? `<span class="lmt-img-status-badge lmt-badge-has-alt">✓ Has alt</span>`
      : `<span class="lmt-img-status-badge lmt-badge-no-alt">⚠ Missing</span>`;
    const dims = img.width&&img.height?`${img.width}×${img.height}`:'';
    return `
        <div class="lmt-img-card ${img.has_alt?'lmt-card-done':''}" id="alt-card-${img.id}" data-post-title="${escHtml(img.title||'')}">
          <div class="lmt-img-thumb-wrap">
            <input type="checkbox" class="lmt-img-select" id="alt-chk-${img.id}" data-id="${img.id}" onchange="window.altToggleSelect(${img.id},this.checked)">
            ${badge}
            <a class="lmt-thumb-link" href="${escHtml(window.lmtDetailUrl(img, 'alt', altPage))}" title="Open ${escHtml(img.filename)}">
              ${img.thumb?`<img class="lmt-img-thumb" src="${escHtml(img.thumb)}" alt="" loading="lazy">`:'<div class="lmt-img-thumb" style="background:var(--s3)"></div>'}
            </a>
          </div>
          <div class="lmt-img-body">
            <div class="lmt-img-filename" title="${escHtml(img.filename)}">${escHtml(img.filename)}</div>
            ${dims?`<div class="lmt-img-dims">${dims}</div>`:''}
            ${attentionChips(img, {skipAlt:true})}
            <div class="lmt-alt-row">
              <textarea class="lmt-alt-input" id="alt-inp-${img.id}" placeholder="Enter alt text…">${escHtml(img.alt||'')}</textarea>
              <button class="lmt-save-btn" onclick="window.saveAlt(${img.id})">Save</button>
            </div>
            <div class="lmt-card-actions">
              <button class="lmt-ai-btn" id="alt-ai-btn-${img.id}" onclick="window.generateAiAlt(${img.id})" title="Generate alt text with AI (AWS Bedrock)">
                ✨ Generate
              </button>
              <a class="lmt-edit-btn" href="${escHtml(window.lmtDetailUrl(img, 'alt', altPage))}" title="Open this image in Media Master">
                ✎ Edit details
              </a>
            </div>
            <div class="lmt-ai-result lmt-hidden" id="alt-ai-result-${img.id}"></div>
            ${metaMoreHtml(img)}
          </div>
        </div>`;
  }

  /* v3.20.0 — Caption and Description live on the attachment post
     (post_excerpt / post_content), not in meta. They're collapsed by
     default so the grid stays scannable; the flags in the header show
     what's missing without opening anything. */
  function metaFlags(img) {
    const flags = [];
    if (img.has_caption === false) flags.push('<span class="lmt-chip lmt-chip-warn">No caption</span>');
    if (img.has_desc    === false) flags.push('<span class="lmt-chip lmt-chip-muted">No description</span>');
    return flags.join('');
  }

  function metaMoreHtml(img) {
    const caret = '<svg class="lmt-caret" xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
    return `
            <div class="lmt-meta-more">
              <button type="button" class="lmt-meta-toggle" aria-expanded="false" aria-controls="alt-meta-${img.id}" onclick="window.lmtToggleMeta(${img.id})">
                ${caret}<span>Caption &amp; description</span>
                <span class="lmt-meta-flags">${metaFlags(img)}</span>
              </button>
              <div class="lmt-meta-fields" id="alt-meta-${img.id}">
                <div class="lmt-meta-field">
                  <div class="lmt-meta-field-head">
                    <span>Caption</span>
                    <button type="button" class="lmt-meta-ai" onclick="window.generateAiMeta(${img.id},'caption',this)">✨ Generate</button>
                  </div>
                  <textarea class="lmt-meta-input" id="alt-cap-${img.id}" placeholder="Shown beneath the image in most themes">${escHtml(img.caption || '')}</textarea>
                </div>
                <div class="lmt-meta-field">
                  <div class="lmt-meta-field-head">
                    <span>Description</span>
                    <button type="button" class="lmt-meta-ai" onclick="window.generateAiMeta(${img.id},'description',this)">✨ Generate</button>
                  </div>
                  <textarea class="lmt-meta-input" id="alt-desc-${img.id}" placeholder="Longer text, shown on the attachment page">${escHtml(img.description || '')}</textarea>
                </div>
                <a class="lmt-card-detail-link" href="${escHtml(img.detail_url || '#')}">Open attachment page →</a>
              </div>
            </div>`;
  }

  window.lmtToggleMeta = function(id) {
    const box = document.getElementById(`alt-meta-${id}`);
    const btn = box?.previousElementSibling;
    if (!box) return;
    const open = box.classList.toggle('is-open');
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  /* Per-field AI for caption and description. Generates into the field
     and leaves saving to the user — same contract as AI alt text. */
  window.generateAiMeta = async function(id, field, btn) {
    const target = document.getElementById(field === 'caption' ? `alt-cap-${id}` : `alt-desc-${id}`);
    if (!target) return;
    const label = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '✨ Generating…'; }
    try {
      const res = await post('lmt_meta_generate', { id, field });
      if (res.success) {
        target.value = res.data.text || '';
        target.focus();
      } else {
        alert(res.data || 'AI generation failed.');
      }
    } catch (e) {
      alert('AI generation failed: ' + e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = label || '✨ Generate'; }
    }
  };

  function loadAltPage(page=1, append=false) {
    altPage=page;
    window.LMTPages.remember('alt', page);   // v3.23.0
    if(!append && altGridWrap) altGridWrap.innerHTML='<div class="lmt-loading">Loading…</div>';
    if(!append) altLoaded = 0;
    const filter = document.getElementById('alt-filter')?.value||'all';
    const search = document.getElementById('alt-search')?.value||'';

    post('lmt_alt_get_batch',{page,filter,search,sort:document.getElementById('alt-sort')?.value||'date_desc',type:document.getElementById('alt-type')?.value||'all',per_page:altPerPage()}).then(res=>{
      if(!res.success) return;
      const d=res.data;
      altTotalPages=d.pages;

      if(!append && !d.items.length){
        if(altGridWrap) altGridWrap.innerHTML='<div class="lmt-grid-empty">✓ No images match this filter.</div>';
        document.getElementById('alt-loadmore').innerHTML='';
        return;
      }
      if(!append){
        altGridWrap.innerHTML = `<p class="lmt-count-label" id="alt-count-label"></p><div class="lmt-image-grid" id="alt-grid"></div>`;
      }
      const grid = document.getElementById('alt-grid');
      if(grid) grid.insertAdjacentHTML('beforeend', d.items.map(altCardHtml).join(''));
      altLoaded += d.items.length;

      const label = document.getElementById('alt-count-label');
      if(label) label.textContent = `${d.total} image(s) — showing ${altLoaded}`;

      fillUsageCounts(d.items);   // v3.39.0 — deferred usage counts
      renderLoadMore('alt-loadmore', altPage, altTotalPages, altLoaded, d.total, n=>loadAltPage(n, true));
      window.lmtHighlightReturn('alt');   // v3.23.0
      const selAll = document.getElementById('alt-select-all');
      if (selAll) selAll.checked = false;
      initAiBanner();
      updateAltChip();
    });
  }

  /* Filter chip: select every loaded image that still needs alt text. */
  function updateAltChip() {
    const chip = document.getElementById('alt-chip-missing');
    if (!chip) return;
    const n = document.querySelectorAll('#alt-grid .lmt-img-card:not(.lmt-card-done)').length;
    chip.textContent = `⚠ Select missing alt (${n})`;
    chip.disabled = n === 0;
  }
  document.getElementById('alt-chip-missing')?.addEventListener('click', function() {
    const cards = document.querySelectorAll('#alt-grid .lmt-img-card:not(.lmt-card-done)');
    let first = null;
    cards.forEach(card => {
      const chk = card.querySelector('.lmt-img-select');
      if (!chk) return;
      const id = parseInt(chk.dataset.id, 10);
      chk.checked = true;
      window.altToggleSelect(id, true);
      if (!first) first = card;
    });
    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  /* Clickable stat cards → set the filter dropdown and reload. */
  window.lmtAltFilter = function(val) {
    const f = document.getElementById('alt-filter');
    if (f) f.value = val;
    lmtSyncTiles('alt', val);
    loadAltPage(1);
  };


  /* ══════════════════════════════════════════════════════
     AI ALT TEXT — CLAUDE VISION
  ══════════════════════════════════════════════════════ */

  const altSelected = new Set();

  window.altToggleSelect = function(id, checked) {
    if (checked) altSelected.add(id); else altSelected.delete(id);
    const btn = document.getElementById('alt-ai-bulk-btn');
    if (btn) btn.disabled = (altSelected.size === 0 || !window.LMT?.has_key);
    const tBtn = document.getElementById('alt-title-bulk-btn');
    if (tBtn) tBtn.disabled = (altSelected.size === 0);
    const sBtn = document.getElementById('alt-save-bulk-btn');
    if (sBtn) sBtn.disabled = (altSelected.size === 0);
    const selAll = document.getElementById('alt-select-all');
    if (selAll) {
      const boxes = altGridWrap?.querySelectorAll('.lmt-img-select') || [];
      selAll.checked = boxes.length > 0 && [...boxes].every(b => b.checked);
    }
  };

  // Select all checkboxes currently rendered in the alt grid
  document.getElementById('alt-select-all')?.addEventListener('change', function() {
    const boxes = altGridWrap?.querySelectorAll('.lmt-img-select') || [];
    boxes.forEach(chk => {
      const id = parseInt(chk.dataset.id, 10);
      chk.checked = this.checked;
      if (this.checked) altSelected.add(id); else altSelected.delete(id);
    });
    const aiBtn = document.getElementById('alt-ai-bulk-btn');
    if (aiBtn) aiBtn.disabled = (altSelected.size === 0 || !window.LMT?.has_key);
    const tBtn = document.getElementById('alt-title-bulk-btn');
    if (tBtn) tBtn.disabled = (altSelected.size === 0);
    const sBtn = document.getElementById('alt-save-bulk-btn');
    if (sBtn) sBtn.disabled = (altSelected.size === 0);
  });

  // Bulk: copy each image's post title into its alt text
  let altTitleBulkRunning = false;
  document.getElementById('alt-title-bulk-btn')?.addEventListener('click', async function() {
    if (altTitleBulkRunning || altSelected.size === 0) return;

    const ids = [...altSelected];
    const overwrite = document.getElementById('alt-overwrite')?.checked;
    const skipText = overwrite ? '' : '\n\nImages that already have alt text will be skipped.';
    if (!confirm(`Copy the title into the alt text for ${ids.length} selected image(s)?${skipText}`)) return;

    altTitleBulkRunning = true;
    const aiBtn = document.getElementById('alt-ai-bulk-btn');
    if (aiBtn) aiBtn.disabled = true;
    this.disabled = true;
    altProgressWrap?.classList.remove('lmt-hidden');
    if (altLog) altLog.innerHTML = '';

    let done = 0, ok = 0, skipped = 0, failed = 0;
    const total = ids.length;
    const setP = () => {
      const pct = Math.round((done/total)*100);
      if (altProgressFill) altProgressFill.style.width = pct + '%';
      if (altProgressPct)  altProgressPct.textContent  = pct + '%';
      if (altProgressCnt)  altProgressCnt.textContent  = `${done}/${total}`;
      if (altProgressLbl)  altProgressLbl.textContent  = `📝 Copying titles to alt… ${ok} done · ${skipped} skipped · ${failed} failed`;
    };
    setP();

    for (const id of ids) {
      const card  = document.getElementById(`alt-card-${id}`);
      const inp   = document.getElementById(`alt-inp-${id}`);
      const badge = card?.querySelector('.lmt-img-status-badge');
      const title = (card?.dataset.postTitle || '').trim();

      // Skip if already has alt and overwrite is off
      if (!overwrite && badge && badge.classList.contains('lmt-badge-has-alt')) {
        skipped++; done++; setP();
        if (altLog) altLog.innerHTML += `⟳ #${id}: skipped (already has alt)<br>`;
        continue;
      }
      if (!title) {
        failed++; done++; setP();
        if (altLog) altLog.innerHTML += `✗ #${id}: no title to copy<br>`;
        continue;
      }

      try {
        const res = await post('lmt_alt_save', { id, alt: title });
        if (!res.success) throw new Error(res.data || 'save failed');
        ok++;
        if (inp) inp.value = title;
        if (card) card.classList.add('lmt-card-done');
        if (badge) {
          badge.className = 'lmt-img-status-badge lmt-badge-has-alt';
          badge.textContent = '✓ Has alt';
        }
        if (altLog) altLog.innerHTML += `✓ #${id}: "${escHtml(title)}"<br>`;
      } catch (err) {
        failed++;
        if (altLog) altLog.innerHTML += `✗ #${id}: ${escHtml(err.message)}<br>`;
      }
      done++; setP();
      if (altLog) altLog.scrollTop = altLog.scrollHeight;
    }

    if (altProgressLbl) altProgressLbl.textContent = `✓ Done — ${ok} updated · ${skipped} skipped · ${failed} failed`;
    altTitleBulkRunning = false;
    this.disabled = (altSelected.size === 0);
    if (aiBtn) aiBtn.disabled = (altSelected.size === 0 || !window.LMT?.has_key);
    loadAltStats();
  });

  // Init AI banner on tab load
  function initAiBanner() {
    const msg     = document.getElementById('lmt-ai-status-msg');
    const bulkBtn = document.getElementById('alt-ai-bulk-btn');
    const banner  = document.getElementById('lmt-ai-banner');
    if (!msg) return;
    if (window.LMT?.has_key) {
      msg.textContent = 'AWS Bedrock (via Lookit AI) connected — AI generation ready.';
      msg.style.color = 'var(--green)';
      if (banner) banner.classList.add('lmt-ai-banner-ready');
      // Enable per-card AI buttons
      document.querySelectorAll('.lmt-ai-btn').forEach(b => b.disabled = false);
    } else {
      msg.textContent = 'No Lookit AI endpoint set. Add it in Settings to enable AI generation.';
      msg.style.color = 'var(--amber)';
      document.querySelectorAll('.lmt-ai-btn').forEach(b => b.disabled = true);
    }
    if (bulkBtn) bulkBtn.disabled = (altSelected.size === 0 || !window.LMT?.has_key);
  }

  // Generate AI alt for a single image
  window.generateAiAlt = async function(id) {
    if (!window.LMT?.has_key) {
      alert('No Lookit AI endpoint set. Go to Media Master → Settings to add one.');
      return;
    }
    const btn    = document.getElementById(`alt-ai-btn-${id}`);
    const result = document.getElementById(`alt-ai-result-${id}`);
    const inp    = document.getElementById(`alt-inp-${id}`);

    if (btn) { btn.textContent = '⏳ Analysing…'; btn.disabled = true; }
    if (result) { result.classList.remove('lmt-hidden'); result.textContent = 'Sending to AI…'; result.className = 'lmt-ai-result'; }

    try {
      const res = await post('lmt_ai_alt_generate', { id, save: '0' });
      if (!res.success) throw new Error(res.data || 'AI generation failed');

      const alt = res.data.alt;
      if (result) {
        result.classList.remove('lmt-hidden');
        result.className = 'lmt-ai-result lmt-ai-result-success';
        result.innerHTML =
          `<span class="lmt-ai-label">✨ Lookit suggests:</span>` +
          `<span class="lmt-ai-text">${escHtml(alt)}</span>` +
          `<button class="lmt-ai-use-btn" onclick="window.useAiAlt(${id},'${escHtml(alt).replace(/'/g,'&#39;')}')">Use this</button>`;
      }
      if (btn) { btn.textContent = '✨ Generate'; btn.disabled = false; }
    } catch(err) {
      if (result) { result.classList.remove('lmt-hidden'); result.className='lmt-ai-result lmt-ai-result-error'; result.textContent='✗ ' + err.message; }
      if (btn) { btn.textContent = '✨ Generate'; btn.disabled = false; }
    }
  };

  // Apply suggested alt text to the textarea
  window.useAiAlt = function(id, alt) {
    const inp = document.getElementById(`alt-inp-${id}`);
    if (inp) {
      inp.value = alt;
      inp.style.borderColor = 'var(--blue)';
      setTimeout(() => inp.style.borderColor = '', 1500);
    }
    const result = document.getElementById(`alt-ai-result-${id}`);
    if (result) result.innerHTML += ' <em style="color:var(--text-3);font-size:11px">— applied to field, click Save to store</em>';
  };

  // Bulk AI generation for selected images
  let aiBulkRunning = false, aiBulkStop = false;

  document.getElementById('alt-ai-bulk-btn')?.addEventListener('click', async function() {
    if (aiBulkRunning || altSelected.size === 0) return;
    if (!window.LMT?.has_key) { alert('No Lookit AI endpoint set. Go to Media Master → Settings.'); return; }

    const ids = [...altSelected];
    const overwrite = document.getElementById('alt-overwrite')?.checked;
    if (!confirm(`Generate AI alt text for ${ids.length} selected image(s) using AWS Bedrock?\n\nThis will call the Lookit AI platform once per image and auto-save the results.`)) return;

    aiBulkRunning = true; aiBulkStop = false;
    this.style.display = 'none';
    document.getElementById('alt-stop-btn').style.display = '';
    altProgressWrap?.classList.remove('lmt-hidden');
    if(altLog) altLog.innerHTML = '';

    let done=0, ok=0, skipped=0, failed=0;
    const total = ids.length;

    const setP = () => {
      const pct = Math.round((done/total)*100);
      if(altProgressFill) altProgressFill.style.width = pct+'%';
      if(altProgressPct)  altProgressPct.textContent  = pct+'%';
      if(altProgressCnt)  altProgressCnt.textContent  = `${done}/${total}`;
      if(altProgressLbl)  altProgressLbl.textContent  = `✨ AI generating… ${ok} done · ${skipped} skipped · ${failed} failed`;
    };
    setP();

    for (const id of ids) {
      if (aiBulkStop) break;

      // Skip if has alt and overwrite is off
      const inp = document.getElementById(`alt-inp-${id}`);
      if (!overwrite && inp?.value?.trim()) {
        skipped++; done++; setP();
        if(altLog) altLog.innerHTML += `⟳ #${id}: skipped (already has alt)<br>`;
        continue;
      }

      try {
        const res = await post('lmt_ai_alt_generate', { id, save: '1' });
        if (!res.success) throw new Error(res.data);

        const alt = res.data.alt;
        ok++;

        // Update UI
        const card  = document.getElementById(`alt-card-${id}`);
        const badge = card?.querySelector('.lmt-img-status-badge');
        if (inp) inp.value = alt;
        if (card) card.classList.add('lmt-card-done');
        if (badge) { badge.className='lmt-img-status-badge lmt-badge-has-alt'; badge.textContent='✓ Has alt'; }
        if(altLog) altLog.innerHTML += `✨ #${id}: ${escHtml(alt.substring(0,70))}<br>`;
        if(altLog) altLog.scrollTop = altLog.scrollHeight;

      } catch(err) {
        failed++;
        if(altLog) altLog.innerHTML += `✗ #${id}: ${escHtml(err.message||'failed')}<br>`;
        if(altLog) altLog.scrollTop = altLog.scrollHeight;
      }

      done++; setP();
      // Small delay between calls to avoid rate limiting
      await new Promise(r => setTimeout(r, 300));
    }

    const stopped = aiBulkStop ? ' (stopped)' : '';
    if(altProgressLbl) altProgressLbl.textContent = `✨ AI done${stopped} — ${ok} generated · ${skipped} skipped · ${failed} failed`;
    aiBulkRunning = false; aiBulkStop = false;
    this.style.display = '';
    document.getElementById('alt-stop-btn').style.display = 'none';
    loadAltStats();
  });

  window.saveAlt = function(id) {
    const val  = document.getElementById(`alt-inp-${id}`)?.value || '';
    const card = document.getElementById(`alt-card-${id}`);
    // v3.20.0 — one Save writes alt, caption and description together.
    const capEl  = document.getElementById(`alt-cap-${id}`);
    const descEl = document.getElementById(`alt-desc-${id}`);
    const payload = { id, alt: val };
    if (capEl)  payload.caption     = capEl.value;
    if (descEl) payload.description = descEl.value;
    post('lmt_alt_save',payload).then(res=>{
      if(!res.success){alert(res.data || 'Save failed');return;}
      const flags = card?.querySelector('.lmt-meta-flags');
      if (flags) {
        flags.innerHTML = metaFlags({
          has_caption: (capEl  ? capEl.value.trim()  !== '' : true),
          has_desc:    (descEl ? descEl.value.trim() !== '' : true)
        });
      }
      if(card){
        card.classList.toggle('lmt-card-done',!!val);
        const badge=card.querySelector('.lmt-img-status-badge');
        if(badge){ badge.className='lmt-img-status-badge '+(val?'lmt-badge-has-alt':'lmt-badge-no-alt'); badge.textContent=val?'✓ Has alt':'⚠ Missing'; }
      }
      loadAltStats();
    });
  };

  // Bulk: save the current alt-text field for every selected image
  let altSaveBulkRunning = false;
  document.getElementById('alt-save-bulk-btn')?.addEventListener('click', async function() {
    if (altSaveBulkRunning || altSelected.size === 0) return;
    altSaveBulkRunning = true;
    const ids = [...altSelected];
    const label = this.innerHTML;
    let ok = 0, failed = 0;
    for (let i = 0; i < ids.length; i++) {
      const id  = ids[i];
      this.disabled = true;
      this.innerHTML = `&#128190; Saving ${i + 1}/${ids.length}…`;
      const val  = document.getElementById(`alt-inp-${id}`)?.value || '';
      const card = document.getElementById(`alt-card-${id}`);
      const capEl2  = document.getElementById(`alt-cap-${id}`);
      const descEl2 = document.getElementById(`alt-desc-${id}`);
      const payload2 = { id, alt: val };
      if (capEl2)  payload2.caption     = capEl2.value;
      if (descEl2) payload2.description = descEl2.value;
      try {
        const res = await post('lmt_alt_save', payload2);
        if (!res.success) { failed++; continue; }
        ok++;
        if (card) {
          card.classList.toggle('lmt-card-done', !!val);
          const badge = card.querySelector('.lmt-img-status-badge');
          if (badge) { badge.className = 'lmt-img-status-badge ' + (val ? 'lmt-badge-has-alt' : 'lmt-badge-no-alt'); badge.textContent = val ? '✓ Has alt' : '⚠ Missing'; }
        }
      } catch (e) { failed++; }
    }
    this.innerHTML = label;
    this.disabled = (altSelected.size === 0);
    loadAltStats();
    alert(`Saved ${ok} alt text${ok !== 1 ? 's' : ''}${failed ? `, ${failed} failed` : ''}.`);
    altSaveBulkRunning = false;
  });

  // NOTE: the legacy "Bulk Title Fix" button (#alt-bulk-btn) was removed in
  // v3.9.3. The Title Manager tab below handles title editing properly.

  document.getElementById('alt-stop-btn')?.addEventListener('click',function(){
    altBulkStop=true; this.textContent='Stopping…'; this.disabled=true;
    setTimeout(()=>{this.textContent='⏹ Stop';this.disabled=false;},3000);
  });

  document.getElementById('alt-filter')?.addEventListener('change', function(){ lmtSyncTiles('alt', this.value); loadAltPage(1); });
  ['alt-sort','alt-type'].forEach(id => document.getElementById(id)?.addEventListener('change', ()=>loadAltPage(1)));
  document.getElementById('alt-search')?.addEventListener('keydown', e=>{ if(e.key==='Enter') loadAltPage(1); });
  document.getElementById('alt-refresh-btn')?.addEventListener('click', ()=>{ loadAltStats(); loadAltPage(altPage); });

  /* ══════════════════════════════════════════════════════
     TAB 4 — TITLE MANAGER
     Mirrors the Alt Manager flow but reads/writes post_title.
     A title is considered "Auto" when it equals the filename
     (which is what WordPress sets on upload). Anything else
     is treated as a custom, human-edited title.
  ══════════════════════════════════════════════════════ */

  let titlePage=1, titleTotalPages=1, titleAiBulkRunning=false, titleAiBulkStop=false;

  const titleGridWrap     = document.getElementById('title-grid-wrap');
  const titleProgressWrap = document.getElementById('title-progress-wrap');
  const titleProgressFill = document.getElementById('title-progress-fill');
  const titleProgressLbl  = document.getElementById('title-progress-label');
  const titleProgressPct  = document.getElementById('title-progress-pct');
  const titleProgressCnt  = document.getElementById('title-progress-count');
  const titleLog          = document.getElementById('title-log');

  const titleSelected = new Set();

  function loadTitleStats() {
    post('lmt_title_stats').then(res => {
      if (!res.success) return;
      const d = res.data, total = d.total || 1;
      window.lmtHomeCounts('title', d); // v3.23.0 — All tasks cards
      const totalEl  = document.getElementById('title-stat-total');
      const customEl = document.getElementById('title-stat-custom');
      const autoEl   = document.getElementById('title-stat-auto');
      if (totalEl)  totalEl.textContent  = d.total;
      if (customEl) customEl.textContent = d.custom;
      if (autoEl)   autoEl.textContent   = d.auto;
      const cusPct = Math.round((d.custom/total)*100);
      const autPct = Math.round((d.auto/total)*100);
      const cusBar = document.getElementById('title-bar-custom');
      const autBar = document.getElementById('title-bar-auto');
      if (cusBar) cusBar.style.width = cusPct + '%';
      if (autBar) autBar.style.width = autPct + '%';

      // v3.27.0 — tile sub-lines + active state.
      const autoSub = document.getElementById('title-sub-auto');
      const cusSub  = document.getElementById('title-sub-custom');
      if (autoSub) autoSub.textContent = d.total ? autPct + '% of library' : '\u00a0';
      if (cusSub)  cusSub.textContent  = d.total ? cusPct + '% done'       : '\u00a0';
      lmtSyncTiles('title', document.getElementById('title-filter')?.value || 'all');
    });
  }

  let titleLoaded = 0;
  function titlePerPage() { return document.getElementById('title-perpage')?.value || '30'; }

  function titleCardHtml(img) {
    const badge = img.is_auto
      ? `<span class="lmt-img-status-badge lmt-badge-no-alt">⚠ Auto title</span>`
      : `<span class="lmt-img-status-badge lmt-badge-has-alt">✓ Custom</span>`;
    const dims = img.width && img.height ? `${img.width}×${img.height}` : '';
    return `
        <div class="lmt-img-card ${img.is_auto?'':'lmt-card-done'}" id="title-card-${img.id}">
          <div class="lmt-img-thumb-wrap">
            <input type="checkbox" class="lmt-img-select" id="title-chk-${img.id}" data-id="${img.id}" onchange="window.titleToggleSelect(${img.id},this.checked)">
            ${badge}
            <a class="lmt-thumb-link" href="${escHtml(window.lmtDetailUrl(img, 'title', titlePage))}" title="Open ${escHtml(img.filename)}">
              ${img.thumb?`<img class="lmt-img-thumb" src="${escHtml(img.thumb)}" alt="" loading="lazy">`:'<div class="lmt-img-thumb" style="background:var(--s3)"></div>'}
            </a>
          </div>
          <div class="lmt-img-body">
            <div class="lmt-img-filename" title="${escHtml(img.filename)}">${escHtml(img.filename)}</div>
            ${dims?`<div class="lmt-img-dims">${dims}</div>`:''}
            ${attentionChips(img, {skipTitle:true})}
            <div class="lmt-alt-row">
              <textarea class="lmt-alt-input" id="title-inp-${img.id}" placeholder="Enter image title…" style="min-height:38px">${escHtml(img.title||'')}</textarea>
              <button class="lmt-save-btn" onclick="window.saveTitle(${img.id})">Save</button>
            </div>
            <div class="lmt-card-actions">
              <button class="lmt-ai-btn" id="title-ai-btn-${img.id}" onclick="window.generateAiTitle(${img.id})" title="Generate a title with AI (AWS Bedrock)">
                ✨ Generate
              </button>
              <a class="lmt-edit-btn" href="${escHtml(window.lmtDetailUrl(img, 'title', titlePage))}" title="Open this image in Media Master">
                ✎ Edit details
              </a>
            </div>
            <div class="lmt-ai-result lmt-hidden" id="title-ai-result-${img.id}"></div>
          </div>
        </div>`;
  }

  function loadTitlePage(page = 1, append = false) {
    titlePage = page;
    window.LMTPages.remember('title', page); // v3.23.0
    if (!append && titleGridWrap) titleGridWrap.innerHTML = '<div class="lmt-loading">Loading…</div>';
    if (!append) titleLoaded = 0;
    const filter = document.getElementById('title-filter')?.value || 'all';
    const search = document.getElementById('title-search')?.value || '';

    post('lmt_title_get_batch', { page, filter, search, sort: document.getElementById('title-sort')?.value || 'date_desc', type: document.getElementById('title-type')?.value || 'all', per_page: titlePerPage() }).then(res => {
      if (!res.success) return;
      const d = res.data;
      titleTotalPages = d.pages;

      if (!append && !d.items.length) {
        if (titleGridWrap) titleGridWrap.innerHTML = '<div class="lmt-grid-empty">✓ No images match this filter.</div>';
        document.getElementById('title-loadmore').innerHTML = '';
        return;
      }
      if (!append) {
        titleGridWrap.innerHTML = `<p class="lmt-count-label" id="title-count-label"></p><div class="lmt-image-grid" id="title-grid"></div>`;
      }
      const grid = document.getElementById('title-grid');
      if (grid) grid.insertAdjacentHTML('beforeend', d.items.map(titleCardHtml).join(''));
      titleLoaded += d.items.length;

      const label = document.getElementById('title-count-label');
      if (label) label.textContent = `${d.total} image(s) — showing ${titleLoaded}`;

      fillUsageCounts(d.items);   // v3.39.0 — deferred usage counts
      renderLoadMore('title-loadmore', titlePage, titleTotalPages, titleLoaded, d.total, n => loadTitlePage(n, true));
      window.lmtHighlightReturn('title'); // v3.23.0
      const selAll = document.getElementById('title-select-all');
      if (selAll) selAll.checked = false;
      initTitleAiBanner();
      updateTitleChip();
    });
  }

  /* Filter chip: select every loaded image that still has an auto (filename) title. */
  function updateTitleChip() {
    const chip = document.getElementById('title-chip-auto');
    if (!chip) return;
    const n = document.querySelectorAll('#title-grid .lmt-img-card:not(.lmt-card-done)').length;
    chip.textContent = `⚠ Select auto titles (${n})`;
    chip.disabled = n === 0;
  }
  document.getElementById('title-chip-auto')?.addEventListener('click', function() {
    const cards = document.querySelectorAll('#title-grid .lmt-img-card:not(.lmt-card-done)');
    let first = null;
    cards.forEach(card => {
      const chk = card.querySelector('.lmt-img-select');
      if (!chk) return;
      const id = parseInt(chk.dataset.id, 10);
      chk.checked = true;
      window.titleToggleSelect(id, true);
      if (!first) first = card;
    });
    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  /* Clickable stat cards → set the filter dropdown and reload. */
  window.lmtTitleFilter = function(val) {
    const f = document.getElementById('title-filter');
    if (f) f.value = val;
    lmtSyncTiles('title', val);
    loadTitlePage(1);
  };

  window.titleToggleSelect = function(id, checked) {
    if (checked) titleSelected.add(id); else titleSelected.delete(id);
    const btn = document.getElementById('title-ai-bulk-btn');
    if (btn) btn.disabled = (titleSelected.size === 0 || !window.LMT?.has_key);
    const fnBtn = document.getElementById('title-filename-bulk-btn');
    if (fnBtn) fnBtn.disabled = (titleSelected.size === 0);
    const sBtn = document.getElementById('title-save-bulk-btn');
    if (sBtn) sBtn.disabled = (titleSelected.size === 0);
    const selAll = document.getElementById('title-select-all');
    if (selAll) {
      const boxes = titleGridWrap?.querySelectorAll('.lmt-img-select') || [];
      selAll.checked = boxes.length > 0 && [...boxes].every(b => b.checked);
    }
  };

  // Select all checkboxes currently rendered in the title grid
  document.getElementById('title-select-all')?.addEventListener('change', function() {
    const boxes = titleGridWrap?.querySelectorAll('.lmt-img-select') || [];
    boxes.forEach(chk => {
      const id = parseInt(chk.dataset.id, 10);
      chk.checked = this.checked;
      if (this.checked) titleSelected.add(id); else titleSelected.delete(id);
    });
    const aiBtn = document.getElementById('title-ai-bulk-btn');
    if (aiBtn) aiBtn.disabled = (titleSelected.size === 0 || !window.LMT?.has_key);
    const fnBtn = document.getElementById('title-filename-bulk-btn');
    if (fnBtn) fnBtn.disabled = (titleSelected.size === 0);
    const sBtn = document.getElementById('title-save-bulk-btn');
    if (sBtn) sBtn.disabled = (titleSelected.size === 0);
  });

  // Convert a filename into a clean human-readable title:
  // strip extension, replace - / _ with spaces, collapse whitespace, trim.
  function filenameToTitle(filename) {
    if (!filename) return '';
    let name = String(filename).replace(/\.[^.\/\\]+$/, ''); // drop extension
    name = name.replace(/[-_]+/g, ' ');
    name = name.replace(/\s+/g, ' ').trim();
    return name;
  }

  function initTitleAiBanner() {
    const msg     = document.getElementById('lmt-ai-status-msg-title');
    const bulkBtn = document.getElementById('title-ai-bulk-btn');
    const banner  = document.getElementById('lmt-ai-banner-title');
    if (!msg) return;
    if (window.LMT?.has_key) {
      msg.textContent = 'AWS Bedrock (via Lookit AI) connected — AI generation ready.';
      msg.style.color = 'var(--green)';
      if (banner) banner.classList.add('lmt-ai-banner-ready');
      document.querySelectorAll('#title-grid-wrap .lmt-ai-btn').forEach(b => b.disabled = false);
    } else {
      msg.textContent = 'No Lookit AI endpoint set. Add it in Settings to enable AI generation.';
      msg.style.color = 'var(--amber)';
      document.querySelectorAll('#title-grid-wrap .lmt-ai-btn').forEach(b => b.disabled = true);
    }
    if (bulkBtn) bulkBtn.disabled = (titleSelected.size === 0 || !window.LMT?.has_key);
  }

  window.saveTitle = function(id) {
    const val  = document.getElementById(`title-inp-${id}`)?.value || '';
    const card = document.getElementById(`title-card-${id}`);
    post('lmt_title_save', { id, title: val }).then(res => {
      if (!res.success) { alert('Save failed: ' + (res.data || 'unknown error')); return; }
      const isAuto = res.data.is_auto;
      if (card) {
        card.classList.toggle('lmt-card-done', !isAuto);
        const badge = card.querySelector('.lmt-img-status-badge');
        if (badge) {
          badge.className = 'lmt-img-status-badge ' + (isAuto ? 'lmt-badge-no-alt' : 'lmt-badge-has-alt');
          badge.textContent = isAuto ? '⚠ Auto title' : '✓ Custom';
        }
      }
      loadTitleStats();
    });
  };

  // Bulk: save the current title field for every selected image
  let titleSaveBulkRunning = false;
  document.getElementById('title-save-bulk-btn')?.addEventListener('click', async function() {
    if (titleSaveBulkRunning || titleSelected.size === 0) return;
    titleSaveBulkRunning = true;
    const ids = [...titleSelected];
    const label = this.innerHTML;
    let ok = 0, failed = 0;
    for (let i = 0; i < ids.length; i++) {
      const id  = ids[i];
      this.disabled = true;
      this.innerHTML = `&#128190; Saving ${i + 1}/${ids.length}…`;
      const val  = document.getElementById(`title-inp-${id}`)?.value || '';
      const card = document.getElementById(`title-card-${id}`);
      try {
        const res = await post('lmt_title_save', { id, title: val });
        if (!res.success) { failed++; continue; }
        ok++;
        const isAuto = res.data.is_auto;
        if (card) {
          card.classList.toggle('lmt-card-done', !isAuto);
          const badge = card.querySelector('.lmt-img-status-badge');
          if (badge) {
            badge.className = 'lmt-img-status-badge ' + (isAuto ? 'lmt-badge-no-alt' : 'lmt-badge-has-alt');
            badge.textContent = isAuto ? '⚠ Auto title' : '✓ Custom';
          }
        }
      } catch (e) { failed++; }
    }
    this.innerHTML = label;
    this.disabled = (titleSelected.size === 0);
    loadTitleStats();
    alert(`Saved ${ok} title${ok !== 1 ? 's' : ''}${failed ? `, ${failed} failed` : ''}.`);
    titleSaveBulkRunning = false;
  });

  window.generateAiTitle = async function(id) {
    if (!window.LMT?.has_key) {
      alert('No Lookit AI endpoint set. Go to Media Master → Settings to add one.');
      return;
    }
    const btn    = document.getElementById(`title-ai-btn-${id}`);
    const result = document.getElementById(`title-ai-result-${id}`);

    if (btn) { btn.textContent = '⏳ Analysing…'; btn.disabled = true; }
    if (result) { result.classList.remove('lmt-hidden'); result.textContent = 'Sending to AI…'; result.className = 'lmt-ai-result'; }

    try {
      const res = await post('lmt_ai_title_generate', { id, save: '0' });
      if (!res.success) throw new Error(res.data || 'AI generation failed');

      const title = res.data.title;
      if (result) {
        result.classList.remove('lmt-hidden');
        result.className = 'lmt-ai-result lmt-ai-result-success';
        result.innerHTML =
          `<span class="lmt-ai-label">✨ Suggested title:</span>` +
          `<span class="lmt-ai-text">${escHtml(title)}</span>` +
          `<button class="lmt-ai-use-btn" onclick="window.useAiTitle(${id},'${escHtml(title).replace(/'/g,'&#39;')}')">Use this</button>`;
      }
      if (btn) { btn.textContent = '✨ Generate'; btn.disabled = false; }
    } catch(err) {
      if (result) { result.classList.remove('lmt-hidden'); result.className = 'lmt-ai-result lmt-ai-result-error'; result.textContent = '✗ ' + err.message; }
      if (btn) { btn.textContent = '✨ Generate'; btn.disabled = false; }
    }
  };

  window.useAiTitle = function(id, title) {
    const inp = document.getElementById(`title-inp-${id}`);
    if (inp) {
      inp.value = title;
      inp.style.borderColor = 'var(--blue)';
      setTimeout(() => inp.style.borderColor = '', 1500);
    }
    const result = document.getElementById(`title-ai-result-${id}`);
    if (result) result.innerHTML += ' <em style="color:var(--text-3);font-size:11px">— applied to field, click Save to store</em>';
  };

  // Bulk: derive title from filename for selected images
  let titleFnBulkRunning = false;
  document.getElementById('title-filename-bulk-btn')?.addEventListener('click', async function() {
    if (titleFnBulkRunning || titleSelected.size === 0) return;

    const ids = [...titleSelected];
    const overwrite = document.getElementById('title-overwrite')?.checked;
    const skipText = overwrite ? '' : '\n\nImages that already have a custom (non-filename) title will be skipped.';
    if (!confirm(`Set titles from filename for ${ids.length} selected image(s)?\n\nDashes and underscores will be replaced with spaces (e.g. "Washington-Capitol-bill" → "Washington Capitol bill").${skipText}`)) return;

    titleFnBulkRunning = true;
    const aiBtn = document.getElementById('title-ai-bulk-btn');
    if (aiBtn) aiBtn.disabled = true;
    this.disabled = true;
    titleProgressWrap?.classList.remove('lmt-hidden');
    if (titleLog) titleLog.innerHTML = '';

    let done = 0, ok = 0, skipped = 0, failed = 0;
    const total = ids.length;
    const setP = () => {
      const pct = Math.round((done/total)*100);
      if (titleProgressFill) titleProgressFill.style.width = pct + '%';
      if (titleProgressPct)  titleProgressPct.textContent  = pct + '%';
      if (titleProgressCnt)  titleProgressCnt.textContent  = `${done}/${total}`;
      if (titleProgressLbl)  titleProgressLbl.textContent  = `📝 Setting titles from filename… ${ok} done · ${skipped} skipped · ${failed} failed`;
    };
    setP();

    for (const id of ids) {
      const card  = document.getElementById(`title-card-${id}`);
      const badge = card?.querySelector('.lmt-img-status-badge');
      const inp   = document.getElementById(`title-inp-${id}`);
      const filenameEl = card?.querySelector('.lmt-img-filename');
      const filename = filenameEl?.getAttribute('title') || filenameEl?.textContent || '';

      // Skip if already custom unless overwrite is on
      if (!overwrite && badge && badge.classList.contains('lmt-badge-has-alt')) {
        skipped++; done++; setP();
        if (titleLog) titleLog.innerHTML += `⟳ #${id}: skipped (already has custom title)<br>`;
        continue;
      }

      const newTitle = filenameToTitle(filename);
      if (!newTitle) {
        failed++; done++; setP();
        if (titleLog) titleLog.innerHTML += `✗ #${id}: no filename available<br>`;
        continue;
      }

      try {
        const res = await post('lmt_title_save', { id, title: newTitle });
        if (!res.success) throw new Error(res.data || 'save failed');
        ok++;
        if (inp) inp.value = newTitle;
        const isAuto = !!res.data.is_auto;
        if (card) card.classList.toggle('lmt-card-done', !isAuto);
        if (badge) {
          badge.className = 'lmt-img-status-badge ' + (isAuto ? 'lmt-badge-no-alt' : 'lmt-badge-has-alt');
          badge.textContent = isAuto ? '⚠ Auto title' : '✓ Custom';
        }
        if (titleLog) titleLog.innerHTML += `✓ #${id}: "${escHtml(newTitle)}"<br>`;
      } catch (err) {
        failed++;
        if (titleLog) titleLog.innerHTML += `✗ #${id}: ${escHtml(err.message)}<br>`;
      }
      done++; setP();
      if (titleLog) titleLog.scrollTop = titleLog.scrollHeight;
    }

    if (titleProgressLbl) titleProgressLbl.textContent = `✓ Done — ${ok} updated · ${skipped} skipped · ${failed} failed`;
    titleFnBulkRunning = false;
    this.disabled = (titleSelected.size === 0);
    if (aiBtn) aiBtn.disabled = (titleSelected.size === 0 || !window.LMT?.has_key);
    loadTitleStats();
  });

  // Bulk AI generation for selected titles
  document.getElementById('title-ai-bulk-btn')?.addEventListener('click', async function() {
    if (titleAiBulkRunning || titleSelected.size === 0) return;
    if (!window.LMT?.has_key) { alert('No Lookit AI endpoint set. Go to Media Master → Settings.'); return; }

    const ids = [...titleSelected];
    if (!confirm(`Generate AI titles for ${ids.length} selected image(s) using AWS Bedrock?\n\nThis will call the Lookit AI platform once per image and auto-save the results, replacing any existing titles on the selected images.`)) return;

    titleAiBulkRunning = true; titleAiBulkStop = false;
    this.style.display = 'none';
    document.getElementById('title-stop-btn').style.display = '';
    titleProgressWrap?.classList.remove('lmt-hidden');
    if (titleLog) titleLog.innerHTML = '';

    let done = 0, ok = 0, skipped = 0, failed = 0;
    const total = ids.length;

    const setP = () => {
      const pct = Math.round((done/total)*100);
      if (titleProgressFill) titleProgressFill.style.width = pct + '%';
      if (titleProgressPct)  titleProgressPct.textContent  = pct + '%';
      if (titleProgressCnt)  titleProgressCnt.textContent  = `${done}/${total}`;
      if (titleProgressLbl)  titleProgressLbl.textContent  = `✨ AI generating titles… ${ok} done · ${skipped} skipped · ${failed} failed`;
    };
    setP();

    for (const id of ids) {
      if (titleAiBulkStop) break;

      // Explicitly-selected images are always regenerated, even if they already
      // have a custom title — selecting + clicking AI Generate is intent to rewrite.

      try {
        const res = await post('lmt_ai_title_generate', { id, save: '1' });
        if (!res.success) throw new Error(res.data);

        const title = res.data.title;
        const isAuto = !!res.data.is_auto;
        ok++;

        const card  = document.getElementById(`title-card-${id}`);
        const inp   = document.getElementById(`title-inp-${id}`);
        const badge = card?.querySelector('.lmt-img-status-badge');
        if (inp) inp.value = title;
        if (card) card.classList.toggle('lmt-card-done', !isAuto);
        if (badge) {
          badge.className = 'lmt-img-status-badge ' + (isAuto ? 'lmt-badge-no-alt' : 'lmt-badge-has-alt');
          badge.textContent = isAuto ? '⚠ Auto title' : '✓ Custom';
        }
        if (titleLog) titleLog.innerHTML += `✨ #${id}: ${escHtml(title.substring(0,70))}<br>`;
        if (titleLog) titleLog.scrollTop = titleLog.scrollHeight;

      } catch(err) {
        failed++;
        if (titleLog) titleLog.innerHTML += `✗ #${id}: ${escHtml(err.message || 'failed')}<br>`;
        if (titleLog) titleLog.scrollTop = titleLog.scrollHeight;
      }

      done++; setP();
      await new Promise(r => setTimeout(r, 300));
    }

    const stopped = titleAiBulkStop ? ' (stopped)' : '';
    if (titleProgressLbl) titleProgressLbl.textContent = `✨ AI done${stopped} — ${ok} generated · ${skipped} skipped · ${failed} failed`;
    titleAiBulkRunning = false; titleAiBulkStop = false;
    this.style.display = '';
    document.getElementById('title-stop-btn').style.display = 'none';
    loadTitleStats();
  });

  document.getElementById('title-stop-btn')?.addEventListener('click', function() {
    titleAiBulkStop = true; this.textContent = 'Stopping…'; this.disabled = true;
    setTimeout(() => { this.textContent = '⏹ Stop'; this.disabled = false; }, 3000);
  });

  document.getElementById('title-filter')?.addEventListener('change', function(){ lmtSyncTiles('title', this.value); loadTitlePage(1); });
  ['title-sort','title-type'].forEach(id => document.getElementById(id)?.addEventListener('change', () => loadTitlePage(1)));
  document.getElementById('title-search')?.addEventListener('keydown', e => { if (e.key === 'Enter') loadTitlePage(1); });
  document.getElementById('title-refresh-btn')?.addEventListener('click', () => { loadTitleStats(); loadTitlePage(titlePage); });

  /* ── Shared pagination renderer ── */
  function renderPagination(el, page, pages, onPage) {
    if (pages<=1){el.innerHTML='';return;}
    let html=`<button ${page===1?'disabled':''} onclick="(${onPage.toString()})(${page-1})">‹ Prev</button>`;
    const range=[]; for(let i=Math.max(1,page-3);i<=Math.min(pages,page+3);i++) range.push(i);
    if(range[0]>1){html+=`<button onclick="(${onPage.toString()})(1)">1</button>`;if(range[0]>2)html+='<span>…</span>';}
    range.forEach(i=>{html+=`<button class="${i===page?'active':''}" onclick="(${onPage.toString()})(${i})">${i}</button>`;});
    if(range[range.length-1]<pages){if(range[range.length-1]<pages-1)html+='<span>…</span>';html+=`<button onclick="(${onPage.toString()})(${pages})">${pages}</button>`;}
    html+=`<button ${page===pages?'disabled':''} onclick="(${onPage.toString()})(${page+1})">Next ›</button>`;
    el.innerHTML=html;
  }

  /* ══════════════════════════════════════════════════════
     TAB 4 — EXPORT  (v3.17.0)
     Filters drive a count/size scan; Build ZIP starts a server-side
     job and walks it in batches until the archive is complete.
  ══════════════════════════════════════════════════════ */

  const expType     = document.getElementById('exp-type');
  const expRange    = document.getElementById('exp-range');
  const expAttached = document.getElementById('exp-attached');
  const expSearch   = document.getElementById('exp-search');
  const expFolders  = document.getElementById('exp-folders');
  const expSplit    = document.getElementById('exp-split');
  const expOrig     = document.getElementById('exp-originals');
  const expCsv      = document.getElementById('exp-csv');
  const expCount    = document.getElementById('exp-count');
  const expSize     = document.getElementById('exp-size');
  const expStatus   = document.getElementById('exp-status');
  const expBuildBtn = document.getElementById('exp-build-btn');
  const expStopBtn  = document.getElementById('exp-stop-btn');
  const expJobsEl   = document.getElementById('exp-jobs');
  const expWrap     = document.getElementById('exp-progress-wrap');
  const expFill     = document.getElementById('exp-progress-fill');
  const expPct      = document.getElementById('exp-progress-pct');
  const expCnt      = document.getElementById('exp-progress-count');
  const expLabel    = document.getElementById('exp-progress-label');

  let expScanTimer = null;
  let expAborted   = false;
  let expRunning   = false;

  function expBigBytes(b) {
    if (!b) return '0 B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(0) + ' KB';
    if (b < 1024 * 1024 * 1024) return (b / (1024 * 1024)).toFixed(1) + ' MB';
    return (b / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }

  function expFilters() {
    return {
      type:      expType ? expType.value : 'all',
      range:     expRange ? expRange.value : 'all',
      attached:  expAttached ? expAttached.value : 'any',
      search:    expSearch ? expSearch.value : '',
      folders:   expFolders ? expFolders.value : 'uploads',
      split:     expSplit ? expSplit.value : '0',
      originals: (expOrig && expOrig.checked) ? '1' : '',
      csv:       (expCsv && expCsv.checked) ? '1' : ''
    };
  }

  /* Rebuild the Date range options when the years available for this media
     type change. Rebuilds only on an actual change, so an open dropdown
     isn't yanked out from under you. */
  function expSyncYears(years) {
    if (!expRange || !Array.isArray(years)) return;
    const signature = years.join(',');
    if (expRange.dataset.years === signature) return;
    const current = expRange.value;
    expRange.dataset.years = signature;
    expRange.innerHTML =
      '<option value="all">All time</option>' +
      '<option value="30">Last 30 days</option>' +
      '<option value="365">Last 12 months</option>' +
      years.map(y => '<option value="year:' + y + '">' + y + '</option>').join('');
    expRange.value = Array.from(expRange.options).some(o => o.value === current) ? current : 'all';
  }

  function expScan() {
    if (!expCount) return;
    expCount.textContent = 'Counting…';
    expSize.textContent  = '—';
    post('lmt_export_scan', expFilters()).then(r => {
      if (!r || !r.success) { expCount.textContent = 'Could not count files'; return; }
      expSyncYears(r.data.years);
      const n = r.data.count;
      expCount.textContent = n.toLocaleString() + (n === 1 ? ' file' : ' files');
      expSize.textContent  = expBigBytes(r.data.bytes);
      if (expBuildBtn) expBuildBtn.disabled = (n === 0);
    }).catch(() => { expCount.textContent = 'Could not count files'; });
  }

  function expScanSoon() {
    clearTimeout(expScanTimer);
    expScanTimer = setTimeout(expScan, 350);
  }

  [expType, expRange, expAttached].forEach(el => el && el.addEventListener('change', expScan));
  expSearch && expSearch.addEventListener('input', expScanSoon);
  document.getElementById('exp-refresh')?.addEventListener('click', expScan);

  /* Explain whichever folder scheme is selected, in plain terms. */
  const EXP_FOLDER_NOTES = {
    parent:  'Files land in a folder named after the page or post they were uploaded to, plus its ID (for example <code>free-hep-b-screening-korean-community-services-8842/</code>). Anything unattached goes in <code>_unattached/</code>.',
    uploads: 'Mirrors the year and month folders from wp-content/uploads, so the archive drops straight into another install.',
    flat:    'Every file sits in the root of the ZIP. Simplest to browse, but no clue where anything belonged.',
    type:    'Sorted into <code>images/</code>, <code>audio/</code>, <code>videos/</code>, <code>documents/</code>, <code>archives/</code> and <code>other/</code>.'
  };
  expFolders && expFolders.addEventListener('change', () => {
    const note = document.getElementById('exp-folders-note');
    if (note) note.innerHTML = EXP_FOLDER_NOTES[expFolders.value] || '';
  });

  /* ── Job list ── */

  function expRenderJobs(jobs) {
    if (!expJobsEl) return;
    if (!jobs.length) {
      expJobsEl.innerHTML = '<div class="lmt-grid-empty">No exports yet. Build one above.</div>';
      return;
    }
    expJobsEl.innerHTML = jobs.map(j => {
      const parts = j.parts.map(p =>
        `<a class="lmt-btn lmt-btn-sm" href="${escHtml(p.url)}">⬇ ${j.parts.length > 1 ? 'Part ' + p.n : 'Download'} <span class="lmt-x-jobmeta" style="margin:0 0 0 6px">${expBigBytes(p.bytes)}</span></a>`
      ).join('');
      const csv = j.csv_url ? `<a class="lmt-btn lmt-btn-sm" href="${escHtml(j.csv_url)}">⬇ CSV</a>` : '';
      const skipped = j.skipped ? ` · ${j.skipped} missing file${j.skipped === 1 ? '' : 's'} skipped` : '';
      return `<div class="lmt-x-job">
        <div class="lmt-x-job-main">
          <span class="lmt-img-status-badge lmt-badge-done">Ready</span>
          <div>
            <div class="lmt-x-fname">${escHtml(j.label)} — ${j.total.toLocaleString()} files</div>
            <div class="lmt-x-jobmeta">${expBigBytes(j.bytes)} · ${j.parts.length} file${j.parts.length === 1 ? '' : 's'} · built ${escHtml(j.created_h)} · expires ${escHtml(j.expires_h)}${skipped}</div>
          </div>
        </div>
        <div class="lmt-x-job-actions">${parts}${csv}
          <button type="button" class="lmt-btn lmt-btn-sm lmt-btn-danger" data-exp-del="${escHtml(j.id)}">Delete</button>
        </div>
      </div>`;
    }).join('');
  }

  function expLoadJobs() {
    if (!expJobsEl) return;
    post('lmt_export_jobs').then(r => {
      if (r && r.success) expRenderJobs(r.data.jobs || []);
    }).catch(() => {});
  }

  expJobsEl && expJobsEl.addEventListener('click', e => {
    const btn = e.target.closest('[data-exp-del]');
    if (!btn) return;
    if (!window.confirm('Delete this export? The ZIP will be removed from the server.')) return;
    btn.disabled = true;
    post('lmt_export_delete', { job: btn.dataset.expDel }).then(expLoadJobs);
  });

  /* ── Build ── */

  function expSetProgress(done, total, bytes) {
    const pct = total ? Math.round((done / total) * 100) : 0;
    expFill.style.width = pct + '%';
    expPct.textContent  = pct + '%';
    expCnt.textContent  = done.toLocaleString() + ' of ' + total.toLocaleString() + ' files · ' + expBigBytes(bytes) + ' written';
  }

  function expFinish(msg, ok) {
    expRunning = false;
    expBuildBtn.disabled = false;
    expStopBtn.style.display = 'none';
    expLabel.textContent = msg;
    expStatus.textContent = ok ? 'Your archive is in Recent exports below.' : 'Keep this tab open while the archive builds.';
    expLoadJobs();
  }

  function expRunBatch(job, total) {
    if (expAborted) { expFinish('Stopped. The partial archive is still listed below.', false); return; }

    post('lmt_export_batch', { job }).then(r => {
      if (!r || !r.success) {
        expFinish('✗ ' + ((r && r.data && r.data.message) || 'The build failed.'), false);
        return;
      }
      const d = r.data;
      expSetProgress(d.done, d.total, d.bytes);
      if (d.parts > 1) expLabel.textContent = 'Packaging files… (part ' + d.parts + ')';

      if (d.complete) {
        expLabel.textContent = 'Writing the manifest…';
        post('lmt_export_finalize', { job }).then(() => {
          expFill.style.width = '100%';
          expPct.textContent = '100%';
          expFinish('✓ Export ready', true);
        });
      } else {
        expRunBatch(job, total);
      }
    }).catch(() => expFinish('✗ The connection dropped mid-build.', false));
  }

  expBuildBtn && expBuildBtn.addEventListener('click', () => {
    if (expRunning) return;
    expRunning = true;
    expAborted = false;
    expBuildBtn.disabled = true;
    expStopBtn.style.display = '';
    expWrap.classList.remove('lmt-hidden');
    expLabel.textContent = 'Gathering files…';
    expSetProgress(0, 1, 0);

    post('lmt_export_start', expFilters()).then(r => {
      if (!r || !r.success) {
        expFinish('✗ ' + ((r && r.data && r.data.message) || 'Could not start the export.'), false);
        return;
      }
      expLabel.textContent = 'Packaging files…';
      expSetProgress(0, r.data.total, 0);
      expRunBatch(r.data.job, r.data.total);
    }).catch(() => expFinish('✗ Could not start the export.', false));
  });

  expStopBtn && expStopBtn.addEventListener('click', () => {
    expAborted = true;
    expStopBtn.disabled = true;
    expLabel.textContent = 'Finishing the current batch…';
    setTimeout(() => { expStopBtn.disabled = false; }, 1500);
  });

  /* ══════════════════════════════════════════════════════
     TAB 5 — IMPORT  (v3.19.0)
     Any media type into the Media Library. Images are resized and
     re-encoded in the browser (reusing the Image Resizer pipeline);
     everything else is sent untouched.
  ══════════════════════════════════════════════════════ */

  const impDrop     = document.getElementById('imp-drop');
  const impInput    = document.getElementById('imp-input');
  const impQueueEl  = document.getElementById('imp-queue');
  const impRunBtn   = document.getElementById('imp-run-btn');
  const impClearBtn = document.getElementById('imp-clear-btn');
  const impStopBtn  = document.getElementById('imp-stop-btn');
  const impStatus   = document.getElementById('imp-status');
  const impWrap     = document.getElementById('imp-progress-wrap');
  const impFill     = document.getElementById('imp-progress-fill');
  const impPct      = document.getElementById('imp-progress-pct');
  const impCnt      = document.getElementById('imp-progress-count');
  const impLabel    = document.getElementById('imp-progress-label');
  const impImgMode  = document.getElementById('imp-img-mode');
  const impImgSize  = document.getElementById('imp-img-size');
  const impImgFmt   = document.getElementById('imp-img-fmt');
  const impQuality  = document.getElementById('imp-img-quality');
  const impQualBub  = document.getElementById('imp-img-quality-bubble');

  let impQueue   = [];
  let impCaps    = null;
  let impRunning = false;
  let impAborted = false;

  const IMP_DOC_EXT = /\.(pdf|docx?|xlsx?|pptx?|odt|ods|rtf|txt|csv|epub)$/i;
  const IMP_ZIP_EXT = /\.(zip|rar|7z|gz|tar)$/i;

  function impKind(file) {
    const t = (file.type || '').split('/')[0];
    if (t === 'image') return 'image';
    if (t === 'video') return 'video';
    if (t === 'audio') return 'audio';
    if (file.type === 'application/pdf') return 'pdf';
    if (IMP_DOC_EXT.test(file.name)) return 'document';
    if (IMP_ZIP_EXT.test(file.name)) return 'archive';
    return 'other';
  }

  function impBadge(kind, name) {
    const ext = (name.split('.').pop() || '?').toUpperCase().slice(0, 4);
    return ext;
  }

  /* ── Server capabilities ── */

  function impLoadCaps() {
    post('lmt_import_caps').then(r => {
      if (!r || !r.success) return;
      impCaps = r.data;
      const limits = document.getElementById('imp-limits');
      if (limits) limits.textContent =
        'Images · video · audio · PDF · Office docs · archives — max ' + impCaps.max_upload_h + ' per file';
    }).catch(() => {});
  }

  /* ── Queue ── */

  function impRenderQueue() {
    if (!impQueueEl) return;

    const title = document.getElementById('imp-queue-title');
    if (title) title.textContent = impQueue.length ? 'Queue — ' + impQueue.length + ' file' + (impQueue.length === 1 ? '' : 's') : 'Queue';

    if (!impQueue.length) {
      impQueueEl.innerHTML = '<div class="lmt-grid-empty">Nothing queued. Drop files above to get started.</div>';
      impRunBtn.disabled = true;
      impClearBtn.disabled = true;
      impStatus.textContent = 'No files chosen yet.';
      return;
    }

    impRunBtn.disabled = impRunning;
    impClearBtn.disabled = impRunning;

    impQueueEl.innerHTML = impQueue.map((item, i) => {
      let badgeClass = 'lmt-badge-no-alt';
      let statusText = 'Waiting';
      if (item.status === 'done')    { badgeClass = 'lmt-badge-done';  statusText = 'Imported'; }
      if (item.status === 'error')   { badgeClass = 'lmt-badge-error'; statusText = 'Failed'; }
      if (item.status === 'working') { badgeClass = 'lmt-badge-has-alt'; statusText = 'Working'; }
      if (item.status === 'toobig')  { badgeClass = 'lmt-badge-error'; statusText = 'Too large'; }

      let meta = expBigBytes(item.file.size);
      if (item.status === 'done' && item.after && item.after < item.before) {
        const pct = Math.round((1 - item.after / item.before) * 100);
        meta = expBigBytes(item.before) + ' → ' + expBigBytes(item.after) + ' · ' + pct + '% smaller';
      } else if (item.status === 'done') {
        meta = expBigBytes(item.after || item.file.size);
      }
      if (item.note) meta += ' · ' + escHtml(item.note);

      const link = item.edit ? '<a class="lmt-btn lmt-btn-sm" href="' + escHtml(item.edit) + '">Open</a>' : '';
      const remove = impRunning ? '' : '<button type="button" class="lmt-btn lmt-btn-sm" data-imp-del="' + i + '">Remove</button>';

      return '<div class="lmt-x-job">' +
        '<div class="lmt-x-job-main">' +
          '<span class="lmt-img-status-badge ' + badgeClass + '">' + statusText + '</span>' +
          '<span class="lmt-x-ftype">' + escHtml(impBadge(item.kind, item.file.name)) + '</span>' +
          '<div><div class="lmt-x-fname">' + escHtml(item.file.name) + '</div>' +
          '<div class="lmt-x-jobmeta">' + meta + '</div></div>' +
        '</div>' +
        '<div class="lmt-x-job-actions">' + link + remove + '</div>' +
      '</div>';
    }).join('');
  }

  function impAddFiles(files) {
    const max = impCaps ? impCaps.max_upload : 0;
    Array.from(files).forEach(file => {
      const kind = impKind(file);
      // Images are shrunk client-side, so judge them on the compressed size later.
      const tooBig = max && file.size > max && kind !== 'image';
      impQueue.push({
        file, kind,
        status: tooBig ? 'toobig' : 'queued',
        note: tooBig ? 'Over this server\u2019s ' + impCaps.max_upload_h + ' upload limit' : '',
        before: file.size, after: 0, edit: ''
      });
    });
    impRenderQueue();
    const ready = impQueue.filter(i => i.status === 'queued').length;
    impStatus.textContent = ready + ' file' + (ready === 1 ? '' : 's') + ' ready to import.';
  }

  // The file input is an invisible overlay on the dropzone (same pattern as the
  // Image Resizer), so a click anywhere in the zone opens the picker natively.
  impInput && impInput.addEventListener('change', () => {
    impAddFiles(impInput.files);
    impInput.value = '';
  });
  impDrop && impDrop.addEventListener('dragover', e => { e.preventDefault(); impDrop.classList.add('lmt-dragover'); });
  impDrop && impDrop.addEventListener('dragleave', () => impDrop.classList.remove('lmt-dragover'));
  impDrop && impDrop.addEventListener('drop', e => {
    e.preventDefault();
    impDrop.classList.remove('lmt-dragover');
    if (e.dataTransfer && e.dataTransfer.files.length) impAddFiles(e.dataTransfer.files);
  });

  impQueueEl && impQueueEl.addEventListener('click', e => {
    const btn = e.target.closest('[data-imp-del]');
    if (!btn || impRunning) return;
    impQueue.splice(parseInt(btn.dataset.impDel, 10), 1);
    impRenderQueue();
  });

  impClearBtn && impClearBtn.addEventListener('click', () => {
    if (impRunning) return;
    impQueue = [];
    impRenderQueue();
  });

  impQuality && impQuality.addEventListener('input', () => {
    if (impQualBub) impQualBub.textContent = impQuality.value;
  });

  function impSyncImageControls() {
    const on = impImgMode && impImgMode.value === 'compress';
    [impImgSize, impImgFmt, impQuality].forEach(el => { if (el) el.disabled = !on; });
    const row = document.getElementById('imp-img-quality-row');
    if (row) row.style.opacity = on ? '1' : '0.45';
  }
  impImgMode && impImgMode.addEventListener('change', impSyncImageControls);

  /* ── Prepare one file for upload ── */

  async function impPrepare(item) {
    if (item.kind !== 'image' || !impImgMode || impImgMode.value !== 'compress') {
      return { blob: item.file, name: item.file.name };
    }

    const target = parseInt(impImgSize.value, 10) || 0;
    const fmtSel = impImgFmt.value;
    const q      = parseInt(impQuality.value, 10) || 82;

    // Keep original format unless asked otherwise; anything canvas can't
    // re-encode (SVG, TIFF, HEIC) goes through untouched.
    let fmt = fmtSel;
    if (fmt === 'KEEP') {
      if (item.file.type === 'image/png')  fmt = 'PNG';
      else if (item.file.type === 'image/webp') fmt = 'WEBP';
      else if (item.file.type === 'image/jpeg') fmt = 'JPEG';
      else return { blob: item.file, name: item.file.name };
    }

    try {
      const bitmap = await createImageBitmap(item.file);
      const longest = Math.max(bitmap.width, bitmap.height);
      // computeDims scales up as happily as down, so never ask it to enlarge.
      const useTarget = (target && longest > target) ? target : longest;
      const { canvas } = await renderToCanvas(item.file, useTarget);
      const blob = await canvasToBlob(canvas, fmt, q);
      if (!blob) return { blob: item.file, name: item.file.name };

      // A re-encode that makes the file bigger is not worth having.
      if (blob.size >= item.file.size && fmtSel === 'KEEP' && useTarget === longest) {
        return { blob: item.file, name: item.file.name };
      }

      const ext  = fmt === 'PNG' ? 'png' : fmt === 'JPEG' ? 'jpg' : 'webp';
      const base = item.file.name.replace(/\.[^.]+$/, '');
      return { blob, name: base + '.' + ext };
    } catch (err) {
      return { blob: item.file, name: item.file.name };
    }
  }

  /* ── Run ── */

  function impFinish(msg) {
    impRunning = false;
    impStopBtn.style.display = 'none';
    impLabel.textContent = msg;
    impRenderQueue();
  }

  async function impRun() {
    const pending = impQueue.filter(i => i.status === 'queued');
    if (!pending.length || impRunning) return;

    impRunning = true;
    impAborted = false;
    impRunBtn.disabled = true;
    impClearBtn.disabled = true;
    impStopBtn.style.display = '';
    impWrap.classList.remove('lmt-hidden');
    impStatus.textContent = 'Importing…';

    let done = 0;
    const total = pending.length;

    for (const item of pending) {
      if (impAborted) break;

      item.status = 'working';
      impRenderQueue();
      impLabel.textContent = 'Uploading ' + item.file.name;

      try {
        const prepared = await impPrepare(item);

        const fd = new FormData();
        fd.append('action', 'lmt_import_upload');
        fd.append('nonce', NONCE);
        fd.append('file', prepared.blob, prepared.name);

        const res  = await fetch(AJAX, { method: 'POST', body: fd, credentials: 'same-origin' });
        const data = await res.json();

        if (!data || !data.success) throw new Error((data && data.data && data.data.message) || 'Upload failed');

        item.status = 'done';
        item.before = item.file.size;
        item.after  = data.data.size || prepared.blob.size;
        item.edit   = data.data.edit || '';
      } catch (err) {
        item.status = 'error';
        item.note   = err.message || 'Upload failed';
      }

      done++;
      const pct = Math.round((done / total) * 100);
      impFill.style.width = pct + '%';
      impPct.textContent  = pct + '%';
      impCnt.textContent  = done + ' of ' + total + ' files';
      impRenderQueue();
    }

    const ok     = impQueue.filter(i => i.status === 'done').length;
    const failed = impQueue.filter(i => i.status === 'error').length;
    impStatus.textContent = ok + ' imported' + (failed ? ', ' + failed + ' failed' : '') + '.';
    impFinish(impAborted ? 'Stopped.' : '✓ Import complete');
  }

  impRunBtn && impRunBtn.addEventListener('click', impRun);
  impStopBtn && impStopBtn.addEventListener('click', () => {
    impAborted = true;
    impLabel.textContent = 'Finishing the current file…';
  });

  /* ── Init — v3.10.0 ──
     v3.20.0: the attachment page (?view=attachment) is served from the
     same menu slug, so this file loads there too. Skip the library
     bootstrap when the tool panels aren't on the page — otherwise every
     attachment view fires four pointless AJAX calls and then trips over
     stat elements that don't exist. */
  if (document.getElementById('lmt-panel-alt')) {
    initViewControls('mlr',   mlrLoadImages);
    initViewControls('alt',   loadAltPage);
    initViewControls('title', loadTitlePage);

    /* v3.23.0 — open each tool where it was left. A ?paged= in the URL
       (set by an image page's Back link) wins over the stored page, and
       only applies to the tab that link came from. */
    const returnedTo   = lmtActiveTabName();
    const returnedPage = window.LMTReturn.paged;
    const startPage = function (tool) {
      // v3.36.0 — a filtered deep link always starts at page 1; the remembered
      // page belongs to a different, usually larger, result set.
      if (window.LMTDeepFilter && window.LMTDeepFilter.tab === tool) return 1;
      if (returnedPage > 1 && returnedTo === tool) return returnedPage;
      return window.LMTPages.recall(tool);
    };

    loadAltStats();
    loadAltPage(startPage('alt'));
    loadTitleStats();
    loadTitlePage(startPage('title'));

    expScan();
    expLoadJobs();
  }

})();

/* ══════════════════════════════════════════════════════
   v3.20.0 — RAIL COLLAPSE
   Remembered per browser. Falls through silently in
   private mode where localStorage throws.
   ══════════════════════════════════════════════════════ */
(function () {
  const KEY   = 'lmt_rail_collapsed';
  const shell = document.querySelector('.lmt-shell');
  const btn   = document.getElementById('lmt-rail-collapse');
  if (!shell) return;

  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) { /* private mode */ }
  if (saved === '1') shell.classList.add('is-collapsed');

  function sync() {
    const on = shell.classList.contains('is-collapsed');
    if (btn) {
      btn.setAttribute('aria-label', on ? 'Expand navigation' : 'Collapse navigation');
      btn.title = on ? 'Expand navigation' : 'Collapse navigation';
    }
    // Collapsed rail hides labels, so the icon needs the name.
    shell.querySelectorAll('.lmt-rail .lmt-tab').forEach(tab => {
      const label = tab.querySelector('.lmt-tab-label');
      if (label) tab.title = on ? label.textContent.trim() : '';
    });
  }
  sync();

  btn?.addEventListener('click', () => {
    shell.classList.toggle('is-collapsed');
    try { localStorage.setItem(KEY, shell.classList.contains('is-collapsed') ? '1' : '0'); } catch (e) { /* private mode */ }
    sync();
  });
})();

/* ══════════════════════════════════════════════════════
   v3.20.0 — ATTACHMENT PAGE
   Only runs on ?view=attachment. The markup is rendered
   server-side; this adds save, per-field AI and copy URL.
   ══════════════════════════════════════════════════════ */
(function () {
  const root = document.getElementById('lmt-att-root');
  if (!root) return;

  const id     = parseInt(root.dataset.id, 10);
  const status = document.getElementById('lmt-att-status');
  const fields = ['title', 'alt', 'caption', 'description'];

  function el(f) { return document.getElementById('lmt-att-' + f); }

  function say(msg, tone) {
    if (!status) return;
    status.textContent = msg;
    status.style.color = tone === 'bad' ? 'var(--red)' : (tone === 'ok' ? 'var(--green)' : 'var(--text-3)');
  }

  function req(action, data) {
    const body = new URLSearchParams(Object.assign({ action, nonce: window.LMT.nonce }, data));
    return fetch(window.LMT.ajax, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    }).then(r => r.json());
  }

  /* ── Save all four fields in one request ── */
  document.getElementById('lmt-att-save')?.addEventListener('click', async function () {
    const payload = { id };
    fields.forEach(f => { const n = el(f); if (n) payload[f] = n.value; });

    this.disabled = true;
    say('Saving…');
    try {
      const res = await req('lmt_alt_save', payload);
      if (res.success) {
        say('✓ Saved', 'ok');
        setTimeout(() => say(''), 2500);
      } else {
        say('✗ ' + (res.data || 'Save failed'), 'bad');
      }
    } catch (e) {
      say('✗ ' + e.message, 'bad');
    } finally {
      this.disabled = false;
    }
  });

  /* ── Per-field AI. Alt and title reuse the existing endpoints so
       their prompts stay in one place; caption and description use
       the v3.20.0 endpoint. Nothing is saved until you press Save. ── */
  async function generate(field, targetId, btn) {
    const target = document.getElementById(targetId);
    if (!target) return;
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = '✦ Generating…';
    say('Asking the AI platform…');

    let action = 'lmt_meta_generate', body = { id, field };
    if (field === 'alt')   { action = 'lmt_ai_alt_generate';   body = { id }; }
    if (field === 'title') { action = 'lmt_ai_title_generate'; body = { id }; }

    try {
      const res = await req(action, body);
      if (res.success) {
        target.value = res.data.text || res.data.alt || res.data.title || '';
        target.focus();
        say('Generated. Review it, then save.', 'ok');
      } else {
        say('✗ ' + (res.data || 'AI generation failed'), 'bad');
      }
    } catch (e) {
      say('✗ ' + e.message, 'bad');
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  }

  root.querySelectorAll('.lmt-att-ai').forEach(btn => {
    btn.addEventListener('click', () => generate(btn.dataset.field, btn.dataset.target, btn));
  });

  /* ── Fill every empty field, one call at a time so a failure
       part-way through still leaves the earlier results on screen. ── */
  document.getElementById('lmt-att-fill')?.addEventListener('click', async function () {
    const todo = [];
    root.querySelectorAll('.lmt-att-ai').forEach(btn => {
      const t = document.getElementById(btn.dataset.target);
      if (t && t.value.trim() === '') todo.push(btn);
    });
    if (!todo.length) { say('Nothing empty to fill.'); return; }

    this.disabled = true;
    for (const btn of todo) {
      await generate(btn.dataset.field, btn.dataset.target, btn);
    }
    this.disabled = false;
    say('Filled ' + todo.length + ' field(s). Review, then save.', 'ok');
  });

  /* ── Copy URL ── */
  document.getElementById('lmt-att-copy')?.addEventListener('click', function () {
    const url = this.dataset.url || '';
    const done = () => { const t = this.textContent; this.textContent = '✓ Copied'; setTimeout(() => { this.textContent = t; }, 1600); };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(() => say('Could not copy. Select the URL manually.', 'bad'));
    } else {
      say('Clipboard unavailable in this browser.', 'bad');
    }
  });
})();

/* ══════════════════════════════════════════════════════
   v3.21.0 — SETTINGS PANEL
   The Test Connection button moved out of an inline script
   on the old options screen and into the enqueued bundle.
   ══════════════════════════════════════════════════════ */
(function () {
  const btn = document.getElementById('lmt-test-btn');
  const out = document.getElementById('lmt-test-result');
  if (!btn || !out) return;

  btn.addEventListener('click', function () {
    btn.disabled = true;
    out.className = 'lmt-test-pending';
    out.textContent = 'Testing…';

    const body = new URLSearchParams({ action: 'lmt_ai_test', nonce: window.LMT.nonce });
    fetch(window.LMT.ajax, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          out.className = 'lmt-test-ok';
          out.textContent = `✓ Connected (${res.data.ms} ms) — reply: "${res.data.reply}"`;
        } else {
          out.className = 'lmt-test-bad';
          out.textContent = '✗ ' + (res.data || 'Failed');
        }
      })
      .catch(err => {
        out.className = 'lmt-test-bad';
        out.textContent = '✗ ' + err.message;
      })
      .finally(() => { btn.disabled = false; });
  });

  // Nudge the rail when there's no endpoint yet, so a fresh install has
  // an obvious next step rather than silently disabled AI buttons.
  const badge = document.getElementById('lmt-rail-ct-settings');
  if (badge && window.LMT && window.LMT.has_key === false) {
    badge.hidden = false;
    badge.title = 'No Lookit AI endpoint set yet';
  }

  // Saved confirmation fades out rather than lingering.
  const saved = document.getElementById('lmt-settings-saved');
  if (saved) setTimeout(() => { saved.style.transition = 'opacity .4s'; saved.style.opacity = '0'; }, 3500);
})();
