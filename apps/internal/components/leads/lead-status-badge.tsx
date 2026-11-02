import { Badge } from '@pts/ui/badge'
import {
  getLeadStatusToken,
  LEAD_STATUS_LABELS,
  type LeadStatusValue,
} from '@/lib/leads/constants'
import { cn } from '@/lib/utils'

/** A lead's pipeline stage as a colored badge, as on the leads board. */
export function LeadStatusBadge({
  status,
  label,
  className,
}: {
  status: LeadStatusValue
  /** Overrides the stage's standard label. */
  label?: string
  className?: string
}) {
  return (
    <Badge
      variant='outline'
      className={cn('shrink-0', getLeadStatusToken(status), className)}
    >
      {label ?? LEAD_STATUS_LABELS[status]}
    </Badge>
  )
}
