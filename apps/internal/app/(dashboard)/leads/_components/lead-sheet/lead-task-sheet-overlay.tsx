'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { DbUser, ProjectWithRelations } from '@/lib/types'
import type { LeadRecord } from '@/lib/leads/types'
import type { UserRole } from '@/lib/auth/session'

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
 * Fetches init data on first open and caches it across opens to prevent the
 * loading-Sheet → TaskSheet DOM swap that causes a visible flash.
 */
export function LeadTaskSheetOverlay({
  open,
  onOpenChange,
  lead,
  canManage,
  onSuccess,
}: LeadTaskSheetOverlayProps) {
  const [initData, setInitData] = useState<TaskSheetInitData | null>(null)
  const fetchingRef = useRef(false)

  // Derive sheet visibility: only open once data is loaded.
  // Data is cached across open/close cycles to eliminate the
  // loading-Sheet → TaskSheet DOM swap flash.
  const sheetOpen = open && initData !== null

  // Fetch init data when parent requests open and data is not yet cached
  useEffect(() => {
    if (!open || initData || fetchingRef.current) return

    fetchingRef.current = true
    let cancelled = false

    fetch('/api/leads/task-sheet-init')
      .then(res => res.json())
      .then(result => {
        if (cancelled) return
        if (result.ok) {
          setInitData(result.data)
        } else {
          console.error('[LeadTaskSheetOverlay] Init failed:', result.error)
          onOpenChange(false)
        }
      })
      .catch(err => {
        if (cancelled) return
        console.error('[LeadTaskSheetOverlay] Fetch failed:', err)
        onOpenChange(false)
      })
      .finally(() => {
        fetchingRef.current = false
      })

    return () => {
      cancelled = true
    }
  }, [open, initData, onOpenChange])

  const handleSheetClose = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        onOpenChange(false)
        onSuccess?.()
      }
    },
    [onOpenChange, onSuccess]
  )

  if (!sheetOpen || !initData) return null

  return (
    <TaskSheet
      open
      onOpenChange={handleSheetClose}
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
