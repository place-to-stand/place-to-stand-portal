import { Briefcase } from 'lucide-react'

import { Badge } from '@pts/ui/badge'
import { ENTITY_ACCENTS } from '@/lib/entity-accents'
import { cn } from '@/lib/utils'

/** "Client": this company is billed. The client state's briefcase, in blue. */
export function ClientBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant='outline'
      className={cn('gap-1 border-blue-500/35 text-xs font-normal', className)}
    >
      <Briefcase className={cn(ENTITY_ACCENTS.client.icon, 'size-3')} />
      Client
    </Badge>
  )
}
