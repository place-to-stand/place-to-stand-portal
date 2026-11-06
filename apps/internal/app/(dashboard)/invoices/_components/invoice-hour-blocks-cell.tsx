'use client'

import { formatHours } from '@pts/ui/numbers'
import { LinkedRecordsHoverCell } from '@/components/ui/linked-records-hover-cell'
import { SheetLink } from '@/components/ui/sheet-link'
import { ENTITY_ACCENTS, ENTITY_ICONS } from '@/lib/entity-accents'
import { cn } from '@/lib/utils'

import type { InvoiceHourBlockSummary } from '@/lib/invoices/invoice-form'

type InvoiceHourBlocksCellProps = {
  hourBlocks: InvoiceHourBlockSummary[]
}

const TRIGGER_CLASS =
  'text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm hover:underline'

/**
 * Hours an invoice bought once paid. One block opens its sheet over the list;
 * an invoice with several (one per hour-block line item) lists them in a
 * hover card, each opening its sheet. Invoices without blocks show a dash.
 */
export function InvoiceHourBlocksCell({
  hourBlocks,
}: InvoiceHourBlocksCellProps) {
  if (!hourBlocks.length) {
    return <span className='text-muted-foreground text-sm'>{'—'}</span>
  }

  const totalHours = hourBlocks.reduce(
    (sum, block) => sum + block.hours_purchased,
    0
  )
  const content = (
    <>
      <ENTITY_ICONS.hourBlock
        className={cn(ENTITY_ACCENTS.hourBlock.icon, 'h-4 w-4 shrink-0')}
      />
      {formatHours(totalHours)}
    </>
  )

  if (hourBlocks.length === 1) {
    return (
      <SheetLink
        sheet={{ entity: 'hour-block', id: hourBlocks[0].id }}
        aria-label={`${formatHours(totalHours)} in 1 hour block`}
        className={TRIGGER_CLASS}
      >
        {content}
      </SheetLink>
    )
  }

  return (
    <LinkedRecordsHoverCell
      count={hourBlocks.length}
      trigger={content}
      triggerClassName='gap-1.5 text-sm'
      ariaLabel={`${formatHours(totalHours)} in ${hourBlocks.length} hour blocks`}
      icon={ENTITY_ICONS.hourBlock}
      iconClassName={ENTITY_ACCENTS.hourBlock.icon}
      items={hourBlocks.map(block => ({
        id: block.id,
        label: formatHours(block.hours_purchased),
        sublabel: block.description,
        sheet: { entity: 'hour-block' as const, id: block.id },
      }))}
    />
  )
}
