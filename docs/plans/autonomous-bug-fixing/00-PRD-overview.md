# Autonomous Bug-Fixing System - Product Requirements Document

**Version:** 3.0
**Date:** December 26, 2024
**Status:** Planning
**Owner:** Place to Stand Engineering

---

## Executive Summary

This document outlines a **simplified architecture** for an autonomous bug-fixing system. When a client reports a bug via email, chat, or form, the system:

1. Parses the bug report and links it to the correct project/repo
2. Queues a fix job
3. Spins up a sandboxed Docker container with the repo cloned
4. Runs Claude (via Anthropic API) with file/bash/git tools to implement the fix
5. Creates a Pull Request on GitHub
6. Notifies you via WhatsApp/Slack when ready for review

**The only human touchpoint is reviewing and merging the PR.**

### Key Architectural Decision

~~Run Claude Code CLI in containers~~ → **Use Claude API with custom tools in Docker containers**

Claude Code CLI is interactive-only. Instead, we use the Anthropic SDK with tool definitions that execute inside sandboxed containers. This gives us the same capabilities (file read/write, bash, git) with full control over execution.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT INTAKE                             │
│              Email │ Chat Widget │ Form │ WhatsApp               │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BUG PARSING (Claude Haiku)                    │
│         Parse message → Extract details → Link to project        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      JOB QUEUE (pg-boss)                         │
│            Priority │ Retry │ Status │ Dead Letter               │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   SANDBOX CONTAINER (Docker)                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Environment:                                              │  │
│  │  • Repo cloned from GitHub                                │  │
│  │  • Dependencies installed (npm install)                   │  │
│  │  • GitHub token for push access                           │  │
│  │  • Resource limits: 2GB RAM, 2 CPU, 15min timeout        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                │                                 │
│                                ▼                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              CLAUDE OPUS (Anthropic API)                   │  │
│  │                                                            │  │
│  │  System prompt: "You are a senior developer fixing a bug" │  │
│  │                                                            │  │
│  │  Available tools (executed in container):                 │  │
│  │  ├─ read_file(path) → file contents                       │  │
│  │  ├─ write_file(path, content) → success                   │  │
│  │  ├─ edit_file(path, old, new) → success                   │  │
│  │  ├─ list_files(path, pattern) → file list                 │  │
│  │  ├─ search_code(pattern, path) → matches                  │  │
│  │  ├─ run_command(cmd) → stdout/stderr                      │  │
│  │  ├─ git_status() → status                                 │  │
│  │  ├─ git_diff() → diff                                     │  │
│  │  ├─ git_commit(message) → commit hash                     │  │
│  │  └─ git_push(branch) → success                            │  │
│  │                                                            │  │
│  │  Agentic loop until:                                      │  │
│  │  • Fix complete (tests pass, PR created)                  │  │
│  │  • Budget exhausted (tokens or time)                      │  │
│  │  • Unrecoverable error                                    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       CREATE PULL REQUEST                        │
│     Push branch → Create PR via GitHub API → Link to bug         │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NOTIFY DEVELOPER                              │
│       WhatsApp/Slack/Email: "Fix ready! PR: [link]"             │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   YOU REVIEW & MERGE                             │
│              (Only human step in the process)                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Existing Infrastructure

We have significant infrastructure already built:

| Component | Location | Status | Reuse Strategy |
|-----------|----------|--------|----------------|
| GitHub OAuth | `lib/oauth/github.ts` | ✅ Complete | Use for repo access |
| Google OAuth | `lib/oauth/google.ts` | ✅ Complete | Use for Gmail intake |
| Token Encryption | `lib/oauth/encryption.ts` | ✅ Complete | Use for all secrets |
| GitHub Client | `lib/github/client.ts` | ⚠️ Partial | Extend with push/commit |
| Gmail Sync | `lib/email/sync.ts` | ⚠️ Partial | Extend for full body |
| Email Matching | `lib/email/matcher.ts` | ✅ Complete | Reuse for bug→project |
| PR Suggestions | `lib/data/pr-suggestions/` | ✅ Complete | Extend for bug PRs |
| Activity Logging | `lib/activity/logger.ts` | ✅ Complete | Add bug fix events |
| Webhook Pattern | `app/api/integrations/leads-intake/` | ✅ Complete | Copy for bug intake |
| Docker Setup | `Dockerfile`, `docker-compose.yml` | ⚠️ Partial | Add worker service |

**Estimated reuse: ~35% of total system**

---

## What Needs to Be Built

### New Components

| Component | Complexity | Description |
|-----------|------------|-------------|
| Job Queue | Medium | pg-boss for async job processing |
| Bug Reports Schema | Low | Database table + API endpoints |
| Worker Container | Medium | Docker image with Node.js, git, tools |
| Tool Implementations | Medium | read_file, write_file, run_command, etc. |
| Claude Agent Loop | Medium | Anthropic SDK integration |
| Container Orchestrator | Medium | Spawn, monitor, cleanup containers |
| Notification Service | Low | WhatsApp/Twilio/Slack integration |

### Extensions to Existing

| Component | Changes Needed |
|-----------|----------------|
| GitHub Client | Add: `getFileContent()`, `createCommit()`, `pushBranch()` |
| Gmail Sync | Add: Full body text extraction, attachment handling |
| Docker Compose | Add: Worker service definition |
| Activity Logger | Add: Bug fix event types |

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Goal:** Job queue + bug report schema

**Deliverables:**
- [ ] Install and configure pg-boss
- [ ] Create `bug_reports` table with migration
- [ ] Bug intake API endpoint (`POST /api/bugs`)
- [ ] Job queue wrapper with retry/backoff
- [ ] Basic job status tracking

**Database Schema:**
```sql
CREATE TYPE bug_status AS ENUM (
  'NEW',           -- Just received
  'QUEUED',        -- In job queue
  'IN_PROGRESS',   -- Agent working on it
  'PR_CREATED',    -- Fix ready for review
  'MERGED',        -- PR merged, bug closed
  'FAILED',        -- Agent couldn't fix
  'WONT_FIX'       -- Marked as won't fix
);

CREATE TYPE bug_priority AS ENUM (
  'CRITICAL',      -- Production down
  'HIGH',          -- Major feature broken
  'MEDIUM',        -- Minor feature broken
  'LOW'            -- Nice to have
);

CREATE TABLE bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Linking
  project_id UUID REFERENCES projects(id),
  github_repo_link_id UUID REFERENCES github_repo_links(id),
  source_email_id UUID REFERENCES email_metadata(id),

  -- Bug details
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  reproduction_steps TEXT,
  error_logs TEXT,

  -- Metadata
  status bug_status NOT NULL DEFAULT 'NEW',
  priority bug_priority NOT NULL DEFAULT 'MEDIUM',
  reported_by UUID REFERENCES users(id),

  -- Fix tracking
  fix_branch TEXT,
  fix_pr_url TEXT,
  fix_pr_number INTEGER,
  fix_commit_sha TEXT,

  -- Agent metrics
  agent_job_id TEXT,
  tokens_used INTEGER,
  cost_usd DECIMAL(10,4),
  duration_seconds INTEGER,
  iterations INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);
```

**Job Queue Setup:**
```typescript
// lib/jobs/queue.ts
import PgBoss from 'pg-boss'

const boss = new PgBoss(process.env.DATABASE_URL!)

// Job types
export const JOB_TYPES = {
  FIX_BUG: 'fix-bug',
  SYNC_EMAIL: 'sync-email',
  CLEANUP_CONTAINER: 'cleanup-container',
} as const

// Queue a bug fix
export async function queueBugFix(bugReportId: string, priority: number = 0) {
  await boss.send(JOB_TYPES.FIX_BUG, { bugReportId }, {
    priority,
    retryLimit: 2,
    retryDelay: 60, // 1 minute
    expireInMinutes: 30,
  })
}

// Process bug fixes
export async function startBugFixWorker() {
  await boss.work(JOB_TYPES.FIX_BUG, async (job) => {
    const { bugReportId } = job.data
    await runBugFixAgent(bugReportId)
  })
}
```

---

### Phase 2: Intake Layer (Week 2-3)

**Goal:** Receive bugs from email, forms, chat

**Deliverables:**
- [ ] Extend Gmail sync to extract full body text
- [ ] Bug detection in emails (classify email as bug report)
- [ ] Bug intake webhook (`POST /api/integrations/bug-intake`)
- [ ] Chat widget integration (Intercom/Crisp webhook)
- [ ] Auto-link bugs to projects using email matching

**Email Bug Detection:**
```typescript
// lib/ai/bug-detection.ts
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

export async function classifyEmail(email: EmailMetadata): Promise<{
  isBugReport: boolean
  confidence: number
  extractedBug?: {
    title: string
    description: string
    reproductionSteps?: string
    priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  }
}> {
  const response = await anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022', // Fast & cheap
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `Analyze this email and determine if it's a bug report.

Subject: ${email.subject}
From: ${email.fromEmail}
Body: ${email.bodyText}

If it IS a bug report, extract:
- title (concise summary)
- description (detailed explanation)
- reproductionSteps (if provided)
- priority (CRITICAL if production down, HIGH if major feature broken, MEDIUM if minor, LOW otherwise)

Respond in JSON format.`
    }],
  })

  return JSON.parse(response.content[0].text)
}
```

---

### Phase 3: Sandbox Environment (Week 3-4)

**Goal:** Docker containers for isolated code execution

**Deliverables:**
- [ ] Worker Docker image with Node.js, git, build tools
- [ ] Container orchestration (spawn, monitor, cleanup)
- [ ] Secure secret injection (GitHub tokens)
- [ ] Resource limits and timeouts
- [ ] Workspace cleanup service

**Worker Dockerfile:**
```dockerfile
# docker/worker/Dockerfile
FROM node:20-alpine

# Install system dependencies
RUN apk add --no-cache \
    git \
    bash \
    curl \
    python3 \
    build-base \
    openssh-client

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 agent && \
    adduser -u 1001 -G agent -s /bin/bash -D agent

# Create workspace directory
RUN mkdir -p /workspace && chown agent:agent /workspace

# Set resource limits via environment
ENV NODE_OPTIONS="--max-old-space-size=1536"

USER agent
WORKDIR /workspace

ENTRYPOINT ["/sbin/dumb-init", "--"]
CMD ["bash"]
```

**Container Orchestrator:**
```typescript
// lib/containers/orchestrator.ts
import Docker from 'dockerode'

const docker = new Docker()

export interface ContainerConfig {
  repoUrl: string
  branch: string
  githubToken: string
  timeout: number // milliseconds
}

export async function createSandbox(config: ContainerConfig): Promise<string> {
  // Create container with resource limits
  const container = await docker.createContainer({
    Image: 'pts-agent-worker:latest',
    Tty: true,
    Env: [
      `GITHUB_TOKEN=${config.githubToken}`,
      `REPO_URL=${config.repoUrl}`,
      `BRANCH=${config.branch}`,
    ],
    HostConfig: {
      Memory: 2 * 1024 * 1024 * 1024, // 2GB
      MemorySwap: 2 * 1024 * 1024 * 1024, // No swap
      CpuShares: 1024,
      PidsLimit: 100,
      NetworkMode: 'bridge', // Allow GitHub access
    },
  })

  await container.start()

  // Clone repository
  await execInContainer(container.id, [
    'git', 'clone', '--depth', '1', '--branch', config.branch,
    config.repoUrl, '/workspace/repo'
  ])

  // Install dependencies
  await execInContainer(container.id, ['npm', 'install'], {
    cwd: '/workspace/repo'
  })

  return container.id
}

export async function execInContainer(
  containerId: string,
  cmd: string[],
  options?: { cwd?: string; timeout?: number }
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const container = docker.getContainer(containerId)

  const exec = await container.exec({
    Cmd: cmd,
    AttachStdout: true,
    AttachStderr: true,
    WorkingDir: options?.cwd || '/workspace/repo',
  })

  const stream = await exec.start({ hijack: true, stdin: false })

  // Collect output with timeout
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Command timed out'))
    }, options?.timeout || 60000)

    let stdout = ''
    let stderr = ''

    stream.on('data', (chunk: Buffer) => {
      // Docker multiplexes stdout/stderr
      const type = chunk[0]
      const data = chunk.slice(8).toString()
      if (type === 1) stdout += data
      else stderr += data
    })

    stream.on('end', async () => {
      clearTimeout(timeout)
      const inspect = await exec.inspect()
      resolve({ stdout, stderr, exitCode: inspect.ExitCode || 0 })
    })
  })
}

export async function cleanupContainer(containerId: string): Promise<void> {
  const container = docker.getContainer(containerId)
  await container.stop({ t: 10 }).catch(() => {})
  await container.remove({ force: true })
}
```

---

### Phase 4: Claude Agent (Week 4-6)

**Goal:** Core agent loop with tool execution

**Deliverables:**
- [ ] Anthropic SDK integration
- [ ] Tool definitions (file, bash, git operations)
- [ ] Tool executor that runs in container
- [ ] Agentic loop with budget tracking
- [ ] Error recovery and retry logic

**Tool Definitions:**
```typescript
// lib/agents/tools.ts
import { Tool } from '@anthropic-ai/sdk/resources/messages'

export const AGENT_TOOLS: Tool[] = [
  {
    name: 'read_file',
    description: 'Read the contents of a file',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path relative to repository root'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'write_file',
    description: 'Write content to a file (creates or overwrites)',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        content: { type: 'string', description: 'File content' }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'edit_file',
    description: 'Replace a specific string in a file',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        old_string: { type: 'string', description: 'Exact string to find' },
        new_string: { type: 'string', description: 'Replacement string' }
      },
      required: ['path', 'old_string', 'new_string']
    }
  },
  {
    name: 'list_files',
    description: 'List files in a directory',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path (default: root)' },
        pattern: { type: 'string', description: 'Glob pattern (e.g., "*.ts")' }
      },
      required: []
    }
  },
  {
    name: 'search_code',
    description: 'Search for a pattern in code files',
    input_schema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Regex pattern to search' },
        path: { type: 'string', description: 'Directory to search (default: root)' },
        file_pattern: { type: 'string', description: 'File glob (e.g., "*.ts")' }
      },
      required: ['pattern']
    }
  },
  {
    name: 'run_command',
    description: 'Run a shell command (npm test, npm run lint, etc.)',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Command to run' },
        timeout_seconds: { type: 'number', description: 'Timeout (default: 60)' }
      },
      required: ['command']
    }
  },
  {
    name: 'git_status',
    description: 'Get git status of the repository',
    input_schema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'git_diff',
    description: 'Get git diff of current changes',
    input_schema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'git_create_branch',
    description: 'Create and checkout a new branch',
    input_schema: {
      type: 'object',
      properties: {
        branch_name: { type: 'string', description: 'New branch name' }
      },
      required: ['branch_name']
    }
  },
  {
    name: 'git_commit',
    description: 'Stage all changes and commit',
    input_schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Commit message' }
      },
      required: ['message']
    }
  },
  {
    name: 'git_push',
    description: 'Push current branch to origin',
    input_schema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'task_complete',
    description: 'Signal that the bug fix is complete',
    input_schema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Summary of changes made' },
        branch_name: { type: 'string', description: 'Branch with the fix' },
        files_changed: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of files modified'
        }
      },
      required: ['summary', 'branch_name', 'files_changed']
    }
  }
]
```

**Tool Executor:**
```typescript
// lib/agents/tool-executor.ts
import { execInContainer } from '../containers/orchestrator'

export class ToolExecutor {
  constructor(
    private containerId: string,
    private workspacePath: string = '/workspace/repo'
  ) {}

  async execute(toolName: string, input: Record<string, unknown>): Promise<string> {
    switch (toolName) {
      case 'read_file':
        return this.readFile(input.path as string)

      case 'write_file':
        return this.writeFile(input.path as string, input.content as string)

      case 'edit_file':
        return this.editFile(
          input.path as string,
          input.old_string as string,
          input.new_string as string
        )

      case 'list_files':
        return this.listFiles(input.path as string, input.pattern as string)

      case 'search_code':
        return this.searchCode(
          input.pattern as string,
          input.path as string,
          input.file_pattern as string
        )

      case 'run_command':
        return this.runCommand(
          input.command as string,
          (input.timeout_seconds as number) || 60
        )

      case 'git_status':
        return this.gitStatus()

      case 'git_diff':
        return this.gitDiff()

      case 'git_create_branch':
        return this.gitCreateBranch(input.branch_name as string)

      case 'git_commit':
        return this.gitCommit(input.message as string)

      case 'git_push':
        return this.gitPush()

      case 'task_complete':
        // Special handling - signal completion
        return JSON.stringify({
          status: 'complete',
          summary: input.summary,
          branch: input.branch_name,
          files: input.files_changed
        })

      default:
        throw new Error(`Unknown tool: ${toolName}`)
    }
  }

  private async readFile(path: string): Promise<string> {
    const result = await execInContainer(this.containerId, ['cat', path], {
      cwd: this.workspacePath
    })
    if (result.exitCode !== 0) {
      return `Error reading file: ${result.stderr}`
    }
    return result.stdout
  }

  private async writeFile(path: string, content: string): Promise<string> {
    // Ensure directory exists
    const dir = path.split('/').slice(0, -1).join('/')
    if (dir) {
      await execInContainer(this.containerId, ['mkdir', '-p', dir], {
        cwd: this.workspacePath
      })
    }

    // Write file using heredoc
    const result = await execInContainer(this.containerId, [
      'sh', '-c', `cat > "${path}" << 'EOFMARKER'\n${content}\nEOFMARKER`
    ], { cwd: this.workspacePath })

    if (result.exitCode !== 0) {
      return `Error writing file: ${result.stderr}`
    }
    return `Successfully wrote ${path}`
  }

  private async editFile(path: string, oldStr: string, newStr: string): Promise<string> {
    // Read current content
    const current = await this.readFile(path)
    if (current.startsWith('Error')) return current

    // Replace
    if (!current.includes(oldStr)) {
      return `Error: Could not find "${oldStr.slice(0, 50)}..." in ${path}`
    }

    const updated = current.replace(oldStr, newStr)
    return this.writeFile(path, updated)
  }

  private async listFiles(path?: string, pattern?: string): Promise<string> {
    const targetPath = path || '.'
    const cmd = pattern
      ? ['find', targetPath, '-name', pattern, '-type', 'f']
      : ['find', targetPath, '-type', 'f', '-maxdepth', '3']

    const result = await execInContainer(this.containerId, cmd, {
      cwd: this.workspacePath
    })
    return result.stdout || 'No files found'
  }

  private async searchCode(pattern: string, path?: string, filePattern?: string): Promise<string> {
    const args = ['grep', '-rn', pattern]
    if (filePattern) args.push('--include', filePattern)
    args.push(path || '.')

    const result = await execInContainer(this.containerId, args, {
      cwd: this.workspacePath,
      timeout: 30000
    })
    return result.stdout || 'No matches found'
  }

  private async runCommand(command: string, timeoutSeconds: number): Promise<string> {
    const result = await execInContainer(this.containerId, ['sh', '-c', command], {
      cwd: this.workspacePath,
      timeout: timeoutSeconds * 1000
    })

    let output = ''
    if (result.stdout) output += result.stdout
    if (result.stderr) output += `\nSTDERR:\n${result.stderr}`
    output += `\nExit code: ${result.exitCode}`

    return output
  }

  private async gitStatus(): Promise<string> {
    const result = await execInContainer(this.containerId, ['git', 'status'], {
      cwd: this.workspacePath
    })
    return result.stdout
  }

  private async gitDiff(): Promise<string> {
    const result = await execInContainer(this.containerId, ['git', 'diff'], {
      cwd: this.workspacePath
    })
    return result.stdout || 'No changes'
  }

  private async gitCreateBranch(branchName: string): Promise<string> {
    const result = await execInContainer(this.containerId, [
      'git', 'checkout', '-b', branchName
    ], { cwd: this.workspacePath })

    if (result.exitCode !== 0) {
      return `Error creating branch: ${result.stderr}`
    }
    return `Created and switched to branch: ${branchName}`
  }

  private async gitCommit(message: string): Promise<string> {
    // Stage all changes
    await execInContainer(this.containerId, ['git', 'add', '-A'], {
      cwd: this.workspacePath
    })

    // Commit
    const result = await execInContainer(this.containerId, [
      'git', 'commit', '-m', message
    ], { cwd: this.workspacePath })

    if (result.exitCode !== 0) {
      return `Error committing: ${result.stderr}`
    }
    return `Committed: ${message}`
  }

  private async gitPush(): Promise<string> {
    const result = await execInContainer(this.containerId, [
      'git', 'push', '-u', 'origin', 'HEAD'
    ], { cwd: this.workspacePath })

    if (result.exitCode !== 0) {
      return `Error pushing: ${result.stderr}`
    }
    return 'Successfully pushed to origin'
  }
}
```

**Agent Loop:**
```typescript
// lib/agents/bug-fix-agent.ts
import Anthropic from '@anthropic-ai/sdk'
import { AGENT_TOOLS } from './tools'
import { ToolExecutor } from './tool-executor'
import { BugReport } from '../db/schema'

const anthropic = new Anthropic()

interface AgentResult {
  success: boolean
  summary?: string
  branchName?: string
  filesChanged?: string[]
  error?: string
  tokensUsed: number
  iterations: number
}

const SYSTEM_PROMPT = `You are a senior software engineer tasked with fixing a bug in a codebase.

Your goal is to:
1. Understand the bug from the description provided
2. Explore the codebase to find relevant files
3. Identify the root cause
4. Implement a fix
5. Run tests to verify the fix works
6. Commit your changes and push to a new branch

Guidelines:
- Create a branch named "fix/bug-{id}" where {id} is provided
- Write clean, minimal changes - don't refactor unrelated code
- Run tests after making changes to verify the fix
- If tests fail, iterate until they pass
- When done, use the task_complete tool to signal completion

Available commands you might need:
- npm test (run tests)
- npm run lint (check linting)
- npm run type-check (TypeScript checks)
- npm run build (verify build works)`

export async function runBugFixAgent(
  bugReport: BugReport,
  containerId: string
): Promise<AgentResult> {
  const executor = new ToolExecutor(containerId)

  const branchName = `fix/bug-${bugReport.id.slice(0, 8)}`

  let messages: Anthropic.MessageParam[] = [{
    role: 'user',
    content: `Please fix this bug:

**Title:** ${bugReport.title}

**Description:**
${bugReport.description}

${bugReport.reproductionSteps ? `**Reproduction Steps:**\n${bugReport.reproductionSteps}` : ''}

${bugReport.errorLogs ? `**Error Logs:**\n${bugReport.errorLogs}` : ''}

Create your fix on a branch named: ${branchName}`
  }]

  let totalTokens = 0
  let iteration = 0
  const maxIterations = 50
  const maxTokens = 150_000 // Budget limit

  while (iteration < maxIterations && totalTokens < maxTokens) {
    iteration++

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-20250514',
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      tools: AGENT_TOOLS,
      messages,
    })

    totalTokens += response.usage.input_tokens + response.usage.output_tokens

    // Check if agent is done (no more tool calls)
    if (response.stop_reason === 'end_turn') {
      // Agent finished without using task_complete - might be stuck
      return {
        success: false,
        error: 'Agent stopped without completing task',
        tokensUsed: totalTokens,
        iterations: iteration,
      }
    }

    // Process tool calls
    if (response.stop_reason === 'tool_use') {
      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const block of response.content) {
        if (block.type === 'tool_use') {
          // Check for completion signal
          if (block.name === 'task_complete') {
            const result = JSON.parse(
              await executor.execute(block.name, block.input as Record<string, unknown>)
            )

            return {
              success: true,
              summary: result.summary,
              branchName: result.branch,
              filesChanged: result.files,
              tokensUsed: totalTokens,
              iterations: iteration,
            }
          }

          // Execute tool
          try {
            const result = await executor.execute(
              block.name,
              block.input as Record<string, unknown>
            )

            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: result,
            })
          } catch (error) {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              is_error: true,
            })
          }
        }
      }

      // Continue conversation
      messages.push({ role: 'assistant', content: response.content })
      messages.push({ role: 'user', content: toolResults })
    }
  }

  // Exceeded limits
  return {
    success: false,
    error: totalTokens >= maxTokens
      ? 'Token budget exhausted'
      : 'Max iterations exceeded',
    tokensUsed: totalTokens,
    iterations: iteration,
  }
}
```

---

### Phase 5: PR Creation & Notification (Week 6-7)

**Goal:** Create PRs and notify developers

**Deliverables:**
- [ ] Extend GitHub client with PR creation from agent results
- [ ] PR template with bug context and fix summary
- [ ] WhatsApp notification via Twilio
- [ ] Slack notification webhook
- [ ] Email notification via Resend

**PR Creation:**
```typescript
// lib/agents/pr-creator.ts
import { GitHubClient } from '../github/client'
import { BugReport } from '../db/schema'

export async function createBugFixPR(
  bugReport: BugReport,
  agentResult: AgentResult,
  githubClient: GitHubClient
): Promise<{ prUrl: string; prNumber: number }> {
  const prBody = `## Bug Fix

**Bug:** ${bugReport.title}

### Summary
${agentResult.summary}

### Changes
${agentResult.filesChanged?.map(f => `- \`${f}\``).join('\n')}

### Bug Details
${bugReport.description}

${bugReport.reproductionSteps ? `### Reproduction Steps\n${bugReport.reproductionSteps}` : ''}

---
🤖 *This fix was generated automatically by the PTS Bug-Fixing Agent*
- Iterations: ${agentResult.iterations}
- Tokens used: ${agentResult.tokensUsed.toLocaleString()}
`

  const pr = await githubClient.createPullRequest({
    title: `fix: ${bugReport.title}`,
    body: prBody,
    head: agentResult.branchName!,
    base: 'main', // or detect default branch
  })

  return { prUrl: pr.html_url, prNumber: pr.number }
}
```

**WhatsApp Notification:**
```typescript
// lib/notifications/whatsapp.ts
import twilio from 'twilio'

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

export async function sendWhatsAppNotification(
  to: string,
  bugReport: BugReport,
  prUrl: string
): Promise<void> {
  await client.messages.create({
    from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
    to: `whatsapp:${to}`,
    body: `🐛 Bug fix ready for review!

*${bugReport.title}*

PR: ${prUrl}

Pull the branch to test locally, then merge when ready.`
  })
}
```

---

### Phase 6: Monitoring & Safety (Week 7-8)

**Goal:** Cost tracking, kill switches, observability

**Deliverables:**
- [ ] Cost tracking per bug fix
- [ ] Daily/monthly budget limits
- [ ] Kill switch (pause all agents)
- [ ] PostHog events for tracking
- [ ] Slack alerts for failures/anomalies

**Cost Tracking:**
```typescript
// lib/monitoring/costs.ts

// Claude Opus pricing (as of Jan 2025)
const PRICING = {
  'claude-opus-4-20250514': {
    inputPer1M: 15,    // $15 per 1M input tokens
    outputPer1M: 75,   // $75 per 1M output tokens
  },
  'claude-3-5-haiku-20241022': {
    inputPer1M: 0.25,  // $0.25 per 1M input tokens
    outputPer1M: 1.25, // $1.25 per 1M output tokens
  },
}

export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = PRICING[model] || PRICING['claude-opus-4-20250514']

  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M

  return inputCost + outputCost
}

// Budget enforcement
export async function checkBudget(): Promise<{
  allowed: boolean
  dailySpent: number
  dailyLimit: number
  monthlySpent: number
  monthlyLimit: number
}> {
  const dailyLimit = parseFloat(process.env.DAILY_BUDGET_USD || '100')
  const monthlyLimit = parseFloat(process.env.MONTHLY_BUDGET_USD || '2000')

  const dailySpent = await getDailySpend()
  const monthlySpent = await getMonthlySpend()

  return {
    allowed: dailySpent < dailyLimit && monthlySpent < monthlyLimit,
    dailySpent,
    dailyLimit,
    monthlySpent,
    monthlyLimit,
  }
}
```

**PostHog Events:**
```typescript
// lib/monitoring/events.ts
import { posthog } from '../posthog/server'

export function trackBugFixStarted(bugId: string, projectId: string) {
  posthog.capture({
    distinctId: 'system',
    event: 'bug_fix_started',
    properties: {
      bug_id: bugId,
      project_id: projectId,
    }
  })
}

export function trackBugFixCompleted(
  bugId: string,
  success: boolean,
  metrics: {
    tokensUsed: number
    costUsd: number
    durationSeconds: number
    iterations: number
  }
) {
  posthog.capture({
    distinctId: 'system',
    event: 'bug_fix_completed',
    properties: {
      bug_id: bugId,
      success,
      ...metrics,
    }
  })
}
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Autonomous Fix Rate** | >50% | Bugs fixed without human intervention |
| **Time to PR** | <20 min | From bug report to PR created |
| **Fix Quality** | >70% | PRs merged without changes |
| **Test Pass Rate** | >85% | Fixes that pass existing tests |
| **Cost per Fix** | <$8 | Average API + compute cost |
| **Token Efficiency** | <100K | Average tokens per successful fix |

---

## Timeline Summary

| Week | Phase | Deliverables |
|------|-------|--------------|
| 1-2 | Foundation | Job queue, bug schema, intake API |
| 2-3 | Intake | Email parsing, bug detection, auto-linking |
| 3-4 | Sandbox | Docker worker, container orchestration |
| 4-6 | Agent | Tool implementations, agentic loop |
| 6-7 | PR & Notify | GitHub PR creation, WhatsApp/Slack |
| 7-8 | Monitoring | Cost tracking, alerts, kill switches |

**Total: 8-10 weeks** (down from 18-24 weeks in v2.0)

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Agent generates wrong fix | Medium | Medium | Test validation, human review required |
| Agent introduces security issue | Low | High | No production access, human review |
| Runaway costs | Medium | Medium | Token budgets, daily/monthly limits |
| Container resource exhaustion | Low | Medium | Hard limits, cleanup service |
| GitHub rate limiting | Low | Low | Backoff, token rotation |

---

## Dependencies

### NPM Packages to Add
```json
{
  "@anthropic-ai/sdk": "^0.30.0",
  "pg-boss": "^9.0.0",
  "dockerode": "^4.0.0",
  "twilio": "^5.0.0"
}
```

### Environment Variables
```env
# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Job Queue (uses existing DATABASE_URL)

# Docker (if using remote Docker host)
DOCKER_HOST=unix:///var/run/docker.sock

# Notifications
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_NUMBER=+14155238886

# Budget Limits
DAILY_BUDGET_USD=100
MONTHLY_BUDGET_USD=2000
```

---

## Removed from v2.0

The following components from v2.0 were **eliminated** in this simplified architecture:

| Removed | Reason |
|---------|--------|
| Phase 1: Codebase Intelligence | Claude explores on-demand; no pre-analysis needed |
| Multi-agent specialists | Single agent with tools is sufficient |
| Coordinator/specialist pattern | Simpler single-agent loop |
| Vector embeddings | Not needed for MVP |
| Codebase knowledge schema | Removed with Phase 1 |
| Complex agent orchestration | Tool-based approach is simpler |

These can be added later if the simpler approach proves insufficient.

---

## Changelog

### v3.0 (December 26, 2024)
- **Major simplification:** Removed multi-agent architecture
- **Key insight:** Claude Code is interactive-only; use Claude API with tools instead
- **Reduced phases:** 6 phases down from 7
- **Reduced timeline:** 8-10 weeks down from 18-24 weeks
- **Added:** Complete code examples for all components
- **Removed:** Codebase intelligence pre-analysis (Phase 1 from v2.0)
- **Removed:** Multi-agent specialist pattern

### v2.0 (December 24, 2024)
- Added existing infrastructure inventory
- Added Phase 0 (Job Queue)
- Identified 10 critical gaps

### v1.0 (December 24, 2024)
- Initial PRD creation
