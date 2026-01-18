# Agentic CRM: Executive Summary

**Prepared for:** CTO Review Meeting
**Date:** January 2025
**Status:** Planning Phase

---

## What We're Building

Transform the PTS Portal from a passive database into an **active CRM partner** that:

- **Observes** - Syncs and analyzes email communications automatically
- **Suggests** - Recommends next actions based on lead behavior
- **Drafts** - Generates email responses and follow-ups
- **Learns** - Improves recommendations based on outcomes

**Core Principle:** Human-in-the-loop. AI suggests and drafts; humans review and approve.

---

## Why This Matters

| Traditional CRM | Agentic CRM |
|-----------------|-------------|
| Manually update lead status | AI suggests status changes based on email signals |
| Forget to follow up | AI prompts when follow-up is overdue |
| Manually log all communications | Communications logged automatically |
| Decide next action yourself | AI recommends next best action with draft |

---

## What We Already Have (Strong Foundation)

| Capability | Status |
|------------|--------|
| Gmail OAuth (multi-account) | ✅ Complete |
| Email sync (threads, messages, history) | ✅ Complete |
| Token encryption (AES-256-GCM) | ✅ Complete |
| Email → Client matching | ✅ Complete |
| Inbox UI with thread view | ✅ Complete |
| Lead kanban board | ✅ Complete |
| AI suggestions infrastructure | ✅ Complete |
| Multi-contact support | ✅ Complete |
| Activity logging system | ✅ Complete |

**We're ~70% there on infrastructure.**

---

## What We Need to Add

### Schema Changes (Minimal Approach)

**Zero new tables.** Extend existing tables only.

#### 1. Add to `leads` table (~12 columns)

```
AI Scoring:
  - overall_score (0.00-1.00)
  - priority_tier ('hot', 'warm', 'cold')
  - signals (JSONB array)
  - last_scored_at

Activity Tracking:
  - last_contact_at
  - awaiting_reply (boolean)

Predictions:
  - predicted_close_probability
  - estimated_value
  - expected_close_date

Conversion:
  - converted_at
  - converted_to_client_id
```

#### 2. Add to `suggestions` table (1 column)

```
  - lead_id (link suggestions to leads)
```

#### 3. Add suggestion types (optional, 3-4 enum values)

```
  - FOLLOW_UP, SEND_EMAIL, SCHEDULE_CALL, SEND_PROPOSAL
```

### Summary

| Metric | Original Plan | Minimal Plan |
|--------|---------------|--------------|
| New tables | 10 | **0** |
| New enums | 8 | **0-4 values** |
| Total changes | ~700 lines | **~15 columns** |
| Migration risk | High | **Low** |

---

## Implementation Phases

### Phase 1: Lead Intelligence
**Goal:** AI-powered lead scoring and signals

- Display lead scores on kanban cards
- Hot/warm/cold priority badges
- Signal detection from email content
- "Why this score?" explainer

**Schema needed:** Lead scoring columns only

---

### Phase 2: Action Suggestions
**Goal:** AI suggests next actions

- Follow-up reminders when overdue
- Email draft generation
- Approval/dismiss workflow
- Track suggestion acceptance rate

**Schema needed:** `lead_id` on suggestions table

---

### Phase 3: Gmail Send/Compose
**Goal:** Complete the email loop

- Send emails from within portal
- Reply to threads inline
- Compose from lead page
- Track sent emails in timeline

**Schema needed:** Already have `threads` and `messages`

---

### Phase 4: Calendar Integration (Future)
**Goal:** Meeting scheduling with Google Calendar

- Schedule meetings from lead page
- Auto-generate Meet links
- Pre-meeting prep briefs
- Post-meeting summaries

**Schema needed:** May need `lead_meetings` table (defer for now)

---

## The Five Agentic Loops

### Loop 1: Lead Detection
Email from unknown sender → AI analyzes → Suggests "Create Lead?"

### Loop 2: Lead Scoring
Any lead activity → AI scores engagement, fit, intent, momentum → Updates score

### Loop 3: Next Best Action
Continuous evaluation → AI suggests: Reply, Follow-up, Advance, Nurture, Close

### Loop 4: Status Advancement
AI detects signals → Suggests status change (e.g., "Move to CLOSED_WON?")

### Loop 5: Lead → Client Conversion
CLOSED_WON → Conversion wizard → Client + Project created → Threads migrated

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| AI hallucination | Always require human review (suggest mode) |
| Data integrity | Zero new tables, extend existing only |
| Migration complexity | Additive columns only, no breaking changes |
| User adoption | Start with suggestions, build trust |
| Convex migration | Schema changes are column additions, easy to translate |

---

## Development Standards & Quality Assurance

We have comprehensive development standards documented to ensure code quality, security, and maintainability. Full details in [Development Standards](./06-development-standards.md).

### Code Standards

| Standard | Requirement |
|----------|-------------|
| **File size** | 300 lines max per file |
| **Function size** | 50 lines max per function |
| **Type safety** | Strict TypeScript, no `any` types |
| **Validation** | Zod schemas for all external inputs |
| **Server-only** | Mark with `'server-only'` to prevent client leaks |

### Security Standards (OWASP Top 10)

| Area | Implementation |
|------|----------------|
| **Injection prevention** | Parameterized queries (Drizzle), Zod validation |
| **Authentication** | `requireUser()` guards on all protected endpoints |
| **Authorization** | Permission helpers (`ensureClientAccess`, `assertAdmin`) |
| **Input validation** | Zod schemas with constraints on all API inputs |
| **Secrets** | Environment variables only, never in code or logs |
| **Rate limiting** | Applied to AI operations and external API calls |

### Database Standards

| Rule | Rationale |
|------|-----------|
| **NO Row Level Security** | Application-layer access control only (easier to test/debug) |
| **Soft deletes only** | `deletedAt` timestamps, never hard delete core entities |
| **Index foreign keys** | All FK columns indexed for query performance |
| **Partial indexes** | Filter on `deleted_at IS NULL` for active record queries |
| **Test locally first** | All migrations tested on local Supabase before production |

### Design System

| Element | Standard |
|---------|----------|
| **Object colors** | Task=Violet, Lead=Amber, Project=Emerald, Client=Blue, AI=Rose |
| **Button variants** | `default` (primary), `outline` (secondary), `ghost` (navigation), `destructive` (danger) |
| **Card pattern** | 4px left border in identity color, hover states with `/50` opacity |
| **Spacing** | `p-4`/`p-6` for content, `space-y-4`/`space-y-6` between sections |

### Component Architecture

| Pattern | Usage |
|---------|-------|
| **Server Components** | Default for data fetching, direct DB access |
| **Client Components** | Only for interactivity (useState, onClick, etc.) |
| **Two-layer data** | `lib/queries/` (low-level) → `lib/data/` (business logic + permissions) |
| **Hook extraction** | Extract when component logic exceeds ~100 lines |

### Performance Standards

| Area | Requirement |
|------|-------------|
| **Data fetching** | Parallel with `Promise.all()`, no sequential waterfalls |
| **N+1 prevention** | Use Drizzle relations, batch fetches |
| **Long lists** | Virtualization for lists > 50 items |
| **Bundle size** | Tree-shakeable imports, dynamic imports for heavy components |

### Accessibility (WCAG 2.1 AA)

| Requirement | Implementation |
|-------------|----------------|
| **Keyboard navigation** | All interactive elements keyboard accessible |
| **ARIA labels** | Required on all icon-only buttons |
| **Form accessibility** | Labels linked to inputs, error messages accessible |
| **Color contrast** | 4.5:1 minimum for text, never color-only indicators |

### Observability

| Area | Implementation |
|------|----------------|
| **Activity logging** | All significant actions logged via `lib/activity/events` |
| **Structured logging** | Contextual objects, not string concatenation |
| **PostHog analytics** | Feature flags, event tracking with consistent naming |
| **Error tracking** | Errors captured with full context |

### Pre-PR Checklist

Every pull request must pass:

- [ ] `npm run build` - Production build succeeds
- [ ] `npm run lint` - No linting errors
- [ ] `npm run type-check` - No TypeScript errors
- [ ] File sizes under 300 lines
- [ ] Permission checks on all data access
- [ ] No hardcoded secrets
- [ ] Loading and empty states implemented
- [ ] Icon-only buttons have aria-labels

---

## Decision Points for CTO

1. **Approve minimal schema approach?**
   - 0 new tables vs original 10-table plan
   - ~15 columns added to existing tables

2. **Phase 1 scope?**
   - Lead scoring only (smallest)
   - Lead scoring + action suggestions (recommended)
   - Full Phase 1-3 (largest)

3. **AI provider?**
   - OpenAI GPT-4
   - Anthropic Claude
   - Both (different use cases)

4. **Convex timing?**
   - Wait for Convex migration to complete?
   - Build on current Supabase, migrate later?
   - Build schema-agnostic service layer?

---

## Recommended Next Steps

1. **Approve** minimal schema approach (this doc)
2. **Prioritize** Phase 1 (lead scoring) + Phase 2 (suggestions)
3. **Defer** Calendar integration until core loops work
4. **Coordinate** with Convex migration timeline
5. **Start** with lead scoring columns on `leads` table

---

## Appendix: Existing Tables We Leverage

| Table | How We Use It |
|-------|---------------|
| `leads` | Extend with scoring columns |
| `suggestions` | Add `lead_id` for lead actions |
| `threads` | Already links to clients, add lead link |
| `messages` | Email content for AI analysis |
| `contacts` + `contactLeads` | Multi-stakeholder already works |
| `activityLogs` | Timeline already built |
| `oauthConnections` | Gmail OAuth ready |

---

## Links to Full Documentation

- [Vision & Architecture](./01-vision-architecture.md) - Complete vision and agentic loops
- [Google Workspace Integration](./02-google-workspace-integration.md) - Gmail, Calendar, Drive APIs
- [Schema Extensions](./04-schema-extensions.md) - Detailed column specifications
- [Implementation Roadmap](./05-implementation-roadmap.md) - Phase breakdown with PRs
- [Development Standards](./06-development-standards.md) - Code and design patterns

---

*Document version: 2.0 (Minimal Schema Approach)*
