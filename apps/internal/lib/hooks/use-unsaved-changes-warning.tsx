'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

import { ConfirmDialog } from '@placetostand/ui/confirm-dialog'

import {
  confirmDiscardDrafts,
  registerDiscardGuard,
} from '@/lib/sheets/discard-guards'
import { useSheetStackEntry } from '@/lib/sheets/stack-entry'

type UseUnsavedChangesWarningOptions = {
  isDirty: boolean
  title?: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  /**
   * Work inside a sheet that saves on its own click (a comment, a lead
   * update). The sheet's close asks it first, since the sheet's Save never
   * sees it.
   */
  draft?: boolean
}

type UseUnsavedChangesWarningResult = {
  requestConfirmation: (next: () => void, stay?: () => void) => void
  dialog: ReactNode
}

export function useUnsavedChangesWarning({
  isDirty,
  title = 'Discard changes?',
  description = 'You have unsaved updates that will be lost. Continue without saving?',
  confirmLabel = 'Discard',
  cancelLabel = 'Stay',
  draft = false,
}: UseUnsavedChangesWarningOptions): UseUnsavedChangesWarningResult {
  const [dialogOpen, setDialogOpen] = useState(false)
  const pendingActionRef = useRef<(() => void) | null>(null)
  const pendingStayRef = useRef<(() => void) | null>(null)

  // Read at call time: a guard held elsewhere (going back through the
  // stack) can run after a save cleaned the form, before this re-renders.
  const isDirtyRef = useRef(isDirty)
  useEffect(() => {
    isDirtyRef.current = isDirty
  }, [isDirty])

  const stackId = useSheetStackEntry()?.id

  // Asks only about this form's own changes.
  const confirmOwn = useCallback((next: () => void, stay?: () => void) => {
    if (!isDirtyRef.current) {
      next()
      return
    }

    pendingActionRef.current = next
    pendingStayRef.current = stay ?? null
    setDialogOpen(true)
  }, [])

  // A sheet's close asks its drafts (an unsent comment) first, then its form.
  const requestConfirmation = useCallback(
    (next: () => void, stay?: () => void) => {
      if (draft) {
        confirmOwn(next, stay)
        return
      }
      confirmDiscardDrafts(stackId, () => confirmOwn(next, stay), stay)
    },
    [confirmOwn, draft, stackId]
  )

  const handleCancel = useCallback(() => {
    const stay = pendingStayRef.current
    pendingActionRef.current = null
    pendingStayRef.current = null
    setDialogOpen(false)
    stay?.()
  }, [])

  const handleConfirm = useCallback(() => {
    const action = pendingActionRef.current
    pendingActionRef.current = null
    pendingStayRef.current = null
    setDialogOpen(false)
    action?.()
  }, [])

  // A sheet in the stack with unsaved changes asks here before going back
  // to a sheet below it closes this one.
  useEffect(() => {
    if (!isDirty || !stackId) {
      return
    }
    // Registers only the form's own check: the stack walks every guard.
    return registerDiscardGuard(stackId, confirmOwn, { draft })
  }, [confirmOwn, draft, isDirty, stackId])

  useEffect(() => {
    if (!isDirty) {
      return
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [isDirty])

  return {
    requestConfirmation,
    dialog: (
      <ConfirmDialog
        open={dialogOpen}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        confirmVariant='destructive'
        onCancel={handleCancel}
        onConfirm={handleConfirm}
      />
    ),
  }
}
