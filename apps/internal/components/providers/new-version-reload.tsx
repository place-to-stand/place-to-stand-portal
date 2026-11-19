'use client'

import { useEffect } from 'react'

import { hasUnsavedChanges } from '@/lib/sheets/discard-guards'

/** The commit this tab's code was built from (inlined at build time). */
const TAB_VERSION = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? null
const CHECK_EVERY_MS = 5 * 60_000

/**
 * A tab left open across a deploy runs old code, and Next.js turns its next
 * click into a full page load (version skew), which feels like a hang. While
 * the tab is in the background this checks every few minutes for a new
 * version and, if there is one and nothing is unsaved, reloads it then, so
 * it's fresh when you come back. Coming back to a tab that missed its checks
 * (Chrome slows background timers) checks once more and reloads at once.
 */
export function NewVersionReload() {
  useEffect(() => {
    if (!TAB_VERSION) return

    let checking = false
    const check = async () => {
      if (checking || !navigator.onLine) return
      checking = true
      try {
        const response = await fetch('/api/version', { cache: 'no-store' })
        if (!response.ok) return
        const payload = (await response.json().catch(() => null)) as {
          data?: { version?: string | null }
        } | null
        const live = payload?.data?.version
        if (live && live !== TAB_VERSION && !hasUnsavedChanges()) {
          window.location.reload()
        }
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
      if (away >= CHECK_EVERY_MS) void check()
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return null
}
