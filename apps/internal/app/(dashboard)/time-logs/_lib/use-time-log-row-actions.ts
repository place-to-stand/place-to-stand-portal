'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'

import { toastLink, useToast } from '@/components/ui/use-toast'
import type { DashboardTimeLogEntry } from '@/lib/dashboard/types'
import { requestTimeLogArchiveChange } from '@/lib/projects/time-log/time-log-archive-request'

type Change = 'archive' | 'restore'

const SUCCESS_TOAST: Record<Change, { title: string; description: string }> = {
  archive: {
    title: 'Time log archived',
    description: 'The time log no longer counts toward the burndown total.',
  },
  restore: {
    title: 'Time log restored',
    description: 'The time log counts toward the burndown total again.',
  },
}

/**
 * Archive (confirm first) and restore for the Time logs list rows, with the
 * same toasts and closed-month warning as the project time-log history.
 */
export function useTimeLogRowActions() {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingArchive, setPendingArchive] =
    useState<DashboardTimeLogEntry | null>(null)

  const mutation = useMutation({
    mutationFn: ({
      entry,
      change,
    }: {
      entry: DashboardTimeLogEntry
      change: Change
    }) => requestTimeLogArchiveChange(entry.projectId, entry.id, change),
    onSuccess: (data, { entry, change }) => {
      // A time log has no sheet of its own: link its project.
      const link = toastLink('project', entry.projectId)
      toast({ ...SUCCESS_TOAST[change], link })
      if (data.warning) {
        toast({
          title: 'Closed month',
          description: data.warning,
          variant: 'warning',
          link,
        })
      }
      setPendingArchive(null)
      router.refresh()
    },
    onError: (error, { entry, change }) => {
      console.error(`Failed to ${change} time log`, error)
      toast({
        title:
          change === 'archive'
            ? 'Unable to archive time log'
            : 'Unable to restore time log',
        description: 'Please try again. If the issue persists contact support.',
        variant: 'destructive',
        link: toastLink('project', entry.projectId),
      })
    },
  })

  const busyEntryId = mutation.isPending ? mutation.variables?.entry.id : null

  return {
    /** Row whose archive/restore request is in flight. */
    busyEntryId: busyEntryId ?? null,
    isMutating: mutation.isPending,
    archiveConfirm: {
      open: pendingArchive !== null,
      request: (entry: DashboardTimeLogEntry) => setPendingArchive(entry),
      cancel: () => {
        if (!mutation.isPending) setPendingArchive(null)
      },
      confirm: () => {
        if (pendingArchive && !mutation.isPending) {
          mutation.mutate({ entry: pendingArchive, change: 'archive' })
        }
      },
    },
    restore: (entry: DashboardTimeLogEntry) => {
      if (!mutation.isPending) mutation.mutate({ entry, change: 'restore' })
    },
  }
}
