import 'server-only'

import { AsyncLocalStorage } from 'node:async_hooks'

/** The OAuth client acting for a human — the "via Claude Code" half of attribution. */
type ActivityAgent = {
  clientId: string
  name: string
}

/** Shown when the OAuth client's name can't be read; never stored on a row. */
export const UNKNOWN_AGENT_NAME = 'Unknown app'

const agentStorage = new AsyncLocalStorage<ActivityAgent>()

/**
 * Run `fn` with `agent` attached to every activity row it writes.
 *
 * Writes reach `logActivity` through a dozen shared cores (task save, lead
 * save, comments, lead updates), each already taking a `source`. Threading an
 * agent argument through all of them would touch every signature for one
 * channel; carrying it in request-scoped context keeps the cores unaware of
 * MCP, and `logActivity` is the single place that reads it.
 */
export function runAsAgent<T>(agent: ActivityAgent, fn: () => T): T {
  return agentStorage.run(agent, fn)
}

export function currentActivityAgent(): ActivityAgent | undefined {
  return agentStorage.getStore()
}

/**
 * The acting app's name for rows that keep it ("via Claude" on a comment), or
 * null when a person acts or the name couldn't be resolved, so a lookup
 * failure never labels a row "via Unknown app" for good. Set on create only:
 * it records who first wrote the text, and a later edit doesn't change that.
 */
export function currentAgentName(): string | null {
  const name = agentStorage.getStore()?.name

  return name && name !== UNKNOWN_AGENT_NAME ? name : null
}
