'use client'

import { CompanySheet } from '@/app/(dashboard)/companies/_components/company-sheet'

import { NEW_SHEET_VALUE } from '../entities'
import { useSheetInit } from './use-sheet-init'
import type { SheetWrapperProps } from './types'

/**
 * Old `?client=<id>` links: a client is a company you bill, so this opens
 * the company. (Making a client happens on the company's Billing tab.)
 */
export function ClientSheetWrapper({
  value,
  open,
  onRequestClose,
}: SheetWrapperProps) {
  const data = useSheetInit('client', value === NEW_SHEET_VALUE ? '' : value)

  if (value === NEW_SHEET_VALUE || !data?.client) {
    return null
  }

  return (
    <CompanySheet
      key={data.client.company_id ?? data.client.id}
      companyId={data.client.company_id ?? null}
      open={open}
      onClose={onRequestClose}
    />
  )
}
