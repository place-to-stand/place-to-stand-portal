export type ActionResult = {
  error?: string
}

export type SubmissionActionInput = {
  id: string
}

export type AcknowledgeSubmissionInput = {
  id: string
  /** The `lastActivityAt` of the row as rendered — the version token. */
  expectedLastActivityAt: string
}
