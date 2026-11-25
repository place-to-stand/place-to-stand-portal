'use client'

import { useRouter } from 'next/navigation'

import { FeedbackSheet } from '@/app/(dashboard)/feedback/_components/feedback-sheet'

import { useSheetInit } from './use-sheet-init'
import type { SheetWrapperProps } from './types'

export function FeedbackSheetWrapper({
  value,
  open,
  onRequestClose,
}: SheetWrapperProps) {
  const router = useRouter()
  const data = useSheetInit('feedback', value)

  if (!data) {
    return null
  }

  return (
    <FeedbackSheet
      // Derives `open` from the record, so clearing it closes the sheet.
      report={open ? data.report : null}
      onOpenChange={next => {
        if (!next) onRequestClose()
      }}
      onRowRemoved={() => {
        router.refresh()
        onRequestClose()
      }}
    />
  )
}
