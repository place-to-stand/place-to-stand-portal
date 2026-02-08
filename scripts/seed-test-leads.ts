/**
 * Seed script for testing Agentic CRM features
 *
 * Run with: npx tsx scripts/seed-test-leads.ts
 */

import { config } from 'dotenv'

// Load from .env.local (Next.js convention)
config({ path: '.env.local' })
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { sql } from 'drizzle-orm'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required')
}

const client = postgres(connectionString)
const db = drizzle(client)

const now = new Date().toISOString()
const daysAgo = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

const testLeads = [
  // HOT LEAD - Ready to close, high engagement
  {
    contact_name: 'Sarah Chen',
    contact_email: 'sarah.chen@techstartup.io',
    contact_phone: '+1 (555) 123-4567',
    company_name: 'TechStartup.io',
    company_website: 'https://techstartup.io',
    status: 'ACTIVE_OPPORTUNITIES',
    source_type: 'REFERRAL',
    source_detail: 'Referred by John at Acme Corp',
    notes: JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Series A startup, needs custom dashboard. Budget approved $50k-75k. Decision maker. Wants to start in 2 weeks.' },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Had discovery call on Monday - very engaged, asked detailed technical questions.' },
          ],
        },
      ],
    }),
    overall_score: '0.85',
    priority_tier: 'hot',
    signals: JSON.stringify([
      { type: 'budget_mentioned', timestamp: daysAgo(2), weight: 0.9, details: { note: 'Budget $50k-75k approved' } },
      { type: 'decision_maker', timestamp: daysAgo(3), weight: 0.85, details: { note: 'CTO with signing authority' } },
      { type: 'urgency_detected', timestamp: daysAgo(1), weight: 0.8, details: { note: 'Needs to launch in Q1' } },
      { type: 'fast_response', timestamp: daysAgo(2), weight: 0.7, details: { note: 'Responded within 2 hours' } },
    ]),
    last_scored_at: daysAgo(1),
    last_contact_at: daysAgo(1),
    awaiting_reply: false,
    predicted_close_probability: '0.78',
    estimated_value: '62500.00',
    created_at: daysAgo(7),
    updated_at: now,
  },

  // WARM LEAD - Promising but needs nurturing
  {
    contact_name: 'Michael Torres',
    contact_email: 'mtorres@enterprise-solutions.com',
    contact_phone: '+1 (555) 234-5678',
    company_name: 'Enterprise Solutions Inc',
    company_website: 'https://enterprise-solutions.com',
    status: 'ACTIVE_OPPORTUNITIES',
    source_type: 'WEBSITE',
    source_detail: 'Contact form submission',
    notes: JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Large enterprise, looking for project management solution. Multiple stakeholders involved.' },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Sent overview deck, waiting for internal review. Follow up scheduled for Friday.' },
          ],
        },
      ],
    }),
    overall_score: '0.58',
    priority_tier: 'warm',
    signals: JSON.stringify([
      { type: 'multiple_stakeholders', timestamp: daysAgo(5), weight: 0.6, details: { note: 'CCed 3 team members' } },
      { type: 'technical_fit', timestamp: daysAgo(4), weight: 0.7, details: { note: 'Requirements match our capabilities' } },
    ]),
    last_scored_at: daysAgo(2),
    last_contact_at: daysAgo(3),
    awaiting_reply: true,
    predicted_close_probability: '0.45',
    estimated_value: '35000.00',
    created_at: daysAgo(14),
    updated_at: now,
  },

  // COLD LEAD - Going silent
  {
    contact_name: 'Jessica Williams',
    contact_email: 'jwilliams@smallbiz.net',
    company_name: 'SmallBiz Solutions',
    company_website: 'https://smallbiz.net',
    status: 'NEW_OPPORTUNITIES',
    source_type: 'WEBSITE',
    source_detail: 'LinkedIn outreach (via website contact)',
    notes: JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Initial interest but no response to last two follow-ups. May have gone with competitor.' },
          ],
        },
      ],
    }),
    overall_score: '0.25',
    priority_tier: 'cold',
    signals: JSON.stringify([
      { type: 'going_cold', timestamp: daysAgo(2), weight: 0.8, details: { note: 'No response for 10+ days' } },
    ]),
    last_scored_at: daysAgo(2),
    last_contact_at: daysAgo(12),
    awaiting_reply: true,
    predicted_close_probability: '0.15',
    created_at: daysAgo(21),
    updated_at: now,
  },

  // PROPOSAL SENT - Waiting for decision
  {
    contact_name: 'David Park',
    contact_email: 'david.park@innovate-labs.com',
    contact_phone: '+1 (555) 345-6789',
    company_name: 'Innovate Labs',
    company_website: 'https://innovate-labs.com',
    status: 'PROPOSAL_SENT',
    source_type: 'EVENT',
    source_detail: 'Met at TechCrunch Disrupt',
    notes: JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Proposal sent last week for $45k engagement. They are evaluating 2 other vendors.' },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Decision expected by end of month. CTO seemed very positive during demo.' },
          ],
        },
      ],
    }),
    overall_score: '0.72',
    priority_tier: 'hot',
    signals: JSON.stringify([
      { type: 'competitor_mentioned', timestamp: daysAgo(4), weight: 0.5, details: { note: 'Evaluating 2 competitors' } },
      { type: 'clear_requirements', timestamp: daysAgo(6), weight: 0.8, details: { note: 'Detailed RFP provided' } },
      { type: 'decision_maker', timestamp: daysAgo(5), weight: 0.85, details: { note: 'CTO involved in evaluation' } },
    ]),
    last_scored_at: daysAgo(1),
    last_contact_at: daysAgo(4),
    awaiting_reply: true,
    predicted_close_probability: '0.55',
    estimated_value: '45000.00',
    created_at: daysAgo(18),
    updated_at: now,
  },

  // CLOSED_WON - Ready for conversion to client
  {
    contact_name: 'Emily Rodriguez',
    contact_email: 'emily@growthco.io',
    contact_phone: '+1 (555) 456-7890',
    company_name: 'GrowthCo',
    company_website: 'https://growthco.io',
    status: 'CLOSED_WON',
    source_type: 'REFERRAL',
    source_detail: 'Referred by existing client FinanceApp',
    notes: JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Deal closed! Starting with 6-month engagement for customer portal development.' },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Contract signed for $72,000. Kickoff meeting scheduled for next Monday.' },
          ],
        },
      ],
    }),
    overall_score: '0.95',
    priority_tier: 'hot',
    signals: JSON.stringify([
      { type: 'budget_mentioned', timestamp: daysAgo(10), weight: 0.9, details: { note: 'Contract for $72k' } },
      { type: 'decision_maker', timestamp: daysAgo(12), weight: 0.9, details: { note: 'CEO approved' } },
      { type: 'clear_requirements', timestamp: daysAgo(8), weight: 0.85, details: { note: 'SOW finalized' } },
    ]),
    last_scored_at: daysAgo(3),
    last_contact_at: daysAgo(2),
    awaiting_reply: false,
    predicted_close_probability: '1.00',
    estimated_value: '72000.00',
    created_at: daysAgo(30),
    updated_at: now,
  },

  // NEW OPPORTUNITY - Just came in, not scored yet
  {
    contact_name: 'Alex Johnson',
    contact_email: 'alex.j@newventure.co',
    company_name: 'NewVenture Co',
    company_website: 'https://newventure.co',
    status: 'NEW_OPPORTUNITIES',
    source_type: 'WEBSITE',
    source_detail: 'Pricing page inquiry',
    notes: JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Submitted contact form asking about pricing for small team (5-10 people). Mentioned they saw us on Product Hunt.' },
          ],
        },
      ],
    }),
    // No score yet - will test scoring feature
    awaiting_reply: false,
    created_at: daysAgo(1),
    updated_at: now,
  },

  // ON_ICE - Paused/delayed
  {
    contact_name: 'Robert Kim',
    contact_email: 'rkim@bigcorp.com',
    contact_phone: '+1 (555) 567-8901',
    company_name: 'BigCorp Industries',
    company_website: 'https://bigcorp.com',
    status: 'ON_ICE',
    source_type: 'WEBSITE',
    source_detail: 'Cold outreach campaign',
    notes: JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Was interested but budget got frozen for Q1. Asked to reconnect in Q2.' },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Set reminder to follow up in March.' },
          ],
        },
      ],
    }),
    overall_score: '0.42',
    priority_tier: 'cold',
    signals: JSON.stringify([
      { type: 'going_cold', timestamp: daysAgo(14), weight: 0.6, details: { note: 'Budget frozen, paused engagement' } },
    ]),
    last_scored_at: daysAgo(14),
    last_contact_at: daysAgo(21),
    awaiting_reply: false,
    predicted_close_probability: '0.25',
    estimated_value: '80000.00',
    created_at: daysAgo(45),
    updated_at: now,
  },
]

async function seedTestLeads() {
  console.log('🌱 Seeding test leads for Agentic CRM...\n')

  for (const lead of testLeads) {
    try {
      // Check if lead already exists by email (our unique identifier for test data)
      const existing = await db.execute(sql`
        SELECT id FROM leads WHERE contact_email = ${lead.contact_email} AND deleted_at IS NULL
      `)

      if (existing.length > 0) {
        console.log(`⏭️  Skipped: ${lead.contact_name} (already exists)`)
        continue
      }

      await db.execute(sql`
        INSERT INTO leads (
          contact_name, contact_email, contact_phone, company_name, company_website,
          status, source_type, source_detail, notes,
          overall_score, priority_tier, signals, last_scored_at,
          last_contact_at, awaiting_reply, predicted_close_probability, estimated_value,
          created_at, updated_at
        ) VALUES (
          ${lead.contact_name},
          ${lead.contact_email},
          ${lead.contact_phone || null},
          ${lead.company_name || null},
          ${lead.company_website || null},
          ${lead.status}::lead_status,
          ${lead.source_type || null}::lead_source_type,
          ${lead.source_detail || null},
          ${lead.notes}::jsonb,
          ${lead.overall_score || null},
          ${lead.priority_tier || null},
          ${lead.signals || '[]'}::jsonb,
          ${lead.last_scored_at || null},
          ${lead.last_contact_at || null},
          ${lead.awaiting_reply || false},
          ${lead.predicted_close_probability || null},
          ${lead.estimated_value || null},
          ${lead.created_at},
          ${lead.updated_at}
        ) RETURNING id
      `)
      console.log(`✅ Created: ${lead.contact_name} (${lead.priority_tier || 'unscored'})`)
    } catch (error) {
      console.error(`❌ Failed to create ${lead.contact_name}:`, error)
    }
  }

  console.log('\n✨ Done! Test leads created:')
  console.log('   - 2 HOT leads (Sarah Chen, David Park)')
  console.log('   - 1 WARM lead (Michael Torres)')
  console.log('   - 2 COLD leads (Jessica Williams, Robert Kim)')
  console.log('   - 1 CLOSED_WON lead ready for conversion (Emily Rodriguez)')
  console.log('   - 1 NEW lead with no score (Alex Johnson)')
  console.log('\nFeatures to test:')
  console.log('   1. Priority badges on lead cards')
  console.log('   2. Score display in lead sheet')
  console.log('   3. AI scoring on Alex Johnson (unscored lead)')
  console.log('   4. AI suggestions generation on any lead')
  console.log('   5. Lead→Client conversion on Emily Rodriguez')

  await client.end()
  process.exit(0)
}

seedTestLeads().catch(err => {
  console.error(err)
  process.exit(1)
})
