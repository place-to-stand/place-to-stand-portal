import { NextResponse } from 'next/server'

import { requireUser, type AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { companies, contacts, projects } from '@/lib/db/schema'
import { joinCompany, setPortalAccess } from '@/lib/queries/memberships'
import { and, eq, isNull, sql } from 'drizzle-orm'

export async function POST() {
  // Hard guard: never available in production (matches dev/make-me-admin)
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  const user = await requireUser()
  assertAdmin(user)

  // Each client is a company (1:1).
  const acme = await upsertClient({
    slug: 'acme',
    name: 'Acme Corp',
    createdBy: user.id,
  })
  const beta = await upsertClient({
    slug: 'beta-llc',
    name: 'Beta LLC',
    createdBy: user.id,
  })

  // Ensure or create project under Acme
  const acmeWebsite = await upsertProject({
    slug: 'acme-website',
    name: 'Acme Website',
    companyId: acme.id,
    createdBy: user.id,
  })

  // People, each a member of their company with portal access to its client.
  await upsertContact({
    companyIds: [acme.companyId],
    email: 'ceo@acme.com',
    name: 'Acme CEO',
    createdBy: user.id,
    actor: user,
  })
  await upsertContact({
    companyIds: [acme.companyId],
    email: 'dev@acme.com',
    name: 'Acme Dev',
    createdBy: user.id,
    actor: user,
  })
  await upsertContact({
    companyIds: [beta.companyId],
    email: 'team@beta.io',
    name: 'Beta Team',
    createdBy: user.id,
    actor: user,
  })
  // Someone at two companies (like a consultant who works for both), with
  // portal access to each one's client.
  await upsertContact({
    companyIds: [acme.companyId, beta.companyId],
    email: 'consultant@example.com',
    name: 'Two-Company Consultant',
    createdBy: user.id,
    actor: user,
  })

  return NextResponse.json({
    ok: true,
    clients: { acme, beta },
    project: acmeWebsite,
  })
}

async function upsertCompany(name: string, createdBy: string) {
  const [existing] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(
      and(
        sql`lower(btrim(${companies.name})) = lower(btrim(${name}))`,
        isNull(companies.deletedAt)
      )
    )
    .limit(1)
  if (existing) return existing.id
  const [row] = await db
    .insert(companies)
    .values({ name, createdBy })
    .returning({ id: companies.id })
  return row.id
}

async function upsertClient(input: {
  slug: string
  name: string
  createdBy: string
}) {
  // A client is a company you bill: the company, with a slug and a start.
  const companyId = await upsertCompany(input.name, input.createdBy)
  const [row] = await db
    .update(companies)
    .set({ slug: input.slug })
    .where(eq(companies.id, companyId))
    .returning({ id: companies.id, slug: companies.slug })
  // Billed from this month, unless it already is.
  await db.execute(sql`insert into client_billing_periods (company_id, starts_on)
    select ${companyId}, date_trunc('month', now())::date
    where not exists (select 1 from client_billing_periods
      where company_id = ${companyId} and deleted_at is null and ends_on is null)`)
  return { ...row, companyId }
}

async function upsertProject(input: {
  slug: string
  name: string
  companyId: string
  createdBy: string
}) {
  const existing = await db
    .select()
    .from(projects)
    .where(and(eq(projects.slug, input.slug), isNull(projects.deletedAt)))
    .limit(1)
  if (existing[0]) return existing[0]
  const [row] = await db
    .insert(projects)
    .values({
      slug: input.slug,
      name: input.name,
      companyId: input.companyId,
      createdBy: input.createdBy,
    })
    .returning()
  return row
}

async function upsertContact(input: {
  companyIds: string[]
  email: string
  name?: string | null
  createdBy: string
  actor: AppUser
}) {
  // Find or create contact by email
  let [existingContact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.email, input.email), isNull(contacts.deletedAt)))
    .limit(1)

  if (!existingContact) {
    const [newContact] = await db
      .insert(contacts)
      .values({
        email: input.email,
        name: input.name ?? input.email.split('@')[0],
        createdBy: input.createdBy,
      })
      .returning()
    existingContact = newContact
  }

  for (const companyId of input.companyIds) {
    await joinCompany(db, existingContact.id, companyId)
    await setPortalAccess(db, input.actor, existingContact.id, companyId, true)
  }

  return existingContact
}
