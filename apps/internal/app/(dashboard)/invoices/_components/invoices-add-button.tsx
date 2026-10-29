'use client'

import { SheetCreateButton } from '@/components/sheets/sheet-create-button'
import type { ClientRow } from '@/lib/invoices/invoice-form'

type InvoicesAddButtonProps = {
  clients: ClientRow[]
  className?: string
}

/** "Add invoice" needs a client to attach to, so it waits for the first one. */
export function InvoicesAddButton({
  clients,
  className,
}: InvoicesAddButtonProps) {
  return (
    <SheetCreateButton
      entity='invoice'
      label='Add invoice'
      className={className}
      disabledReason={
        clients.length === 0 ? 'Add a client before creating an invoice.' : null
      }
    />
  )
}
