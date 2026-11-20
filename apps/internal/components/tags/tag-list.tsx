'use client'

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { HOVER_COUNT_TRIGGER_CLASS } from '@/components/ui/linked-records-hover-cell'
import { cn } from '@/lib/utils'

import { TagBadge } from './tag-badge'

/**
 * A record's tags on one line, for a list row: the first few as badges and
 * "+N" for the rest, so rows keep one height. Hovering the "+N", tapping it or
 * pressing Enter on it opens a card with the hidden tags.
 */
export function TagList({
  names,
  max = 2,
}: {
  names: readonly string[]
  max?: number
}) {
  const shown = names.slice(0, max)
  const hiddenNames = names.slice(max)
  return (
    <span className='flex min-w-0 items-center gap-1 overflow-hidden'>
      {shown.map(name => (
        // Badges truncate before the "+N" does.
        <TagBadge key={name} name={name} className='min-w-0 shrink' />
      ))}
      {hiddenNames.length > 0 ? (
        <HoverCard>
          <HoverCardTrigger asChild>
            <button
              type='button'
              aria-label={`${hiddenNames.length} more ${hiddenNames.length === 1 ? 'tag' : 'tags'}: ${hiddenNames.join(', ')}`}
              className={cn(
                HOVER_COUNT_TRIGGER_CLASS,
                'text-muted-foreground shrink-0 text-xs'
              )}
            >
              +{hiddenNames.length}
            </button>
          </HoverCardTrigger>
          <HoverCardContent className='w-max max-w-64 p-2'>
            {/* One tag a line, the card as wide as the longest. */}
            <span className='flex flex-col items-start gap-1'>
              {hiddenNames.map(name => (
                <TagBadge key={name} name={name} />
              ))}
            </span>
          </HoverCardContent>
        </HoverCard>
      ) : null}
    </span>
  )
}
