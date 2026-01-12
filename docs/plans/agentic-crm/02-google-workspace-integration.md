# Google Workspace Integration

## Overview

This document details the full Google Workspace integration strategy for the agentic CRM. Gmail serves as the communication backbone, with Calendar, Drive, Docs, Meet, Forms, and Chat providing supporting capabilities.

---

## The Full Suite

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        GOOGLE WORKSPACE FOR AGENCY CRM                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│                              ┌─────────────┐                                     │
│                              │   PORTAL    │                                     │
│                              │   (Hub)     │                                     │
│                              └──────┬──────┘                                     │
│                                     │                                            │
│     ┌───────────────────────────────┼───────────────────────────────┐           │
│     │                               │                               │            │
│     ▼                               ▼                               ▼            │
│ ┌─────────┐  ┌─────────┐  ┌─────────────┐  ┌─────────┐  ┌─────────────┐         │
│ │  Gmail  │  │Calendar │  │    Meet     │  │  Drive  │  │    Docs     │         │
│ │         │  │         │  │             │  │         │  │ Sheets      │         │
│ │ Email   │  │ Events  │  │ Video Calls │  │ Storage │  │ Slides      │         │
│ └─────────┘  └─────────┘  └─────────────┘  └─────────┘  └─────────────┘         │
│                                                                                  │
│     ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐                          │
│     │  Forms  │  │ Contacts│  │  Chat   │  │  Tasks  │                          │
│     │         │  │         │  │         │  │         │                          │
│     │ Intake  │  │ People  │  │ Comms   │  │ To-dos  │                          │
│     └─────────┘  └─────────┘  └─────────┘  └─────────┘                          │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Integration by CRM Stage

### Lead Intake & Qualification

| Service | Integration |
|---------|-------------|
| **Gmail** | Detect leads from inbound, track threads, send outreach, analyze sentiment |
| **Google Forms** | Contact form → auto-create lead, qualification questionnaire, discovery prep |
| **Google Contacts** | Bidirectional sync, contact groups (Leads/Clients/Partners), enrichment |
| **Calendar** | Check availability, create discovery calls, auto-include Meet link |

### Sales & Proposals

| Service | Integration |
|---------|-------------|
| **Google Meet** | Auto-generate links, record meetings, AI transcription → notes, extract action items |
| **Google Docs** | Proposal documents (templated), SOWs, contracts, meeting notes |
| **Google Slides** | Pitch decks, project proposals, case studies |
| **Google Drive** | Auto-create client folders, share with contacts, track document views |

### Project Delivery

| Service | Integration |
|---------|-------------|
| **Google Docs** | PRDs (AI-generated), technical specs, client documentation |
| **Google Sheets** | Budget tracking, time log exports, feature matrices |
| **Google Meet** | Weekly status calls, sprint reviews, technical deep-dives |
| **Google Chat** | Client Spaces for quick questions, internal project channels, bot notifications |
| **Google Tasks** | Bidirectional sync with portal tasks |
| **Google Drive** | Design assets, client uploads, deliverable staging |

### Client Relationship

| Service | Integration |
|---------|-------------|
| **Gmail** | Auto-link client emails, detect bugs/feature requests, sentiment monitoring |
| **Google Forms** | Feedback surveys, bug reports, feature requests, NPS surveys |
| **Google Sheets** | Hour block usage, monthly reports, invoice reconciliation |
| **Calendar** | Recurring check-ins, renewal reminders, milestone dates |

---

## Google Meet: Meeting Intelligence

### The Meeting Lifecycle

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

### Example Flow

1. Schedule discovery call with lead
2. Portal creates Calendar event + Meet link
3. Morning of: Portal generates prep brief
4. Meeting happens, recorded
5. Post-call: Transcript pulled, AI analyzes
6. Summary appears in lead timeline
7. Tasks created: "Send proposal", "Research competitor X"
8. Follow-up email draft ready for review
9. Lead score updated based on meeting signals

---

## Google Drive: File System Structure

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

### Capabilities

- Watch for file changes (Drive Activity API)
- Track document views (who viewed proposal?)
- Permission management (share with client)
- Copy from templates with variable substitution
- Link files to leads/clients/projects in portal
- Search across all client files
- Automatic archival of completed projects

---

## Google Docs: Living Documents

### Proposals

1. Copy from template
2. AI fills sections based on lead info, meeting notes, email context
3. Human reviews/edits in Google Docs
4. Share link sent to client
5. Track: view count, comments, edit history

### PRDs (Product Requirements Documents)

1. AI generates from SOW + meeting context
2. Creates Google Doc with sections:
   - Overview
   - Goals & Success Metrics
   - User Stories
   - Technical Requirements
   - Out of Scope
3. Client reviews, adds comments
4. Team resolves comments
5. Approval tracked in portal
6. AI parses approved PRD → generates task suggestions

### Meeting Notes

- Auto-created from Meet transcript
- AI-summarized into structured format
- Action items highlighted
- Linked to meeting record in portal
- Shared with attendees automatically

### API Capabilities

- Create documents from templates (Docs API)
- Replace template variables: `{{client_name}}` → "TechStart"
- Insert content at specific locations
- Read document content (for AI analysis)
- Track revisions
- Export to PDF

---

## Google Forms: Structured Data Capture

| Form Type | Purpose | On Submit |
|-----------|---------|-----------|
| **Lead Intake** | Embedded on marketing site | Create lead, AI enrichment, auto-assign, confirmation email |
| **Discovery Questionnaire** | Sent after initial contact | Attach to lead, generate meeting prep, update lead score |
| **Bug Report** | Structured bug intake for clients | Create bug in portal, link to project, queue BugBot, notify client |
| **Client Feedback / NPS** | Quarterly or post-project | Attach to client, AI sentiment analysis, low scores trigger alert |
| **Project Retrospective** | Post-project completion | Create retro document, feed knowledge base, inform future estimates |

### Lead Intake Form

**Embedded on marketing site**

Fields: Name, Email, Company, Website, Project Description, Budget

On Submit:
- Webhook triggers lead creation in portal
- AI enriches with company research
- Auto-assigns based on inquiry type
- Confirmation email sent

### Discovery Questionnaire

**Sent after initial contact, before discovery call**

Fields: Current tech stack, Pain points, Timeline, Budget range, Decision makers, Success criteria

On Submit:
- Responses attached to lead record
- AI generates meeting prep from responses
- Lead score updated

### Bug Report Form

**Shared with clients for structured bug intake**

Fields: Project (dropdown), Description, Steps to reproduce, Expected vs actual, Screenshots (file upload), Severity

On Submit:
- Bug report created in portal
- Linked to correct project
- BugBot queued for analysis
- Client notified with ticket number

### Client Feedback / NPS

**Sent quarterly or after project completion**

Fields: NPS score (0-10), What's going well, What could improve, Would you refer us, Additional feedback

On Submit:
- Response attached to client record
- AI analyzes sentiment
- Low scores trigger alert to team
- High scores → request testimonial

### Project Retrospective

**Sent at project completion to both team and client**

Fields: What worked, What didn't, Communication rating, Quality rating, Lessons learned, Future recommendations

On Submit:
- Creates retro document in project folder
- Feeds into team knowledge base
- Informs future project estimates

---

## Google Chat: Real-Time Communication

### Space Types

| Type | Members | Purpose |
|------|---------|---------|
| **Client Spaces** | Client contacts + team | Quick questions, status updates, file sharing |
| **Project Spaces** | Internal team only | Technical discussions, PR reviews, blockers |

### Bot Notifications

Portal can post to Chat via bot:

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

### Client Spaces

Auto-created when client onboards

Members: Client contacts + assigned team members

Used for:
- Quick questions (async)
- Status updates
- File sharing
- Meeting coordination

Integration:
- Messages logged to client activity
- AI detects actionable items → tasks
- Urgent messages flagged in portal

### Project Spaces (Internal)

Auto-created for each active project

Members: Assigned team members only

Used for:
- Technical discussions
- PR reviews
- Blocker escalation
- Quick syncs

---

## Google Calendar: Meeting Management

### Capabilities

| Capability | API |
|------------|-----|
| List calendars | `calendarList.list` |
| List events | `events.list` |
| Create event | `events.insert` |
| Update event | `events.update` |
| Delete event | `events.delete` |
| Watch for changes | `events.watch` |
| Free/busy query | `freebusy.query` |

### Integration Points

**Scheduling from Portal:**
- Check your availability
- Check client availability (if shared)
- Suggest optimal times
- Create event with Meet link
- Send invites

**Tracking:**
- Detect meeting invites in email
- Auto-create meeting record
- Track confirmations
- Log completed meetings

**Reminders:**
- Upcoming meeting alerts
- Pre-meeting prep reminders
- Post-meeting follow-up tasks

---

## Google Contacts: People Management

### Sync Strategy

```
┌─────────────────┐     ┌─────────────────┐
│  Portal         │     │  Google         │
│  Contacts       │◀───▶│  Contacts       │
└─────────────────┘     └─────────────────┘

Bidirectional sync:
• New contact in Portal → Create in Google
• New contact in Google → Create in Portal
• Update in either → Sync to other
• Delete → Soft-delete, don't sync deletion
```

### Contact Groups

- **Leads** - All lead contacts
- **Clients** - All client contacts
- **Partners** - Referral sources, vendors
- **Team** - Internal team members

### Enrichment

- Pull LinkedIn profile (if linked)
- Company info from domain
- Previous interaction history
- Shared across team

---

## Google Tasks: Personal Task Sync

### Integration

- Bidirectional sync with portal tasks
- Tasks created in Google appear in "My Tasks"
- Tasks from portal appear in Google Tasks
- Due dates, descriptions, completion status sync

### Use Cases

- Quick capture from any Google app
- Mobile task creation
- Integration with Gmail "Add to Tasks"
- Personal productivity alongside work tasks

---

## OAuth Scopes Reference

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

## Integration Priority

| Integration | Value | Complexity | Priority |
|-------------|-------|------------|----------|
| **Gmail Send/Compose** | Critical | Medium | 1 |
| **Calendar** | Critical | Medium | 2 |
| **Meet (basic)** | High | Low | 3 |
| **Drive (folders)** | High | Medium | 4 |
| **Docs (proposals)** | High | Medium | 5 |
| **Meet (transcripts)** | Medium | High | 6 |
| **Forms (intake)** | Medium | Low | 7 |
| **Chat (notifications)** | Medium | Medium | 8 |
| **Sheets (reports)** | Nice | Low | 9 |
| **Slides (decks)** | Nice | Medium | 10 |
| **Contacts (sync)** | Nice | Low | 11 |
| **Tasks (sync)** | Nice | Low | 12 |

---

*See also: [Vision & Architecture](./01-vision-architecture.md), [Schema Extensions](./04-schema-extensions.md)*
