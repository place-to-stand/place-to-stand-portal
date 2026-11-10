import { formatValue } from '@/components/activity/activity-change-list'
import {
  getActivityChanges,
  humanizeEnum,
  type FieldChange,
} from '@/lib/activity/changes'
import { htmlToPlainText } from '@/lib/activity/text-diff'
import type {
  ActivityLogWithActor,
  ActivityReferences,
} from '@/lib/activity/types'
import { getTaskStatusLabel } from '@/lib/projects/task-status'

/**
 * One row per field across every save since this sheet loaded: the oldest
 * "before" and the newest "after", so two saves of one field read as one
 * change.
 */
export function mergeFields(changes: ActivityLogWithActor[]): FieldChange[] {
  const byKey = new Map<string, FieldChange>()
  // Newest first: the first seen is the latest after.
  for (const log of changes) {
    for (const field of getActivityChanges(log).fields) {
      const seen = byKey.get(field.key)
      byKey.set(
        field.key,
        seen ? { ...seen, before: field.before } : { ...field }
      )
    }
  }
  return [...byKey.values()]
}

/** A field value as a person would say it, or null when empty. */
export function plainValue(
  field: FieldChange,
  value: unknown,
  targetType: string,
  references?: ActivityReferences
): string | null {
  if (typeof value === 'string' && /<[a-z][^>]*>/i.test(value)) {
    const text = htmlToPlainText(value).trim()
    return text || null
  }
  if (field.kind === 'status' && typeof value === 'string') {
    return targetType === 'TASK'
      ? getTaskStatusLabel(value)
      : humanizeEnum(value)
  }
  if (field.kind === 'access') return value === true ? 'Disabled' : 'Enabled'
  const text = formatValue(value, field, references)
  return text === null ? null : text.trim() || null
}

/**
 * A person, project or client id on this sheet reads as a name only when
 * the log's references know it; otherwise leave the row out rather than
 * print "Unknown person".
 */
export function resolvable(
  field: FieldChange,
  value: unknown,
  references?: ActivityReferences
): boolean {
  if (typeof value !== 'string' || !value) return true
  if (field.kind === 'user') return Boolean(references?.users[value])
  if (field.kind === 'contact') return Boolean(references?.contacts[value])
  if (field.kind === 'project') return Boolean(references?.projects[value])
  return field.kind !== 'client'
}

/** Same value for a person: ignores case, spacing and a URL's scheme. */
export function same(a: string | null, b: string | null): boolean {
  const norm = (v: string | null) =>
    (v ?? '')
      .replace(/^https?:\/\//i, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
  return norm(a) === norm(b)
}
