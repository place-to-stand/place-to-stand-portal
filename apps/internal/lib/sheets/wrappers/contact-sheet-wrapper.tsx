'use client'

import { useRouter } from 'next/navigation'

import { ContactsSheet } from '@/app/(dashboard)/people/_components/contacts-sheet'

import { emitSheetCreated } from '../created'
import { useCreatePrefill, useOpenedStackId } from './use-create-prefill'
import { useSheetInit } from './use-sheet-init'
import type { SheetWrapperProps } from './types'

export function ContactSheetWrapper({
  value,
  open,
  aux,
  onRequestClose,
}: SheetWrapperProps) {
  const router = useRouter()
  const data = useSheetInit('contact', value)
  // Create-from-picker: the host picker passes the typed name along.
  const prefill = useCreatePrefill(value, aux, [
    'contactName',
    'contactCompanyId',
  ] as const)
  const openedId = useOpenedStackId()

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
      initialName={prefill.contactName}
      initialCompanyId={prefill.contactCompanyId}
      onCreated={record => emitSheetCreated('contact', record, openedId)}
    />
  )
}
