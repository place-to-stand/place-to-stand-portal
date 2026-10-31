import { Badge } from '@pts/ui/badge'

import {
  CLIENT_BILLING_TYPE_SELECT_OPTIONS,
  type ClientBillingTypeValue,
} from '@/lib/companies/billing/billing-types'
import { cn } from '@/lib/utils'

/**
 * A client's billing type as a badge, in the billing type picker's colours
 * (Prepaid green, Net 30 amber): one source for its label and tint.
 */
export function BillingTypeBadge({
  billingType,
  className,
}: {
  billingType: ClientBillingTypeValue
  className?: string
}) {
  const option = CLIENT_BILLING_TYPE_SELECT_OPTIONS.find(
    entry => entry.value === billingType
  )
  return (
    <Badge
      variant='outline'
      className={cn(option?.badgeClassName, 'leading-4', className)}
    >
      {option?.label ?? billingType}
    </Badge>
  )
}
