'use client'

import { useCallback, useState } from 'react'

import type { ProjectTimeLogDialogParams, TimeLogEntry } from './types'

export type TimeLogEditContext = {
  entry: TimeLogEntry
  params: ProjectTimeLogDialogParams
}

/**
 * Opens any time log in the edit dialog: fetches what the dialog needs for
 * that log's project on demand (`GET /api/dashboard/time-logs/[id]`). Shared
 * by the home Hours widget and the Time logs page.
 */
export function useTimeLogEditContext() {
  const [openingEntryId, setOpeningEntryId] = useState<string | null>(null)
  const [editContext, setEditContext] = useState<TimeLogEditContext | null>(null)
  const [error, setError] = useState<string | null>(null)

  const open = useCallback(async (entryId: string) => {
    setOpeningEntryId(entryId)
    setError(null)

    try {
      const response = await fetch(`/api/dashboard/time-logs/${entryId}`, {
        cache: 'no-store',
      })
      const payload = (await response.json()) as {
        ok: boolean
        data?: TimeLogEditContext
        error?: string
      }

      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.error ?? 'Request failed')
      }

      setEditContext(payload.data)
    } catch (requestError) {
      console.error('Failed to open time log', requestError)
      setError('Unable to open that log. Please try again.')
    } finally {
      setOpeningEntryId(null)
    }
  }, [])

  const close = useCallback(() => setEditContext(null), [])

  return { openingEntryId, editContext, error, setError, open, close }
}
