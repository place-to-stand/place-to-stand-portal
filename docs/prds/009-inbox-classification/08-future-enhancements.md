# 08: Future Enhancements

> Part of [PRD 009: Inbox Classification & Triage](./README.md)
> Status: **Not in scope for v1** — deferred but architecture supports them

## Auto-Classification Rules Engine

Table of sender domain/email/pattern rules that auto-classify during sync. Includes:
- Admin-managed rules (global, not per-user)
- Seed data for common automated senders (Vercel, GitHub, Luma, noreply@*)
- Gmail category label matching (`CATEGORY_UPDATES`, `CATEGORY_PROMOTIONS` — confirmed available in `providerMetadata.labels`)
- Settings UI for managing rules
- `match_count` tracking for rule effectiveness

## AI Batch Classification

After rule-based classification runs, remaining unclassified threads could be batch-classified by AI. The AI would assign `CLASSIFIED | DISMISSED` with a confidence score, surfaced for user approval.

## "Suggest Rules" Feature

Analyze common unclassified sender patterns and suggest new rules. E.g., "You've dismissed 12 emails from vercel.com — create a rule?"

## Inline Rule Creation from Triage

When a user dismisses a thread in triage, show a toast: "Always dismiss emails from [sender domain]?" One-click rule creation from the triage flow.

## Meeting Transcript Ingestion

New source type with the same triage flow:
- Add `MEETING` to `messageSource` enum
- Transcript becomes a message within a thread
- Same classification + triage + linking pipeline
- Same task suggestion generation

## AUTOMATED Classification State

Separate state for notification/transactional emails, distinct from user-dismissed. Would enable:
- Auto-classification during sync via rules
- Dedicated "Automated" view with greyed-out visual treatment
- Separate count from dismissed (automated ≠ worthless, just not actionable)

## Smart Queue Ordering

Pre-compute match confidence during sync and sort triage queue by confidence tiers:
1. High-confidence client matches (exact email)
2. Lead matches
3. Medium-confidence matches (domain)
4. Unknown senders

Requires caching match results, possibly in a new `thread_match_suggestions` table.

## Task Suggestions in Triage

Show AI task suggestions inline in triage cards. Currently blocked by the requirement that suggestion generation needs both `clientId` AND `projectId`. Would require relaxing that prerequisite or generating suggestions with partial context.
