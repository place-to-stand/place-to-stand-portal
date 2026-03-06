# 05: AI Classification & Caching

> Part of [PRD 010: Transcript Classification & Triage](./README.md)
> Phase: **4 — AI Classification**
> Dependencies: [02-data-model.md](./02-data-model.md) (transcripts table must exist)

## Overview

AI classification for transcripts follows the same pattern as email classification, adapted for transcript-specific context. The critical difference: **results are cached in the transcript record itself**, so AI tokens are only burned once per transcript.

## Classification Function

**New file:** `lib/ai/transcript-classification.ts`

Adapted from `lib/ai/email-classification-matching.ts:classifyEmailThread()`.

```typescript
export type TranscriptClassificationResult = {
  clientMatches: Array<{
    clientId: string
    clientName: string
    projectId?: string
    projectName?: string
    confidence: number  // 0-1
    reasoning: string
  }>
  leadMatches: Array<{
    leadId: string
    leadName: string
    companyName?: string
    confidence: number
    reasoning: string
  }>
}

export async function classifyTranscript(params: {
  title: string
  participantNames: string[]
  contentSnippet: string    // First ~2000 chars of transcript
  clients: Array<{ id: string; name: string }>
  projects: Array<{ id: string; name: string; clientId: string; clientName: string }>
  leads: Array<{ id: string; contactName: string; companyName: string | null }>
}): Promise<TranscriptClassificationResult>
```

### Model & Prompt

- **Model**: `google/gemini-3-flash` via AI Gateway (same as email classification)
- **Structured output**: Zod schema for response validation (same pattern as `emailClassifyResponseSchema`)
- **Confidence threshold**: filter results with confidence >= 0.4 (same as email)

**System prompt** (adapted from `EMAIL_CLASSIFY_SYSTEM_PROMPT`):

```
You are a meeting transcript classifier for a digital agency. Given a meeting
transcript title, participant names, and content snippet, determine which client,
project, or lead this meeting relates to.

Consider:
- Participant names that match client contacts or lead names
- Project names, client names, or company names mentioned in the transcript
- The nature of the discussion (project updates, discovery calls, internal planning)
- Internal meetings (no external participants) may relate to internal projects

Return ranked matches with confidence scores and reasoning.
```

**User prompt** includes:
- Transcript title
- Participant names (comma-separated)
- Content snippet (first ~2000 chars)
- Available clients list (id, name)
- Available projects list (id, name, clientName)
- Available leads list (id, contactName, companyName)

### Differences from Email Classification

| Aspect | Email | Transcript |
|--------|-------|------------|
| Input signal | From/To/CC emails, subject, snippet | Title, participant names, content snippet |
| Matching basis | Email addresses → contacts | Names + content mentions → entities |
| Content length | Short snippet | ~2000 char excerpt from potentially long transcript |

> **Decision:** Both email and transcript classification include leads directly in a single AI prompt (alongside clients/projects). The existing email classification currently uses a separate `suggestLeadMatch()` step — this should be updated to include leads in the main `classifyEmailThread()` prompt as part of this PRD, aligning both flows. **This is Phase 4b** — a separate sub-task from transcript classification (Phase 4a) because it refactors production email triage. Test email classification independently before and after.

### Known Accuracy Limitations

Transcript AI confidence scores will likely be **lower on average** than email scores. Email classification matches on email addresses (deterministic — `jane@acme.co` maps to a known contact). Transcript classification matches on participant *names* ("Jane") which are ambiguous — "Sarah" could be from Client A or Client B.

This is a known tradeoff accepted for v1. Accuracy improves significantly with [Participant Email Resolution](./07-future-enhancements.md) (future enhancement).

### Single-Classification Constraint

A weekly sync meeting might cover 3 client projects in 30 minutes. The current model forces classifying the entire transcript to one entity. This matches the email model (one thread → one classification) and is pragmatically sufficient for v1. Future enhancement: segment transcripts by topic/section and classify segments independently.

## AI Suggestion Caching

The key optimization: AI results are stored directly on the transcript record, not in a separate cache or suggestions table.

### Cache Fields on Transcript Record

```
ai_suggested_client_id    — Top AI client match ID
ai_suggested_client_name  — Cached display name (avoids join)
ai_suggested_project_id   — Top AI project match ID
ai_suggested_project_name — Cached display name
ai_suggested_lead_id      — Top AI lead match ID
ai_suggested_lead_name    — Cached display name
ai_confidence             — Confidence of top match (0-1)
ai_analyzed_at            — When analysis ran (NULL = not yet analyzed)
```

### Cache Key: `ai_analyzed_at`

- **NULL** → transcript has never been analyzed. AI call needed.
- **Non-NULL** → transcript has been analyzed. Return cached fields. No AI call.

### Re-Analysis

If a user wants to re-analyze (e.g., after adding a new client):
- Clear `ai_analyzed_at` to NULL
- Clear all `ai_suggested_*` fields
- Next analyze call will re-run the AI

## Analyze Endpoint

**New file:** `app/api/transcripts/[transcriptId]/analyze/route.ts`

> **Decision:** Analyze uses POST (side-effecting: runs AI, writes to DB). A separate GET returns cached results only. This follows HTTP semantics and avoids prefetch/caching issues with side-effecting GETs.

### GET — Read Cached Analysis

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ transcriptId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()
  assertAdmin(user)

  const { transcriptId } = await params
  const transcript = await getTranscriptById(transcriptId)
  if (!transcript) return notFound()

  // Return cached analysis (or null if not yet analyzed)
  return NextResponse.json({
    ok: true,
    analyzed: !!transcript.aiAnalyzedAt,
    suggestion: transcript.aiAnalyzedAt ? {
      clientId: transcript.aiSuggestedClientId,
      clientName: transcript.aiSuggestedClientName,
      projectId: transcript.aiSuggestedProjectId,
      projectName: transcript.aiSuggestedProjectName,
      leadId: transcript.aiSuggestedLeadId,
      leadName: transcript.aiSuggestedLeadName,
      confidence: transcript.aiConfidence,
      analyzedAt: transcript.aiAnalyzedAt,
    } : null,
  })
}
```

### POST — Run AI Analysis (or Re-Analyze)

```typescript
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ transcriptId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()
  assertAdmin(user)

  const { transcriptId } = await params
  const transcript = await getTranscriptById(transcriptId)
  if (!transcript) return notFound()

  // Optionally check { force: true } in body to re-analyze
  const body = await request.json().catch(() => ({}))
  const force = body.force === true

  // Cache hit (and not forced): return existing analysis
  if (transcript.aiAnalyzedAt && !force) {
    return NextResponse.json({
      ok: true,
      cached: true,
      suggestion: {
        clientId: transcript.aiSuggestedClientId,
        clientName: transcript.aiSuggestedClientName,
        projectId: transcript.aiSuggestedProjectId,
        projectName: transcript.aiSuggestedProjectName,
        leadId: transcript.aiSuggestedLeadId,
        leadName: transcript.aiSuggestedLeadName,
        confidence: transcript.aiConfidence,
        analyzedAt: transcript.aiAnalyzedAt,
      },
    })
  }

  // Run AI classification
  const [clients, projects, leads] = await Promise.all([
    fetchActiveClients(),
    fetchActiveProjectsWithClient(),
    fetchActiveLeads(),
  ])

  const result = await classifyTranscript({
    title: transcript.title,
    participantNames: transcript.participantNames,
    contentSnippet: (transcript.content ?? '').slice(0, 2000),
    clients,
    projects,
    leads,
  })

  // Store top match in cache fields — pick the highest-confidence match overall
  const topClient = result.clientMatches[0]
  const topLead = result.leadMatches[0]
  const topConfidence = Math.max(topClient?.confidence ?? 0, topLead?.confidence ?? 0) || null

  await updateTranscript(transcriptId, {
    aiSuggestedClientId: topClient?.clientId ?? null,
    aiSuggestedClientName: topClient?.clientName ?? null,
    aiSuggestedProjectId: topClient?.projectId ?? null,
    aiSuggestedProjectName: topClient?.projectName ?? null,
    aiSuggestedLeadId: topLead?.leadId ?? null,
    aiSuggestedLeadName: topLead?.leadName ?? null,
    aiConfidence: topConfidence,
    aiAnalyzedAt: new Date().toISOString(),
  })

  return NextResponse.json({
    ok: true,
    cached: false,
    suggestion: { /* same shape as above with fresh values */ },
    // Also return full ranked matches for the UI
    clientMatches: result.clientMatches,
    leadMatches: result.leadMatches,
  })
}
```

To re-analyze, call POST with `{ force: true }`. This clears the cache inline and runs fresh analysis in a single request.

## UI Integration

### Transcript Row

The transcript row component reads cached AI suggestions directly from the transcript record (no API call needed for display):

```typescript
// If aiAnalyzedAt is set, show the cached suggestion
if (transcript.aiAnalyzedAt) {
  if (transcript.aiSuggestedClientName) {
    // Show: "AI: Acme Corp → Website Redesign (85%)"
  } else if (transcript.aiSuggestedLeadName) {
    // Show: "AI: Lead → Jane Doe (72%)"
  }
}
```

### Analyze Button

Most transcripts arrive pre-analyzed (auto-analyze on sync — see [03-drive-sync.md](./03-drive-sync.md)). For the rare case where `aiAnalyzedAt` is NULL (sync-time analysis failed, or transcript was created before auto-analyze was enabled), show an "Analyze" button that calls `POST /api/transcripts/{id}/analyze`. On success, update the row to show the suggestion.

For already-analyzed transcripts, show a "Re-analyze" button (calls POST with `{ force: true }`) for when context has changed (e.g., new client was added to the system).

### Classification Panel Pre-Population

When the user opens the classification panel, pre-select dropdowns based on cached AI suggestions:
- If `aiSuggestedClientId` → pre-select that client
- If `aiSuggestedProjectId` → pre-select that project
- If `aiSuggestedLeadId` → pre-select the lead track with that lead

User can accept the suggestion (one click) or change it.

## Implementation Checklist (Phase 4a — Transcript Classification)

1. Create `lib/ai/transcript-classification.ts` with `classifyTranscript()`
   - System prompt adapted for transcript context
   - User prompt builder with title, participants, content snippet
   - Include leads alongside clients/projects in single prompt
   - Zod response schema
   - Confidence filtering (>= 0.4)
2. Create `app/api/transcripts/[transcriptId]/analyze/route.ts`
   - GET: return cached results only (no side effects)
   - POST: run AI analysis (or return cache; `{ force: true }` to re-analyze)
3. Test: analyze a transcript → verify AI suggestion returned
4. Test: POST same transcript again → verify cached result returned (no AI call)
5. Test: POST with `{ force: true }` → verify fresh result computed
6. Test: verify suggestion pre-populates classification panel

## Implementation Checklist (Phase 4b — Email Classification Alignment)

> **Caution:** This refactors production email triage. Test independently.
>
> **Important:** The existing DB-based matchers (`suggestClientMatch()`, `suggestLeadMatch()` in `lib/email/suggestions.ts`) are fast deterministic lookups by email address. They run per-request on the triage route and are **not being replaced**. Phase 4b adds leads to the *AI* classification prompt (the on-demand analysis that runs when users click "Analyze"). Both systems coexist:
> - **DB matchers** (fast, per-request): match by email address → high confidence
> - **AI classification** (slow, cached): match by content/names → probabilistic

1. Update `lib/ai/email-classification-matching.ts` to include leads in single prompt
   - Add `leads` parameter to `classifyEmailThread()`
   - Include leads in system prompt and user prompt
   - Return `leadMatches` alongside `clientMatches` and `projectMatches`
   - Update Zod response schema
2. Update callers of `classifyEmailThread()` to pass leads
   - `app/api/threads/[threadId]/suggestions/route.ts` (or wherever AI analysis is triggered)
   - **Do NOT change `app/api/triage/route.ts`** — it uses DB matchers, not AI classification
3. `suggestLeadMatch()` and `suggestClientMatch()` remain unchanged — they serve a different purpose (fast per-request matching)
4. Test: email triage still works identically (DB matchers unchanged)
5. Test: email AI analysis now returns lead matches alongside client/project matches
6. Test: confidence scores and thresholds behave correctly for AI lead matches
7. Test: existing classified threads are unaffected
