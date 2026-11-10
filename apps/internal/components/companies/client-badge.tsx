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

/**
 * A company's name with the Client badge after it while it is billed: how a
 * picker or filter option shows a company where clients and other companies
 * mix. A plain name otherwise.
 */
export function CompanyNameWithState({
  name,
  isClient,
}: {
  name: string
  isClient: boolean
}) {
  if (!isClient) return <span className='truncate'>{name}</span>
  return (
    <span className='flex min-w-0 items-center gap-2'>
      <span className='truncate'>{name}</span>
      <ClientBadge className='shrink-0' />
    </span>
  )
}
