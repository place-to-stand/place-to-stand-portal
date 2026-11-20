/**
 * Active-route matching for nav items: the sidebar highlights an item when
 * the path is its href, one of its `matchHrefs`, or below either.
 */

type Matchable = {
  href: string
  matchHrefs?: string[]
}

function matchesPath(pathname: string, target: string): boolean {
  if (!target) return false
  return pathname === target || pathname.startsWith(`${target}/`)
}

export function isNavItemActive(pathname: string, item: Matchable): boolean {
  const candidates = [item.href, ...(item.matchHrefs ?? [])]
  return candidates.some(candidate => matchesPath(pathname, candidate))
}
