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

  /* Cross-tab "needs attention" chip row. Shows warnings for missing alt /
     auto title, and an image-usage count, so every grid reads as a worklist. */
  function attentionChips(img, opts) {
    opts = opts || {};
    const chips = [];
    if (!opts.skipAlt   && img.has_alt === false) chips.push('<span class="lmt-chip lmt-chip-warn">⚠ No alt</span>');
    if (!opts.skipTitle && img.is_auto === true)  chips.push('<span class="lmt-chip lmt-chip-warn">⚠ Auto title</span>');
    if (typeof img.used === 'number') {
      chips.push(img.used > 0
        ? `<span class="lmt-chip lmt-chip-use lmt-chip-clickable" onclick="window.lmtShowUsage(${img.id})" title="See where this image is used">📄 Used in ${img.used}</span>`
        : `<span class="lmt-chip lmt-chip-muted" title="Not embedded in any post or page">Unused</span>`);
    }
    return chips.length ? `<div class="lmt-chips">${chips.join('')}</div>` : '';
  }

  /* Rough resize savings estimate. File size for photos scales ~with pixel
     count, so we scale by the area ratio. Labelled "~" — it's an estimate.
     We show only the savings at the target size (not before/after file sizes). */
  function resizeEstimate(img, target) {
    const longest = Math.max(img.width || 0, img.height || 0);
    if (!longest || !img.filesize) return null;
    if (!target || longest <= target) {
      return { changed: false, saved: 0, text: `No change — already ≤ ${target || '—'}px` };
    }
    const ratio    = (target / longest) * (target / longest);
    const estBytes = Math.round(img.filesize * ratio);
    const saved    = Math.max(0, img.filesize - estBytes);
    return {
      changed: true,
      saved,
      text: `↓ Save ~${formatBytes(saved)} at ${target}px`
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

  const tabs    = document.querySelectorAll('.lmt-tab');
  const panels  = document.querySelectorAll('.lmt-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const panelId = 'lmt-panel-' + tab.dataset.tab;
      document.getElementById(panelId)?.classList.add('active');
    });
  });

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
  document.getElementById('mlr-btn-upload-view')?.addEventListener('click', () => showUploadView(true));
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
    function applySize() {
      if (!wrap || !sizeSld) return;
      wrap.style.setProperty('--lmt-card-min', sizeSld.value + 'px');
      localStorage.setItem('lmt_size_' + prefix, sizeSld.value);
    }

    setView(localStorage.getItem('lmt_view_' + prefix) || 'grid');
    const savedSize = localStorage.getItem('lmt_size_' + prefix);
    if (savedSize && sizeSld) sizeSld.value = savedSize;
    applySize();

    gridBtn?.addEventListener('click', () => setView('grid'));
    listBtn?.addEventListener('click', () => setView('list'));
    sizeSld?.addEventListener('input', applySize);
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
    if (!checked) return 1200;
    if (checked.value==='custom') { const v=parseInt(document.getElementById('mlr-custom-px')?.value,10); return (v>=16&&v<=8000)?v:1200; }
    return parseInt(checked.value,10);
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
    const longest = Math.max(img.width || 0, img.height || 0);
    const est  = resizeEstimate(img, getMlrSize());
    const estClass = est && est.changed ? ' lmt-est-save' : '';
    return `
        <div class="lmt-img-card${img.has_backup ? ' lmt-card-done' : ''}" id="mlr-card-${img.id}">
          <div class="lmt-img-thumb-wrap">
            <input type="checkbox" class="lmt-img-select" id="mlr-chk-${img.id}" data-id="${img.id}" onchange="window.mlrToggleSelect(${img.id},this.checked)">
            ${img.thumb ? `<img class="lmt-img-thumb" src="${escHtml(img.thumb)}" alt="" loading="lazy">` : '<div class="lmt-img-thumb" style="background:var(--s3)"></div>'}
          </div>
          <div class="lmt-img-body">
            <div class="lmt-img-filename" title="${escHtml(img.filename)}">${escHtml(img.filename)}</div>
            <div class="lmt-img-dims" id="mlr-dims-${img.id}">${size} &nbsp;·&nbsp; ${fs}</div>
            ${attentionChips(img)}
            <div class="lmt-resize-est${estClass}" id="mlr-est-${img.id}" data-bytes="${img.filesize || 0}" data-longest="${longest}">${est ? escHtml(est.text) : ''}</div>
            ${img.has_backup ? `<button class="lmt-restore-btn" onclick="window.mlrRestore(${img.id})">↩ Restore Original</button>` : ''}
          </div>
        </div>`;
  }

  /* Recompute per-card resize estimates + the selection total. Called on
     render, target change, and selection change. */
  function updateResizeEstimates() {
    const target = getMlrSize();
    let selBytes = 0, selSaved = 0, selCount = 0;
    document.querySelectorAll('.lmt-resize-est').forEach(el => {
      const bytes   = parseInt(el.dataset.bytes, 10) || 0;
      const longest = parseInt(el.dataset.longest, 10) || 0;
      const est = resizeEstimate({ width: longest, height: 0, filesize: bytes }, target);
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
  }

  async function mlrLoadImages(page=1, append=false) {
    mlrPage = page;
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

    renderLoadMore('mlr-loadmore', mlrPage, mlrTotalPages, mlrLoaded, d.total, n => mlrLoadImages(n, true));
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
  if (document.getElementById('mlr-grid-wrap')) mlrLoadImages(1);
  ['mlr-sort','mlr-type'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => { if (document.getElementById('mlr-grid')) mlrLoadImages(1); });
  });

  document.querySelectorAll('input[name="mlr_size"]').forEach(r => {
    r.addEventListener('change', () => { const cpx=document.getElementById('mlr-custom-px'); if(cpx) cpx.disabled=(r.value!=='custom'); updateResizeEstimates(); });
  });
  document.getElementById('mlr-custom-px')?.addEventListener('input', updateResizeEstimates);

  document.getElementById('mlr-quality')?.addEventListener('input', function() {
    const b = document.getElementById('mlr-quality-bubble');
    const v = document.getElementById('mlr-quality-val');
    if(b) b.textContent = this.value;
    if(v) v.textContent = this.value;
  });

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
  }
  mlrOutFmt?.addEventListener('change', syncMlrOutput);
  syncMlrOutput();

  /* ── Saved custom sizes (named, reorderable, stored per browser) ── */
  const SAVED_SIZES_KEY = 'lmt_saved_sizes';
  function getSavedSizes() {
    try { return JSON.parse(localStorage.getItem(SAVED_SIZES_KEY) || '[]'); } catch(_) { return []; }
  }
  function setSavedSizes(arr) { localStorage.setItem(SAVED_SIZES_KEY, JSON.stringify(arr)); }

  function renderSavedSizes() {
    const wrap = document.getElementById('mlr-saved-sizes');
    if (!wrap) return;
    const sizes = getSavedSizes();
    wrap.innerHTML = sizes.map((s, i) => `
      <label class="lmt-saved-row" draggable="true" data-idx="${i}">
        <span class="lmt-saved-handle" title="Drag to reorder">⠿</span>
        <input type="radio" name="mlr_size" value="${s.px}">
        <span>${escHtml(s.name)}</span>
        <em>${s.px}px</em>
        <button type="button" class="lmt-saved-del" data-idx="${i}" title="Remove this size" aria-label="Remove">&times;</button>
      </label>`).join('');

    wrap.querySelectorAll('input[name="mlr_size"]').forEach(r => {
      r.addEventListener('change', () => {
        const cpx = document.getElementById('mlr-custom-px'); if (cpx) cpx.disabled = true;
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
    const name = (nameEl?.value || '').trim();
    const px   = parseInt(pxEl?.value, 10);
    if (!name) { alert('Give the size a name first.'); return; }
    if (!(px >= 16 && px <= 8000)) { alert('Enter a pixel size between 16 and 8000.'); return; }
    const arr = getSavedSizes();
    arr.push({ name, px });
    setSavedSizes(arr);
    if (nameEl) nameEl.value = '';
    if (pxEl)   pxEl.value = '';
    renderSavedSizes();
  });
  renderSavedSizes();

  // Bulk resize
  mlrBulkBtn?.addEventListener('click', async function() {
    if (mlrRunning || mlrSelected.size===0) return;
    const ids     = [...mlrSelected];
    const target  = getMlrSize();
    const quality = parseInt(document.getElementById('mlr-quality')?.value||'82',10);
    const backup  = document.getElementById('mlr-backup')?.checked ? '1' : '0';
    const outFmt  = document.getElementById('mlr-output-fmt')?.value || 'keep';
    const toWebp  = outFmt === 'webp';

    const confirmMsg = toWebp
      ? `Create a WebP copy of ${ids.length} image(s) at up to ${target}px?\n\nThis adds a new .webp file to your media library for each one. The originals are left unchanged.`
      : `Resize ${ids.length} image(s) to ${target}px longest edge?\n\nThis overwrites files on the server. ${backup==='1'?'Originals will be backed up.':'NO BACKUP will be made.'}`;
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

        const longest = Math.max(bitmap.width, bitmap.height);
        if (!toWebp && longest <= target) {
          // Keep-format mode: already small enough — skip without error
          const dimsEl = document.getElementById(`mlr-dims-${id}`);
          if(dimsEl) dimsEl.textContent += ' (skipped — already small)';
          done++; setP(); continue;
        }

        // WebP mode never upscales: if it's already ≤ target, keep original dims and just convert.
        const dims = (longest > target)
          ? computeDims(bitmap.width, bitmap.height, target)
          : { w: bitmap.width, h: bitmap.height };
        const nw = dims.w, nh = dims.h;
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
          ? await post('lmt_mlr_save_webp', { id, data: outDataUri })
          : await post('lmt_mlr_save', { id, data: outDataUri, backup });

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
      document.getElementById('alt-stat-total').textContent  = d.total;
      document.getElementById('alt-stat-has').textContent    = d.has_alt;
      document.getElementById('alt-stat-missing').textContent= d.missing;
      const hasPct = Math.round((d.has_alt/total)*100);
      const misPct = Math.round((d.missing/total)*100);
      if(document.getElementById('alt-bar-has'))     document.getElementById('alt-bar-has').style.width=hasPct+'%';
      if(document.getElementById('alt-bar-missing')) document.getElementById('alt-bar-missing').style.width=misPct+'%';
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
            ${img.thumb?`<img class="lmt-img-thumb" src="${escHtml(img.thumb)}" alt="" loading="lazy">`:'<div class="lmt-img-thumb" style="background:var(--s3)"></div>'}
          </div>
          <div class="lmt-img-body">
            <div class="lmt-img-filename" title="${escHtml(img.filename)}">${escHtml(img.filename)}</div>
            ${dims?`<div class="lmt-img-dims">${dims}</div>`:''}
            ${attentionChips(img, {skipAlt:true})}
            <div class="lmt-alt-row">
              <textarea class="lmt-alt-input" id="alt-inp-${img.id}" placeholder="Enter alt text…">${escHtml(img.alt||'')}</textarea>
              <button class="lmt-save-btn" onclick="window.saveAlt(${img.id})">Save</button>
            </div>
            <button class="lmt-ai-btn" id="alt-ai-btn-${img.id}" onclick="window.generateAiAlt(${img.id})" title="Generate alt text with AI (AWS Bedrock)">
              ✨ AI Generate
            </button>
            <div class="lmt-ai-result lmt-hidden" id="alt-ai-result-${img.id}"></div>
          </div>
        </div>`;
  }

  function loadAltPage(page=1, append=false) {
    altPage=page;
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

      renderLoadMore('alt-loadmore', altPage, altTotalPages, altLoaded, d.total, n=>loadAltPage(n, true));
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
      if (btn) { btn.textContent = '✨ AI Generate'; btn.disabled = false; }
    } catch(err) {
      if (result) { result.classList.remove('lmt-hidden'); result.className='lmt-ai-result lmt-ai-result-error'; result.textContent='✗ ' + err.message; }
      if (btn) { btn.textContent = '✨ AI Generate'; btn.disabled = false; }
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
    post('lmt_alt_save',{id,alt:val}).then(res=>{
      if(!res.success){alert('Save failed');return;}
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
      try {
        const res = await post('lmt_alt_save', { id, alt: val });
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

  document.getElementById('alt-filter')?.addEventListener('change', ()=>loadAltPage(1));
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
            ${img.thumb?`<img class="lmt-img-thumb" src="${escHtml(img.thumb)}" alt="" loading="lazy">`:'<div class="lmt-img-thumb" style="background:var(--s3)"></div>'}
          </div>
          <div class="lmt-img-body">
            <div class="lmt-img-filename" title="${escHtml(img.filename)}">${escHtml(img.filename)}</div>
            ${dims?`<div class="lmt-img-dims">${dims}</div>`:''}
            ${attentionChips(img, {skipTitle:true})}
            <div class="lmt-alt-row">
              <textarea class="lmt-alt-input" id="title-inp-${img.id}" placeholder="Enter image title…" style="min-height:38px">${escHtml(img.title||'')}</textarea>
              <button class="lmt-save-btn" onclick="window.saveTitle(${img.id})">Save</button>
            </div>
            <button class="lmt-ai-btn" id="title-ai-btn-${img.id}" onclick="window.generateAiTitle(${img.id})" title="Generate a title with AI (AWS Bedrock)">
              ✨ AI Generate
            </button>
            <div class="lmt-ai-result lmt-hidden" id="title-ai-result-${img.id}"></div>
          </div>
        </div>`;
  }

  function loadTitlePage(page = 1, append = false) {
    titlePage = page;
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

      renderLoadMore('title-loadmore', titlePage, titleTotalPages, titleLoaded, d.total, n => loadTitlePage(n, true));
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
      if (btn) { btn.textContent = '✨ AI Generate'; btn.disabled = false; }
    } catch(err) {
      if (result) { result.classList.remove('lmt-hidden'); result.className = 'lmt-ai-result lmt-ai-result-error'; result.textContent = '✗ ' + err.message; }
      if (btn) { btn.textContent = '✨ AI Generate'; btn.disabled = false; }
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

  document.getElementById('title-filter')?.addEventListener('change', () => loadTitlePage(1));
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

  /* ── Init — v3.10.0 ── */
  initViewControls('mlr',   mlrLoadImages);
  initViewControls('alt',   loadAltPage);
  initViewControls('title', loadTitlePage);

  loadAltStats();
  loadAltPage(1);
  loadTitleStats();
  loadTitlePage(1);

})();
