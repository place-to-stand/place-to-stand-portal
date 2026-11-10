import { XIcon } from 'lucide-react'

import { Badge } from '@pts/ui/badge'
import { cn } from '@/lib/utils'

/**
 * A tag, everywhere it shows (field, list column, filter): the quiet
 * neutral badge. With `onRemove` it carries a small × that takes it off.
 */
export function TagBadge({
  name,
  onRemove,
  disabled,
  className,
}: {
  name: string
  onRemove?: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <Badge
      variant='secondary'
      className={cn('max-w-full', onRemove && 'pr-1', className)}
      title={name}
    >
      <span className='truncate'>{name}</span>
      {onRemove ? (
        <button
          type='button'
          aria-label={`Remove tag ${name}`}
          onClick={onRemove}
          disabled={disabled}
          className='hover:bg-foreground/10 focus-visible:ring-ring/50 -my-0.5 cursor-pointer rounded-full p-0.5 outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50'
        >
          <XIcon aria-hidden />
        </button>
      ) : null}
    </Badge>
  )
}
