'use client'

import { SheetCreateButton } from '@/components/sheets/sheet-create-button'
import { INVOICE_MISSING_CLIENT_REASON } from '@/lib/invoices/invoice-ui-state'

type InvoicesAddButtonProps = {
  /** Whether any company is or was a client. */
  hasClients: boolean
  className?: string
}

/** "Create invoice" needs a client to attach to, so it waits for the first one. */
export function InvoicesAddButton({
  hasClients,
  className,
}: InvoicesAddButtonProps) {
  return (
    <SheetCreateButton
      entity='invoice'
      label='Create invoice'
      className={className}
      disabledReason={
        !hasClients ? INVOICE_MISSING_CLIENT_REASON : null
      }
    />
  )
}
