/// <reference lib="webworker" />

import type {
  LogisticParams,
  MainToWorker,
  WorkerChunkPoint,
  WorkerMsg,
} from '../types/worker'

declare const self: DedicatedWorkerGlobalScope

type LinearFitResult = {
  slope: number
  intercept: number
  rSquared: number
}

let isRunning = false
let isPaused = false
let shouldAbort = false
const resumeResolvers: Array<() => void> = []

const waitWhilePaused = () => {
  if (!isPaused) return Promise.resolve()
  return new Promise<void>((resolve) => {
    resumeResolvers.push(resolve)
  })
}

const setPaused = (value: boolean) => {
  isPaused = value
  if (!isPaused) {
    while (resumeResolvers.length) {
      const resolveNext = resumeResolvers.pop()
      resolveNext?.()
    }
  }
}

const resetControlFlags = () => {
  isRunning = false
  setPaused(false)
  shouldAbort = false
}

const sendMessage = (msg: WorkerMsg) => {
  self.postMessage(msg)
}

const clampUnit = (value: number) => {
  if (!Number.isFinite(value) || Number.isNaN(value)) {
    return 1e-12
  }
  if (value <= 0) return 1e-12
  if (value >= 1) return 1 - 1e-12
  return value
}

const logisticStep = (x: number, r: number) => {
  const next = r * x * (1 - x)
  return clampUnit(next)
}

const tinyDelay = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

const linearFit = (xs: number[], ys: number[]): LinearFitResult | null => {
  if (xs.length < 2 || ys.length < 2 || xs.length !== ys.length) return null
  const n = xs.length
  let sumX = 0
  let sumY = 0
  let sumXX = 0
  let sumXY = 0

  for (let i = 0; i < n; i += 1) {
    const x = xs[i]
    const y = ys[i]
    sumX += x
    sumY += y
    sumXX += x * x
    sumXY += x * y
  }

  const denom = n * sumXX - sumX * sumX
  if (Math.abs(denom) < 1e-12) return null

  const slope = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n

  let ssRes = 0
  let ssTot = 0
  const meanY = sumY / n
  for (let i = 0; i < n; i += 1) {
    const x = xs[i]
    const y = ys[i]
    const yHat = slope * x + intercept
    ssRes += (y - yHat) ** 2
    ssTot += (y - meanY) ** 2
  }

  const rSquared = ssTot === 0 ? 1 : 1 - ssRes / ssTot
  return { slope, intercept, rSquared }
}

const computeLogisticLyapunov = async (params: LogisticParams) => {
  const {
    r,
    x0,
    delta0,
    totalIters,
    transient,
    renormSteps,
    chunkSize,
    sampleEvery,
  } = params

  const totalSteps = transient + totalIters
  const sampleStride = Math.max(1, sampleEvery)
  const chunk: WorkerChunkPoint[] = []
  const times: number[] = []
  const distances: number[] = []
  const logDistances: number[] = []
  const runningLambdaSeries: number[] = []

  let base = clampUnit(x0)
  let perturbed = clampUnit(x0 + delta0)

  let renormCounter = 0
  const renormInterval = Math.max(1, renormSteps)
  let renormEvents = 0
  let sumLnRatio = 0
  let lastLambda = Number.NaN

  for (let iter = 0; iter < totalSteps; iter += 1) {
    if (shouldAbort) {
      sendMessage({ type: 'error', message: 'Berechnung abgebrochen.' })
      return
    }

    // eslint-disable-next-line no-await-in-loop
    await waitWhilePaused()

    base = logisticStep(base, r)
    perturbed = logisticStep(perturbed, r)

    if (!Number.isFinite(base) || !Number.isFinite(perturbed)) {
      sendMessage({ type: 'error', message: 'Numerischer Überlauf in der Simulation.' })
      return
    }

    const diff = perturbed - base
    let distance = Math.abs(diff)
    if (!Number.isFinite(distance) || distance < 1e-18) {
      distance = 1e-18
    }

    const divergence = distance

    const t = iter - transient
    const afterTransient = iter >= transient
    const shouldRecord = afterTransient && ((iter - transient) % sampleStride === 0)

    if (afterTransient) {
      renormCounter += 1
      if (renormCounter >= renormInterval) {
        renormCounter = 0
        const lnRatio = Math.log(distance / delta0)
        if (Number.isFinite(lnRatio)) {
          sumLnRatio += lnRatio
          renormEvents += 1
          lastLambda = sumLnRatio / (renormEvents * renormInterval)
        }
        const direction = diff >= 0 ? 1 : -1
        perturbed = clampUnit(base + direction * delta0)
      }
    } else {
      renormCounter += 1
      if (renormCounter >= renormInterval) {
        renormCounter = 0
        const direction = diff >= 0 ? 1 : -1
        perturbed = clampUnit(base + direction * delta0)
      }
    }

    if (afterTransient && shouldRecord) {
      const lnDistance = Math.log(divergence)
      const point: WorkerChunkPoint = { t, d: divergence, ln_d: lnDistance }
      if (Number.isFinite(lastLambda)) {
        point.lambda_running = lastLambda
      }
      chunk.push(point)
      times.push(t)
      distances.push(distance)
      logDistances.push(lnDistance)
      runningLambdaSeries.push(Number.isFinite(lastLambda) ? lastLambda : Number.NaN)
    }

    if (chunk.length >= chunkSize) {
      sendMessage({ type: 'chunk', points: [...chunk] })
      chunk.length = 0
    }

    if ((iter + 1) % chunkSize === 0 || iter === totalSteps - 1) {
      sendMessage({ type: 'progress', done: iter + 1, total: totalSteps })
    }

    if ((iter & 0xff) === 0) {
      // eslint-disable-next-line no-await-in-loop
      await tinyDelay()
    }
  }

  if (chunk.length) {
    sendMessage({ type: 'chunk', points: [...chunk] })
  }

  const lambda = renormEvents > 0 ? sumLnRatio / (renormEvents * renormInterval) : Number.NaN
  const fit = linearFit(times, logDistances)
  if (fit) {
    sendMessage({
      type: 'fit',
      slope: fit.slope,
      intercept: fit.intercept,
      window: [times[0] ?? 0, times[times.length - 1] ?? 0],
      rSquared: fit.rSquared,
    })
  }

  sendMessage({
    type: 'result',
    lambda,
    times,
    d: distances,
    ln_d: logDistances,
    running_lambda: runningLambdaSeries.length ? runningLambdaSeries : undefined,
  })
}

const run = async (params: LogisticParams) => {
  isRunning = true
  shouldAbort = false
  setPaused(false)
  try {
    await computeLogisticLyapunov(params)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Worker-Fehler.'
    sendMessage({ type: 'error', message })
  } finally {
    resetControlFlags()
  }
}

self.addEventListener('message', (event: MessageEvent<MainToWorker>) => {
  const msg = event.data
  if (!msg) return
  switch (msg.cmd) {
    case 'start':
      if (isRunning) {
        sendMessage({ type: 'error', message: 'Es läuft bereits eine Berechnung.' })
        return
      }
      run(msg.params)
      break
    case 'pause':
      if (isRunning) {
        setPaused(true)
      }
      break
    case 'resume':
      if (isRunning) {
        setPaused(false)
      }
      break
    case 'abort':
      if (isRunning) {
        shouldAbort = true
        setPaused(false)
      }
      break
    default:
      break
  }
})
