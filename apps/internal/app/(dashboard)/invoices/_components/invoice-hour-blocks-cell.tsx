import Link from 'next/link'
import { Clock3 } from 'lucide-react'

import type { InvoiceHourBlockSummary } from '@/lib/invoices/invoice-form'
import { hourBlockHref, hourBlocksForInvoiceHref } from '@/lib/sheets/hrefs'

type InvoiceHourBlocksCellProps = {
  hourBlocks: InvoiceHourBlockSummary[]
  invoiceNumber: string | null
}

const toHours = (value: number) => `${value.toLocaleString()}h`

/**
 * Hours an invoice bought once paid, linking to its hour block. An invoice
 * with several blocks (one per hour-block line item) links to the hour blocks
 * list searched by its number instead. Invoices without blocks show a dash.
 */
export function InvoiceHourBlocksCell({
  hourBlocks,
  invoiceNumber,
}: InvoiceHourBlocksCellProps) {
  if (!hourBlocks.length) {
    return <span className='text-muted-foreground text-sm'>{'—'}</span>
  }

  const totalHours = hourBlocks.reduce(
    (sum, block) => sum + block.hours_purchased,
    0
  )
  const href =
    hourBlocks.length > 1 && invoiceNumber
      ? hourBlocksForInvoiceHref(invoiceNumber)
      : hourBlockHref(hourBlocks[0].id)
  const blockCount = `${hourBlocks.length} ${
    hourBlocks.length === 1 ? 'hour block' : 'hour blocks'
  }`

  return (
    <Link
      href={href}
      aria-label={`${toHours(totalHours)} in ${blockCount}`}
      className='text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm hover:underline'
    >
      <Clock3 className='h-4 w-4 shrink-0' />
      {toHours(totalHours)}
    </Link>
  )
}
