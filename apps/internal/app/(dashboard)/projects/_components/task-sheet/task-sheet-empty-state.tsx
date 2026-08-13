import { cn } from '@/lib/utils'

export type TaskSheetEmptyStateProps = {
  message: string
  /** Makes the whole box a button — omit for a static placeholder. */
  onClick?: () => void
  disabled?: boolean
  /** Accessible name when the visible message isn't the action itself. */
  label?: string
}

const BASE_CLASSES =
  'text-muted-foreground w-full rounded-lg border border-dashed px-4 py-6 text-center text-sm'

/**
 * Shared "nothing here yet" placeholder for the task sheet's sections
 * (comments, time logs), so each section's empty state reads the same.
 * Pass `onClick` to make it a call to action, matching the attachments
 * dropzone's clickable-dashed-box behaviour.
 */
export function TaskSheetEmptyState({
  message,
  onClick,
  disabled = false,
  label,
}: TaskSheetEmptyStateProps) {
  if (!onClick) {
    return <div className={BASE_CLASSES}>{message}</div>
  }

  return (
    <button
      type='button'
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        BASE_CLASSES,
        'transition',
        disabled
          ? 'opacity-60'
          : 'hover:border-primary hover:text-foreground cursor-pointer'
      )}
    >
      {message}
    </button>
  )
}
