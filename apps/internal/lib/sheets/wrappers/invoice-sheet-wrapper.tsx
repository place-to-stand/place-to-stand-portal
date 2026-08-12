'use client'

import { useRouter } from 'next/navigation'

import { InvoiceSheet } from '@/app/(dashboard)/invoices/invoice-sheet'

import { useSheetParams } from '../use-sheet-params'
import { useSheetInit } from './use-sheet-init'
import type { SheetWrapperProps } from './types'

export function InvoiceSheetWrapper({ value }: SheetWrapperProps) {
  const router = useRouter()
  const { close } = useSheetParams()
  const data = useSheetInit('invoice', value)

  if (!data) {
    return null
  }

  return (
    <InvoiceSheet
      open
      onOpenChange={open => {
        if (!open) {
          close('invoice')
        }
      }}
      onComplete={() => {
        router.refresh()
        close('invoice')
      }}
      invoice={data.invoice}
      clients={data.clients}
      productCatalog={data.productCatalog}
      taxRates={data.taxRates}
    />
  )
}
