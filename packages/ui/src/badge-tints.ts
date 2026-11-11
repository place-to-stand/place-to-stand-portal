/**
 * The one recipe for tinted status badges (task and project statuses, lead
 * stages, invoice states, audiences). Pair with `<Badge variant='outline'>`:
 *
 *   <Badge variant='outline' className={BADGE_TINTS.emerald}>Paid</Badge>
 *
 * Light: a 100 fill with 800 ink. Dark: the 900 hue at 40% with 200 ink.
 * `neutral` is the token-based tint for done, void, and other resting states.
 * Class strings are written out in full so Tailwind's scanner can see them;
 * never build them by interpolating a hue.
 */
export const BADGE_TINTS = {
  neutral: 'border-transparent bg-muted text-muted-foreground',
  sky: 'border-transparent bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
  blue: 'border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  indigo:
    'border-transparent bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200',
  violet:
    'border-transparent bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
  fuchsia:
    'border-transparent bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-200',
  pink: 'border-transparent bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-200',
  rose: 'border-transparent bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
  orange:
    'border-transparent bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
  amber:
    'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  emerald:
    'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  teal: 'border-transparent bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200',
  cyan: 'border-transparent bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200',
} as const

export type BadgeTint = keyof typeof BADGE_TINTS

/**
 * A board lane's colour, from its status badge's hue: the 2px line across the
 * lane's top, and the faint fill while a card is dragged over it.
 * Lines are muted so the badge (the real data) leads: light uses the 500
 * hue at 50%, dark the badge's 200 ink at 40%. Written out in full for
 * Tailwind's scanner, like `BADGE_TINTS`.
 */
export const BOARD_LANE_TINTS: Record<
  BadgeTint,
  { line: string; drop: string }
> = {
  neutral: {
    line: 'border-t-muted-foreground/30',
    drop: 'bg-muted-foreground/[0.06]',
  },
  sky: {
    line: 'border-t-sky-500/50 dark:border-t-sky-200/40',
    drop: 'bg-sky-500/[0.06] dark:bg-sky-200/[0.06]',
  },
  blue: {
    line: 'border-t-blue-500/50 dark:border-t-blue-200/40',
    drop: 'bg-blue-500/[0.06] dark:bg-blue-200/[0.06]',
  },
  indigo: {
    line: 'border-t-indigo-500/50 dark:border-t-indigo-200/40',
    drop: 'bg-indigo-500/[0.06] dark:bg-indigo-200/[0.06]',
  },
  violet: {
    line: 'border-t-violet-500/50 dark:border-t-violet-200/40',
    drop: 'bg-violet-500/[0.06] dark:bg-violet-200/[0.06]',
  },
  fuchsia: {
    line: 'border-t-fuchsia-500/50 dark:border-t-fuchsia-200/40',
    drop: 'bg-fuchsia-500/[0.06] dark:bg-fuchsia-200/[0.06]',
  },
  pink: {
    line: 'border-t-pink-500/50 dark:border-t-pink-200/40',
    drop: 'bg-pink-500/[0.06] dark:bg-pink-200/[0.06]',
  },
  rose: {
    line: 'border-t-rose-500/50 dark:border-t-rose-200/40',
    drop: 'bg-rose-500/[0.06] dark:bg-rose-200/[0.06]',
  },
  orange: {
    line: 'border-t-orange-500/50 dark:border-t-orange-200/40',
    drop: 'bg-orange-500/[0.06] dark:bg-orange-200/[0.06]',
  },
  amber: {
    line: 'border-t-amber-500/50 dark:border-t-amber-200/40',
    drop: 'bg-amber-500/[0.06] dark:bg-amber-200/[0.06]',
  },
  emerald: {
    line: 'border-t-emerald-500/50 dark:border-t-emerald-200/40',
    drop: 'bg-emerald-500/[0.06] dark:bg-emerald-200/[0.06]',
  },
  teal: {
    line: 'border-t-teal-500/50 dark:border-t-teal-200/40',
    drop: 'bg-teal-500/[0.06] dark:bg-teal-200/[0.06]',
  },
  cyan: {
    line: 'border-t-cyan-500/50 dark:border-t-cyan-200/40',
    drop: 'bg-cyan-500/[0.06] dark:bg-cyan-200/[0.06]',
  },
}
