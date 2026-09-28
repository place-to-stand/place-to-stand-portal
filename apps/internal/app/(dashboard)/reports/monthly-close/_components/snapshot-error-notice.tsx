import { TriangleAlert } from 'lucide-react'

type SnapshotErrorNoticeProps = {
  message: string
}

/**
 * A closed month whose saved numbers failed validation (F9). The page falls
 * back to a live derivation, and says so.
 */
export function SnapshotErrorNotice({ message }: SnapshotErrorNoticeProps) {
  return (
    <div
      role='alert'
      className='border-destructive/35 bg-destructive/5 dark:bg-destructive/10 flex items-start gap-2.5 rounded-xl border px-5 py-3.5'
    >
      <TriangleAlert className='text-destructive mt-0.5 size-4 shrink-0' />
      <div className='flex flex-col gap-0.5'>
        <p className='text-destructive text-sm font-semibold'>
          Unable to read the saved close
        </p>
        <p className='text-foreground/80 text-[13px]'>
          {message} The figures below are live, not the saved close.
        </p>
      </div>
    </div>
  )
}
