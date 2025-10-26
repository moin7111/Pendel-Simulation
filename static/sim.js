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
    this.params = { m1: 1.0, m2: 1.0, l1: 1.0, l2: 1.0, g: 9.81, damping: 0.02 };
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
    this._bindInputs();
    this._syncInputsFromActiveSystem();
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
    byId('modeDouble').addEventListener('click', () => { this.mode = 'double'; this._draw(); });
    byId('modeSingle').addEventListener('click', () => { this.mode = 'single'; this._draw(); });

    // trails
    byId('toggleTrail').addEventListener('click', () => { this.trailEnabled = !this.trailEnabled; /* do not clear to keep persistent until reset */ this._draw(); });
    const persistEl = byId('persistTrail'); if (persistEl) { persistEl.addEventListener('change', (e) => { this.persistTrail = !!e.target.checked; }); }

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
      this._draw();
    });
    const removeBtn = byId('removePendulum');
    if (removeBtn) removeBtn.addEventListener('click', () => {
      if (this.systems.length <= 1) return;
      this.systems = [this.systems[0]];
      if (activeSel) { activeSel.value = '0'; this.activeSystemIndex = 0; }
      this._syncInputsFromActiveSystem();
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
  stop() { this.running = false; }
  reset() {
    // clear trails
    this.systems.forEach((sys) => { sys.trail = []; sys.state = [sys.initialAngles[0], 0, sys.initialAngles[1], 0]; });
    this.time = 0;
    this._draw();
  }
  _step(dt) {
    const deriv = this.mode === 'double' ? Physics.doubleDerivatives : Physics.singleDerivatives;
    for (let i = 0; i < this.systems.length; i++) {
      const sys = this.systems[i];
      const stateLocal = this.mode === 'double' ? sys.state : sys.state.slice(0, 2);
      const paramsLocal = Object.assign({}, this.params, { m1: sys.m1 ?? this.params.m1, m2: sys.m2 ?? this.params.m2 });
      const next = Physics.rk4Step(stateLocal, dt, paramsLocal, deriv);
      // For single pendulum, snap to rest near stable equilibrium to avoid endless micro-oscillation
      if (this.mode === 'single') {
        const twoPi = 2 * Math.PI;
        const wrap = (a) => { let x = (a + Math.PI) % twoPi; if (x < 0) x += twoPi; return x - Math.PI; };
        const angleEps = 0.003; // ~0.17°
        const omegaEps = 0.003; // rad/s
        const th = wrap(next[0]);
        const w = next[1];
        if (Math.abs(th) < angleEps && Math.abs(w) < omegaEps) {
          next[0] = 0;
          next[1] = 0;
        }
      }
      if (this.mode === 'double') sys.state = next; else sys.state = [next[0], next[1], sys.state[2], sys.state[3]];
      sys.state = Physics.normalizeAngles(sys.state);
    }
    this.time += dt;
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
        if (!this.persistTrail && sys.trail.length > this.maxTrail) sys.trail.shift();
        for (let t = 1; t < sys.trail.length; t++) {
          const alpha = 0.25 + 0.75 * (t / sys.trail.length);
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
    // origin
    ctx.fillStyle = '#e5e7eb'; circle(ctx, originX, originY, 4);
    // time
    document.getElementById('timeValue').textContent = this.time.toFixed(2);
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

