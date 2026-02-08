'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'

import { AppShellHeader } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import type { InvoiceWithRelations } from '@/lib/invoices/types'
import type { BillingSettings } from '@/lib/queries/billing-settings'

import { InvoicesTabsNav } from './invoices-tabs-nav'
import { InvoicesTable } from './invoices-table'
import { CreateInvoiceSheet } from './create-invoice-sheet'
import { InvoiceDetailSheet } from './invoice-detail-sheet'

type ClientOption = {
  id: string
  name: string
  billingType: string
}

type InvoicesContentProps = {
  invoices: InvoiceWithRelations[]
  clients: ClientOption[]
  billingSettings: BillingSettings | null
}

export function InvoicesContent({
  invoices,
  clients,
  billingSettings,
}: InvoicesContentProps) {
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithRelations | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const handleSelect = (invoice: InvoiceWithRelations) => {
    setSelectedInvoice(invoice)
    setDetailOpen(true)
  }

  const handleDetailClose = (open: boolean) => {
    if (!open) {
      setDetailOpen(false)
      setSelectedInvoice(null)
    }
  }

  return (
    <>
      <AppShellHeader>
        <div className='flex flex-col'>
          <h1 className='text-2xl font-semibold tracking-tight'>Invoices</h1>
          <p className='text-muted-foreground text-sm'>
            Create, send, and track invoices for your clients.
          </p>
        </div>
      </AppShellHeader>
      <div className='space-y-4'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <InvoicesTabsNav activeTab='invoices' className='flex-1 sm:flex-none' />
          <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6'>
            <span className='text-muted-foreground text-sm whitespace-nowrap'>
              Total invoices: {invoices.length}
            </span>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className='mr-1.5 h-4 w-4' />
              New Invoice
            </Button>
          </div>
        </div>

        <section className='bg-background rounded-xl border shadow-sm'>
          <InvoicesTable invoices={invoices} onSelect={handleSelect} />
        </section>
      </div>

      <CreateInvoiceSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        clients={clients}
        defaultHourlyRate={billingSettings?.hourlyRate ?? '200.00'}
      />
      <InvoiceDetailSheet
        invoice={selectedInvoice}
        open={detailOpen}
        onOpenChange={handleDetailClose}
      />
    </>
  )
}
