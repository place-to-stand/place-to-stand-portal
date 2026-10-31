import { Badge } from '@pts/ui/badge'

import type { LeadUpdateTypeValue } from '@/lib/leads/updates'
import {
  LEAD_UPDATE_ICONS,
  LEAD_UPDATE_LABELS,
  LEAD_UPDATE_TOKENS,
} from '@/lib/leads/updates'
import { cn } from '@/lib/utils'

/**
 * A lead update's type as a badge: icon, label and colour together (colour
 * is never the only signal). The list and the type picker both use it.
 */
export function LeadUpdateTypeBadge({ type }: { type: LeadUpdateTypeValue }) {
  const Icon = LEAD_UPDATE_ICONS[type]
  return (
    <Badge className={cn('gap-1', LEAD_UPDATE_TOKENS[type])}>
      <Icon className='h-3 w-3' aria-hidden='true' />
      {LEAD_UPDATE_LABELS[type]}
    </Badge>
  )
}
