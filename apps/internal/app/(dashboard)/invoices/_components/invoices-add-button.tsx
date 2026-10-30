'use client'

import { SheetCreateButton } from '@/components/sheets/sheet-create-button'
import { INVOICE_MISSING_CLIENT_REASON } from '@/lib/invoices/invoice-ui-state'
import type { InvoiceClient } from '@/lib/invoices/invoice-form'

type InvoicesAddButtonProps = {
  clients: InvoiceClient[]
  className?: string
}

/** "Create invoice" needs a client to attach to, so it waits for the first one. */
export function InvoicesAddButton({
  clients,
  className,
}: InvoicesAddButtonProps) {
  return (
    <SheetCreateButton
      entity='invoice'
      label='Create invoice'
      className={className}
      disabledReason={
        clients.length === 0 ? INVOICE_MISSING_CLIENT_REASON : null
      }
    />
  )
}
