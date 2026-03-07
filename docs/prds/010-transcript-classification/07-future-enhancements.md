# 07: Future Enhancements

> Part of [PRD 010: Transcript Classification & Triage](./README.md)
> Status: **Not in scope for v1** — deferred but architecture supports them

## Meeting Record Linking

Add a `meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL` column to the `transcripts` table, enabling a direct FK from a transcript to an existing meeting record. This was deferred from v1 because the Drive search discovery method has no logic to correlate a discovered document back to a known meeting. This becomes useful when calendar-based discovery is implemented (below), or when meeting records gain a `driveFileId` that can be matched during sync.

## `MEET_API` Source Enum Value

Add `MEET_API` to the `transcript_source` enum for transcripts fetched directly via the Google Meet Transcript API (using `conferenceId` → `conferenceRecords` → `transcripts` → `entries`). This path requires a known `conferenceId` from a meeting record, making it dependent on calendar-based discovery or the existing leads-meeting flow.

## Calendar-Based Discovery

Sync all Google Calendar events (not just lead meetings), extract conferenceIds, and automatically create meeting + transcript records. This would:

- Catch meetings before they happen (pre-create records with PENDING transcript status)
- Associate calendar attendee emails with transcript participant names
- Enable duration and attendee data from calendar metadata
- Complement the Drive search approach (calendar = scheduled meetings, Drive = everything else)

## Task Suggestion Generation from Transcripts

Apply the existing task suggestion pipeline (currently email-only) to transcript content. When a transcript is classified to a project, scan for:

- Action items ("I'll send that by Friday")
- Decisions ("We agreed to go with option B")
- Follow-ups ("Let's schedule another call next week")
- Blockers ("We're waiting on the API documentation")

## Full-Text Search Across Transcripts

Add PostgreSQL full-text search index on `transcripts.content` to enable searching across all transcript content. This would support:

- Finding specific discussions across meetings
- Searching for when a topic was discussed
- Cross-referencing transcript mentions with task descriptions

## Transcript-to-Email Correlation

Automatically link transcripts to related email threads based on:

- Participant overlap (transcript speakers match email participants)
- Temporal proximity (meeting happened around the same time as an email exchange)
- Content similarity (similar topics discussed)

## Participant Email Resolution

Map speaker names extracted from transcripts to actual user/contact records:

- Match "Jason" → jason@placetostandagency.com
- Match "Jane" → jane@acme.co (via contacts table)
- Build a learning dictionary from confirmed mappings
- Use resolved emails for better AI classification (email-based matching)

## AI Meeting Summaries

Generate concise meeting summaries from transcript content:

- Key decisions made
- Action items assigned
- Topics discussed
- Next steps agreed upon

These summaries could be displayed on project dashboards and task detail views.

## Unified Triage Queue

Merge the email triage queue and transcript triage into a single unified queue, sorted by recency. This would:

- Show all unclassified communications in one stream
- Display source icons (email, transcript, chat) for each item
- Use the same keyboard shortcuts for classification
- Reduce context-switching between tabs

## Auto-Classification from Participant Matching

Once participant email resolution is reliable, auto-suggest classifications based on:

- Known client contacts in the meeting → suggest that client
- Known lead contacts → suggest that lead
- All-internal participants → suggest internal project
- Match confidence determines whether to auto-classify or suggest

## Transcript Segment Classification

A single meeting transcript may cover multiple clients/projects (e.g., a weekly sync discussing 3 accounts). V1 forces whole-transcript classification to one entity. Future: segment transcripts by topic (using AI or speaker-turn analysis) and classify segments independently. Each segment would link to a different client/project while the parent transcript remains a single record.

## Project Detail Transcript Surfacing

V1 surfaces transcripts on client pages and lead sheets but not on project detail pages (since emails aren't surfaced there yet either). Future: add a "Communications" section to project detail pages showing both classified emails and transcripts, establishing the pattern for full context surfacing at the project level.

## Activity Logging for Classification

Add activity events for transcript and email classification actions (`logTranscriptClassified`, `logTranscriptDismissed`, `logEmailClassified`, etc.). Deferred from v1 because email classification doesn't log activity events today — both flows should be instrumented together in a future pass.

## Transcript Change Detection

Monitor Google Drive for changes to transcript documents after initial sync:

- Gemini may update notes after initial generation
- Users may manually edit transcript docs
- Detect changes via Drive API `changes.list()` or `modifiedTime` comparison
- Update stored content and optionally re-run AI analysis
