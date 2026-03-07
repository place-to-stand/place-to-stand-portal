# 01: Overview

> Part of [PRD 010: Transcript Classification & Triage](./README.md)

## Problem Statement

Meeting transcripts contain the richest context in the business — clarifications, decisions, scope discussions, action items, relationship signals. Every meeting at Place to Stand is recorded and transcribed, generating a Gemini Notes document in Google Drive. But these transcripts are trapped:

1. **They live scattered in Google Drive** with no connection to clients, projects, or leads in the portal
2. **The only integration is lead-specific** — Damon built auto-linking "suggestions" (LINK_EMAIL_THREAD, LINK_TRANSCRIPT) that appear when generating lead suggestions, but these are opaque, unreliable, and only work for leads
3. **No way to link transcripts to client projects** — the most common use case (an ongoing project meeting) has no classification path at all
4. **When an AI worker picks up a task**, it lacks the conversation context from meetings that led to the task

Meanwhile, the email classification system (PRD 009) proved the pattern: ingest, suggest, let humans confirm. We should extend this to transcripts.

## Strategic Shift

Transcripts become the **second source** in the context intake engine. The email classification system established:

- **Ingestion** → Gmail sync populates threads/messages
- **Classification** → UNCLASSIFIED / CLASSIFIED / DISMISSED
- **Triage** → AI suggests, human confirms or overrides
- **Context payoff** → classified threads surface on tasks, projects, leads

Transcripts follow the same model:

- **Ingestion** → Google Drive sync discovers transcript documents
- **Classification** → same three states, same linking to client/project/lead
- **Triage** → AI analyzes transcript content and suggests matches
- **Context payoff** → classified transcripts surface alongside emails

## Design Principles

### No Magic

Same principle as PRD 009. All classification is **explicit and user-approved**. The system suggests, the user confirms. The existing lead auto-linking is removed precisely because it was "magic" — creating invisible state changes that were hard to trust.

### Global Access

Unlike emails (which are per-user inbox data), transcripts are **shared across all admins**. Rationale:

- Only 3 owners at the agency — no sensitivity or access control needed
- Meeting transcripts are inherently shared context (everyone was in the meeting)
- Classification should happen once, not redundantly per user
- One user's Google Drive sync discovers transcripts; all users can see and classify them

### Cache AI Results

AI classification is expensive. The system analyzes each transcript **once** and caches the result in the record itself (`aiSuggested*` fields). Subsequent page loads read the cached suggestion without burning tokens. A "Re-analyze" option exists for when context changes (e.g., a new client was added).

### Broad Discovery

Rather than depending on existing meeting records or conferenceIds (which requires meetings to be scheduled through the portal), we search Google Drive directly for transcript-shaped documents. This catches:

- Meetings scheduled outside the portal
- Ad-hoc meetings with external parties
- Meetings with participants who aren't in the system
- Gemini Notes that were created automatically

## Scope

**This PRD covers:**

- New `transcripts` table with classification and AI cache fields
- Google Drive broad search for transcript/meeting notes documents
- Sync orchestration (cron + manual trigger) with dedup by Drive file ID
- New "Transcripts" tab in the inbox alongside Triage and Emails
- AI classification adapted from email classification, with result caching
- Removal of lead auto-linking (LINK_EMAIL_THREAD, LINK_TRANSCRIPT suggestions)
- Classification behavioral invariants (same as threads)
- Context surfacing: classified transcripts appear on client detail pages and lead sheets
- Aligning email classification to include leads in a single prompt (matching transcript flow)

**This PRD does NOT cover:**

- Calendar-based discovery (syncing all Google Calendar events to find conferenceIds)
- Task suggestion generation from transcript content
- Full-text search across transcripts
- Transcript-to-email thread correlation
- Participant email resolution (mapping speaker names to contacts)
- AI meeting summary generation
- Changes to the existing email triage flow

## Relationship to PRD 009

PRD 009's [future enhancements](../009-inbox-classification/08-future-enhancements.md) outlined "Meeting Transcript Ingestion" as adding `MEETING` to the thread `messageSource` enum and making transcripts messages within threads.

**We deviate from that approach.** Instead of shoehorning transcripts into the threads/messages model, we create a dedicated `transcripts` table. The reasons:

1. Transcripts have different metadata (participants, duration, meeting date) vs email fields (from/to/cc, subject, isInbound)
2. Transcripts are global; threads are per-user
3. The threads model carries significant email-specific logic (Gmail sync state, external message IDs, read/unread) that doesn't apply
4. A clean table is easier to reason about and avoids unintended coupling

The classification concept, behavioral invariants, and UI patterns are shared between emails and transcripts. They just operate on different tables.
