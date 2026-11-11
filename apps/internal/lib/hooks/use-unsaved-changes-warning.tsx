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
  requestConfirmation: (next: () => void) => void
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

  const requestConfirmation = useCallback(
    (next: () => void) => {
      if (!isDirty) {
        next()
        return
      }

      pendingActionRef.current = next
      setDialogOpen(true)
    },
    [isDirty]
  )

  const handleCancel = useCallback(() => {
    pendingActionRef.current = null
    setDialogOpen(false)
  }, [])

  const handleConfirm = useCallback(() => {
    const action = pendingActionRef.current
    pendingActionRef.current = null
    setDialogOpen(false)
    action?.()
  }, [])

  // A sheet in the stack with unsaved changes asks here before going back
  // to a sheet below it closes this one.
  const entry = useSheetStackEntry()
  const entryEntity = entry?.entity
  const entryValue = entry?.value
  useEffect(() => {
    if (!isDirty || !entryEntity || !entryValue) {
      return
    }
    return registerDiscardGuard(entryEntity, entryValue, requestConfirmation)
  }, [entryEntity, entryValue, isDirty, requestConfirmation])

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
