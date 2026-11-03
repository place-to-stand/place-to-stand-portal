/**
 * Linking a record to a company: by id, or by a typed name that finds or
 * creates the one shared company record.
 */
import 'server-only'

import { and, eq, isNull, sql } from 'drizzle-orm'

import { companyCreatedEvent, companyUpdatedEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import type { AppUser } from '@/lib/auth/session'
import { companyNameSchema, normalizeWebAddress } from '@/lib/companies/schema'
import { db } from '@/lib/db'
import { companies } from '@/lib/db/schema'

type DbExecutor = Pick<typeof db, 'select' | 'insert' | 'update'>

/** Queues work (an activity write) to run once the caller's transaction commits. */
export type DeferActivity = (task: () => Promise<unknown>) => void

/** A live company by id, for linking a record to it. */
export async function getLinkableCompany(
  companyId: string,
  executor: DbExecutor = db
): Promise<{ id: string; name: string } | null> {
  const [row] = await executor
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
    .limit(1)
  return row ?? null
}

/**
 * The live company with this name (case-insensitive), created when there is
 * none. Lead and contact saves call this so a typed company name always
 * lands on one shared record. Returns null for a blank name.
 */
export async function findOrCreateCompanyByName(
  actor: AppUser,
  rawName: string | null | undefined,
  options: {
    website?: string | null
    executor?: DbExecutor
    /**
     * Inside a transaction, hand the activity write to the caller to run after
     * commit, so a rolled-back save never logs a company that doesn't exist.
     */
    defer?: DeferActivity
  } = {}
): Promise<{ id: string; name: string; created: boolean } | null> {
  const parsedName = companyNameSchema.safeParse(rawName ?? '')
  if (!parsedName.success) return null
  const name = parsedName.data
  const executor = options.executor ?? db

  const findExisting = async () => {
    const [row] = await executor
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(
        and(
          sql`lower(btrim(${companies.name})) = lower(btrim(${name}))`,
          isNull(companies.deletedAt)
        )
      )
      .limit(1)
    return row ?? null
  }

  const existing = await findExisting()
  if (existing) return { ...existing, created: false }

  const timestamp = new Date().toISOString()
  const [inserted] = await executor
    .insert(companies)
    .values({
      name,
      website: normalizeWebAddress(options.website),
      createdBy: actor.id,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    // Two saves racing on one new name: the loser reads the winner's row.
    .onConflictDoNothing()
    .returning({ id: companies.id, name: companies.name })

  if (inserted) {
    const log = () =>
      logActivity({
        actorId: actor.id,
        actorRole: actor.role,
        targetType: 'COMPANY',
        targetId: inserted.id,
        ...companyCreatedEvent({ name }),
      })
    if (options.defer) options.defer(log)
    else await log()
    return { ...inserted, created: true }
  }

  const raced = await findExisting()
  return raced ? { ...raced, created: false } : null
}

/**
 * Gives a company a website when it has none. A lead save (or a submission
 * promotion) that still carries a website writes it here, since the company
 * owns it; an existing company website is never overwritten.
 */
export async function fillCompanyWebsiteIfBlank(
  actor: AppUser,
  companyId: string,
  rawWebsite: string | null | undefined,
  options: { executor?: DbExecutor; defer?: DeferActivity } = {}
): Promise<void> {
  const website = normalizeWebAddress(rawWebsite)
  if (!website) return
  const executor = options.executor ?? db
  const [updated] = await executor
    .update(companies)
    .set({ website, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(companies.id, companyId),
        sql`nullif(btrim(${companies.website}), '') is null`
      )
    )
    .returning({ id: companies.id, name: companies.name })
  if (!updated) return
  const log = () =>
    logActivity({
      actorId: actor.id,
      actorRole: actor.role,
      targetType: 'COMPANY',
      targetId: updated.id,
      ...companyUpdatedEvent({
        name: updated.name,
        changedFields: ['website'],
        details: { before: { website: null }, after: { website } },
      }),
    })
  if (options.defer) options.defer(log)
  else await log()
}
