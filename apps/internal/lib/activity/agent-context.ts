import 'server-only'

import { AsyncLocalStorage } from 'node:async_hooks'

/** The OAuth client acting for a human — the "via Claude Code" half of attribution. */
export type ActivityAgent = {
  clientId: string
  name: string
}

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
