#!/usr/bin/env node

/**
 * Seed proposal templates into the database.
 *
 * Usage:
 *   node scripts/seed-proposal-templates.mjs              # dry-run (default)
 *   node scripts/seed-proposal-templates.mjs --apply      # actually insert
 *   node scripts/seed-proposal-templates.mjs --prod       # insert into production (requires PROD_DATABASE_URL)
 */

import postgres from 'postgres'

// Default Terms and Conditions content (mirrors lib/proposals/constants.ts)
const FULL_TERMS_AND_CONDITIONS = [
  {
    title: 'Scope & Agreement',
    content: `By accepting this proposal, you indicate that the services outlined above have been thoroughly reviewed and are fully understood.
This agreement can be terminated by either party with 30 days written notice. If the Agreement ends, the client will forfeit any pre-paid amounts not yet used.`,
  },
  {
    title: 'Ownership & Intellectual Property',
    content: `Your Property: You own all final deliverables and materials created specifically for you once paid in full.
Your Data: You own your data. We won't use or share it except to perform our services.
Our Tools & Know-How: We keep ownership of our existing tools, templates, frameworks, code libraries, and general know-how that we use across projects. You get a non-exclusive, perpetual, royalty-free license to use anything from us that's embedded in your deliverables as needed for your business.`,
  },
  {
    title: 'Confidentiality & Publicity',
    content: `Both Parties agree to keep each other's confidential information private and use it only to perform under this Agreement. Confidential information includes business plans, code, data, pricing, or anything marked or reasonably understood as confidential.
Information is not confidential if it was already known, publicly available, or independently developed without using the other Party's confidential information. Either Party may disclose information if required by law, after giving notice (when legally allowed).
We may list you as a client & briefly describe the project on our website or marketing materials, unless you ask us in writing not to.`,
  },
  {
    title: 'Warranty, Liability & Force Majeure',
    content: `We'll perform our work in a professional and workmanlike manner consistent with industry standards.
Deliverables and any software are provided "as is." We can't guarantee business results or the behavior of third-party APIs or services. Except for what's stated above, we make no other warranties—express or implied—including merchantability or fitness for a particular purpose.
Custom software solutions involving third-party providers may require maintenance at our standard hourly rate to ensure reliability and compatibility with future updates.
Neither Party is liable for indirect or consequential damages (like lost profits or data).
Our total liability under this Agreement is limited to the total fees you paid to us during the 12 months before the claim arose.
These limits don't apply to your payment obligations or either Party's gross negligence or intentional misconduct.
Neither Party is liable for delays or failures caused by events beyond reasonable control (natural disasters, internet outages, war, government actions, etc.).`,
  },
  {
    title: 'Availability',
    content: `Support is subject to Place To Stand's availability and is generally available Monday through Friday from 9AM to 5PM Central Time. Place To Stand cannot guarantee explicit availability at any given time.
Support provided outside our normal hours listed above can be provided at the sole discretion of Place To Stand at 1.5x our normal hourly rates. Support is not available during bank holidays. Our availability for support outside of our normal hours is not guaranteed and is subject to staff availability.
We will answer any requests at our next availability. Our response time is usually within 1-2 business days, often sooner, but we cannot guarantee any specific response time. A 3 hour surcharge may apply for emergency service, at our discretion.
All services will be provided remotely with a minimum one week turnaround time for tasks unless a specific due date is requested. In that case, we will try our best to accommodate but it may not always be guaranteed.`,
  },
  {
    title: 'Payments',
    content: `All payments are due upon receipt of invoice. Work will not commence until payment is received.
Fees may include sales or similar taxes if determined applicable by our CPA.`,
  },
  {
    title: 'Subcontractors',
    content: `Certain requests may require the Agency to hire subcontractors for services that do not fall within its core competency. While these subcontractors may have different rates and/or payment terms, any use of a subcontractor that would result in additional charges to the Client is subject to the Client's prior agreement, either through a separate agreement or explicit written approval, before services are rendered and before any financial obligation is incurred from a third party. Furthermore, it is understood that this agreement, and the financial obligations agreed upon, are specific to the Place To Stand Agency (PTS) and the Client.`,
  },
  {
    title: 'Governing Law and Disputes',
    content: `This Agreement is governed by Texas law. Any disputes will be handled in the state or federal courts located in Travis County, Texas, and both Parties consent to that venue.`,
  },
]

const DEFAULT_TEMPLATE = {
  name: 'Standard Terms & Conditions',
  type: 'TERMS_AND_CONDITIONS',
  content: FULL_TERMS_AND_CONDITIONS,
  is_default: true,
}

const LOCAL_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const PROD_URL = process.env.PROD_DATABASE_URL

const dryRun = !process.argv.includes('--apply')
const useProd = process.argv.includes('--prod')

async function main() {
  if (useProd && !PROD_URL) {
    console.error('Missing PROD_DATABASE_URL. Set it in .env.local or as an env var.')
    process.exit(1)
  }

  const dbUrl = useProd ? PROD_URL : LOCAL_URL
  const dbLabel = useProd ? 'PRODUCTION' : 'local'
  const sql = postgres(dbUrl)

  console.log(`\nTarget database: ${dbLabel}`)

  try {
    // Check what already exists
    const existing = await sql`
      SELECT id, name, type, is_default
      FROM proposal_templates
      WHERE deleted_at IS NULL
    `

    console.log(`\nExisting templates: ${existing.length}`)
    for (const t of existing) {
      console.log(`  [${t.type}] ${t.name}${t.is_default ? ' (default)' : ''}`)
    }

    // Check if our default template already exists
    const hasDefault = existing.some(
      t => t.type === 'TERMS_AND_CONDITIONS' && t.name === DEFAULT_TEMPLATE.name
    )

    if (hasDefault) {
      console.log('\n"Standard Terms & Conditions" template already exists. Nothing to insert.')
      return
    }

    console.log('\nTemplate to insert:')
    console.log(`  + [${DEFAULT_TEMPLATE.type}] ${DEFAULT_TEMPLATE.name} (default)`)
    console.log(`    ${DEFAULT_TEMPLATE.content.length} sections`)

    if (dryRun) {
      console.log('\n--- DRY RUN --- Pass --apply to actually insert.')
      return
    }

    // If there's already a default for this type, unset it
    const existingDefault = existing.find(
      t => t.type === 'TERMS_AND_CONDITIONS' && t.is_default
    )
    if (existingDefault) {
      console.log(`\nUnsetting existing default: ${existingDefault.name}`)
      await sql`
        UPDATE proposal_templates
        SET is_default = false, updated_at = NOW()
        WHERE id = ${existingDefault.id}
      `
    }

    // Insert the new template
    const now = new Date().toISOString()
    await sql`
      INSERT INTO proposal_templates (name, type, content, is_default, created_at, updated_at)
      VALUES (
        ${DEFAULT_TEMPLATE.name},
        ${DEFAULT_TEMPLATE.type},
        ${JSON.stringify(DEFAULT_TEMPLATE.content)},
        ${DEFAULT_TEMPLATE.is_default},
        ${now},
        ${now}
      )
    `

    console.log('\nInserted "Standard Terms & Conditions" template successfully.')

  } finally {
    await sql.end()
  }
}

main().catch(err => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})
