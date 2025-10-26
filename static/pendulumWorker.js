/*
Pendulum Lyapunov WebWorker
- Integrates single pendulum (optionally extendable to driven) with RK4
- Computes Lyapunov via Benettin renormalization and streams chunks
Message protocol:
Main -> Worker: { cmd:'start', params } | { cmd:'pause' } | { cmd:'resume' } | { cmd:'abort' }
Worker -> Main: progress | chunk | result | error
*/

let paused = false;
let aborted = false;

function wrapPi(a){
  const twoPi = 2*Math.PI; let x = (a + Math.PI) % twoPi; if (x < 0) x += twoPi; return x - Math.PI;
}

function derivativesSingle(state, p, t){
  const [theta, omega] = state;
  const g = p.g, l = p.l1, gamma = p.gamma || 0, f = p.f || 0, Omega = p.Omega || 0;
  const dtheta = omega;
  // driven-damped pendulum: - (g/l) sin(theta) - gamma*omega + f*cos(Omega*t)
  const domega = -(g/l) * Math.sin(theta) - gamma * omega + f * Math.cos(Omega * t);
  return [dtheta, domega];
}

function rk4Step(state, dt, p, t, deriv){
  const k1 = deriv(state, p, t);
  const s2 = state.map((v,i)=> v + 0.5*dt*k1[i]);
  const k2 = deriv(s2, p, t + 0.5*dt);
  const s3 = state.map((v,i)=> v + 0.5*dt*k2[i]);
  const k3 = deriv(s3, p, t + 0.5*dt);
  const s4 = state.map((v,i)=> v + dt*k3[i]);
  const k4 = deriv(s4, p, t + dt);
  return state.map((v,i)=> v + dt*(k1[i] + 2*k2[i] + 2*k3[i] + k4[i])/6);
}

function linearFit(xs, ys){
  const n = xs.length; if (n < 2) return { slope: NaN, intercept: NaN };
  let sx=0, sy=0, sxx=0, sxy=0; for (let i=0;i<n;i++){ const x=xs[i], y=ys[i]; sx+=x; sy+=y; sxx+=x*x; sxy+=x*y; }
  const denom = n*sxx - sx*sx; if (Math.abs(denom) < 1e-12) return { slope: NaN, intercept: NaN };
  const slope = (n*sxy - sx*sy) / denom; const intercept = (sy - slope*sx)/n; return { slope, intercept };
}

self.onmessage = (ev) => {
  const msg = ev.data || {};
  if (msg.cmd === 'start') {
    paused = false; aborted = false;
    compute(msg.params).catch(err => self.postMessage({ type:'error', message: String(err&&err.message||err) }));
  } else if (msg.cmd === 'pause') { paused = true; }
  else if (msg.cmd === 'resume') { paused = false; }
  else if (msg.cmd === 'abort') { aborted = true; }
};

async function compute(params){
  const {
    gamma=0.2, f=1.2, Omega=0.666,
    theta0=0.5, omega0=0.0,
    dt=0.002, totalTime=20.0, delta0=1e-8,
    renormInterval=0.05,
    g=9.81, l1=1.0,
    chunkSize=200
  } = params || {};

  // Base and perturbed states
  let x = [theta0, omega0];
  let x2 = [theta0 + delta0, omega0];
  let t = 0;
  let accLog = 0; // sum of ln(d/delta0)
  let nextRenormT = renormInterval;
  const totalSteps = Math.max(1, Math.round(totalTime / dt));
  let sentSteps = 0;
  const points = [];
  const runningLambda = [];

  const norm = (v) => Math.hypot(v[0], v[1]);

  for (let step = 0; step < totalSteps; step++){
    if (aborted) { self.postMessage({ type:'error', message:'aborted' }); return; }
    while (paused) { await sleep(20); if (aborted) return; }

    // Integrate both systems one step
    x = rk4Step(x, dt, { g, l1, gamma, f, Omega }, t, derivativesSingle);
    x2 = rk4Step(x2, dt, { g, l1, gamma, f, Omega }, t, derivativesSingle);
    t += dt;

    // wrap angles to avoid artificial growth
    x[0] = wrapPi(x[0]); x2[0] = wrapPi(x2[0]);

    // Measure separation
    let dv = [wrapPi(x2[0] - x[0]), (x2[1] - x[1])];
    let d = norm(dv);
    if (!(d > 0)) d = 1e-20;

    // Renormalize at intervals
    if (t >= nextRenormT || step === totalSteps - 1){
      const s = Math.log(d / delta0);
      accLog += s;
      const lam = accLog / t;
      runningLambda.push(lam);
      // re-seed perturbed trajectory to distance delta0 in same direction
      const dvn0 = dv[0] / d, dvn1 = dv[1] / d;
      x2 = [ x[0] + delta0 * dvn0, x[1] + delta0 * dvn1 ];
      nextRenormT += renormInterval;
      // stream a point for charts
      points.push({ t, d, ln_d: Math.log(d), lambda_running: lam });
    } else {
      // less frequent samples for performance; still send some points
      if (step % 10 === 0) points.push({ t, d, ln_d: Math.log(d) });
    }

    sentSteps += 1;
    if (points.length >= Math.max(20, Math.floor(chunkSize/5)) || sentSteps % chunkSize === 0 || step === totalSteps - 1){
      self.postMessage({ type:'chunk', points: points.splice(0) });
      self.postMessage({ type:'progress', done: sentSteps, total: totalSteps });
      await sleep(0);
    }
  }

  const lambda = accLog / t;
  self.postMessage({ type:'result', lambda, times: [], d: [], ln_d: [], running_lambda: runningLambda });
}

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
