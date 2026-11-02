'use client'

import { XIcon } from 'lucide-react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@pts/ui/tooltip'
import { cn } from '@/lib/utils'

/**
 * The × inside a field that empties it (pickers, date fields, search).
 * One size, spot and tooltip everywhere. It sits over the field, left of
 * the chevron; fields reserve `FIELD_CLEAR_PADDING` so text never runs
 * under it.
 */
export function FieldClearButton({
  onClear,
  label,
  className,
}: {
  onClear: () => void
  /** What gets cleared: "date" → "Clear date". Defaults to plain "Clear". */
  label?: string
  /** Position override for fields without a chevron (e.g. search). */
  className?: string
}) {
  const text = label ? `Clear ${label}` : 'Clear'
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type='button'
          aria-label={text}
          onClick={onClear}
          className={cn(
            'text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/50 absolute top-1/2 right-9 -translate-y-1/2 rounded p-1 outline-none focus-visible:ring-2',
            className
          )}
        >
          <XIcon className='size-3.5' aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  )
}

/**
 * Room the field's label keeps clear while the × shows, so text truncates
 * before it. Goes on the label (flex-1), not the field: padding the field
 * would push the chevron left of the ×.
 */
export const FIELD_CLEAR_LABEL_SPACE = 'pr-7'
