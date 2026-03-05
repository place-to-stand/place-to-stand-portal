# 01: Overview

> Part of [PRD 009: Inbox Classification & Triage](./README.md)

## Problem Statement

The inbox was built as a Gmail clone with AI capabilities layered on top. Google is iterating on Gmail faster than we can keep up, making "email client" a losing game. Meanwhile, the most valuable part of the inbox — **linking communications to clients, projects, and leads, and extracting actionable tasks** — is buried behind a thread-detail workflow that requires opening each email individually.

The result: most emails go unclassified. When an AI worker picks up a task, it lacks the full communication context it needs to do good work.

## Strategic Shift

Reposition the inbox from **"email client"** to **"context intake engine"**. Every communication that enters the system either:

1. **Belongs to** an existing client/project/lead → link it (**CLASSIFIED**)
2. **Represents** a new opportunity → create/link a lead (**CLASSIFIED**)
3. **Is noise** → dismiss it (**DISMISSED**)

The compose/draft/send capabilities remain but become secondary to the classification workflow. The primary value prop: **when a worker picks up a task, they see every related communication across all channels.**

## The Payoff: Context on Tasks and Projects

Classification is effort — it only pays off if the linked context is surfaced where workers need it. The read-side experience:

- **Task detail view**: When viewing a task, a "Related Communications" section shows threads linked to the same project, filtered by relevance (participant overlap, keyword match, recency). Workers see the email conversations that led to the task.
- **Project board**: A "Communications" tab or sidebar shows all threads linked to the project, sorted by recency. This is the full context feed for a project.
- **Lead detail**: Threads linked to a lead show the conversation history, giving context for outreach and follow-up.

> **Note**: Building these read-side surfaces may be a separate implementation effort, but the classification system is the prerequisite. Without linked threads, there's nothing to surface.

## Scope

**This PRD covers:**
- Thread classification system (data model)
- Triage mode UI for rapid classification with auto-detected suggestions
- Manual classification and dismissal
- Classification progress tracking
- Removal of sync auto-linking (all linking becomes manual)
- Foundation for multi-source ingestion (meeting transcripts, messages)

**This PRD does NOT cover:**
- Auto-classification rules engine (deferred — classification is manual for v1)
- Meeting transcript ingestion (future PRD, builds on this foundation)
- Changes to compose/draft/send flows
- Task suggestion generation or approval in triage (deferred — triage is classification-only for v1)

## Design Principle: No Magic

All linking and classification is **explicit and user-approved**. The system suggests, the user confirms. Nothing is auto-linked or auto-classified without the user seeing and accepting it. This applies to:
- Gmail sync: ingests messages only, does not write any links
- Triage mode: pre-fills suggestions from matchers, but user must accept
- Detail sheet: user manually links via panels

> **Why?** Automatic linking creates invisible state changes that are hard to trust and hard to debug. When a thread is linked to the wrong client, it poisons the context for every task in that project. The cost of a bad auto-link exceeds the cost of manual triage.

## Multi-Source Foundation

The classification system is designed to work across all thread sources. The `threads.source` enum already supports: `EMAIL`, `CHAT`, `VOICE_MEMO`, `DOCUMENT`, `FORM`.

For meeting transcripts (future PRD):
- Add `MEETING` to the `messageSource` enum
- Transcript becomes a message within a thread
- Same classification + triage flow applies
- Same linking to client/project/lead
- Same task suggestion pipeline

Triage cards display a source icon (email, meeting, chat) so users can quickly identify the communication type. The triage actions and detection logic remain identical regardless of source.
