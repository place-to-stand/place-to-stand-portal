'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { InvoiceSheet } from '../invoice-sheet'
import type { ClientRow, ProductCatalogItemRow } from '@/lib/invoices/invoice-form'
import { cn } from '@/lib/utils'

type InvoicesAddButtonProps = {
  clients: ClientRow[]
  productCatalog: ProductCatalogItemRow[]
  className?: string
}

export function InvoicesAddButton({
  clients,
  productCatalog,
  className,
}: InvoicesAddButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const handleComplete = () => {
    setOpen(false)
    router.refresh()
  }

  const sortedClients = [...clients].sort((a, b) =>
    a.name.localeCompare(b.name)
  )

  const createDisabled = sortedClients.length === 0
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
          onClick={() => setOpen(true)}
          disabled={createDisabled}
          className='gap-2'
        >
          <Plus className='h-4 w-4' />
          Add invoice
        </Button>
      </DisabledFieldTooltip>
      <InvoiceSheet
        open={open}
        onOpenChange={setOpen}
        onComplete={handleComplete}
        invoice={null}
        clients={sortedClients}
        productCatalog={productCatalog}
      />
    </div>
  )
}
