'use client'

import { useCallback, useState } from 'react'
import { FileText } from 'lucide-react'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'
import type { LeadRecord } from '@/lib/leads/types'

import { ProposalBuilder } from './proposal-builder'

type ProposalBuilderSheetProps = {
  lead: LeadRecord
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function ProposalBuilderSheet({
  lead,
  open,
  onOpenChange,
  onSuccess,
}: ProposalBuilderSheetProps) {
  const [formKey, setFormKey] = useState(0)
  const [isDirty, setIsDirty] = useState(false)

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        // Reset form when opening
        setFormKey(k => k + 1)
        setIsDirty(false)
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange]
  )

  const {
    requestConfirmation,
    dialog: unsavedChangesDialog,
  } = useUnsavedChangesWarning({
    isDirty,
    title: 'Discard proposal changes?',
    description:
      'You have unsaved changes to this proposal. Are you sure you want to close?',
    confirmLabel: 'Discard',
    cancelLabel: 'Keep editing',
  })

  const handleClose = useCallback(() => {
    requestConfirmation(() => {
      onOpenChange(false)
    })
  }, [requestConfirmation, onOpenChange])

  const handleSuccess = useCallback(() => {
    setIsDirty(false)
    onOpenChange(false)
    onSuccess?.()
  }, [onOpenChange, onSuccess])

  return (
    <>
      <Sheet open={open} onOpenChange={nextOpen => {
        if (!nextOpen) {
          handleClose()
        } else {
          handleOpenChange(true)
        }
      }}>
        <SheetContent
          side="right"
          size="full"
          className="flex h-full w-full flex-col gap-0 overflow-hidden p-0"
        >
          {/* Header */}
          <div className="flex-shrink-0 border-b px-6 pt-4 pb-3">
            <SheetHeader className="bg-transparent p-0">
              <SheetTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Build Proposal
              </SheetTitle>
              <SheetDescription>
                Create a proposal for {lead.contactName}
                {lead.companyName && ` at ${lead.companyName}`}
              </SheetDescription>
            </SheetHeader>
          </div>

          {/* Main content - 3 column layout */}
          <ProposalBuilder
            key={formKey}
            lead={lead}
            onDirtyChange={setIsDirty}
            onClose={() => handleClose()}
            onSuccess={handleSuccess}
          />
        </SheetContent>
      </Sheet>
      {unsavedChangesDialog}
    </>
  )
}
