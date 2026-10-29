'use client'

import { CompanySheet } from '@/app/(dashboard)/companies/_components/company-sheet'

import { NEW_SHEET_VALUE } from '../entities'
import type { SheetWrapperProps } from './types'

/** The company sheet loads its own record, so no init payload is needed. */
export function CompanySheetWrapper({
  value,
  open,
  onRequestClose,
}: SheetWrapperProps) {
  return (
    <CompanySheet
      key={value}
      companyId={value === NEW_SHEET_VALUE ? null : value}
      open={open}
      onClose={onRequestClose}
    />
  )
}
