'use client'

import type { ReactNode } from 'react'

import { ConfirmDialog } from '@pts/ui/confirm-dialog'

type LeadSheetDialogsProps = {
  // Archive dialog
  isArchiveDialogOpen: boolean
  isArchiving: boolean
  onArchiveCancel: () => void
  onArchiveConfirm: () => void
  // Unsaved changes dialog
  unsavedChangesDialog: ReactNode
}

export function LeadSheetDialogs({
  isArchiveDialogOpen,
  isArchiving,
  onArchiveCancel,
  onArchiveConfirm,
  unsavedChangesDialog,
}: LeadSheetDialogsProps) {
  return (
    <>
      <ConfirmDialog
        open={isArchiveDialogOpen}
        title='Archive this lead?'
        description='Archiving removes the lead from the board without permanently deleting history.'
        confirmLabel={isArchiving ? 'Archiving...' : 'Archive'}
        confirmVariant='destructive'
        confirmDisabled={isArchiving}
        onCancel={onArchiveCancel}
        onConfirm={onArchiveConfirm}
      />
      {unsavedChangesDialog}
    </>
  )
}
