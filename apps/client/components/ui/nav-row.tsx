import Link from 'next/link'
import { ChevronRightIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * One navigating row inside a divided card.
 *
 * The chevron points RIGHT, not down: these rows leave for another page rather
 * than expanding in place. Keep that distinction — a down chevron promises
 * content will appear below it.
 */
export function NavRow({
  href,
  title,
  meta,
}: {
  href: string
  title: React.ReactNode
  /** Right-aligned summary, e.g. "1 unpaid · $4,350". */
  meta?: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center justify-between gap-3 p-4',
        // Task-card tone. Hover falls back to the recessed column tone, which
        // is darker in both themes, so pressing reads the same way either way.
        'bg-surface-2 transition-colors hover:bg-surface-1 active:bg-surface-1'
      )}
    >
      <span className="min-w-0 font-medium text-card-foreground">{title}</span>
      <span className="flex min-w-0 items-center gap-2">
        {meta}
        <ChevronRightIcon
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </span>
    </Link>
  )
}
