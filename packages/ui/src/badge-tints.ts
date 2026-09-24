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
