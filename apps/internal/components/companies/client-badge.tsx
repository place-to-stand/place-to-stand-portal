import { Badge } from '@pts/ui/badge'
import { ENTITY_ACCENTS } from '@/lib/entity-accents'
import { cn } from '@/lib/utils'

/**
 * "Client": this company is billed. A tinted badge like the status badges
 * (the client accent's `badge`: green tint and label) led by the green dot,
 * the same dot the company icon wears when it is a client (ENTITY_ICONS.client).
 */
export function ClientBadge({ className }: { className?: string }) {
  return (
    <Badge className={cn('gap-1.5', ENTITY_ACCENTS.client.badge, className)}>
      <span aria-hidden className='size-1.5 shrink-0 rounded-full bg-current' />
      Client
    </Badge>
  )
}
