'use client'

import { useRouter } from 'next/navigation'

import { HourBlockSheet } from '@/app/(dashboard)/hour-blocks/hour-block-sheet'

import { parseDuplicateSourceId } from '../entities'
import { useSheetInit } from './use-sheet-init'
import type { SheetWrapperProps } from './types'

export function HourBlockSheetWrapper({
  value,
  open,
  onRequestClose,
}: SheetWrapperProps) {
  const router = useRouter()
  // A duplicate loads its source block and opens it as a new one.
  const sourceId = parseDuplicateSourceId(value)
  const data = useSheetInit('hour-block', sourceId ?? value)

  if (!data) {
    return null
  }

  return (
    <HourBlockSheet
      open={open}
      onOpenChange={next => {
        if (!next) {
          onRequestClose()
        }
      }}
      onComplete={() => {
        router.refresh()
        onRequestClose()
      }}
      hourBlock={sourceId ? null : data.hourBlock}
      duplicateOf={sourceId ? data.hourBlock : null}
      clients={data.clients}
    />
  )
}
