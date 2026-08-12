'use client'

import { useRouter } from 'next/navigation'

import { InvoiceSheet } from '@/app/(dashboard)/invoices/invoice-sheet'

import { useSheetInit } from './use-sheet-init'
import type { SheetWrapperProps } from './types'

export function InvoiceSheetWrapper({ value, open, onRequestClose }: SheetWrapperProps) {
  const router = useRouter()
  const data = useSheetInit('invoice', value)

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
      invoice={data.invoice}
      clients={data.clients}
      productCatalog={data.productCatalog}
      taxRates={data.taxRates}
    />
  )
}
