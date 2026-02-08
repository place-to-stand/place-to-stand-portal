'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { InvoiceWithRelations } from '@/lib/invoices/types'

import { InvoiceStatusBadge } from './invoice-status-badge'

type InvoicesTableProps = {
  invoices: InvoiceWithRelations[]
  onSelect: (invoice: InvoiceWithRelations) => void
}

export function InvoicesTable({ invoices, onSelect }: InvoicesTableProps) {
  if (invoices.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center py-16 text-center'>
        <p className='text-muted-foreground text-sm'>No invoices yet.</p>
        <p className='text-muted-foreground text-xs mt-1'>
          Create your first invoice to get started.
        </p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className='w-[120px]'>#</TableHead>
          <TableHead>Client</TableHead>
          <TableHead className='w-[120px]'>Status</TableHead>
          <TableHead className='w-[120px] text-right'>Total</TableHead>
          <TableHead className='w-[120px]'>Due Date</TableHead>
          <TableHead className='w-[120px]'>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map(invoice => (
          <TableRow
            key={invoice.id}
            className='cursor-pointer'
            onClick={() => onSelect(invoice)}
          >
            <TableCell className='font-mono text-sm'>
              {invoice.invoiceNumber ?? 'Draft'}
            </TableCell>
            <TableCell>{invoice.client.name}</TableCell>
            <TableCell>
              <InvoiceStatusBadge status={invoice.status} dueDate={invoice.dueDate} />
            </TableCell>
            <TableCell className='text-right tabular-nums font-medium'>
              ${Number(invoice.total).toFixed(2)}
            </TableCell>
            <TableCell className='text-sm text-muted-foreground'>
              {invoice.dueDate
                ? new Date(invoice.dueDate).toLocaleDateString()
                : '—'}
            </TableCell>
            <TableCell className='text-sm text-muted-foreground'>
              {new Date(invoice.createdAt).toLocaleDateString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
