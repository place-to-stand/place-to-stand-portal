'use client'

import { useRouter } from 'next/navigation'

import { ClientSheet } from '@/app/(dashboard)/clients/_components/clients-sheet'

import { NEW_SHEET_VALUE } from '../entities'
import { useSheetParams } from '../use-sheet-params'
import { useSheetInit } from './use-sheet-init'
import type { SheetWrapperProps } from './types'

export function ClientSheetWrapper({ value }: SheetWrapperProps) {
  const router = useRouter()
  const { close } = useSheetParams()
  const data = useSheetInit('client', value)

  if (!data) {
    return null
  }

  return (
    <ClientSheet
      open
      onOpenChange={open => {
        if (!open) {
          close('client')
        }
      }}
      onComplete={() => {
        router.refresh()
        close('client')
      }}
      client={value === NEW_SHEET_VALUE ? null : data.client}
    />
  )
}
