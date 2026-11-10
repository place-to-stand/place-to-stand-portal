'use client'

import { useMemo } from 'react'

import {
  useSheetHistoryState,
  type SheetHistorySources,
} from '@/lib/hooks/use-sheet-form-controls'
import type {
  ClientBillingHistoryState,
  UseClientBillingFormReturn,
} from '@/lib/companies/billing/use-client-sheet-state'
import type { BillingEffectiveValue } from '@/lib/companies/sheet-save-schema'

type BillingUndoState = ClientBillingHistoryState & {
  billingOn: boolean
  effective: BillingEffectiveValue
}

/**
 * Puts the company sheet's billing (Bill this company, when, the slug and
 * other fields, origination and closers) on the sheet's undo stack. It
 * joins as soon as the billing form shows: origination is kept by id, so
 * the people loading later never changes it, and an edit made while they
 * load is a step like any other.
 */
export function useBillingUndo(
  history: SheetHistorySources,
  state: UseClientBillingFormReturn,
  [billingOn, setBillingOn]: [boolean, (on: boolean) => void],
  [effective, setEffective]: [
    BillingEffectiveValue,
    (effective: BillingEffectiveValue) => void,
  ]
) {
  const { historyState, restoreHistoryState } = state
  const undoState = useMemo<BillingUndoState>(
    () => ({ billingOn, effective, ...historyState }),
    [billingOn, effective, historyState]
  )
  useSheetHistoryState(history, 'companyBilling', {
    state: undoState,
    restore: saved => {
      setBillingOn(saved.billingOn)
      setEffective(saved.effective)
      restoreHistoryState(saved)
    },
  })
}
