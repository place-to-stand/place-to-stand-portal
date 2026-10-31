'use client'

import type { ReactNode } from 'react'

import { ArchiveConfirmDialog } from '@/components/sheets/archive-confirm-dialog'

type LeadSheetDialogsProps = {
  // Archive dialog
  isArchiveDialogOpen: boolean
  /** The lead's name (its contact's), for the confirmation. */
  leadName?: string | null
  isArchiving: boolean
  onArchiveCancel: () => void
  onArchiveConfirm: () => void
  // Unsaved changes dialog
  unsavedChangesDialog: ReactNode
}

export function LeadSheetDialogs({
  isArchiveDialogOpen,
  leadName,
  isArchiving,
  onArchiveCancel,
  onArchiveConfirm,
  unsavedChangesDialog,
}: LeadSheetDialogsProps) {
  return (
    <>
      <ArchiveConfirmDialog
        open={isArchiveDialogOpen}
        entity='lead'
        name={leadName || 'this lead'}
        list='the board'
        pending={isArchiving}
        onCancel={onArchiveCancel}
        onConfirm={onArchiveConfirm}
      />
      {unsavedChangesDialog}
    </>
  )
}
