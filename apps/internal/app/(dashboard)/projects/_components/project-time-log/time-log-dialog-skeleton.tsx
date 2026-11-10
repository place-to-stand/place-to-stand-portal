import { Skeleton } from '@pts/ui/skeleton'
import { FIELD_STACK_CLASS } from '@/components/ui/form'
import { InfoPanelDivider } from '@/components/ui/info-panel'

/** One field's placeholder: its label, then its control. */
function FieldSkeleton({
  className,
  controlClassName = 'h-9',
}: {
  className?: string
  controlClassName?: string
}) {
  return (
    <div className={`${FIELD_STACK_CLASS} ${className ?? ''}`}>
      <Skeleton className='h-4 w-20' />
      <Skeleton className={`w-full ${controlClassName}`} />
    </div>
  )
}

/**
 * The Log time dialog's body while its project loads: the hours panel and
 * the form's fields in their places, so the dialog opens at once and the
 * real content lands without the frame moving.
 */
export function TimeLogDialogSkeleton() {
  return (
    <div className='space-y-4' aria-busy='true'>
      <Skeleton className='h-[138px] w-full rounded-lg' />
      <InfoPanelDivider />
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
        <FieldSkeleton />
        <FieldSkeleton />
        <FieldSkeleton className='sm:col-span-2' />
        <FieldSkeleton className='sm:col-span-2' controlClassName='h-[68px]' />
        <FieldSkeleton className='sm:col-span-2' controlClassName='h-20' />
        <div className='flex justify-end sm:col-span-2'>
          <Skeleton className='h-9 w-32' />
        </div>
      </div>
    </div>
  )
}
