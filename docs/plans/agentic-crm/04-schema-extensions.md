# Schema Extensions for Agentic CRM

## Overview

This document details the **minimal** database schema changes required to support agentic CRM capabilities. The approach leverages existing tables (`leads`, `suggestions`, `threads`, `messages`, `contacts`) rather than creating new ones.

---

## Design Principles

1. **Extend, don't duplicate** - Add columns to existing tables instead of creating parallel structures
2. **Leverage existing patterns** - The `suggestions` table already has AI audit fields (confidence, reasoning, tokens)
3. **JSONB for flexibility** - Use JSONB columns for evolving data structures (signals, metadata)
4. **Zero new tables initially** - All Phase 1-2 features can ship without new tables

---

## Existing Foundation

### Tables We Already Have

| Table | Agentic Use Case |
|-------|------------------|
| `leads` | Core lead data - extend with AI scoring |
| `suggestions` | AI-generated actions - add `leadId` link |
| `threads` | Email threads - already linked to clients/projects |
| `messages` | Individual emails with full content |
| `contacts` + `contactLeads` | Multi-stakeholder support |
| `activityLogs` | Activity timeline |
| `oauthConnections` | Gmail/Calendar OAuth |

### Existing Enums

```sql
-- Already exists
CREATE TYPE suggestion_type AS ENUM ('TASK', 'PR', 'REPLY');
CREATE TYPE suggestion_status AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'MODIFIED', 'FAILED');
CREATE TYPE lead_status AS ENUM ('NEW_OPPORTUNITIES', 'ACTIVE', 'PROPOSAL_SENT', 'ON_ICE', 'CLOSED_WON', 'CLOSED_LOST', 'CLOSED_UNQUALIFIED');
```

---

## Schema Changes

### 1. Extend `leads` Table

Add AI scoring, activity tracking, and conversion fields:

```sql
ALTER TABLE leads ADD COLUMN IF NOT EXISTS
  -- AI Scoring (0.00 - 1.00)
  overall_score NUMERIC(3,2),
  priority_tier TEXT CHECK (priority_tier IN ('hot', 'warm', 'cold', 'dormant')),
  signals JSONB DEFAULT '[]',
  last_scored_at TIMESTAMPTZ,

  -- Activity Tracking
  last_contact_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  awaiting_reply BOOLEAN DEFAULT FALSE,

  -- Predictions
  predicted_close_probability NUMERIC(3,2),
  estimated_value NUMERIC(12,2),
  expected_close_date DATE,

  -- Conversion
  converted_at TIMESTAMPTZ,
  converted_to_client_id UUID REFERENCES clients(id);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_leads_priority
  ON leads(priority_tier, overall_score DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_leads_awaiting_reply
  ON leads(awaiting_reply, last_contact_at DESC)
  WHERE deleted_at IS NULL AND awaiting_reply = TRUE;

-- Constraints
ALTER TABLE leads ADD CONSTRAINT leads_overall_score_range
  CHECK (overall_score IS NULL OR (overall_score >= 0 AND overall_score <= 1));

ALTER TABLE leads ADD CONSTRAINT leads_predicted_probability_range
  CHECK (predicted_close_probability IS NULL OR (predicted_close_probability >= 0 AND predicted_close_probability <= 1));
```

#### Signals JSONB Structure

```typescript
// Example signals array
[
  { "type": "email_opened", "timestamp": "2025-01-15T...", "weight": 0.1 },
  { "type": "replied_quickly", "timestamp": "2025-01-15T...", "weight": 0.2 },
  { "type": "multiple_stakeholders", "count": 3, "weight": 0.15 },
  { "type": "budget_mentioned", "value": 50000, "weight": 0.25 }
]
```

---

### 2. Extend `suggestions` Table

Add lead reference to enable AI-suggested actions for leads:

```sql
ALTER TABLE suggestions ADD COLUMN IF NOT EXISTS
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_suggestions_lead
  ON suggestions(lead_id)
  WHERE deleted_at IS NULL AND lead_id IS NOT NULL;
```

#### Extend Suggestion Types (Optional)

If the existing types (`TASK`, `PR`, `REPLY`) aren't sufficient:

```sql
-- Add new suggestion types for lead actions
ALTER TYPE suggestion_type ADD VALUE IF NOT EXISTS 'FOLLOW_UP';
ALTER TYPE suggestion_type ADD VALUE IF NOT EXISTS 'SEND_EMAIL';
ALTER TYPE suggestion_type ADD VALUE IF NOT EXISTS 'SCHEDULE_CALL';
ALTER TYPE suggestion_type ADD VALUE IF NOT EXISTS 'SEND_PROPOSAL';
```

#### Suggested Content Structure for Lead Actions

```typescript
// type: 'SEND_EMAIL'
{
  subject: "Following up on our conversation",
  body: "Hi {{lead_name}}, ...",
  templateId: "uuid" | null
}

// type: 'SCHEDULE_CALL'
{
  suggestedTimes: ["2025-01-20T10:00:00Z", "2025-01-21T14:00:00Z"],
  duration: 30,
  meetingType: "discovery"
}

// type: 'FOLLOW_UP'
{
  reason: "No response in 5 days",
  suggestedAction: "SEND_EMAIL",
  urgency: "medium"
}
```

---

### 3. Extend `threads` Table (If Needed)

The existing `threads` table may already have what we need. Check if these columns exist:

```sql
-- Only add if missing
ALTER TABLE threads ADD COLUMN IF NOT EXISTS
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  awaiting_reply BOOLEAN DEFAULT FALSE,
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'urgent'));

CREATE INDEX IF NOT EXISTS idx_threads_lead
  ON threads(lead_id)
  WHERE deleted_at IS NULL AND lead_id IS NOT NULL;
```

---

## Migration Order

1. Add columns to `leads` table
2. Add `lead_id` to `suggestions` table
3. Add `lead_id` to `threads` table (if not present)
4. Add enum values (if needed)
5. Create indexes

---

## Drizzle Schema Updates

### leads table additions

```typescript
// In lib/db/schema.ts - add to existing leads table definition

// AI Scoring
overallScore: numeric('overall_score', { precision: 3, scale: 2 }),
priorityTier: text('priority_tier'),
signals: jsonb('signals').default([]),
lastScoredAt: timestamp('last_scored_at', { withTimezone: true, mode: 'string' }),

// Activity Tracking
lastContactAt: timestamp('last_contact_at', { withTimezone: true, mode: 'string' }),
lastActivityAt: timestamp('last_activity_at', { withTimezone: true, mode: 'string' }),
awaitingReply: boolean('awaiting_reply').default(false),

// Predictions
predictedCloseProbability: numeric('predicted_close_probability', { precision: 3, scale: 2 }),
estimatedValue: numeric('estimated_value', { precision: 12, scale: 2 }),
expectedCloseDate: date('expected_close_date'),

// Conversion
convertedAt: timestamp('converted_at', { withTimezone: true, mode: 'string' }),
convertedToClientId: uuid('converted_to_client_id').references(() => clients.id),
```

### suggestions table addition

```typescript
// Add to existing suggestions table definition
leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
```

---

## What This Enables

### Phase 1: Lead Intelligence
- AI scoring displayed on lead cards (`overall_score`, `priority_tier`)
- Signal detection stored in `signals` JSONB
- Hot/warm/cold badges based on `priority_tier`

### Phase 2: Action Suggestions
- AI suggests follow-ups via `suggestions` table with `lead_id`
- Email drafts stored in `suggested_content` JSONB
- Approval workflow via existing `suggestion_status`

### Phase 3: Activity Tracking
- `last_contact_at` updated on email send/receive
- `awaiting_reply` flag for follow-up queues
- Timeline via existing `activityLogs`

### Phase 4: Conversion Tracking
- `converted_at` timestamp when lead becomes client
- `converted_to_client_id` links to new client record

---

## Future Considerations

If/when you need dedicated tables:

| Feature | When to Add Dedicated Table |
|---------|----------------------------|
| **Meetings** | When building Calendar integration (Google Meet links, transcripts, prep briefs) |
| **Email Templates** | When you have 10+ reusable templates to manage |
| **AI Agent Logs** | When you need detailed cost tracking across multiple AI operations |
| **Autonomy Settings** | When you implement per-user AI autonomy levels |

These can be added incrementally without disrupting the core agentic features.

---

## Summary

| Metric | Original Plan | Minimal Plan |
|--------|---------------|--------------|
| New tables | 10 | **0** |
| New enums | 8 | **0-3 values** |
| Schema changes | ~700 lines | **~15 columns** |
| Migration risk | High | **Low** |

---

*See also: [Vision & Architecture](./01-vision-architecture.md), [Implementation Roadmap](./05-implementation-roadmap.md)*
