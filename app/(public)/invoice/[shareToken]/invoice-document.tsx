import { Separator } from '@/components/ui/separator'
import type { InvoiceWithRelations } from '@/lib/invoices/types'
import type { BillingSettings } from '@/lib/queries/billing-settings'
import { INVOICE_STATUS_LABELS } from '@/lib/invoices/constants'

type InvoiceDocumentProps = {
  invoice: InvoiceWithRelations
  billingSettings: BillingSettings | null
}

export function InvoiceDocument({ invoice, billingSettings }: InvoiceDocumentProps) {
  return (
    <div className='rounded-xl border bg-background p-8 shadow-sm'>
      {/* Header */}
      <div className='flex flex-col gap-6 sm:flex-row sm:justify-between'>
        <div>
          {billingSettings?.companyName && (
            <h2 className='text-xl font-bold'>{billingSettings.companyName}</h2>
          )}
          {billingSettings?.companyAddress && (
            <p className='text-sm text-muted-foreground whitespace-pre-line mt-1'>
              {billingSettings.companyAddress}
            </p>
          )}
          {billingSettings?.companyPhone && (
            <p className='text-sm text-muted-foreground'>{billingSettings.companyPhone}</p>
          )}
          {billingSettings?.companyEmail && (
            <p className='text-sm text-muted-foreground'>{billingSettings.companyEmail}</p>
          )}
        </div>
        <div className='text-right'>
          <h1 className='text-2xl font-bold tracking-tight'>INVOICE</h1>
          {invoice.invoiceNumber && (
            <p className='font-mono text-sm text-muted-foreground mt-1'>
              {invoice.invoiceNumber}
            </p>
          )}
          <p className='text-xs text-muted-foreground mt-1'>
            Status: {INVOICE_STATUS_LABELS[invoice.status]}
          </p>
        </div>
      </div>

      <Separator className='my-6' />

      {/* Bill To + Dates */}
      <div className='flex flex-col gap-6 sm:flex-row sm:justify-between'>
        <div>
          <p className='text-xs font-medium uppercase text-muted-foreground'>Bill To</p>
          <p className='text-sm font-semibold mt-1'>{invoice.client.name}</p>
        </div>
        <div className='space-y-1 text-sm text-right'>
          {invoice.issuedAt && (
            <p>
              <span className='text-muted-foreground'>Issued: </span>
              {new Date(invoice.issuedAt).toLocaleDateString()}
            </p>
          )}
          {invoice.dueDate && (
            <p>
              <span className='text-muted-foreground'>Due: </span>
              {new Date(invoice.dueDate).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      <Separator className='my-6' />

      {/* Line Items */}
      <table className='w-full text-sm'>
        <thead>
          <tr className='border-b text-left text-xs uppercase text-muted-foreground'>
            <th className='pb-2 font-medium'>Description</th>
            <th className='pb-2 font-medium text-right w-20'>Qty</th>
            <th className='pb-2 font-medium text-right w-28'>Unit Price</th>
            <th className='pb-2 font-medium text-right w-28'>Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lineItems.map(item => (
            <tr key={item.id} className='border-b last:border-0'>
              <td className='py-3'>{item.description}</td>
              <td className='py-3 text-right tabular-nums'>{item.quantity}</td>
              <td className='py-3 text-right tabular-nums'>
                ${Number(item.unitPrice).toFixed(2)}
              </td>
              <td className='py-3 text-right tabular-nums font-medium'>
                ${Number(item.amount).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Separator className='my-4' />

      {/* Totals */}
      <div className='flex justify-end'>
        <div className='w-64 space-y-2 text-sm'>
          <div className='flex justify-between'>
            <span className='text-muted-foreground'>Subtotal</span>
            <span className='tabular-nums'>${Number(invoice.subtotal).toFixed(2)}</span>
          </div>
          {Number(invoice.taxAmount) > 0 && (
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>
                Tax ({(Number(invoice.taxRate) * 100).toFixed(1)}%)
              </span>
              <span className='tabular-nums'>
                ${Number(invoice.taxAmount).toFixed(2)}
              </span>
            </div>
          )}
          <Separator />
          <div className='flex justify-between text-base font-bold'>
            <span>Total</span>
            <span className='tabular-nums'>
              ${Number(invoice.total).toFixed(2)} {invoice.currency}
            </span>
          </div>
          {Number(invoice.amountPaid) > 0 && (
            <div className='flex justify-between text-green-600'>
              <span>Paid</span>
              <span className='tabular-nums'>
                -${Number(invoice.amountPaid).toFixed(2)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      {invoice.notes && (
        <>
          <Separator className='my-6' />
          <div>
            <p className='text-xs font-medium uppercase text-muted-foreground mb-2'>Notes</p>
            <p className='text-sm text-muted-foreground whitespace-pre-wrap'>
              {invoice.notes}
            </p>
          </div>
        </>
      )}
    </div>
  )
}
