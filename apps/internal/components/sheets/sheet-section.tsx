'use client'

import { type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

import { entityIconAccent } from '@/lib/entity-accents'
import { cn } from '@/lib/utils'

type SheetSectionProps = {
  title: string
  /**
   * An icon before the title. An entity's registry icon shows in its colour;
   * any other (Comments, Activity) stays muted.
   */
  icon?: LucideIcon
  /** One line under the title — the place for copy that used to hang off each field. */
  description?: string
  /** Right-aligned slot on the title row (a "Link repository" button, a picker, a count). */
  action?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * A titled group of fields inside a sheet body. Sheets separate sections
 * with `<Separator />`; the title row matches the submission sheet's
 * section heading so read-only and form sheets share one vocabulary.
 */
export function SheetSection({
  title,
  icon: Icon,
  description,
  action,
  children,
  className,
}: SheetSectionProps) {
  return (
    <section className={cn('flex flex-col gap-4', className)}>
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
          </h3>
          {action}
        </div>
        {description ? (
          <p className='text-muted-foreground text-xs'>{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  )
}
