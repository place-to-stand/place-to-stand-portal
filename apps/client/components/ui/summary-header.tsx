import { Progress } from '@pts/ui/progress'

import { cn } from '@/lib/utils'

/**
 * The headline stat at the top of a dashboard card — hours remaining, tasks
 * completed.
 *
 * Both cards use this so their headers are structurally identical and land on
 * the same baseline. The min-height is what holds that alignment even when one
 * side has no progress bar (a net_30 client shows terms instead of a balance).
 * This header is the only thing hard-matched across the two columns; everything
 * below it is free to be whatever height its content needs.
 */
export function SummaryHeader({
  label,
  value,
  suffix,
  /** 0–100. Omit to render no bar (the row keeps its height regardless). */
  percent,
  isAlert = false,
  /** Announced on the progress bar, e.g. "Hours used". */
  progressLabel,
}: {
  label: string
  value: string
  suffix: string
  percent?: number
  isAlert?: boolean
  progressLabel?: string
}) {
  return (
    // Shallowest layer. The interactive rows below step down through
    // surface-2 and surface-3; see the token definitions in globals.css.
    <div className='bg-surface-1 flex min-h-28 flex-col justify-center p-4'>
      <p className='text-muted-foreground text-sm font-medium'>{label}</p>

      <div className='mt-1 flex items-baseline gap-2'>
        <span
          className={cn(
            'text-3xl font-bold tabular-nums',
            isAlert ? 'text-destructive' : 'text-foreground'
          )}
        >
          {value}
        </span>
        <span className='text-muted-foreground text-sm'>{suffix}</span>
      </div>

      {percent !== undefined && (
        <Progress
          value={percent}
          aria-label={progressLabel}
          // foreground/15, not the default primary/20: the track has to stay
          // visible on the darkened header in both themes.
          className={cn(
            'bg-foreground/15 mt-3',
            isAlert && '[&_[data-slot=progress-indicator]]:bg-destructive'
          )}
        />
      )}
    </div>
  )
}
