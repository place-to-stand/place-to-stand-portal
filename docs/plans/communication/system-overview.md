# PTS Portal: Systems Overview

**Prepared for Team Meeting** | January 2025

---

## Executive Summary

This document provides a high-level overview of 6 core systems in the PTS Portal, their current state, planned features, and recommended build order.

| System | Category | Current State | Priority |
|--------|----------|---------------|----------|
| **Gmail Integration** | Communication | 70% Complete | Active |
| **Chat System** | Communication | 0% (Planned) | High |
| **Agentic CRM** | Sales & Marketing | 40% Complete | Medium |
| **Projects/Tasks/Hours** | Organization | 90% Complete | Maintenance |
| **Contacts** | Organization | 60% Complete | Medium |
| **Bug Bot** | Code Execution | 5% (Designed) | Future |

---

## 1. Full Gmail Integration

**Category:** Communication

### What It Should Do
- Sync all team Gmail conversations into the portal
- Link email threads to clients and projects automatically
- Generate AI-powered task suggestions from emails
- Reply to emails directly from the portal
- Track email engagement and client communication history

### What We Have Now ✅
| Feature | Status |
|---------|--------|
| Gmail OAuth authentication | ✅ Complete |
| Incremental email sync (history API) | ✅ Complete |
| Thread/message storage | ✅ Complete |
| Link threads to clients/projects | ✅ Complete |
| AI task suggestions from emails | ✅ Complete |
| Unified inbox UI (`/my/inbox`) | ✅ Complete |
| Read/unread tracking | ✅ Complete |
| Attachment detection | ✅ Complete |
| Multi-account support | ✅ Complete |

### What's Missing ❌
| Feature | Effort |
|---------|--------|
| Send/reply to emails from portal | Medium |
| Email scheduling | Low |
| Email templates | Low |
| Full-text search across emails | Medium |
| Email analytics (response times) | Medium |
| Shared team inbox | High |

### Next Steps
1. **Compose/reply functionality** - Allow sending emails via Gmail API
2. **Email templates** - Reusable reply templates
3. **Search** - Full-text search with filters

---

## 2. Native Chat System (Google Chat Replacement)

**Category:** Communication

### What It Should Do
- Real-time internal team messaging
- Direct messages (1:1) and group chats
- Presence indicators (who's online)
- Typing indicators
- Message reactions and replies
- File sharing
- Unified with inbox (chat + email together)

### What We Have Now ✅
| Feature | Status |
|---------|--------|
| Supabase Realtime infrastructure | ✅ Ready |
| `messageSource: 'CHAT'` in schema | ✅ Reserved |
| Unified threads/messages tables | ✅ Ready |
| User presence (Supabase) | ⚠️ Not connected |
| Chat UI components | ❌ None |

### What's Missing ❌
| Feature | Effort |
|---------|--------|
| Chat spaces/rooms tables | Medium |
| Membership management | Medium |
| RealtimeProvider (presence, typing) | Medium |
| Chat UI (sidebar, panel, input) | High |
| Message reactions | Low |
| File attachments | Medium |
| Unread tracking | Medium |

### Implementation Plan
See: `docs/plans/communication/chat-system.md`

**Scope Decisions:**
- ADMIN users only (internal team)
- DMs + Group chats first (skip channels)
- Fresh start (no Google Chat migration)

**Timeline:** 6 weeks

---

## 3. Agentic CRM

**Category:** Sales & Marketing

### What It Should Do
- Automated lead scoring and qualification
- AI-driven lead prioritization
- Workflow automation (follow-up sequences)
- Pipeline analytics and forecasting
- Customer intelligence and enrichment
- Multi-channel engagement tracking
- Predictive insights (win probability, churn risk)

### What We Have Now ✅
| Feature | Status |
|---------|--------|
| Leads table with 7-stage pipeline | ✅ Complete |
| Lead kanban board (`/leads/board`) | ✅ Complete |
| Lead assignment to admins | ✅ Complete |
| Lead intake webhook | ✅ Complete |
| Client management | ✅ Complete |
| Contact ↔ Client linking | ✅ Complete |
| Email thread linking to clients | ✅ Complete |
| Activity audit trail | ✅ Complete |

### What's Missing ❌
| Feature | Effort | Priority |
|---------|--------|----------|
| Lead scoring rules engine | High | Critical |
| Workflow automation | High | Critical |
| Lead enrichment (ZoomInfo, Apollo) | Medium | High |
| Email open/click tracking | Medium | High |
| Sales analytics dashboard | Medium | High |
| AI lead prioritization | Medium | Medium |
| Multi-channel outreach | High | Medium |
| Calendar integration | Medium | Low |
| Salesforce/HubSpot sync | High | Low |

### Roadmap
| Phase | Features | Timeline |
|-------|----------|----------|
| 1. Scoring | Lead scoring table, rules engine | 2 weeks |
| 2. Automation | Workflows, follow-up sequences | 2 weeks |
| 3. Intelligence | AI prioritization, enrichment APIs | 2 weeks |
| 4. Analytics | Pipeline dashboard, forecasting | 2 weeks |

---

## 4. Projects / Tasks / Hours

**Category:** Organization, Planning & Execution

### What It Should Do
- Full project lifecycle management
- Task boards with customizable workflows
- Time tracking linked to tasks
- Prepaid hours (hour blocks) management
- Team workload visibility
- Project analytics and reporting

### What We Have Now ✅
| Feature | Status |
|---------|--------|
| Projects (CLIENT, PERSONAL, INTERNAL) | ✅ Complete |
| Tasks with 7-status workflow | ✅ Complete |
| Kanban board view | ✅ Complete |
| Backlog view | ✅ Complete |
| Calendar view | ✅ Complete |
| Task assignments (multi-assignee) | ✅ Complete |
| Task comments | ✅ Complete |
| Task attachments | ✅ Complete |
| Time logging per project/task | ✅ Complete |
| Hour blocks (prepaid contracts) | ✅ Complete |
| Activity feed | ✅ Complete |
| Archive/restore | ✅ Complete |
| Drag-and-drop ordering | ✅ Complete |
| AI task suggestions from email | ✅ Complete |
| GitHub repo linking | ✅ Complete |

### What's Missing ❌
| Feature | Effort | Priority |
|---------|--------|----------|
| Task subtasks | Medium | High |
| Task dependencies | High | Medium |
| Recurring tasks | Medium | Medium |
| Time estimates vs actuals | Low | Medium |
| Gantt/timeline view | High | Low |
| Sprint planning | High | Low |
| Resource allocation view | High | Low |
| Client portal (read-only) | High | Low |

### Status
**90% Complete** - Core system is production-ready. Focus on polish and edge cases.

---

## 5. Contacts

**Category:** Organization

### What It Should Do
- Central contact database
- Link contacts to multiple clients
- Link contacts to leads
- Contact enrichment (job title, company, social)
- Communication history per contact
- Smart deduplication

### What We Have Now ✅
| Feature | Status |
|---------|--------|
| Contacts table | ✅ Complete |
| Contact ↔ Client linking | ✅ Complete |
| Contact ↔ Lead linking | ✅ Complete |
| Primary contact flag | ✅ Complete |
| Search by name/email | ✅ Complete |
| Settings management UI | ✅ Complete |

### What's Missing ❌
| Feature | Effort | Priority |
|---------|--------|----------|
| Contact enrichment (Clearbit, Apollo) | Medium | High |
| Communication history view | Medium | High |
| Contact activity timeline | Medium | Medium |
| Duplicate detection/merge | Medium | Medium |
| Contact import (CSV) | Low | Low |
| Contact export | Low | Low |

### Status
**60% Complete** - Basic CRUD works. Needs enrichment and deeper integration.

---

## 6. Bug Bot (Autonomous Bug Fixing)

**Category:** Code Execution

### What It Should Do
- Receive bug reports from email, Slack, or form
- Automatically analyze and prioritize bugs
- Clone repo into sandboxed container
- Use Claude agent to investigate and fix
- Run tests to validate fix
- Create PR with explanation
- Notify team on success/failure

### What We Have Now ✅
| Feature | Status |
|---------|--------|
| Comprehensive PRD/design docs | ✅ Complete |
| GitHub OAuth & repo linking | ✅ Complete |
| GitHub API (basic operations) | ✅ Partial |
| AI infrastructure (Vercel AI Gateway) | ✅ Complete |
| Suggestions table | ✅ Complete |
| Email sync for bug detection | ✅ Partial |
| Activity logging | ✅ Complete |

### What's Missing ❌
| Feature | Effort | Priority |
|---------|--------|----------|
| Job queue (pg-boss) | Medium | Critical |
| Bug intake API | Medium | Critical |
| Docker sandbox | Medium | Critical |
| Claude agent loop | High | Critical |
| Tool executor | High | Critical |
| PR creation workflow | Medium | High |
| Cost tracking | Low | High |
| Kill switch / safety | Low | High |

### Roadmap
| Phase | Features | Timeline |
|-------|----------|----------|
| 0. Job Queue | pg-boss setup, worker process | 1 week |
| 1. Codebase Intel | Analyzer agents, knowledge store | 2-3 weeks |
| 2. Bug Intake | Detection, intake API, classification | 2-3 weeks |
| 3. Sandbox | Docker container orchestration | 1-2 weeks |
| 4. Agent Loop | Claude tools, agentic execution | 2-3 weeks |
| 5. PR Creation | GitHub PR, notifications | 1-2 weeks |
| 6. Monitoring | Costs, safety, alerts | 1 week |

**Total Timeline:** 10-14 weeks

---

## Recommended Build Order

Based on dependencies, value delivery, and current state:

### Tier 1: Immediate (Now)
| System | Reason |
|--------|--------|
| **Chat System** | Eliminates context switching, builds on existing Supabase |
| **Gmail Reply** | Completes email workflow, high team value |

### Tier 2: Next Quarter
| System | Reason |
|--------|--------|
| **CRM Automation** | Lead scoring + workflows unlock sales efficiency |
| **Contact Enrichment** | Improves CRM data quality |

### Tier 3: Future
| System | Reason |
|--------|--------|
| **Bug Bot** | Complex, requires stable foundation first |
| **Advanced PM features** | Current system is sufficient |

---

## Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│                        FOUNDATION                            │
│  Projects/Tasks/Hours (90%) ─── Contacts (60%)              │
│         │                           │                        │
│         ▼                           ▼                        │
│  ┌─────────────┐            ┌─────────────┐                 │
│  │   Gmail     │◄──────────►│    CRM      │                 │
│  │   (70%)     │            │   (40%)     │                 │
│  └─────────────┘            └─────────────┘                 │
│         │                           │                        │
│         ▼                           │                        │
│  ┌─────────────┐                    │                        │
│  │    Chat     │◄───────────────────┘                       │
│  │   (0%)      │  Unified inbox                             │
│  └─────────────┘                                            │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                     Bug Bot                              ││
│  │  Depends on: GitHub, Projects, Job Queue, AI infra      ││
│  │  (5% - Design Complete, Build Later)                    ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## Key Decisions Needed

1. **Chat System Scope**
   - ✅ Decided: ADMIN only, DMs + Groups, fresh start

2. **CRM Priority**
   - Lead scoring vs workflow automation first?
   - Which enrichment provider (Apollo, ZoomInfo, Clearbit)?

3. **Bug Bot Timeline**
   - Start Phase 0 (job queue) now or defer?
   - Cost budget for Claude Opus ($5-15/fix)?

4. **Gmail Reply**
   - Add compose UI now or wait for chat?
   - Template system scope?

---

## Summary Table

| System | Current | Target | Gap | Weeks |
|--------|---------|--------|-----|-------|
| Gmail | 70% | 90% | Reply, search | 3-4 |
| Chat | 0% | 100% | Everything | 6 |
| CRM | 40% | 70% | Scoring, workflows | 6-8 |
| Projects | 90% | 95% | Polish | 2 |
| Contacts | 60% | 80% | Enrichment | 2-3 |
| Bug Bot | 5% | 50% | Core system | 10-14 |

---

*Document generated: January 2025*
*Location: `docs/plans/communication/system-overview.md`*
