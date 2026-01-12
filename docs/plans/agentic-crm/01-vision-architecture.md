# Agentic CRM: Vision & Architecture

## Overview

This document outlines the vision for transforming the PTS Portal into a **fully agentic CRM** powered by Google Workspace integrations. The system will not just store data—it will actively work alongside the team by observing, analyzing, suggesting, and (with approval) acting on behalf of users.

**Key Principle:** Human-in-the-loop. The AI suggests and drafts; humans review and approve.

---

## Table of Contents

1. [Traditional vs Agentic CRM](#traditional-vs-agentic-crm)
2. [Core Architecture](#core-architecture)
3. [Gmail API Capabilities](#gmail-api-capabilities)
4. [Current State Assessment](#current-state-assessment)
5. [The Lead Entity Model](#the-lead-entity-model)
6. [The Five Agentic Loops](#the-five-agentic-loops)

---

## Traditional vs Agentic CRM

### Traditional CRM (Passive Database)

- Manually create leads
- Manually update statuses
- Manually remember to follow up
- Manually log communications
- Manually decide next actions

### Agentic CRM (Active Partner)

- Detects leads automatically from emails
- Suggests status changes based on signals
- Prompts when follow-up is needed
- Logs communications automatically
- Recommends next best actions

---

## Core Architecture

### Gmail as CRM Backbone

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           GMAIL AS CRM BACKBONE                             │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐ │
│  │  📥 INBOUND     │        │  🤖 AI AGENTS   │        │  📤 OUTBOUND    │ │
│  │                 │        │                 │        │                 │ │
│  │  • Read emails  │───────▶│  • Analyze      │───────▶│  • Send emails  │ │
│  │  • Sync threads │        │  • Classify     │        │  • Create drafts│ │
│  │  • Parse intent │        │  • Extract      │        │  • Reply        │ │
│  │  • Match entity │        │  • Suggest      │        │  • Forward      │ │
│  └─────────────────┘        │  • Generate     │        └─────────────────┘ │
│         ▲                   └────────┬────────┘               │            │
│         │                            │                        │            │
│         │                            ▼                        │            │
│         │                   ┌─────────────────┐               │            │
│         │                   │  💾 PORTAL DB   │               │            │
│         │                   │                 │               │            │
│         └───────────────────│  • Leads        │◀──────────────┘            │
│                             │  • Clients      │                            │
│                             │  • Projects     │                            │
│                             │  • Tasks        │                            │
│                             │  • Activity     │                            │
│                             └─────────────────┘                            │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

### The Agentic Loop

```
┌─────────┐
│  GMAIL  │◀──────────────────────────────────────────┐
└────┬────┘                                            │
     │                                                 │
     │ sync                                            │ send
     ▼                                                 │
┌─────────┐      ┌─────────┐      ┌─────────┐     ┌───┴─────┐
│ OBSERVE │─────▶│ ANALYZE │─────▶│ SUGGEST │────▶│ APPROVE │
└─────────┘      └─────────┘      └─────────┘     └─────────┘
     │                │                │               │
     ▼                ▼                ▼               ▼
┌─────────┐      ┌─────────┐      ┌─────────┐     ┌─────────┐
│ threads │      │ analysis│      │ actions │     │ sent_   │
│ messages│      │         │      │ drafts  │     │ emails  │
└─────────┘      └─────────┘      └─────────┘     └─────────┘
```

**Human-in-the-loop at APPROVE stage** (can be automated for low-risk actions)

---

## Gmail API Capabilities

### Full API Surface

| Category | Operation | Description |
|----------|-----------|-------------|
| **Messages** | `messages.list` | List messages with query filters |
| | `messages.get` | Get specific message (metadata, full, raw, minimal) |
| | `messages.send` | Send email (supports attachments, HTML, plain text) |
| | `messages.insert` | Insert message directly (bypass sending) |
| | `messages.delete` | Permanently delete |
| | `messages.trash` / `untrash` | Move to/from trash |
| | `messages.modify` | Add/remove labels |
| | `messages.batchDelete` | Delete multiple messages |
| | `messages.batchModify` | Modify labels on multiple messages |
| **Attachments** | `messages.attachments.get` | Download attachment by ID |
| **Drafts** | `drafts.list` | List all drafts |
| | `drafts.get` | Get specific draft |
| | `drafts.create` | Create new draft |
| | `drafts.update` | Update existing draft |
| | `drafts.delete` | Delete draft |
| | `drafts.send` | Send existing draft |
| **Threads** | `threads.list` | List email threads |
| | `threads.get` | Get all messages in thread |
| | `threads.delete` | Permanently delete thread |
| | `threads.trash` / `untrash` | Move to/from trash |
| | `threads.modify` | Add/remove labels |
| **Labels** | `labels.list` | List all labels (system + user) |
| | `labels.get` | Get label details |
| | `labels.create` | Create custom label |
| | `labels.update` | Update label (name, visibility, colors) |
| | `labels.delete` | Delete user label |
| **History** | `history.list` | Get changes since history ID (for sync) |
| **Push** | `watch` | Start push notifications via Pub/Sub |
| | `stop` | Stop push notifications |
| **Settings** | Various | Auto-forwarding, IMAP, POP, vacation, filters, delegates |

### Key Limitations

| Limit | Value |
|-------|-------|
| Max attachment size | 25 MB (35 MB base64 encoded) |
| Daily sending limit | 500-2000 (varies by account type) |
| Rate limit | 250 quota units/user/second |
| Batch request max | 100 requests per batch |
| History retention | ~30 days of changes |
| Push watch expiration | 7 days (must renew) |

---

## Current State Assessment

### What We Have (Strong Foundation)

| Capability | Status | Notes |
|------------|--------|-------|
| OAuth flow (token exchange, refresh, revoke) | ✅ Complete | Multi-account support |
| Token encryption (AES-256-GCM) | ✅ Complete | Secure storage |
| Gmail read/sync (messages, threads, history) | ✅ Complete | Incremental sync |
| Thread/Message schema | ✅ Complete | Full data model |
| Email → Client matching | ✅ Complete | Domain-based |
| Basic inbox UI | ✅ Complete | Thread list view |
| Lead kanban board | ✅ Complete | Drag-drop, 7 columns |
| Lead CRUD operations | ✅ Complete | Full management |
| Lead webhook intake | ✅ Complete | Website form integration |

### What's Missing

| Capability | Gmail API | Purpose |
|------------|-----------|---------|
| Send email | `messages.send` | Outreach, follow-ups, proposals |
| Create draft | `drafts.create` | AI-generated email review |
| Update draft | `drafts.update` | Iterative composition |
| Send draft | `drafts.send` | Send after human review |
| Reply in thread | `messages.send` + headers | Client communication |
| Attachments (send) | Multipart MIME | Proposals, contracts |
| Labels (manage) | `labels.*` | CRM organization |
| Calendar integration | Calendar API | Meeting scheduling |
| Drive integration | Drive API | Document management |

---

## The Lead Entity Model

### Lead as a Living Object

A lead is no longer just a database record—it's a living entity with:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           LEAD ENTITY MODEL                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   CORE IDENTITY                                                          │
│   ─────────────                                                          │
│   Contact: Sarah Chen                                                    │
│   Company: TechStart Inc                                                 │
│   Email: sarah@techstart.io                                              │
│   Source: Website form (Jan 5)                                           │
│                                                                          │
│   COMMUNICATION TIMELINE                                                 │
│   ──────────────────────                                                 │
│   Jan 5  📥 Inbound: Website form submission                            │
│   Jan 6  📤 Outbound: Initial outreach (you)                            │
│   Jan 8  📥 Inbound: Reply - interested, wants to chat                  │
│   Jan 9  📤 Outbound: Calendar link sent                                │
│   Jan 12 📅 Meeting: Discovery call (45 min)                            │
│   Jan 15 📤 Outbound: Proposal sent                                     │
│   Jan 18 📥 Inbound: Questions about pricing                            │
│                                                                          │
│   AI INTELLIGENCE                                                        │
│   ───────────────                                                        │
│   Score: 78/100 (High quality)                                          │
│   Signals:                                                               │
│     ✓ Fast response time (< 24 hrs)                                     │
│     ✓ Asked specific technical questions                                │
│     ✓ Company has funding (detected)                                    │
│     ⚠ Price sensitivity detected in last email                          │
│                                                                          │
│   Predicted close: 65% likely                                           │
│   Estimated value: $15,000                                              │
│   Risk: Medium (competitor mentioned)                                   │
│                                                                          │
│   SUGGESTED ACTIONS                                                      │
│   ─────────────────                                                      │
│   🔴 HIGH: Reply to pricing questions (2 days overdue)                  │
│      [View Draft] [Dismiss]                                              │
│                                                                          │
│   🟡 MEDIUM: Schedule follow-up call to address concerns                │
│      [Schedule] [Dismiss]                                                │
│                                                                          │
│   🟢 LOW: Research competitor they mentioned                            │
│      [Create Task] [Dismiss]                                             │
│                                                                          │
│   LINKED ENTITIES                                                        │
│   ───────────────                                                        │
│   Contacts: Sarah Chen (primary), Mike Johnson (CTO)                    │
│   Threads: 3 email threads linked                                       │
│   Meetings: 1 completed, 0 scheduled                                    │
│   Proposals: 1 sent (awaiting response)                                 │
│   Tasks: 2 open (reply, research)                                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Lead Relationship Model

```
                              ┌──────────┐
                              │   LEAD   │
                              └────┬─────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         │                         │                         │
         ▼                         ▼                         ▼
   ┌───────────┐            ┌───────────┐            ┌───────────┐
   │ CONTACTS  │            │  THREADS  │            │ PROPOSALS │
   │           │            │  (Gmail)  │            │           │
   │ • Primary │            │ • Inbound │            │ • Drafts  │
   │ • Others  │            │ • Outbound│            │ • Sent    │
   └───────────┘            └───────────┘            │ • Viewed  │
         │                        │                  └───────────┘
         │                        ▼                        │
         │                  ┌───────────┐                  │
         │                  │ MESSAGES  │                  │
         │                  └───────────┘                  │
         │                        │                        │
         │         ┌──────────────┼──────────────┐        │
         │         ▼              ▼              ▼        │
         │   ┌──────────┐  ┌──────────┐  ┌──────────┐    │
         │   │ MEETINGS │  │  TASKS   │  │ ANALYSIS │    │
         │   │ (GCal)   │  │          │  │   (AI)   │    │
         │   └──────────┘  └──────────┘  └──────────┘    │
         │        │                            │          │
         │        └────────────┬───────────────┘          │
         │                     ▼                          │
         │             ┌───────────────┐                  │
         │             │   ACTIVITY    │                  │
         │             │    LOG        │                  │
         │             └───────────────┘                  │
         │                     │                          │
         │                     │ On CLOSED_WON            │
         │                     ▼                          │
         │             ┌───────────────┐      ┌───────────────┐
         └────────────▶│    CLIENT     │─────▶│   PROJECT     │
           Contacts    │               │      │               │
           migrate     │ Inherits:     │      │ Initial scope │
                       │ • Contacts    │      │ from proposal │
                       │ • Threads     │      │               │
                       │ • History     │      │               │
                       └───────────────┘      └───────────────┘
```

---

## The Five Agentic Loops

### Loop 1: Lead Detection (Email → Lead)

**Trigger:** New email arrives from unknown sender (not matching existing client/lead)

```
┌─────────────────────────────────────────────────────────────────────────┐
│   AI ANALYSIS                                                            │
│                                                                          │
│   Input:                                                                 │
│   • Email content, subject, sender                                       │
│   • Sender's domain                                                      │
│   • Any previous emails from this sender                                 │
│                                                                          │
│   Detect:                                                                │
│   • Is this a potential business inquiry?                                │
│   • What service are they interested in?                                 │
│   • What's their urgency level?                                          │
│   • Company info extraction                                              │
│                                                                          │
│   Output:                                                                │
│   • isLead: boolean                                                      │
│   • confidence: 0-1                                                      │
│   • extractedData: { name, company, intent, urgency }                    │
└─────────────────────────────────────────────────────────────────────────┘
```

**If confidence >= 0.7:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│   SUGGESTION CARD (in Inbox)                                             │
│                                                                          │
│   🎯 Potential Lead Detected                                             │
│                                                                          │
│   From: alex@newstartup.com                                              │
│   Company: NewStartup (detected)                                         │
│   Intent: Looking for web development help                               │
│   Confidence: 85%                                                        │
│                                                                          │
│   [Create Lead] [Not a Lead] [Review Email]                              │
└─────────────────────────────────────────────────────────────────────────┘
```

**On "Create Lead":**
- Lead created with extracted data
- Thread linked to lead
- Contact created/linked
- AI drafts initial response
- Activity logged

---

### Loop 2: Lead Qualification (Scoring & Signals)

**Trigger:** Any lead activity (new email, status change, time elapsed)

**Scoring Dimensions (100 points total):**

| Dimension | Points | Factors |
|-----------|--------|---------|
| **Engagement** | 0-25 | Response time, back-and-forth count, questions asked, meeting attendance |
| **Fit** | 0-25 | Company size, industry match, budget signals, technical requirements match |
| **Intent** | 0-25 | Urgency signals, specificity, decision-maker involvement |
| **Momentum** | 0-25 | Days since last contact (decay), stage velocity, proposal engagement |

**Signal Detection:**

```
Signals detected in communications:
✓ "Need this by end of Q1" (urgency)
✓ CTO involved in thread (decision-maker)
⚠ Mentioned evaluating other agencies (competition)
✓ Asked detailed technical questions (serious buyer)
✗ "Just exploring options" (low intent)
```

**Output Display:**

```
Lead Score: 78/100                     ▲ +5 from last week

████████████████████░░░░░  Engagement: 22/25
████████████████░░░░░░░░░  Fit: 18/25
██████████████████████░░░  Intent: 23/25
███████████████░░░░░░░░░░  Momentum: 15/25

Close Probability: 65%
Estimated Value: $15,000
Risk Level: Medium
```

---

### Loop 3: Next Best Action

**Trigger:** Continuous (re-evaluated on any lead change or daily)

**Action Types:**

| Type | Priority | Trigger |
|------|----------|---------|
| **RESPOND** | Highest | Unanswered inbound email, pending question, objection |
| **FOLLOW_UP** | High | No response 3+ days, meeting unconfirmed, proposal no feedback 5+ days |
| **ADVANCE** | Medium | Ready to schedule meeting, should send proposal, contract ready |
| **NURTURE** | Low | Lead on ice, periodic check-in due, share relevant content |
| **CLOSE** | Variable | Proposal past valid date, need decision, contract ready for signature |

**For Each Action:**
- AI generates draft email/message
- Suggests calendar availability (if meeting)
- Provides context summary
- Estimates impact on close probability

**Display:**

```
Suggested Actions

🔴 Reply to pricing question           2 days overdue
   "Sarah asked about our hourly rate vs fixed..."
   [View Draft] [Write My Own] [Snooze]

🟡 Schedule discovery call             Ready to advance
   "Lead is qualified, next step is discovery meeting"
   [Send Calendar Link] [Custom Message]

🟢 Send case study                     Nurture opportunity
   "Similar project: E-commerce rebuild for RetailCo"
   [Send] [Different Case Study] [Skip]
```

---

### Loop 4: Status Auto-Advancement

**Trigger:** AI detects signals that should trigger status changes

**Signal → Status Mapping:**

| Transition | Signals |
|------------|---------|
| NEW → ACTIVE | First reply sent/received, or meeting scheduled |
| ACTIVE → PROPOSAL_SENT | Email with proposal attachment, or proposal record created |
| PROPOSAL_SENT → CLOSED_WON | "Accept", "let's proceed", contract signed, payment received |
| ANY → ON_ICE | "Not right now", "maybe later", no response 30+ days |
| ANY → CLOSED_LOST | Explicit rejection, unresolved budget objection |

**Behavior:** Suggest, don't auto-change

```
📊 Status Change Suggested

Move "TechStart Inc" from PROPOSAL_SENT → CLOSED_WON?

Reason: Sarah's email says "Let's proceed with the
proposal. Can you send over the contract?"

[Confirm] [Not Yet] [Mark as CLOSED_LOST instead]
```

---

### Loop 5: Lead → Client Conversion

**Trigger:** Lead status = CLOSED_WON

**Conversion Wizard:**

```
Step 1: Confirm Client Details
┌────────────────────────────────────────────────────────────────┐
│  Company: TechStart Inc                    [Edit]              │
│  Primary Contact: Sarah Chen               [Edit]              │
│  Email: sarah@techstart.io                 [Edit]              │
│  Billing Type: ○ Prepaid  ● Net 30                             │
└────────────────────────────────────────────────────────────────┘

Step 2: Create Initial Project
┌────────────────────────────────────────────────────────────────┐
│  Project Name: TechStart Web Platform      [Auto-generated]    │
│  Type: ● Client  ○ Internal                                    │
│                                                                │
│  Import from Proposal:                                         │
│  ☑ Scope items as tasks                                       │
│  ☑ Timeline as milestones                                     │
│  ☑ Budget as hour block                                       │
└────────────────────────────────────────────────────────────────┘

Step 3: Migrate Communications
┌────────────────────────────────────────────────────────────────┐
│  ☑ Link 3 email threads to new client                         │
│  ☑ Move contacts to client                                    │
│  ☑ Transfer activity history                                  │
│  ☑ Set up email domain matching (future emails auto-link)     │
└────────────────────────────────────────────────────────────────┘

                          [Convert to Client]
```

**Post-Conversion:**
- Lead archived (soft delete)
- Client record created
- Project created with tasks from proposal
- Hour block created if prepaid
- Email threads re-linked to client
- Future emails from domain auto-match to client
- Welcome email drafted
- Onboarding tasks created

---

## Next Steps

1. Review [Google Workspace Integration](./02-google-workspace-integration.md) for full integration details
2. Review [Experimental Features](./03-experimental-features.md) for advanced capabilities
3. Review [Schema Extensions](./04-schema-extensions.md) for database changes
4. Review [Implementation Roadmap](./05-implementation-roadmap.md) for prioritization

---

*Related: `docs/roadmap/agency-pipeline-flowchart.md`, `docs/roadmap/roadmap-phases.md`*
