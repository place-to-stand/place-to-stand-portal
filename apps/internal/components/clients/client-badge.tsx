import { Badge } from '@pts/ui/badge'
import { ENTITY_ACCENTS, ENTITY_ICONS } from '@/lib/entity-accents'
import { cn } from '@/lib/utils'

/** "Client": this company is billed. Label, briefcase and outline all in money green. */
export function ClientBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant='outline'
      className={cn(
        'gap-1',
        ENTITY_ACCENTS.client.cardStatic,
        // All green: label, icon and outline.
        ENTITY_ACCENTS.client.icon,
        className
      )}
    >
      <ENTITY_ICONS.client
        className={cn(ENTITY_ACCENTS.client.icon, 'size-3')}
      />
      Client
    </Badge>
  )
}
