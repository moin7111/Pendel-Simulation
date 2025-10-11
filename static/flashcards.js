(function(){
  const DEFAULT_FONT_FRONT_PX = 28;
  const DEFAULT_FONT_BACK_PX = 24;

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
      theme: "minimal",
      font: "system-ui",
      accent: "#2563eb",
      widthMm: 85,
      heightMm: 55,
      marginMm: 6,
      align: "center",
      hasHeader: false,
      colAKey: 0,
      colBKey: 1,
      // Export / layout
      paper: "Card", // A4, Letter, Card (default Card = 1×1)
      pdfCols: 2,
      pdfRows: 3,
      gapMm: 6,
      pageMarginMm: 12,
      flip: "long", // long | short
      rotateBack: true,
      cropMarks: false,
      bleedMm: 0,
      // Images
      imgFormat: "png", // png | jpg
      dpi: 300,
      filenameTpl: "karte_{index}_{front}",
      // Language
      lang: "de",
      // Backgrounds
      bgFrontDataUrl: null,
      bgBackDataUrl: null,
      bgMode: 'cover', // cover | contain
      // Text position & sizing
      posH: 'center', // left | center | right
      posV: 'center', // top | center | bottom
      offsetXmm: 0,
      offsetYmm: 0,
      sizeAuto: true,
      fontFrontPx: DEFAULT_FONT_FRONT_PX,
      fontBackPx: DEFAULT_FONT_BACK_PX,
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
    theme: document.getElementById('theme'),
    font: document.getElementById('font'),
    accent: document.getElementById('accent'),
    wmm: document.getElementById('wmm'),
    hmm: document.getElementById('hmm'),
    marginmm: document.getElementById('marginmm'),
    align: document.getElementById('align'),
    previewFront: document.getElementById('previewFront'),
    previewBack: document.getElementById('previewBack'),
    // backgrounds & position
    bgFront: document.getElementById('bgFront'),
    bgBack: document.getElementById('bgBack'),
    bgFrontClear: document.getElementById('bgFrontClear'),
    bgBackClear: document.getElementById('bgBackClear'),
    bgMode: document.getElementById('bgMode'),
    posH: document.getElementById('posH'),
    posV: document.getElementById('posV'),
    offsetXmm: document.getElementById('offsetXmm'),
    offsetYmm: document.getElementById('offsetYmm'),
    sizeAuto: document.getElementById('sizeAuto'),
    fontFrontPx: document.getElementById('fontFrontPx'),
    fontBackPx: document.getElementById('fontBackPx'),
    // nav buttons
    exportPdfBoth: document.getElementById('exportPdfBoth'),
    exportPdfFront: document.getElementById('exportPdfFront'),
    exportPdfBack: document.getElementById('exportPdfBack'),
    exportImages: document.getElementById('exportImages'),
    samplePdf: document.getElementById('samplePdf'),
    // export controls
    paper: document.getElementById('paper'),
    pdfCols: document.getElementById('pdfCols'),
    pdfRows: document.getElementById('pdfRows'),
    gapmm: document.getElementById('gapmm'),
    pagemm: document.getElementById('pagemm'),
    flip: document.getElementById('flip'),
    rotateBack: document.getElementById('rotateBack'),
    cropMarks: document.getElementById('cropMarks'),
    bleedmm: document.getElementById('bleedmm'),
    imgFormat: document.getElementById('imgFormat'),
    dpi: document.getElementById('dpi'),
    filenameTpl: document.getElementById('filenameTpl'),
    lang: document.getElementById('lang'),
  };

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
  }

  function renderGrid() {
    els.gridBody.innerHTML = '';
    for (const row of state.rows) {
      const tr = document.createElement('tr');
      tr.setAttribute('draggable', 'true');
      tr.dataset.id = String(row.id);

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
        renderPreview();
      });

      // Select checkbox
      const tdSel = document.createElement('td');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = state.selectedIds.has(row.id);
      cb.addEventListener('change', () => {
        if (cb.checked) state.selectedIds.add(row.id); else state.selectedIds.delete(row.id);
        renderPreview();
      });
      tdSel.appendChild(cb);
      tr.appendChild(tdSel);

      // Drag handle
      const tdDrag = document.createElement('td');
      tdDrag.textContent = '↕︎';
      tdDrag.className = 'drag-handle';
      tr.appendChild(tdDrag);

      // Column A
      const tdA = document.createElement('td');
      const inpA = document.createElement('input');
      inpA.value = row.colA || '';
      const updateA = () => { row.colA = inpA.value; tdA.classList.toggle('invalid', !inpA.value.trim()); renderPreview(); updateValidation(); };
      inpA.addEventListener('input', updateA);
      tdA.classList.toggle('invalid', !inpA.value.trim());
      tdA.appendChild(inpA);
      tr.appendChild(tdA);

      // Column B
      const tdB = document.createElement('td');
      const inpB = document.createElement('input');
      inpB.value = row.colB || '';
      const updateB = () => { row.colB = inpB.value; tdB.classList.toggle('invalid', !inpB.value.trim()); renderPreview(); updateValidation(); };
      inpB.addEventListener('input', updateB);
      tdB.classList.toggle('invalid', !inpB.value.trim());
      tdB.appendChild(inpB);
      tr.appendChild(tdB);

      els.gridBody.appendChild(tr);
    }
    els.rowCount.textContent = `${state.rows.length} Zeilen`;
    updateValidation();
  }

  function applyThemeToCard(cardEl) {
    const { theme, font, accent, align } = state.settings;
    const front = cardEl.querySelector('[data-front]');
    const back = cardEl.querySelector('[data-back]');
    const styleCommon = `font-family:${font}; text-align:${align};`;
    const baseCss = `border-radius:8px; border:1px solid #334155; padding:12px; display:grid; place-items:center;`;
    if (theme === 'light') {
      cardEl.style.background = '#ffffff';
      cardEl.style.color = '#0b1220';
      cardEl.style.boxShadow = '0 2px 8px rgba(0,0,0,.08)';
      front.style.cssText = styleCommon + baseCss;
      back.style.cssText = styleCommon + baseCss;
    } else if (theme === 'dark') {
      cardEl.style.background = '#0b1220';
      cardEl.style.color = '#e5e7eb';
      cardEl.style.boxShadow = '0 2px 8px rgba(0,0,0,.3)';
      front.style.cssText = styleCommon + baseCss;
      back.style.cssText = styleCommon + baseCss;
    } else if (theme === 'card') {
      cardEl.style.background = '#fff';
      cardEl.style.color = '#111827';
      cardEl.style.boxShadow = '0 4px 16px rgba(0,0,0,.1)';
      front.style.cssText = styleCommon + baseCss + `border-top:4px solid ${accent};`;
      back.style.cssText = styleCommon + baseCss + `border-bottom:4px solid ${accent};`;
    } else {
      cardEl.style.background = '#0b1220';
      cardEl.style.color = '#e5e7eb';
      cardEl.style.boxShadow = 'none';
      front.style.cssText = styleCommon + baseCss + 'border:none;';
      back.style.cssText = styleCommon + baseCss + 'border:none;';
    }
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

  function computeJustify(posH) {
    if (posH === 'left') return 'flex-start';
    if (posH === 'right') return 'flex-end';
    return 'center';
  }

  function computeAlign(posV) {
    if (posV === 'top') return 'flex-start';
    if (posV === 'bottom') return 'flex-end';
    return 'center';
  }

  function applySideStyles(sideEl, text, side) {
    const { marginMm, align, bgFrontDataUrl, bgBackDataUrl, bgMode, posH, posV, offsetXmm, offsetYmm, sizeAuto, fontFrontPx, fontBackPx } = state.settings;
    const innerW = mmToPxDom(state.settings.widthMm) - mmToPxDom(marginMm) * 2;
    const innerH = mmToPxDom(state.settings.heightMm) - mmToPxDom(marginMm) * 2;
    sideEl.innerHTML = '';
    sideEl.style.width = `${innerW}px`;
    sideEl.style.height = `${innerH}px`;
    sideEl.style.display = 'flex';
    sideEl.style.justifyContent = computeJustify(posH);
    sideEl.style.alignItems = computeAlign(posV);
    sideEl.style.backgroundImage = '';
    sideEl.style.backgroundRepeat = 'no-repeat';
    sideEl.style.backgroundPosition = 'center';
    sideEl.style.backgroundSize = bgMode === 'contain' ? 'contain' : 'cover';
    // background per side
    const bgUrl = side === 'front' ? bgFrontDataUrl : bgBackDataUrl;
    if (bgUrl) sideEl.style.backgroundImage = `url(${bgUrl})`;

    // inner span for text & offset
    const span = document.createElement('span');
    span.textContent = text || '';
    span.style.display = 'inline-block';
    const offX = mmToPxDom(offsetXmm);
    const offY = mmToPxDom(offsetYmm);
    span.style.transform = `translate(${offX}px, ${offY}px)`;
    span.style.textAlign = align;

    // font size
    if (sizeAuto) {
      const base = side === 'front' ? DEFAULT_FONT_FRONT_PX : DEFAULT_FONT_BACK_PX;
      span.style.fontSize = `${autoFontSizeFor(span.textContent, base)}px`;
    } else {
      span.style.fontSize = `${side === 'front' ? (parseInt(fontFrontPx,10)||DEFAULT_FONT_FRONT_PX) : (parseInt(fontBackPx,10)||DEFAULT_FONT_BACK_PX)}px`;
    }

    sideEl.appendChild(span);
  }

  function renderPreview() {
    const firstId = state.selectedIds.values().next().value;
    const row = state.rows.find(r => r.id === firstId) || state.rows[0];
    const front = els.previewFront; const back = els.previewBack;
    front.innerHTML = ''; back.innerHTML = '';
    if (!row) return;
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
    renderGrid(); renderPreview();
  }

  function loadXlsx(arrayBuffer) {
    const wb = XLSX.read(arrayBuffer, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    const headers = state.settings.hasHeader ? (json.shift() || ["A","B"]) : ["A","B"];
    setColumnsFromHeaders(headers.map(h=>String(h)));
    state.rows = json.map((arr) => ({ id: uid(), cols: arr, colA: arr[state.settings.colAKey]||'', colB: arr[state.settings.colBKey]||'' }));
    state.selectedIds = new Set(state.rows.slice(0,1).map(r=>r.id));
    renderGrid(); renderPreview();
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

  async function renderCardSideCanvas(text, side, scalePx = 2, includeBleed = 0) {
    const totalW = state.settings.widthMm + includeBleed * 2;
    const totalH = state.settings.heightMm + includeBleed * 2;
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
    if (state.settings.paper === 'A4') return { w: 210, h: 297 };
    if (state.settings.paper === 'Letter') return { w: 216, h: 279 };
    // Card size
    return { w: state.settings.widthMm + state.settings.bleedMm * 2, h: state.settings.heightMm + state.settings.bleedMm * 2 };
  }

  function drawCropMarks(pdf, x, y, w, h) {
    const mark = 3; // mm
    pdf.setDrawColor(120);
    pdf.setLineWidth(0.2);
    // Top-left
    pdf.line(x - mark, y, x, y);
    pdf.line(x, y - mark, x, y);
    // Top-right
    pdf.line(x + w + mark, y, x + w, y);
    pdf.line(x + w, y - mark, x + w, y);
    // Bottom-left
    pdf.line(x - mark, y + h, x, y + h);
    pdf.line(x, y + h + mark, x, y + h);
    // Bottom-right
    pdf.line(x + w + mark, y + h, x + w, y + h);
    pdf.line(x + w, y + h + mark, x + w, y + h);
  }

  async function exportPdf(sideMode) {
    const rows = exportSelectedRows();
    if (!rows.length) return;
    const { jsPDF } = window.jspdf;

    // Always one card per page
    const bleed = state.settings.bleedMm;
    const cardW = state.settings.widthMm + bleed * 2;
    const cardH = state.settings.heightMm + bleed * 2;
    const pdf = new jsPDF({ unit: 'mm', format: [cardW, cardH] });

    let isFirstPage = true;
    for (const r of rows) {
      if (!isFirstPage) pdf.addPage();
      isFirstPage = false;
      if (sideMode === 'front' || sideMode === 'both') {
        const c1 = await renderCardSideCanvas(r.colA || '', 'front', 2, bleed);
        pdf.addImage(c1.toDataURL('image/png'), 'PNG', 0, 0, cardW, cardH);
        if (state.settings.cropMarks) drawCropMarks(pdf, 0, 0, cardW, cardH);
      }
      if (sideMode === 'both') {
        pdf.addPage();
      }
      if (sideMode === 'back' || sideMode === 'both') {
        const c2 = await renderCardSideCanvas(r.colB || '', 'back', 2, bleed);
        const rot = state.settings.rotateBack ? 180 : 0;
        pdf.addImage(c2.toDataURL('image/png'), 'PNG', 0, 0, cardW, cardH, undefined, 'FAST', rot);
        if (state.settings.cropMarks) drawCropMarks(pdf, 0, 0, cardW, cardH);
      }
    }

    const fileSuffix = sideMode === 'both' ? 'front_back' : sideMode;
    pdf.save(`flashcards_${fileSuffix}_${Date.now()}.pdf`);
  }

  async function exportImagesZip() {
    const selected = exportSelectedRows();
    if (!selected.length) return;
    const zip = new JSZip();
    const bleed = state.settings.bleedMm;
    const format = state.settings.imgFormat === 'jpg' ? 'image/jpeg' : 'image/png';
    const dpi = Math.max(72, parseInt(state.settings.dpi, 10) || 300);
    const scale = dpi / 96; // html2canvas scale vs CSS px assumption

    let index = 1;
    for (const r of selected) {
      const front = await renderCardSideCanvas(r.colA || '', 'front', scale, bleed);
      const back = await renderCardSideCanvas(r.colB || '', 'back', scale, bleed);
      const frontData = front.toDataURL(format);
      const backData = back.toDataURL(format);
      const base = filenameFromTemplate(r, index);
      const ext = state.settings.imgFormat === 'jpg' ? 'jpg' : 'png';
      zip.file(`${base}_front.${ext}`, frontData.split(',')[1], { base64: true });
      zip.file(`${base}_back.${ext}`, backData.split(',')[1], { base64: true });
      index++;
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
  }

  function deleteSelectedRows() {
    if (!state.selectedIds.size) return;
    pushHistory();
    state.rows = state.rows.filter(r => !state.selectedIds.has(r.id));
    state.selectedIds.clear();
    renderGrid(); renderPreview();
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
  });

  els.duplicateRows && els.duplicateRows.addEventListener('click', duplicateSelectedRows);
  els.deleteRows.addEventListener('click', deleteSelectedRows);
  els.undo && els.undo.addEventListener('click', undo);
  els.redo && els.redo.addEventListener('click', redo);

  els.selectAll.addEventListener('change', () => {
    state.selectedIds = new Set(els.selectAll.checked ? state.rows.map(r=>r.id) : []);
    renderGrid(); renderPreview();
  });

  els.hasHeader.addEventListener('change', () => {
    state.settings.hasHeader = els.hasHeader.checked;
  });

  els.colA.addEventListener('change', () => { state.settings.colAKey = parseInt(els.colA.value,10); remapFromCols(); renderGrid(); renderPreview(); });
  els.colB.addEventListener('change', () => { state.settings.colBKey = parseInt(els.colB.value,10); remapFromCols(); renderGrid(); renderPreview(); });
  els.theme.addEventListener('change', () => { state.settings.theme = els.theme.value; renderPreview(); });
  els.font.addEventListener('change', () => { state.settings.font = els.font.value; renderPreview(); });
  els.accent.addEventListener('input', () => { state.settings.accent = els.accent.value; renderPreview(); });
  els.wmm.addEventListener('input', () => { state.settings.widthMm = parseFloat(els.wmm.value)||85; renderPreview(); });
  els.hmm.addEventListener('input', () => { state.settings.heightMm = parseFloat(els.hmm.value)||55; renderPreview(); });
  els.marginmm.addEventListener('input', () => { state.settings.marginMm = parseFloat(els.marginmm.value)||6; renderPreview(); });
  els.align.addEventListener('change', () => { state.settings.align = els.align.value; renderPreview(); });

  // Backgrounds & positioning
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
    renderPreview();
  });
  els.bgBack && els.bgBack.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    state.settings.bgBackDataUrl = String(await readFileAsDataUrl(file));
    renderPreview();
  });
  els.bgFrontClear && els.bgFrontClear.addEventListener('click', () => { state.settings.bgFrontDataUrl = null; renderPreview(); });
  els.bgBackClear && els.bgBackClear.addEventListener('click', () => { state.settings.bgBackDataUrl = null; renderPreview(); });
  els.bgMode && els.bgMode.addEventListener('change', () => { state.settings.bgMode = els.bgMode.value; renderPreview(); });
  els.posH && els.posH.addEventListener('change', () => { state.settings.posH = els.posH.value; renderPreview(); });
  els.posV && els.posV.addEventListener('change', () => { state.settings.posV = els.posV.value; renderPreview(); });
  els.offsetXmm && els.offsetXmm.addEventListener('input', () => { state.settings.offsetXmm = parseFloat(els.offsetXmm.value)||0; renderPreview(); });
  els.offsetYmm && els.offsetYmm.addEventListener('input', () => { state.settings.offsetYmm = parseFloat(els.offsetYmm.value)||0; renderPreview(); });
  els.sizeAuto && els.sizeAuto.addEventListener('change', () => {
    state.settings.sizeAuto = !!els.sizeAuto.checked;
    if (state.settings.sizeAuto) {
      els.fontFrontPx && (els.fontFrontPx.disabled = true);
      els.fontBackPx && (els.fontBackPx.disabled = true);
    } else {
      els.fontFrontPx && (els.fontFrontPx.disabled = false);
      els.fontBackPx && (els.fontBackPx.disabled = false);
    }
    renderPreview();
  });
  els.fontFrontPx && els.fontFrontPx.addEventListener('input', () => { state.settings.fontFrontPx = parseInt(els.fontFrontPx.value,10)||DEFAULT_FONT_FRONT_PX; renderPreview(); });
  els.fontBackPx && els.fontBackPx.addEventListener('input', () => { state.settings.fontBackPx = parseInt(els.fontBackPx.value,10)||DEFAULT_FONT_BACK_PX; renderPreview(); });

  // Export controls
  els.paper && els.paper.addEventListener('change', () => { state.settings.paper = els.paper.value; });
  els.pdfCols && els.pdfCols.addEventListener('input', () => { state.settings.pdfCols = parseInt(els.pdfCols.value, 10) || 1; });
  els.pdfRows && els.pdfRows.addEventListener('input', () => { state.settings.pdfRows = parseInt(els.pdfRows.value, 10) || 1; });
  els.gapmm && els.gapmm.addEventListener('input', () => { state.settings.gapMm = parseFloat(els.gapmm.value)||0; });
  els.pagemm && els.pagemm.addEventListener('input', () => { state.settings.pageMarginMm = parseFloat(els.pagemm.value)||0; });
  els.flip && els.flip.addEventListener('change', () => { state.settings.flip = els.flip.value; });
  els.rotateBack && els.rotateBack.addEventListener('change', () => { state.settings.rotateBack = !!els.rotateBack.checked; });
  els.cropMarks && els.cropMarks.addEventListener('change', () => { state.settings.cropMarks = !!els.cropMarks.checked; });
  els.bleedmm && els.bleedmm.addEventListener('input', () => { state.settings.bleedMm = parseFloat(els.bleedmm.value)||0; });
  els.imgFormat && els.imgFormat.addEventListener('change', () => { state.settings.imgFormat = els.imgFormat.value; });
  els.dpi && els.dpi.addEventListener('input', () => { state.settings.dpi = parseInt(els.dpi.value,10)||300; });
  els.filenameTpl && els.filenameTpl.addEventListener('input', () => { state.settings.filenameTpl = els.filenameTpl.value; });
  els.lang && els.lang.addEventListener('change', () => { state.settings.lang = els.lang.value; /* UI text could be updated here */ });

  // Export buttons
  els.exportPdfBoth && els.exportPdfBoth.addEventListener('click', () => exportPdf('both'));
  els.exportPdfFront && els.exportPdfFront.addEventListener('click', () => exportPdf('front'));
  els.exportPdfBack && els.exportPdfBack.addEventListener('click', () => exportPdf('back'));
  els.exportImages && els.exportImages.addEventListener('click', exportImagesZip);
  els.samplePdf && els.samplePdf.addEventListener('click', async () => {
    if (!state.rows.length) {
      state.rows = [
        { id: uid(), colA: 'Front 1', colB: 'Back 1' },
        { id: uid(), colA: 'Front 2', colB: 'Back 2' },
        { id: uid(), colA: 'Front 3', colB: 'Back 3' },
        { id: uid(), colA: 'Front 4', colB: 'Back 4' },
        { id: uid(), colA: 'Front 5', colB: 'Back 5' },
        { id: uid(), colA: 'Front 6', colB: 'Back 6' },
      ];
      state.selectedIds = new Set(state.rows.map(r=>r.id));
      renderGrid();
      renderPreview();
    }
    exportPdf('both');
  });

  els.fileInput.addEventListener('change', async (ev) => {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    const ext = (file.name.split('.').pop()||'').toLowerCase();
    if (ext === 'csv') {
      const text = await file.text();
      pushHistory();
      loadCsv(text);
    } else if (ext === 'xlsx' || ext === 'xls' || ext === 'ods') {
      const buf = await file.arrayBuffer();
      pushHistory();
      loadXlsx(buf);
    } else {
      alert('Nicht unterstütztes Format');
    }
  });

  // Initialize sample row
  state.rows = [ { id: uid(), colA: 'Beispiel Vorderseite', colB: 'Beispiel Rückseite' } ];
  state.selectedIds = new Set([state.rows[0].id]);
  setColumnsFromHeaders(["A","B"]);
  renderGrid();
  renderPreview();
})();
