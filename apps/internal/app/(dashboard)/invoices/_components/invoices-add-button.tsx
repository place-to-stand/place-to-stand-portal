'use client'

import { Plus } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { useSheetParamSelection } from '@/lib/sheets/use-sheet-params'
import type { ClientRow } from '@/lib/invoices/invoice-form'
import { cn } from '@/lib/utils'

type InvoicesAddButtonProps = {
  clients: ClientRow[]
  className?: string
}

/**
 * Create is `?invoice=new` — the URL is the shared state, so the host page's
 * single sheet instance (or the global SheetHost elsewhere) renders it and
 * this button owns no sheet of its own.
 */
export function InvoicesAddButton({
  clients,
  className,
}: InvoicesAddButtonProps) {
  const { openCreate } = useSheetParamSelection('invoice')

  const createDisabled = clients.length === 0
  const createDisabledReason = createDisabled
    ? 'Add a client before creating an invoice.'
    : null

  return (
    <div className={cn(className)}>
      <DisabledFieldTooltip
        disabled={createDisabled}
        reason={createDisabledReason}
      >
        <Button
          size='sm'
          type='button'
          onClick={openCreate}
          disabled={createDisabled}
          className='gap-2'
        >
          <Plus className='h-4 w-4' />
          Add invoice
        </Button>
      </DisabledFieldTooltip>
    </div>
  )
}
