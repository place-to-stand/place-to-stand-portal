/** Settings for the dashboard's activity summary: timeframes, limits, model. */

export const VALID_TIMEFRAMES = [1, 7, 14, 28] as const
export const ONE_HOUR_MS = 60 * 60 * 1000
// Gateway model id + reasoning level for the highlight. The summary is a few
// thousand input tokens and a short paragraph out, so a Flash-tier model at
// low thinking effort is plenty; bump here when a newer cheap model lands.
// The id is echoed in the `x-activity-overview-model` response header so the
// widget footer can show which model is in use.
export const ACTIVITY_SUMMARY_MODEL = 'zai/glm-5.3-flash'
export const ACTIVITY_SUMMARY_REASONING = 'low' as const
// Safety cap only. The prompt sets the real length target per timeframe;
// this just stops a runaway response from bloating the cache row.
export const HIGHLIGHT_CHARACTER_LIMIT = 4000
// Compact metadata appended to each prompt line, so one noisy event can't
// crowd out the rest.
export const METADATA_CHARACTER_LIMIT = 240

export type ValidTimeframe = (typeof VALID_TIMEFRAMES)[number]

// Newest rows fetched per timeframe. Every non-view row reaches the model,
// so these bound prompt size: ~40 tokens per compact line puts 28d at
// roughly 30k input tokens, well inside the model's context.
export const TIMEFRAME_LOG_LIMITS: Record<ValidTimeframe, number> = {
  1: 100,
  7: 300,
  14: 500,
  28: 800,
}

// Bullets per team member the prompt asks for, so longer windows get a
// fuller recap instead of the same three lines.
export const TIMEFRAME_BULLET_RANGE: Record<ValidTimeframe, string> = {
  1: '1-3',
  7: '2-4',
  14: '3-5',
  28: '3-6',
}

export type ActivityMetrics = {
  newLeads: number
  activeProjects: number
  blockedTasks: number
}
