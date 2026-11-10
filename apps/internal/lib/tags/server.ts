import 'server-only'

import { and, asc, eq, inArray, isNull, notInArray, sql } from 'drizzle-orm'

import type { Capability } from '@/lib/auth/capabilities'
import { db, type DbTx } from '@/lib/db'
import { companyTags, tags } from '@/lib/db/schema'

import {
  sameTagNames,
  tagKey,
  uniqueTagNames,
  type TagEntity,
  type TagOption,
} from './names'

/*
 * Tags for any kind of record. Each kind keeps its own tags (`tags.entity`)
 * and its own join table; everything below takes the kind and works the
 * same way for each. To give another record tags: add the value to the
 * `tag_entity` enum, a join table like `company_tags`, and an entry here.
 */
const TAG_LINKS = {
  company: {
    tagLinkTable: companyTags,
    recordId: companyTags.companyId,
    tagId: companyTags.tagId,
    /** Who may read and set these tags (the record's own capability). */
    capability: 'companies.manage',
    /** Only live records count toward how often a tag is used. */
    liveRecord: sql`exists (
      select 1 from companies c
      where c.id = ${sql.raw('"company_tags"."company_id"')}
        and c.deleted_at is null
    )`,
    row: (recordId: string, tagId: string, actorId: string) => ({
      companyId: recordId,
      tagId,
      createdBy: actorId,
    }),
  },
} as const satisfies Record<
  TagEntity,
  { capability: Capability; [key: string]: unknown }
>

/** The capability that guards a kind's tags. */
export const tagCapability = (entity: TagEntity): Capability =>
  TAG_LINKS[entity].capability

/** Every live tag of a kind, A to Z, with how many live records carry it. */
export async function listTagOptions(entity: TagEntity): Promise<TagOption[]> {
  const link = TAG_LINKS[entity]
  const rows = await db
    .select({
      id: tags.id,
      name: tags.name,
      count: sql<number>`count(${link.recordId}) filter (where ${link.liveRecord})`,
    })
    .from(tags)
    .leftJoin(link.tagLinkTable, eq(link.tagId, tags.id))
    .where(and(eq(tags.entity, entity), isNull(tags.deletedAt)))
    .groupBy(tags.id, tags.name)
    .orderBy(asc(sql`lower(${tags.name})`))
  return rows.map(row => ({ ...row, count: Number(row.count) }))
}

/** Each record's tag names, A to Z (records without tags are left out). */
export async function readRecordTags(
  entity: TagEntity,
  recordIds: readonly string[],
  client: DbTx | typeof db = db
): Promise<Map<string, string[]>> {
  const byRecord = new Map<string, string[]>()
  if (!recordIds.length) return byRecord
  const link = TAG_LINKS[entity]
  const rows = await client
    .select({ recordId: link.recordId, name: tags.name })
    .from(link.tagLinkTable)
    .innerJoin(tags, eq(tags.id, link.tagId))
    .where(and(inArray(link.recordId, [...recordIds]), isNull(tags.deletedAt)))
    .orderBy(asc(sql`lower(${tags.name})`))
  for (const row of rows) {
    const list = byRecord.get(row.recordId) ?? []
    list.push(row.name)
    byRecord.set(row.recordId, list)
  }
  return byRecord
}

/** What a save does to one record's tags, worked out before writing. */
export type TagChange = {
  /** The full list after the save, as typed. */
  next: string[]
  before: string[]
  added: string[]
  removed: string[]
}

/**
 * Compares a record's tags with the list a save sends. `undefined` (the
 * save didn't send tags) and an unchanged list both return null.
 */
export async function planTagChange(
  entity: TagEntity,
  recordId: string | null,
  names: readonly string[] | undefined
): Promise<TagChange | null> {
  if (names === undefined) return null
  const next = uniqueTagNames(names)
  const before = recordId
    ? ((await readRecordTags(entity, [recordId])).get(recordId) ?? [])
    : []
  if (sameTagNames(before, next)) return null
  const beforeKeys = new Set(before.map(tagKey))
  const nextKeys = new Set(next.map(tagKey))
  return {
    next,
    before,
    added: next.filter(name => !beforeKeys.has(tagKey(name))),
    removed: before.filter(name => !nextKeys.has(tagKey(name))),
  }
}

/**
 * Sets a record's tags to `names` inside the caller's transaction. A name
 * that matches a live tag of this kind (any case) reuses it; a new one is
 * created. Tags taken off a record stay, so they're still offered.
 */
export async function writeRecordTagsInTx(
  tx: DbTx,
  entity: TagEntity,
  recordId: string,
  names: readonly string[],
  actorId: string
): Promise<void> {
  const link = TAG_LINKS[entity]
  const next = uniqueTagNames(names)

  let tagIds: string[] = []
  if (next.length) {
    // Two saves creating "Salon" at once: the unique index keeps one, and
    // the select below finds it either way.
    await tx
      .insert(tags)
      .values(next.map(name => ({ entity, name, createdBy: actorId })))
      .onConflictDoNothing()
    const keys = next.map(tagKey)
    const rows = await tx
      .select({ id: tags.id })
      .from(tags)
      .where(
        and(
          eq(tags.entity, entity),
          isNull(tags.deletedAt),
          inArray(sql<string>`lower(btrim(${tags.name}))`, keys)
        )
      )
    tagIds = rows.map(row => row.id)
  }

  await tx
    .delete(link.tagLinkTable)
    .where(
      tagIds.length
        ? and(eq(link.recordId, recordId), notInArray(link.tagId, tagIds))
        : eq(link.recordId, recordId)
    )
  if (tagIds.length) {
    await tx
      .insert(link.tagLinkTable)
      .values(tagIds.map(tagId => link.row(recordId, tagId, actorId)))
      .onConflictDoNothing()
  }
}
