'use client'

import { useRouter } from 'next/navigation'

import { HourBlockSheet } from '@/app/(dashboard)/hour-blocks/hour-block-sheet'

import { useSheetParams } from '../use-sheet-params'
import { useSheetInit } from './use-sheet-init'
import type { SheetWrapperProps } from './types'

export function HourBlockSheetWrapper({ value }: SheetWrapperProps) {
  const router = useRouter()
  const { close } = useSheetParams()
  const data = useSheetInit('hour-block', value)

  if (!data) {
    return null
  }

  return (
    <HourBlockSheet
      open
      onOpenChange={open => {
        if (!open) {
          close('hour-block')
        }
      }}
      onComplete={() => {
        router.refresh()
        close('hour-block')
      }}
      hourBlock={data.hourBlock}
      clients={data.clients}
    />
  )
}
