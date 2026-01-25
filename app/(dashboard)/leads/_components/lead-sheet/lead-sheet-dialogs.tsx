'use client'

import type { ReactNode } from 'react'

import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import type { LeadRecord } from '@/lib/leads/types'

import { ConvertLeadDialog } from '../convert-lead-dialog'
import { CreateProposalDialog } from '../create-proposal-dialog'
import { ProposalBuilderSheet } from '../proposal-builder/proposal-builder-sheet'
import { ScheduleMeetingDialog } from '../schedule-meeting-dialog'
import { SendEmailDialog } from '../send-email-dialog'

type LeadSheetDialogsProps = {
  lead: LeadRecord | null
  senderName: string
  // Archive dialog
  isArchiveDialogOpen: boolean
  isArchiving: boolean
  onArchiveCancel: () => void
  onArchiveConfirm: () => void
  // Convert dialog
  isConvertDialogOpen: boolean
  onConvertOpenChange: (open: boolean) => void
  // Email dialog
  isEmailDialogOpen: boolean
  onEmailOpenChange: (open: boolean) => void
  // Meeting dialog (AI-triggered)
  isMeetingDialogOpen: boolean
  meetingInitialTitle?: string
  onMeetingOpenChange: (open: boolean) => void
  onMeetingSuccess: () => void
  // Build proposal dialog (from scratch)
  isBuildProposalDialogOpen: boolean
  onBuildProposalOpenChange: (open: boolean) => void
  // Copy template dialog (from Google Docs template)
  isCopyTemplateDialogOpen: boolean
  onCopyTemplateOpenChange: (open: boolean) => void
  onProposalSuccess: () => void
  // General success callback
  onSuccess: () => void
  // Unsaved changes dialog
  unsavedChangesDialog: ReactNode
}

export function LeadSheetDialogs({
  lead,
  senderName,
  isArchiveDialogOpen,
  isArchiving,
  onArchiveCancel,
  onArchiveConfirm,
  isConvertDialogOpen,
  onConvertOpenChange,
  isEmailDialogOpen,
  onEmailOpenChange,
  isMeetingDialogOpen,
  meetingInitialTitle,
  onMeetingOpenChange,
  onMeetingSuccess,
  isBuildProposalDialogOpen,
  onBuildProposalOpenChange,
  isCopyTemplateDialogOpen,
  onCopyTemplateOpenChange,
  onProposalSuccess,
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
      {lead && lead.contactEmail && senderName && (
        <SendEmailDialog
          lead={lead}
          senderName={senderName}
          open={isEmailDialogOpen}
          onOpenChange={onEmailOpenChange}
          onSuccess={onSuccess}
        />
      )}
      {lead && (
        <ScheduleMeetingDialog
          lead={lead}
          open={isMeetingDialogOpen}
          onOpenChange={onMeetingOpenChange}
          initialTitle={meetingInitialTitle}
          onSuccess={onMeetingSuccess}
        />
      )}
      {lead && (
        <ProposalBuilderSheet
          lead={lead}
          open={isBuildProposalDialogOpen}
          onOpenChange={onBuildProposalOpenChange}
          onSuccess={onProposalSuccess}
        />
      )}
      {lead && (
        <CreateProposalDialog
          lead={lead}
          open={isCopyTemplateDialogOpen}
          onOpenChange={onCopyTemplateOpenChange}
          onSuccess={onProposalSuccess}
        />
      )}
      {unsavedChangesDialog}
    </>
  )
}
