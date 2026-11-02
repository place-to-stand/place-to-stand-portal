import { Badge } from '@pts/ui/badge'
import { ENTITY_ACCENTS, ENTITY_ICONS } from '@/lib/entity-accents'
import { cn } from '@/lib/utils'

/**
 * "Client": this company is billed. A tinted badge like the status badges
 * (the client accent's `badge`: green tint, green label and briefcase).
 */
export function ClientBadge({ className }: { className?: string }) {
  return (
    <Badge className={cn('gap-1', ENTITY_ACCENTS.client.badge, className)}>
      <ENTITY_ICONS.client className='size-3' />
      Client
    </Badge>
  )
}
