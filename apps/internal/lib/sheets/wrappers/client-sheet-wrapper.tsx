'use client'

import { useRouter } from 'next/navigation'

import { ClientSheet } from '@/app/(dashboard)/clients/_components/clients-sheet'
import { CompanySheet } from '@/app/(dashboard)/companies/_components/company-sheet'

import { emitSheetCreated } from '../created'
import { NEW_SHEET_VALUE } from '../entities'
import { useSheetParams } from '../use-sheet-params'
import { useSheetInit } from './use-sheet-init'
import type { SheetWrapperProps } from './types'

/**
 * `?client=new` is Make client. `?client=<id>` (old links, client rows) opens
 * the client's company: a client is its company's billing record, edited on
 * the company sheet.
 */
export function ClientSheetWrapper({ value, open, onRequestClose }: SheetWrapperProps) {
  const router = useRouter()
  const { getAux } = useSheetParams()
  const data = useSheetInit('client', value)
  const isCreating = value === NEW_SHEET_VALUE
  // Create-from-picker: the host picker passes the typed name along.
  const initialName = isCreating ? (getAux('clientName') ?? undefined) : undefined

  if (!data) {
    return null
  }

  if (!isCreating && data.client) {
    return (
      <CompanySheet
        key={data.client.company_id ?? data.client.id}
        companyId={data.client.company_id ?? null}
        open={open}
        onClose={onRequestClose}
      />
    )
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
      client={null}
      initialName={initialName}
      onCreated={record => emitSheetCreated('client', record)}
    />
  )
}
