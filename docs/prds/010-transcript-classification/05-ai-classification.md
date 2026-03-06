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
| Leads included | Yes (via `suggestLeadMatch`) | Yes (included in AI prompt) |

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

  // Cache hit: return existing analysis
  if (transcript.aiAnalyzedAt) {
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

  // Cache miss: run AI classification
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

  // Store top match in cache fields
  const topClient = result.clientMatches[0]
  const topLead = result.leadMatches[0]

  await updateTranscript(transcriptId, {
    aiSuggestedClientId: topClient?.clientId ?? null,
    aiSuggestedClientName: topClient?.clientName ?? null,
    aiSuggestedProjectId: topClient?.projectId ?? null,
    aiSuggestedProjectName: topClient?.projectName ?? null,
    aiSuggestedLeadId: topLead?.leadId ?? null,
    aiSuggestedLeadName: topLead?.leadName ?? null,
    aiConfidence: topClient?.confidence ?? topLead?.confidence ?? null,
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

### Re-Analyze Endpoint

`POST /api/transcripts/[transcriptId]/analyze` (same file, POST method)

Clears the cache and re-runs analysis:

```typescript
export async function POST(/* ... */) {
  // Clear cache fields
  await updateTranscript(transcriptId, {
    aiSuggestedClientId: null,
    aiSuggestedClientName: null,
    aiSuggestedProjectId: null,
    aiSuggestedProjectName: null,
    aiSuggestedLeadId: null,
    aiSuggestedLeadName: null,
    aiConfidence: null,
    aiAnalyzedAt: null,
  })

  // Redirect to GET to run fresh analysis
  // (or inline the analysis logic)
}
```

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

For transcripts where `aiAnalyzedAt` is NULL, show an "Analyze" button that calls `GET /api/transcripts/{id}/analyze`. On success, update the row to show the suggestion.

### Classification Panel Pre-Population

When the user opens the classification panel, pre-select dropdowns based on cached AI suggestions:
- If `aiSuggestedClientId` → pre-select that client
- If `aiSuggestedProjectId` → pre-select that project
- If `aiSuggestedLeadId` → pre-select the lead track with that lead

User can accept the suggestion (one click) or change it.

## Implementation Checklist (Phase 4)

1. Create `lib/ai/transcript-classification.ts` with `classifyTranscript()`
   - System prompt adapted for transcript context
   - User prompt builder with title, participants, content snippet
   - Zod response schema
   - Confidence filtering
2. Create `app/api/transcripts/[transcriptId]/analyze/route.ts`
   - GET: cache-or-compute pattern
   - POST: clear cache and re-analyze
3. Test: analyze a transcript → verify AI suggestion returned
4. Test: analyze same transcript again → verify cached result returned (no AI call)
5. Test: re-analyze → verify cache cleared and fresh result computed
6. Test: verify suggestion pre-populates classification panel
