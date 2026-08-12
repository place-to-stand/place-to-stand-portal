'use client'

import { useRouter } from 'next/navigation'

import { HourBlockSheet } from '@/app/(dashboard)/hour-blocks/hour-block-sheet'

import { useSheetInit } from './use-sheet-init'
import type { SheetWrapperProps } from './types'

export function HourBlockSheetWrapper({ value, open, onRequestClose }: SheetWrapperProps) {
  const router = useRouter()
  const data = useSheetInit('hour-block', value)

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
      hourBlock={data.hourBlock}
      clients={data.clients}
    />
  )
}
