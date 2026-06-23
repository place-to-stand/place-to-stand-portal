'use client'

import type { ReactNode } from 'react'

import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import type { LeadRecord } from '@/lib/leads/types'

import { ConvertLeadDialog } from '../convert-lead-dialog'

type LeadSheetDialogsProps = {
  lead: LeadRecord | null
  // Archive dialog
  isArchiveDialogOpen: boolean
  isArchiving: boolean
  onArchiveCancel: () => void
  onArchiveConfirm: () => void
  // Convert dialog
  isConvertDialogOpen: boolean
  onConvertOpenChange: (open: boolean) => void
  // General success callback
  onSuccess: () => void
  // Unsaved changes dialog
  unsavedChangesDialog: ReactNode
}

export function LeadSheetDialogs({
  lead,
  isArchiveDialogOpen,
  isArchiving,
  onArchiveCancel,
  onArchiveConfirm,
  isConvertDialogOpen,
  onConvertOpenChange,
  onSuccess,
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
      {lead && (
        <ConvertLeadDialog
          lead={lead}
          open={isConvertDialogOpen}
          onOpenChange={onConvertOpenChange}
          onSuccess={onSuccess}
        />
      )}
      {unsavedChangesDialog}
    </>
  )
}
