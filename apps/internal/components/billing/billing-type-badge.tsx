import { Badge } from '@pts/ui/badge'
import { BADGE_TINTS } from '@pts/ui/badge-tints'

import { cn } from '@/lib/utils'

/** A client's billing type as a badge: Net 30 (amber) or Prepaid (neutral). */
export function BillingTypeBadge({
  billingType,
  className,
}: {
  billingType: 'net_30' | 'prepaid'
  className?: string
}) {
  return (
    <Badge
      variant='outline'
      className={cn(
        billingType === 'net_30' ? BADGE_TINTS.amber : BADGE_TINTS.neutral,
        'leading-4',
        className
      )}
    >
      {billingType === 'net_30' ? 'Net 30' : 'Prepaid'}
    </Badge>
  )
}
