import type { ReactNode } from 'react'

import { cn } from './cn'

export type EmptyStateProps = {
  /** One plain sentence: "No leads yet." No title, no illustration. */
  message: string
  /** Makes the whole box a button, for a call to action. */
  onClick?: () => void
  disabled?: boolean
  /** Accessible name when the visible message isn't the action itself. */
  label?: string
  /**
   * Richer content in place of the message, in the same box (the
   * attachments drop zone's icon and two lines). Keep `message` as its
   * plain-text summary.
   */
  children?: ReactNode
  /** Highlights the box, e.g. while files are dragged over it. */
  active?: boolean
  /** A button or link shown under the message (instead of `onClick`). */
  action?: ReactNode
  className?: string
}

const BASE_CLASSES =
  'text-muted-foreground flex w-full flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-6 text-center text-sm'

/**
 * The one "nothing here yet" placeholder, for list sections, sheet sections,
 * boards and portal pages alike, so every empty state reads the same.
 */
export function EmptyState({
  message,
  onClick,
  disabled = false,
  label,
  action,
  children,
  active = false,
  className,
}: EmptyStateProps) {
  const content = children ?? message
  const activeClass = active ? 'border-primary text-foreground' : null
  if (!onClick) {
    return (
      <div className={cn(BASE_CLASSES, activeClass, className)}>
        {children ?? <p>{message}</p>}
        {action}
      </div>
    )
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
          : 'hover:border-primary hover:text-foreground cursor-pointer',
        activeClass,
        className
      )}
    >
      {content}
    </button>
  )
}
