'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

import { ConfirmDialog } from '@pts/ui/confirm-dialog'

import { registerDiscardGuard } from '@/lib/sheets/discard-guards'
import { useSheetStackEntry } from '@/lib/sheets/stack-entry'

type UseUnsavedChangesWarningOptions = {
  isDirty: boolean
  title?: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
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

  const requestConfirmation = useCallback(
    (next: () => void, stay?: () => void) => {
      if (!isDirtyRef.current) {
        next()
        return
      }

      pendingActionRef.current = next
      pendingStayRef.current = stay ?? null
      setDialogOpen(true)
    },
    []
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
  const stackId = useSheetStackEntry()?.id
  useEffect(() => {
    if (!isDirty || !stackId) {
      return
    }
    return registerDiscardGuard(stackId, requestConfirmation)
  }, [isDirty, requestConfirmation, stackId])

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
