'use client'

import { useRouter } from 'next/navigation'

import { SubmissionDetailSheet } from '@/app/(dashboard)/submissions/_components/submission-detail-sheet'

import { useSheetParams } from '../use-sheet-params'
import { useSheetInit } from './use-sheet-init'
import type { SheetWrapperProps } from './types'

export function SubmissionSheetWrapper({ value }: SheetWrapperProps) {
  const router = useRouter()
  const { close } = useSheetParams()
  const data = useSheetInit('submission', value)

  if (!data) {
    return null
  }

  return (
    <SubmissionDetailSheet
      submission={data.submission}
      mode={data.submission.deletedAt ? 'archive' : 'active'}
      onOpenChange={open => {
        if (!open) {
          close('submission')
        }
      }}
      onRowRemoved={() => {
        router.refresh()
        close('submission')
      }}
    />
  )
}
