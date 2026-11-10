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
 * joins once its people have loaded: until then it is loading, not edited.
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
  const { historyState, restoreHistoryState, isReady } = state
  const undoState = useMemo<BillingUndoState>(
    () => ({ billingOn, effective, ...historyState }),
    [billingOn, effective, historyState]
  )
  useSheetHistoryState(history, 'companyBilling', {
    state: undoState,
    ready: isReady,
    restore: saved => {
      setBillingOn(saved.billingOn)
      setEffective(saved.effective)
      restoreHistoryState(saved)
    },
  })
}
