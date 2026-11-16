'use client'

import { useState } from 'react'

import { isNavItemActive } from '@/lib/navigation/active-route'

type NavTarget = {
  href: string
  matchHrefs?: string[]
}

type PendingNav<T> = {
  /** The item clicked last, shown active until its page arrives. */
  item: T
  /** Items clicked earlier in the same burst, whose pages may still land. */
  passed: T[]
}

/**
 * Moves the sidebar highlight the moment an item is clicked, instead of
 * when the new page arrives. Without it the highlight trailed the click,
 * and clicking quickly through two items let the first one's page land and
 * light up its item for a moment before the second took over.
 *
 * The pending item holds until the address reaches it. An address that
 * matches an item clicked earlier in the same burst is passed over; any
 * other address (a redirect, the back button) drops the pending item and
 * the address decides again.
 */
export function useOptimisticNavItem<T extends NavTarget>(pathname: string) {
  const [pending, setPending] = useState<PendingNav<T> | null>(null)
  const [settledPath, setSettledPath] = useState(pathname)

  if (settledPath !== pathname) {
    setSettledPath(pathname)
    if (pending) {
      const reached = isNavItemActive(pathname, pending.item)
      const passedThrough = pending.passed.some(item =>
        isNavItemActive(pathname, item)
      )
      if (reached || !passedThrough) setPending(null)
    }
  }

  const isActive = (item: T) =>
    pending ? pending.item === item : isNavItemActive(pathname, item)

  const select = (item: T) => {
    if (isActive(item)) return
    setPending(current => ({
      item,
      passed: current ? [...current.passed, current.item] : [],
    }))
  }

  return { isActive, select }
}
