'use client'

import { useRouter } from 'next/navigation'

import { ContactsSheet } from '@/app/(dashboard)/contacts/_components/contacts-sheet'

import { useSheetParams } from '../use-sheet-params'
import { useSheetInit } from './use-sheet-init'
import type { SheetWrapperProps } from './types'

export function ContactSheetWrapper({ value }: SheetWrapperProps) {
  const router = useRouter()
  const { close } = useSheetParams()
  const data = useSheetInit('contact', value)

  if (!data) {
    return null
  }

  return (
    <ContactsSheet
      open
      onOpenChange={open => {
        if (!open) {
          close('contact')
        }
      }}
      onComplete={() => {
        router.refresh()
        close('contact')
      }}
      contact={data.contact}
    />
  )
}
