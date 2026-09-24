import { BADGE_TINTS } from '@pts/ui/badge-tints'

export const PROJECT_STATUS_ENUM_VALUES = [
  'ONBOARDING',
  'ACTIVE',
  'ON_HOLD',
  'COMPLETED',
] as const

export type ProjectStatusValue = (typeof PROJECT_STATUS_ENUM_VALUES)[number]

export const PROJECT_STATUS_OPTIONS: ReadonlyArray<{
  value: ProjectStatusValue
  label: string
}> = [
  { value: 'ONBOARDING', label: 'Onboarding' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ON_HOLD', label: 'On hold' },
  { value: 'COMPLETED', label: 'Completed' },
]

export const PROJECT_STATUS_VALUES = [...PROJECT_STATUS_ENUM_VALUES]

export function getProjectStatusLabel(value: string): string {
  const match = PROJECT_STATUS_OPTIONS.find(option => option.value === value)
  if (match) {
    return match.label
  }

  const normalized = value.replace(/_/g, ' ').trim()
  if (!normalized) {
    return 'Unknown'
  }

  const lower = normalized.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

const PROJECT_STATUS_TOKENS: Record<ProjectStatusValue, string> = {
  ONBOARDING: BADGE_TINTS.blue,
  ACTIVE: BADGE_TINTS.emerald,
  ON_HOLD: BADGE_TINTS.amber,
  COMPLETED: BADGE_TINTS.neutral,
}

export function getProjectStatusToken(value: string): string {
  const upperValue = value.toUpperCase()
  if (upperValue in PROJECT_STATUS_TOKENS) {
    return PROJECT_STATUS_TOKENS[upperValue as ProjectStatusValue]
  }

  return BADGE_TINTS.neutral
}

const STATUS_BADGE_TOKENS = {
  active: PROJECT_STATUS_TOKENS.ACTIVE,
  depleted: BADGE_TINTS.amber,
  archived: BADGE_TINTS.rose,
  inactive: BADGE_TINTS.neutral,
} as const

type StatusBadgeValue = keyof typeof STATUS_BADGE_TOKENS

export function getStatusBadgeToken(value: string): string {
  const normalized = value.toLowerCase() as StatusBadgeValue
  if (normalized in STATUS_BADGE_TOKENS) {
    return STATUS_BADGE_TOKENS[normalized]
  }

  return BADGE_TINTS.neutral
}
