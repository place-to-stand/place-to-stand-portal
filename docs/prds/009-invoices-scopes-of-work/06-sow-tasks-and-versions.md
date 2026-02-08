# 06: SOW Task Generation & Version History

> Part of [PRD 009: Invoices & Scopes of Work](./README.md)
> Related: [05-scopes-of-work.md](./05-scopes-of-work.md) | [07-data-model-reference.md](./07-data-model-reference.md)

## SOW-to-Task Generation

When a SOW is approved, the admin can trigger task generation.

### One task per phase

Each SOW phase generates a single task in the project backlog. Deliverables within the phase are listed in the task but don't create separate tasks.

### Link, don't copy

Tasks do **not** duplicate SOW content into their description. Instead, tasks link to the SOW phase via `sow_task_links` and the task UI renders the linked phase content **live** from the SOW:

- Editing a SOW phase automatically updates what the linked task displays.
- The task can have its own additional notes/description on top of the linked SOW content.
- No risk of SOW-task content drift.

### Generated task structure

- **Title**: Derived from phase title (e.g., "Phase 1: Discovery & Architecture").
- **Estimated hours**: Populated from `SOWPhase.estimatedHours`.
- **Description**: Initially empty. SOW phase content rendered via the link, not copied.
- **Status**: `BACKLOG` (tasks start in backlog awaiting prioritization).

### SOW editor shows task status

When viewing a SOW that has generated tasks, each phase displays the linked task's current status (e.g., BACKLOG, IN_PROGRESS, DONE) for project progress visibility at the SOW level.

### Soft-deleted SOW handling

If a SOW is soft-deleted, linked tasks remain active. The task sheet should query SOW content without filtering on `deletedAt` (or display a "SOW archived" placeholder). The task's own title and description fields serve as fallback.

## `sow_task_links` Join Table

```
sow_task_links
├── id          UUID PRIMARY KEY
├── sow_id      UUID NOT NULL (FK → scopes_of_work, ON DELETE CASCADE)
├── task_id     UUID NOT NULL (FK → tasks, ON DELETE CASCADE)
├── phase_id    VARCHAR(36) NOT NULL   — Stable phase ID from SOWPhase.id in JSONB
├── created_at  TIMESTAMP
├── updated_at  TIMESTAMP
├── deleted_at  TIMESTAMP              — Soft delete (preserves history if task is unlinked)
├── UNIQUE(sow_id, task_id)
```

**Why `phase_id` instead of `phase_index`:** Array index references break when phases are reordered or removed. The stable `phase_id` (matching `SOWPhase.id` in the JSONB content) is decoupled from array position. Orphaned links are detectable by checking if `phase_id` still exists in content.

**Soft delete on links:** When a task is unlinked from a SOW phase (e.g., admin regenerates after revision), the link is soft-deleted to preserve history.

## Version History

### Motivation

SOWs go through iterative refinement before client approval. Version history tracks scope evolution, enables comparison, and supports restoration.

Scoped to SOWs only for this PRD.

### `sow_versions` Table

```
sow_versions
├── id              UUID PRIMARY KEY
├── sow_id          UUID NOT NULL (FK → scopes_of_work, ON DELETE CASCADE)
├── version_number  INTEGER NOT NULL
├── content         JSONB NOT NULL           — Snapshot of SOW content
├── content_hash    VARCHAR(64) NOT NULL     — SHA-256 of canonical JSON for dedup
├── change_summary  TEXT                     — Optional human-readable summary
├── created_by      UUID NOT NULL (FK → users, ON DELETE RESTRICT)
├── created_at      TIMESTAMP NOT NULL
├── updated_at      TIMESTAMP
├── deleted_at      TIMESTAMP
├── UNIQUE(sow_id, version_number)
```

**Content hash requirements:**
- Use a deterministic serializer with **deeply sorted keys**.
- Do NOT rely on `JSON.stringify()` or `JSON.stringify(content, Object.keys(content).sort())` (only sorts top-level keys).
- Use a helper that deeply sorts object keys (e.g., `canonicalize(content)`) or a dedicated canonical-JSON / stable-stringify library.

### How It Works

- The `scopes_of_work.version` field tracks the current version number.
- A new version row is created when:
  - Admin explicitly clicks "Save Version".
  - A status transition occurs (e.g., DRAFT → IN_REVIEW).
  - Content hash differs from the last version (avoids duplicate snapshots).
- Viewing history: query `sow_versions` ordered by `version_number DESC`.
- Restoring: copy previous version's content back to the SOW and increment version number (never destructive).

### Version History UI

- Accessible via a "History" button in the SOW editor.
- Timeline of versions with timestamps, authors, and change summaries.
- "Restore this version" action creates a new version with the old content.
