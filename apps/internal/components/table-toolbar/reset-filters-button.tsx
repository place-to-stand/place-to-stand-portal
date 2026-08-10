'use client'

import { Button } from '@pts/ui/button'

type ResetFiltersButtonProps = {
  /** Render only while some filter differs from its default (hasActiveFilters). */
  show: boolean
  onReset: () => void
}

/**
 * Trailing "Reset" affordance for list-page filter bars. Rendered as the last
 * child of a FilterBar; appears only when a filter/search value differs from
 * the page's defaults, and clears them all in one click.
 */
export function ResetFiltersButton({ show, onReset }: ResetFiltersButtonProps) {
  if (!show) {
    return null
  }

  return (
    <Button
      type='button'
      variant='ghost'
      size='sm'
      onClick={onReset}
      className='text-muted-foreground hover:text-foreground h-7 px-2 text-xs'
    >
      Reset
    </Button>
  )
}
