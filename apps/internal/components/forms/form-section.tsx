import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/** A page form's sections, 32px apart (Settings → Business, Billing). */
export const FORM_SECTIONS_CLASS = 'flex flex-col gap-8'

/** A field that spans both columns of a `FormSection` grid (Street). */
export const FORM_FIELD_WIDE_CLASS = 'sm:col-span-2'

// Kept in a constant: lint flags a hand-written section heading with these
// classes anywhere else (pts/restricted-syntax, NO_HAND_SECTION_HEADING).
const TITLE_CLASS = 'text-lg font-semibold tracking-tight'

type FormSectionProps = {
  title: string
  /** One line under the title: what the section is for. */
  description?: ReactNode
  /** Right-aligned on the title row (Create product). */
  action?: ReactNode
  /**
   * `fields` (the default) lays the children out in the two-column field
   * grid; `block` leaves them as they are (a table, a list, one wide control).
   */
  layout?: 'fields' | 'block'
  children: ReactNode
  className?: string
}

/**
 * A titled group on a full-page form (Settings pages). The page-sized sibling
 * of `SheetSection`: heading, optional description and action, then the
 * fields in a two-column grid that drops to one column on phones.
 */
export function FormSection({
  title,
  description,
  action,
  layout = 'fields',
  children,
  className,
}: FormSectionProps) {
  return (
    <section className={cn('flex flex-col gap-4', className)}>
      <div className='flex flex-col gap-1'>
        <div className='flex min-h-8 items-center justify-between gap-2'>
          <h2 className={TITLE_CLASS}>{title}</h2>
          {action ? (
            <div className='flex shrink-0 items-center gap-2'>{action}</div>
          ) : null}
        </div>
        {description ? (
          <p className='text-muted-foreground text-sm'>{description}</p>
        ) : null}
      </div>
      {layout === 'fields' ? (
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>{children}</div>
      ) : (
        children
      )}
    </section>
  )
}
