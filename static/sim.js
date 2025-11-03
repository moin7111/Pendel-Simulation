// Lightweight port of the Pendulum physics to JS with RK4 integration

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

function toRad(deg) { return deg * Math.PI / 180; }
function toDeg(rad) { return rad * 180 / Math.PI; }

function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }

const Physics = {
  singleDerivatives: (state, p) => {
    const [theta, omega] = state;
    const g = p.g, l = p.l1, damping = p.damping || 0;
    const dtheta = omega;
    const domega = -(g / l) * Math.sin(theta) - damping * omega;
    return [dtheta, domega];
  },
  doubleDerivatives: (state, p) => {
    const [th1, w1, th2, w2] = state;
    const m1 = p.m1, m2 = p.m2, l1 = p.l1, l2 = p.l2, g = p.g;
    const damping = p.damping || 0;
    const sin = Math.sin, cos = Math.cos;
    const delta = th1 - th2;
    const sin_th1 = sin(th1), cos_th1 = cos(th1);
    const sin_th2 = sin(th2), cos_th2 = cos(th2);
    const sin_delta = sin(delta), cos_delta = cos(delta);
    const cos_2delta = cos(2.0 * delta);
    const sin_th1_minus_2th2 = sin(th1 - 2.0 * th2);
    let denom = (2.0 * m1 + m2 - m2 * cos_2delta);
    if (Math.abs(denom) < 1e-9) denom = 1e-9;
    let num1 = -g * (2.0 * m1 + m2) * sin_th1;
    num1 -= m2 * g * sin_th1_minus_2th2;
    num1 -= 2.0 * sin_delta * m2 * (w2 * w2 * l2 + w1 * w1 * l1 * cos_delta);
    const domega1 = num1 / (l1 * denom) - damping * w1;
    let num2 = 2.0 * sin_delta * (
      w1 * w1 * l1 * (m1 + m2) +
      g * (m1 + m2) * cos_th1 +
      w2 * w2 * l2 * m2 * cos_delta
    );
    const domega2 = num2 / (l2 * denom) - damping * w2;
    return [w1, domega1, w2, domega2];
  },
  rk4Step: (state, dt, p, deriv) => {
    const k1 = deriv(state, p);
    const s2 = state.map((v, i) => v + 0.5 * dt * k1[i]);
    const k2 = deriv(s2, p);
    const s3 = state.map((v, i) => v + 0.5 * dt * k2[i]);
    const k3 = deriv(s3, p);
    const s4 = state.map((v, i) => v + dt * k3[i]);
    const k4 = deriv(s4, p);
    return state.map((v, i) => v + dt * (k1[i] + 2*k2[i] + 2*k3[i] + k4[i]) / 6);
  },
  normalizeAngles: (s) => {
    const wrap = (a) => {
      const twoPi = 2 * Math.PI;
      let x = (a + Math.PI) % twoPi;
      if (x < 0) x += twoPi;
      return x - Math.PI;
    };
    const out = s.slice();
    if (out.length >= 1) out[0] = wrap(out[0]);
    if (out.length >= 3) out[2] = wrap(out[2]);
    return out;
  }
};

function makeSystem(id, baseColor) {
  return {
    id,
    state: [toRad(45), 0, toRad(-30), 0],
    initialAngles: [toRad(45), toRad(-30)],
    m1: 1.0,
    m2: 1.0,
    trail: [],
    color: {
      bob1: baseColor,
      bob2: baseColor,
      trailRgb: baseColor.startsWith('#') ? hexToRgb(baseColor) : { r: 51, g: 102, b: 204 }
    },
    history: {
      time: [],
      energy: [],
      theta: [],
      omega: []
    }
  };
}

function hexToRgb(hex) {
  const v = hex.replace('#', '');
  const bigint = parseInt(v.length === 3 ? v.split('').map(c => c + c).join('') : v, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return { r, g, b };
}

class PendulumSim {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.phasePanels = [
      document.getElementById('phasePanel0'),
      document.getElementById('phasePanel1'),
    ];
    this.phaseCanvases = this.phasePanels.map((panel) => panel ? panel.querySelector('canvas') : null);
    this.phaseContexts = this.phaseCanvases.map((canvas) => (canvas ? canvas.getContext('2d') : null));
    this.params = { m1: 1.0, m2: 1.0, l1: 1.0, l2: 1.0, g: 9.81, damping: 0.0 };
    this.scale = 150; // px per meter
    this.mode = 'double';
    this.trailEnabled = true;
    this.persistTrail = true; // trails remain until reset
    this.maxTrail = 200;
    this.running = false;
    this.time = 0;
    this.dt = 0.008;
    this.speedFactor = 1.0;
    this.lastTs = 0;
    this.systems = [makeSystem(0, '#2563EB')];
    this.activeSystemIndex = 0;
    this._lastGeom = {};
    this.maxHistoryPoints = Infinity;
    this.historySampleInterval = 0.02; // seconds between history samples
    this._historyAccumulator = 0;
    this.exportLog = [];
    this.measurements = [];
    this.measurementDisplayLimit = 500;
    this.measurementFlushThreshold = 1000;
    this.measurementPersist = false;
    this._measurementBuffer = [];
    this._measurementRenderQueue = [];
    this._measurementRenderScheduled = false;
    this._measurementElements = {
      panel: null,
      body: null,
      count: null,
      wrap: null,
      empty: null,
      clear: null,
    };
    this.measurementUploadUrl = null;
    this._clearHistories();
    this._bindInputs();
    this._setupMeasurementEngine();
    this._initMeasurementUI();
    this._syncInputsFromActiveSystem();
    this._recordSnapshot(0, true);
    this._draw();
  }
  _bindInputs() {
    const byId = (id) => document.getElementById(id);
    const setParam = (key, parse) => (e) => { this.params[key] = parse(e.target.value); };
    byId('l1').addEventListener('input', setParam('l1', parseFloat));
    byId('l2').addEventListener('input', setParam('l2', parseFloat));
    byId('m1').addEventListener('input', (e) => { const v = parseFloat(e.target.value); const sys = this.systems[this.activeSystemIndex]; sys.m1 = isNaN(v) ? sys.m1 : v; });
    byId('m2').addEventListener('input', (e) => { const v = parseFloat(e.target.value); const sys = this.systems[this.activeSystemIndex]; sys.m2 = isNaN(v) ? sys.m2 : v; });
    byId('g').addEventListener('input', setParam('g', parseFloat));
    byId('damping').addEventListener('input', setParam('damping', parseFloat));
    byId('dt').addEventListener('input', (e) => { this.dt = clamp(parseFloat(e.target.value) || 0.008, 0.001, 0.05); });

    // angles/velocities apply to active pendulum
    byId('th1').addEventListener('input', (e) => {
      const sys = this.systems[this.activeSystemIndex];
      sys.state[0] = toRad(parseFloat(e.target.value) || 0); sys.state[1] = 0; sys.initialAngles[0] = sys.state[0]; this._draw();
    });
    byId('w1').addEventListener('input', (e) => { const sys = this.systems[this.activeSystemIndex]; sys.state[1] = parseFloat(e.target.value) || 0; this._draw(); });
    byId('th2').addEventListener('input', (e) => {
      const sys = this.systems[this.activeSystemIndex];
      sys.state[2] = toRad(parseFloat(e.target.value) || 0); sys.state[3] = 0; sys.initialAngles[1] = sys.state[2]; this._draw();
    });
    byId('w2').addEventListener('input', (e) => { const sys = this.systems[this.activeSystemIndex]; sys.state[3] = parseFloat(e.target.value) || 0; this._draw(); });

    // modes apply globally
    byId('modeDouble').addEventListener('click', () => {
      this.mode = 'double';
      this._recordSnapshot(0, true);
      this._draw();
      this._setMeasurementEmptyState(this.measurements.length > 0);
      if (this.measurementEngine?.ready && !this.measurementEngine.running) {
        this._updateMeasurementUI(undefined, 'Messung bereit');
      }
    });
    byId('modeSingle').addEventListener('click', () => {
      this.mode = 'single';
      if (this.measurementEngine?.running) {
        this._stopMeasurement('Messung gestoppt (Einzelpendel)');
      } else if (this.measurementEngine?.ready) {
        this._updateMeasurementUI(undefined, 'Nur im Doppelpendel-Modus verfuegbar');
      }
      this._recordSnapshot(0, true);
      this._draw();
      this._setMeasurementEmptyState(this.measurements.length > 0);
    });

    // trails
    byId('toggleTrail').addEventListener('click', () => { this.trailEnabled = !this.trailEnabled; /* do not clear to keep persistent until reset */ this._draw(); });
    const persistEl = byId('persistTrail'); if (persistEl) { persistEl.addEventListener('change', (e) => { this.persistTrail = !!e.target.checked; }); }

    const exportCsvBtn = byId('exportCsv');
    if (exportCsvBtn) exportCsvBtn.addEventListener('click', () => this.exportCSV());
    const exportPngBtn = byId('exportPng');
    if (exportPngBtn) exportPngBtn.addEventListener('click', () => this.exportPNG());

    // speed factor
    const speedSlider = byId('speedFactor');
    const speedNum = byId('speedFactorNum');
    const syncSpeed = (val) => { const v = clamp(parseFloat(val) || 1, 0.1, 10); this.speedFactor = v; speedSlider.value = String(v); speedNum.value = String(v); };
    if (speedSlider) speedSlider.addEventListener('input', (e) => syncSpeed(e.target.value));
    if (speedNum) speedNum.addEventListener('input', (e) => syncSpeed(e.target.value));

    // active pendulum selector
    const activeSel = byId('activePendulum');
    if (activeSel) activeSel.addEventListener('change', (e) => { this.activeSystemIndex = parseInt(e.target.value, 10) || 0; this._syncInputsFromActiveSystem(); this._draw(); });

    // add/remove pendulum
    const addBtn = byId('addPendulum');
    if (addBtn) addBtn.addEventListener('click', () => {
      if (this.systems.length >= 2) return;
      const sys = makeSystem(1, '#F59E0B');
      // copy current inputs as starting values
      const th1 = toRad(parseFloat(document.getElementById('th1').value) || 45);
      const th2 = toRad(parseFloat(document.getElementById('th2').value) || -30);
      const m1 = parseFloat(document.getElementById('m1').value) || 1.0;
      const m2 = parseFloat(document.getElementById('m2').value) || 1.0;
      sys.state = [th1, 0, th2, 0];
      sys.initialAngles = [th1, th2];
      sys.m1 = m1; sys.m2 = m2;
      this.systems.push(sys);
      if (activeSel) { activeSel.value = '1'; this.activeSystemIndex = 1; }
      this._syncInputsFromActiveSystem();
      this._recordSnapshot(0, true);
      this._draw();
    });
    const removeBtn = byId('removePendulum');
    if (removeBtn) removeBtn.addEventListener('click', () => {
      if (this.systems.length <= 1) return;
      this.systems = [this.systems[0]];
      if (activeSel) { activeSel.value = '0'; this.activeSystemIndex = 0; }
      this._syncInputsFromActiveSystem();
      this._recordSnapshot(0, true);
      this._draw();
    });

    // collapse controls
    const toggleControls = byId('toggleControls');
    if (toggleControls) toggleControls.addEventListener('click', () => {
      const aside = document.querySelector('.controls');
      if (aside) aside.classList.toggle('collapsed');
    });

    byId('startBtn').addEventListener('click', () => this.start());
    byId('stopBtn').addEventListener('click', () => this.stop());
    byId('resetBtn').addEventListener('click', () => this.reset());

    this.canvas.addEventListener('mousedown', (e) => this._onPointerDown(e));
    this.canvas.addEventListener('mousemove', (e) => this._onPointerMove(e));
    window.addEventListener('mouseup', () => this._onPointerUp());
    // Touch support
    this.canvas.addEventListener('touchstart', (e) => { e.preventDefault(); this._onPointerDown(e.touches[0]); });
    this.canvas.addEventListener('touchmove', (e) => { e.preventDefault(); this._onPointerMove(e.touches[0]); });
    this.canvas.addEventListener('touchend', () => this._onPointerUp());
    window.addEventListener('resize', () => this._draw());
  }
  start() {
    if (this.running) return;
    this.running = true;
    if (this.measurementEngine?.running) {
      this._updateMeasurementUI(undefined, 'Messung laeuft');
    }
    this.lastTs = performance.now();
    const loop = (ts) => {
      if (!this.running) return;
      const elapsed = (ts - this.lastTs) / 1000;
      this.lastTs = ts;
      // integrate in fixed dt steps for stability
      let acc = elapsed * this.speedFactor;
      const stepsMax = 100;
      let steps = 0;
      while (acc > 1e-6 && steps < stepsMax) {
        const dt = Math.min(this.dt, acc);
        this._step(dt);
        acc -= dt; steps += 1;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  stop() {
    this.running = false;
    if (this.measurementEngine?.running) {
      this._updateMeasurementUI(undefined, 'Pausiert (Simulation gestoppt)');
    }
  }
  reset() {
    // clear trails
    this.systems.forEach((sys) => { sys.trail = []; sys.state = [sys.initialAngles[0], 0, sys.initialAngles[1], 0]; });
    this.time = 0;
    this._clearHistories();
    this._resetMeasurement();
    this._recordSnapshot(0, true);
    this._draw();
  }
  _step(dt) {
    const deriv = this.mode === 'double' ? Physics.doubleDerivatives : Physics.singleDerivatives;
    for (let i = 0; i < this.systems.length; i++) {
      const sys = this.systems[i];
      const stateLocal = this.mode === 'double' ? sys.state : sys.state.slice(0, 2);
      const paramsLocal = Object.assign({}, this.params, { m1: sys.m1 ?? this.params.m1, m2: sys.m2 ?? this.params.m2 });
      const next = Physics.rk4Step(stateLocal, dt, paramsLocal, deriv);
      if (this.mode === 'double') sys.state = next; else sys.state = [next[0], next[1], sys.state[2], sys.state[3]];
      sys.state = Physics.normalizeAngles(sys.state);
    }
    this.time += dt;
    this._recordSnapshot(dt);
    this._measurementStep(dt);
    this._draw();
  }
  _draw() {
    const ctx = this.ctx, c = this.canvas;
    const w = c.clientWidth, h = c.clientHeight;
    if (c.width !== w || c.height !== h) {
      c.width = w; c.height = h;
    }
    ctx.clearRect(0, 0, c.width, c.height);
    // background grid
    ctx.fillStyle = '#0a0f1a';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 1;
    const grid = 50;
    ctx.beginPath();
    for (let x = 0; x < w; x += grid) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let y = 0; y < h; y += grid) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
    // origin and geometry
    const originX = w / 2; const originY = h * 0.2;
    const l1 = this.params.l1 * this.scale; const l2 = this.params.l2 * this.scale;
    this._lastGeom = {};
    for (let i = 0; i < this.systems.length; i++) {
      const sys = this.systems[i];
      let x1, y1, x2, y2;
      if (this.mode === 'double') {
        const [th1, , th2] = sys.state;
        x1 = originX + l1 * Math.sin(th1);
        y1 = originY + l1 * Math.cos(th1);
        x2 = x1 + l2 * Math.sin(th2);
        y2 = y1 + l2 * Math.cos(th2);
      } else {
        const [th1] = sys.state;
        x1 = originX + l1 * Math.sin(th1);
        y1 = originY + l1 * Math.cos(th1);
        x2 = x1; y2 = y1;
      }
      this._lastGeom[sys.id] = { originX, originY, x1, y1, l1, l2, x2, y2 };

      // trail per system
      if (this.trailEnabled) {
        sys.trail.push([x2, y2]);
        const trailStart = this.persistTrail ? 0 : Math.max(0, sys.trail.length - this.maxTrail);
        const visibleLength = Math.max(1, sys.trail.length - trailStart);
        for (let t = trailStart + 1; t < sys.trail.length; t++) {
          const alpha = 0.25 + 0.75 * ((t - trailStart) / visibleLength);
          const { r, g, b } = sys.color.trailRgb;
          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(sys.trail[t-1][0], sys.trail[t-1][1]);
          ctx.lineTo(sys.trail[t][0], sys.trail[t][1]);
          ctx.stroke();
        }
      }

      // rods
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(originX, originY); ctx.lineTo(x1, y1); ctx.stroke();
      if (this.mode === 'double') { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
      // bobs colored by system
      ctx.fillStyle = sys.color.bob1; circle(ctx, x1, y1, 10);
      if (this.mode === 'double') { ctx.fillStyle = sys.color.bob2; circle(ctx, x2, y2, 8); }
    }
    this._drawMeasurementOverlay(ctx, originX, originY);

    // origin
    ctx.fillStyle = '#e5e7eb'; circle(ctx, originX, originY, 4);
    // time
    document.getElementById('timeValue').textContent = this.time.toFixed(2);
    this._drawAuxiliaryCharts();
  }
  _drawAuxiliaryCharts() {
    this._drawPhasePlots();
  }
  _prepareChartCanvas(canvas, ctx) {
    if (!canvas || !ctx) return null;
    const width = canvas.clientWidth || canvas.width;
    const height = canvas.clientHeight || canvas.height;
    if (!width || !height) return null;
    const dpr = window.devicePixelRatio || 1;
    const targetWidth = Math.max(1, Math.round(width * dpr));
    const targetHeight = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);
    return { ctx, width, height };
  }
  _drawPhasePlots() {
    if (!this.phaseCanvases || !this.phaseContexts) return;
    for (let i = 0; i < this.phaseCanvases.length; i++) {
      const canvas = this.phaseCanvases[i];
      const ctx = this.phaseContexts[i];
      if (!canvas || !ctx) continue;
      const panel = this.phasePanels[i];
      const sys = this.systems[i];

      if (!sys || !sys.history.theta.length) {
        if (panel && i > 0) panel.hidden = true;
        const prepared = this._prepareChartCanvas(canvas, ctx);
        if (prepared && i === 0) {
          const { ctx: drawCtx, width, height } = prepared;
          drawCtx.fillStyle = 'rgba(8,11,20,0.95)';
          drawCtx.fillRect(0, 0, width, height);
          drawCtx.fillStyle = '#9ca3af';
          drawCtx.font = '12px system-ui';
          drawCtx.fillText('Keine Daten', 12, height / 2);
          drawCtx.restore();
        } else if (prepared) {
          prepared.ctx.restore();
        }
        continue;
      }

      if (panel) panel.hidden = false;
      this._drawPhasePlotFor(canvas, ctx, sys, i);
    }
  }
  _drawPhasePlotFor(canvas, ctx, sys, systemIndex) {
    const prepared = this._prepareChartCanvas(canvas, ctx);
    if (!prepared) return;
    const { ctx: drawCtx, width, height } = prepared;
    drawCtx.fillStyle = 'rgba(8,11,20,0.95)';
    drawCtx.fillRect(0, 0, width, height);

    const thetas = sys.history.theta;
    const omegas = sys.history.omega;
    if (!thetas.length || !omegas.length) {
      drawCtx.fillStyle = '#9ca3af';
      drawCtx.font = '12px system-ui';
      drawCtx.fillText('Keine Daten', 12, height / 2);
      drawCtx.restore();
      return;
    }

    let thetaMin = Infinity;
    let thetaMax = -Infinity;
    let omegaMin = Infinity;
    let omegaMax = -Infinity;
    for (let i = 0; i < thetas.length; i++) {
      const th = thetas[i];
      const om = omegas[i];
      if (Number.isFinite(th)) {
        if (th < thetaMin) thetaMin = th;
        if (th > thetaMax) thetaMax = th;
      }
      if (Number.isFinite(om)) {
        if (om < omegaMin) omegaMin = om;
        if (om > omegaMax) omegaMax = om;
      }
    }
    if (!Number.isFinite(thetaMin) || !Number.isFinite(thetaMax)) { thetaMin = -Math.PI; thetaMax = Math.PI; }
    if (!Number.isFinite(omegaMin) || !Number.isFinite(omegaMax)) { omegaMin = -5; omegaMax = 5; }

    const thetaRange = Math.max(0.1, thetaMax - thetaMin);
    const omegaRange = Math.max(0.1, omegaMax - omegaMin);
    const thetaPad = thetaRange * 0.1 + 0.05;
    const omegaPad = omegaRange * 0.1 + 0.05;
    thetaMin -= thetaPad;
    thetaMax += thetaPad;
    omegaMin -= omegaPad;
    omegaMax += omegaPad;

    const plotWidth = width - 24;
    const plotHeight = height - 24;
    const toX = (theta) => 12 + ((theta - thetaMin) / (thetaMax - thetaMin || 1)) * plotWidth;
    const toY = (omega) => height - 12 - ((omega - omegaMin) / (omegaMax - omegaMin || 1)) * plotHeight;

    if (thetaMin < 0 && thetaMax > 0) {
      const zeroX = toX(0);
      drawCtx.strokeStyle = 'rgba(148,163,184,0.25)';
      drawCtx.lineWidth = 1;
      drawCtx.beginPath();
      drawCtx.moveTo(zeroX, 12);
      drawCtx.lineTo(zeroX, height - 12);
      drawCtx.stroke();
    }
    if (omegaMin < 0 && omegaMax > 0) {
      const zeroY = toY(0);
      drawCtx.strokeStyle = 'rgba(148,163,184,0.25)';
      drawCtx.lineWidth = 1;
      drawCtx.beginPath();
      drawCtx.moveTo(12, zeroY);
      drawCtx.lineTo(width - 12, zeroY);
      drawCtx.stroke();
    }

    drawCtx.lineWidth = 1.4;
    drawCtx.strokeStyle = systemIndex === 0 ? '#f97316' : '#fb7185';
    drawCtx.beginPath();
    for (let i = 0; i < thetas.length; i++) {
      const x = toX(thetas[i]);
      const y = toY(omegas[i]);
      if (i === 0) drawCtx.moveTo(x, y); else drawCtx.lineTo(x, y);
    }
    drawCtx.stroke();

    const lastTheta = thetas[thetas.length - 1];
    const lastOmega = omegas[omegas.length - 1];
    drawCtx.fillStyle = systemIndex === 0 ? '#fde68a' : '#fbcfe8';
    drawCtx.beginPath();
    drawCtx.arc(toX(lastTheta), toY(lastOmega), 3, 0, Math.PI * 2);
    drawCtx.fill();

    drawCtx.fillStyle = '#94a3b8';
    drawCtx.font = '11px system-ui';
    drawCtx.fillText('theta1 ~ ' + (lastTheta * 180 / Math.PI).toFixed(1) + ' deg', 12, 16);
    drawCtx.fillText('omega1 ~ ' + lastOmega.toFixed(2) + ' rad/s', 12, height - 8);

    drawCtx.restore();
  }
  _computeEnergy(sys) {
    const p = this.params;
    const g = p.g;
    const l1 = p.l1;
    const l2 = p.l2;
    const m1 = sys.m1 != null ? sys.m1 : p.m1;
    const m2 = sys.m2 != null ? sys.m2 : p.m2;
    const [th1, w1, th2 = 0, w2 = 0] = sys.state;
    if (this.mode === 'single') {
      const kinetic = 0.5 * m1 * l1 * l1 * w1 * w1;
      const potential = -m1 * g * l1 * Math.cos(th1);
      return kinetic + potential;
    }
    const kinetic = 0.5 * m1 * l1 * l1 * w1 * w1 +
      0.5 * m2 * (l1 * l1 * w1 * w1 + l2 * l2 * w2 * w2 + 2 * l1 * l2 * w1 * w2 * Math.cos(th1 - th2));
    const potential = -(m1 + m2) * g * l1 * Math.cos(th1) - m2 * g * l2 * Math.cos(th2);
    return kinetic + potential;
  }
  _clearHistories() {
    this.exportLog = [];
    this._historyAccumulator = 0;
    this.systems.forEach((sys) => {
      sys.history = { time: [], energy: [], theta: [], omega: [] };
    });
  }
  _recordSnapshot(dt = 0, force = false) {
    if (!this.systems.length) return;
    if (!force) {
      this._historyAccumulator += dt;
      if (this._historyAccumulator + 1e-6 < this.historySampleInterval) return;
      this._historyAccumulator -= this.historySampleInterval;
    } else {
      this._historyAccumulator = 0;
    }

    const timestamp = this.time;
    const mode = this.mode;
    const l1 = this.params.l1;
    const l2 = this.params.l2;
    const g = this.params.g;
    const defaultM1 = this.params.m1;
    const defaultM2 = this.params.m2;

    for (let i = 0; i < this.systems.length; i++) {
      const sys = this.systems[i];
      const energy = this._computeEnergy(sys);
      const [theta1, omega1, theta2 = 0, omega2 = 0] = sys.state;
      const history = sys.history;
      history.time.push(timestamp);
      history.energy.push(energy);
      history.theta.push(theta1);
      history.omega.push(omega1);
      if (history.time.length > this.maxHistoryPoints) {
        history.time.shift();
        history.energy.shift();
        history.theta.shift();
        history.omega.shift();
      }
      this.exportLog.push({
        time: timestamp,
        systemId: sys.id,
        mode,
        theta1,
        omega1,
        theta2: mode === 'double' ? theta2 : null,
        omega2: mode === 'double' ? omega2 : null,
        energy,
        m1: sys.m1 != null ? sys.m1 : defaultM1,
        m2: mode === 'double' ? (sys.m2 != null ? sys.m2 : defaultM2) : null,
        l1,
        l2: mode === 'double' ? l2 : null,
        g,
      });
    }
  }
  exportCSV() {
    if (!this.exportLog.length) return;
    const header = 'time,system_id,mode,theta1_rad,theta1_deg,omega1,theta2_rad,theta2_deg,omega2,energy,m1,m2,l1,l2,g\n';
    const rows = this.exportLog.map((entry) => {
      const theta1Deg = entry.theta1 * 180 / Math.PI;
      const theta2Deg = entry.theta2 != null ? entry.theta2 * 180 / Math.PI : null;
      const fields = [
        entry.time.toFixed(5),
        entry.systemId,
        entry.mode,
        entry.theta1.toFixed(6),
        theta1Deg.toFixed(3),
        entry.omega1.toFixed(6),
        entry.theta2 != null ? entry.theta2.toFixed(6) : '',
        entry.theta2 != null && Number.isFinite(theta2Deg) ? theta2Deg.toFixed(3) : '',
        entry.omega2 != null ? entry.omega2.toFixed(6) : '',
        entry.energy.toFixed(6),
        entry.m1 != null ? entry.m1 : '',
        entry.m2 != null ? entry.m2 : '',
        entry.l1,
        entry.l2 != null ? entry.l2 : '',
        entry.g,
      ];
      return fields.join(',');
    }).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const modeLabel = this.mode === 'double' ? 'double' : 'single';
    link.download = `pendulum-${modeLabel}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  exportPNG() {
    if (!this.canvas) return;
    const url = this.canvas.toDataURL('image/png');
    const link = document.createElement('a');
    const modeLabel = this.mode === 'double' ? 'double' : 'single';
    link.href = url;
    link.download = `pendulum-${modeLabel}.png`;
    link.click();
  }
  _onPointerDown(e) {
    this._dragging = this._hitTest(e);
  }
  _onPointerMove(e) {
    if (!this._dragging) return;
    const rect = this.canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left);
    const py = (e.clientY - rect.top);
    const { sysId, part } = this._dragging;
    const geom = this._lastGeom[sysId] || {};
    const { originX, originY, l1 } = geom;
    if (originX == null) return;
    const angleFrom = (ox, oy, tx, ty) => Math.atan2(tx - ox, ty - oy);
    const sys = this.systems.find(s => s.id === sysId);
    if (!sys) return;
    if (part === 'bob1') {
      const th1 = angleFrom(originX, originY, px, py);
      sys.state[0] = th1; sys.state[1] = 0;
      sys.initialAngles[0] = th1;
      if (sys.id === this.activeSystemIndex) {
        const th1El = document.getElementById('th1'); if (th1El) th1El.value = String(Math.round(toDeg(th1)));
      }
    } else if (part === 'bob2' && this.mode === 'double') {
      const th1 = sys.state[0];
      const nx1 = originX + l1 * Math.sin(th1);
      const ny1 = geom.originY + l1 * Math.cos(th1);
      const th2 = angleFrom(nx1, ny1, px, py);
      sys.state[2] = th2; sys.state[3] = 0;
      sys.initialAngles[1] = th2;
      if (sys.id === this.activeSystemIndex) {
        const th2El = document.getElementById('th2'); if (th2El) th2El.value = String(Math.round(toDeg(th2)));
      }
    }
    sys.state = Physics.normalizeAngles(sys.state);
    this._draw();
  }
  _onPointerUp() { this._dragging = null; }
  _hitTest(e) {
    const rect = this.canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left);
    const py = (e.clientY - rect.top);
    const dist2 = (ax, ay, bx, by) => (ax-bx)*(ax-bx) + (ay-by)*(ay-by);
    let best = null; let bestD = Infinity;
    for (let i = 0; i < this.systems.length; i++) {
      const sys = this.systems[i];
      const g = this._lastGeom[sys.id];
      if (!g) continue;
      const d1 = dist2(px, py, g.x1, g.y1);
      if (d1 < bestD && d1 < 20*20) { bestD = d1; best = { sysId: sys.id, part: 'bob1' }; }
      if (this.mode === 'double') {
        const d2 = dist2(px, py, g.x2, g.y2);
        if (d2 < bestD && d2 < 20*20) { bestD = d2; best = { sysId: sys.id, part: 'bob2' }; }
      }
    }
    return best;
  }
  _setupMeasurementEngine() {
    const startBtn = document.getElementById('measurementStart');
    const stopBtn = document.getElementById('measurementStop');
    const resetBtn = document.getElementById('measurementReset');
    const deltaInput = document.getElementById('measurementDelta');
    const intervalInput = document.getElementById('measurementInterval');
    const sampleInput = document.getElementById('measurementSample');
    const statusEl = document.getElementById('measurementStatus');
    const lambdaEl = document.getElementById('measurementLambda');
    const lambdaAvgEl = document.getElementById('measurementLambdaAvg');
    const renormEl = document.getElementById('measurementRenorm');
    const timeEl = document.getElementById('measurementTime');
    const distanceEl = document.getElementById('measurementDistance');
    const logCanvas = document.getElementById('measurementLogCanvas');
    const lambdaCanvas = document.getElementById('measurementLambdaCanvas');

    this.measurementEngine = {
      startBtn,
      stopBtn,
      resetBtn,
      deltaInput,
      intervalInput,
      sampleInput,
      statusEl,
      lambdaEl,
      lambdaAvgEl,
      renormEl,
      timeEl,
      distanceEl,
      logCanvas,
      logCtx: logCanvas ? logCanvas.getContext('2d') : null,
      lambdaCanvas,
      lambdaCtx: lambdaCanvas ? lambdaCanvas.getContext('2d') : null,
      running: false,
      ready: false,
      mode: null,
      baseState: null,
      pertState: null,
      paramsSnapshot: null,
      delta0: 0,
      lastDistance: Number.NaN,
      lastCartesianDistance: Number.NaN,
      sumLn: 0,
      renormCount: 0,
      renormAccumTime: 0,
      lastLambda: Number.NaN,
      time: 0,
      sampleTimer: 0,
      renormTimer: 0,
      data: { time: [], log: [], lambda: [] },
      measurements: this.measurements,
      _renormSinceLastSample: false,
      lastPositions: null,
    };

    if (startBtn) startBtn.addEventListener('click', () => this._startMeasurement(true));
    if (stopBtn) stopBtn.addEventListener('click', () => this._stopMeasurement());
    if (resetBtn) resetBtn.addEventListener('click', () => this._resetMeasurement());

    this._drawMeasurementCharts(true);
    this._updateMeasurementUI();
  }
  _initMeasurementUI() {
    const panel = document.getElementById('measurementPanel');
    const body = document.getElementById('measurementTableBody');
    const count = document.getElementById('measurementCount');
    const wrap = document.getElementById('measurementTableWrap');
    const empty = document.getElementById('measurementEmpty');
    const clearBtn = document.getElementById('measurementClear');
    this._measurementElements = { panel, body, count, wrap, empty, clear: clearBtn };

    const persistCheckbox = document.getElementById('measurementPersist');
    if (persistCheckbox) {
      this.measurementPersist = !!persistCheckbox.checked;
      persistCheckbox.addEventListener('change', (event) => {
        this.measurementPersist = !!event.target.checked;
      });
    }

    const exportCsvBtn = document.getElementById('measurementExportCsv');
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', () => this.exportMeasurementsAsCSV());
    }
    const exportJsonBtn = document.getElementById('measurementExportJson');
    if (exportJsonBtn) {
      exportJsonBtn.addEventListener('click', () => this.exportMeasurementsAsJSON());
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this._clearMeasurements());
      clearBtn.disabled = this.measurements.length === 0;
    }

    this._measurementRenderQueue = [];
    this._measurementRenderScheduled = false;
    this._renderMeasurementsFromSource();
  }
  _renderMeasurementsFromSource() {
    const body = this._measurementElements.body;
    if (!body) return;
    body.innerHTML = '';
    const slice = this.measurements.slice(-this.measurementDisplayLimit);
    for (let i = 0; i < slice.length; i++) {
      this._appendMeasurementRow(slice[i], body);
    }
    if (this._measurementElements.count) {
      this._measurementElements.count.textContent = String(this.measurements.length);
    }
    this._setMeasurementEmptyState(this.measurements.length > 0);
    const wrap = this._measurementElements.wrap;
    if (wrap) {
      wrap.scrollTop = wrap.scrollHeight;
    }
  }
  _queueMeasurementRender(entry) {
    if (!this._measurementElements.body) return;
    this._measurementRenderQueue.push(entry);
    if (this._measurementRenderScheduled) return;
    this._measurementRenderScheduled = true;
    requestAnimationFrame(() => this._flushMeasurementRenderQueue());
  }
  _flushMeasurementRenderQueue() {
    const body = this._measurementElements.body;
    if (!body) {
      this._measurementRenderQueue = [];
      this._measurementRenderScheduled = false;
      return;
    }
    const wrap = this._measurementElements.wrap;
    const limit = this.measurementDisplayLimit;
    const autoScroll = wrap ? (wrap.scrollHeight - wrap.clientHeight - wrap.scrollTop) <= 16 : false;
    for (let i = 0; i < this._measurementRenderQueue.length; i++) {
      this._appendMeasurementRow(this._measurementRenderQueue[i], body);
      while (body.rows && body.rows.length > limit) {
        body.deleteRow(0);
      }
    }
    this._measurementRenderQueue = [];
    this._measurementRenderScheduled = false;
    if (this._measurementElements.count) {
      this._measurementElements.count.textContent = String(this.measurements.length);
    }
    this._setMeasurementEmptyState(this.measurements.length > 0);
    if (wrap && autoScroll) {
      wrap.scrollTop = wrap.scrollHeight;
    }
  }
  _appendMeasurementRow(entry, bodyOverride) {
    const body = bodyOverride || this._measurementElements.body;
    if (!body) return;
    const tr = document.createElement('tr');
    if (entry.renorm) tr.classList.add('renorm');
    const timeCell = document.createElement('td');
    const timeFixed = Number.isFinite(entry.t) ? entry.t.toFixed(2) : 'N/A';
    timeCell.textContent = timeFixed;
    if (Number.isFinite(entry.t)) {
      timeCell.title = entry.t.toFixed(4);
    }
    const distCell = document.createElement('td');
    if (Number.isFinite(entry.dist)) {
      distCell.textContent = entry.dist.toFixed(2);
      distCell.title = entry.dist.toPrecision(6);
    } else {
      distCell.textContent = 'N/A';
    }
    const renormCell = document.createElement('td');
    renormCell.textContent = entry.renorm ? 'Ja' : '-';
    if (entry.renorm) {
      renormCell.setAttribute('aria-label', 'Renormierung');
    }
    tr.appendChild(timeCell);
    tr.appendChild(distCell);
    tr.appendChild(renormCell);
    body.appendChild(tr);
  }
  _setMeasurementEmptyState(hasData) {
    const panel = this._measurementElements.panel;
    if (panel) {
      panel.setAttribute('data-has-data', hasData ? 'true' : 'false');
    }
    const empty = this._measurementElements.empty;
    if (empty) {
      if (hasData) {
        empty.textContent = '';
      } else {
        empty.textContent = 'Noch keine Messdaten - Messung starten.';
      }
    }
    const clearBtn = this._measurementElements.clear;
    if (clearBtn) {
      clearBtn.disabled = !hasData;
    }
  }
  _clearMeasurements() {
    this.measurements.length = 0;
    this._measurementBuffer = [];
    if (this.measurementEngine) {
      this.measurementEngine.measurements = this.measurements;
      this.measurementEngine._renormSinceLastSample = false;
      this.measurementEngine.lastPositions = null;
    }
    this._measurementRenderQueue = [];
    this._measurementRenderScheduled = false;
    this._renderMeasurementsFromSource();
  }
  _recordMeasurement(timestamp, distance, renorm) {
    if (!Number.isFinite(timestamp) || !Number.isFinite(distance)) return;
    const entry = {
      t: Number(timestamp.toFixed(4)),
      dist: Number(distance.toPrecision(6)),
      renorm: !!renorm,
    };
    this.measurements.push(entry);
    this._measurementBuffer.push(entry);
    const maxStored = 100000;
    const pruneThreshold = maxStored + 20000;
    if (this.measurements.length > pruneThreshold) {
      this.measurements.splice(0, this.measurements.length - maxStored);
    }
    if (this._measurementBuffer.length >= this.measurementFlushThreshold) {
      this._maybeUploadMeasurementChunk();
    }
    this._queueMeasurementRender(entry);
  }
  async _maybeUploadMeasurementChunk() {
    if (!this.measurementUploadUrl) {
      if (this._measurementBuffer.length > this.measurementFlushThreshold) {
        this._measurementBuffer.splice(0, this._measurementBuffer.length - this.measurementFlushThreshold);
      }
      return;
    }
    const payload = this._measurementBuffer.slice();
    const body = JSON.stringify(payload);
    try {
      const res = await fetch(this.measurementUploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      this._measurementBuffer = [];
    } catch (err) {
      console.warn('Messdaten konnten nicht hochgeladen werden:', err);
      if (this._measurementBuffer.length > this.measurementFlushThreshold * 2) {
        this._measurementBuffer.splice(0, this._measurementBuffer.length - this.measurementFlushThreshold * 2);
      }
    }
  }
  exportMeasurementsAsCSV() {
    if (!this.measurements.length) return;
    const header = 'time_s,distance_m,renorm\n';
    const lines = this.measurements.map((entry) => {
      const time = Number.isFinite(entry.t) ? entry.t.toFixed(4) : '';
      const dist = Number.isFinite(entry.dist) ? entry.dist.toPrecision(6) : '';
      const renorm = entry.renorm ? '1' : '0';
      return `${time},${dist},${renorm}`;
    });
    const modeLabel = this.mode === 'double' ? 'double' : 'single';
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0];
    this._downloadMeasurementBlob(`pendulum-measurements-${modeLabel}-${stamp}.csv`, 'text/csv;charset=utf-8;', header + lines.join('\n'));
  }
  exportMeasurementsAsJSON() {
    if (!this.measurements.length) return;
    const payload = JSON.stringify(this.measurements, null, 2);
    const modeLabel = this.mode === 'double' ? 'double' : 'single';
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0];
    this._downloadMeasurementBlob(`pendulum-measurements-${modeLabel}-${stamp}.json`, 'application/json', payload);
  }
  _downloadMeasurementBlob(filename, mime, content) {
    try {
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download fehlgeschlagen:', err);
    }
  }
  _startMeasurement(autoStart = true) {
    const M = this.measurementEngine;
    if (!M) return;
    const sys = this.systems[this.activeSystemIndex] || this.systems[0];
    if (!sys) return;

    const mode = this.mode;
    const baseState = mode === 'double' ? sys.state.slice() : sys.state.slice(0, 2);
    if (mode === 'double') {
      while (baseState.length < 4) baseState.push(0);
    }

    const deltaDeg = Number.parseFloat(M.deltaInput?.value ?? '0.05');
    const fallbackDeg = Number.isFinite(deltaDeg) && deltaDeg > 0 ? deltaDeg : 0.05;
    const deltaRad = fallbackDeg * Math.PI / 180;
    const pertState = baseState.slice();
    pertState[0] += deltaRad;
    if (mode === 'double') {
      pertState[2] += deltaRad;
    }

    const normalizedBase = Physics.normalizeAngles(baseState);
    const normalizedPert = Physics.normalizeAngles(pertState);
    const diff = this._measurementStateDifference(normalizedBase, normalizedPert, mode);
    let delta0 = this._measurementStateNorm(diff, mode);
    if (!Number.isFinite(delta0) || delta0 <= 0) {
      const fallback = Math.max(deltaRad, 1e-6);
      delta0 = mode === 'double' ? Math.sqrt(2) * fallback : fallback;
    }

    const paramsSnapshot = {
      m1: sys.m1 != null ? sys.m1 : this.params.m1,
      m2: sys.m2 != null ? sys.m2 : this.params.m2,
      l1: this.params.l1,
      l2: this.params.l2,
      g: this.params.g,
      damping: this.params.damping || 0,
      mode,
    };

    Object.assign(M, {
      mode,
      baseState: normalizedBase,
      pertState: normalizedPert,
      paramsSnapshot,
      delta0,
      lastDistance: delta0,
      lastCartesianDistance: Number.NaN,
      sumLn: 0,
      renormCount: 0,
      renormAccumTime: 0,
      lastLambda: Number.NaN,
      time: 0,
      sampleTimer: 0,
      renormTimer: 0,
      data: { time: [], log: [], lambda: [] },
      running: true,
      ready: true,
      _renormSinceLastSample: false,
      lastPositions: null,
    });
    M.measurements = this.measurements;

    if (!this.measurementPersist) {
      this._clearMeasurements();
    } else {
      this._setMeasurementEmptyState(this.measurements.length > 0);
    }

    this._drawMeasurementCharts(true);
    this._updateMeasurementUI(delta0, 'Messung laeuft');

    if (autoStart && !this.running) {
      this.start();
    }
  }
  _stopMeasurement(message) {
    const M = this.measurementEngine;
    if (!M) return;
    if (!M.ready) {
      this._updateMeasurementUI(undefined, message ?? 'Bereit');
      return;
    }
    M.running = false;
    M._renormSinceLastSample = false;
    if (!this.measurementPersist) {
      this._clearMeasurements();
    } else {
      this._setMeasurementEmptyState(this.measurements.length > 0);
    }
    this._updateMeasurementUI(undefined, message ?? 'Messung pausiert');
  }
  _resetMeasurement() {
    const M = this.measurementEngine;
    if (!M) return;
    M.running = false;
    M.ready = false;
    M.mode = null;
    M.baseState = null;
    M.pertState = null;
    M.paramsSnapshot = null;
    M.delta0 = 0;
    M.lastDistance = Number.NaN;
    M.lastCartesianDistance = Number.NaN;
    M.sumLn = 0;
    M.renormCount = 0;
    M.renormAccumTime = 0;
    M.lastLambda = Number.NaN;
    M.time = 0;
    M.sampleTimer = 0;
    M.renormTimer = 0;
    M.data = { time: [], log: [], lambda: [] };
    M._renormSinceLastSample = false;
    M.lastPositions = null;
    if (!this.measurementPersist) {
      this._clearMeasurements();
    } else {
      this._setMeasurementEmptyState(this.measurements.length > 0);
    }
    this._drawMeasurementCharts(true);
    this._updateMeasurementUI();
  }
  _measurementStep(dt) {
    const M = this.measurementEngine;
    if (!M || !M.running) return;
    if (!M.baseState || !M.pertState || !M.paramsSnapshot) return;
    if (this.mode !== M.mode) {
      this._stopMeasurement('Modus geaendert - Messung gestoppt');
      return;
    }

    const params = Object.assign({}, M.paramsSnapshot);
    params.damping = params.damping || 0;
    const deriv = M.mode === 'double' ? Physics.doubleDerivatives : Physics.singleDerivatives;

    M.baseState = Physics.normalizeAngles(Physics.rk4Step(M.baseState, dt, params, deriv));
    M.pertState = Physics.normalizeAngles(Physics.rk4Step(M.pertState, dt, params, deriv));

    const diff = this._measurementStateDifference(M.baseState, M.pertState, M.mode);
    let distance = this._measurementStateNorm(diff, M.mode);
    if (!Number.isFinite(distance) || distance <= 1e-18) distance = 1e-18;
    M.lastDistance = distance;

    const intervalRaw = Number.parseFloat(M.intervalInput?.value ?? '0.12');
    const renormInterval = Math.max(0.02, Number.isFinite(intervalRaw) ? intervalRaw : 0.12);
    M.renormTimer += dt;
    let renormed = false;
    if (M.renormTimer >= renormInterval) {
      M.renormTimer -= renormInterval;
      const reference = M.delta0 || 1e-12;
      const ratio = distance / reference;
      if (ratio > 0) {
        const lnRatio = Math.log(ratio);
        M.sumLn += lnRatio;
        M.renormCount += 1;
        M.renormAccumTime += renormInterval;
        if (M.renormAccumTime > 0) {
          M.lastLambda = M.sumLn / M.renormAccumTime;
        }
      }
      this._measurementRenormalize(diff, M);
      distance = M.delta0;
      M.lastDistance = M.delta0;
      M._renormSinceLastSample = true;
      renormed = true;
    }

    const basePos = this._computeMeasurementPositions(M.baseState, M.mode, params);
    const pertPos = this._computeMeasurementPositions(M.pertState, M.mode, params);
    const baseTip = M.mode === 'double' ? { x: basePos.x2, y: basePos.y2 } : { x: basePos.x1, y: basePos.y1 };
    const pertTip = M.mode === 'double' ? { x: pertPos.x2, y: pertPos.y2 } : { x: pertPos.x1, y: pertPos.y1 };
    const cartesianDistance = Math.hypot(baseTip.x - pertTip.x, baseTip.y - pertTip.y);
    M.lastCartesianDistance = Number.isFinite(cartesianDistance) ? cartesianDistance : Number.NaN;
    M.lastPositions = { base: basePos, pert: pertPos };

    const sampleRaw = Number.parseFloat(M.sampleInput?.value ?? '40');
    const sampleInterval = Math.max(0.005, Number.isFinite(sampleRaw) ? sampleRaw / 1000 : 0.04);
    M.time += dt;
    M.sampleTimer += dt;
    if (M.sampleTimer >= sampleInterval) {
      M.sampleTimer -= sampleInterval;
      const logValue = Math.log(Math.max(distance, 1e-18));
      M.data.time.push(M.time);
      M.data.log.push(logValue);
      M.data.lambda.push(Number.isFinite(M.lastLambda) ? M.lastLambda : Number.NaN);
      const maxPoints = 1500;
      if (M.data.time.length > maxPoints) {
        M.data.time.shift();
        M.data.log.shift();
        M.data.lambda.shift();
      }
      this._recordMeasurement(this.time, M.lastCartesianDistance, M._renormSinceLastSample || renormed);
      M._renormSinceLastSample = false;
      this._drawMeasurementCharts();
    }

    this._updateMeasurementUI(M.lastCartesianDistance);
  }
  _drawMeasurementOverlay(ctx, originX, originY) {
    const M = this.measurementEngine;
    if (!M || !M.lastPositions || !M.ready) return;
    const { base, pert } = M.lastPositions;
    if (!base || !pert) return;
    if (!Number.isFinite(M.lastCartesianDistance)) return;
    const scale = this.scale;
    const useDouble = M.mode === 'double';

    const project = (x, y) => ({ x: originX + x * scale, y: originY + y * scale });
    const baseFirst = project(base.x1, base.y1);
    const baseSecond = project(useDouble ? base.x2 : base.x1, useDouble ? base.y2 : base.y1);
    const pertFirst = project(pert.x1, pert.y1);
    const pertSecond = project(useDouble ? pert.x2 : pert.x1, useDouble ? pert.y2 : pert.y1);
    const tipBase = useDouble ? baseSecond : baseFirst;
    const tipPert = useDouble ? pertSecond : pertFirst;

    ctx.save();

    // ghost pendulum (perturbed system)
    ctx.strokeStyle = 'rgba(248,113,113,0.65)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(pertFirst.x, pertFirst.y);
    if (useDouble) {
      ctx.lineTo(pertSecond.x, pertSecond.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(248,113,113,0.75)';
    circle(ctx, pertFirst.x, pertFirst.y, 7);
    if (useDouble) {
      circle(ctx, pertSecond.x, pertSecond.y, 6);
    }

    // connector between base and perturbed tip
    ctx.strokeStyle = 'rgba(253,224,71,0.9)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(tipBase.x, tipBase.y);
    ctx.lineTo(tipPert.x, tipPert.y);
    ctx.stroke();

    if (Number.isFinite(M.lastCartesianDistance)) {
      const midX = (tipBase.x + tipPert.x) / 2;
      const midY = (tipBase.y + tipPert.y) / 2;
      ctx.fillStyle = 'rgba(248,250,252,0.9)';
      ctx.font = '11px system-ui';
      const label = `${M.lastCartesianDistance.toFixed(3)} m`;
      ctx.fillText(label, midX + 6, midY - 6);

      ctx.fillStyle = 'rgba(148,163,184,0.6)';
      circle(ctx, tipBase.x, tipBase.y, 3);
    }

    ctx.restore();
  }
  _computeMeasurementPositions(state, mode, params) {
    const l1 = params.l1 ?? this.params.l1;
    const l2 = params.l2 ?? this.params.l2;
    const th1 = state[0] ?? 0;
    const th2 = mode === 'double' ? state[2] ?? 0 : 0;
    const x1 = l1 * Math.sin(th1);
    const y1 = l1 * Math.cos(th1);
    let x2 = x1;
    let y2 = y1;
    if (mode === 'double') {
      x2 = x1 + l2 * Math.sin(th2);
      y2 = y1 + l2 * Math.cos(th2);
    }
    return { x1, y1, x2, y2 };
  }
  _measurementStateDifference(base, pert, mode) {
    const wrap = (angle) => this._wrapAngle(angle);
    const th1 = wrap((pert[0] ?? 0) - (base[0] ?? 0));
    const w1 = (pert[1] ?? 0) - (base[1] ?? 0);
    if (mode === 'double') {
      const th2 = wrap((pert[2] ?? 0) - (base[2] ?? 0));
      const w2 = (pert[3] ?? 0) - (base[3] ?? 0);
      return [th1, w1, th2, w2];
    }
    return [th1, w1];
  }
  _measurementStateNorm(vec, mode) {
    if (mode === 'double') {
      const [a0 = 0, a1 = 0, a2 = 0, a3 = 0] = vec;
      return Math.hypot(a0, a1, a2, a3);
    }
    const [a0 = 0, a1 = 0] = vec;
    return Math.hypot(a0, a1);
  }
  _wrapAngle(angle) {
    const twoPi = Math.PI * 2;
    let x = angle % twoPi;
    if (x > Math.PI) x -= twoPi;
    if (x < -Math.PI) x += twoPi;
    return x;
  }
  _measurementRenormalize(diff, M) {
    if (!M || !M.baseState) return;
    const norm = this._measurementStateNorm(diff, M.mode);
    const target = M.delta0 || 1e-6;
    let scale = 1;
    let direction = diff;
    if (!Number.isFinite(norm) || norm <= 0) {
      direction = M.mode === 'double' ? [target, 0, 0, 0] : [target, 0];
      scale = 1;
    } else {
      scale = target / norm;
    }
    if (M.mode === 'double') {
      const next = [
        (M.baseState[0] ?? 0) + direction[0] * scale,
        (M.baseState[1] ?? 0) + direction[1] * scale,
        (M.baseState[2] ?? 0) + direction[2] * scale,
        (M.baseState[3] ?? 0) + direction[3] * scale,
      ];
      M.pertState = Physics.normalizeAngles(next);
    } else {
      const next = [
        (M.baseState[0] ?? 0) + direction[0] * scale,
        (M.baseState[1] ?? 0) + direction[1] * scale,
      ];
      M.pertState = Physics.normalizeAngles(next);
    }
  }
  _drawMeasurementCharts(force = false) {
    this._drawMeasurementLogChart(force);
    this._drawMeasurementLambdaChart(force);
  }
  _drawMeasurementLogChart(force = false) {
    const M = this.measurementEngine;
    if (!M || !M.logCanvas || !M.logCtx) return;
    const prepared = this._prepareChartCanvas(M.logCanvas, M.logCtx);
    if (!prepared) return;
    const { ctx, width, height } = prepared;
    ctx.fillStyle = 'rgba(8,11,20,0.94)';
    ctx.fillRect(0, 0, width, height);

    const times = M.data.time;
    const logs = M.data.log;
    if (!times.length) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px system-ui';
      ctx.fillText('Noch keine Daten - Messung starten', 12, height / 2);
      ctx.restore();
      return;
    }

    const tMin = times[0];
    const tMax = times[times.length - 1];
    const timeRange = Math.max(1e-6, tMax - tMin);
    let yMin = Infinity;
    let yMax = -Infinity;
    for (let i = 0; i < logs.length; i++) {
      const value = logs[i];
      if (!Number.isFinite(value)) continue;
      if (value < yMin) yMin = value;
      if (value > yMax) yMax = value;
    }
    if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) {
      yMin = -25;
      yMax = -5;
    }
    if (Math.abs(yMax - yMin) < 1e-6) {
      const mid = (yMax + yMin) / 2 || 0;
      yMin = mid - 1;
      yMax = mid + 1;
    } else {
      const pad = (yMax - yMin) * 0.15;
      yMin -= pad;
      yMax += pad;
    }

    const plotWidth = width - 28;
    const plotHeight = height - 28;
    const toX = (t) => 14 + ((t - tMin) / timeRange) * plotWidth;
    const toY = (val) => height - 14 - ((val - yMin) / (yMax - yMin || 1)) * plotHeight;

    ctx.strokeStyle = 'rgba(148,163,184,0.25)';
    ctx.lineWidth = 1;
    const zeroY = toY(0);
    if (zeroY >= 14 && zeroY <= height - 14) {
      ctx.beginPath();
      ctx.moveTo(14, zeroY);
      ctx.lineTo(width - 14, zeroY);
      ctx.stroke();
    }

    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < times.length; i++) {
      const x = toX(times[i]);
      const y = toY(logs[i]);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    const latest = logs[logs.length - 1];
    ctx.fillStyle = '#cbd5f5';
    ctx.font = '11px system-ui';
    ctx.fillText(`ln d(t) zuletzt ~ ${latest.toFixed(3)}`, 14, 16);
    ctx.fillStyle = '#64748b';
    ctx.fillText(`Fenster ~ ${timeRange.toFixed(2)} s`, 14, height - 10);

    ctx.restore();
  }
  _drawMeasurementLambdaChart(force = false) {
    const M = this.measurementEngine;
    if (!M || !M.lambdaCanvas || !M.lambdaCtx) return;
    const prepared = this._prepareChartCanvas(M.lambdaCanvas, M.lambdaCtx);
    if (!prepared) return;
    const { ctx, width, height } = prepared;
    ctx.fillStyle = 'rgba(8,11,20,0.94)';
    ctx.fillRect(0, 0, width, height);

    const times = M.data.time;
    const lambdaSeries = M.data.lambda;
    const points = [];
    for (let i = 0; i < times.length; i++) {
      const val = lambdaSeries[i];
      if (!Number.isFinite(val)) continue;
      points.push({ t: times[i], y: val });
    }

    if (!points.length) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px system-ui';
      ctx.fillText('Noch keine Lambda-Schaetzung verfuegbar', 12, height / 2);
      ctx.restore();
      return;
    }

    const tMin = points[0].t;
    const tMax = points[points.length - 1].t;
    const timeRange = Math.max(1e-6, tMax - tMin);
    let yMin = Infinity;
    let yMax = -Infinity;
    for (let i = 0; i < points.length; i++) {
      const value = points[i].y;
      if (value < yMin) yMin = value;
      if (value > yMax) yMax = value;
    }
    if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) {
      yMin = -2;
      yMax = 2;
    }
    if (Math.abs(yMax - yMin) < 1e-6) {
      const mid = (yMax + yMin) / 2 || 0;
      yMin = mid - 0.5;
      yMax = mid + 0.5;
    } else {
      const pad = (yMax - yMin) * 0.2;
      yMin -= pad;
      yMax += pad;
    }

    const plotWidth = width - 28;
    const plotHeight = height - 28;
    const toX = (t) => 14 + ((t - tMin) / timeRange) * plotWidth;
    const toY = (val) => height - 14 - ((val - yMin) / (yMax - yMin || 1)) * plotHeight;

    const zeroY = toY(0);
    if (zeroY >= 14 && zeroY <= height - 14) {
      ctx.strokeStyle = 'rgba(148,163,184,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(14, zeroY);
      ctx.lineTo(width - 14, zeroY);
      ctx.stroke();
    }

    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const x = toX(points[i].t);
      const y = toY(points[i].y);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    const lastPoint = points[points.length - 1];
    ctx.fillStyle = '#bbf7d0';
    ctx.beginPath();
    ctx.arc(toX(lastPoint.t), toY(lastPoint.y), 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#cbd5f5';
    ctx.font = '11px system-ui';
    ctx.fillText(`lambda(t) zuletzt ~ ${lastPoint.y.toFixed(4)}`, 14, 16);
    ctx.fillStyle = '#64748b';
    ctx.fillText(`Fenster ~ ${timeRange.toFixed(2)} s`, 14, height - 10);

    ctx.restore();
  }
  _updateMeasurementUI(distance, overrideStatus) {
    const M = this.measurementEngine;
    if (!M) return;
    if (M.statusEl) {
      let statusText = 'Bereit';
      if (overrideStatus) {
        statusText = overrideStatus;
      } else if (M.running && this.running) {
        statusText = 'Messung laeuft';
      } else if (M.running && !this.running) {
        statusText = 'Pausiert (Simulation gestoppt)';
      } else if (M.ready) {
        statusText = 'Messung bereit';
      }
      M.statusEl.textContent = statusText;
    }

    if (M.lambdaEl) {
      M.lambdaEl.textContent = Number.isFinite(M.lastLambda) ? M.lastLambda.toFixed(4) : 'n/a';
    }

    if (M.lambdaAvgEl) {
      const avg = M.renormAccumTime > 0 ? M.sumLn / M.renormAccumTime : Number.NaN;
      M.lambdaAvgEl.textContent = Number.isFinite(avg) ? avg.toFixed(4) : 'n/a';
    }

    if (M.renormEl) {
      M.renormEl.textContent = String(M.renormCount);
    }

    if (M.timeEl) {
      M.timeEl.textContent = `${M.time.toFixed(2)} s`;
    }

    if (M.distanceEl) {
      const value = Number.isFinite(distance ?? M.lastCartesianDistance)
        ? distance ?? M.lastCartesianDistance
        : Number.NaN;
      M.distanceEl.textContent = Number.isFinite(value) ? `${value.toFixed(3)} m` : '?';
    }

    if (M.startBtn) {
      if (M.running) {
        M.startBtn.disabled = true;
        M.startBtn.textContent = 'Laeuft ...';
      } else {
        M.startBtn.disabled = false;
        M.startBtn.textContent = M.ready ? 'Fortsetzen' : 'Messung starten';
      }
    }
    if (M.stopBtn) {
      M.stopBtn.disabled = !M.running;
    }
    if (M.resetBtn) {
      const hasData = this.measurements.length > 0;
      M.resetBtn.disabled = !M.ready && !hasData;
    }
  }
}

PendulumSim.prototype._syncInputsFromActiveSystem = function() {
  try {
    const sys = this.systems[this.activeSystemIndex] || this.systems[0];
    const el = (id) => document.getElementById(id);
    const m1El = el('m1'); if (m1El && typeof sys.m1 === 'number') m1El.value = String(sys.m1);
    const m2El = el('m2'); if (m2El && typeof sys.m2 === 'number') m2El.value = String(sys.m2);
    const th1El = el('th1'); if (th1El) th1El.value = String(Math.round(toDeg(sys.state[0])));
    const th2El = el('th2'); if (th2El) th2El.value = String(Math.round(toDeg(sys.state[2])));
    const w1El = el('w1'); if (w1El) w1El.value = String(sys.state[1].toFixed(2));
    const w2El = el('w2'); if (w2El) w2El.value = String(sys.state[3].toFixed(2));
    const actEl = el('activePendulum'); if (actEl) actEl.value = String(this.activeSystemIndex);
  } catch (_) { /* ignore */ }
};

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('pendulumCanvas');
  const sim = new PendulumSim(canvas);
  // start paused; user can hit Start
});

