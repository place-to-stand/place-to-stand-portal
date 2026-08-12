'use client'

import { useRouter } from 'next/navigation'

import { LeadSheet } from '@/app/(dashboard)/leads/_components/lead-sheet'

import { useSheetParams } from '../use-sheet-params'
import { useSheetInit } from './use-sheet-init'
import type { SheetWrapperProps } from './types'

export function LeadSheetWrapper({
  value,
  open,
  onRequestClose,
}: SheetWrapperProps) {
  const router = useRouter()
  const { getAux } = useSheetParams()
  const data = useSheetInit('lead', value)

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
      lead={data.lead}
      assignees={data.assignees}
      canManage
      senderName={data.senderName ?? undefined}
      initialAction={getAux('leadMode') === 'convert' ? 'convert' : null}
      onSuccess={() => router.refresh()}
    />
  )
}
