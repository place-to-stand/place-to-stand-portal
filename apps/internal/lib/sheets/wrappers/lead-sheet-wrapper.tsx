'use client'

import { useRouter } from 'next/navigation'

import { LeadSheet } from '@/app/(dashboard)/leads/_components/lead-sheet'

import { parseDuplicateSourceId } from '../entities'
import { useSheetInit } from './use-sheet-init'
import type { SheetWrapperProps } from './types'

export function LeadSheetWrapper({
  value,
  open,
  onRequestClose,
}: SheetWrapperProps) {
  const router = useRouter()
  // A duplicate loads its source lead and opens it as a new one.
  const sourceId = parseDuplicateSourceId(value)
  const data = useSheetInit('lead', sourceId ?? value)

  if (!data) {
    return null
  }

  return (
    <LeadSheet
      open={open}
      onOpenChange={next => {
        if (!next) {
          onRequestClose()
        }
      }}
      lead={sourceId ? null : data.lead}
      duplicateOf={sourceId ? data.lead : null}
      assignees={data.assignees}
      canManage
      senderName={data.senderName ?? undefined}
      onSuccess={() => router.refresh()}
    />
  )
}
