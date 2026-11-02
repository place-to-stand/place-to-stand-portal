import 'server-only'

import { AsyncLocalStorage } from 'node:async_hooks'

const tokenRequest = new AsyncLocalStorage<true>()

/**
 * Mark `fn` as serving a bearer-token request (CLI or MCP). Such requests
 * have no cookie session, so the page guards in `session.ts` throw a 401
 * there instead of redirecting to the sign-in pages.
 */
export function runAsTokenRequest<T>(fn: () => T): T {
  return tokenRequest.run(true, fn)
}

export function isTokenRequest(): boolean {
  return tokenRequest.getStore() === true
}
