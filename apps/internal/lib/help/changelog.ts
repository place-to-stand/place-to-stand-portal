import 'server-only'

import { readFileSync } from 'node:fs'
import path from 'node:path'

import { parseChangelog, type ChangelogWeek } from './changelog-utils'

/** Weeks the What's new dialog shows; older ones stay in CHANGELOG.md. */
const WEEKS_SHOWN = 12

let cached: ChangelogWeek[] | null = null

/**
 * What's new, from `apps/internal/CHANGELOG.md` as it was built: every install
 * lists the changes it actually has. Read once per server process (the file
 * never changes after a build); `next dev` reads it on every load so edits show. `next.config.ts` traces the file into the
 * server output. A missing or unreadable file shows an empty list.
 */
export function getChangelog(): ChangelogWeek[] {
  if (cached && process.env.NODE_ENV !== 'development') return cached
  try {
    const file = path.join(process.cwd(), 'CHANGELOG.md')
    cached = parseChangelog(readFileSync(file, 'utf8')).slice(0, WEEKS_SHOWN)
  } catch (error) {
    console.error('Could not read CHANGELOG.md', error)
    cached = []
  }
  return cached
}
