/** Wire shapes the planning panel reads; shared by the API routes and hooks. */

type PlanThreadGenerationStatus = 'idle' | 'streaming' | 'error'

export type PlanThreadData = {
  id: string
  model: string
  modelLabel: string
  currentVersion: number
  generationStatus: PlanThreadGenerationStatus
  generatingVersion: number | null
  partialContent: string | null
  generationError: string | null
}

export type PlanningSessionData = {
  sessionId: string
  threads: PlanThreadData[]
}

export type PlanRevisionData = {
  id: string
  version: number
  content: string
  feedback: string | null
  createdAt: string
}
