'use client'

import { useCallback, useRef, useState } from 'react'

import type { ProjectTimeLogDialogParams, TimeLogEntry } from './types'

export type TimeLogEditContext = {
  entry: TimeLogEntry
  params: ProjectTimeLogDialogParams
}

/**
 * Opens any time log in the edit dialog: the dialog shows at once (`entryId`
 * set) while what it needs for that log's project loads on demand
 * (`GET /api/dashboard/time-logs/[id]`). Shared by the home Hours widget and
 * the Time logs lists.
 */
export function useTimeLogEditContext() {
  const [entryId, setEntryId] = useState<string | null>(null)
  const [editContext, setEditContext] = useState<TimeLogEditContext | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)
  // A later open (or a close) makes an earlier response stale.
  const requestRef = useRef(0)

  const open = useCallback(async (nextEntryId: string) => {
    const request = ++requestRef.current
    setEntryId(nextEntryId)
    setEditContext(null)
    setError(null)

    try {
      const response = await fetch(`/api/dashboard/time-logs/${nextEntryId}`, {
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

      if (request === requestRef.current) setEditContext(payload.data)
    } catch (requestError) {
      console.error('Failed to open time log', requestError)
      if (request === requestRef.current) {
        setError('Unable to open that log. Please try again.')
      }
    }
  }, [])

  const close = useCallback(() => {
    requestRef.current += 1
    setEntryId(null)
    setEditContext(null)
    setError(null)
  }, [])

  return {
    /** The log the dialog is open for (loading or loaded); null when shut. */
    entryId,
    /** The id still loading, for a row's spinner. */
    openingEntryId: entryId && !editContext && !error ? entryId : null,
    editContext,
    error,
    open,
    close,
  }
}
