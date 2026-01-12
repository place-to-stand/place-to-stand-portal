# Place to Stand: Agency Pipeline Flowchart

## Overview

This document maps the complete lifecycle of a client relationship from initial lead intake through active project management and autonomous bug fixing.

---

## Master Flowchart

```mermaid
flowchart TB
    subgraph INTAKE["📥 LEAD INTAKE"]
        direction LR
        EMAIL_LEAD[/"📧 Email"/]
        WEBSITE_LEAD[/"🌐 Website Form"/]
        REFERRAL_LEAD[/"🤝 Referral"/]
    end

    subgraph SALES["💼 SALES PIPELINE"]
        direction TB
        NEW_LEAD["🆕 New Lead"]
        MEETING_SCHEDULED["📅 Meeting Scheduled"]
        MEETING_COMPLETED["✅ Meeting Completed"]
        PROPOSAL_DRAFT["📝 Proposal Draft"]
        PROPOSAL_SENT["📤 Proposal Sent"]
        NEGOTIATION["🔄 Negotiation"]
        CONTRACT_READY["📋 Contract Ready"]
        CONTRACT_SIGNED["✍️ Contract Signed"]
        CLOSED_LOST["❌ Closed Lost"]
        ON_ICE["🧊 On Ice"]
    end

    subgraph ONBOARDING["🚀 CLIENT ONBOARDING"]
        direction TB
        CLIENT_CREATED["👤 Client Created"]
        INITIAL_PROJECT["📁 Initial Project"]
        SOW_CREATED["📄 Scope of Work"]
        AI_PRD["🤖 AI Generates PRD"]
        PRD_REVIEW["👁️ PRD Review"]
        REPO_SETUP["🔧 Repo Setup"]
        CREDS_SETUP["🔐 Credentials Vault"]
        HOUR_BLOCK["⏱️ Hour Block Created"]
    end

    subgraph DEVELOPMENT["⚙️ ACTIVE DEVELOPMENT"]
        direction TB

        subgraph EMAIL_LOOP["📬 Email Intelligence"]
            GMAIL_SYNC["Gmail Sync"]
            AI_ANALYSIS["AI Analysis"]
            TASK_SUGGESTIONS["Task Suggestions"]
        end

        subgraph TASK_MGMT["📋 Task Management"]
            BACKLOG["Backlog"]
            ON_DECK["On Deck"]
            IN_PROGRESS["In Progress"]
            IN_REVIEW["In Review"]
            DONE["Done"]
        end

        subgraph TIME_TRACKING["⏰ Time & Billing"]
            TIME_LOG["Time Logged"]
            HOURS_DEDUCTED["Hours Deducted"]
            LOW_HOURS_ALERT["Low Hours Alert"]
            BLOCK_RENEWAL["Block Renewal"]
        end
    end

    subgraph BUGBOT["🤖 AUTONOMOUS BUG FIXING"]
        direction TB
        BUG_INTAKE["🐛 Bug Report"]
        BUG_ANALYSIS["🔍 AI Analysis"]
        SANDBOX_EXEC["🐳 Sandbox Execution"]
        FIX_ATTEMPT["🔧 Fix Attempt"]
        PR_CREATED["📤 PR Created"]
        HUMAN_NEEDED["👨‍💻 Human Needed"]
        FIX_MERGED["✅ Fix Merged"]
    end

    subgraph LIFECYCLE["🔄 PROJECT LIFECYCLE"]
        direction TB
        ACTIVE_PROJECT["🟢 Active Project"]
        PROJECT_COMPLETE["✅ Project Complete"]
        MAINTENANCE["🔧 Maintenance Mode"]
        NEW_PROJECT["➕ New Project"]
    end

    %% Lead Intake Flows
    EMAIL_LEAD --> NEW_LEAD
    WEBSITE_LEAD --> NEW_LEAD
    REFERRAL_LEAD --> NEW_LEAD

    %% Sales Pipeline Flow
    NEW_LEAD --> MEETING_SCHEDULED
    NEW_LEAD --> ON_ICE
    NEW_LEAD --> CLOSED_LOST
    MEETING_SCHEDULED --> MEETING_COMPLETED
    MEETING_SCHEDULED --> ON_ICE
    MEETING_COMPLETED --> PROPOSAL_DRAFT
    MEETING_COMPLETED --> CLOSED_LOST
    PROPOSAL_DRAFT --> PROPOSAL_SENT
    PROPOSAL_SENT --> NEGOTIATION
    PROPOSAL_SENT --> CLOSED_LOST
    PROPOSAL_SENT --> ON_ICE
    NEGOTIATION --> CONTRACT_READY
    NEGOTIATION --> PROPOSAL_DRAFT
    CONTRACT_READY --> CONTRACT_SIGNED
    ON_ICE -.-> NEW_LEAD

    %% Sales to Onboarding
    CONTRACT_SIGNED --> CLIENT_CREATED
    CLIENT_CREATED --> INITIAL_PROJECT
    CLIENT_CREATED --> HOUR_BLOCK
    INITIAL_PROJECT --> SOW_CREATED
    SOW_CREATED --> AI_PRD
    AI_PRD --> PRD_REVIEW
    PRD_REVIEW --> REPO_SETUP
    PRD_REVIEW -.->|Revisions| AI_PRD
    REPO_SETUP --> CREDS_SETUP
    CREDS_SETUP --> ACTIVE_PROJECT

    %% Development Loop
    ACTIVE_PROJECT --> GMAIL_SYNC
    GMAIL_SYNC --> AI_ANALYSIS
    AI_ANALYSIS --> TASK_SUGGESTIONS
    TASK_SUGGESTIONS --> BACKLOG
    BACKLOG --> ON_DECK
    ON_DECK --> IN_PROGRESS
    IN_PROGRESS --> IN_REVIEW
    IN_REVIEW --> DONE
    IN_REVIEW -.->|Needs Work| IN_PROGRESS

    %% Time Tracking
    IN_PROGRESS --> TIME_LOG
    TIME_LOG --> HOURS_DEDUCTED
    HOURS_DEDUCTED --> LOW_HOURS_ALERT
    LOW_HOURS_ALERT --> BLOCK_RENEWAL
    BLOCK_RENEWAL --> HOUR_BLOCK

    %% Bug Bot Flow
    ACTIVE_PROJECT --> BUG_INTAKE
    BUG_INTAKE --> BUG_ANALYSIS
    BUG_ANALYSIS --> SANDBOX_EXEC
    SANDBOX_EXEC --> FIX_ATTEMPT
    FIX_ATTEMPT --> PR_CREATED
    FIX_ATTEMPT -.->|Failed| HUMAN_NEEDED
    PR_CREATED --> FIX_MERGED
    HUMAN_NEEDED --> BACKLOG
    FIX_MERGED --> ACTIVE_PROJECT

    %% Project Lifecycle
    DONE --> PROJECT_COMPLETE
    PROJECT_COMPLETE --> MAINTENANCE
    MAINTENANCE --> NEW_PROJECT
    NEW_PROJECT --> INITIAL_PROJECT
    MAINTENANCE --> BUG_INTAKE

    %% Styling
    classDef intake fill:#e1f5fe,stroke:#01579b
    classDef sales fill:#fff3e0,stroke:#e65100
    classDef onboard fill:#e8f5e9,stroke:#1b5e20
    classDef dev fill:#f3e5f5,stroke:#4a148c
    classDef bugbot fill:#ffebee,stroke:#b71c1c
    classDef lifecycle fill:#e0f2f1,stroke:#004d40

    class EMAIL_LEAD,WEBSITE_LEAD,REFERRAL_LEAD intake
    class NEW_LEAD,MEETING_SCHEDULED,MEETING_COMPLETED,PROPOSAL_DRAFT,PROPOSAL_SENT,NEGOTIATION,CONTRACT_READY,CONTRACT_SIGNED,CLOSED_LOST,ON_ICE sales
    class CLIENT_CREATED,INITIAL_PROJECT,SOW_CREATED,AI_PRD,PRD_REVIEW,REPO_SETUP,CREDS_SETUP,HOUR_BLOCK onboard
    class GMAIL_SYNC,AI_ANALYSIS,TASK_SUGGESTIONS,BACKLOG,ON_DECK,IN_PROGRESS,IN_REVIEW,DONE,TIME_LOG,HOURS_DEDUCTED,LOW_HOURS_ALERT,BLOCK_RENEWAL dev
    class BUG_INTAKE,BUG_ANALYSIS,SANDBOX_EXEC,FIX_ATTEMPT,PR_CREATED,HUMAN_NEEDED,FIX_MERGED bugbot
    class ACTIVE_PROJECT,PROJECT_COMPLETE,MAINTENANCE,NEW_PROJECT lifecycle
```

---

## Detailed Stage Breakdowns

### 1. Lead Intake Sources

```mermaid
flowchart LR
    subgraph SOURCES["Lead Sources"]
        direction TB
        E1["📧 Gmail Inbox"]
        E2["🌐 Website Contact Form"]
        E3["🤝 Manual Referral Entry"]
        E4["📱 Future: LinkedIn"]
    end

    subgraph PROCESSING["AI Processing"]
        direction TB
        P1["Extract Contact Info"]
        P2["Identify Company"]
        P3["Detect Intent"]
        P4["Score Lead Quality"]
    end

    subgraph OUTPUT["Lead Created"]
        L1["Lead Record"]
        L2["Contact Record"]
        L3["Activity Log"]
    end

    E1 --> P1
    E2 --> P1
    E3 --> P1
    E4 --> P1
    P1 --> P2 --> P3 --> P4
    P4 --> L1
    P4 --> L2
    P4 --> L3
```

### 2. Sales Pipeline Detail

```mermaid
flowchart TB
    subgraph QUALIFICATION["🎯 Qualification"]
        Q1["Lead Received"]
        Q2["Initial Research"]
        Q3["Qualify/Disqualify"]
    end

    subgraph OUTREACH["📧 Outreach (Gmail Send)"]
        O1["Compose Email"]
        O2["Use Template"]
        O3["Send via Gmail"]
        O4["Track in Portal"]
        O5["Await Response"]
    end

    subgraph DISCOVERY["🔍 Discovery"]
        D1["Schedule Meeting"]
        D2["Calendar Integration"]
        D3["Send Confirmation Email"]
        D4["Meeting Prep Notes"]
        D5["Discovery Call"]
        D6["Requirements Captured"]
    end

    subgraph PROPOSAL["📝 Proposal"]
        P1["Generate Proposal"]
        P2["AI Draft Content"]
        P3["Pricing Calculator"]
        P4["Review & Edit"]
        P5["Send via Gmail"]
        P6["Track Opens/Views"]
    end

    subgraph CLOSING["✍️ Closing"]
        C1["Negotiation"]
        C2["Contract Generation"]
        C3["E-Signature (Future)"]
        C4["Payment/Deposit"]
        C5["Convert to Client"]
    end

    Q1 --> Q2 --> Q3
    Q3 -->|Qualified| O1
    Q3 -->|Not Qualified| DISCARD["Archive"]

    O1 --> O2 --> O3 --> O4 --> O5
    O5 -->|Response| D1

    D1 --> D2 --> D3 --> D4 --> D5 --> D6
    D6 --> P1

    P1 --> P2 --> P3 --> P4 --> P5 --> P6
    P6 --> C1

    C1 --> C2 --> C3 --> C4 --> C5
```

### 3. Project Initiation (AI-Powered)

```mermaid
flowchart TB
    subgraph SOW["📄 Scope of Work"]
        S1["Import from Proposal"]
        S2["Define Deliverables"]
        S3["Set Milestones"]
        S4["Confirm Budget/Hours"]
    end

    subgraph PRD["🤖 AI PRD Generation"]
        P1["Analyze SOW"]
        P2["Generate Sections"]
        P3["Technical Requirements"]
        P4["User Stories"]
        P5["Acceptance Criteria"]
        P6["Human Review"]
        P7["Finalize PRD"]
    end

    subgraph REPO["🔧 Repository Setup"]
        R1["Select Template"]
        R2["Create GitHub Repo"]
        R3["Configure CI/CD"]
        R4["Set Branch Protections"]
        R5["Add Team Access"]
    end

    subgraph CREDS["🔐 Credentials"]
        C1["Request from Client"]
        C2["Encrypt & Store"]
        C3["Set Access Policies"]
        C4["Audit Logging"]
    end

    subgraph TASKS["📋 Initial Tasks"]
        T1["PRD → Task Extraction"]
        T2["AI Suggests Tasks"]
        T3["Human Review"]
        T4["Populate Backlog"]
    end

    S1 --> S2 --> S3 --> S4
    S4 --> P1
    P1 --> P2 --> P3 --> P4 --> P5 --> P6
    P6 -->|Approved| P7
    P6 -->|Revisions| P2
    P7 --> R1
    R1 --> R2 --> R3 --> R4 --> R5
    R5 --> C1
    C1 --> C2 --> C3 --> C4
    C4 --> T1
    T1 --> T2 --> T3 --> T4
```

### 4. Active Development Cycle

```mermaid
flowchart TB
    subgraph EMAIL_INTEL["📬 Email Intelligence"]
        E1["Gmail Cron Sync"]
        E2["Thread Detection"]
        E3["AI Analysis"]
        E4["Task Extraction"]
        E5["Suggestion Review"]
    end

    subgraph KANBAN["📋 Kanban Board"]
        K1["Backlog"]
        K2["On Deck"]
        K3["In Progress"]
        K4["In Review"]
        K5["Blocked"]
        K6["Done"]
    end

    subgraph CODING["💻 Development"]
        C1["Pick Task"]
        C2["Create Branch"]
        C3["Write Code"]
        C4["Create PR"]
        C5["Code Review"]
        C6["Merge"]
    end

    subgraph TIME["⏰ Time Tracking"]
        T1["Log Hours"]
        T2["Link to Tasks"]
        T3["Deduct from Block"]
        T4["Generate Reports"]
    end

    E1 --> E2 --> E3 --> E4 --> E5
    E5 -->|Approved| K1

    K1 --> K2 --> K3
    K3 --> K4
    K4 -->|Approved| K6
    K4 -->|Needs Work| K3
    K3 --> K5
    K5 --> K3

    K3 --> C1
    C1 --> C2 --> C3 --> C4 --> C5 --> C6
    C6 --> K6

    C3 --> T1
    T1 --> T2 --> T3 --> T4
```

### 5. Hour Block Lifecycle

```mermaid
flowchart TB
    subgraph PURCHASE["💰 Purchase"]
        P1["Client Buys Hours"]
        P2["Create Hour Block"]
        P3["Set Invoice Number"]
        P4["Hours Available"]
    end

    subgraph USAGE["📊 Usage"]
        U1["Developer Logs Time"]
        U2["Hours Deducted"]
        U3["Usage Dashboard"]
        U4["Client Visibility"]
    end

    subgraph ALERTS["🔔 Alerts"]
        A1["Check Threshold"]
        A2["Low Hours Warning"]
        A3["Critical Alert"]
        A4["Block Exhausted"]
    end

    subgraph RENEWAL["🔄 Renewal"]
        R1["Renewal Reminder"]
        R2["Generate Quote"]
        R3["Client Approval"]
        R4["New Block Created"]
    end

    P1 --> P2 --> P3 --> P4
    P4 --> U1
    U1 --> U2 --> U3 --> U4
    U2 --> A1
    A1 -->|>25%| U1
    A1 -->|<25%| A2
    A2 -->|<10%| A3
    A3 -->|0%| A4
    A2 --> R1
    A3 --> R1
    R1 --> R2 --> R3 --> R4
    R4 --> P4
```

### 6. Autonomous Bug Fixing

```mermaid
flowchart TB
    subgraph INTAKE["🐛 Bug Intake"]
        I1["Client Email"]
        I2["Bug Report Form"]
        I3["Error Monitoring"]
        I4["AI Classification"]
    end

    subgraph ANALYSIS["🔍 Analysis"]
        A1["Parse Bug Report"]
        A2["Match to Project"]
        A3["Clone Repository"]
        A4["Analyze Codebase"]
        A5["Identify Root Cause"]
    end

    subgraph SANDBOX["🐳 Sandbox Execution"]
        S1["Spin Up Container"]
        S2["Mount Repo"]
        S3["Set Resource Limits"]
        S4["Execute Claude Agent"]
    end

    subgraph AGENT["🤖 Claude Agent"]
        AG1["Read Files"]
        AG2["Understand Issue"]
        AG3["Plan Fix"]
        AG4["Write Code"]
        AG5["Run Tests"]
        AG6["Iterate if Needed"]
    end

    subgraph OUTPUT["📤 Output"]
        O1["Create Branch"]
        O2["Commit Changes"]
        O3["Create PR"]
        O4["Notify Team"]
        O5["Await Review"]
    end

    subgraph ESCALATION["👨‍💻 Escalation"]
        E1["Budget Exceeded"]
        E2["Tests Failing"]
        E3["Confidence Low"]
        E4["Create Task for Human"]
    end

    I1 --> I4
    I2 --> I4
    I3 --> I4
    I4 --> A1
    A1 --> A2 --> A3 --> A4 --> A5
    A5 --> S1
    S1 --> S2 --> S3 --> S4
    S4 --> AG1
    AG1 --> AG2 --> AG3 --> AG4 --> AG5
    AG5 -->|Pass| O1
    AG5 -->|Fail| AG6
    AG6 --> AG4
    AG6 -->|Max Iterations| E2
    O1 --> O2 --> O3 --> O4 --> O5

    A5 -->|Too Complex| E3
    S4 -->|Budget Hit| E1
    E1 --> E4
    E2 --> E4
    E3 --> E4
```

### 7. Multi-Project Client

```mermaid
flowchart TB
    subgraph CLIENT["👤 Client"]
        C1["Client Record"]
        C2["Billing Info"]
        C3["Contacts"]
    end

    subgraph PROJECTS["📁 Projects"]
        P1["Project A: Initial Build"]
        P2["Project B: Phase 2"]
        P3["Project C: Maintenance"]
        P4["Project D: New Feature"]
    end

    subgraph HOURS["⏱️ Hour Blocks"]
        H1["Block 1: 40 hrs"]
        H2["Block 2: 20 hrs"]
        H3["Block 3: 10 hrs"]
    end

    subgraph ALLOCATION["📊 Allocation"]
        A1["Project A: 25 hrs"]
        A2["Project B: 15 hrs"]
        A3["Project C: 10 hrs"]
        A4["Unallocated: 20 hrs"]
    end

    C1 --> P1
    C1 --> P2
    C1 --> P3
    C1 --> P4

    C1 --> H1
    C1 --> H2
    C1 --> H3

    H1 --> A1
    H1 --> A2
    H2 --> A3
    H2 --> A4
    H3 --> A4

    P1 -->|Complete| P2
    P2 -->|Complete| P3
    P3 -->|New Scope| P4
```

---

## Integration Points

### External Systems

```mermaid
flowchart LR
    subgraph PORTAL["PTS Portal"]
        CORE["Core System"]
    end

    subgraph GOOGLE["Google"]
        GMAIL["Gmail API"]
        GCAL["Calendar API"]
        GDRIVE["Drive API (Future)"]
    end

    subgraph GITHUB["GitHub"]
        REPOS["Repositories"]
        PRS["Pull Requests"]
        ACTIONS["GitHub Actions"]
    end

    subgraph PAYMENTS["Payments (Future)"]
        STRIPE["Stripe"]
        INVOICE["Invoice Generation"]
    end

    subgraph COMMS["Communications"]
        RESEND["Resend (Email)"]
        WHATSAPP["WhatsApp (Future)"]
        SLACK["Slack (Future)"]
    end

    subgraph AI["AI Services"]
        GEMINI["Google Gemini"]
        CLAUDE["Anthropic Claude"]
        VERCEL["Vercel AI Gateway"]
    end

    subgraph ANALYTICS["Analytics"]
        POSTHOG["PostHog"]
    end

    CORE <--> GMAIL
    CORE <--> GCAL
    CORE <--> GDRIVE
    CORE <--> REPOS
    CORE <--> PRS
    CORE <--> ACTIONS
    CORE <--> STRIPE
    CORE <--> INVOICE
    CORE <--> RESEND
    CORE <--> WHATSAPP
    CORE <--> SLACK
    CORE <--> GEMINI
    CORE <--> CLAUDE
    CORE <--> VERCEL
    CORE <--> POSTHOG
```

---

## Data Flow Summary

```mermaid
flowchart TB
    subgraph INPUT["📥 Inputs"]
        I1["Emails"]
        I2["Website Forms"]
        I3["Bug Reports"]
        I4["Time Entries"]
    end

    subgraph PROCESSING["⚙️ Processing"]
        P1["AI Analysis"]
        P2["Entity Matching"]
        P3["Suggestion Generation"]
        P4["Task Creation"]
    end

    subgraph STORAGE["💾 Storage"]
        S1["PostgreSQL"]
        S2["Supabase Storage"]
        S3["Encrypted Vault"]
    end

    subgraph OUTPUT["📤 Outputs"]
        O1["Task Board"]
        O2["PRs on GitHub"]
        O3["Email Notifications"]
        O4["Client Reports"]
    end

    I1 --> P1
    I2 --> P2
    I3 --> P1
    I4 --> P4

    P1 --> P3
    P2 --> P3
    P3 --> P4

    P4 --> S1
    P3 --> S1

    S1 --> O1
    S1 --> O2
    S1 --> O3
    S1 --> O4
```

---

## Next Steps

See `roadmap-phases.md` for the detailed implementation plan broken into small, mergeable PRs.
