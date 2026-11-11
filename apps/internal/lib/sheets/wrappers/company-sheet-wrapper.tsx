'use client'

import { CompanySheet } from '@/app/(dashboard)/companies/_components/company-sheet'

import { emitSheetCreated } from '../created'
import { NEW_SHEET_VALUE } from '../entities'
import { useCreatePrefill, useOpenedStackId } from './use-create-prefill'
import type { SheetWrapperProps } from './types'

/** The company sheet loads its own record, so no init payload is needed. */
export function CompanySheetWrapper({
  value,
  open,
  aux,
  onRequestClose,
}: SheetWrapperProps) {
  const isNew = value === NEW_SHEET_VALUE
  const prefill = useCreatePrefill(value, aux, ['companyName'] as const)
  const openedId = useOpenedStackId()

  return (
    <CompanySheet
      key={value}
      companyId={isNew ? null : value}
      open={open}
      onClose={onRequestClose}
      // Create-from-picker: the host picker passes the typed name along and
      // selects the saved company.
      initialName={prefill.companyName}
      onCreated={record => emitSheetCreated('company', record, openedId)}
    />
  )
}
