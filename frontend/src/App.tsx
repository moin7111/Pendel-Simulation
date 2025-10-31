import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  LogarithmicScale,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js'
import type { ChartData, ChartDataset, ChartOptions } from 'chart.js'
import type {
  LogisticParams,
  MainToWorker,
  WorkerChunkPoint,
  WorkerFitMsg,
  WorkerMsg,
  WorkerResultMsg,
} from './types/worker'
import './App.css'

ChartJS.register(
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
)

type SolverStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error' | 'aborted'

const DEFAULT_PARAMS: LogisticParams = {
  system: 'logistic',
  r: 3.8,
  x0: 0.2,
  delta0: 1e-8,
  totalIters: 2000,
  transient: 500,
  renormSteps: 10,
  chunkSize: 120,
  sampleEvery: 1,
}

type NumericParamKey = Exclude<keyof LogisticParams, 'system'>

const formatNumber = (value: number, digits = 3) => {
  if (!Number.isFinite(value)) return 'n/a'
  if (Math.abs(value) >= 1e3 || Math.abs(value) <= 1e-3) {
    return value.toExponential(digits)
  }
  return value.toFixed(digits)
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const STATUS_LABEL: Record<SolverStatus, string> = {
  idle: 'Bereit',
  running: 'Laufend',
  paused: 'Pausiert',
  completed: 'Abgeschlossen',
  error: 'Fehler',
  aborted: 'Abgebrochen',
}

const interpretLambda = (lambda: number) => {
  if (!Number.isFinite(lambda)) return 'Keine verwertbare Schaetzung'
  if (lambda > 0.05) return 'lambda > 0 -> stark chaotisch'
  if (lambda > 0) return 'lambda > 0 -> chaotisch'
  if (lambda < -0.05) return 'lambda < 0 -> stabil (konvergent)'
  if (lambda < 0) return 'lambda < 0 -> asymptotisch stabil'
  return 'lambda ~ 0 -> grenzstabil / quasi-periodisch'
}

function App() {
  const [params, setParams] = useState<LogisticParams>(DEFAULT_PARAMS)
  const [points, setPoints] = useState<WorkerChunkPoint[]>([])
  const [progress, setProgress] = useState({ done: 0, total: 1 })
  const [fit, setFit] = useState<WorkerFitMsg | null>(null)
  const [result, setResult] = useState<WorkerResultMsg | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [status, setStatus] = useState<SolverStatus>('idle')
  const [modalOpen, setModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'distance' | 'log' | 'lambda'>('distance')
  const [distanceScale, setDistanceScale] = useState<'linear' | 'logarithmic'>('linear')
  const [modalStartedAt, setModalStartedAt] = useState<number | null>(null)

  const workerRef = useRef<Worker | null>(null)
  const distanceChartRef = useRef<ChartJS<'line'> | null>(null)
  const logChartRef = useRef<ChartJS<'line'> | null>(null)
  const lambdaChartRef = useRef<ChartJS<'line'> | null>(null)

  const updateParam = useCallback(<K extends NumericParamKey>(key: K, value: number) => {
    setParams((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleNumberChange = useCallback(
    <K extends NumericParamKey>(key: K, clampFn?: (value: number) => number) =>
      (event: ChangeEvent<HTMLInputElement>) => {
        const raw = Number(event.target.value)
        if (Number.isNaN(raw)) return
        const nextValue = clampFn ? clampFn(raw) : raw
        updateParam(key, nextValue)
      },
    [updateParam],
  )

  const presets = [
    { label: 'r = 2.5 (stabil)', value: 2.5 },
    { label: 'r = 3.2 (Periodisch)', value: 3.2 },
    { label: 'r = 3.57 (Onset Chaos)', value: 3.57 },
    { label: 'r = 3.8 (Chaos)', value: 3.8 },
    { label: 'r = 4.0 (voll Chaotisch)', value: 4.0 },
  ]

  const normalizedParams = useMemo<LogisticParams>(() => {
    const sanitized: LogisticParams = {
      ...params,
      system: 'logistic',
      r: clamp(params.r, 0, 4.1),
      x0: clamp(params.x0, 1e-12, 1 - 1e-12),
      delta0: Math.max(1e-16, params.delta0),
      totalIters: Math.max(50, Math.round(params.totalIters)),
      transient: Math.max(0, Math.round(params.transient)),
      renormSteps: Math.max(1, Math.round(params.renormSteps)),
      chunkSize: Math.max(25, Math.round(params.chunkSize)),
      sampleEvery: Math.max(1, Math.round(params.sampleEvery)),
    }
    return sanitized
  }, [params])

  const progressFraction = useMemo(() => {
    if (!progress.total || progress.total <= 0) return 0
    return Math.max(0, Math.min(1, progress.done / progress.total))
  }, [progress])

  const etaSeconds = useMemo(() => {
    if (!modalStartedAt || progressFraction <= 0 || progressFraction >= 1) return null
    const elapsed = (performance.now() - modalStartedAt) / 1000
    return elapsed * (1 / progressFraction - 1)
  }, [modalStartedAt, progressFraction])

  const distanceDataset = useMemo(
    () => points.map((point) => ({ x: point.t, y: point.d })),
    [points],
  )

  const logDataset = useMemo(
    () => points.map((point) => ({ x: point.t, y: point.ln_d })),
    [points],
  )

  const lambdaDataset = useMemo(
    () =>
      points
        .filter((point) => Number.isFinite(point.lambda_running))
        .map((point) => ({ x: point.t, y: point.lambda_running as number })),
    [points],
  )

  const fitLine = useMemo(() => {
    if (!fit) return []
    const [start, end] = fit.window
    const xStart = start ?? 0
    const xEnd = end ?? xStart
    if (xEnd === xStart) return []
    return [
      { x: xStart, y: fit.slope * xStart + fit.intercept },
      { x: xEnd, y: fit.slope * xEnd + fit.intercept },
    ]
  }, [fit])

  const distanceChartData = useMemo<ChartData<'line', { x: number; y: number }[], number>>(
    () => ({
      datasets: [
        {
          label: 'd(t)',
          data: distanceDataset,
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56,189,248,0.2)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.2,
        },
      ],
    }),
    [distanceDataset],
  )

  const distanceChartOptions = useMemo<ChartOptions<'line'>>(
    () => ({
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: 'linear' as const,
          title: { display: true, text: 'Iteration' },
          ticks: { color: '#9ca3af' },
          grid: { color: 'rgba(148,163,184,0.2)' },
        },
        y: {
          type: distanceScale,
          min: distanceScale === 'logarithmic' ? 1e-12 : 0,
          title: { display: true, text: 'Abstand d(t)' },
          ticks: {
            color: '#9ca3af',
            callback: (value: string | number) =>
              typeof value === 'number' ? value.toExponential(2) : value,
          },
          grid: { color: 'rgba(148,163,184,0.2)' },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'nearest',
          intersect: false,
        },
      },
    }),
    [distanceScale],
  )

  const logChartData = useMemo<ChartData<'line', { x: number; y: number }[], number>>(() => {
    const datasets: ChartDataset<'line', { x: number; y: number }[]>[] = [
      {
        label: 'ln d(t)',
        data: logDataset,
        borderColor: '#a855f7',
        backgroundColor: 'rgba(168,85,247,0.2)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.15,
      },
    ]
    if (fitLine.length) {
      datasets.push({
        label: 'Linearer Fit',
        data: fitLine,
        borderColor: '#f97316',
        borderDash: [6, 6],
        borderWidth: 2,
        pointRadius: 0,
        tension: 0,
      })
    }
    return { datasets }
  }, [logDataset, fitLine])

  const logChartOptions = useMemo<ChartOptions<'line'>>(
    () => ({
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: 'linear' as const,
          title: { display: true, text: 'Iteration' },
          ticks: { color: '#9ca3af' },
          grid: { color: 'rgba(148,163,184,0.2)' },
        },
        y: {
          type: 'linear' as const,
          title: { display: true, text: 'ln d(t)' },
          ticks: { color: '#9ca3af' },
          grid: { color: 'rgba(148,163,184,0.2)' },
        },
      },
      plugins: {
        legend: { display: true, labels: { color: '#e5e7eb' } },
        tooltip: { mode: 'nearest', intersect: false },
      },
    }),
    [],
  )

  const lambdaChartData = useMemo<ChartData<'line', { x: number; y: number }[], number>>(
    () => ({
      datasets: [
        {
          label: 'lambda(t)',
          data: lambdaDataset,
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34,197,94,0.18)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.1,
        },
      ],
    }),
    [lambdaDataset],
  )

  const lambdaChartOptions = useMemo<ChartOptions<'line'>>(
    () => ({
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: 'linear' as const,
          title: { display: true, text: 'Iteration' },
          ticks: { color: '#9ca3af' },
          grid: { color: 'rgba(148,163,184,0.2)' },
        },
        y: {
          type: 'linear' as const,
          title: { display: true, text: 'Laufende lambda-Schaetzung' },
          ticks: { color: '#9ca3af' },
          grid: { color: 'rgba(148,163,184,0.2)' },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: { mode: 'nearest', intersect: false },
      },
    }),
    [],
  )

  const terminateWorker = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate()
      workerRef.current = null
    }
  }, [])

  const closeModal = useCallback(() => {
    terminateWorker()
    setModalOpen(false)
    setStatus('idle')
    setModalStartedAt(null)
  }, [terminateWorker])

  const handleWorkerMessage = useCallback(
    (event: MessageEvent<WorkerMsg>) => {
      const msg = event.data
      if (!msg) return
      switch (msg.type) {
        case 'chunk':
          setPoints((prev) => [...prev, ...msg.points])
          break
        case 'progress':
          setProgress({ done: msg.done, total: msg.total })
          break
        case 'fit':
          setFit(msg)
          break
        case 'result':
          setResult(msg)
          setProgress({
            done: msg.times.length + normalizedParams.transient,
            total: normalizedParams.totalIters + normalizedParams.transient,
          })
          setStatus('completed')
          terminateWorker()
          break
        case 'error':
          setErrorMessage(msg.message)
          setStatus(msg.message.toLowerCase().includes('abgebrochen') ? 'aborted' : 'error')
          terminateWorker()
          break
        default:
          break
      }
    },
    [normalizedParams.totalIters, normalizedParams.transient, terminateWorker],
  )

  const startSimulation = useCallback(() => {
    if (status === 'running' || status === 'paused') return
    setPoints([])
    setProgress({ done: 0, total: 1 })
    setFit(null)
    setResult(null)
    setErrorMessage(null)
    setActiveTab('distance')
    setDistanceScale('linear')
    setModalOpen(true)
    setStatus('running')
    setModalStartedAt(performance.now())

    terminateWorker()
    const worker = new Worker(new URL('./workers/lyapunovWorker.ts', import.meta.url), {
      type: 'module',
    })
    workerRef.current = worker
    worker.onmessage = handleWorkerMessage as (event: MessageEvent) => void
    worker.onerror = (err) => {
      setErrorMessage(err.message ?? 'Worker-Fehler')
      setStatus('error')
      terminateWorker()
    }

    const payload: MainToWorker = {
      cmd: 'start',
      params: normalizedParams,
    }
    worker.postMessage(payload)
  }, [handleWorkerMessage, normalizedParams, status, terminateWorker])

  const handlePause = useCallback(() => {
    if (workerRef.current && status === 'running') {
      workerRef.current.postMessage({ cmd: 'pause' })
      setStatus('paused')
    }
  }, [status])

  const handleResume = useCallback(() => {
    if (workerRef.current && status === 'paused') {
      workerRef.current.postMessage({ cmd: 'resume' })
      setStatus('running')
    }
  }, [status])

  const handleAbort = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ cmd: 'abort' })
    }
  }, [])

  const toggleDistanceScale = useCallback(() => {
    setDistanceScale((prev) => (prev === 'linear' ? 'logarithmic' : 'linear'))
  }, [])

  const activeChartRef = useMemo(() => {
    if (activeTab === 'distance') return distanceChartRef
    if (activeTab === 'log') return logChartRef
    return lambdaChartRef
  }, [activeTab])

  const exportPNG = useCallback(() => {
    const chart = activeChartRef.current
    if (!chart) return
    const url = chart.toBase64Image('image/png', 1)
    const link = document.createElement('a')
    link.href = url
    link.download = `lyapunov-${activeTab}.png`
    link.click()
  }, [activeChartRef, activeTab])

  const exportCSV = useCallback(() => {
    if (!points.length) return
    const header = 't,d,ln_d,lambda_running\n'
    const rows = points
      .map((point) => {
        const lambdaValue = Number.isFinite(point.lambda_running ?? Number.NaN)
          ? point.lambda_running
          : ''
        return `${point.t},${point.d},${point.ln_d},${lambdaValue}`
      })
      .join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'lyapunov-logistic.csv'
    link.click()
    URL.revokeObjectURL(url)
  }, [points])

  const finalLambda = useMemo(() => {
    if (result && Number.isFinite(result.lambda)) return result.lambda
    if (fit && Number.isFinite(fit.slope)) return fit.slope
    return Number.NaN
  }, [fit, result])

  useEffect(() => () => terminateWorker(), [terminateWorker])

  return (
    <div className="app-shell">
      <aside className="side-panel">
        <header className="panel-header">
          <h1>Lyapunov Explorer</h1>
          <p className="muted">
            Simulation der logistischen Karte mit direkter ln(d)-Approximation und Benettin-Renormierung.
          </p>
        </header>

        <section className="panel-section">
          <h2>Parameter</h2>
          <div className="param-grid">
            <label>
              <span>r (Wachstumsrate)</span>
              <input
                type="number"
                min={0}
                max={4.1}
                step={0.001}
                value={params.r}
                onChange={handleNumberChange('r', (v) => clamp(v, 0, 4.1))}
              />
            </label>
            <label>
              <span>x0 (Startwert)</span>
              <input
                type="number"
                min={0}
                max={1}
                step={0.001}
                value={params.x0}
                onChange={handleNumberChange('x0', (v) => clamp(v, 0, 1))}
              />
            </label>
            <label>
              <span>delta0 (Startabstand)</span>
              <input
                type="number"
                step="any"
                min={1e-16}
                value={params.delta0}
                onChange={handleNumberChange('delta0', (v) => Math.max(1e-16, v))}
              />
            </label>
            <label>
              <span>Iterationen (nach Transient)</span>
              <input
                type="number"
                min={50}
                step={10}
                value={params.totalIters}
                onChange={handleNumberChange('totalIters', (v) => Math.max(50, Math.round(v)))}
              />
            </label>
            <label>
              <span>Transient</span>
              <input
                type="number"
                min={0}
                step={10}
                value={params.transient}
                onChange={handleNumberChange('transient', (v) => Math.max(0, Math.round(v)))}
              />
            </label>
            <label>
              <span>Renorm-Schritte</span>
              <input
                type="number"
                min={1}
                step={1}
                value={params.renormSteps}
                onChange={handleNumberChange('renormSteps', (v) => Math.max(1, Math.round(v)))}
              />
            </label>
            <label>
              <span>Chunk-Groesse</span>
              <input
                type="number"
                min={25}
                step={25}
                value={params.chunkSize}
                onChange={handleNumberChange('chunkSize', (v) => Math.max(25, Math.round(v)))}
              />
            </label>
            <label>
              <span>Sample every</span>
              <input
                type="number"
                min={1}
                step={1}
                value={params.sampleEvery}
                onChange={handleNumberChange('sampleEvery', (v) => Math.max(1, Math.round(v)))}
              />
            </label>
          </div>
        </section>

        <section className="panel-section">
          <h2>Presets</h2>
          <div className="preset-grid">
            {presets.map((preset) => (
              <button
                key={preset.value}
                type="button"
                className="btn tertiary"
                onClick={() => updateParam('r', preset.value)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </section>

        <section className="panel-section">
          <h2>Aktion</h2>
          <button
            type="button"
            className="btn primary"
            onClick={startSimulation}
            disabled={status === 'running' || status === 'paused'}
          >
            Lyapunov berechnen
          </button>
          <p className="muted small">
            Waerend der Berechnung bleibt die Oberflaeche responsiv. Ergebnisse lassen sich als PNG oder CSV exportieren.
          </p>
        </section>
      </aside>

      <main className="main-content">
        <section className="status-card">
          <header className="status-header">
            <div>
              <h2>Status</h2>
              <span className={`status-chip status-${status}`}>{STATUS_LABEL[status]}</span>
            </div>
            <div className="status-meta">
              <span>{points.length} Punkte</span>
              {Number.isFinite(finalLambda) && <span>lambda ~ {formatNumber(finalLambda, 4)}</span>}
            </div>
          </header>
          <p>
            Die Simulation laeuft in einem WebWorker und sendet regelmaessig Fortschritts-Updates. Oeffne das Modal fuer Live-Plots und Steuerung.
          </p>
          <button type="button" className="btn secondary" onClick={() => setModalOpen(true)}>
            Live-Modal oeffnen
          </button>
        </section>

        <section className="info-card">
          <h2>Ueberblick</h2>
          <ul>
            <li>Direkter ln(d)-Fit liefert eine alternative lambda-Schaetzung.</li>
            <li>Benettin-Renormierung verhindert numerische Divergenz und ermoeglicht laufende Schaetzwerte.</li>
            <li>Exportiere Rohdaten als CSV oder Charts als PNG fuer externe Analysen.</li>
            <li>Ueber die Presets lassen sich typische Dynamiken der logistischen Karte schnell erkunden.</li>
          </ul>
        </section>
      </main>

      {modalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <header className="modal-header">
              <div>
                <h2>Lyapunov-Berechnung</h2>
                <p className="muted small">
                  r = {normalizedParams.r.toFixed(3)}, x0 = {normalizedParams.x0.toFixed(3)}, delta0 = {formatNumber(normalizedParams.delta0, 2)}
                </p>
              </div>
              <button type="button" className="icon-btn" onClick={closeModal} aria-label="Modal schliessen">
                x
              </button>
            </header>

            <section className="modal-body">
              <div className="progress">
                <div className="progress-bar" style={{ width: `${progressFraction * 100}%` }} />
              </div>
              <div className="progress-meta">
                <span>
                  {Math.round(progressFraction * 100)} % | {progress.done}/{progress.total}
                </span>
                {etaSeconds != null && <span>ETA ~ {etaSeconds.toFixed(1)} s</span>}
                <span>Status: {STATUS_LABEL[status]}</span>
              </div>

              <div className="tabs">
                <button
                  type="button"
                  className={`tab ${activeTab === 'distance' ? 'active' : ''}`}
                  onClick={() => setActiveTab('distance')}
                >
                  d(t)
                </button>
                <button
                  type="button"
                  className={`tab ${activeTab === 'log' ? 'active' : ''}`}
                  onClick={() => setActiveTab('log')}
                >
                  ln d(t)
                </button>
                <button
                  type="button"
                  className={`tab ${activeTab === 'lambda' ? 'active' : ''}`}
                  onClick={() => setActiveTab('lambda')}
                >
                  Benettin lambda(t)
                </button>
              </div>

              <div className="chart-frame">
                {activeTab === 'distance' && (
                  <Line ref={distanceChartRef} data={distanceChartData} options={distanceChartOptions} />
                )}
                {activeTab === 'log' && <Line ref={logChartRef} data={logChartData} options={logChartOptions} />}
                {activeTab === 'lambda' && (
                  <Line ref={lambdaChartRef} data={lambdaChartData} options={lambdaChartOptions} />
                )}
              </div>

              <div className="control-row">
                <button type="button" className="btn secondary" onClick={toggleDistanceScale}>
                  Skala {distanceScale === 'linear' ? '-> log' : '-> linear'}
                </button>
                <button type="button" className="btn secondary" onClick={exportPNG} disabled={!points.length}>
                  Export PNG
                </button>
                <button type="button" className="btn secondary" onClick={exportCSV} disabled={!points.length}>
                  Export CSV
                </button>
              </div>

              <div className="control-row">
                <button type="button" className="btn" onClick={handlePause} disabled={status !== 'running'}>
                  Pause
                </button>
                <button type="button" className="btn" onClick={handleResume} disabled={status !== 'paused'}>
                  Fortsetzen
                </button>
                <button
                  type="button"
                  className="btn danger"
                  onClick={handleAbort}
                  disabled={!workerRef.current || status === 'completed'}
                >
                  Abbrechen
                </button>
                <button type="button" className="btn" onClick={closeModal}>
                  Schliessen
                </button>
              </div>

              <div className="result-panel">
                <div>
                  <span className="muted">lambda (Benettin):</span>
                  <strong>{Number.isFinite(result?.lambda ?? Number.NaN) ? formatNumber(result!.lambda, 5) : 'n/a'}</strong>
                </div>
                <div>
                  <span className="muted">Fit-Steigung:</span>
                  <strong>{Number.isFinite(fit?.slope ?? Number.NaN) ? formatNumber(fit!.slope, 5) : 'n/a'}</strong>
                </div>
                <div>
                  <span className="muted">Interpretation:</span>
                  <strong>{interpretLambda(finalLambda)}</strong>
                </div>
                {fit?.rSquared != null && (
                  <div>
                    <span className="muted">R^2:</span>
                    <strong>{formatNumber(fit.rSquared, 3)}</strong>
                  </div>
                )}
              </div>

              {errorMessage && <p className="error-banner">{errorMessage}</p>}
            </section>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
