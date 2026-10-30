import type { ComponentType, ReactNode } from 'react'

/**
 * A create sheet's stand-in for a section of instant records (a lead's
 * tasks, a task's comments): its heading row, as in the edit sheet, over one
 * muted line saying it opens once the record is saved.
 */
export function PendingSection({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={className} aria-label={title}>
      <div className='flex items-center gap-2'>
        <Icon className='text-muted-foreground h-4 w-4' />
        <h3 className='text-sm font-medium'>{title}</h3>
      </div>
      <p className='text-muted-foreground mt-1 text-sm'>{children}</p>
    </section>
  )
}
