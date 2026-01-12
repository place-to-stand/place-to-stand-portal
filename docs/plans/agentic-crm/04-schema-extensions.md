# Schema Extensions for Agentic CRM

## Overview

This document details the database schema additions required to support the agentic CRM capabilities. These extensions build on the existing `leads` table and add intelligence, actions, communication tracking, and relationship management.

---

## Existing Foundation

### Current Leads Table

```sql
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  website TEXT,
  phone TEXT,
  notes TEXT,
  status lead_status NOT NULL DEFAULT 'new_opportunities',
  source lead_source NOT NULL DEFAULT 'website',
  source_detail TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
```

### Current Status Enum

```sql
CREATE TYPE lead_status AS ENUM (
  'new_opportunities',
  'active',
  'proposal_sent',
  'on_ice',
  'closed_won',
  'closed_lost',
  'closed_unqualified'
);
```

---

## New Tables

### 1. Lead Intelligence

AI-computed scores and signals for each lead.

```sql
CREATE TABLE lead_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

  -- Composite Scores (0.00 - 1.00)
  engagement_score NUMERIC(3,2) DEFAULT 0,
  fit_score NUMERIC(3,2) DEFAULT 0,
  intent_score NUMERIC(3,2) DEFAULT 0,
  momentum_score NUMERIC(3,2) DEFAULT 0,
  overall_score NUMERIC(3,2) DEFAULT 0,

  -- Predictions
  predicted_close_probability NUMERIC(3,2),
  predicted_close_date DATE,
  predicted_deal_value NUMERIC(12,2),

  -- Classification
  priority_tier TEXT CHECK (priority_tier IN ('hot', 'warm', 'cold', 'dormant')),
  recommended_next_action TEXT,

  -- Signals (JSONB for flexibility)
  signals JSONB DEFAULT '[]',
  -- Example: [
  --   {"type": "email_opened", "timestamp": "...", "weight": 0.1},
  --   {"type": "multiple_stakeholders", "timestamp": "...", "weight": 0.2}
  -- ]

  -- Metadata
  last_computed_at TIMESTAMPTZ DEFAULT NOW(),
  model_version TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT lead_intelligence_engagement_range CHECK (engagement_score >= 0 AND engagement_score <= 1),
  CONSTRAINT lead_intelligence_fit_range CHECK (fit_score >= 0 AND fit_score <= 1),
  CONSTRAINT lead_intelligence_intent_range CHECK (intent_score >= 0 AND intent_score <= 1),
  CONSTRAINT lead_intelligence_momentum_range CHECK (momentum_score >= 0 AND momentum_score <= 1),
  CONSTRAINT lead_intelligence_overall_range CHECK (overall_score >= 0 AND overall_score <= 1)
);

CREATE UNIQUE INDEX idx_lead_intelligence_lead_id ON lead_intelligence(lead_id);
CREATE INDEX idx_lead_intelligence_priority ON lead_intelligence(priority_tier, overall_score DESC);
CREATE INDEX idx_lead_intelligence_scores ON lead_intelligence(overall_score DESC, momentum_score DESC);
```

### 2. Lead Actions

Suggested and completed actions for leads.

```sql
CREATE TYPE lead_action_type AS ENUM (
  'send_email',
  'schedule_call',
  'send_proposal',
  'follow_up',
  'research',
  'internal_discussion',
  'send_contract',
  'custom'
);

CREATE TYPE lead_action_status AS ENUM (
  'suggested',
  'approved',
  'in_progress',
  'completed',
  'dismissed',
  'expired'
);

CREATE TABLE lead_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

  -- Action Details
  action_type lead_action_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,

  -- AI Generation
  ai_generated BOOLEAN DEFAULT FALSE,
  ai_reasoning TEXT,
  ai_confidence NUMERIC(3,2),

  -- Status Tracking
  status lead_action_status NOT NULL DEFAULT 'suggested',
  priority INTEGER DEFAULT 0,
  due_date TIMESTAMPTZ,

  -- Execution
  assigned_to UUID REFERENCES users(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  outcome TEXT,

  -- Draft Content (for email actions)
  draft_content JSONB,
  -- Example: {"subject": "...", "body": "...", "to": [...]}

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT lead_actions_confidence_range CHECK (ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 1))
);

CREATE INDEX idx_lead_actions_lead_id ON lead_actions(lead_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_lead_actions_status ON lead_actions(status, priority DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_lead_actions_assigned ON lead_actions(assigned_to, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_lead_actions_due ON lead_actions(due_date) WHERE status IN ('suggested', 'approved', 'in_progress') AND deleted_at IS NULL;
```

### 3. Lead Timeline

Unified activity feed for each lead.

```sql
CREATE TYPE lead_timeline_event_type AS ENUM (
  -- Email Events
  'email_received',
  'email_sent',
  'email_opened',
  'email_clicked',
  'email_replied',
  'email_bounced',

  -- Meeting Events
  'meeting_scheduled',
  'meeting_completed',
  'meeting_cancelled',
  'meeting_no_show',

  -- Status Events
  'status_changed',
  'score_updated',
  'priority_changed',

  -- Document Events
  'proposal_sent',
  'proposal_viewed',
  'contract_sent',
  'contract_signed',

  -- Other
  'note_added',
  'call_completed',
  'form_submitted',
  'website_visit',
  'custom'
);

CREATE TABLE lead_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

  -- Event Details
  event_type lead_timeline_event_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  -- Examples:
  -- email_sent: {"message_id": "...", "subject": "...", "to": [...]}
  -- meeting_completed: {"meeting_id": "...", "duration_minutes": 30, "attendees": [...]}
  -- status_changed: {"from": "active", "to": "proposal_sent"}

  -- Actor
  actor_type TEXT CHECK (actor_type IN ('user', 'system', 'ai', 'external')),
  actor_id UUID, -- User ID if actor_type = 'user'

  -- Relationships
  email_id UUID, -- References sent_emails or linked thread
  meeting_id UUID, -- References lead_meetings
  action_id UUID REFERENCES lead_actions(id),

  -- Importance
  is_highlight BOOLEAN DEFAULT FALSE, -- Show prominently in timeline

  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lead_timeline_lead_id ON lead_timeline(lead_id, occurred_at DESC);
CREATE INDEX idx_lead_timeline_event_type ON lead_timeline(event_type, occurred_at DESC);
CREATE INDEX idx_lead_timeline_highlights ON lead_timeline(lead_id, occurred_at DESC) WHERE is_highlight = TRUE;
```

### 4. Lead Email Threads

Links Gmail threads to leads.

```sql
CREATE TABLE lead_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

  -- Gmail References
  gmail_thread_id TEXT NOT NULL,
  gmail_account_id UUID NOT NULL, -- Which connected account

  -- Thread Summary
  subject TEXT,
  snippet TEXT,
  message_count INTEGER DEFAULT 0,

  -- Participants
  participants JSONB DEFAULT '[]',
  -- Example: [{"email": "...", "name": "...", "role": "lead|team|cc"}]

  -- Status
  last_message_at TIMESTAMPTZ,
  last_message_from TEXT, -- 'lead' or 'team'
  awaiting_reply BOOLEAN DEFAULT FALSE,

  -- AI Analysis
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'urgent')),
  topics JSONB DEFAULT '[]',
  action_items JSONB DEFAULT '[]',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT lead_threads_unique UNIQUE (lead_id, gmail_thread_id)
);

CREATE INDEX idx_lead_threads_lead_id ON lead_threads(lead_id);
CREATE INDEX idx_lead_threads_gmail ON lead_threads(gmail_thread_id);
CREATE INDEX idx_lead_threads_awaiting ON lead_threads(awaiting_reply, last_message_at DESC) WHERE awaiting_reply = TRUE;
```

### 5. Lead Meetings

Tracks meetings with leads (Google Calendar + Meet).

```sql
CREATE TYPE meeting_status AS ENUM (
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
  'rescheduled'
);

CREATE TABLE lead_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

  -- Calendar Integration
  google_event_id TEXT,
  google_calendar_id TEXT,
  google_meet_link TEXT,

  -- Meeting Details
  title TEXT NOT NULL,
  description TEXT,
  meeting_type TEXT, -- 'discovery', 'proposal', 'technical', 'kickoff', etc.

  -- Timing
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ NOT NULL,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,

  -- Participants
  organizer_id UUID REFERENCES users(id),
  attendees JSONB DEFAULT '[]',
  -- Example: [{"email": "...", "name": "...", "response": "accepted|declined|tentative"}]

  -- Status
  status meeting_status NOT NULL DEFAULT 'scheduled',

  -- Recording & Transcript
  recording_url TEXT,
  transcript_url TEXT,
  transcript_processed BOOLEAN DEFAULT FALSE,

  -- AI-Generated Content
  prep_brief JSONB, -- Pre-meeting context
  summary TEXT, -- Post-meeting summary
  action_items JSONB DEFAULT '[]',
  key_decisions JSONB DEFAULT '[]',
  sentiment_analysis JSONB,

  -- Notes
  internal_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_lead_meetings_lead_id ON lead_meetings(lead_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_lead_meetings_scheduled ON lead_meetings(scheduled_start) WHERE status = 'scheduled' AND deleted_at IS NULL;
CREATE INDEX idx_lead_meetings_google ON lead_meetings(google_event_id) WHERE google_event_id IS NOT NULL;
```

### 6. Sent Emails

Tracks outbound emails sent through the portal.

```sql
CREATE TABLE sent_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,

  -- Gmail References
  gmail_message_id TEXT,
  gmail_thread_id TEXT,
  gmail_account_id UUID NOT NULL,

  -- Email Content
  from_email TEXT NOT NULL,
  to_emails JSONB NOT NULL, -- ["email1", "email2"]
  cc_emails JSONB DEFAULT '[]',
  bcc_emails JSONB DEFAULT '[]',
  subject TEXT NOT NULL,
  body_html TEXT,
  body_text TEXT,

  -- Attachments
  attachments JSONB DEFAULT '[]',
  -- Example: [{"filename": "...", "mime_type": "...", "size": 1234, "drive_file_id": "..."}]

  -- Template
  template_id UUID REFERENCES email_templates(id),
  template_variables JSONB,

  -- AI Generation
  ai_generated BOOLEAN DEFAULT FALSE,
  ai_prompt TEXT, -- What was asked of the AI
  human_edited BOOLEAN DEFAULT FALSE,

  -- Tracking
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,

  -- Sender
  sent_by UUID NOT NULL REFERENCES users(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sent_emails_lead ON sent_emails(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX idx_sent_emails_client ON sent_emails(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX idx_sent_emails_project ON sent_emails(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_sent_emails_gmail ON sent_emails(gmail_message_id);
CREATE INDEX idx_sent_emails_sent_at ON sent_emails(sent_at DESC);
```

### 7. Email Templates

Reusable email templates with variable substitution.

```sql
CREATE TYPE email_template_category AS ENUM (
  'lead_outreach',
  'lead_follow_up',
  'proposal',
  'meeting_request',
  'meeting_follow_up',
  'client_update',
  'invoice',
  'general'
);

CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Template Info
  name TEXT NOT NULL,
  description TEXT,
  category email_template_category NOT NULL,

  -- Content
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,

  -- Variables (for UI display)
  available_variables JSONB DEFAULT '[]',
  -- Example: ["lead_name", "company_name", "sender_name", "meeting_link"]

  -- Usage
  is_active BOOLEAN DEFAULT TRUE,
  use_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Ownership
  created_by UUID REFERENCES users(id),
  is_shared BOOLEAN DEFAULT TRUE, -- Visible to all team members

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_email_templates_category ON email_templates(category) WHERE is_active = TRUE AND deleted_at IS NULL;
CREATE INDEX idx_email_templates_shared ON email_templates(is_shared) WHERE is_active = TRUE AND deleted_at IS NULL;
```

### 8. Lead Contacts

Multiple contacts per lead (for multi-stakeholder deals).

```sql
CREATE TYPE lead_contact_role AS ENUM (
  'primary',
  'decision_maker',
  'influencer',
  'technical',
  'financial',
  'end_user',
  'other'
);

CREATE TABLE lead_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

  -- Contact Info
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  title TEXT,

  -- Role
  role lead_contact_role NOT NULL DEFAULT 'primary',
  is_primary BOOLEAN DEFAULT FALSE,

  -- LinkedIn / Social
  linkedin_url TEXT,

  -- Google Contacts Sync
  google_contact_id TEXT,

  -- Notes
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_lead_contacts_lead_id ON lead_contacts(lead_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_lead_contacts_email ON lead_contacts(email) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_lead_contacts_primary ON lead_contacts(lead_id) WHERE is_primary = TRUE AND deleted_at IS NULL;
```

### 9. AI Agent Logs

Audit trail for AI agent actions.

```sql
CREATE TYPE ai_agent_type AS ENUM (
  'lead_scorer',
  'action_suggester',
  'email_drafter',
  'meeting_summarizer',
  'thread_analyzer',
  'status_advisor'
);

CREATE TABLE ai_agent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Agent Info
  agent_type ai_agent_type NOT NULL,
  agent_version TEXT,

  -- Context
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,

  -- Input/Output
  input_context JSONB NOT NULL,
  output_result JSONB NOT NULL,

  -- Model Info
  model_name TEXT NOT NULL, -- 'gpt-4', 'claude-3-opus', etc.
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_cost NUMERIC(10,6), -- In dollars

  -- Performance
  latency_ms INTEGER,

  -- User Interaction
  was_accepted BOOLEAN, -- Did user accept the suggestion?
  user_feedback TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_agent_logs_lead ON ai_agent_logs(lead_id, created_at DESC) WHERE lead_id IS NOT NULL;
CREATE INDEX idx_ai_agent_logs_agent ON ai_agent_logs(agent_type, created_at DESC);
CREATE INDEX idx_ai_agent_logs_created ON ai_agent_logs(created_at DESC);
```

### 10. Autonomy Settings

Per-user/per-action autonomy level configuration.

```sql
CREATE TYPE autonomy_level AS ENUM (
  'off',           -- AI doesn't perform this action
  'suggest',       -- AI suggests, human must approve
  'auto_draft',    -- AI creates draft, human reviews before send
  'auto_execute'   -- AI executes automatically
);

CREATE TABLE autonomy_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Action Type
  action_category TEXT NOT NULL, -- 'email', 'meeting', 'status', 'scoring'
  action_type TEXT NOT NULL,     -- 'follow_up', 'initial_outreach', 'schedule', etc.

  -- Settings
  autonomy_level autonomy_level NOT NULL DEFAULT 'suggest',

  -- Constraints
  max_daily_actions INTEGER, -- Rate limit
  require_approval_above_value NUMERIC(12,2), -- Dollar threshold

  -- Scope
  applies_to_leads BOOLEAN DEFAULT TRUE,
  applies_to_clients BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT autonomy_settings_unique UNIQUE (user_id, action_category, action_type)
);

CREATE INDEX idx_autonomy_settings_user ON autonomy_settings(user_id);
```

---

## Leads Table Extensions

Add these columns to the existing `leads` table:

```sql
ALTER TABLE leads ADD COLUMN IF NOT EXISTS
  -- Estimated Value
  estimated_value NUMERIC(12,2),
  estimated_value_currency TEXT DEFAULT 'USD',

  -- Timing
  expected_close_date DATE,
  first_contact_at TIMESTAMPTZ,
  last_contact_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,

  -- Classification
  industry TEXT,
  company_size TEXT, -- 'solo', 'small', 'medium', 'enterprise'
  project_type TEXT, -- 'web_app', 'mobile', 'consulting', etc.

  -- Assignment
  assigned_to UUID REFERENCES users(id),

  -- Conversion
  converted_at TIMESTAMPTZ,
  converted_to_client_id UUID REFERENCES clients(id);
```

---

## Index Summary

| Table | Index Purpose |
|-------|---------------|
| `lead_intelligence` | Priority-based queries, score-based sorting |
| `lead_actions` | Status-based queues, due date ordering |
| `lead_timeline` | Chronological feed, highlight extraction |
| `lead_threads` | Gmail thread lookup, awaiting reply queries |
| `lead_meetings` | Scheduled meeting queries, calendar sync |
| `sent_emails` | Entity-based lookup, tracking queries |
| `email_templates` | Category filtering, active templates |
| `lead_contacts` | Lead lookup, email-based search |
| `ai_agent_logs` | Agent type analysis, audit trail |
| `autonomy_settings` | User preference lookup |

---

## Migration Order

Due to foreign key dependencies, tables should be created in this order:

1. Enums (all `CREATE TYPE` statements)
2. `email_templates` (no foreign keys)
3. `lead_intelligence` (depends on `leads`)
4. `lead_actions` (depends on `leads`, `users`)
5. `lead_contacts` (depends on `leads`)
6. `lead_meetings` (depends on `leads`, `users`)
7. `lead_threads` (depends on `leads`)
8. `sent_emails` (depends on `leads`, `clients`, `projects`, `users`, `email_templates`)
9. `lead_timeline` (depends on `leads`, `lead_actions`)
10. `ai_agent_logs` (depends on `leads`, `clients`, `projects`)
11. `autonomy_settings` (depends on `users`)
12. `leads` table alterations

---

## Drizzle Schema Example

```typescript
// lib/db/schema.ts additions

export const leadIntelligence = pgTable('lead_intelligence', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),

  engagementScore: numeric('engagement_score', { precision: 3, scale: 2 }).default('0'),
  fitScore: numeric('fit_score', { precision: 3, scale: 2 }).default('0'),
  intentScore: numeric('intent_score', { precision: 3, scale: 2 }).default('0'),
  momentumScore: numeric('momentum_score', { precision: 3, scale: 2 }).default('0'),
  overallScore: numeric('overall_score', { precision: 3, scale: 2 }).default('0'),

  predictedCloseProbability: numeric('predicted_close_probability', { precision: 3, scale: 2 }),
  predictedCloseDate: date('predicted_close_date'),
  predictedDealValue: numeric('predicted_deal_value', { precision: 12, scale: 2 }),

  priorityTier: text('priority_tier'),
  recommendedNextAction: text('recommended_next_action'),
  signals: jsonb('signals').default([]),

  lastComputedAt: timestamp('last_computed_at', { withTimezone: true }).defaultNow(),
  modelVersion: text('model_version'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_lead_intelligence_lead_id').on(table.leadId),
  index('idx_lead_intelligence_priority').on(table.priorityTier, table.overallScore),
]);
```

---

*See also: [Vision & Architecture](./01-vision-architecture.md), [Implementation Roadmap](./05-implementation-roadmap.md)*
