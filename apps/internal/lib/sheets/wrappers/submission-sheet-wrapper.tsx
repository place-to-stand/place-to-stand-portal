'use client'

import { useRouter } from 'next/navigation'

import { SubmissionDetailSheet } from '@/app/(dashboard)/submissions/_components/submission-detail-sheet'

import { useSheetInit } from './use-sheet-init'
import type { SheetWrapperProps } from './types'

export function SubmissionSheetWrapper({
  value,
  open,
  onRequestClose,
}: SheetWrapperProps) {
  const router = useRouter()
  const data = useSheetInit('submission', value)

  if (!data) {
    return null
  }

  return (
    <SubmissionDetailSheet
      // This sheet derives `open` from the record, so clearing it is how the
      // host closes it — the wrapper stays mounted for the exit transition.
      submission={open ? data.submission : null}
      mode={data.submission.deletedAt ? 'archive' : 'active'}
      onOpenChange={next => {
        if (!next) {
          onRequestClose()
        }
      }}
      onRowRemoved={() => {
        router.refresh()
        onRequestClose()
      }}
    />
  )
}
