'use client'

import { Star } from 'lucide-react'

import { buttonVariants } from '@pts/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@pts/ui/tooltip'
import { RECORD_ROW_HOVER_ACTION_CLASS } from '@/components/sheets/sheet-record-row'
import { cn } from '@/lib/utils'

/**
 * The primary contact star on a person card. The primary shows it labelled
 * ("★ Primary contact"); everyone else gets a bare star that appears while
 * the card is hovered or the star has focus (`RECORD_ROW_HOVER_ACTION_CLASS`).
 * When nobody is primary yet, every star shows, so setting one is easy to
 * find. One button in both states, so toggling it keeps keyboard focus.
 * Goes first in the card's actions: its kept space then sits at the left end.
 */
export function PrimaryContactToggle({
  name,
  isPrimary,
  hasPrimary,
  disabled = false,
  onToggle,
  className,
}: {
  /** The person's name, for the accessible name and tooltip. */
  name: string
  isPrimary: boolean
  /** Someone on the list is primary (stars on the rest hide until hover). */
  hasPrimary: boolean
  disabled?: boolean
  onToggle: () => void
  className?: string
}) {
  return (
    // No tooltip on the primary: its label is visible.
    <Tooltip disabled={isPrimary}>
      <TooltipTrigger asChild>
        {/* One button that changes size (focus stays on toggle), so it
            takes the size classes directly; the Tooltip above labels it. */}
        <button
          type='button'
          data-slot='button'
          disabled={disabled}
          aria-pressed={isPrimary}
          aria-label={`Primary contact: ${name}`}
          onClick={onToggle}
          className={cn(
            buttonVariants({
              variant: 'ghost',
              size: isPrimary ? 'xs' : 'icon-sm',
            }),
            'text-muted-foreground',
            isPrimary
              ? 'gap-1.5 text-xs font-normal'
              : hasPrimary && RECORD_ROW_HOVER_ACTION_CLASS,
            className
          )}
        >
          <Star
            className={cn(isPrimary && 'text-warning fill-current')}
            aria-hidden
          />
          {isPrimary ? 'Primary contact' : null}
        </button>
      </TooltipTrigger>
      <TooltipContent>Make {name} the primary contact</TooltipContent>
    </Tooltip>
  )
}
