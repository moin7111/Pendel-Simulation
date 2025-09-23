// Lightweight port of the Pendulum physics to JS with RK4 integration

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

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

class PendulumSim {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = [toRad(45), 0, toRad(-30), 0];
    this.params = { m1: 1.0, m2: 1.0, l1: 1.0, l2: 1.0, g: 9.81, damping: 0.0 };
    this.scale = 150; // px per meter
    this.mode = 'double';
    this.trail = [];
    this.trailEnabled = true;
    this.maxTrail = 200;
    this.running = false;
    this.time = 0;
    this.dt = 0.008;
    this.lastTs = 0;
    this._bindInputs();
    this._draw();
  }
  _bindInputs() {
    const byId = (id) => document.getElementById(id);
    const setParam = (key, parse) => (e) => { this.params[key] = parse(e.target.value); };
    byId('l1').addEventListener('input', setParam('l1', parseFloat));
    byId('l2').addEventListener('input', setParam('l2', parseFloat));
    byId('m1').addEventListener('input', setParam('m1', parseFloat));
    byId('m2').addEventListener('input', setParam('m2', parseFloat));
    byId('g').addEventListener('input', setParam('g', parseFloat));
    byId('damping').addEventListener('input', setParam('damping', parseFloat));
    byId('dt').addEventListener('input', (e) => { this.dt = clamp(parseFloat(e.target.value) || 0.008, 0.001, 0.05); });
    byId('th1').addEventListener('input', (e) => { this.state[0] = toRad(parseFloat(e.target.value) || 0); this.state[1] = 0; this._draw(); });
    byId('w1').addEventListener('input', (e) => { this.state[1] = parseFloat(e.target.value) || 0; this._draw(); });
    byId('th2').addEventListener('input', (e) => { this.state[2] = toRad(parseFloat(e.target.value) || 0); this.state[3] = 0; this._draw(); });
    byId('w2').addEventListener('input', (e) => { this.state[3] = parseFloat(e.target.value) || 0; this._draw(); });
    byId('modeDouble').addEventListener('click', () => { this.mode = 'double'; this._draw(); });
    byId('modeSingle').addEventListener('click', () => { this.mode = 'single'; this._draw(); });
    byId('toggleTrail').addEventListener('click', () => { this.trailEnabled = !this.trailEnabled; if (!this.trailEnabled) this.trail = []; });
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
      let acc = elapsed;
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
    this.trail = [];
    this.time = 0;
    this.state = [toRad(45), 0, toRad(-30), 0];
    this._draw();
  }
  _step(dt) {
    const deriv = this.mode === 'double' ? Physics.doubleDerivatives : Physics.singleDerivatives;
    const state = this.mode === 'double' ? this.state : this.state.slice(0,2);
    const next = Physics.rk4Step(state, dt, this.params, deriv);
    if (this.mode === 'double') this.state = next; else this.state = [next[0], next[1], this.state[2], this.state[3]];
    this.state = Physics.normalizeAngles(this.state);
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
    let x1, y1, x2, y2;
    if (this.mode === 'double') {
      const [th1, , th2] = this.state;
      x1 = originX + l1 * Math.sin(th1);
      y1 = originY + l1 * Math.cos(th1);
      x2 = x1 + l2 * Math.sin(th2);
      y2 = y1 + l2 * Math.cos(th2);
    } else {
      const [th1] = this.state;
      x1 = originX + l1 * Math.sin(th1);
      y1 = originY + l1 * Math.cos(th1);
      x2 = x1; y2 = y1;
    }
    // trail
    if (this.trailEnabled) {
      this.trail.push([x2, y2]);
      if (this.trail.length > this.maxTrail) this.trail.shift();
      for (let i = 1; i < this.trail.length; i++) {
        const alpha = 0.3 + 0.7 * (i / this.trail.length);
        ctx.strokeStyle = `rgba(51,102,204,${alpha.toFixed(3)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.trail[i-1][0], this.trail[i-1][1]);
        ctx.lineTo(this.trail[i][0], this.trail[i][1]);
        ctx.stroke();
      }
    } else {
      this.trail = [];
    }
    // rods
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(originX, originY); ctx.lineTo(x1, y1); ctx.stroke();
    if (this.mode === 'double') { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
    // bobs
    ctx.fillStyle = '#2563EB';
    circle(ctx, x1, y1, 10);
    if (this.mode === 'double') { ctx.fillStyle = '#DC2626'; circle(ctx, x2, y2, 8); }
    // origin
    ctx.fillStyle = '#e5e7eb'; circle(ctx, originX, originY, 4);
    // time
    document.getElementById('timeValue').textContent = this.time.toFixed(2);
    this._lastGeom = { originX, originY, x1, y1, l1, l2 };
  }
  _onPointerDown(e) {
    this._dragging = this._hitTest(e);
  }
  _onPointerMove(e) {
    if (!this._dragging) return;
    const rect = this.canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left);
    const py = (e.clientY - rect.top);
    const { originX, originY, x1, y1, l1 } = this._lastGeom || {};
    if (!originX) return;
    const angleFrom = (ox, oy, tx, ty) => Math.atan2(tx - ox, ty - oy);
    if (this._dragging === 'bob1') {
      const th1 = angleFrom(originX, originY, px, py);
      this.state[0] = th1; this.state[1] = 0;
    } else if (this._dragging === 'bob2' && this.mode === 'double') {
      const th1 = this.state[0];
      const nx1 = originX + l1 * Math.sin(th1);
      const ny1 = originY + l1 * Math.cos(th1);
      const th2 = angleFrom(nx1, ny1, px, py);
      this.state[2] = th2; this.state[3] = 0;
    }
    this.state = Physics.normalizeAngles(this.state);
    this._draw();
  }
  _onPointerUp() { this._dragging = null; }
  _hitTest(e) {
    const rect = this.canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left);
    const py = (e.clientY - rect.top);
    const { x1, y1 } = this._lastGeom || {};
    if (!x1) return null;
    const dist2 = (ax, ay, bx, by) => (ax-bx)*(ax-bx) + (ay-by)*(ay-by);
    if (this.mode === 'double' && this.trail.length > 0) {
      const [x2, y2] = this.trail[this.trail.length - 1];
      if (dist2(px, py, x2, y2) < 20*20) return 'bob2';
    }
    if (dist2(px, py, x1, y1) < 20*20) return 'bob1';
    return null;
  }
}

function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
function toRad(deg) { return deg * Math.PI / 180; }

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('pendulumCanvas');
  const sim = new PendulumSim(canvas);
  // start paused; user can hit Start
});

