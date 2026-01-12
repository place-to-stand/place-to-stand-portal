# Place to Stand: Implementation Roadmap

## Overview

This roadmap breaks down the agency pipeline into **small, mergeable PRs** organized by phase. Each PR is designed to be:
- **Self-contained**: Works independently, doesn't break existing functionality
- **Reviewable**: <500 lines of changes, clear scope
- **Testable**: Can be verified before moving to the next PR

---

## Phase Summary

| Phase | Name | PRs | Priority | Dependencies |
|-------|------|-----|----------|--------------|
| 0 | Stabilization | 5 | 🔴 Critical | None |
| 0.5 | **Gmail Send/Compose** | 7 | 🔴 Critical | Phase 0 |
| 1 | Calendar Integration | 4 | 🟠 High | Phase 0.5 |
| 2 | Enhanced Sales Pipeline | 6 | 🟠 High | Phase 0.5, 1 |
| 3 | Proposal System | 7 | 🟠 High | Phase 2 |
| 4 | SOW & PRD System | 8 | 🟡 Medium | Phase 3 |
| 5 | Repository Automation | 5 | 🟡 Medium | Phase 4 |
| 6 | Credentials Vault | 4 | 🟡 Medium | Phase 5 |
| 7 | Hour Block Enhancements | 5 | 🟡 Medium | Phase 0 |
| 8 | Autonomous Bug Fixing | 12 | 🟢 Future | Phase 5, 6 |

**Total PRs: 63**

---

## Phase 0: Stabilization 🔴

**Goal:** Complete in-progress work, ensure build passes, stable foundation.

### PR 0.1: Apply Unified Messaging Migration
**Files:** `drizzle/migrations/0007_unified_messaging.sql`
**Scope:**
- Apply pending migration to production database
- Verify all tables created correctly
- Run smoke tests on existing features

**Acceptance:**
- [ ] Migration applies without errors
- [ ] All existing features still work
- [ ] No TypeScript errors

---

### PR 0.2: Consolidate Inbox UI
**Files:** `app/(dashboard)/my/inbox/`
**Scope:**
- Unify scattered email views into single inbox
- Remove deprecated `/emails` route
- Update navigation

**Acceptance:**
- [ ] Single inbox at `/my/inbox`
- [ ] Threads display correctly
- [ ] AI suggestions accessible from inbox

---

### PR 0.3: Fix PR Suggestions Redesign
**Files:** `lib/ai/pr-suggestion-service.ts`, `app/api/pr-suggestions/`
**Scope:**
- Enable task-based PR suggestions (currently disabled)
- Update schema if needed
- Wire up UI

**Acceptance:**
- [ ] Can generate PR from approved task
- [ ] PR created on GitHub with proper details

---

### PR 0.4: Navigation Cleanup
**Files:** `components/layout/navigation-config.ts`, `components/layout/sidebar.tsx`
**Scope:**
- Remove deprecated routes
- Ensure consistent navigation structure
- Fix any broken links

**Acceptance:**
- [ ] All nav links work
- [ ] No 404s from sidebar navigation

---

### PR 0.5: Build & Lint Pass
**Files:** Various
**Scope:**
- Fix all TypeScript errors
- Fix all ESLint warnings
- Ensure `npm run build` passes

**Acceptance:**
- [ ] `npm run build` succeeds
- [ ] `npm run lint` has no errors
- [ ] `npm run type-check` passes

---

## Phase 0.5: Gmail Send/Compose 🔴

**Goal:** Enable sending emails from the portal. Critical foundation for sales pipeline.

### PR 0.5.1: Add Gmail Send Scope
**Files:** `lib/oauth/google.ts`
**Scope:**
- Add `gmail.send` scope to `GOOGLE_SCOPES`
- Optionally add `gmail.compose` for drafts
- Handle scope upgrade for existing connections

**Current:**
```typescript
export const GOOGLE_SCOPES = [
  'gmail.readonly',
  'gmail.modify',
  // ❌ Missing send capability
]
```

**After:**
```typescript
export const GOOGLE_SCOPES = [
  'gmail.readonly',
  'gmail.modify',
  'gmail.send',      // ✅ Send emails
  'gmail.compose',   // ✅ Create drafts
]
```

**Acceptance:**
- [ ] New connections get send permission
- [ ] Existing users prompted to re-authorize

---

### PR 0.5.2: Gmail Send Client Functions
**Files:** `lib/gmail/client.ts`
**Scope:**
- Add `sendMessage()` - Send a new email
- Add `createDraft()` - Save draft
- Add `sendDraft()` - Send existing draft
- RFC 2822 message construction

**API Reference:**
- POST `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`
- POST `https://gmail.googleapis.com/gmail/v1/users/me/drafts`

**Acceptance:**
- [ ] Can send plain text email
- [ ] Can send HTML email
- [ ] Can create and send drafts

---

### PR 0.5.3: Thread Reply Functions
**Files:** `lib/gmail/client.ts`
**Scope:**
- Add `replyToThread()` - Reply within existing thread
- Proper `In-Reply-To` and `References` headers
- Thread ID linking
- Quote original message (optional)

**Acceptance:**
- [ ] Replies appear in same Gmail thread
- [ ] Headers correctly set
- [ ] Threading works in recipient's client too

---

### PR 0.5.4: Email Compose Schema
**Files:** `lib/db/schema.ts`, migration
**Scope:**
```sql
-- Track emails sent from portal
sent_emails (
  id, user_id, thread_id (optional),
  gmail_message_id (after send),
  to_emails[], cc_emails[], bcc_emails[],
  subject, body_text, body_html,
  status (DRAFT/QUEUED/SENT/FAILED),
  sent_at, error_message,
  related_entity_type (LEAD/CLIENT/PROJECT),
  related_entity_id,
  created_at, updated_at
)
```

**Acceptance:**
- [ ] Migration applies
- [ ] Sent emails trackable by entity

---

### PR 0.5.5: Email Compose UI - Dialog
**Files:** `components/email/compose-dialog.tsx` (new)
**Scope:**
- Modal dialog for composing emails
- To/Cc/Bcc fields with contact autocomplete
- Subject line
- Rich text body (TipTap)
- Send / Save Draft buttons

**Acceptance:**
- [ ] Dialog opens from various locations
- [ ] Can compose and send email
- [ ] Draft saves work

---

### PR 0.5.6: Email Reply UI
**Files:** `app/(dashboard)/my/inbox/_components/reply-composer.tsx` (new)
**Scope:**
- Inline reply composer in thread view
- Quote original message
- Reply vs Reply All
- Same rich text editor

**Acceptance:**
- [ ] Can reply from inbox
- [ ] Reply appears in thread
- [ ] Quote formatting correct

---

### PR 0.5.7: Email Templates
**Files:** `lib/email/templates.ts` (new)
**Scope:**
- Email template system
- Variables: {{client_name}}, {{project_name}}, etc.
- Default templates:
  - Initial outreach
  - Follow-up
  - Meeting confirmation
  - Proposal delivery

**Acceptance:**
- [ ] Templates accessible in compose
- [ ] Variables auto-populate
- [ ] Can create custom templates

---

## Phase 1: Calendar Integration 🟠

**Goal:** Integrate Google Calendar for meeting scheduling.

### PR 1.1: Add Calendar OAuth Scopes
**Files:** `lib/oauth/google.ts`
**Scope:**
- Add `calendar.readonly` and `calendar.events` scopes
- Update OAuth connection to request calendar access
- Handle incremental authorization

**Acceptance:**
- [ ] OAuth flow requests calendar permissions
- [ ] Existing Gmail connections can upgrade to include calendar

---

### PR 1.2: Google Calendar Client
**Files:** `lib/gcal/client.ts` (new)
**Scope:**
- Create Calendar API client wrapper
- List calendars, list events, create events
- Token refresh integration

**Acceptance:**
- [ ] Can list user's calendars
- [ ] Can list events in date range
- [ ] Can create new events

---

### PR 1.3: Meeting Scheduling Schema
**Files:** `lib/db/schema.ts`, migration
**Scope:**
- Add `meetings` table (leadId, calendarEventId, scheduledAt, attendees, notes)
- Add `meeting_scheduled_at` to leads table
- Create indexes

**Acceptance:**
- [ ] Migration applies cleanly
- [ ] Meetings can be created/queried

---

### PR 1.4: Meeting Scheduling UI
**Files:** `app/(dashboard)/leads/_components/schedule-meeting-dialog.tsx` (new)
**Scope:**
- Dialog to schedule meeting from lead card
- Calendar picker integration
- Create Google Calendar event
- Update lead status

**Acceptance:**
- [ ] Can schedule meeting from lead
- [ ] Event appears in Google Calendar
- [ ] Lead shows meeting scheduled date

---

## Phase 2: Enhanced Sales Pipeline 🟠

**Goal:** Improve lead → client conversion with explicit stages.

### PR 2.1: Lead Stage Timestamps
**Files:** `lib/db/schema.ts`, migration
**Scope:**
- Add to leads: `first_contact_at`, `meeting_completed_at`, `proposal_sent_at`, `contract_signed_at`
- Add `expected_value` (numeric) for pipeline value

**Acceptance:**
- [ ] Migration applies
- [ ] Timestamps can be set/queried

---

### PR 2.2: Lead Kanban Stage Display
**Files:** `app/(dashboard)/leads/_components/lead-card.tsx`
**Scope:**
- Show stage progress on lead cards
- Display expected value
- Show time in current stage

**Acceptance:**
- [ ] Lead cards show progress indicators
- [ ] Expected value visible
- [ ] Days in stage calculated

---

### PR 2.3: Lead Stage Actions
**Files:** `app/(dashboard)/leads/actions.ts`
**Scope:**
- Server actions to transition lead stages
- Validate stage transitions
- Log activity

**Acceptance:**
- [ ] Can mark meeting completed
- [ ] Can mark proposal sent
- [ ] Activity logged for each transition

---

### PR 2.4: Lead Pipeline Analytics
**Files:** `app/(dashboard)/leads/_components/pipeline-metrics.tsx` (new)
**Scope:**
- Pipeline value by stage
- Conversion rates between stages
- Average time per stage

**Acceptance:**
- [ ] Metrics display above kanban
- [ ] Values calculate correctly

---

### PR 2.5: Email → Lead Detection
**Files:** `lib/ai/email-lead-detection.ts` (new)
**Scope:**
- AI analysis to detect potential new leads from emails
- Flag emails as "potential lead"
- Suggest lead creation

**Acceptance:**
- [ ] AI identifies potential leads in inbox
- [ ] Suggestion appears in inbox
- [ ] One-click lead creation

---

### PR 2.6: Lead → Client Conversion
**Files:** `app/(dashboard)/leads/_components/convert-to-client-dialog.tsx` (new)
**Scope:**
- Dialog to convert won lead to client
- Create client record from lead data
- Create initial project
- Archive the lead

**Acceptance:**
- [ ] CLOSED_WON leads show convert button
- [ ] Client created with lead's company info
- [ ] Contact created and linked
- [ ] Initial project created

---

## Phase 3: Proposal System 🟠

**Goal:** Generate and track proposals within the portal.

### PR 3.1: Proposals Schema
**Files:** `lib/db/schema.ts`, migration
**Scope:**
```sql
proposals (
  id, leadId, version, status (DRAFT/SENT/VIEWED/ACCEPTED/REJECTED),
  title, content (JSONB),
  total_value, valid_until,
  sent_at, viewed_at, responded_at,
  created_by, created_at, updated_at, deleted_at
)
```

**Acceptance:**
- [ ] Migration applies
- [ ] Proposals can be created/queried

---

### PR 3.2: Proposal Editor Base
**Files:** `app/(dashboard)/leads/[leadId]/proposal/page.tsx` (new)
**Scope:**
- Rich text editor for proposal content
- Section-based structure (intro, scope, timeline, pricing, terms)
- Auto-save draft

**Acceptance:**
- [ ] Can create new proposal for lead
- [ ] Content saves as draft
- [ ] Sections editable

---

### PR 3.3: Proposal Templates
**Files:** `lib/proposals/templates.ts` (new)
**Scope:**
- Template system for common proposal types
- Variables (client name, project name, dates, values)
- Default templates for web dev, maintenance, consulting

**Acceptance:**
- [ ] Can select template when creating proposal
- [ ] Variables auto-populated
- [ ] Templates customizable

---

### PR 3.4: AI Proposal Generation
**Files:** `lib/ai/proposal-generation.ts` (new)
**Scope:**
- Generate proposal draft from:
  - Lead notes
  - Meeting notes
  - Email thread context
- Use Claude for professional writing

**Acceptance:**
- [ ] "Generate with AI" button in editor
- [ ] Draft appears in editor
- [ ] Editable after generation

---

### PR 3.5: Proposal Pricing Calculator
**Files:** `app/(dashboard)/leads/[leadId]/proposal/_components/pricing-section.tsx` (new)
**Scope:**
- Line item pricing
- Hourly vs fixed price options
- Discount support
- Total calculation

**Acceptance:**
- [ ] Can add line items
- [ ] Totals calculate correctly
- [ ] Discounts apply properly

---

### PR 3.6: Proposal Sending
**Files:** `lib/proposals/send.ts` (new)
**Scope:**
- Generate shareable link
- Send email via Resend
- Track when viewed
- Update lead status

**Acceptance:**
- [ ] Can send proposal via email
- [ ] Client can view without login
- [ ] View tracked and shown in UI

---

### PR 3.7: Proposal Response Tracking
**Files:** `app/api/proposals/[proposalId]/respond/route.ts` (new)
**Scope:**
- Client can accept/reject (no login)
- Comments/questions field
- Notification to team
- Lead status update

**Acceptance:**
- [ ] Client can respond to proposal
- [ ] Team notified
- [ ] Lead status updates automatically

---

## Phase 4: SOW & PRD System 🟡

**Goal:** Manage scope of work and AI-generated PRDs.

### PR 4.1: SOW Schema
**Files:** `lib/db/schema.ts`, migration
**Scope:**
```sql
scopes_of_work (
  id, project_id, proposal_id (optional),
  version, status (DRAFT/ACTIVE/SUPERSEDED),
  content (JSONB - deliverables, milestones, exclusions),
  total_hours, total_value,
  approved_at, approved_by,
  created_at, updated_at, deleted_at
)
```

**Acceptance:**
- [ ] Migration applies
- [ ] SOWs can be created from proposals

---

### PR 4.2: SOW Editor
**Files:** `app/(dashboard)/projects/[...slug]/sow/page.tsx` (new)
**Scope:**
- Structured editor for SOW
- Deliverables list with descriptions
- Milestones with dates
- Exclusions section

**Acceptance:**
- [ ] Can create/edit SOW for project
- [ ] Structured content saves correctly

---

### PR 4.3: SOW from Proposal
**Files:** `lib/sow/from-proposal.ts` (new)
**Scope:**
- Generate initial SOW from accepted proposal
- Map pricing to deliverables
- Set initial milestones

**Acceptance:**
- [ ] One-click SOW generation from proposal
- [ ] Reasonable defaults populated

---

### PR 4.4: PRD Schema
**Files:** `lib/db/schema.ts`, migration
**Scope:**
```sql
prds (
  id, project_id, sow_id (optional),
  version, status (DRAFT/REVIEW/APPROVED),
  content (JSONB - sections, user_stories, requirements),
  ai_model_version,
  approved_at, approved_by,
  created_at, updated_at, deleted_at
)
```

**Acceptance:**
- [ ] Migration applies
- [ ] PRDs linked to projects and SOWs

---

### PR 4.5: PRD Section Structure
**Files:** `lib/prd/sections.ts` (new)
**Scope:**
- Define standard PRD sections:
  - Overview, Goals, User Stories
  - Technical Requirements, Architecture
  - Acceptance Criteria, Out of Scope

**Acceptance:**
- [ ] Section types defined
- [ ] Validation for required sections

---

### PR 4.6: AI PRD Generation
**Files:** `lib/ai/prd-generation.ts` (new)
**Scope:**
- Generate PRD from SOW using Claude
- Section-by-section generation
- Context from client, project, SOW

**Acceptance:**
- [ ] "Generate PRD" button on project
- [ ] Full PRD draft created
- [ ] All sections populated

---

### PR 4.7: PRD Editor & Review
**Files:** `app/(dashboard)/projects/[...slug]/prd/page.tsx` (new)
**Scope:**
- Rich text editor for each section
- Review/approval workflow
- Version history

**Acceptance:**
- [ ] Can edit PRD sections
- [ ] Can submit for review
- [ ] Can approve/request changes

---

### PR 4.8: PRD → Tasks Extraction
**Files:** `lib/ai/prd-to-tasks.ts` (new)
**Scope:**
- AI extracts tasks from approved PRD
- User stories → tasks
- Technical requirements → tasks
- Create as suggestions for review

**Acceptance:**
- [ ] "Generate Tasks" button on approved PRD
- [ ] Tasks appear as suggestions
- [ ] Can bulk approve to backlog

---

## Phase 5: Repository Automation 🟡

**Goal:** Automate repository setup from templates.

### PR 5.1: Repo Templates Schema
**Files:** `lib/db/schema.ts`, migration
**Scope:**
```sql
repo_templates (
  id, name, description,
  github_template_repo (owner/name),
  default_branch,
  setup_scripts (JSONB),
  created_at, updated_at
)
```

**Acceptance:**
- [ ] Migration applies
- [ ] Templates can be configured

---

### PR 5.2: Template Management UI
**Files:** `app/(dashboard)/settings/repo-templates/page.tsx` (new)
**Scope:**
- CRUD for repo templates
- Link to GitHub template repos
- Configure default settings

**Acceptance:**
- [ ] Can add/edit/delete templates
- [ ] Templates link to GitHub

---

### PR 5.3: Repo Creation from Template
**Files:** `lib/github/create-from-template.ts` (new)
**Scope:**
- Use GitHub API to create repo from template
- Set repository name from project
- Configure branch protections
- Add team access

**Acceptance:**
- [ ] Can create repo from template
- [ ] Repo appears in GitHub
- [ ] Linked to project automatically

---

### PR 5.4: Post-Creation Setup
**Files:** `lib/github/post-create-setup.ts` (new)
**Scope:**
- Run setup scripts (package.json updates, env files)
- Create initial commit
- Set up CI/CD (if template includes)

**Acceptance:**
- [ ] Setup scripts execute
- [ ] Initial commit made
- [ ] Repo ready for development

---

### PR 5.5: Project Repo Setup Wizard
**Files:** `app/(dashboard)/projects/[...slug]/_components/repo-setup-wizard.tsx` (new)
**Scope:**
- Step-by-step wizard for new projects
- Select template
- Configure options
- Create and link repo

**Acceptance:**
- [ ] Wizard guides through setup
- [ ] Repo created and linked
- [ ] Project ready for development

---

## Phase 6: Credentials Vault 🟡

**Goal:** Secure storage for project credentials.

### PR 6.1: Credentials Schema
**Files:** `lib/db/schema.ts`, migration
**Scope:**
```sql
project_credentials (
  id, project_id,
  name, category (API_KEY/DATABASE/SERVICE/OTHER),
  encrypted_value,
  notes,
  last_rotated_at,
  created_by, created_at, updated_at, deleted_at
)

credential_access_logs (
  id, credential_id, user_id,
  action (VIEW/COPY/EDIT/DELETE),
  ip_address,
  created_at
)
```

**Acceptance:**
- [ ] Migration applies
- [ ] Encryption working

---

### PR 6.2: Credential Encryption Layer
**Files:** `lib/credentials/encryption.ts` (new)
**Scope:**
- AES-256-GCM encryption for credential values
- Separate key from OAuth tokens
- Decrypt on-demand only

**Acceptance:**
- [ ] Credentials encrypted at rest
- [ ] Only decrypted when accessed
- [ ] Different key from OAuth

---

### PR 6.3: Credentials Vault UI
**Files:** `app/(dashboard)/projects/[...slug]/credentials/page.tsx` (new)
**Scope:**
- List credentials for project
- Add/edit/delete credentials
- Copy to clipboard (with audit log)
- Category filtering

**Acceptance:**
- [ ] Can manage project credentials
- [ ] Values hidden by default
- [ ] Copy action logged

---

### PR 6.4: Credential Access Audit
**Files:** `lib/credentials/audit.ts` (new)
**Scope:**
- Log all credential access
- Show access history in UI
- Alert on suspicious access

**Acceptance:**
- [ ] All access logged
- [ ] History visible to admins
- [ ] IP addresses captured

---

## Phase 7: Hour Block Enhancements 🟡

**Goal:** Improve hour block lifecycle management.

### PR 7.1: Hour Threshold Alerts
**Files:** `lib/hour-blocks/alerts.ts` (new)
**Scope:**
- Calculate remaining hours per client
- Trigger alerts at 25%, 10%, 0%
- Email notifications

**Acceptance:**
- [ ] Alerts trigger at thresholds
- [ ] Emails sent to admins
- [ ] Client can see remaining hours

---

### PR 7.2: Block Renewal Flow
**Files:** `app/(dashboard)/hour-blocks/_components/renewal-dialog.tsx` (new)
**Scope:**
- Generate renewal quote
- Send to client
- Track response
- Create new block on approval

**Acceptance:**
- [ ] Can generate renewal quote
- [ ] Client receives email
- [ ] New block created on approval

---

### PR 7.3: Hour Utilization Dashboard
**Files:** `app/(dashboard)/hour-blocks/_components/utilization-charts.tsx` (new)
**Scope:**
- Hours used vs purchased over time
- Per-project breakdown
- Burn rate calculation

**Acceptance:**
- [ ] Charts display correctly
- [ ] Drill-down by project
- [ ] Burn rate shows projected exhaustion

---

### PR 7.4: Client Hour Portal
**Files:** `app/(client)/hours/page.tsx` (new, or existing client view)
**Scope:**
- Client view of their hour usage
- Time log details
- Request more hours

**Acceptance:**
- [ ] Clients can see their hours
- [ ] Can see what work was done
- [ ] Can request renewal

---

### PR 7.5: Automatic Invoice Generation
**Files:** `lib/invoicing/generate.ts` (new)
**Scope:**
- Generate invoice from hour block
- PDF generation
- Integration with Stripe (future)

**Acceptance:**
- [ ] Invoice PDF generated
- [ ] Correct line items
- [ ] Ready for future payment integration

---

## Phase 8: Autonomous Bug Fixing 🟢

**Goal:** Implement the bug bot system for autonomous fixes.

### PR 8.1: Job Queue Setup
**Files:** `lib/jobs/queue.ts` (new)
**Scope:**
- pg-boss integration
- Job types: bug_analysis, bug_fix, pr_create
- Worker configuration

**Acceptance:**
- [ ] pg-boss connected
- [ ] Jobs can be queued
- [ ] Workers process jobs

---

### PR 8.2: Bug Reports Schema
**Files:** `lib/db/schema.ts`, migration
**Scope:**
```sql
bug_reports (
  id, project_id, reported_by,
  source (EMAIL/FORM/MONITORING),
  title, description,
  status (NEW/ANALYZING/FIXING/PR_CREATED/MERGED/FAILED/ESCALATED),
  priority (LOW/MEDIUM/HIGH/CRITICAL),
  error_stack, reproduction_steps,
  ai_analysis (JSONB),
  created_at, updated_at
)

bug_fix_attempts (
  id, bug_report_id,
  attempt_number,
  status,
  tokens_used, cost,
  pr_url, pr_number,
  error_message,
  started_at, completed_at
)
```

**Acceptance:**
- [ ] Migration applies
- [ ] Bug reports can be tracked

---

### PR 8.3: Bug Intake API
**Files:** `app/api/bugs/route.ts` (new)
**Scope:**
- POST endpoint for bug reports
- Authentication via API key
- Validation and normalization
- Queue for analysis

**Acceptance:**
- [ ] Bugs can be submitted via API
- [ ] Queued for processing

---

### PR 8.4: Email Bug Detection
**Files:** `lib/ai/bug-detection.ts` (new)
**Scope:**
- AI analysis to detect bug reports in emails
- Extract error details, steps to reproduce
- Link to project
- Create bug report

**Acceptance:**
- [ ] Bugs detected in emails
- [ ] Bug report created
- [ ] Linked to correct project

---

### PR 8.5: Docker Worker Image
**Files:** `docker/bug-worker/Dockerfile` (new)
**Scope:**
- Base image with Node, Git, common tools
- Security hardening
- Resource limits
- Non-root user

**Acceptance:**
- [ ] Image builds successfully
- [ ] Can clone repos
- [ ] Can run npm commands

---

### PR 8.6: Container Orchestration
**Files:** `lib/bugs/sandbox.ts` (new)
**Scope:**
- Spin up container per fix attempt
- Mount cloned repo
- Set memory/CPU limits
- Cleanup on completion

**Acceptance:**
- [ ] Containers start/stop correctly
- [ ] Repos accessible inside
- [ ] Resources limited

---

### PR 8.7: Claude Agent Tools
**Files:** `lib/bugs/agent/tools/` (new)
**Scope:**
- Tool definitions:
  - `read_file`, `write_file`, `list_directory`
  - `bash_execute` (limited commands)
  - `git_diff`, `git_commit`
  - `search_code`, `find_files`

**Acceptance:**
- [ ] Tools execute correctly
- [ ] Proper error handling
- [ ] Security constraints enforced

---

### PR 8.8: Agent Loop Implementation
**Files:** `lib/bugs/agent/loop.ts` (new)
**Scope:**
- Anthropic SDK integration
- Tool execution loop
- Budget tracking (tokens, time)
- Max iterations limit

**Acceptance:**
- [ ] Agent can analyze and fix bugs
- [ ] Stays within budget
- [ ] Terminates appropriately

---

### PR 8.9: Fix Verification
**Files:** `lib/bugs/verify.ts` (new)
**Scope:**
- Run tests after fix
- Verify fix addresses reported issue
- Confidence scoring

**Acceptance:**
- [ ] Tests run in container
- [ ] Pass/fail detected
- [ ] Confidence calculated

---

### PR 8.10: PR Creation
**Files:** `lib/bugs/create-pr.ts` (new)
**Scope:**
- Create branch with fix
- Generate PR description
- Create PR on GitHub
- Link to bug report

**Acceptance:**
- [ ] Branch created
- [ ] PR opened with context
- [ ] Bug report updated

---

### PR 8.11: Notifications
**Files:** `lib/bugs/notify.ts` (new)
**Scope:**
- Email notification on PR created
- WhatsApp/Slack (future)
- Escalation notifications

**Acceptance:**
- [ ] Team notified of PRs
- [ ] Escalations send alerts

---

### PR 8.12: Budget & Kill Switches
**Files:** `lib/bugs/budget.ts` (new)
**Scope:**
- Daily/monthly token budgets
- Per-bug attempt limits
- Kill switch (disable globally)
- Cost tracking dashboard

**Acceptance:**
- [ ] Budgets enforced
- [ ] Can disable system
- [ ] Costs visible in UI

---

## Dependency Graph

```
Phase 0 (Stabilization)
    │
    ├── Phase 0.5 (Gmail Send/Compose) ◄─── CRITICAL: Enables all email-based workflows
    │       │
    │       ├── Phase 1 (Calendar) ─────────────────┐
    │       │                                       │
    │       └── Phase 2 (Sales Pipeline) ◄──────────┘
    │               │
    │               └── Phase 3 (Proposals) ◄─── Sends proposals via Gmail
    │                       │
    │                       └── Phase 4 (SOW/PRD)
    │                               │
    │                               └── Phase 5 (Repos)
    │                                       │
    │                                       └── Phase 6 (Creds)
    │                                               │
    │                                               └── Phase 8 (Bug Bot)
    │
    └── Phase 7 (Hour Blocks) ── standalone, can run in parallel
```

**Critical Path:** 0 → 0.5 → 2 → 3 → 4 → 5 → 6 → 8

---

## Timeline Considerations

**Parallel Tracks:**
1. **Email Foundation:** Phase 0.5 (Gmail Send) - MUST come first
2. **Sales Track:** Phases 1-3 (Calendar → Sales → Proposals) - depends on 0.5
3. **Delivery Track:** Phases 4-6 (SOW/PRD → Repos → Creds)
4. **Billing Track:** Phase 7 (Hour Blocks) - can run in parallel
5. **Automation Track:** Phase 8 (Bug Bot) - after 5 & 6

**Suggested Order for Single Developer:**
1. Phase 0 (Stabilization) - **First**
2. Phase 0.5 (Gmail Send/Compose) - **Critical foundation**
3. Phase 7 (Hour Blocks) - Quick wins, high value (parallel)
4. Phase 1 (Calendar) - Meeting scheduling
5. Phase 2 (Sales Pipeline) - Core CRM improvement
6. Phase 3 (Proposals) - Revenue enablement
7. Phase 4 (SOW/PRD) - Process formalization
8. Phase 5 (Repos) - Developer experience
9. Phase 6 (Creds) - Security compliance
10. Phase 8 (Bug Bot) - Moonshot feature

---

## Success Metrics

| Phase | Key Metric |
|-------|------------|
| 0 | Build passes, no regressions |
| 0.5 | **Emails sent from portal** |
| 1 | Meetings scheduled from portal |
| 2 | Lead → Client conversion tracked |
| 3 | Proposals sent from portal |
| 4 | PRDs generated, tasks extracted |
| 5 | Repos created from templates |
| 6 | Credentials securely stored |
| 7 | Hour usage visible, renewals automated |
| 8 | Bugs fixed autonomously |

---

## Next Steps

1. **Prioritize:** Decide which phases to tackle first
2. **Assign:** Break PRs into tickets for team
3. **Review:** Weekly PR review cadence
4. **Iterate:** Adjust roadmap based on learnings
