'use client'

import { useRouter } from 'next/navigation'

import { InvoiceSheet } from '@/app/(dashboard)/invoices/invoice-sheet'

import { parseDuplicateSourceId } from '../entities'
import { useSheetInit } from './use-sheet-init'
import type { SheetWrapperProps } from './types'

export function InvoiceSheetWrapper({
  value,
  open,
  onRequestClose,
}: SheetWrapperProps) {
  const router = useRouter()
  // A duplicate loads its source invoice and opens it as a new draft.
  const sourceId = parseDuplicateSourceId(value)
  const data = useSheetInit('invoice', sourceId ?? value)

  if (!data) {
    return null
  }

  return (
    <InvoiceSheet
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
      invoice={sourceId ? null : data.invoice}
      duplicateOf={sourceId ? data.invoice : null}
      clients={data.clients}
      productCatalog={data.productCatalog}
      taxRates={data.taxRates}
    />
  )
}
