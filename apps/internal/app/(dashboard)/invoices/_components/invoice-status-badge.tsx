import { Badge } from '@pts/ui/badge'
import { BADGE_TINTS } from '@pts/ui/badge-tints'

type BadgeProps = Pick<Parameters<typeof Badge>[0], 'variant' | 'className'>

const INVOICE_STATUS_BADGES: Record<string, { label: string } & BadgeProps> = {
  DRAFT: { label: 'Draft', variant: 'secondary' },
  SENT: { label: 'Sent', variant: 'default' },
  VIEWED: { label: 'Viewed', variant: 'outline', className: BADGE_TINTS.amber },
  PAID: { label: 'Paid', variant: 'outline', className: BADGE_TINTS.emerald },
  VOID: { label: 'Void', variant: 'destructive' },
}

/** The invoice status chip, shared by the invoices table and the invoice sheet. */
export function InvoiceStatusBadge({ status }: { status: string }) {
  const config = INVOICE_STATUS_BADGES[status]
  if (!config) {
    return (
      <Badge variant='secondary' className='text-xs'>
        {status}
      </Badge>
    )
  }
  return (
    <Badge
      variant={config.variant}
      className={`text-xs ${config.className ?? ''}`.trim()}
    >
      {config.label}
    </Badge>
  )
}
