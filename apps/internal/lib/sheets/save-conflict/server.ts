import 'server-only'

import { eq, sql } from 'drizzle-orm'
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core'

import { fetchActivityLogs } from '@/lib/activity/queries'
import type { ActivityTargetType } from '@/lib/activity/types'
import type { AppUser } from '@/lib/auth/session'
import type { DbTx } from '@/lib/db'

import { versionMs, type SaveConflict } from './types'

/** A table a sheet edits: it has an `id` and an `updated_at`. */
type VersionedTable = PgTable & { id: AnyPgColumn; updatedAt: AnyPgColumn }

/**
 * Thrown inside a save transaction when the record changed after the sheet
 * loaded it. Throwing rolls the whole save back; the action catches it and
 * answers with `describeSaveConflict`.
 */
export class SaveConflictError extends Error {
  constructor(readonly savedAt: string) {
    super('The record changed after this sheet loaded it.')
    this.name = 'SaveConflictError'
  }
}

/**
 * The first step of every sheet save of an existing record. Locks the row,
 * so saves of one record queue instead of interleaving, then refuses the
 * save if the record's version is not the one the sheet loaded.
 *
 * Versions are compared to the millisecond, in SQL: the sheet may hold the
 * value as Postgres printed it or as JavaScript re-printed it, and two
 * saves of one record inside the same millisecond do not happen.
 *
 * `expected` undefined skips the check (callers that don't send one, like
 * the CLI); the lock still applies. Returns false when the row is gone.
 */
export async function lockForSave(
  tx: DbTx,
  table: VersionedTable,
  id: string,
  expected: string | null | undefined
): Promise<boolean> {
  const [row] = await tx
    .select({
      updatedAt: table.updatedAt,
      fresh:
        expected == null
          ? sql<boolean>`true`
          : sql<boolean>`date_trunc('milliseconds', ${table.updatedAt}) = date_trunc('milliseconds', ${expected}::timestamptz)`,
    })
    .from(table as PgTable)
    .where(eq(table.id, id))
    .for('update')
  if (!row) return false
  if (!row.fresh) throw new SaveConflictError(String(row.updatedAt))
  return true
}

/**
 * The record's version after a save, read inside the save's transaction.
 * Read back rather than taken from the app's own clock, because the
 * updated_at triggers stamp the transaction's time over whatever the app
 * wrote. The sheet sends it as its next expected version.
 */
export async function readSavedVersion(
  tx: DbTx,
  table: VersionedTable,
  id: string
): Promise<string | null> {
  const [row] = await tx
    .select({ updatedAt: table.updatedAt })
    .from(table as PgTable)
    .where(eq(table.id, id))
  return row ? String(row.updatedAt) : null
}

/**
 * What the save dialog shows: the saves made since `since`, from the
 * activity log, with the same scoping the record's History tab uses. A
 * reader who may not see activity still gets the conflict, without detail.
 */
export async function describeSaveConflict(
  user: AppUser,
  targetType: ActivityTargetType,
  targetId: string,
  error: SaveConflictError,
  since: string | null | undefined
): Promise<SaveConflict> {
  let changes: SaveConflict['changes'] = []
  try {
    const { logs } = await fetchActivityLogs(user, {
      targetType,
      targetId,
      since: since ?? undefined,
      limit: 5,
    })
    const savedAtMs = versionMs(error.savedAt)
    changes = logs
      // The reader's own last save logs just after the version they hold;
      // anything of theirs older than the conflicting version is that.
      .filter(
        log =>
          !(log.actor?.id === user.id && versionMs(log.created_at) < savedAtMs)
      )
      .map(log => ({
        // Your own save from another sheet or tab reads as yours.
        by:
          log.actor?.id === user.id
            ? 'You'
            : (log.actor?.full_name ?? log.actor?.email ?? null),
        summary: log.summary,
        at: log.created_at,
      }))
  } catch {
    // No permission to read activity, or the read failed: the conflict
    // stands either way.
  }
  return { savedAt: error.savedAt, changes }
}
