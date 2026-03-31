export const SOW_STATUS_ENUM_VALUES = [
  'DRAFT',
  'ACCEPTED',
  'IN_PROGRESS',
  'BLOCKED',
  'FINISHED',
] as const

export type SowStatusValue = (typeof SOW_STATUS_ENUM_VALUES)[number]

export const SOW_STATUS_OPTIONS: ReadonlyArray<{
  value: SowStatusValue
  label: string
}> = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'BLOCKED', label: 'Blocked' },
  { value: 'FINISHED', label: 'Finished' },
]

export const SOW_STATUS_TOKENS: Record<SowStatusValue, string> = {
  DRAFT:
    'border-transparent bg-slate-100 text-slate-800 dark:bg-slate-500/10 dark:text-slate-300',
  ACCEPTED:
    'border-transparent bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-300',
  IN_PROGRESS:
    'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300',
  BLOCKED:
    'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300',
  FINISHED:
    'border-transparent bg-slate-200 text-slate-900 dark:bg-slate-500/10 dark:text-slate-200',
}

export function getSowStatusLabel(value: string): string {
  const match = SOW_STATUS_OPTIONS.find(o => o.value === value)
  if (match) return match.label

  const normalized = value.replace(/_/g, ' ').trim()
  if (!normalized) return 'Unknown'

  return normalized
    .toLowerCase()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function getSowStatusToken(value: string): string {
  const upper = value.toUpperCase()
  if (upper in SOW_STATUS_TOKENS) {
    return SOW_STATUS_TOKENS[upper as SowStatusValue]
  }
  return 'border border-border bg-accent text-accent-foreground'
}
