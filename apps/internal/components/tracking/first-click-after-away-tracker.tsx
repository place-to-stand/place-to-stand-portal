'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'

import { INTERACTION_EVENTS } from '@/lib/posthog/types'

/** Away at least this long before the first click counts. */
const AWAY_MS = 60 * 60_000
/** A click older than this when the page lands wasn't the one that loaded it. */
const STALE_MS = 60_000
const STORAGE_KEY = 'pts:first-click-after-away'

type PendingClick = { clickAt: number; awayMinutes: number; from: string }

function readPending(): PendingClick | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PendingClick) : null
  } catch {
    return null
  }
}

function writePending(value: PendingClick | null) {
  try {
    if (value) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage blocked: this one click goes unmeasured.
  }
}

function report(pending: PendingClick, fullReload: boolean) {
  writePending(null)
  const duration = Date.now() - pending.clickAt
  if (duration > STALE_MS) return
  posthog.capture(INTERACTION_EVENTS.FIRST_CLICK_AFTER_AWAY, {
    duration,
    fullReload,
    awayMinutes: pending.awayMinutes,
    from: pending.from,
    to: window.location.pathname,
  })
}

/**
 * Times the first click after the tab sat in the background an hour or more,
 * from the click until the next page shows. `fullReload` says whether it
 * became a whole page load (a deploy happened while away) or stayed an
 * in-app move (slow sign-in renewal or a cold server). The click is kept in
 * sessionStorage so a full reload can still report it.
 */
export function FirstClickAfterAwayTracker() {
  const pathname = usePathname()
  const search = useSearchParams()?.toString() ?? ''

  // A page that loaded because of the click reports it as a full reload.
  useEffect(() => {
    const pending = readPending()
    if (pending) report(pending, true)
  }, [])

  // An in-app move reports when the URL changes.
  useEffect(() => {
    const pending = readPending()
    if (pending) report(pending, false)
  }, [pathname, search])

  useEffect(() => {
    let hiddenAt: number | null =
      document.visibilityState === 'hidden' ? Date.now() : null
    let armedAway: number | null = null

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
        return
      }
      const away = hiddenAt ? Date.now() - hiddenAt : 0
      hiddenAt = null
      armedAway = away >= AWAY_MS ? away : null
    }
    const onClick = (event: MouseEvent) => {
      if (armedAway === null) return
      const link = (event.target as Element | null)?.closest('a[href]')
      if (!link) return
      writePending({
        clickAt: Date.now(),
        awayMinutes: Math.round(armedAway / 60_000),
        from: window.location.pathname,
      })
      armedAway = null
    }

    document.addEventListener('visibilitychange', onVisibility)
    document.addEventListener('click', onClick, true)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      document.removeEventListener('click', onClick, true)
    }
  }, [])

  return null
}
