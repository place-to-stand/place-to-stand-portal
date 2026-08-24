/**
 * One-off local-dev seed: rich, varied clients/contacts/projects/tasks/hour
 * blocks/invoices for manually exercising the Agents workspace against
 * realistic scenarios (billing health, blocked work, onboarding clients,
 * etc.) instead of the thin ad-hoc test data already in the DB.
 *
 * Adds ALONGSIDE existing data — never deletes or modifies anything. Safe to
 * run multiple times: each client is looked up by slug first, and skipped
 * entirely (with everything under it) if it already exists.
 *
 * Run (from apps/internal, local DB only — DATABASE_URL must point at a dev
 * database, checked below):
 *   npx tsx scripts/seed-agents-demo-data.ts             # preview only
 *   npx tsx scripts/seed-agents-demo-data.ts --execute   # write
 *
 * This script is NOT executed automatically.
 */

import { config } from 'dotenv'
import { eq, isNull, and } from 'drizzle-orm'

import { createDb } from '@pts/db/client'
import {
  clients,
  contacts,
  contactClients,
  projects,
  tasks,
  hourBlocks,
  timeLogs,
  invoices,
  invoiceLineItems,
  users,
} from '@pts/db/schema'

// Mirror drizzle.config.ts env loading so the script can run standalone.
config({ path: '.env.local', override: false })
config({ path: '.env', override: false })

const TODAY = new Date()
const CURRENT_MONTH_START = `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, '0')}-01`

function daysAgo(n: number): string {
  const d = new Date(TODAY)
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

type SeedTask = {
  title: string
  status: 'ON_DECK' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'ARCHIVED'
  description?: string
}

type SeedProject = {
  name: string
  slug: string
  status: 'ONBOARDING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED'
  tasks: SeedTask[]
}

type SeedHourBlock = { hoursPurchased: number }
type SeedTimeLog = { hours: number; loggedOn: string; note?: string }

type SeedInvoice = {
  invoiceNumber: string
  status: 'SENT' | 'VIEWED' | 'PAID' | 'DRAFT' | 'VOID'
  total: number
  issuedDate: string
  dueDate: string
  viewedAt?: string
  paidAt?: string
  description: string
}

type SeedClient = {
  name: string
  slug: string
  billingType: 'prepaid' | 'net_30'
  notes?: string
  contact: { name: string; email: string; phone?: string }
  secondContact?: { name: string; email: string; phone?: string }
  projects: SeedProject[]
  hourBlocks: SeedHourBlock[]
  timeLogs: SeedTimeLog[]
  invoices: SeedInvoice[]
}

const SEED_CLIENTS: SeedClient[] = [
  {
    name: 'Nimbus Robotics',
    slug: 'nimbus-robotics',
    billingType: 'prepaid',
    contact: { name: 'Dana Okafor', email: 'dana@nimbusrobotics.dev', phone: '415-555-0142' },
    projects: [
      {
        name: 'Fleet Dashboard',
        slug: 'nimbus-fleet-dashboard',
        status: 'ACTIVE',
        tasks: [
          { title: 'Add fleet telemetry ingestion', status: 'IN_PROGRESS' },
          { title: 'Design battery-health alert rules', status: 'ON_DECK' },
          { title: 'Migrate to new mapping SDK', status: 'ON_DECK' },
          { title: 'Fix dashboard export CSV bug', status: 'DONE' },
        ],
      },
    ],
    hourBlocks: [{ hoursPurchased: 50 }],
    timeLogs: [
      { hours: 4, loggedOn: daysAgo(12), note: 'Telemetry ingestion spike' },
      { hours: 3, loggedOn: daysAgo(9) },
      { hours: 3, loggedOn: daysAgo(5) },
      { hours: 2, loggedOn: daysAgo(2) },
    ],
    invoices: [],
  },
  {
    name: 'Harbor & Vine',
    slug: 'harbor-and-vine',
    billingType: 'prepaid',
    contact: { name: 'Priya Chandran', email: 'priya@harborandvine.com', phone: '206-555-0110' },
    projects: [
      {
        name: 'Wine Club Storefront',
        slug: 'harbor-vine-storefront',
        status: 'ACTIVE',
        tasks: [
          {
            title: 'Fix checkout tax calc for CA orders',
            status: 'BLOCKED',
            description: 'Blocked — waiting on client to provide their CA seller tax ID.',
          },
          { title: 'Add subscription pause flow', status: 'IN_PROGRESS' },
          { title: 'Write shipping zone docs', status: 'ON_DECK' },
          { title: 'Launch holiday bundle page', status: 'DONE' },
        ],
      },
    ],
    hourBlocks: [{ hoursPurchased: 40 }],
    timeLogs: [
      { hours: 10, loggedOn: daysAgo(20) },
      { hours: 12, loggedOn: daysAgo(14) },
      { hours: 9, loggedOn: daysAgo(7) },
      { hours: 7, loggedOn: daysAgo(3) },
    ],
    invoices: [],
  },
  {
    name: 'Crestline Logistics',
    slug: 'crestline-logistics',
    billingType: 'prepaid',
    contact: { name: 'Marcus Webb', email: 'marcus@crestlinelogistics.com', phone: '312-555-0177' },
    projects: [
      {
        name: 'Dispatch Ops Portal',
        slug: 'crestline-dispatch-ops',
        status: 'ACTIVE',
        tasks: [
          {
            title: 'Resolve duplicate dispatch bug',
            status: 'BLOCKED',
            description: 'Blocked — need carrier API credentials from client IT.',
          },
          { title: 'Add driver check-in SMS flow', status: 'IN_PROGRESS' },
          { title: 'Refactor route optimizer', status: 'IN_PROGRESS' },
          { title: 'Archive legacy manifest importer', status: 'ARCHIVED' },
        ],
      },
    ],
    hourBlocks: [{ hoursPurchased: 20 }],
    timeLogs: [
      { hours: 8, loggedOn: daysAgo(18) },
      { hours: 9, loggedOn: daysAgo(11) },
      { hours: 9, loggedOn: daysAgo(4) },
    ],
    invoices: [],
  },
  {
    name: 'Foothill Dental Group',
    slug: 'foothill-dental',
    billingType: 'net_30',
    contact: { name: 'Dr. Renee Ashford', email: 'renee@foothilldental.com', phone: '303-555-0199' },
    projects: [
      {
        name: 'Patient Intake Redesign',
        slug: 'foothill-patient-intake',
        status: 'ACTIVE',
        tasks: [
          { title: 'Build HIPAA-compliant intake form', status: 'IN_PROGRESS' },
          { title: 'Integrate insurance verification API', status: 'ON_DECK' },
          { title: 'QA accessibility pass', status: 'ON_DECK' },
        ],
      },
    ],
    hourBlocks: [],
    timeLogs: [],
    invoices: [
      {
        invoiceNumber: 'INV-DEMO-FH-001',
        status: 'SENT',
        total: 6200,
        issuedDate: daysAgo(21),
        dueDate: daysAgo(-9),
        description: 'August retainer — Patient Intake Redesign',
      },
    ],
  },
  {
    name: 'Marrow Coffee Co.',
    slug: 'marrow-coffee',
    billingType: 'net_30',
    contact: { name: 'Theo Lindqvist', email: 'theo@marrowcoffee.co' },
    projects: [
      {
        name: 'Roastery Ordering App',
        slug: 'marrow-ordering-app',
        status: 'ACTIVE',
        tasks: [
          { title: 'Add wholesale pricing tiers', status: 'IN_PROGRESS' },
          { title: 'Fix inventory sync race condition', status: 'ON_DECK' },
          { title: 'Ship loyalty punch-card feature', status: 'DONE' },
        ],
      },
    ],
    hourBlocks: [],
    timeLogs: [],
    invoices: [
      {
        invoiceNumber: 'INV-DEMO-MC-001',
        status: 'VIEWED',
        total: 2850,
        issuedDate: daysAgo(14),
        dueDate: daysAgo(-16),
        viewedAt: daysAgo(6),
        description: 'Roastery Ordering App — phase 2',
      },
    ],
  },
  {
    name: 'Anchor Legal Partners',
    slug: 'anchor-legal',
    billingType: 'net_30',
    contact: { name: 'Ilana Voss', email: 'ilana@anchorlegal.com', phone: '617-555-0133' },
    projects: [
      {
        name: 'Client Portal Revamp',
        slug: 'anchor-portal-revamp',
        status: 'ACTIVE',
        tasks: [
          { title: 'Redesign case timeline view', status: 'DONE' },
          { title: 'Add e-signature integration', status: 'IN_PROGRESS' },
          { title: 'Set up SOC2 audit logging', status: 'ON_DECK' },
        ],
      },
    ],
    hourBlocks: [],
    timeLogs: [],
    invoices: [
      {
        invoiceNumber: 'INV-DEMO-AL-001',
        status: 'PAID',
        total: 4000,
        issuedDate: daysAgo(45),
        dueDate: daysAgo(15),
        paidAt: daysAgo(20),
        description: 'June retainer',
      },
      {
        invoiceNumber: 'INV-DEMO-AL-002',
        status: 'PAID',
        total: 3200,
        issuedDate: daysAgo(15),
        dueDate: daysAgo(-15),
        paidAt: daysAgo(2),
        description: 'July retainer',
      },
    ],
  },
  {
    name: 'Silverline Studios',
    slug: 'silverline-studios',
    billingType: 'prepaid',
    notes: 'Signed 2026-08-10 — kickoff call scheduled, no projects created yet.',
    contact: { name: 'Jonah Reyes', email: 'jonah@silverlinestudios.io' },
    projects: [],
    hourBlocks: [],
    timeLogs: [],
    invoices: [],
  },
  {
    name: 'Thistle & Co.',
    slug: 'thistle-and-co',
    billingType: 'prepaid',
    contact: { name: 'Wren Sato', email: 'wren@thistleandco.com', phone: '512-555-0161' },
    projects: [
      {
        name: 'Inventory Sync Service',
        slug: 'thistle-inventory-sync',
        status: 'ON_HOLD',
        tasks: [
          {
            title: 'Debug webhook retry storm',
            status: 'BLOCKED',
            description: 'Blocked — waiting on vendor to raise our webhook rate limit.',
          },
          { title: 'Add rate-limit backoff', status: 'ON_DECK' },
        ],
      },
    ],
    hourBlocks: [{ hoursPurchased: 25 }],
    timeLogs: [
      { hours: 8, loggedOn: daysAgo(16) },
      { hours: 9, loggedOn: daysAgo(9) },
      { hours: 7, loggedOn: daysAgo(3) },
    ],
    invoices: [
      {
        invoiceNumber: 'INV-DEMO-TC-001',
        status: 'SENT',
        total: 1450,
        issuedDate: daysAgo(10),
        dueDate: daysAgo(-20),
        description: 'Additional hour block — 25 hrs',
      },
    ],
  },
]

async function resolveSeedActor(db: ReturnType<typeof createDb>): Promise<string> {
  const [byEmail] = await db.select({ id: users.id }).from(users).where(eq(users.email, 'test@test.com')).limit(1)
  if (byEmail) return byEmail.id

  const [anyAdmin] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, 'ADMIN'), isNull(users.deletedAt)))
    .limit(1)
  if (anyAdmin) return anyAdmin.id

  throw new Error('No admin user found to attribute seeded records to — create one first.')
}

async function main() {
  const execute = process.argv.includes('--execute')
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set')
  }
  if (!/127\.0\.0\.1|localhost/.test(databaseUrl)) {
    throw new Error(`Refusing to run against a non-local DATABASE_URL: ${databaseUrl}`)
  }

  const db = createDb(databaseUrl)
  const actorId = await resolveSeedActor(db)
  console.log(`Seeding as user ${actorId}${execute ? '' : ' (dry run — pass --execute to write)'}\n`)

  let created = 0
  let skipped = 0

  await db.transaction(async tx => {
    for (const seed of SEED_CLIENTS) {
      const [existing] = await tx
        .select({ id: clients.id })
        .from(clients)
        .where(eq(clients.slug, seed.slug))
        .limit(1)

      if (existing) {
        console.log(`Skip "${seed.name}" — already seeded (slug ${seed.slug})`)
        skipped++
        continue
      }

      console.log(`Create "${seed.name}" (${seed.billingType})`)
      created++

      if (!execute) continue

      const [client] = await tx
        .insert(clients)
        .values({
          name: seed.name,
          slug: seed.slug,
          billingType: seed.billingType,
          notes: seed.notes,
          createdBy: actorId,
        })
        .returning()

      const [contact] = await tx
        .insert(contacts)
        .values({
          name: seed.contact.name,
          email: seed.contact.email,
          phone: seed.contact.phone,
          createdBy: actorId,
        })
        .returning()
      await tx.insert(contactClients).values({ contactId: contact.id, clientId: client.id, isPrimary: true })

      if (seed.secondContact) {
        const [secondContact] = await tx
          .insert(contacts)
          .values({
            name: seed.secondContact.name,
            email: seed.secondContact.email,
            phone: seed.secondContact.phone,
            createdBy: actorId,
          })
          .returning()
        await tx.insert(contactClients).values({ contactId: secondContact.id, clientId: client.id })
      }

      for (const seedProject of seed.projects) {
        const [project] = await tx
          .insert(projects)
          .values({
            clientId: client.id,
            name: seedProject.name,
            slug: seedProject.slug,
            status: seedProject.status,
            type: 'CLIENT',
            createdBy: actorId,
            ownerId: actorId,
          })
          .returning()

        for (const seedTask of seedProject.tasks) {
          await tx.insert(tasks).values({
            projectId: project.id,
            title: seedTask.title,
            description: seedTask.description,
            status: seedTask.status,
            createdBy: actorId,
            completedAt: seedTask.status === 'DONE' ? new Date().toISOString() : undefined,
          })
        }

        for (const seedLog of seed.timeLogs) {
          await tx.insert(timeLogs).values({
            projectId: project.id,
            userId: actorId,
            hours: String(seedLog.hours),
            loggedOn: seedLog.loggedOn,
            note: seedLog.note,
          })
        }
      }

      for (const seedBlock of seed.hourBlocks) {
        await tx.insert(hourBlocks).values({
          clientId: client.id,
          hoursPurchased: String(seedBlock.hoursPurchased),
          createdBy: actorId,
          billingMonth: CURRENT_MONTH_START,
        })
      }

      for (const seedInvoice of seed.invoices) {
        const [invoice] = await tx
          .insert(invoices)
          .values({
            invoiceNumber: seedInvoice.invoiceNumber,
            status: seedInvoice.status,
            clientId: client.id,
            createdBy: actorId,
            issuedDate: seedInvoice.issuedDate,
            dueDate: seedInvoice.dueDate,
            subtotal: String(seedInvoice.total),
            taxRate: '0',
            taxAmount: '0',
            total: String(seedInvoice.total),
            billingType: seed.billingType,
            viewedAt: seedInvoice.viewedAt,
            viewedCount: seedInvoice.viewedAt ? 1 : 0,
            paidAt: seedInvoice.paidAt,
          })
          .returning()

        await tx.insert(invoiceLineItems).values({
          invoiceId: invoice.id,
          description: seedInvoice.description,
          quantity: '1',
          unitPrice: String(seedInvoice.total),
          amount: String(seedInvoice.total),
        })
      }
    }
  })

  console.log(`\nDone. ${created} client(s) ${execute ? 'created' : 'would be created'}, ${skipped} skipped.`)
  if (!execute) console.log('Re-run with --execute to write.')
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch(error => {
    console.error('seed-agents-demo-data failed:', error)
    process.exit(1)
  })
