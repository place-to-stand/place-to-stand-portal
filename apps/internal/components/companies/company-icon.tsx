import { ENTITY_ACCENTS, ENTITY_ICONS } from '@/lib/entity-accents'
import { cn } from '@/lib/utils'

/**
 * A company's icon in its colour, wearing the green client dot while it is
 * billed. Use it wherever a company may or may not be a client (lists,
 * sheet headers, preview cards, picker options); where only clients can
 * appear, `ENTITY_ICONS.client` says the same thing.
 */
export function CompanyIcon({
  isClient,
  className,
}: {
  isClient: boolean
  className?: string
}) {
  const entity = isClient ? 'client' : 'company'
  const Icon = ENTITY_ICONS[entity]
  return (
    <Icon
      aria-hidden
      className={cn(ENTITY_ACCENTS[entity].icon, 'size-4 shrink-0', className)}
    />
  )
}
