# Agentic CRM Vision: Google Workspace Integration

## Overview

This document outlines the vision for transforming the PTS Portal into a **fully agentic CRM** powered by Google Workspace integrations. The system will not just store data—it will actively work alongside the team by observing, analyzing, suggesting, and (with approval) acting on behalf of users.

**Key Principle:** Human-in-the-loop. The AI suggests and drafts; humans review and approve.

---

## Table of Contents

1. [Gmail API Capabilities](#1-gmail-api-capabilities)
2. [Current State Assessment](#2-current-state-assessment)
3. [The Agentic CRM Model](#3-the-agentic-crm-model)
4. [Lead Entity Deep Dive](#4-lead-entity-deep-dive)
5. [The Five Agentic Loops](#5-the-five-agentic-loops)
6. [Google Workspace Integrations](#6-google-workspace-integrations)
7. [Schema Extensions](#7-schema-extensions)
8. [Implementation Priority](#8-implementation-priority)
9. [OAuth Scopes Reference](#9-oauth-scopes-reference)

---

## 1. Gmail API Capabilities

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

## 2. Current State Assessment

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

## 3. The Agentic CRM Model

### Traditional vs Agentic CRM

**Traditional CRM (Passive Database):**
- Manually create leads
- Manually update statuses
- Manually remember to follow up
- Manually log communications
- Manually decide next actions

**Agentic CRM (Active Partner):**
- Detects leads automatically from emails
- Suggests status changes based on signals
- Prompts when follow-up is needed
- Logs communications automatically
- Recommends next best actions

### Core Architecture

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

## 4. Lead Entity Deep Dive

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

## 5. The Five Agentic Loops

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

## 6. Google Workspace Integrations

### Integration by CRM Stage

#### Lead Intake & Qualification

| Service | Integration |
|---------|-------------|
| **Gmail** | Detect leads from inbound, track threads, send outreach, analyze sentiment |
| **Google Forms** | Contact form → auto-create lead, qualification questionnaire, discovery prep |
| **Google Contacts** | Bidirectional sync, contact groups (Leads/Clients/Partners), enrichment |
| **Calendar** | Check availability, create discovery calls, auto-include Meet link |

#### Sales & Proposals

| Service | Integration |
|---------|-------------|
| **Google Meet** | Auto-generate links, record meetings, AI transcription → notes, extract action items |
| **Google Docs** | Proposal documents (templated), SOWs, contracts, meeting notes |
| **Google Slides** | Pitch decks, project proposals, case studies |
| **Google Drive** | Auto-create client folders, share with contacts, track document views |

#### Project Delivery

| Service | Integration |
|---------|-------------|
| **Google Docs** | PRDs (AI-generated), technical specs, client documentation |
| **Google Sheets** | Budget tracking, time log exports, feature matrices |
| **Google Meet** | Weekly status calls, sprint reviews, technical deep-dives |
| **Google Chat** | Client Spaces for quick questions, internal project channels, bot notifications |
| **Google Tasks** | Bidirectional sync with portal tasks |
| **Google Drive** | Design assets, client uploads, deliverable staging |

#### Client Relationship

| Service | Integration |
|---------|-------------|
| **Gmail** | Auto-link client emails, detect bugs/feature requests, sentiment monitoring |
| **Google Forms** | Feedback surveys, bug reports, feature requests, NPS surveys |
| **Google Sheets** | Hour block usage, monthly reports, invoice reconciliation |
| **Calendar** | Recurring check-ins, renewal reminders, milestone dates |

### Google Meet: Meeting Intelligence

```
BEFORE MEETING
──────────────
• Auto-create Meet link when scheduling
• Generate meeting prep brief:
  - Lead/client context summary
  - Recent email threads
  - Open tasks/issues
  - Suggested talking points
• Send agenda to attendees

DURING MEETING
──────────────
• Record meeting (with consent toggle)
• Live transcription (Google's built-in)
• Track attendance/duration

AFTER MEETING
─────────────
• Pull transcript from Drive
• AI processing:
  - Generate summary (key points)
  - Extract action items
  - Identify decisions made
  - Detect sentiment/concerns
  - Flag follow-up needed

• Auto-create:
  - Tasks from action items
  - Meeting notes in linked Google Doc
  - Follow-up email draft
  - Lead/project activity log entry

• Store recording link in meeting record
```

**Example Flow:**
1. Schedule discovery call with lead
2. Portal creates Calendar event + Meet link
3. Morning of: Portal generates prep brief
4. Meeting happens, recorded
5. Post-call: Transcript pulled, AI analyzes
6. Summary appears in lead timeline
7. Tasks created: "Send proposal", "Research competitor X"
8. Follow-up email draft ready for review
9. Lead score updated based on meeting signals

### Google Drive: File System Structure

```
📁 PTS Agency/
├── 📁 Leads/
│   └── 📁 {LeadName}/                      ← Created on lead creation
│       ├── 📁 Communications/
│       ├── 📁 Proposals/
│       └── 📁 Meeting Recordings/
│
├── 📁 Clients/
│   └── 📁 {ClientName}/                    ← Created on conversion
│       ├── 📁 Contracts/
│       ├── 📁 Projects/
│       │   └── 📁 {ProjectName}/
│       │       ├── 📁 PRD/
│       │       ├── 📁 Designs/
│       │       ├── 📁 Deliverables/
│       │       └── 📁 Meeting Notes/
│       ├── 📁 Hour Blocks/
│       │   └── 📄 Usage Reports
│       └── 📁 Communications/
│
├── 📁 Templates/
│   ├── 📄 Proposal Template
│   ├── 📄 SOW Template
│   ├── 📄 Contract Template
│   ├── 📄 PRD Template
│   └── 📊 Pitch Deck Template
│
└── 📁 Internal/
    ├── 📁 Case Studies/
    ├── 📁 Processes/
    └── 📁 Team/
```

**Capabilities:**
- Watch for file changes (Drive Activity API)
- Track document views (who viewed proposal?)
- Permission management (share with client)
- Copy from templates with variable substitution
- Link files to leads/clients/projects in portal
- Search across all client files
- Automatic archival of completed projects

### Google Docs: Living Documents

**Proposals:**
1. Copy from template
2. AI fills sections based on lead info, meeting notes, email context
3. Human reviews/edits in Google Docs
4. Share link sent to client
5. Track: view count, comments, edit history

**PRDs:**
1. AI generates from SOW + meeting context
2. Creates Google Doc with sections: Overview, Goals, User Stories, Technical Requirements, Out of Scope
3. Client reviews, adds comments
4. Team resolves comments
5. Approval tracked in portal
6. AI parses approved PRD → generates task suggestions

**Meeting Notes:**
- Auto-created from Meet transcript
- AI-summarized into structured format
- Action items highlighted
- Linked to meeting record in portal
- Shared with attendees automatically

### Google Forms: Structured Data Capture

| Form Type | Purpose | On Submit |
|-----------|---------|-----------|
| **Lead Intake** | Embedded on marketing site | Create lead, AI enrichment, auto-assign, confirmation email |
| **Discovery Questionnaire** | Sent after initial contact | Attach to lead, generate meeting prep, update lead score |
| **Bug Report** | Structured bug intake for clients | Create bug in portal, link to project, queue BugBot, notify client |
| **Client Feedback / NPS** | Quarterly or post-project | Attach to client, AI sentiment analysis, low scores trigger alert |
| **Project Retrospective** | Post-project completion | Create retro document, feed knowledge base, inform future estimates |

### Google Chat: Real-Time Communication

**Space Types:**

| Type | Members | Purpose |
|------|---------|---------|
| **Client Spaces** | Client contacts + team | Quick questions, status updates, file sharing |
| **Project Spaces** | Internal team only | Technical discussions, PR reviews, blockers |

**Bot Notifications:**

```
📬 New client email from Sarah (TechStart)
   "Questions about the timeline for phase 2..."
   [View Thread] [Reply]

✅ Task completed: "Set up CI/CD pipeline"
   Project: TechStart Web Platform
   [View Task]

🔔 Hour block alert: TechStart at 15% remaining
   8 hours left of 50 hour block
   [View Details] [Draft Renewal Email]

🐛 BugBot created PR for: "Checkout crash on submit"
   Confidence: High | Tests: Passing
   [Review PR] [View Bug Report]

🎯 Potential lead detected from email
   From: alex@newstartup.com
   [Create Lead] [Not a Lead]
```

---

## 7. Schema Extensions

### Lead Intelligence Table

```sql
CREATE TABLE lead_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,

  -- Scoring
  score INTEGER CHECK (score >= 0 AND score <= 100),
  engagement_score INTEGER CHECK (engagement_score >= 0 AND engagement_score <= 25),
  fit_score INTEGER CHECK (fit_score >= 0 AND fit_score <= 25),
  intent_score INTEGER CHECK (intent_score >= 0 AND intent_score <= 25),
  momentum_score INTEGER CHECK (momentum_score >= 0 AND momentum_score <= 25),

  -- Predictions
  close_probability NUMERIC(3,2), -- 0.00 to 1.00
  estimated_value INTEGER,
  estimated_close_date DATE,

  -- Signals
  signals JSONB DEFAULT '[]',
  -- [{ "type": "URGENCY", "text": "Need by Q1", "confidence": 0.9 }]

  -- Risk
  risk_level VARCHAR(20), -- LOW, MEDIUM, HIGH
  risk_factors JSONB DEFAULT '[]',

  -- AI metadata
  last_analyzed_at TIMESTAMPTZ,
  model_version VARCHAR(100),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Lead Actions Table

```sql
CREATE TABLE lead_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,

  -- Action details
  action_type VARCHAR(50) NOT NULL,
  -- RESPOND, FOLLOW_UP, ADVANCE, NURTURE, CLOSE
  priority VARCHAR(20) NOT NULL, -- HIGH, MEDIUM, LOW

  title TEXT NOT NULL,
  description TEXT,

  -- Generated content
  draft_subject TEXT,
  draft_body TEXT,

  -- Context
  trigger_reason TEXT,
  related_message_id UUID REFERENCES messages(id),

  -- Status
  status VARCHAR(20) DEFAULT 'PENDING',
  -- PENDING, ACCEPTED, DISMISSED, COMPLETED, EXPIRED

  -- Timing
  due_at TIMESTAMPTZ,
  snoozed_until TIMESTAMPTZ,

  -- Resolution
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id),
  resolution_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Lead Timeline Table

```sql
CREATE TABLE lead_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,

  event_type VARCHAR(50) NOT NULL,
  -- EMAIL_RECEIVED, EMAIL_SENT, MEETING_SCHEDULED, MEETING_COMPLETED,
  -- STATUS_CHANGED, PROPOSAL_SENT, PROPOSAL_VIEWED, NOTE_ADDED,
  -- SCORE_UPDATED, ACTION_COMPLETED

  -- Polymorphic reference
  related_type VARCHAR(50),
  related_id UUID,

  -- Event data
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',

  -- Actor
  actor_type VARCHAR(20), -- USER, SYSTEM, CONTACT
  actor_id UUID,
  actor_name TEXT,

  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Lead-Thread Linking Table

```sql
CREATE TABLE lead_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  thread_id UUID REFERENCES threads(id) ON DELETE CASCADE,

  linked_at TIMESTAMPTZ DEFAULT NOW(),
  linked_by UUID REFERENCES users(id),
  link_type VARCHAR(20) DEFAULT 'MANUAL', -- MANUAL, AUTO_DETECTED

  UNIQUE(lead_id, thread_id)
);
```

### Lead Meetings Table

```sql
CREATE TABLE lead_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,

  -- Calendar integration
  calendar_event_id VARCHAR(255),
  calendar_connection_id UUID REFERENCES oauth_connections(id),

  -- Meeting details
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  location TEXT,

  -- Attendees
  attendees JSONB DEFAULT '[]',

  -- Status
  status VARCHAR(20) DEFAULT 'SCHEDULED',
  -- SCHEDULED, CONFIRMED, COMPLETED, CANCELLED, NO_SHOW

  -- Notes
  prep_notes TEXT,
  meeting_notes TEXT,

  -- Follow-up
  follow_up_actions JSONB DEFAULT '[]',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Sent Emails Table

```sql
CREATE TABLE sent_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  connection_id UUID REFERENCES oauth_connections(id),

  -- Gmail references
  gmail_message_id VARCHAR(255),
  gmail_thread_id VARCHAR(255),

  -- Recipients
  to_emails TEXT[] NOT NULL,
  cc_emails TEXT[],
  bcc_emails TEXT[],

  -- Content
  subject TEXT NOT NULL,
  body_text TEXT,
  body_html TEXT,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  -- DRAFT, QUEUED, SENDING, SENT, FAILED

  sent_at TIMESTAMPTZ,
  error_message TEXT,

  -- Entity linking
  related_entity_type VARCHAR(50), -- LEAD, CLIENT, PROJECT, BUG
  related_entity_id UUID,

  -- AI tracking
  ai_generated BOOLEAN DEFAULT false,
  ai_model VARCHAR(100),
  human_edited BOOLEAN DEFAULT false,

  -- Template
  template_id UUID,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Email Templates Table

```sql
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name VARCHAR(255) NOT NULL,
  category VARCHAR(50), -- SALES, SUPPORT, NOTIFICATION

  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL, -- Supports {{variables}}

  variables JSONB DEFAULT '[]',

  is_ai_editable BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,

  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Leads Table Extensions

```sql
ALTER TABLE leads ADD COLUMN IF NOT EXISTS
  expected_value INTEGER,
  expected_close_date DATE,
  last_contact_at TIMESTAMPTZ,
  last_contact_type VARCHAR(20), -- INBOUND, OUTBOUND
  days_in_stage INTEGER DEFAULT 0,
  stage_entered_at TIMESTAMPTZ DEFAULT NOW();
```

---

## 8. Implementation Priority

### Phase Priority Matrix

| Phase | Name | PRs | Priority | Dependencies |
|-------|------|-----|----------|--------------|
| 0.5 | Gmail Send/Compose | 7 | 🔴 Critical | Phase 0 |
| 1 | Calendar Integration | 4 | 🔴 Critical | Phase 0.5 |
| 2 | Enhanced Sales Pipeline | 6 | 🟠 High | Phase 0.5, 1 |
| 3 | Proposal System | 7 | 🟠 High | Phase 2 |

### Integration Priority Matrix

| Integration | Value | Complexity | Priority |
|-------------|-------|------------|----------|
| **Gmail Send/Compose** | 🔴 Critical | Medium | 1 |
| **Calendar** | 🔴 Critical | Medium | 2 |
| **Meet (basic)** | 🟠 High | Low | 3 |
| **Drive (folders)** | 🟠 High | Medium | 4 |
| **Docs (proposals)** | 🟠 High | Medium | 5 |
| **Meet (transcripts)** | 🟡 Medium | High | 6 |
| **Forms (intake)** | 🟡 Medium | Low | 7 |
| **Chat (notifications)** | 🟡 Medium | Medium | 8 |
| **Sheets (reports)** | 🟢 Nice | Low | 9 |
| **Slides (decks)** | 🟢 Nice | Medium | 10 |
| **Contacts (sync)** | 🟢 Nice | Low | 11 |
| **Tasks (sync)** | 🟢 Nice | Low | 12 |

### Agentic Feature Priority

| Feature | Dependencies | Priority |
|---------|--------------|----------|
| Lead-Thread Linking | Gmail sync | 1 |
| Lead Timeline | Lead-Thread linking | 2 |
| Lead Intelligence (scoring) | Lead Timeline, AI | 3 |
| Lead Actions (suggestions) | Lead Intelligence | 4 |
| Lead Detection (from email) | Gmail sync, AI | 5 |
| Lead Meetings | Calendar integration | 6 |
| Lead Conversion | All above | 7 |
| Dashboard | All above | 8 |

---

## 9. OAuth Scopes Reference

### Complete Scope List

```typescript
export const GOOGLE_SCOPES = {
  // Core
  profile: 'https://www.googleapis.com/auth/userinfo.profile',
  email: 'https://www.googleapis.com/auth/userinfo.email',

  // Gmail
  gmailReadonly: 'https://www.googleapis.com/auth/gmail.readonly',
  gmailModify: 'https://www.googleapis.com/auth/gmail.modify',
  gmailSend: 'https://www.googleapis.com/auth/gmail.send',
  gmailCompose: 'https://www.googleapis.com/auth/gmail.compose',

  // Calendar
  calendarReadonly: 'https://www.googleapis.com/auth/calendar.readonly',
  calendarEvents: 'https://www.googleapis.com/auth/calendar.events',

  // Drive
  driveFile: 'https://www.googleapis.com/auth/drive.file',
  driveReadonly: 'https://www.googleapis.com/auth/drive.readonly',

  // Docs
  docsReadonly: 'https://www.googleapis.com/auth/documents.readonly',
  docs: 'https://www.googleapis.com/auth/documents',

  // Sheets
  sheetsReadonly: 'https://www.googleapis.com/auth/spreadsheets.readonly',
  sheets: 'https://www.googleapis.com/auth/spreadsheets',

  // Slides
  slidesReadonly: 'https://www.googleapis.com/auth/presentations.readonly',
  slides: 'https://www.googleapis.com/auth/presentations',

  // Forms
  formsResponsesReadonly: 'https://www.googleapis.com/auth/forms.responses.readonly',

  // Chat
  chatSpaces: 'https://www.googleapis.com/auth/chat.spaces',
  chatMessages: 'https://www.googleapis.com/auth/chat.messages',
  chatMemberships: 'https://www.googleapis.com/auth/chat.memberships',

  // Contacts
  contactsReadonly: 'https://www.googleapis.com/auth/contacts.readonly',
  contacts: 'https://www.googleapis.com/auth/contacts',

  // Tasks
  tasks: 'https://www.googleapis.com/auth/tasks',
  tasksReadonly: 'https://www.googleapis.com/auth/tasks.readonly',
}
```

### Scope Bundles for Incremental Authorization

```typescript
export const SCOPE_BUNDLES = {
  basic: [
    GOOGLE_SCOPES.profile,
    GOOGLE_SCOPES.email
  ],

  email: [
    GOOGLE_SCOPES.gmailReadonly,
    GOOGLE_SCOPES.gmailModify,
    GOOGLE_SCOPES.gmailSend,
    GOOGLE_SCOPES.gmailCompose,
  ],

  calendar: [
    GOOGLE_SCOPES.calendarReadonly,
    GOOGLE_SCOPES.calendarEvents,
  ],

  documents: [
    GOOGLE_SCOPES.driveFile,
    GOOGLE_SCOPES.docs,
    GOOGLE_SCOPES.sheets,
    GOOGLE_SCOPES.slides,
  ],

  collaboration: [
    GOOGLE_SCOPES.chatSpaces,
    GOOGLE_SCOPES.chatMessages,
    GOOGLE_SCOPES.contacts,
  ],
}
```

---

## Summary

This document outlines a vision for transforming the PTS Portal into a fully agentic CRM that:

1. **Observes** - Continuously monitors Gmail, Calendar, and other Google services
2. **Analyzes** - Uses AI to classify intent, score leads, and detect signals
3. **Suggests** - Proposes next best actions with drafted content
4. **Acts** - Sends communications and updates status (with human approval)
5. **Learns** - Improves from approval/rejection patterns

The foundation is **Gmail as the communication backbone**, with Calendar, Drive, Docs, Meet, Forms, and Chat providing supporting capabilities. The key principle throughout is **human-in-the-loop**—the AI assists and drafts, but humans review and approve all actions.

---

## Next Steps

1. **Team Review** - Discuss and prioritize features
2. **Technical Spike** - Prototype Gmail send + draft flow
3. **Schema Design** - Finalize database extensions
4. **Incremental Build** - Follow roadmap phases
5. **Iterate** - Gather feedback, adjust priorities

---

*Document generated: January 2025*
*Related: `agency-pipeline-flowchart.md`, `roadmap-phases.md`*
