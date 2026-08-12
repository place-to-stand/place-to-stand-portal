'use client'

import { useRouter } from 'next/navigation'

import { ContactsSheet } from '@/app/(dashboard)/contacts/_components/contacts-sheet'

import { useSheetInit } from './use-sheet-init'
import type { SheetWrapperProps } from './types'

export function ContactSheetWrapper({ value, open, onRequestClose }: SheetWrapperProps) {
  const router = useRouter()
  const data = useSheetInit('contact', value)

  if (!data) {
    return null
  }

  return (
    <ContactsSheet
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
      contact={data.contact}
    />
  )
}
