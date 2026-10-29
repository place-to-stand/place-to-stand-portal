import type { SearchableComboboxItem } from '@/components/ui/searchable-combobox'

export type MemberCandidate = {
  id: string
  fullName: string | null
  email: string
  avatarUrl: string | null
  disabled: boolean
}

/** Picker options: active candidates who aren't members yet. */
export function buildMemberOptions(
  candidates: readonly MemberCandidate[],
  memberIds: readonly string[]
): SearchableComboboxItem[] {
  return candidates
    .filter(
      candidate => !candidate.disabled && !memberIds.includes(candidate.id)
    )
    .map(candidate => ({
      value: candidate.id,
      label: candidate.fullName?.trim() || candidate.email,
      keywords: [candidate.email],
      userId: candidate.id,
      avatarUrl: candidate.avatarUrl,
    }))
}

export function memberInitials(candidate: MemberCandidate): string {
  const name = candidate.fullName?.trim() || candidate.email
  const parts = name.split(/\s+/)
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.charAt(0).toUpperCase()
}
