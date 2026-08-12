'use client'

import { useRouter } from 'next/navigation'

import { ClientSheet } from '@/app/(dashboard)/clients/_components/clients-sheet'

import { NEW_SHEET_VALUE } from '../entities'
import { useSheetInit } from './use-sheet-init'
import type { SheetWrapperProps } from './types'

export function ClientSheetWrapper({ value, open, onRequestClose }: SheetWrapperProps) {
  const router = useRouter()
  const data = useSheetInit('client', value)

  if (!data) {
    return null
  }

  return (
    <ClientSheet
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
      client={value === NEW_SHEET_VALUE ? null : data.client}
    />
  )
}
