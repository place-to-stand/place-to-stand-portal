'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

import type { DbUser, ProjectWithRelations } from '@/lib/types'
import type { LeadRecord } from '@/lib/leads/types'
import type { UserRole } from '@/lib/auth/session'
import { Sheet, SheetContent } from '@/components/ui/sheet'

import { TaskSheet } from '@/app/(dashboard)/projects/task-sheet'

type TaskSheetInitData = {
  admins: DbUser[]
  projects: ProjectWithRelations[]
  salesProjectId: string
  currentUserId: string
  currentUserRole: UserRole
}

type LeadTaskSheetOverlayProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  lead: LeadRecord
  canManage: boolean
  onSuccess?: () => void
}

/**
 * Overlay wrapper for TaskSheet that pre-configures it for lead-related tasks.
 * Fetches the necessary data (admins, projects) when opened.
 */
export function LeadTaskSheetOverlay({
  open,
  onOpenChange,
  lead,
  canManage,
  onSuccess,
}: LeadTaskSheetOverlayProps) {
  const [initData, setInitData] = useState<TaskSheetInitData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchInitData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/leads/task-sheet-init')
      const result = await response.json()

      if (!result.ok) {
        setError(result.error ?? 'Failed to load task form.')
        return
      }

      setInitData(result.data)
    } catch (err) {
      console.error('Failed to fetch task sheet init data:', err)
      setError('Unable to load task form. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open && !initData && !isLoading) {
      fetchInitData()
    }
  }, [open, initData, isLoading, fetchInitData])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      onOpenChange(nextOpen)
      if (!nextOpen) {
        // Clear data when closed so it refetches next time (in case projects changed)
        setInitData(null)
        setError(null)
      }
    },
    [onOpenChange]
  )

  const handleTaskSheetOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        onSuccess?.()
      }
      handleOpenChange(nextOpen)
    },
    [handleOpenChange, onSuccess]
  )

  // Show loading state while fetching init data
  if (open && (isLoading || error || !initData)) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent className='flex w-full flex-col items-center justify-center gap-4 sm:max-w-[676px]'>
          {isLoading && (
            <>
              <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
              <p className='text-sm text-muted-foreground'>Loading task form...</p>
            </>
          )}
          {error && (
            <>
              <p className='text-sm text-destructive'>{error}</p>
              <button
                type='button'
                onClick={fetchInitData}
                className='text-sm text-primary underline-offset-4 hover:underline'
              >
                Try again
              </button>
            </>
          )}
        </SheetContent>
      </Sheet>
    )
  }

  // Once data is loaded, render the full TaskSheet
  if (!initData) {
    return null
  }

  return (
    <TaskSheet
      open={open}
      onOpenChange={handleTaskSheetOpenChange}
      canManage={canManage}
      admins={initData.admins}
      currentUserId={initData.currentUserId}
      currentUserRole={initData.currentUserRole}
      defaultStatus='BACKLOG'
      defaultDueOn={null}
      projects={initData.projects}
      defaultProjectId={initData.salesProjectId}
      defaultAssigneeId={lead.assigneeId ?? null}
      defaultLeadId={lead.id}
    />
  )
}
