/**
 * Seed script for default email templates
 *
 * Run with: npx tsx scripts/seed-email-templates.ts
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

const defaultTemplates = [
  // FOLLOW_UP Templates
  {
    name: 'Initial Follow-up',
    category: 'FOLLOW_UP',
    subject: 'Following up on our conversation, {{first_name}}',
    body_html: `<p>Hi {{first_name}},</p>
<p>It was great connecting with you! I wanted to follow up on our conversation and see if you had any questions about how we might be able to help {{company_name}}.</p>
<p>I'd love to schedule a quick call to discuss your needs in more detail. Would you have 15-20 minutes this week?</p>
<p>Looking forward to hearing from you.</p>
<p>Best,<br/>{{sender_name}}</p>`,
    is_default: true,
  },
  {
    name: 'Second Follow-up',
    category: 'FOLLOW_UP',
    subject: 'Checking in - {{company_name}}',
    body_html: `<p>Hi {{first_name}},</p>
<p>I wanted to circle back and see if you've had a chance to think about our previous conversation.</p>
<p>I understand you're busy, but I believe we could really help {{company_name}} achieve your goals. Is there a better time to connect?</p>
<p>Let me know if you have any questions in the meantime.</p>
<p>Best,<br/>{{sender_name}}</p>`,
    is_default: false,
  },

  // PROPOSAL Templates
  {
    name: 'Proposal Introduction',
    category: 'PROPOSAL',
    subject: 'Proposal for {{company_name}}',
    body_html: `<p>Hi {{first_name}},</p>
<p>Thank you for taking the time to discuss your project needs with me. Based on our conversation, I've put together a proposal that I believe addresses your requirements.</p>
<p>Please find the proposal attached. Key highlights include:</p>
<ul>
<li>Project scope and deliverables</li>
<li>Timeline and milestones</li>
<li>Investment and payment terms</li>
</ul>
<p>I'd love to walk you through the details and answer any questions. When would be a good time to connect?</p>
<p>Best,<br/>{{sender_name}}</p>`,
    is_default: true,
  },
  {
    name: 'Proposal Follow-up',
    category: 'PROPOSAL',
    subject: 'Re: Proposal for {{company_name}} - Next steps?',
    body_html: `<p>Hi {{first_name}},</p>
<p>I wanted to follow up on the proposal I sent over. Have you had a chance to review it?</p>
<p>I'm happy to clarify any points or adjust the scope based on your feedback. Would you like to schedule a call to discuss?</p>
<p>Looking forward to your thoughts.</p>
<p>Best,<br/>{{sender_name}}</p>`,
    is_default: false,
  },

  // MEETING Templates
  {
    name: 'Meeting Request',
    category: 'MEETING',
    subject: 'Meeting request - {{company_name}} & Place to Stand',
    body_html: `<p>Hi {{first_name}},</p>
<p>I'd love to set up a meeting to discuss how we can help {{company_name}} achieve your goals.</p>
<p>Would any of these times work for you this week?</p>
<ul>
<li>[Option 1]</li>
<li>[Option 2]</li>
<li>[Option 3]</li>
</ul>
<p>If none of these work, please let me know your availability and I'll make it work.</p>
<p>Best,<br/>{{sender_name}}</p>`,
    is_default: true,
  },
  {
    name: 'Meeting Confirmation',
    category: 'MEETING',
    subject: 'Confirmed: Meeting on [Date] - {{company_name}}',
    body_html: `<p>Hi {{first_name}},</p>
<p>Great! I've confirmed our meeting for:</p>
<p><strong>Date:</strong> [Date]<br/>
<strong>Time:</strong> [Time]<br/>
<strong>Location/Link:</strong> [Details]</p>
<p>I'll send a calendar invite shortly. Looking forward to speaking with you!</p>
<p>Best,<br/>{{sender_name}}</p>`,
    is_default: false,
  },

  // INTRODUCTION Templates
  {
    name: 'Introduction Email',
    category: 'INTRODUCTION',
    subject: 'Introduction - {{sender_name}} from Place to Stand',
    body_html: `<p>Hi {{first_name}},</p>
<p>My name is {{sender_name}} from Place to Stand. I came across {{company_name}} and was impressed by what you're building.</p>
<p>We specialize in helping companies like yours with custom software solutions that drive growth. I'd love to learn more about your current challenges and see if there might be a fit.</p>
<p>Would you be open to a brief call to explore this?</p>
<p>Best,<br/>{{sender_name}}</p>`,
    is_default: true,
  },
  {
    name: 'Warm Introduction',
    category: 'INTRODUCTION',
    subject: '{{first_name}} - Introduction from [Mutual Connection]',
    body_html: `<p>Hi {{first_name}},</p>
<p>[Mutual Connection] suggested I reach out to you. They mentioned that {{company_name}} might be looking for help with [specific area].</p>
<p>At Place to Stand, we specialize in exactly this type of work and have helped similar companies achieve great results.</p>
<p>I'd love to learn more about what you're working on. Would you have 15 minutes for a quick call?</p>
<p>Best,<br/>{{sender_name}}</p>`,
    is_default: false,
  },
]

async function seed() {
  console.log('Seeding email templates...\n')

  for (const template of defaultTemplates) {
    // Check if template with same name already exists
    const existing = await db.execute(sql`
      SELECT id FROM email_templates
      WHERE name = ${template.name} AND deleted_at IS NULL
    `)

    if (existing.length > 0) {
      console.log(`⏭️  Skipped: ${template.name} (already exists)`)
      continue
    }

    await db.execute(sql`
      INSERT INTO email_templates (
        name,
        category,
        subject,
        body_html,
        is_default,
        created_at,
        updated_at
      )
      VALUES (
        ${template.name},
        ${template.category},
        ${template.subject},
        ${template.body_html},
        ${template.is_default},
        ${now},
        ${now}
      )
    `)

    console.log(`✅ Created: ${template.name} (${template.category})${template.is_default ? ' [DEFAULT]' : ''}`)
  }

  console.log('\nEmail template seeding complete!')
}

seed()
  .catch(err => {
    console.error('Seeding failed:', err)
    process.exit(1)
  })
  .finally(() => {
    client.end()
  })
