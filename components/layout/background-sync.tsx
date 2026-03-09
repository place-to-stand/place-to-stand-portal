'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface BackgroundSyncProps {
  isConnected: boolean
}

/**
 * Invisible component that polls Gmail + transcript sync every 60s.
 * Rendered in the dashboard layout so it runs on every page,
 * keeping the sidebar badge count fresh.
 */
export function BackgroundSync({ isConnected }: BackgroundSyncProps) {
  const router = useRouter()
  const hasSyncedRef = useRef(false)

  const syncSilently = useCallback(async () => {
    try {
      const [emailRes, transcriptRes] = await Promise.all([
        fetch('/api/integrations/gmail/sync', { method: 'POST' }),
        fetch('/api/integrations/transcripts/sync', { method: 'POST' }),
      ])
      if (emailRes.ok || transcriptRes.ok) {
        router.refresh()
      }
    } catch {
      // Silent — no toast, no UI
    }
  }, [router])

  useEffect(() => {
    if (!isConnected) return

    if (!hasSyncedRef.current) {
      hasSyncedRef.current = true
      syncSilently()
    }

    const interval = setInterval(syncSilently, 60_000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected])

  return null
}
