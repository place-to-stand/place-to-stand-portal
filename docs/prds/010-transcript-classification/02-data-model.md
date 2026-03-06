# 02: Data Model

> Part of [PRD 010: Transcript Classification & Triage](./README.md)
> Phase: **1 — Data Model**
> Dependencies: None — start here

## New Enums

```sql
CREATE TYPE transcript_source AS ENUM (
  'DRIVE_SEARCH',   -- Discovered via broad Google Drive search
  'MEET_API',       -- Fetched via Google Meet transcript API
  'GEMINI_NOTES'    -- Discovered as Gemini-generated meeting notes
);

CREATE TYPE transcript_classification AS ENUM (
  'UNCLASSIFIED',   -- Default. Not yet reviewed.
  'CLASSIFIED',     -- Reviewed and linked to a client, project, or lead.
  'DISMISSED'       -- Reviewed and determined to have no business value.
);
```

## Transcripts Table

```sql
CREATE TABLE transcripts (
  -- Identity
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,                    -- Document title / meeting title
  content         TEXT,                             -- Full transcript text
  source          transcript_source NOT NULL,       -- How we discovered this transcript

  -- Google Drive reference
  drive_file_id   TEXT,                             -- Google Drive file ID (dedup key)
  drive_file_url  TEXT,                             -- Link to original document

  -- Meeting context
  meeting_id      UUID REFERENCES meetings(id) ON DELETE SET NULL,  -- Optional link to existing meeting record
  meeting_date    TIMESTAMPTZ,                      -- When the meeting occurred
  duration_minutes INTEGER,                         -- Meeting length in minutes
  participant_names TEXT[] NOT NULL DEFAULT '{}',    -- Extracted speaker names from transcript
  participant_emails TEXT[] NOT NULL DEFAULT '{}',   -- Extracted/inferred attendee emails

  -- Classification (same model as threads)
  classification  transcript_classification NOT NULL DEFAULT 'UNCLASSIFIED',
  client_id       UUID REFERENCES clients(id) ON DELETE SET NULL,
  project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
  lead_id         UUID REFERENCES leads(id) ON DELETE SET NULL,
  classified_by   UUID REFERENCES users(id),
  classified_at   TIMESTAMPTZ,

  -- AI suggestion cache (analyze once, read forever)
  ai_suggested_client_id    UUID,                   -- Cached AI top client match
  ai_suggested_client_name  TEXT,                    -- Cached for display without join
  ai_suggested_project_id   UUID,                   -- Cached AI top project match
  ai_suggested_project_name TEXT,                    -- Cached for display without join
  ai_suggested_lead_id      UUID,                    -- Cached AI top lead match
  ai_suggested_lead_name    TEXT,                    -- Cached for display without join
  ai_confidence             NUMERIC,                 -- Overall confidence score (0-1)
  ai_analyzed_at            TIMESTAMPTZ,             -- When AI last analyzed (NULL = not yet)

  -- Metadata
  synced_by       UUID REFERENCES users(id),        -- Which user's Google connection discovered this
  created_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  deleted_at      TIMESTAMPTZ                        -- Soft delete
);
```

## Indexes

```sql
-- Dedup: unique Drive file ID among active records
CREATE UNIQUE INDEX idx_transcripts_drive_file
  ON transcripts (drive_file_id)
  WHERE deleted_at IS NULL AND drive_file_id IS NOT NULL;

-- Classification filtering (main list views)
CREATE INDEX idx_transcripts_classification
  ON transcripts (classification)
  WHERE deleted_at IS NULL;

-- Entity lookups
CREATE INDEX idx_transcripts_client
  ON transcripts (client_id)
  WHERE deleted_at IS NULL AND client_id IS NOT NULL;

CREATE INDEX idx_transcripts_project
  ON transcripts (project_id)
  WHERE deleted_at IS NULL AND project_id IS NOT NULL;

CREATE INDEX idx_transcripts_lead
  ON transcripts (lead_id)
  WHERE deleted_at IS NULL AND lead_id IS NOT NULL;

-- Recency sorting
CREATE INDEX idx_transcripts_meeting_date
  ON transcripts (meeting_date DESC NULLS LAST)
  WHERE deleted_at IS NULL;
```

All indexes are partial (`WHERE deleted_at IS NULL`), matching the codebase convention from threads and meetings tables.

## Drizzle Schema

In `lib/db/schema.ts`:

```typescript
export const transcriptSource = pgEnum('transcript_source', [
  'DRIVE_SEARCH',
  'MEET_API',
  'GEMINI_NOTES',
])

export const transcriptClassification = pgEnum('transcript_classification', [
  'UNCLASSIFIED',
  'CLASSIFIED',
  'DISMISSED',
])

export const transcripts = pgTable('transcripts', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  title: text().notNull(),
  content: text(),
  source: transcriptSource().notNull(),
  driveFileId: text('drive_file_id'),
  driveFileUrl: text('drive_file_url'),
  meetingId: uuid('meeting_id'),
  meetingDate: timestamp('meeting_date', { withTimezone: true, mode: 'string' }),
  durationMinutes: integer('duration_minutes'),
  participantNames: text('participant_names').array().default([]).notNull(),
  participantEmails: text('participant_emails').array().default([]).notNull(),
  classification: transcriptClassification().default('UNCLASSIFIED').notNull(),
  clientId: uuid('client_id'),
  projectId: uuid('project_id'),
  leadId: uuid('lead_id'),
  classifiedBy: uuid('classified_by'),
  classifiedAt: timestamp('classified_at', { withTimezone: true, mode: 'string' }),
  aiSuggestedClientId: uuid('ai_suggested_client_id'),
  aiSuggestedClientName: text('ai_suggested_client_name'),
  aiSuggestedProjectId: uuid('ai_suggested_project_id'),
  aiSuggestedProjectName: text('ai_suggested_project_name'),
  aiSuggestedLeadId: uuid('ai_suggested_lead_id'),
  aiSuggestedLeadName: text('ai_suggested_lead_name'),
  aiConfidence: numeric('ai_confidence'),
  aiAnalyzedAt: timestamp('ai_analyzed_at', { withTimezone: true, mode: 'string' }),
  syncedBy: uuid('synced_by'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .default(sql`timezone('utc'::text, now())`)
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
    .default(sql`timezone('utc'::text, now())`)
    .notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
}, table => [
  // indexes and foreign keys...
])
```

In `lib/db/relations.ts`, add relations for transcripts → clients, projects, leads, meetings, users.

## Behavioral Rules

These rules maintain the same invariants as thread classification (PRD 009, [02-data-model.md](../009-inbox-classification/02-data-model.md)).

### Auto-Classify on Link

When a user sets `clientId`, `projectId`, or `leadId` on a transcript, automatically set:
- `classification` → `CLASSIFIED`
- `classifiedBy` → current user
- `classifiedAt` → now()

**Linking IS classifying.** No separate classification step needed.

### Revert on Unlink

When a user removes a link (sets a field to NULL):
- If **no remaining links** (all three are NULL), revert `classification` → `UNCLASSIFIED` and clear `classifiedBy` / `classifiedAt`
- If at least one link remains, classification stays `CLASSIFIED`

### Dismiss Unlinks

When classifying as `DISMISSED`:
- Clear all links: set `clientId`, `projectId`, `leadId` to NULL
- Set `classification` → `DISMISSED`, `classifiedBy` → current user, `classifiedAt` → now()

### Mutual Exclusivity

Classification links are mutually exclusive between the lead track and the client track:
- Setting `leadId` → clear `clientId` and `projectId`
- Setting `clientId` → clear `leadId`
- `clientId` and `projectId` can coexist (project belongs to client)

This is enforced in the query layer (`updateTranscript()`) not via database constraints.

## Migration

Generate with: `npm run db:generate -- --name add_transcripts_table`

The migration creates the table, enums, and indexes. No backfill needed — this is a new table with no existing data.

## Implementation Checklist (Phase 1)

1. Add `transcriptSource` and `transcriptClassification` enums to `lib/db/schema.ts`
2. Add `transcripts` table definition to `lib/db/schema.ts`
3. Add relations to `lib/db/relations.ts`
4. Generate migration: `npm run db:generate -- --name add_transcripts_table`
5. Review generated SQL in `drizzle/migrations/`
6. Apply locally: `npm run db:migrate`
