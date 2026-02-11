# 05: Scopes of Work

> Part of [PRD 009: Invoices & Scopes of Work](./README.md)
> Related: [06-sow-tasks-and-versions.md](./06-sow-tasks-and-versions.md) | [07-data-model-reference.md](./07-data-model-reference.md)

## Relationship to Proposals

```
Proposal (Sales)          →  Scope of Work (Operations)      →  Tasks (Execution)
─────────────────────         ──────────────────────────          ────────────────
"Here's what we'll do        "Here are the specific phases,     Individual work items
 and what it costs"           deliverables, and hour estimates   with detailed PRDs
                              for phase 1"
```

**Key distinction:**
- **Proposal**: Tied to a lead or client. Sales document. Signed before engagement begins.
- **SOW**: Tied to a project. Operational document. Created after the proposal is accepted and a project exists. May be the first thing done on a paid scoping engagement.

A project may have **multiple SOWs** over its lifetime (initial scope + iteration scopes).

## SOW Statuses (`sow_status` enum)

| Status | Description |
|--------|-------------|
| `DRAFT` | Being authored. Editable. |
| `IN_REVIEW` | Sent to client for review. |
| `REVISION_REQUESTED` | Client has requested changes. Returns to editable state with audit trail. |
| `APPROVED` | Client has approved. Ready for task generation. |
| `IN_PROGRESS` | Tasks have been generated; work is underway. |
| `COMPLETED` | All phases delivered. **Manual transition** — admin marks SOW as completed. Not auto-computed from task statuses. SOW detail view shows task progress to inform the admin's decision. |
| `SUPERSEDED` | Replaced by a newer SOW version. |

## SOW Content Structure

The `content` JSONB field follows a structured schema. Types in `lib/scopes-of-work/types.ts`, with a Zod schema for runtime validation (matching the proposal pattern in `lib/proposals/types.ts`):

```typescript
interface SOWContent {
  summary: string                    // Executive summary / project overview
  phases: SOWPhase[]
  risks: {
    title: string
    description: string
    mitigation?: string
  }[]
  assumptions: string[]              // Key assumptions
  constraints: string[]              // Known constraints
  outOfScope: string[]               // Explicitly excluded items
}

interface SOWPhase {
  id: string                         // Stable identifier (nanoid) — used by sow_task_links
  index: number                      // Display ordering (1-based, for presentation only)
  title: string                      // e.g., "Discovery & Architecture"
  description: string                // Phase purpose and approach
  estimatedHours: number             // Hour estimate for the phase
  deliverables: SOWDeliverable[]
}

interface SOWDeliverable {
  title: string                      // e.g., "Database schema design"
  description?: string               // Optional detail
  estimatedHours?: number            // Per-deliverable estimate (optional)
}
```

**Stable phase IDs:** Each phase has an `id` (generated via `nanoid()`) that serves as the stable identifier for SOW-to-task linking. The `index` field is for display ordering only. Reordering or removing phases does not break task links.

**JSONB querying:** Main pattern is "fetch the SOW, read content in application code." No GIN indexes needed.

## Proposal-to-SOW Mapping

Transformation utility at `lib/scopes-of-work/transform-from-proposal.ts`:

- `ProposalPhase.purpose` → `SOWPhase.description`
- `ProposalPhase.deliverables` (string[]) → `SOWPhase.deliverables` (SOWDeliverable objects with `title` = string value)
- `SOWPhase.id` — generated fresh via `nanoid()`
- `SOWPhase.estimatedHours` — initialized to `0` (not present on ProposalPhase)

## SOW UI Location

SOWs live **inside projects**, accessible via a new "Scopes" tab:

```
/projects/[clientSlug]/[projectSlug]/
├── board/          (existing)
├── backlog/        (existing)
├── calendar/       (existing)
├── review/         (existing)
├── time-logs/      (existing)
├── scopes/         (NEW — list of SOWs for this project)
│   └── [sowId]/    (NEW — SOW detail/editor)
├── archive/        (existing)
└── activity/       (existing)
```

**Scopes tab:**
- Lists all SOWs, ordered by creation date (newest first).
- Status badge on each SOW card.
- "New Scope of Work" button.
- Optional pre-populate from linked proposal content.

**SOW editor:**
- Rich form for structured content editing.
- Phase builder: add/remove/reorder phases with deliverables and hour estimates.
- Running total of estimated hours across all phases.
- Preview mode showing client-facing document.
- Share controls (generate link, optional password — reuse proposal sharing pattern).
- Approval status and client info.

## Client Approval Flow

**Simple approval:** Client clicks "Approve" on the shared page. Records name, email, and timestamp. No signature capture (unlike proposals).

**Security:**
- Approval endpoint is unauthenticated (via share token).
- Rate-limit `POST /api/public/sow/[token]/approve`.
- Validate SOW is in `IN_REVIEW` status before accepting.
- Allow approval only once (guard against replay).

## SOW Iteration

When a client wants to continue iterating:

1. Admin creates a new SOW within the same project (e.g., "Phase 2: Feature Expansion").
2. The new SOW may reference the previous one but is independent.
3. Task generation works the same way — new backlog tasks.
4. Previous SOWs move to `COMPLETED` or remain `IN_PROGRESS` based on task status.
