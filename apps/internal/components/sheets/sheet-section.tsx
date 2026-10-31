'use client'

import { type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

import { entityIconAccent } from '@/lib/entity-accents'
import { cn } from '@/lib/utils'

/**
 * A major section with no divider around it (invoice Line items): 48px from
 * its neighbours in a gap-6 column, the same as a `Separator` gives
 * (24 + line + 24), so it still reads as its own block.
 */
export const SHEET_BLOCK_CLASS = 'my-6'

/**
 * A column of dividerless sections (company Company column): 48px apart.
 * Keep `Separator` for lines that do a job inside a block (an invoice total).
 */
export const SHEET_SECTIONS_CLASS = 'flex flex-col gap-12'

type SheetSectionProps = {
  /**
   * Leave it out for a sheet's first group of fields: a generic "Details"
   * heading only restates the sheet.
   */
  title?: string
  /**
   * An icon before the title. An entity's registry icon shows in its colour;
   * any other (Comments, Activity) stays muted.
   */
  icon?: LucideIcon
  /** One line under the title — the place for copy that used to hang off each field. */
  description?: string
  /**
   * The section holds a list or an empty state (Comments): the heading sits
   * 8px above it, like a section with a +. Implied by `action`.
   */
  list?: boolean
  /** Inline after the title (a count badge). */
  titleAddon?: ReactNode
  /** Right-aligned slot on the title row (a "Link repository" button, a picker, a count). */
  action?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * A titled group of fields inside a sheet body. Sheets separate sections
 * with `<Separator />` (a few boxed lists stand alone, see sheet.md); the title row matches the submission sheet's
 * section heading so read-only and form sheets share one vocabulary.
 */
export function SheetSection({
  title,
  icon: Icon,
  description,
  action,
  titleAddon,
  list = false,
  children,
  className,
}: SheetSectionProps) {
  return (
    // A section with an action (its +) holds a list or an empty state: the
    // heading sits 8px above it, the same as a field's label above its
    // control. A section of fields keeps 16px.
    <section
      className={cn(
        'flex flex-col',
        action || list ? 'gap-2' : 'gap-4',
        className
      )}
    >
      {title ? (
        <div className='flex flex-col gap-1'>
          <div className='flex min-h-5 items-center justify-between gap-2'>
            <h3 className='flex items-center gap-2 text-sm font-semibold tracking-tight'>
              {Icon ? (
                <Icon
                  className={cn(
                    'size-4 shrink-0',
                    entityIconAccent(Icon) ?? 'text-muted-foreground'
                  )}
                  aria-hidden
                />
              ) : null}
              {title}
              {titleAddon}
            </h3>
            {/* The action overlaps the row instead of growing it, so the
              heading keeps its 8px over the list either way. */}
            {action ? (
              <div className='-my-2 flex shrink-0 items-center gap-2'>
                {action}
              </div>
            ) : null}
          </div>
          {description ? (
            <p className='text-muted-foreground text-xs'>{description}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}
