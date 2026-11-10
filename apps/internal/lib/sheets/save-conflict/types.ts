import type { ActivityLogWithActor } from '@/lib/activity/types'

/**
 * A save refused because the record changed after the sheet loaded it.
 * `savedAt` is the record's version now: sending it back as the expected
 * version is how the sheet overwrites on purpose.
 */
export type SaveConflict = {
  savedAt: string
  /**
   * The saves made since, as History shows them (who, when, each field's
   * before and after). Newest first. Empty when the change left no
   * activity row the viewer may see.
   */
  changes: ActivityLogWithActor[]
}

/**
 * A version (an updated_at) as epoch milliseconds, whether Postgres printed
 * it ("2026-11-06 14:20:15.123456+00") or JavaScript did (ISO 8601).
 */
export function versionMs(value: string): number {
  const iso = value
    .trim()
    .replace(' ', 'T')
    .replace(/([+-]\d\d)$/, '$1:00')
  return Date.parse(iso)
}
