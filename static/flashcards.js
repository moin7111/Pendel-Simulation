(function(){
  const DEFAULT_FONT_PX = 28;
  const STORAGE_KEY = 'flashcards_state_v1';

  const state = {
    columns: ["A", "B"],
    rows: [], // {id, colA, colB, cols?}
    selectedIds: new Set(),
    history: {
      past: [],
      future: [],
    },
    drag: {
      draggingId: null,
    },
    settings: {
      // Core card metrics (fixed defaults)
      widthMm: 85,
      heightMm: 55,
      marginMm: 6,
      // Text & style
      align: 'center', // left | center | right
      fontPx: DEFAULT_FONT_PX,
      bgColor: '#ffffff',
      borderEnabled: true,
      borderColor: '#334155',
      // Data mapping
      hasHeader: false,
      colAKey: 0,
      colBKey: 1,
      // Export
      exportFormat: 'pdf', // pdf | png | jpg
      exportSide: 'both', // front | back | both
      cardsPerPage: 4, // 1,2,4,6,8
      paperSize: 'A4', // A4 | A6
      filenameTpl: 'karte_{index}_{front}',
      // N-up / Print controls
      flipEdge: 'long', // long | short
      backRotation: 'auto', // auto | 0 | 180
      pageMarginMm: 12,
      gapMm: 6,
      backOffsetXMm: 0,
      backOffsetYMm: 0,
      showMarks: true,
      imageExportMode: 'pages', // pages | cards
      // Backgrounds
      bgFrontDataUrl: null,
      bgBackDataUrl: null,
      bgMode: 'cover', // cover | contain
    }
  };

  const els = {
    gridBody: document.getElementById('gridBody'),
    selectAll: document.getElementById('selectAll'),
    rowCount: document.getElementById('rowCount'),
    validation: document.getElementById('validation'),
    addRow: document.getElementById('addRow'),
    duplicateRows: document.getElementById('duplicateRows'),
    deleteRows: document.getElementById('deleteRows'),
    undo: document.getElementById('undo'),
    redo: document.getElementById('redo'),
    fileInput: document.getElementById('fileInput'),
    hasHeader: document.getElementById('hasHeader'),
    colA: document.getElementById('colA'),
    colB: document.getElementById('colB'),
    // style controls
    alignToggle: document.getElementById('alignToggle'),
    fontPx: document.getElementById('fontPx'),
    bgColor: document.getElementById('bgColor'),
    borderEnabled: document.getElementById('borderEnabled'),
    borderColor: document.getElementById('borderColor'),
    previewFront: document.getElementById('previewFront'),
    previewBack: document.getElementById('previewBack'),
    // backgrounds & position
    bgFront: document.getElementById('bgFront'),
    bgBack: document.getElementById('bgBack'),
    bgFrontClear: document.getElementById('bgFrontClear'),
    bgBackClear: document.getElementById('bgBackClear'),
    bgMode: document.getElementById('bgMode'),
    // export controls
    exportFormat: document.getElementById('exportFormat'),
    exportSide: document.getElementById('exportSide'),
    cardsPerPage: document.getElementById('cardsPerPage'),
    paperSize: document.getElementById('paperSize'),
    flipEdge: document.getElementById('flipEdge'),
    backRotation: document.getElementById('backRotation'),
    pageMarginMm: document.getElementById('pageMarginMm'),
    gapMm: document.getElementById('gapMm'),
    backOffsetXMm: document.getElementById('backOffsetXMm'),
    backOffsetYMm: document.getElementById('backOffsetYMm'),
    showMarks: document.getElementById('showMarks'),
    imageExportMode: document.getElementById('imageExportMode'),
    downloadBtn: document.getElementById('downloadBtn'),
    filenameTpl: document.getElementById('filenameTpl'),
    // Tabs and panels
    tabKarte: document.getElementById('tabKarte'),
    tabExport: document.getElementById('tabExport'),
    tabPreview: document.getElementById('tabPreview'),
    panelKarte: document.getElementById('panelKarte'),
    panelExport: document.getElementById('panelExport'),
    panelPreview: document.getElementById('panelPreview'),
    exportSummary: document.getElementById('exportSummary'),
    openExportTab: document.getElementById('openExportTab'),
  };

  // Debounced preview rendering to reduce work during typing
  let previewPending = false;
  function requestPreviewRender(delayMs = 50) {
    if (previewPending) return;
    previewPending = true;
    setTimeout(() => { previewPending = false; renderPreview(); }, delayMs);
  }
  function saveState() {
    try {
      const { bgFrontDataUrl, bgBackDataUrl, ...rest } = state.settings;
      const snapshot = {
        rows: state.rows,
        settings: { ...rest },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch (err) {
      // ignore persistence errors
    }
  }

  function syncControlsFromSettings() {
    const s = state.settings;
    els.alignToggle && (els.alignToggle.title = `Textausrichtung: ${s.align}`);
    if (els.fontPx) els.fontPx.value = String(s.fontPx);
    if (els.bgColor) els.bgColor.value = String(s.bgColor);
    if (els.borderEnabled) els.borderEnabled.checked = !!s.borderEnabled;
    if (els.borderColor) els.borderColor.value = String(s.borderColor);
    if (els.bgMode) els.bgMode.value = String(s.bgMode);
    if (els.exportFormat) els.exportFormat.value = String(s.exportFormat);
    if (els.exportSide) els.exportSide.value = String(s.exportSide);
    if (els.cardsPerPage) els.cardsPerPage.value = String(s.cardsPerPage);
    if (els.paperSize) els.paperSize.value = String(s.paperSize);
    if (els.filenameTpl) els.filenameTpl.value = String(s.filenameTpl);
    if (els.flipEdge) els.flipEdge.value = String(s.flipEdge);
    if (els.backRotation) els.backRotation.value = String(s.backRotation);
    if (els.pageMarginMm) els.pageMarginMm.value = String(s.pageMarginMm);
    if (els.gapMm) els.gapMm.value = String(s.gapMm);
    if (els.backOffsetXMm) els.backOffsetXMm.value = String(s.backOffsetXMm);
    if (els.backOffsetYMm) els.backOffsetYMm.value = String(s.backOffsetYMm);
    if (els.showMarks) els.showMarks.checked = !!s.showMarks;
    if (els.imageExportMode) els.imageExportMode.value = String(s.imageExportMode);
  }

  function loadSavedState() {
    try {
      const json = localStorage.getItem(STORAGE_KEY);
      if (!json) return false;
      const data = JSON.parse(json);
      if (Array.isArray(data.rows) && data.rows.length) {
        state.rows = data.rows;
        state.selectedIds = new Set([state.rows[0].id]);
      }
      if (data.settings && typeof data.settings === 'object') {
        state.settings = { ...state.settings, ...data.settings };
      }
      syncControlsFromSettings();
      return true;
    } catch (e) {
      return false;
    }
  }

  const uid = (()=>{ let n=1; return ()=>n++; })();

  function mmToPxDom(mm) {
    return (mm / 25.4) * 96;
  }
  function mmToPxAtDpi(mm, dpi) {
    return Math.round((mm / 25.4) * dpi);
  }

  function sanitizeFilename(input) {
    return String(input).replace(/\s+/g, '_').replace(/[^\w\-\._]+/g, '').slice(0, 80) || 'karte';
  }

  function filenameFromTemplate(row, index, suffix) {
    const tpl = state.settings.filenameTpl || 'karte_{index}_{front}';
    const front = (row.colA || '').toString();
    const back = (row.colB || '').toString();
    const replaced = tpl
      .replaceAll('{index}', String(index))
      .replaceAll('{front}', front)
      .replaceAll('{back}', back);
    const base = sanitizeFilename(replaced);
    return suffix ? `${base}_${suffix}` : base;
  }

  function pushHistory() {
    const snapshot = JSON.stringify({ rows: state.rows, selectedIds: Array.from(state.selectedIds) });
    state.history.past.push(snapshot);
    if (state.history.past.length > 50) state.history.past.shift();
    state.history.future.length = 0;
  }

  function undo() {
    if (!state.history.past.length) return;
    const current = JSON.stringify({ rows: state.rows, selectedIds: Array.from(state.selectedIds) });
    const snapshot = state.history.past.pop();
    state.history.future.push(current);
    const data = JSON.parse(snapshot);
    state.rows = data.rows;
    state.selectedIds = new Set(data.selectedIds);
    renderGrid();
    renderPreview();
    updateExportSummary();
  }

  function redo() {
    if (!state.history.future.length) return;
    const current = JSON.stringify({ rows: state.rows, selectedIds: Array.from(state.selectedIds) });
    const snapshot = state.history.future.pop();
    state.history.past.push(current);
    const data = JSON.parse(snapshot);
    state.rows = data.rows;
    state.selectedIds = new Set(data.selectedIds);
    renderGrid();
    renderPreview();
    updateExportSummary();
  }

  function renderGrid() {
    els.gridBody.innerHTML = '';
    for (const row of state.rows) {
      const tr = document.createElement('tr');
      tr.setAttribute('draggable', 'true');
      tr.dataset.id = String(row.id);
      if (state.selectedIds.has(row.id)) tr.classList.add('selected');

      tr.addEventListener('dragstart', (e) => {
        state.drag.draggingId = row.id;
      });
      tr.addEventListener('dragover', (e) => {
        e.preventDefault();
      });
      tr.addEventListener('drop', (e) => {
        e.preventDefault();
        const fromId = state.drag.draggingId;
        const toId = row.id;
        if (fromId == null || toId == null || fromId === toId) return;
        const fromIndex = state.rows.findIndex(r => r.id === fromId);
        const toIndex = state.rows.findIndex(r => r.id === toId);
        if (fromIndex < 0 || toIndex < 0) return;
        pushHistory();
        const moved = state.rows.splice(fromIndex, 1)[0];
        state.rows.splice(toIndex, 0, moved);
        state.drag.draggingId = null;
        renderGrid();
        requestPreviewRender();
        saveState();
      });

      // Select checkbox
      const tdSel = document.createElement('td');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = state.selectedIds.has(row.id);
      cb.addEventListener('change', () => {
        if (cb.checked) state.selectedIds.add(row.id); else state.selectedIds.delete(row.id);
        renderGrid();
        requestPreviewRender();
      });
      tdSel.appendChild(cb);
      tr.appendChild(tdSel);

      // Drag handle
      const tdDrag = document.createElement('td');
      tdDrag.textContent = '↕︎';
      tdDrag.className = 'drag-handle';
      tdDrag.title = 'Ziehen zum Sortieren';
      tr.appendChild(tdDrag);

      // Column A
      const tdA = document.createElement('td');
      const inpA = document.createElement('input');
      inpA.value = row.colA || '';
      const updateA = () => { row.colA = inpA.value; tdA.classList.toggle('invalid', !inpA.value.trim()); requestPreviewRender(); updateValidation(); saveState(); };
      inpA.addEventListener('input', updateA);
      tdA.classList.toggle('invalid', !inpA.value.trim());
      inpA.setAttribute('aria-label', 'Vorderseite Text');
      tdA.appendChild(inpA);
      tr.appendChild(tdA);

      // Column B
      const tdB = document.createElement('td');
      const inpB = document.createElement('input');
      inpB.value = row.colB || '';
      const updateB = () => { row.colB = inpB.value; tdB.classList.toggle('invalid', !inpB.value.trim()); requestPreviewRender(); updateValidation(); saveState(); };
      inpB.addEventListener('input', updateB);
      tdB.classList.toggle('invalid', !inpB.value.trim());
      inpB.setAttribute('aria-label', 'Rückseite Text');
      tdB.appendChild(inpB);
      tr.appendChild(tdB);

      els.gridBody.appendChild(tr);
    }
    const selectedCount = state.selectedIds.size ? ` · ${state.selectedIds.size} ausgewählt` : '';
    els.rowCount.textContent = `${state.rows.length} Zeilen${selectedCount}`;
    updateValidation();
  }

  function applyThemeToCard(cardEl) {
    const { align, bgColor, borderEnabled, borderColor } = state.settings;
    const front = cardEl.querySelector('[data-front]');
    const back = cardEl.querySelector('[data-back]');
    const styleCommon = `text-align:${align};`;
    const radius = '10px';
    const borderCss = borderEnabled ? `border:1px solid ${borderColor};` : 'border: none;';
    cardEl.style.background = bgColor || '#ffffff';
    cardEl.style.color = '#0b1220';
    cardEl.style.boxShadow = '0 2px 8px rgba(0,0,0,.08)';
    front.style.cssText = styleCommon + `border-radius:${radius}; ${borderCss} padding:12px; display:grid; place-items:center;`;
    back.style.cssText = styleCommon + `border-radius:${radius}; ${borderCss} padding:12px; display:grid; place-items:center;`;
  }

  function autoFontSizeFor(text, basePx) {
    if (!text) return basePx;
    const len = text.length;
    if (len > 160) return Math.max(16, Math.round(basePx * 0.6));
    if (len > 110) return Math.max(18, Math.round(basePx * 0.7));
    if (len > 70) return Math.max(20, Math.round(basePx * 0.8));
    if (len > 40) return Math.max(22, Math.round(basePx * 0.9));
    return basePx;
  }

  // Content is centered; text alignment is handled via text-align

  function applySideStyles(sideEl, text, side) {
    const { marginMm, align, bgFrontDataUrl, bgBackDataUrl, bgMode, fontPx, bgColor } = state.settings;
    const innerW = mmToPxDom(state.settings.widthMm) - mmToPxDom(marginMm) * 2;
    const innerH = mmToPxDom(state.settings.heightMm) - mmToPxDom(marginMm) * 2;
    sideEl.innerHTML = '';
    sideEl.style.width = `${innerW}px`;
    sideEl.style.height = `${innerH}px`;
    sideEl.style.display = 'flex';
    sideEl.style.justifyContent = 'center';
    sideEl.style.alignItems = 'center';
    sideEl.style.backgroundImage = '';
    sideEl.style.backgroundRepeat = 'no-repeat';
    sideEl.style.backgroundPosition = 'center';
    sideEl.style.backgroundSize = bgMode === 'contain' ? 'contain' : 'cover';
    // background per side
    const bgUrl = side === 'front' ? bgFrontDataUrl : bgBackDataUrl;
    if (bgUrl) {
      sideEl.style.backgroundImage = `url(${bgUrl})`;
      sideEl.style.backgroundColor = 'transparent';
    } else {
      sideEl.style.backgroundColor = bgColor || '#ffffff';
    }

    // inner span for text & offset
    const span = document.createElement('span');
    span.textContent = text || '';
    span.style.display = 'inline-block';
    span.style.textAlign = align;

    // font size (single control)
    const base = parseInt(fontPx, 10) || DEFAULT_FONT_PX;
    span.style.fontSize = `${autoFontSizeFor(span.textContent, base)}px`;

    sideEl.appendChild(span);
  }

  function renderPreview() {
    const firstId = state.selectedIds.values().next().value;
    const row = state.rows.find(r => r.id === firstId) || state.rows[0];
    const front = els.previewFront; const back = els.previewBack;
    front.innerHTML = ''; back.innerHTML = '';
    if (!row) {
      const emptyFront = document.createElement('div');
      emptyFront.className = 'empty';
      emptyFront.textContent = 'Keine Daten. CSV/XLSX laden oder Zeile hinzufügen.';
      const emptyBack = emptyFront.cloneNode(true);
      front.appendChild(emptyFront);
      back.appendChild(emptyBack);
      return;
    }
    const card = document.createElement('div');
    card.setAttribute('data-card','');
    const f = document.createElement('div'); f.setAttribute('data-front','');
    const b = document.createElement('div'); b.setAttribute('data-back','');
    card.appendChild(f); card.appendChild(b);
    applyThemeToCard(card);
    applySideStyles(f, row.colA || '', 'front');
    applySideStyles(b, row.colB || '', 'back');
    front.appendChild(f);
    back.appendChild(b);
  }

  function updateValidation() {
    const invalidCount = state.rows.reduce((acc, r) => acc + ((!(r.colA||'').trim() || !(r.colB||'').trim()) ? 1 : 0), 0);
    if (els.validation) {
      els.validation.textContent = invalidCount ? `${invalidCount} Zeilen unvollständig` : 'Alles ok';
    }
  }

  function setColumnsFromHeaders(headers) {
    state.columns = headers;
    els.colA.innerHTML = '';
    els.colB.innerHTML = '';
    headers.forEach((h, idx) => {
      const optA = document.createElement('option'); optA.value = String(idx); optA.textContent = h;
      const optB = document.createElement('option'); optB.value = String(idx); optB.textContent = h;
      els.colA.appendChild(optA); els.colB.appendChild(optB);
    });
    els.colA.value = String(state.settings.colAKey);
    els.colB.value = String(state.settings.colBKey);
  }

  function loadCsv(text) {
    const parsed = Papa.parse(text, { header: state.settings.hasHeader, skipEmptyLines: true });
    if (state.settings.hasHeader) {
      const headers = parsed.meta.fields || Object.keys(parsed.data[0]||{A:'',B:''});
      setColumnsFromHeaders(headers);
      state.rows = parsed.data.map((obj) => {
        const cols = headers.map(h => obj[h]);
        return { id: uid(), cols, colA: cols[state.settings.colAKey]||'', colB: cols[state.settings.colBKey]||'' };
      });
    } else {
      setColumnsFromHeaders(["A","B"]);
      state.rows = parsed.data.map((arr) => ({ id: uid(), cols: arr, colA: arr[0]||'', colB: arr[1]||'' }));
    }
    state.selectedIds = new Set(state.rows.slice(0,1).map(r=>r.id));
    renderGrid(); renderPreview(); saveState();
  }

  function loadXlsx(arrayBuffer) {
    const wb = XLSX.read(arrayBuffer, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    const headers = state.settings.hasHeader ? (json.shift() || ["A","B"]) : ["A","B"];
    setColumnsFromHeaders(headers.map(h=>String(h)));
    state.rows = json.map((arr) => ({ id: uid(), cols: arr, colA: arr[state.settings.colAKey]||'', colB: arr[state.settings.colBKey]||'' }));
    state.selectedIds = new Set(state.rows.slice(0,1).map(r=>r.id));
    renderGrid(); renderPreview(); saveState();
  }

  function exportSelectedRows() {
    const ids = state.selectedIds.size ? Array.from(state.selectedIds) : state.rows.map(r=>r.id);
    return state.rows.filter(r => ids.includes(r.id));
  }

  function buildCardDom(frontText, backText, totalWidthMm, totalHeightMm) {
    const wrapper = document.createElement('div');
    const card = document.createElement('div');
    const f = document.createElement('div'); const b = document.createElement('div');
    f.setAttribute('data-front',''); b.setAttribute('data-back','');
    card.appendChild(f); card.appendChild(b);
    applyThemeToCard(card);
    card.style.width = `${mmToPxDom(totalWidthMm)}px`;
    card.style.height = `${mmToPxDom(totalHeightMm)}px`;
    card.style.display = 'grid';
    card.style.placeItems = 'center';
    applySideStyles(f, frontText, 'front');
    applySideStyles(b, backText, 'back');
    wrapper.appendChild(card);
    return { wrapper, card, f, b };
  }

  function computeBestGrid(perPage, paperWmm, paperHmm, marginMm, gapMm, cardWmm, cardHmm) {
    // candidate grids for 1,2,4,6,8
    const candidates = {
      1: [[1,1],[1,1]],
      2: [[2,1],[1,2]],
      4: [[2,2]],
      6: [[3,2],[2,3]],
      8: [[4,2],[2,4]],
    }[perPage] || [[1,1]];
    let best = { cols: 1, rows: 1, drawW: cardWmm, drawH: cardHmm, scale: 1 };
    for (const [cols, rows] of candidates) {
      const availW = paperWmm - marginMm * 2 - gapMm * (cols - 1);
      const availH = paperHmm - marginMm * 2 - gapMm * (rows - 1);
      const cellW = availW / cols;
      const cellH = availH / rows;
      const scale = Math.min(cellW / cardWmm, cellH / cardHmm);
      const drawW = cardWmm * scale;
      const drawH = cardHmm * scale;
      if (scale > best.scale) best = { cols, rows, drawW, drawH, scale };
    }
    return best;
  }

  function frontIndexToBackIndex(posIndex, cols, rows, flipEdge) {
    const r = Math.floor(posIndex / cols);
    const c = posIndex % cols;
    if (flipEdge === 'long') {
      // mirror horizontally (book flip)
      const c2 = cols - c - 1;
      return r * cols + c2;
    } else {
      // short edge: mirror vertically
      const r2 = rows - r - 1;
      return r2 * cols + c;
    }
  }

  function effectiveBackRotation(paperLandscape, flipEdge, backRotationSetting) {
    if (backRotationSetting !== 'auto') return parseInt(backRotationSetting,10) || 0;
    // Heuristic: for portrait pages, long-edge flip needs 0°, short-edge needs 180°; swap for landscape
    if (!paperLandscape) {
      return flipEdge === 'long' ? 0 : 180;
    } else {
      return flipEdge === 'long' ? 180 : 0;
    }
  }

  function drawCropMarks(pdf, x, y, w, h, markLen = 3, markOffset = 0.8) {
    // simple tiny crop marks at corners
    const l = markLen; const o = markOffset;
    // top-left
    pdf.line(x - o, y, x - o + l, y);
    pdf.line(x, y - o, x, y - o + l);
    // top-right
    pdf.line(x + w + o, y, x + w + o - l, y);
    pdf.line(x + w, y - o, x + w, y - o + l);
    // bottom-left
    pdf.line(x - o, y + h, x - o + l, y + h);
    pdf.line(x, y + h + o, x, y + h + o - l);
    // bottom-right
    pdf.line(x + w + o, y + h, x + w + o - l, y + h);
    pdf.line(x + w, y + h + o, x + w, y + h + o - l);
  }

  async function renderCardSideCanvas(text, side, scalePx = 2) {
    const totalW = state.settings.widthMm;
    const totalH = state.settings.heightMm;
    const { wrapper, card, f, b } = buildCardDom(side === 'front' ? text : '', side === 'back' ? text : '', totalW, totalH);
    // Hide unused side to prevent layout shifts
    if (side === 'front') {
      b.style.display = 'none';
    } else {
      f.style.display = 'none';
    }
    document.body.appendChild(wrapper);
    const canvas = await html2canvas(card, { backgroundColor: null, scale: scalePx });
    document.body.removeChild(wrapper);
    return canvas;
  }

  function getPaperSizeMm() {
    if (state.settings.paperSize === 'A6') return { w: 105, h: 148 };
    return { w: 210, h: 297 }; // A4 default
  }

  // Crop marks removed per simplified export

  async function exportPdfGrid(sideMode) {
    const rows = exportSelectedRows();
    if (!rows.length) return;
    const { jsPDF } = window.jspdf;

    const paper = getPaperSizeMm();
    const pdf = new jsPDF({ unit: 'mm', format: state.settings.paperSize.toLowerCase() });

    const perPage = parseInt(state.settings.cardsPerPage, 10) || 1;
    const marginMm = parseFloat(state.settings.pageMarginMm) || 0;
    const gapMm = parseFloat(state.settings.gapMm) || 0;
    const baseW = state.settings.widthMm;
    const baseH = state.settings.heightMm;
    const { cols, rows: rowsPerPage, drawW, drawH } = computeBestGrid(
      perPage, paper.w, paper.h, marginMm, gapMm, baseW, baseH
    );
    const cellW = (paper.w - marginMm * 2 - gapMm * (cols - 1)) / cols;
    const cellH = (paper.h - marginMm * 2 - gapMm * (rowsPerPage - 1)) / rowsPerPage;

    async function drawPage(side, pageIndex) {
      for (let rIndex = 0; rIndex < perPage; rIndex++) {
        const itemIndex = pageIndex * perPage + rIndex;
        if (itemIndex >= rows.length) break;
        const r = rows[itemIndex];
        const text = side === 'front' ? (r.colA || '') : (r.colB || '');
        const canvas = await renderCardSideCanvas(text, side, 2);
        let col = rIndex % cols;
        let row = Math.floor(rIndex / cols);
        if (side === 'back') {
          const backIdx = frontIndexToBackIndex(rIndex, cols, rowsPerPage, state.settings.flipEdge);
          col = backIdx % cols;
          row = Math.floor(backIdx / cols);
        }
        let x = marginMm + col * (cellW + gapMm) + (cellW - drawW) / 2;
        let y = marginMm + row * (cellH + gapMm) + (cellH - drawH) / 2;
        if (side === 'back') {
          x += parseFloat(state.settings.backOffsetXMm) || 0;
          y += parseFloat(state.settings.backOffsetYMm) || 0;
        }
        const dataUrl = canvas.toDataURL('image/png');
        const rotation = side === 'back' ? effectiveBackRotation(
          paper.w > paper.h,
          state.settings.flipEdge,
          state.settings.backRotation
        ) : 0;
        pdf.addImage(dataUrl, 'PNG', x, y, drawW, drawH, undefined, undefined, rotation);
        if (state.settings.showMarks) drawCropMarks(pdf, x, y, drawW, drawH);
      }
    }

    const totalPages = Math.ceil(rows.length / perPage);
    if (sideMode === 'front') {
      for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
        if (pageIndex > 0) pdf.addPage();
        await drawPage('front', pageIndex);
      }
    } else if (sideMode === 'back') {
      for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
        if (pageIndex > 0) pdf.addPage();
        await drawPage('back', pageIndex);
      }
    } else {
      // 1 Vorderseite, 2 Rückseite, 3 Vorderseite, 4 Rückseite, ...
      let first = true;
      for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
        if (!first) pdf.addPage();
        await drawPage('front', pageIndex);
        pdf.addPage();
        await drawPage('back', pageIndex);
        first = false;
      }
    }

    const fileSuffix = sideMode === 'both' ? 'front_back' : sideMode;
    pdf.save(`flashcards_${fileSuffix}_${Date.now()}.pdf`);
  }

  async function exportImagesZip() {
    const selected = exportSelectedRows();
    if (!selected.length) return;
    const zip = new JSZip();
    const sideMode = state.settings.exportSide;
    const format = state.settings.exportFormat === 'jpg' ? 'image/jpeg' : 'image/png';
    const dpi = 300; // fixed DPI
    const scale = dpi / 96; // html2canvas scale vs CSS px assumption

    let index = 1;
    const ext = state.settings.exportFormat === 'jpg' ? 'jpg' : 'png';
    if (state.settings.imageExportMode === 'cards') {
      for (const r of selected) {
        const base = filenameFromTemplate(r, index);
        if (sideMode === 'front' || sideMode === 'both') {
          const front = await renderCardSideCanvas(r.colA || '', 'front', scale);
          const frontData = front.toDataURL(format);
          zip.file(`${base}_front.${ext}`, frontData.split(',')[1], { base64: true });
        }
        if (sideMode === 'back' || sideMode === 'both') {
          const back = await renderCardSideCanvas(r.colB || '', 'back', scale);
          const backData = back.toDataURL(format);
          zip.file(`${base}_back.${ext}`, backData.split(',')[1], { base64: true });
        }
        index++;
      }
    } else {
      // pages mode: create paired pages as PNGs inside zip, respecting 1V,2R,3V ... numbering per page
      // We'll render a composed canvas per page grid for front then back, and name them page_0001_front/back
      const perPage = parseInt(state.settings.cardsPerPage, 10) || 1;
      const paper = getPaperSizeMm();
      const marginMm = parseFloat(state.settings.pageMarginMm) || 0;
      const gapMm = parseFloat(state.settings.gapMm) || 0;
      const baseW = state.settings.widthMm;
      const baseH = state.settings.heightMm;
      const { cols, rows: rowsPerPage, drawW, drawH } = computeBestGrid(
        perPage, paper.w, paper.h, marginMm, gapMm, baseW, baseH
      );
      const cellW = (paper.w - marginMm * 2 - gapMm * (cols - 1)) / cols;
      const cellH = (paper.h - marginMm * 2 - gapMm * (rowsPerPage - 1)) / rowsPerPage;
      const pagePxW = mmToPxAtDpi(paper.w, 96 * scale);
      const pagePxH = mmToPxAtDpi(paper.h, 96 * scale);

      async function renderComposedPage(side, startIndex) {
        const canvas = document.createElement('canvas');
        canvas.width = pagePxW; canvas.height = pagePxH;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height);
        for (let rIndex = 0; rIndex < perPage; rIndex++) {
          const itemIndex = startIndex + rIndex;
          if (itemIndex >= selected.length) break;
          const r = selected[itemIndex];
          let col = rIndex % cols; let row = Math.floor(rIndex / cols);
          if (side === 'back') {
            const backIdx = frontIndexToBackIndex(rIndex, cols, rowsPerPage, state.settings.flipEdge);
            col = backIdx % cols; row = Math.floor(backIdx / cols);
          }
          const xMm = marginMm + col * (cellW + gapMm) + (cellW - drawW) / 2;
          const yMm = marginMm + row * (cellH + gapMm) + (cellH - drawH) / 2;
          const dx = mmToPxAtDpi(xMm + (side==='back' ? (parseFloat(state.settings.backOffsetXMm)||0) : 0), 96 * scale);
          const dy = mmToPxAtDpi(yMm + (side==='back' ? (parseFloat(state.settings.backOffsetYMm)||0) : 0), 96 * scale);
          const dw = mmToPxAtDpi(drawW, 96 * scale);
          const dh = mmToPxAtDpi(drawH, 96 * scale);
          const cardCanvas = await renderCardSideCanvas(side === 'front' ? (r.colA||'') : (r.colB||''), side, scale);
          // rotation for back in images is applied by rotating draw context if needed
          const rot = side === 'back' ? effectiveBackRotation(paper.w > paper.h, state.settings.flipEdge, state.settings.backRotation) : 0;
          if (rot) {
            ctx.save();
            ctx.translate(dx + dw/2, dy + dh/2);
            ctx.rotate((rot * Math.PI)/180);
            ctx.drawImage(cardCanvas, -dw/2, -dh/2, dw, dh);
            ctx.restore();
          } else {
            ctx.drawImage(cardCanvas, dx, dy, dw, dh);
          }
        }
        return canvas.toDataURL(format);
      }

      let pageNum = 1;
      for (let start = 0; start < selected.length; start += perPage) {
        const frontData = await renderComposedPage('front', start);
        const backData = await renderComposedPage('back', start);
        const num = String(pageNum).padStart(4, '0');
        zip.file(`page_${num}_front.${ext}`, frontData.split(',')[1], { base64: true });
        zip.file(`page_${num}_back.${ext}`, backData.split(',')[1], { base64: true });
        pageNum++;
      }
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `flashcards_images_${Date.now()}.zip`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function duplicateSelectedRows() {
    const selected = exportSelectedRows();
    if (!selected.length) return;
    pushHistory();
    const newOnes = selected.map((r) => ({ id: uid(), colA: r.colA, colB: r.colB, cols: Array.isArray(r.cols) ? [...r.cols] : undefined }));
    // Insert duplicates right after the last selected index
    const lastIndex = Math.max(...selected.map(r => state.rows.findIndex(rr => rr.id === r.id)));
    state.rows.splice(lastIndex + 1, 0, ...newOnes);
    newOnes.forEach(n => state.selectedIds.add(n.id));
    renderGrid();
    renderPreview();
    saveState();
  }

  function deleteSelectedRows() {
    if (!state.selectedIds.size) return;
    pushHistory();
    state.rows = state.rows.filter(r => !state.selectedIds.has(r.id));
    state.selectedIds.clear();
    renderGrid(); renderPreview(); saveState();
  }

  function remapFromCols() {
    for (const r of state.rows) {
      if (Array.isArray(r.cols)) {
        r.colA = r.cols[state.settings.colAKey] || '';
        r.colB = r.cols[state.settings.colBKey] || '';
      }
    }
  }

  // Event bindings
  els.addRow.addEventListener('click', () => {
    pushHistory();
    state.rows.push({ id: uid(), colA: '', colB: '' });
    renderGrid();
    // Auto-select the newly added row for quicker preview feedback
    const last = state.rows[state.rows.length - 1];
    state.selectedIds = new Set([last.id]);
    requestPreviewRender();
    saveState();
  });

  els.duplicateRows && els.duplicateRows.addEventListener('click', duplicateSelectedRows);
  els.deleteRows.addEventListener('click', deleteSelectedRows);
  els.undo && els.undo.addEventListener('click', undo);
  els.redo && els.redo.addEventListener('click', redo);

  els.selectAll.addEventListener('change', () => {
    state.selectedIds = new Set(els.selectAll.checked ? state.rows.map(r=>r.id) : []);
    renderGrid(); requestPreviewRender();
  });

  els.hasHeader.addEventListener('change', () => {
    state.settings.hasHeader = els.hasHeader.checked;
  });

  els.colA.addEventListener('change', () => { state.settings.colAKey = parseInt(els.colA.value,10); remapFromCols(); renderGrid(); requestPreviewRender(); });
  els.colB.addEventListener('change', () => { state.settings.colBKey = parseInt(els.colB.value,10); remapFromCols(); renderGrid(); requestPreviewRender(); });

  // Style controls
  els.alignToggle && els.alignToggle.addEventListener('click', () => {
    const cycle = ['center','left','right'];
    const idx = cycle.indexOf(state.settings.align);
    state.settings.align = cycle[(idx + 1) % cycle.length];
    requestPreviewRender();
  });
  els.fontPx && els.fontPx.addEventListener('input', () => { state.settings.fontPx = parseInt(els.fontPx.value,10)||DEFAULT_FONT_PX; requestPreviewRender(); saveState(); });
  els.bgColor && els.bgColor.addEventListener('input', () => { state.settings.bgColor = els.bgColor.value; requestPreviewRender(); saveState(); });
  els.borderEnabled && els.borderEnabled.addEventListener('change', () => { state.settings.borderEnabled = !!els.borderEnabled.checked; requestPreviewRender(); saveState(); });
  els.borderColor && els.borderColor.addEventListener('input', () => { state.settings.borderColor = els.borderColor.value; requestPreviewRender(); saveState(); });

  // Backgrounds
  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  els.bgFront && els.bgFront.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    state.settings.bgFrontDataUrl = String(await readFileAsDataUrl(file));
    requestPreviewRender(); saveState();
  });
  els.bgBack && els.bgBack.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    state.settings.bgBackDataUrl = String(await readFileAsDataUrl(file));
    requestPreviewRender(); saveState();
  });
  els.bgFrontClear && els.bgFrontClear.addEventListener('click', () => { state.settings.bgFrontDataUrl = null; requestPreviewRender(); saveState(); });
  els.bgBackClear && els.bgBackClear.addEventListener('click', () => { state.settings.bgBackDataUrl = null; requestPreviewRender(); saveState(); });
  els.bgMode && els.bgMode.addEventListener('change', () => { state.settings.bgMode = els.bgMode.value; requestPreviewRender(); saveState(); });

  // Export controls
  els.exportFormat && els.exportFormat.addEventListener('change', () => { state.settings.exportFormat = els.exportFormat.value; saveState(); updateExportSummary(); });
  els.exportSide && els.exportSide.addEventListener('change', () => { state.settings.exportSide = els.exportSide.value; saveState(); updateExportSummary(); });
  els.cardsPerPage && els.cardsPerPage.addEventListener('change', () => { state.settings.cardsPerPage = parseInt(els.cardsPerPage.value,10)||1; saveState(); updateExportSummary(); });
  els.paperSize && els.paperSize.addEventListener('change', () => { state.settings.paperSize = els.paperSize.value; saveState(); updateExportSummary(); });
  els.filenameTpl && els.filenameTpl.addEventListener('input', () => { state.settings.filenameTpl = els.filenameTpl.value; saveState(); });
  els.flipEdge && els.flipEdge.addEventListener('change', () => { state.settings.flipEdge = els.flipEdge.value; saveState(); });
  els.backRotation && els.backRotation.addEventListener('change', () => { state.settings.backRotation = els.backRotation.value; saveState(); });
  els.pageMarginMm && els.pageMarginMm.addEventListener('input', () => { state.settings.pageMarginMm = parseFloat(els.pageMarginMm.value)||0; saveState(); });
  els.gapMm && els.gapMm.addEventListener('input', () => { state.settings.gapMm = parseFloat(els.gapMm.value)||0; saveState(); });
  els.backOffsetXMm && els.backOffsetXMm.addEventListener('input', () => { state.settings.backOffsetXMm = parseFloat(els.backOffsetXMm.value)||0; saveState(); });
  els.backOffsetYMm && els.backOffsetYMm.addEventListener('input', () => { state.settings.backOffsetYMm = parseFloat(els.backOffsetYMm.value)||0; saveState(); });
  els.showMarks && els.showMarks.addEventListener('change', () => { state.settings.showMarks = !!els.showMarks.checked; saveState(); });
  els.imageExportMode && els.imageExportMode.addEventListener('change', () => { state.settings.imageExportMode = els.imageExportMode.value; saveState(); });

  // Download button
  els.downloadBtn && els.downloadBtn.addEventListener('click', async () => {
    const side = state.settings.exportSide;
    if (state.settings.exportFormat === 'pdf') {
      await exportPdfGrid(side);
    } else {
      await exportImagesZip();
    }
  });

  els.fileInput.addEventListener('change', async (ev) => {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    const ext = (file.name.split('.').pop()||'').toLowerCase();
    if (ext === 'csv') {
      const text = await file.text();
      pushHistory();
      loadCsv(text);
      updateExportSummary();
    } else if (ext === 'xlsx' || ext === 'xls' || ext === 'ods') {
      const buf = await file.arrayBuffer();
      pushHistory();
      loadXlsx(buf);
      updateExportSummary();
    } else {
      alert('Nicht unterstütztes Format. Erlaubt: CSV, XLSX, XLS, ODS');
    }
  });

  function updateExportSummary() {
    if (!els.exportSummary) return;
    const total = state.rows.length;
    const selected = state.selectedIds.size || total;
    const perPage = parseInt(state.settings.cardsPerPage, 10) || 1;
    const paper = state.settings.paperSize;
    const side = state.settings.exportSide === 'both' ? 'Front + Back' : state.settings.exportSide;
    els.exportSummary.textContent = `${selected}/${total} Karten · ${perPage} pro Seite · ${paper} · ${side}`;
  }

  // Tabs behavior
  function activateTab(name) {
    const tabs = {
      karte: { tab: els.tabKarte, panel: els.panelKarte },
      export: { tab: els.tabExport, panel: els.panelExport },
      preview: { tab: els.tabPreview, panel: els.panelPreview },
    };
    Object.entries(tabs).forEach(([key, entry]) => {
      if (!entry || !entry.tab || !entry.panel) return;
      const isActive = key === name;
      entry.tab.classList.toggle('active', isActive);
      entry.tab.setAttribute('aria-selected', String(isActive));
      entry.panel.classList.toggle('active', isActive);
    });
    if (name === 'export') updateExportSummary();
    if (name === 'preview') requestPreviewRender(0);
  }
  els.tabKarte && els.tabKarte.addEventListener('click', () => activateTab('karte'));
  els.tabExport && els.tabExport.addEventListener('click', () => activateTab('export'));
  els.tabPreview && els.tabPreview.addEventListener('click', () => activateTab('preview'));
  els.openExportTab && els.openExportTab.addEventListener('click', () => activateTab('export'));

  // Initialize from saved state if available, otherwise sample row
  const restored = loadSavedState();
  if (!restored) {
    state.rows = [ { id: uid(), colA: 'Beispiel Vorderseite', colB: 'Beispiel Rückseite' } ];
    state.selectedIds = new Set([state.rows[0].id]);
  }
  setColumnsFromHeaders(["A","B"]);
  syncControlsFromSettings();
  renderGrid();
  renderPreview();
  updateExportSummary();
})();
