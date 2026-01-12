# Implementation Roadmap

## Overview

This document outlines the prioritized implementation phases for the agentic CRM. Each phase builds on the previous, with clear dependencies and deliverables.

---

## Phase Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        IMPLEMENTATION TIMELINE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PHASE 1: Gmail Send/Compose                                                │
│  ════════════════════════════                                               │
│  Foundation for all email-based agentic features                            │
│                                                                              │
│         ↓                                                                    │
│                                                                              │
│  PHASE 2: Lead Intelligence                                                 │
│  ═══════════════════════════                                                │
│  AI scoring, signals, timeline                                              │
│                                                                              │
│         ↓                                                                    │
│                                                                              │
│  PHASE 3: Actions & Suggestions                                             │
│  ═════════════════════════════                                              │
│  AI-suggested next actions, email drafts                                    │
│                                                                              │
│         ↓                                                                    │
│                                                                              │
│  PHASE 4: Calendar & Meetings                                               │
│  ═══════════════════════════                                                │
│  Google Calendar integration, meeting intelligence                          │
│                                                                              │
│         ↓                                                                    │
│                                                                              │
│  PHASE 5: Documents & Drive                                                 │
│  ═════════════════════════                                                  │
│  Proposals, PRDs, file management                                           │
│                                                                              │
│         ↓                                                                    │
│                                                                              │
│  PHASE 6: Advanced Autonomy                                                 │
│  ═════════════════════════                                                  │
│  Configurable AI autonomy, multi-agent coordination                         │
│                                                                              │
│         ↓                                                                    │
│                                                                              │
│  PHASE 7: Experimental Features                                             │
│  ═════════════════════════════                                              │
│  Voice, predictive intelligence, client portal                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Gmail Send/Compose

**Goal:** Complete the email loop - send emails from within the portal.

### Prerequisites
- Existing Gmail OAuth flow (complete)
- Existing email sync infrastructure (complete)

### Deliverables

| PR | Description | Complexity |
|----|-------------|------------|
| 1.1 | Add `gmail.send` and `gmail.compose` OAuth scopes | Small |
| 1.2 | Create `sent_emails` table and Drizzle schema | Small |
| 1.3 | Build Gmail send API wrapper (`lib/gmail/send.ts`) | Medium |
| 1.4 | Create email compose UI component | Medium |
| 1.5 | Add "Reply" action to email thread view | Small |
| 1.6 | Add "Compose" button to lead detail page | Small |
| 1.7 | Track sent emails in `sent_emails` table | Small |
| 1.8 | Link sent emails to leads/clients/projects | Small |

### Schema Required
- `sent_emails` table

### Success Criteria
- User can compose and send email from lead page
- User can reply to email threads
- Sent emails are tracked and visible in timeline

---

## Phase 2: Lead Intelligence

**Goal:** AI-powered lead scoring and signal detection.

### Prerequisites
- Phase 1 complete (email data available)
- AI provider integration (OpenAI/Anthropic)

### Deliverables

| PR | Description | Complexity |
|----|-------------|------------|
| 2.1 | Create `lead_intelligence` table | Small |
| 2.2 | Create `lead_timeline` table | Small |
| 2.3 | Build lead scoring service (`lib/ai/lead-scorer.ts`) | Large |
| 2.4 | Implement signal detection from emails | Large |
| 2.5 | Add scoring display to lead card | Small |
| 2.6 | Add timeline view to lead detail page | Medium |
| 2.7 | Create priority tier badges (hot/warm/cold) | Small |
| 2.8 | Add AI agent logging (`ai_agent_logs` table) | Small |
| 2.9 | Build score refresh job (cron or on-demand) | Medium |
| 2.10 | Add "Why this score?" explainer UI | Small |

### Schema Required
- `lead_intelligence` table
- `lead_timeline` table
- `ai_agent_logs` table

### Success Criteria
- Leads display AI-computed scores
- Timeline shows all lead activity
- Scores update based on new activity

---

## Phase 3: Actions & Suggestions

**Goal:** AI suggests next actions and drafts emails.

### Prerequisites
- Phase 2 complete (intelligence data available)

### Deliverables

| PR | Description | Complexity |
|----|-------------|------------|
| 3.1 | Create `lead_actions` table | Small |
| 3.2 | Create `email_templates` table | Small |
| 3.3 | Build action suggestion service | Large |
| 3.4 | Build email draft generation service | Large |
| 3.5 | Add "Suggested Actions" panel to lead page | Medium |
| 3.6 | Add action approval/dismiss UI | Small |
| 3.7 | Create email template management UI | Medium |
| 3.8 | Integrate template variables | Medium |
| 3.9 | Add "Draft Email" AI action type | Medium |
| 3.10 | Track action outcomes for learning | Small |

### Schema Required
- `lead_actions` table
- `email_templates` table

### Success Criteria
- AI suggests relevant next actions
- Users can approve/dismiss suggestions
- AI drafts emails using templates and context

---

## Phase 4: Calendar & Meetings

**Goal:** Google Calendar integration with meeting intelligence.

### Prerequisites
- Phase 1 complete (OAuth foundation)

### Deliverables

| PR | Description | Complexity |
|----|-------------|------------|
| 4.1 | Add Calendar OAuth scopes | Small |
| 4.2 | Create `lead_meetings` table | Small |
| 4.3 | Build Calendar API wrapper (`lib/calendar/client.ts`) | Medium |
| 4.4 | Implement meeting creation with Meet link | Medium |
| 4.5 | Add meeting scheduling UI | Medium |
| 4.6 | Sync calendar events to portal | Medium |
| 4.7 | Generate pre-meeting prep briefs | Large |
| 4.8 | Process meeting transcripts (if available) | Large |
| 4.9 | Extract action items from meetings | Medium |
| 4.10 | Add meeting history to lead timeline | Small |

### Schema Required
- `lead_meetings` table

### Success Criteria
- Users can schedule meetings from lead page
- Meetings appear in lead timeline
- AI generates prep briefs before meetings

---

## Phase 5: Documents & Drive

**Goal:** Google Drive integration for proposals and documents.

### Prerequisites
- Phase 4 complete (meeting context available)

### Deliverables

| PR | Description | Complexity |
|----|-------------|------------|
| 5.1 | Add Drive/Docs OAuth scopes | Small |
| 5.2 | Build Drive API wrapper (`lib/drive/client.ts`) | Medium |
| 5.3 | Implement folder structure auto-creation | Medium |
| 5.4 | Build proposal generation from template | Large |
| 5.5 | Add document tracking (views, edits) | Medium |
| 5.6 | Create document linking to leads/clients | Small |
| 5.7 | Build PRD generation from meeting context | Large |
| 5.8 | Add document management UI | Medium |
| 5.9 | Implement permission sharing | Medium |
| 5.10 | Add document events to timeline | Small |

### Schema Required
- Additional columns on `leads` table
- Possible `documents` linking table

### Success Criteria
- Auto-create client folders on conversion
- Generate proposals from templates
- Track document views

---

## Phase 6: Advanced Autonomy

**Goal:** Configurable AI autonomy levels.

### Prerequisites
- Phases 1-5 complete (all action types available)

### Deliverables

| PR | Description | Complexity |
|----|-------------|------------|
| 6.1 | Create `autonomy_settings` table | Small |
| 6.2 | Build autonomy settings UI | Medium |
| 6.3 | Implement autonomy level checks in all actions | Medium |
| 6.4 | Add approval queue for auto-draft items | Medium |
| 6.5 | Build notification system for auto-actions | Medium |
| 6.6 | Implement rate limiting per autonomy setting | Small |
| 6.7 | Add "undo" capability for auto-executed actions | Medium |
| 6.8 | Create autonomy audit log | Small |
| 6.9 | Build trust score based on acceptance rate | Medium |
| 6.10 | Implement per-lead/per-client overrides | Small |

### Schema Required
- `autonomy_settings` table

### Success Criteria
- Users can configure autonomy per action type
- AI respects autonomy settings
- Users can review auto-drafted content before send

---

## Phase 7: Experimental Features

**Goal:** Advanced capabilities for competitive advantage.

### Prerequisites
- Phases 1-6 complete (full agentic foundation)

### Deliverables

| Feature | Description | Complexity |
|---------|-------------|------------|
| 7.1 | Natural language command interface | Large |
| 7.2 | Predictive deal intelligence | Large |
| 7.3 | Client-facing AI portal | Large |
| 7.4 | Voice-first / async video | Large |
| 7.5 | Team intelligence (workload, skills) | Medium |
| 7.6 | Competitive intelligence | Medium |
| 7.7 | External data enrichment (Clearbit, etc.) | Medium |
| 7.8 | Multi-agent coordination | Large |

### Success Criteria
- Differentiated features that set agency apart
- Measured impact on efficiency and win rate

---

## Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DEPENDENCY GRAPH                                   │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────┐
                              │   OAuth     │
                              │ Foundation  │
                              └──────┬──────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
              ▼                      ▼                      ▼
       ┌──────────┐          ┌──────────┐          ┌──────────┐
       │  Gmail   │          │ Calendar │          │  Drive   │
       │  Send    │          │  Events  │          │  Files   │
       └────┬─────┘          └────┬─────┘          └────┬─────┘
            │                     │                     │
            ▼                     ▼                     ▼
       ┌──────────┐          ┌──────────┐          ┌──────────┐
       │  Lead    │          │ Meeting  │          │ Document │
       │ Threads  │          │ Records  │          │ Tracking │
       └────┬─────┘          └────┬─────┘          └────┬─────┘
            │                     │                     │
            └──────────────┬──────┴─────────────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │    Lead      │
                    │  Timeline    │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │    Lead      │
                    │ Intelligence │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   Actions    │
                    │ & Suggestions│
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   Autonomy   │
                    │   Settings   │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ Experimental │
                    │   Features   │
                    └──────────────┘
```

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| OAuth scope rejection by Google | High | Incremental scope requests, clear privacy policy |
| AI hallucination in drafts | Medium | Always require human review initially |
| Data privacy concerns | High | Encryption, audit logs, clear data retention |
| Performance with large email volumes | Medium | Pagination, background processing, caching |
| Cost of AI API calls | Medium | Batch processing, caching, model selection |
| User adoption resistance | Medium | Gradual rollout, training, "suggest" mode first |

---

## Success Metrics

### Phase 1
- Email send success rate > 99%
- Average compose-to-send time < 30 seconds

### Phase 2
- Lead scores correlate with conversion (r > 0.6)
- Score computation time < 5 seconds

### Phase 3
- Action suggestion acceptance rate > 40%
- Email draft edit rate < 30%

### Phase 4
- Meeting scheduling time reduced by 50%
- Prep brief satisfaction rating > 4/5

### Phase 5
- Proposal generation time < 5 minutes
- Document tracking accuracy > 95%

### Phase 6
- Autonomy adoption rate > 60%
- Auto-execute error rate < 1%

---

## Resource Estimates

### Engineering Effort (per phase)

| Phase | Estimated PRs | Complexity | Notes |
|-------|---------------|------------|-------|
| 1 | 8 | Medium | Foundation work |
| 2 | 10 | High | AI integration |
| 3 | 10 | High | AI + UX work |
| 4 | 10 | Medium | API integration |
| 5 | 10 | Medium | API + document work |
| 6 | 10 | Medium | Systems work |
| 7 | Variable | High | Experimental |

### Infrastructure Costs

| Service | Estimated Monthly Cost |
|---------|------------------------|
| AI API (OpenAI/Anthropic) | $50-200 based on usage |
| Additional Supabase compute | $25-50 |
| Background job processing | $10-25 |

---

## Quick Wins

Highest value, lowest effort items to prioritize within each phase:

### Phase 1
1. **Email reply button** - Simple, high usage
2. **Compose from lead** - Direct path to value

### Phase 2
1. **Basic timeline** - Visual engagement history
2. **Hot/warm/cold badges** - Quick prioritization

### Phase 3
1. **Follow-up reminders** - Obvious next action
2. **Template library** - Reusable content

### Phase 4
1. **Meeting link generation** - Saves manual work
2. **Calendar sync** - Visibility

### Phase 5
1. **Folder auto-creation** - Organization
2. **Template-based proposals** - Speed

---

## Integration Points

### External Services

| Service | Phase | Purpose |
|---------|-------|---------|
| Gmail API | 1+ | Email read/write |
| Google Calendar API | 4+ | Meeting scheduling |
| Google Drive API | 5+ | File management |
| Google Docs API | 5+ | Document generation |
| OpenAI / Anthropic | 2+ | AI capabilities |
| Clearbit (optional) | 7 | Data enrichment |

### Internal Systems

| System | Integration |
|--------|-------------|
| Clients | Lead→Client conversion |
| Projects | Client→Project linking |
| Tasks | Action→Task creation |
| Time Logs | Meeting→Time tracking |
| Activity System | All events logged |

---

## Rollout Strategy

### Per-Phase Rollout

1. **Internal dogfooding** - Team uses for 1-2 weeks
2. **Beta users** - Select clients invited
3. **Gradual rollout** - Feature flags, percentage-based
4. **General availability** - All users

### Feature Flags

```typescript
export const AGENTIC_FLAGS = {
  LEAD_INTELLIGENCE: 'agentic_lead_intelligence',
  ACTION_SUGGESTIONS: 'agentic_action_suggestions',
  EMAIL_DRAFTS: 'agentic_email_drafts',
  MEETING_PREP: 'agentic_meeting_prep',
  AUTONOMY_SETTINGS: 'agentic_autonomy_settings',
} as const;
```

---

*See also: [Vision & Architecture](./01-vision-architecture.md), [Schema Extensions](./04-schema-extensions.md)*
