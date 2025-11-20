/*
Client-side Lyapunov computation controller for the pendulum page.
- Spawns WebWorker 'pendulumWorker.js'
- Wires UI (modal, tabs, progress, charts, controls)
- Streams chart updates with throttling
*/
(function(){
  const $ = (id) => document.getElementById(id);
  const modal = $('lyapModal');
  const openBtn = $('lyapOpen');
  const closeBtn = $('lyapClose');
  const abortBtn = $('lyapAbort');
  const pauseBtn = $('lyapPause');
  const resumeBtn = $('lyapResume');
  const resetZoomBtn = $('lyapResetZoom');
  const exportPNGBtn = $('lyapExportPNG');
  const exportCSVBtn = $('lyapExportCSV');
  const metaEl = $('lyapMeta');
  const progressBar = $('lyapProgress');

  let worker = null;
  let charts = null;
  let lastRedraw = 0;
  const redrawIntervalMs = 150;
  const buffer = [];
  const state = {
    done: 0,
    total: 1,
    runningLambda: [],
    times: [],
    d: [],
    ln_d: [],
    finalLambda: null,
  };

  function showModal() { modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false'); }
  function hideModal() { modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true'); }

  function updateMeta(params) {
    const { gamma, f, Omega, theta0, omega0, dt, totalTime, delta0, renormInterval } = params;
    metaEl.textContent = `γ=${gamma} · f=${f} · Ω=${Omega} · θ0=${(theta0*180/Math.PI).toFixed(1)}° · ω0=${omega0.toFixed(2)} · Δt=${dt} · T=${totalTime}s · δ0=${delta0} · Tr=${renormInterval}`;
  }

  function buildCharts() {
    const make = (canvasId, label, color) => new Chart($(canvasId).getContext('2d'), {
      type: 'line',
      data: { datasets: [{ label, data: [], parsing: false, borderColor: color, pointRadius: 0, tension: 0 }] },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        scales: { x: { type: 'linear' }, y: { type: 'linear' } },
        plugins: { legend: { display: true } },
      }
    });
    const cD = make('chartD', 'd(t)', '#10b981');
    const cLn = make('chartLn', 'ln d(t)', '#60a5fa');
    const cLam = make('chartLambda', 'λ(t)', '#f59e0b');
    charts = { cD, cLn, cLam };
  }

  function switchTab(e) {
    const tgt = e.target.closest('.tab'); if (!tgt) return;
    document.querySelectorAll('.tab').forEach(el=>el.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(el=>el.classList.remove('active'));
    tgt.classList.add('active');
    const panel = document.getElementById(tgt.dataset.tab);
    if (panel) panel.classList.add('active');
  }

  function attachTabHandlers(){
    document.querySelector('.tabs').addEventListener('click', switchTab);
  }

  function throttleRedraw(){
    const now = performance.now();
    if (now - lastRedraw < redrawIntervalMs) return;
    lastRedraw = now;
    if (!charts) return;
    if (buffer.length) {
      for (const p of buffer.splice(0)) {
        charts.cD.data.datasets[0].data.push({ x: p.t, y: p.d });
        charts.cLn.data.datasets[0].data.push({ x: p.t, y: p.ln_d });
        if (typeof p.lambda_running === 'number') {
          charts.cLam.data.datasets[0].data.push({ x: p.t, y: p.lambda_running });
        }
      }
    }
    charts.cD.update('none');
    charts.cLn.update('none');
    charts.cLam.update('none');
  }

  function pumpRedraw(){
    throttleRedraw();
    requestAnimationFrame(pumpRedraw);
  }

  function getParamsFromUI(){
    // Use current single pendulum parameters from page controls
    const dt = parseFloat(document.getElementById('dt').value)||0.008;
    const damping = parseFloat(document.getElementById('damping').value)||0;
    const g = parseFloat(document.getElementById('g').value)||9.81;
    const l1 = parseFloat(document.getElementById('l1').value)||1.0;
    const th1deg = parseFloat(document.getElementById('th1').value)||45;
    const theta0 = th1deg * Math.PI/180;
    const omega0 = parseFloat(document.getElementById('w1').value)||0;
    // Lyapunov specific defaults
    const gamma = damping;
    const f = 0.0; // no external drive in base; extend later via UI
    const Omega = 0.0;
    const delta0 = 1e-8;
    const renormInterval = 0.05; // seconds
    const totalTime = 20.0; // seconds
    const chunkSize = 200; // steps per chunk
    return { gamma, f, Omega, theta0, omega0, dt, totalTime, delta0, renormInterval, g, l1 };
  }

  function startWorker() {
    if (worker) { worker.terminate(); worker = null; }
    worker = new Worker('/static/pendulumWorker.js');
    const params = getParamsFromUI();
    updateMeta(params);
    state.done = 0; state.total = Math.max(1, Math.round(params.totalTime / params.dt));
    state.runningLambda = []; state.times = []; state.d = []; state.ln_d = []; state.finalLambda = null;
    charts.cD.data.datasets[0].data = [];
    charts.cLn.data.datasets[0].data = [];
    charts.cLam.data.datasets[0].data = [];

    worker.onmessage = (ev) => {
      const msg = ev.data;
      if (!msg || !msg.type) return;
      if (msg.type === 'progress') {
        state.done = msg.done; state.total = msg.total || state.total;
        const pct = Math.max(0, Math.min(100, Math.round(100 * state.done / state.total)));
        progressBar.style.width = pct + '%';
      } else if (msg.type === 'chunk') {
        for (const p of msg.points) {
          buffer.push(p);
          state.times.push(p.t); state.d.push(p.d); state.ln_d.push(p.ln_d);
          if (typeof p.lambda_running === 'number') state.runningLambda.push(p.lambda_running);
        }
      } else if (msg.type === 'result') {
        state.finalLambda = msg.lambda;
        // Ensure last redraw
        throttleRedraw();
      } else if (msg.type === 'error') {
        console.error('Worker error:', msg.message);
      }
    };

    worker.postMessage({ cmd: 'start', params });
  }

  function exportPNG(){
    // export currently active chart
    const activePanel = document.querySelector('.panel.active canvas');
    if (!activePanel) return;
    const url = activePanel.toDataURL('image/png');
    const a = document.createElement('a'); a.href = url; a.download = 'lyapunov.png'; a.click();
  }

  function exportCSV(){
    const rows = ['t,d,ln_d,lambda_running'];
    for (let i = 0; i < state.times.length; i++) {
      const t = state.times[i]; const d = state.d[i]; const ln_d = state.ln_d[i];
      const lam = state.runningLambda[i] ?? '';
      rows.push(`${t},${d},${ln_d},${lam}`);
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'lyapunov.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  function wire(){
    openBtn.addEventListener('click', () => { showModal(); startWorker(); });
    closeBtn.addEventListener('click', () => { hideModal(); if (worker) { worker.terminate(); worker = null; } });
    abortBtn.addEventListener('click', () => { if (worker) worker.postMessage({ cmd: 'abort' }); });
    pauseBtn.addEventListener('click', () => { if (worker) worker.postMessage({ cmd: 'pause' }); });
    resumeBtn.addEventListener('click', () => { if (worker) worker.postMessage({ cmd: 'resume' }); });
    resetZoomBtn.addEventListener('click', () => { /* Chart.js zoom plugin could be added later */ });
    exportPNGBtn.addEventListener('click', exportPNG);
    exportCSVBtn.addEventListener('click', exportCSV);
    attachTabHandlers();
    buildCharts();
    pumpRedraw();
  }

  window.addEventListener('DOMContentLoaded', wire);
})();
