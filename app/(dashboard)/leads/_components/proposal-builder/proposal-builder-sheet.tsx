'use client'

import { useCallback, useEffect, useState } from 'react'
import { FileText } from 'lucide-react'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'
import { Skeleton } from '@/components/ui/skeleton'
import type { LeadRecord } from '@/lib/leads/types'

import { ProposalBuilder } from './proposal-builder'

const ANIMATION_SETTLE_MS = 350

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
  const [contentReady, setContentReady] = useState(false)

  // Defer heavy content until slide animation settles
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => setContentReady(true), ANIMATION_SETTLE_MS)
      return () => clearTimeout(timer)
    }
    setContentReady(false)
  }, [open])

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
          showOverlay={false}
          className="flex h-full w-full flex-col gap-0 overflow-hidden p-0 data-[state=open]:duration-300 data-[state=closed]:duration-200"
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
          {contentReady ? (
            <ProposalBuilder
              key={formKey}
              lead={lead}
              onDirtyChange={setIsDirty}
              onClose={() => handleClose()}
              onSuccess={handleSuccess}
            />
          ) : (
            <ProposalBuilderSkeleton />
          )}
        </SheetContent>
      </Sheet>
      {unsavedChangesDialog}
    </>
  )
}

function ProposalBuilderSkeleton() {
  return (
    <div className="flex min-h-0 flex-1">
      {/* Context panel */}
      <div className="hidden w-80 flex-shrink-0 border-r p-6 lg:block">
        <Skeleton className="mb-4 h-5 w-24" />
        <Skeleton className="mb-2 h-4 w-full" />
        <Skeleton className="mb-2 h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      {/* Editor panel */}
      <div className="flex flex-1 flex-col gap-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="mt-4 h-32 w-full" />
        <Skeleton className="mt-4 h-24 w-full" />
      </div>
      {/* Preview panel */}
      <div className="hidden w-96 flex-shrink-0 border-l p-6 xl:block">
        <Skeleton className="mb-6 h-6 w-32" />
        <Skeleton className="mb-2 h-3 w-full" />
        <Skeleton className="mb-2 h-3 w-full" />
        <Skeleton className="mb-2 h-3 w-4/5" />
        <Skeleton className="mt-6 h-20 w-full" />
      </div>
    </div>
  )
}
