'use client'

import { CompanySheet } from '@/app/(dashboard)/companies/_components/company-sheet'

import { emitSheetCreated } from '../created'
import { NEW_SHEET_VALUE } from '../entities'
import { useSheetParams } from '../use-sheet-params'
import type { SheetWrapperProps } from './types'

/** The company sheet loads its own record, so no init payload is needed. */
export function CompanySheetWrapper({
  value,
  open,
  onRequestClose,
}: SheetWrapperProps) {
  const { getAux } = useSheetParams()
  const isNew = value === NEW_SHEET_VALUE

  return (
    <CompanySheet
      key={value}
      companyId={isNew ? null : value}
      open={open}
      onClose={onRequestClose}
      // Create-from-picker: the host picker passes the typed name along and
      // selects the saved company.
      initialName={isNew ? (getAux('companyName') ?? undefined) : undefined}
      onCreated={record => emitSheetCreated('company', record)}
    />
  )
}
