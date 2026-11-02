'use client'

/**
 * Writes a URL without asking the server for the page again. Next keeps
 * `useSearchParams` and `usePathname` in step with the browser's history API,
 * so sheets open and close at once and the page's data is not reloaded.
 *
 * Use it only when the page already holds what the new URL shows. When the
 * server has to resolve something (a row on another page of a list, a record
 * the page never loaded), use `router.push` instead.
 */
export function writeShallowUrl(url: string, mode: 'push' | 'replace') {
  if (mode === 'push') {
    window.history.pushState(null, '', url)
  } else {
    window.history.replaceState(null, '', url)
  }
}

/**
 * True when `next` differs from `current` only in the `keys` query params,
 * so a page that reads the rest of the URL has nothing new to render.
 */
export function differsOnlyInParams(
  current: string,
  next: string,
  keys: readonly string[]
) {
  const base = 'http://local'
  const a = new URL(current, base)
  const b = new URL(next, base)
  if (a.pathname !== b.pathname) {
    return false
  }

  const strip = (params: URLSearchParams) => {
    const copy = new URLSearchParams(params)
    for (const key of keys) {
      copy.delete(key)
    }
    copy.sort()
    return copy.toString()
  }

  return strip(a.searchParams) === strip(b.searchParams)
}
