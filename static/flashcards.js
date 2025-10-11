(function(){
  const state = {
    columns: ["A", "B"],
    rows: [], // {id, colA, colB}
    selectedIds: new Set(),
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
    }
  };

  const els = {
    gridBody: document.getElementById('gridBody'),
    selectAll: document.getElementById('selectAll'),
    rowCount: document.getElementById('rowCount'),
    validation: document.getElementById('validation'),
    addRow: document.getElementById('addRow'),
    deleteRows: document.getElementById('deleteRows'),
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
    generatePdf: document.getElementById('generatePdf'),
    generatePng: document.getElementById('generatePng'),
  };

  const uid = (()=>{ let n=1; return ()=>n++; })();

  function mmToPx(mm) {
    // 96 DPI browser CSS pixel; 1in = 25.4mm
    return Math.round((mm / 25.4) * 96);
  }

  function renderGrid() {
    els.gridBody.innerHTML = '';
    for (const row of state.rows) {
      const tr = document.createElement('tr');
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

      const tdA = document.createElement('td');
      const inpA = document.createElement('input');
      inpA.value = row.colA || '';
      const updateA = () => { row.colA = inpA.value; tdA.classList.toggle('invalid', !inpA.value.trim()); renderPreview(); updateValidation(); };
      inpA.addEventListener('input', updateA);
      // Initial validation state
      tdA.classList.toggle('invalid', !inpA.value.trim());
      tdA.appendChild(inpA);
      tr.appendChild(tdA);

      const tdB = document.createElement('td');
      const inpB = document.createElement('input');
      inpB.value = row.colB || '';
      const updateB = () => { row.colB = inpB.value; tdB.classList.toggle('invalid', !inpB.value.trim()); renderPreview(); updateValidation(); };
      inpB.addEventListener('input', updateB);
      // Initial validation state
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
      // minimal
      cardEl.style.background = '#0b1220';
      cardEl.style.color = '#e5e7eb';
      cardEl.style.boxShadow = 'none';
      front.style.cssText = styleCommon + baseCss + 'border:none;';
      back.style.cssText = styleCommon + baseCss + 'border:none;';
    }
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
    f.textContent = row.colA || '';
    b.textContent = row.colB || '';
    card.appendChild(f); card.appendChild(b);
    applyThemeToCard(card);
    const w = mmToPx(state.settings.widthMm) - mmToPx(state.settings.marginMm)*2;
    const h = mmToPx(state.settings.heightMm) - mmToPx(state.settings.marginMm)*2;
    f.style.width = b.style.width = `${w}px`;
    f.style.height = b.style.height = `${h}px`;
    f.style.display = b.style.display = 'grid';
    f.style.placeItems = b.style.placeItems = 'center';
    f.style.fontSize = '28px'; b.style.fontSize = '24px';
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
    // json is array of arrays
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

  async function renderCardToCanvas(frontText, backText) {
    const w = mmToPx(state.settings.widthMm);
    const h = mmToPx(state.settings.heightMm);

    const wrapper = document.createElement('div');
    wrapper.style.width = `${w}px`;
    wrapper.style.height = `${h}px`;
    const card = document.createElement('div');
    const f = document.createElement('div'); const b = document.createElement('div');
    f.setAttribute('data-front',''); b.setAttribute('data-back','');
    f.textContent = frontText; b.textContent = backText;
    card.appendChild(f); card.appendChild(b);
    applyThemeToCard(card);
    card.style.width = `${w}px`;
    card.style.height = `${h}px`;
    card.style.display = 'grid';
    card.style.placeItems = 'center';
    const innerW = w - mmToPx(state.settings.marginMm)*2;
    const innerH = h - mmToPx(state.settings.marginMm)*2;
    f.style.width = b.style.width = `${innerW}px`;
    f.style.height = b.style.height = `${innerH}px`;
    f.style.display = b.style.display = 'grid';
    f.style.placeItems = b.style.placeItems = 'center';
    f.style.fontSize = '28px'; b.style.fontSize = '24px';
    wrapper.appendChild(card);

    document.body.appendChild(wrapper);
    const canvas = await html2canvas(card, { backgroundColor: null, scale: 2 });
    document.body.removeChild(wrapper);
    return canvas;
  }

  async function exportAsPdf() {
    const rows = exportSelectedRows();
    if (!rows.length) return;
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: [state.settings.widthMm, state.settings.heightMm] });
    let first = true;
    for (const r of rows) {
      const canvas = await renderCardToCanvas(r.colA || '', r.colB || '');
      const imgData = canvas.toDataURL('image/png');
      if (!first) pdf.addPage();
      first = false;
      pdf.addImage(imgData, 'PNG', 0, 0, state.settings.widthMm, state.settings.heightMm);
    }
    pdf.save(`flashcards_${Date.now()}.pdf`);
  }

  async function exportAsPngZipOrSingle() {
    const rows = exportSelectedRows();
    if (!rows.length) return;
    // For MVP: export first as single PNG download; zip would need JSZip
    const r = rows[0];
    const canvas = await renderCardToCanvas(r.colA || '', r.colB || '');
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `karte_${String(r.colA||'A').slice(0,24)}.png`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  }

  // Events
  els.addRow.addEventListener('click', () => {
    state.rows.push({ id: uid(), colA: '', colB: '' });
    renderGrid();
  });
  els.deleteRows.addEventListener('click', () => {
    if (!state.selectedIds.size) return;
    state.rows = state.rows.filter(r => !state.selectedIds.has(r.id));
    state.selectedIds.clear();
    renderGrid(); renderPreview();
  });
  els.selectAll.addEventListener('change', () => {
    state.selectedIds = new Set(els.selectAll.checked ? state.rows.map(r=>r.id) : []);
    renderGrid(); renderPreview();
  });

  els.hasHeader.addEventListener('change', () => {
    state.settings.hasHeader = els.hasHeader.checked;
  });
  function remapFromCols() {
    for (const r of state.rows) {
      if (Array.isArray(r.cols)) {
        r.colA = r.cols[state.settings.colAKey] || '';
        r.colB = r.cols[state.settings.colBKey] || '';
      }
    }
  }
  els.colA.addEventListener('change', () => { state.settings.colAKey = parseInt(els.colA.value,10); remapFromCols(); renderGrid(); renderPreview(); });
  els.colB.addEventListener('change', () => { state.settings.colBKey = parseInt(els.colB.value,10); remapFromCols(); renderGrid(); renderPreview(); });
  els.theme.addEventListener('change', () => { state.settings.theme = els.theme.value; renderPreview(); });
  els.font.addEventListener('change', () => { state.settings.font = els.font.value; renderPreview(); });
  els.accent.addEventListener('input', () => { state.settings.accent = els.accent.value; renderPreview(); });
  els.wmm.addEventListener('input', () => { state.settings.widthMm = parseFloat(els.wmm.value)||85; renderPreview(); });
  els.hmm.addEventListener('input', () => { state.settings.heightMm = parseFloat(els.hmm.value)||55; renderPreview(); });
  els.marginmm.addEventListener('input', () => { state.settings.marginMm = parseFloat(els.marginmm.value)||6; renderPreview(); });
  els.align.addEventListener('change', () => { state.settings.align = els.align.value; renderPreview(); });

  els.generatePdf.addEventListener('click', exportAsPdf);
  els.generatePng.addEventListener('click', exportAsPngZipOrSingle);

  els.fileInput.addEventListener('change', async (ev) => {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    const ext = (file.name.split('.').pop()||'').toLowerCase();
    if (ext === 'csv') {
      const text = await file.text();
      loadCsv(text);
    } else if (ext === 'xlsx' || ext === 'xls' || ext === 'ods') {
      const buf = await file.arrayBuffer();
      loadXlsx(buf);
    } else {
      alert('Nicht unterstütztes Format');
    }
  });

  // Initialize with a sample row
  state.rows = [
    { id: uid(), colA: 'Beispiel Vorderseite', colB: 'Beispiel Rückseite' }
  ];
  state.selectedIds = new Set([state.rows[0].id]);
  setColumnsFromHeaders(["A","B"]);
  renderGrid();
  renderPreview();
})();
