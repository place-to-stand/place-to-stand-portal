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
/** When the tab went to the background; survives a background reload. */
const HIDDEN_SINCE_KEY = 'pts:hidden-since'

function setHiddenSince(value: number | null) {
  try {
    if (value) sessionStorage.setItem(HIDDEN_SINCE_KEY, String(value))
    else sessionStorage.removeItem(HIDDEN_SINCE_KEY)
  } catch {
    // Storage blocked: the away time starts at this page load.
  }
}

function readHiddenSince() {
  try {
    const value = Number(sessionStorage.getItem(HIDDEN_SINCE_KEY))
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

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
    // A page reloaded in the background keeps counting from when the tab
    // was first hidden (NewVersionReload reloads hidden tabs).
    let hiddenAt: number | null =
      document.visibilityState === 'hidden'
        ? (readHiddenSince() ?? Date.now())
        : null
    if (hiddenAt) setHiddenSince(hiddenAt)
    let armedAway: number | null = null

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
        setHiddenSince(hiddenAt)
        return
      }
      const away = hiddenAt ? Date.now() - hiddenAt : 0
      hiddenAt = null
      setHiddenSince(null)
      armedAway = away >= AWAY_MS ? away : null
    }
    const onClick = (event: MouseEvent) => {
      if (armedAway === null) return
      // A click that opens a new tab or window leaves this one where it is.
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }
      const link = (event.target as Element | null)?.closest('a[href]')
      if (!(link instanceof HTMLAnchorElement)) return
      // Only a move to another page in this tab can be timed.
      const target = new URL(link.href, window.location.href)
      if (
        link.target === '_blank' ||
        link.hasAttribute('download') ||
        target.origin !== window.location.origin ||
        target.pathname + target.search ===
          window.location.pathname + window.location.search
      ) {
        return
      }
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
