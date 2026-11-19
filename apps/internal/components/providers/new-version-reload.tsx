'use client'

import { useEffect } from 'react'

import { hasUnsavedChanges } from '@/lib/sheets/discard-guards'

/** The commit this tab's code was built from (inlined at build time). */
const TAB_VERSION = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? null
const CHECK_EVERY_MS = 5 * 60_000
/** The version this tab last reloaded for, so a mismatch can't loop. */
const RELOADED_FOR_KEY = 'pts:reloaded-for-version'

function reloadedFor() {
  try {
    return sessionStorage.getItem(RELOADED_FOR_KEY)
  } catch {
    return null
  }
}

/**
 * Nothing that a reload could lose: no page form or sheet with unsaved
 * changes, and no sheet or dialog open at all (comment drafts, the time log
 * dialog and the Account sheet keep work outside the unsaved-changes guards).
 */
function safeToReload() {
  return (
    !hasUnsavedChanges() &&
    !document.querySelector('[role="dialog"], [role="alertdialog"]') &&
    !typingInField()
  )
}

/** A focused field with text in it (say a search box mid-debounce). */
function typingInField() {
  const field = document.activeElement
  if (
    field instanceof HTMLInputElement ||
    field instanceof HTMLTextAreaElement
  ) {
    return field.value !== ''
  }
  return field instanceof HTMLElement && field.isContentEditable
    ? (field.textContent ?? '') !== ''
    : false
}

/** Anything that shows someone is using the tab again. */
const TOUCH_EVENTS = [
  'pointerdown',
  'keydown',
  'wheel',
  'touchstart',
  'focusin',
] as const

/**
 * A tab left open across a deploy runs old code, and Next.js turns its next
 * click into a full page load (version skew), which feels like a hang. While
 * the tab is in the background this checks every few minutes for a new
 * version and, if there is one and nothing could be lost, reloads it then, so
 * it's fresh when you come back. Coming back to a tab that missed its checks
 * (Chrome slows background timers) checks once more, and reloads only if you
 * haven't started clicking or typing yet.
 */
export function NewVersionReload() {
  useEffect(() => {
    if (!TAB_VERSION) return

    let stopped = false
    let checking = false
    let touchedSinceVisible = false

    const check = async () => {
      if (stopped || checking || !navigator.onLine) return
      checking = true
      try {
        const response = await fetch('/api/version', { cache: 'no-store' })
        // Signed out (sign-in, share pages, a lapsed session): the proxy
        // redirects to sign-in. Nothing to compare this time; ask again on
        // the next tick, since the person may sign back in.
        if (response.redirected || !response.ok) return
        const payload = (await response.json().catch(() => null)) as {
          data?: { version?: string | null }
        } | null
        const live = payload?.data?.version
        if (
          !live ||
          live === TAB_VERSION ||
          reloadedFor() === live ||
          !safeToReload() ||
          // Judged now, not when the check started: a check begun in the
          // background can finish after the person has come back.
          (document.visibilityState === 'visible' && touchedSinceVisible)
        ) {
          return
        }
        try {
          sessionStorage.setItem(RELOADED_FOR_KEY, live)
        } catch {
          // Without storage a mismatch could repeat; skip rather than loop.
          return
        }
        window.location.reload()
      } catch {
        // Offline or mid-deploy: try again on the next tick.
      } finally {
        checking = false
      }
    }

    let hiddenAt: number | null =
      document.visibilityState === 'hidden' ? Date.now() : null
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') void check()
    }, CHECK_EVERY_MS)
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
        return
      }
      const away = hiddenAt ? Date.now() - hiddenAt : 0
      hiddenAt = null
      touchedSinceVisible = false
      if (away >= CHECK_EVERY_MS) void check()
    }
    const onTouch = () => {
      touchedSinceVisible = true
    }

    document.addEventListener('visibilitychange', onVisibility)
    for (const name of TOUCH_EVENTS) {
      document.addEventListener(name, onTouch, { capture: true, passive: true })
    }
    return () => {
      stopped = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
      for (const name of TOUCH_EVENTS) {
        document.removeEventListener(name, onTouch, { capture: true })
      }
    }
  }, [])

  return null
}
