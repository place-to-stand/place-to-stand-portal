import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export type LinkedRecordDetail = {
  label: string
  value: ReactNode
}

type LinkedRecordCardProps = {
  icon: LucideIcon
  title: ReactNode
  /** Secondary line under the title — usually the record's email. */
  description?: ReactNode
  /** Facts about the linked record, laid out as a label/value grid below. */
  details?: LinkedRecordDetail[]
  /** Trailing control: an "Open …" button, or the action that creates the link. */
  action?: ReactNode
}

/**
 * A bordered card describing a record this sheet's entity is linked to (a
 * contact's portal user, a user's contact), with the action that follows the
 * link or creates it. Both sides of a link use this so they read as a pair.
 * Detail labels match the template sheets' `dl` fields.
 */
export function LinkedRecordCard({
  icon: Icon,
  title,
  description,
  details,
  action,
}: LinkedRecordCardProps) {
  return (
    <div className='rounded-md border'>
      <div className='flex items-center gap-3 p-3'>
        <Icon className='text-muted-foreground h-4 w-4 shrink-0' />
        <div className='flex min-w-0 flex-1 flex-col gap-0.5 text-sm leading-tight'>
          <div className='truncate font-medium'>{title}</div>
          {description ? (
            <div className='text-muted-foreground truncate text-xs'>
              {description}
            </div>
          ) : null}
        </div>
        {action ? <div className='shrink-0'>{action}</div> : null}
      </div>
      {details?.length ? (
        <dl className='grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-x-6 gap-y-2.5 border-t px-3 py-2.5 text-xs'>
          {details.map(detail => (
            <div key={detail.label} className='flex min-w-0 flex-col gap-0.5'>
              <dt className='text-muted-foreground text-[10px] font-medium tracking-wide uppercase'>
                {detail.label}
              </dt>
              <dd className='min-w-0 break-words'>{detail.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  )
}
