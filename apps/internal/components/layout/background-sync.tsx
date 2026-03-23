'use client'

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'

import { useSidebarCounts } from './app-shell'

interface BackgroundSyncProps {
  isConnected: boolean
}

function subscribeOnline(callback: () => void) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

function getOnlineSnapshot() {
  return navigator.onLine
}

function getServerSnapshot() {
  return true
}

/**
 * Invisible component that polls Gmail + transcript sync every 60s.
 * Rendered in the dashboard layout so it runs on every page,
 * keeping the sidebar badge count fresh.
 *
 * Skips polling when the browser is offline to avoid triggering
 * unhandled network errors that crash the React error boundary.
 */
export function BackgroundSync({ isConnected }: BackgroundSyncProps) {
  const { refreshCounts } = useSidebarCounts()
  const hasSyncedRef = useRef(false)
  const isOnline = useSyncExternalStore(
    subscribeOnline,
    getOnlineSnapshot,
    getServerSnapshot,
  )

  const syncSilently = useCallback(async () => {
    if (!navigator.onLine) return

    try {
      await Promise.all([
        fetch('/api/integrations/gmail/sync', { method: 'POST' }),
        fetch('/api/integrations/transcripts/sync', { method: 'POST' }),
      ])

      // After syncing, refresh only the sidebar badge counts.
      // This updates just the count via React state — no router.refresh(),
      // so form state, scroll position, and other client state are preserved.
      await refreshCounts()
    } catch {
      // Silent — no toast, no UI
    }
  }, [refreshCounts])

  useEffect(() => {
    if (!isConnected || !isOnline) return

    if (!hasSyncedRef.current) {
      hasSyncedRef.current = true
      syncSilently()
    }

    const interval = setInterval(syncSilently, 60_000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, isOnline])

  return null
}
