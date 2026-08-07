import { Lock, TriangleAlert } from 'lucide-react'

type ClosedNoticeProps = {
  closedAt?: string
  closedByName?: string | null
  /** When set, the persisted snapshot failed validation (F9). */
  snapshotError?: string
}

/**
 * Quiet banner on closed months: frozen-numbers note, or the explicit
 * "snapshot unreadable" state when the payload fails validation.
 */
export function ClosedNotice({
  closedAt,
  closedByName,
  snapshotError,
}: ClosedNoticeProps) {
  if (snapshotError) {
    return (
      <div className='border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-3 rounded-xl border px-4 py-3 text-sm'>
        <TriangleAlert className='mt-0.5 h-4 w-4 shrink-0' />
        <div>
          <p className='font-medium'>Snapshot unreadable</p>
          <p>{snapshotError} The figures below are a live derivation, not the frozen close.</p>
        </div>
      </div>
    )
  }

  const closedLabel = closedAt
    ? new Date(closedAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  return (
    <div className='text-muted-foreground bg-card flex items-center gap-3 rounded-xl border px-4 py-3 text-sm'>
      <Lock className='h-4 w-4 shrink-0' />
      <p>
        This month is closed. Numbers are frozen
        {closedLabel ? ` as of ${closedLabel}` : ''}
        {closedByName ? ` by ${closedByName}` : ''}.
      </p>
    </div>
  )
}
