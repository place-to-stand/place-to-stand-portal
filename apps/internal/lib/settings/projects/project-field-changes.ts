import type { ProjectStatusValue } from '@/lib/constants'

/** The project columns the sheet edits, as stored. */
export type ProjectFieldValues = {
  name: string
  status: ProjectStatusValue
  type: string
  startsOn: string | null
  endsOn: string | null
  slug: string | null
  ownerId: string | null
}

/**
 * What a save changed, for the PROJECT_UPDATED activity row: the changed
 * field names and their before/after values. `details` is undefined when
 * nothing changed.
 */
export function diffProjectFields(
  before: ProjectFieldValues,
  after: ProjectFieldValues
): {
  changedFields: string[]
  details?: { before: Record<string, unknown>; after: Record<string, unknown> }
} {
  const fields: Array<[keyof ProjectFieldValues, string]> = [
    ['name', 'name'],
    ['status', 'status'],
    ['type', 'type'],
    ['startsOn', 'start date'],
    ['endsOn', 'end date'],
    ['slug', 'slug'],
    ['ownerId', 'owner'],
  ]

  const changedFields: string[] = []
  const previous: Record<string, unknown> = {}
  const next: Record<string, unknown> = {}

  fields.forEach(([key, label]) => {
    const was = before[key] ?? null
    const now = after[key] ?? null
    if (was === now) return
    changedFields.push(label)
    previous[key] = was
    next[key] = now
  })

  return changedFields.length
    ? { changedFields, details: { before: previous, after: next } }
    : { changedFields }
}
