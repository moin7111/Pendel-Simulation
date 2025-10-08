// Logistic map interactive simulation: time series, cobweb, bifurcation (Canvas)

(function(){
  'use strict';

  function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
  function lerp(a,b,t){ return a + (b-a)*t; }

  function iterateLogistic(r, x0, total){
    let x = x0; const out = new Float32Array(total);
    for(let i=0;i<total;i++){ x = r * x * (1 - x); out[i] = x; }
    return out;
  }

  // Simple worker using off-main thread via inline blob for bifurcation computation
  function createBifWorker(){
    const src = `self.onmessage = function(e){
      const { rMin, rMax, rCount, transient, plotCount, x0 } = e.data;
      const points = [];
      const dr = (rMax - rMin) / (rCount - 1);
      for(let i=0;i<rCount;i++){
        const r = rMin + dr * i;
        let x = x0;
        for(let k=0;k<transient+plotCount;k++){
          x = r * x * (1 - x);
          if(k >= transient && k < transient + plotCount){
            points.push(r, x);
          }
        }
      }
      const buf = new Float32Array(points);
      self.postMessage({ buf }, [buf.buffer]);
    };`;
    const blob = new Blob([src], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    return worker;
  }

  class Plot2D {
    constructor(canvas){
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
    }
    resize(){
      const w = this.canvas.clientWidth || this.canvas.width;
      const h = this.canvas.clientHeight || this.canvas.height;
      if (this.canvas.width !== w || this.canvas.height !== h){
        this.canvas.width = w; this.canvas.height = h;
      }
      return { w: this.canvas.width, h: this.canvas.height };
    }
    clear(){
      const { w, h } = this.resize();
      const c = this.ctx; c.clearRect(0,0,w,h);
      c.fillStyle = '#0a0f1a'; c.fillRect(0,0,w,h);
      c.strokeStyle = '#1f2937'; c.lineWidth = 1; c.beginPath();
      for(let x=0;x<w;x+=50){ c.moveTo(x,0); c.lineTo(x,h); }
      for(let y=0;y<h;y+=50){ c.moveTo(0,y); c.lineTo(w,y); }
      c.stroke();
    }
  }

  class TimeSeriesView extends Plot2D{
    constructor(canvas){ super(canvas); this.data = []; this.n0 = 0; this.n1 = 0; }
    setData(arr, n0){ this.data = arr; this.n0 = n0||0; this.n1 = (n0||0) + arr.length; this.draw(); }
    draw(){
      const { w, h } = this.resize(); this.clear();
      const c = this.ctx;
      const N = this.data.length; if(!N) return;
      const xForI = i => (i/(N-1)) * (w-40) + 20;
      const yForX = x => (1 - x) * (h-40) + 20;
      c.strokeStyle = '#9ca3af'; c.lineWidth = 1.5; c.beginPath();
      for(let i=0;i<N;i++){
        const x = xForI(i), y = yForX(this.data[i]);
        if(i===0) c.moveTo(x,y); else c.lineTo(x,y);
      }
      c.stroke();
      c.fillStyle = '#e5e7eb'; c.font = '12px system-ui, sans-serif';
      c.fillText('n', w-18, h-10); c.fillText('x', 8, 16);
      c.fillStyle = '#10b981';
      for(let i=0;i<N;i+=Math.max(1, Math.floor(N/80))){
        const x = xForI(i), y = yForX(this.data[i]);
        c.beginPath(); c.arc(x,y,2.2,0,Math.PI*2); c.fill();
      }
    }
  }

  class CobwebView extends Plot2D{
    constructor(canvas){ super(canvas); this.r = 2.5; this.x0 = 0.5; this.steps = 120; }
    setParams(r, x0, steps){ this.r = r; this.x0 = x0; this.steps = steps||this.steps; this.draw(); }
    draw(){
      const { w, h } = this.resize(); this.clear();
      const c = this.ctx;
      const X = x => lerp(20, w-20, x);
      const Y = y => lerp(h-20, 20, y);
      // axes
      c.strokeStyle = '#9ca3af'; c.lineWidth = 1; c.beginPath();
      c.moveTo(20, h-20); c.lineTo(w-20, h-20); c.moveTo(20, h-20); c.lineTo(20, 20); c.stroke();
      // y=x
      c.strokeStyle = '#374151'; c.beginPath(); c.moveTo(20,h-20); c.lineTo(w-20,20); c.stroke();
      // f(x)
      c.strokeStyle = '#2563eb'; c.lineWidth = 2; c.beginPath();
      const samples = 400; for(let i=0;i<=samples;i++){
        const x = i/samples; const y = this.r * x * (1 - x);
        const px = X(x), py = Y(y);
        if(i===0) c.moveTo(px,py); else c.lineTo(px,py);
      } c.stroke();
      // cobweb
      c.strokeStyle = '#10b981'; c.lineWidth = 1.3;
      let x = this.x0; let y = this.r * x * (1 - x);
      // first vertical from (x,0) to (x, f(x))
      c.beginPath(); c.moveTo(X(x), Y(0)); c.lineTo(X(x), Y(y)); c.stroke();
      for(let i=0;i<this.steps;i++){
        // horizontal to diagonal (projection)
        c.beginPath(); c.moveTo(X(x), Y(y)); c.lineTo(X(y), Y(y)); c.stroke();
        // vertical to curve
        x = y; y = this.r * x * (1 - x);
        c.beginPath(); c.moveTo(X(x), Y(x)); c.lineTo(X(x), Y(y)); c.stroke();
      }
    }
  }

  class BifurcationView extends Plot2D{
    constructor(canvas){ super(canvas); this.rMin = 2.5; this.rMax = 4.0; this.points = new Float32Array(0); this.cursorR = null; this.onSelectR = null; }
    setPoints(buf){ this.points = buf; this.draw(); }
    setCursor(r){ this.cursorR = r; this.draw(); }
    draw(){
      const { w, h } = this.resize(); this.clear();
      const c = this.ctx; const pts = this.points; const N = pts.length/2;
      const X = r => 20 + (r - this.rMin) / (this.rMax - this.rMin) * (w - 40);
      const Y = x => 20 + (1 - x) * (h - 40);
      // axes
      c.strokeStyle = '#9ca3af'; c.lineWidth = 1; c.beginPath();
      c.moveTo(20, h-20); c.lineTo(w-20, h-20); c.moveTo(20, h-20); c.lineTo(20, 20); c.stroke();
      // points via ImageData for speed
      const img = c.getImageData(0,0,w,h); const data = img.data;
      const putPx = (x,y) => {
        if(x<0||y<0||x>=w||y>=h) return; const idx = (y*w + x) * 4; data[idx]=37; data[idx+1]=99; data[idx+2]=235; data[idx+3]=180; };
      for(let i=0;i<N;i++){
        const r = pts[2*i], x = pts[2*i+1];
        const px = (X(r)|0), py = (Y(x)|0); putPx(px,py);
      }
      c.putImageData(img, 0, 0);
      // cursor
      if(this.cursorR!=null){ c.strokeStyle = '#f59e0b'; c.lineWidth = 1; const cx = X(this.cursorR)|0; c.beginPath(); c.moveTo(cx, 20); c.lineTo(cx, h-20); c.stroke(); }
    }
    bindInteraction(infoEl){
      const rectOf = () => this.canvas.getBoundingClientRect();
      this.canvas.addEventListener('mousemove', (e)=>{
        const rect = rectOf(); const x = e.clientX - rect.left; const w = this.canvas.width;
        const r = this.rMin + clamp((x - 20) / (w - 40), 0, 1) * (this.rMax - this.rMin);
        if (Number.isFinite(r)) infoEl.textContent = `r = ${r.toFixed(4)}`;
      });
      this.canvas.addEventListener('click', (e)=>{
        const rect = rectOf(); const x = e.clientX - rect.left; const w = this.canvas.width;
        const r = this.rMin + clamp((x - 20) / (w - 40), 0, 1) * (this.rMax - this.rMin);
        if (this.onSelectR) this.onSelectR(r);
      });
    }
  }

  function main(){
    const rSlider = document.getElementById('rSlider');
    const rInput = document.getElementById('rInput');
    const x0Input = document.getElementById('x0Input');
    const playBtn = document.getElementById('playBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const resetBtn = document.getElementById('resetBtn');
    const speedSlider = document.getElementById('speedSlider');
    const speedNum = document.getElementById('speedNum');
    const resolution = document.getElementById('resolution');
    const recomputeBif = document.getElementById('recomputeBif');
    const bifInfo = document.getElementById('bifInfo');
    const timeView = new TimeSeriesView(document.getElementById('timeCanvas'));
    const cobwebView = new CobwebView(document.getElementById('cobwebCanvas'));
    const bifView = new BifurcationView(document.getElementById('bifCanvas'));
    bifView.bindInteraction(bifInfo);

    const tabTime = document.getElementById('tabTime');
    const tabCobweb = document.getElementById('tabCobweb');
    const timePanel = document.getElementById('timePanel');
    const cobwebPanel = document.getElementById('cobwebPanel');
    function showTab(which){
      if (which === 'time'){
        tabTime.classList.add('active'); tabCobweb.classList.remove('active');
        timePanel.style.display = ''; cobwebPanel.style.display = 'none';
      } else {
        tabCobweb.classList.add('active'); tabTime.classList.remove('active');
        cobwebPanel.style.display = ''; timePanel.style.display = 'none';
      }
    }
    tabTime.addEventListener('click', ()=> showTab('time'));
    tabCobweb.addEventListener('click', ()=> showTab('cobweb'));

    let playing = false; let speed = 1;
    function syncR(val){
      const r = clamp(parseFloat(val)||2.5, 2.5, 4.0); rSlider.value = String(r); rInput.value = String(r.toFixed(3)); update(); return r;
    }
    function syncSpeed(val){ const v = clamp(parseFloat(val)||1,0.1,5); speed= v; speedSlider.value=String(v); speedNum.value=String(v); }
    rSlider.addEventListener('input', (e)=> syncR(e.target.value));
    rInput.addEventListener('change', (e)=> syncR(e.target.value));
    speedSlider.addEventListener('input', (e)=> syncSpeed(e.target.value));
    speedNum.addEventListener('input', (e)=> syncSpeed(e.target.value));

    // presets
    document.querySelectorAll('[data-preset]').forEach(btn=>{
      btn.addEventListener('click', ()=>{ syncR(btn.getAttribute('data-preset')); updateBifCursor(); });
    });

    playBtn.addEventListener('click', ()=>{ playing = true; loop(); });
    pauseBtn.addEventListener('click', ()=>{ playing = false; });
    resetBtn.addEventListener('click', ()=>{ playing = false; setTimeout(()=>{ update(true); }, 0); });

    function update(resetSeries){
      const r = parseFloat(rInput.value);
      const x0 = clamp(parseFloat(x0Input.value)||0.5, 0, 1);
      const total = 1500; // we display later segment
      const series = iterateLogistic(r, x0, total);
      const n0 = 1000; const segment = series.slice(n0, n0 + 500);
      timeView.setData(segment, n0);
      cobwebView.setParams(r, x0, 120);
      updateBifCursor();
    }

    function updateBifCursor(){ bifView.setCursor(parseFloat(rInput.value)); }

    // Bifurcation compute
    let worker = null;
    function resolutionToCount(key){ return key==='high' ? 5000 : (key==='low' ? 1500 : 3000); }
    function computeBif(){
      if(worker){ worker.terminate(); worker = null; }
      const rCount = resolutionToCount(resolution.value);
      const msg = { rMin: 2.5, rMax: 4.0, rCount, transient: 1000, plotCount: 500, x0: 0.5 };
      worker = createBifWorker();
      worker.onmessage = (e)=>{ bifView.setPoints(e.data.buf); };
      worker.postMessage(msg);
    }
    recomputeBif.addEventListener('click', computeBif);

    // initial
    syncR(2.5); syncSpeed(1); update(); computeBif();

    // animation for time series (optional progressive reveal)
    let lastTs = 0; let animPhase = 0;
    function loop(ts){
      if(!playing) return; if(!ts) ts = performance.now();
      const dt = Math.min(0.05, (ts - lastTs)/1000 || 0.016) * speed; lastTs = ts;
      animPhase += dt;
      // redraw time and cobweb periodically to simulate activity
      timeView.draw();
      cobwebView.draw();
      requestAnimationFrame(loop);
    }
  }

  window.addEventListener('DOMContentLoaded', main);
})();

