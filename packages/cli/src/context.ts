import { LOCAL_API_URL, PRODUCTION_API_URL, resolveApiUrl } from './config.js'

export type GlobalOptions = {
  apiUrl?: string
  local?: boolean
  prod?: boolean
  pretty?: boolean
}

let current: GlobalOptions = {}

/** Set once from commander's preAction hook, before any command body runs. */
export function setGlobalOptions(options: GlobalOptions): void {
  current = options
}

export function globalOptions(): GlobalOptions {
  return current
}

/**
 * Highest precedence first: an explicit `--api-url`, then the `--local`/`--prod`
 * shorthands, then `PTS_API_URL`, then `~/.pts/config.json`, then production.
 *
 * `--local` and `--prod` are only shorthands for a URL, so they collapse into
 * the same override slot `--api-url` uses rather than being a separate concept.
 */
export function resolveApiContext(): Promise<string> {
  if (current.local && current.prod) {
    throw new Error('Pass either --local or --prod, not both.')
  }

  const shorthand = current.local
    ? LOCAL_API_URL
    : current.prod
      ? PRODUCTION_API_URL
      : undefined

  return resolveApiUrl(current.apiUrl ?? shorthand)
}
