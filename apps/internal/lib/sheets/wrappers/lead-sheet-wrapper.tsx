'use client'

import { useRouter } from 'next/navigation'

import { LeadSheet } from '@/app/(dashboard)/leads/_components/lead-sheet'

import { useSheetParams } from '../use-sheet-params'
import { useSheetInit } from './use-sheet-init'
import type { SheetWrapperProps } from './types'

export function LeadSheetWrapper({ value }: SheetWrapperProps) {
  const router = useRouter()
  const { close, getAux } = useSheetParams()
  const data = useSheetInit('lead', value)

  if (!data) {
    return null
  }

  return (
    <LeadSheet
      open
      onOpenChange={open => {
        if (!open) {
          close('lead')
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
