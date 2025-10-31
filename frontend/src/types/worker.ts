export type WorkerChunkPoint = {
  t: number
  d: number
  ln_d: number
  lambda_running?: number
}

export type WorkerProgressMsg = {
  type: 'progress'
  done: number
  total: number
}

export type WorkerChunkMsg = {
  type: 'chunk'
  points: WorkerChunkPoint[]
}

export type WorkerFitMsg = {
  type: 'fit'
  slope: number
  intercept: number
  window: [number, number]
  rSquared?: number
}

export type WorkerResultMsg = {
  type: 'result'
  lambda: number
  times: number[]
  d: number[]
  ln_d: number[]
  running_lambda?: number[]
}

export type WorkerErrorMsg = {
  type: 'error'
  message: string
}

export type WorkerMsg =
  | WorkerProgressMsg
  | WorkerChunkMsg
  | WorkerFitMsg
  | WorkerResultMsg
  | WorkerErrorMsg

export type LogisticParams = {
  system: 'logistic'
  r: number
  x0: number
  delta0: number
  totalIters: number
  transient: number
  renormSteps: number
  chunkSize: number
  sampleEvery: number
}

export type StartCmd = {
  cmd: 'start'
  params: LogisticParams
}

export type PauseCmd = { cmd: 'pause' }
export type ResumeCmd = { cmd: 'resume' }
export type AbortCmd = { cmd: 'abort' }

export type MainToWorker = StartCmd | PauseCmd | ResumeCmd | AbortCmd
