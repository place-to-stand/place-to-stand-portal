import 'server-only'

import { tool } from 'ai'
import { z } from 'zod'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin, ensureTaskAccess } from '@/lib/auth/permissions'
import { fetchClientsWithMetrics } from '@/lib/data/clients'
import { fetchProjectsWithRelations } from '@/lib/data/projects'
import { fetchAssigneeIdsByTask, listTasksForCli } from '@/lib/cli/queries/tasks'
import { getTaskById } from '@/lib/queries/tasks/basic'
import { serializeClient } from '@/lib/cli/serializers/client'
import { serializeProject } from '@/lib/cli/serializers/project'
import { serializeTask } from '@/lib/cli/serializers/task'
import { TASK_STATUSES } from '@/app/(dashboard)/projects/actions/shared-schemas'
import { createProposedTask, linkTaskToSession } from '@/lib/queries/agent-sessions'
import { countOutstandingInvoicesByClient } from '@/lib/queries/invoices'
import { getProjectRepos } from '@/lib/data/github-repos'
import {
  getFileContents,
  searchRepoCode,
  listPullRequests,
  getPullRequest,
  getPullRequestFiles,
  compareCommits,
  resolveRepoLinkAuth,
} from '@/lib/github/client'
import type { GitHubRepoLink } from '@/lib/types/github'

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

export type AgentSessionScope = {
  clientId: string | null
  projectId: string | null
  /** Resolved for the prompt; not required by tool defaulting itself. */
  clientName?: string | null
  projectName?: string | null
}

export function buildAgentSystemPrompt(scope?: AgentSessionScope): string {
  const scopeLine = buildScopeLine(scope)

  return `You are an AI planning assistant inside the Place to Stand internal portal.

You help staff reason across the business — clients, projects, and tasks — before any work is
committed. You are not scoped to a single task: use the read tools to look around before assuming
anything about the current state of a project or client.
${scopeLine}

## Creating work

Never invent a task directly. When new work should be tracked, call \`propose_task\` — this stages
a draft that a human must explicitly review and accept before it becomes a real task. If you know
which project the work belongs to, pass \`projectId\` so the human doesn't have to pick one at
accept time; call \`list_projects\` first if you're not sure.

## Billing questions

\`list_clients\` includes each client's prepaid hours (\`hoursRemaining\`/\`totalHoursPurchased\`) and
billing type. \`list_outstanding_invoices\` covers unpaid sent invoices across all clients. Use these
together to answer "who's low on hours" or "who owes us money" without guessing.

## Referencing existing work

If the conversation references an existing task, call \`select_task\` to pull it into this
session's scope so the human can see it and act on it (e.g. dispatch it) without leaving the chat.
This only links the task into the session — it never modifies the task itself.

## Checking against the actual code

If a project has a linked GitHub repo, you have read-only access to it: \`list_repos\`,
\`read_file\`, \`list_directory\`, and \`search_code\` to look at the real code, \`list_pull_requests\`
and \`get_pull_request\` to see open/closed PRs and their diffs, and \`compare_branches\` to diff any
branch (e.g. a PR branch) against main or another ref. Call \`list_repos\` first if you're unsure
which repo is linked. Use these before answering questions about what's actually implemented,
what a PR changes, or how a branch differs from main — don't guess from the conversation alone.
These tools cannot write anything to GitHub.

Be concise. Prefer taking an action (a tool call) over describing what you would do.`
}

function buildScopeLine(scope?: AgentSessionScope): string {
  if (scope?.projectId && scope.projectName) {
    const clientSuffix = scope.clientName ? ` (client: ${scope.clientName})` : ''
    return `\nThis session is scoped to the project "${scope.projectName}"${clientSuffix}. Assume ` +
      `tool calls apply to this project unless the user clearly asks about something else — you ` +
      `don't need to be told the project on every message.`
  }

  if (scope?.clientId && scope.clientName) {
    return `\nThis session is scoped to the client "${scope.clientName}" (all of their projects). ` +
      `Assume tool calls apply to this client unless the user clearly asks about something else.`
  }

  return '\nThis session has no pinned scope yet — ask which client/project applies if it matters, ' +
    'or use the list tools to look around.'
}

// ---------------------------------------------------------------------------
// Tool schemas
// ---------------------------------------------------------------------------

const listClientsSchema = z.object({
  search: z.string().optional().describe('Optional search over client name/slug'),
})

const listOutstandingInvoicesSchema = z.object({})

const listProjectsSchema = z.object({
  search: z.string().optional().describe('Optional search over project name/slug/client name'),
})

const listTasksSchema = z.object({
  projectId: z.string().uuid().optional().describe('Filter to tasks in this project'),
  status: z.enum(TASK_STATUSES).optional().describe('Filter to tasks in this status'),
  limit: z.number().int().min(1).max(100).default(50),
})

const getTaskSchema = z.object({
  taskId: z.string().uuid(),
})

const proposeTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  projectId: z.string().uuid().optional().describe(
    'The project this task belongs to, if known. If omitted, a human will be asked to pick one before the task can be created.'
  ),
})

const selectTaskSchema = z.object({
  taskId: z.string().uuid(),
})

const repoParamSchema = z
  .string()
  .optional()
  .describe(
    'Full repo name "owner/name". Only needed if more than one repo is linked to this ' +
      'project — call list_repos first if unsure.'
  )

const listReposSchema = z.object({})

const readFileSchema = z.object({
  repo: repoParamSchema,
  path: z.string().describe('File path relative to repository root (e.g., "lib/db/schema.ts")'),
  ref: z.string().optional().describe('Branch, tag, or commit SHA. Defaults to the repo default branch.'),
})

const listDirectorySchema = z.object({
  repo: repoParamSchema,
  path: z.string().describe('Directory path relative to repository root ("" for root)'),
  ref: z.string().optional().describe('Branch, tag, or commit SHA. Defaults to the repo default branch.'),
})

const searchCodeSchema = z.object({
  repo: repoParamSchema,
  query: z.string().describe('Search query — identifiers, keywords, or paths'),
})

const listPullRequestsSchema = z.object({
  repo: repoParamSchema,
  state: z.enum(['open', 'closed', 'all']).default('open'),
})

const getPullRequestSchema = z.object({
  repo: repoParamSchema,
  number: z.number().int().min(1),
})

const compareBranchesSchema = z.object({
  repo: repoParamSchema,
  base: z.string().optional().describe('Base ref to compare from. Defaults to the repo default branch (e.g. main).'),
  head: z.string().describe('Head ref to compare against base — a branch name, PR branch, or commit SHA.'),
})

const MAX_DIFF_CHARS = 30000
const MAX_FILE_PATCH_CHARS = 4000

function truncateText(text: string, limit: number): string {
  if (text.length <= limit) return text
  return `${text.slice(0, limit)}\n\n... (truncated, ${text.length} chars total)`
}

function formatDiffFiles(files: Array<{ filename: string; status: string; additions: number; deletions: number; patch?: string }>): string {
  if (files.length === 0) return '(no file changes)'
  return files
    .map(file => {
      const patch = file.patch
        ? truncateText(file.patch, MAX_FILE_PATCH_CHARS)
        : '(no diff available — binary or too large)'
      return `--- ${file.filename} (${file.status}, +${file.additions}/-${file.deletions})\n${patch}`
    })
    .join('\n\n')
}

// ---------------------------------------------------------------------------
// Tool factory
// ---------------------------------------------------------------------------

/**
 * Builds the Agents workspace tool set for one authenticated request.
 *
 * `user` and `context` are closed over here, never accepted as tool input —
 * the model can never control whose identity is used or which session a
 * proposal/link lands in, same actor-injection rationale as
 * `saveTaskForActor` (lib/tasks/save-task-core.ts).
 *
 * `assertAdmin` runs once here rather than per-tool: this is what protects
 * `fetchProjectsWithRelations` (lib/data/projects), which has no internal
 * permission check of its own — it normally relies on the admin-only
 * page/layout gate, which doesn't exist for an in-process tool call.
 */
export function createAgentTools(
  user: AppUser,
  context: {
    sessionId: string
    assistantMessageId: string
    scope: { clientId: string | null; projectId: string | null }
  }
) {
  assertAdmin(user)

  /**
   * Resolves which linked repo a GitHub tool call applies to and its auth —
   * scoped to the session's project only (same "no scope, no default" rule
   * as list_tasks). Returns a human-readable error string instead of
   * throwing so tool `execute` bodies can just `return` it to the model.
   */
  async function resolveRepoContext(
    repoFullName: string | undefined
  ): Promise<{ repo: GitHubRepoLink; auth: { token: string } } | { error: string }> {
    if (!context.scope.projectId) {
      return {
        error:
          'This session has no project scope, so no repository is linked. Ask the human which ' +
          'project/repo applies, or call select_task on a task in the relevant project first.',
      }
    }

    const repos = await getProjectRepos(context.scope.projectId)
    if (repos.length === 0) {
      return { error: 'No GitHub repository is linked to this project yet.' }
    }

    let repo: GitHubRepoLink
    if (repoFullName) {
      const match = repos.find(r => r.repoFullName.toLowerCase() === repoFullName.toLowerCase())
      if (!match) {
        return {
          error: `No linked repo named "${repoFullName}". Linked repos: ${repos.map(r => r.repoFullName).join(', ')}`,
        }
      }
      repo = match
    } else if (repos.length > 1) {
      return {
        error: `Multiple repos are linked to this project: ${repos.map(r => r.repoFullName).join(', ')}. Pass "repo" to pick one.`,
      }
    } else {
      repo = repos[0]
    }

    try {
      const auth = await resolveRepoLinkAuth(user.id, repo)
      return { repo, auth }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to authenticate with GitHub' }
    }
  }

  return {
    list_clients: tool({
      description: 'List clients, optionally filtered by a search term over name/slug.',
      inputSchema: listClientsSchema,
      execute: async ({ search }: z.infer<typeof listClientsSchema>) => {
        try {
          const clients = await fetchClientsWithMetrics(user, search)
          return clients.map(serializeClient)
        } catch (error) {
          return `Error listing clients: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      },
    }),

    list_outstanding_invoices: tool({
      description:
        'List clients with sent-but-unpaid invoices (status SENT or VIEWED) and the amount owed — ' +
        'the billing-obligation signal for one-off/net-30 invoicing. Does not cover prepaid hour-block ' +
        'balances; use list_clients (hoursRemaining/totalHoursPurchased) for that.',
      inputSchema: listOutstandingInvoicesSchema,
      execute: async () => {
        try {
          const clients = await fetchClientsWithMetrics(user)
          const outstanding = await countOutstandingInvoicesByClient(clients.map(c => c.id))
          if (outstanding.size === 0) return 'No outstanding (sent/viewed) invoices.'
          return clients
            .filter(client => outstanding.has(client.id))
            .map(client => {
              const summary = outstanding.get(client.id)!
              return `${client.name}: ${summary.count} unpaid invoice(s), $${summary.total.toFixed(2)} total`
            })
            .join('\n')
        } catch (error) {
          return `Error listing outstanding invoices: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      },
    }),

    list_projects: tool({
      description: 'List projects, optionally filtered by a search term over name/slug/client name.',
      inputSchema: listProjectsSchema,
      execute: async ({ search }: z.infer<typeof listProjectsSchema>) => {
        try {
          const projects = await fetchProjectsWithRelations({ search })
          return projects.map(serializeProject)
        } catch (error) {
          return `Error listing projects: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      },
    }),

    list_tasks: tool({
      description:
        'List tasks, optionally filtered by project and/or status. When no projectId is given, ' +
        "defaults to this session's pinned scope (a project, or all of a client's projects) if one is set.",
      inputSchema: listTasksSchema,
      execute: async ({ projectId, status, limit }: z.infer<typeof listTasksSchema>) => {
        try {
          const effectiveProjectId = projectId ?? context.scope.projectId ?? undefined
          const effectiveClientId = effectiveProjectId ? undefined : context.scope.clientId ?? undefined
          const rows = await listTasksForCli(user, {
            projectId: effectiveProjectId,
            clientId: effectiveClientId,
            status,
            limit,
          })
          const assigneesByTask = await fetchAssigneeIdsByTask(rows.map(row => row.id))
          return rows.map(row => serializeTask(row, assigneesByTask.get(row.id) ?? []))
        } catch (error) {
          return `Error listing tasks: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      },
    }),

    get_task: tool({
      description: 'Get full details for a single task by id.',
      inputSchema: getTaskSchema,
      execute: async ({ taskId }: z.infer<typeof getTaskSchema>) => {
        try {
          const task = await getTaskById(user, taskId)
          return serializeTask(task)
        } catch (error) {
          return `Error fetching task: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      },
    }),

    propose_task: tool({
      description:
        'Propose a new task for human review. This does NOT create a real task — it stages a ' +
        'draft that a human must explicitly accept before anything is written to the task board. ' +
        'Use this whenever new work should be tracked.',
      inputSchema: proposeTaskSchema,
      execute: async ({ title, description, projectId }: z.infer<typeof proposeTaskSchema>) => {
        try {
          const effectiveProjectId = projectId ?? context.scope.projectId ?? null
          const proposal = await createProposedTask({
            sessionId: context.sessionId,
            title,
            description: description ?? null,
            projectId: effectiveProjectId,
            sourceMessageId: context.assistantMessageId,
          })
          return `Proposed task "${title}" (proposal id ${proposal.id}). Awaiting human review — it is not a real task yet.`
        } catch (error) {
          return `Error proposing task: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      },
    }),

    select_task: tool({
      description:
        'Link an existing task into this session so the human can see it and act on it (e.g. ' +
        'dispatch it) without leaving the chat. This only links the task into scope — it never ' +
        'modifies the task itself.',
      inputSchema: selectTaskSchema,
      execute: async ({ taskId }: z.infer<typeof selectTaskSchema>) => {
        try {
          await ensureTaskAccess(user, taskId)
          await linkTaskToSession({ sessionId: context.sessionId, taskId, addedVia: 'selected' })
          return `Linked task ${taskId} into this session.`
        } catch (error) {
          return `Error linking task: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      },
    }),

    list_repos: tool({
      description: 'List the GitHub repos linked to this session\'s project.',
      inputSchema: listReposSchema,
      execute: async () => {
        if (!context.scope.projectId) {
          return 'This session has no project scope, so there are no linked repositories.'
        }
        try {
          const repos = await getProjectRepos(context.scope.projectId)
          if (repos.length === 0) return 'No GitHub repository is linked to this project yet.'
          return repos.map(r => `${r.repoFullName} (default branch: ${r.defaultBranch})`).join('\n')
        } catch (error) {
          return `Error listing repos: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      },
    }),

    read_file: tool({
      description:
        'Read the contents of a file from the linked GitHub repo (read-only). Use this to check ' +
        'what is actually implemented instead of guessing from the conversation.',
      inputSchema: readFileSchema,
      execute: async ({ repo: repoFullName, path, ref }: z.infer<typeof readFileSchema>) => {
        const resolved = await resolveRepoContext(repoFullName)
        if ('error' in resolved) return resolved.error
        try {
          const result = await getFileContents(
            user.id,
            resolved.repo.repoOwner,
            resolved.repo.repoName,
            path,
            ref,
            resolved.auth
          )
          if (result.type === 'dir') {
            return `"${path}" is a directory. Entries:\n${result.entries.map(e => `  ${e.type === 'dir' ? '\u{1F4C1}' : '\u{1F4C4}'} ${e.name}`).join('\n')}`
          }
          return truncateText(result.content, 50000)
        } catch (error) {
          return `Error reading "${path}": ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      },
    }),

    list_directory: tool({
      description: 'List the contents of a directory in the linked GitHub repo (read-only).',
      inputSchema: listDirectorySchema,
      execute: async ({ repo: repoFullName, path, ref }: z.infer<typeof listDirectorySchema>) => {
        const resolved = await resolveRepoContext(repoFullName)
        if ('error' in resolved) return resolved.error
        try {
          const result = await getFileContents(
            user.id,
            resolved.repo.repoOwner,
            resolved.repo.repoName,
            path || '.',
            ref,
            resolved.auth
          )
          if (result.type === 'file') return `"${path}" is a file, not a directory.`
          return result.entries
            .map(e => `${e.type === 'dir' ? '\u{1F4C1}' : '\u{1F4C4}'} ${e.name}${e.type === 'file' ? ` (${e.size}b)` : ''}`)
            .join('\n')
        } catch (error) {
          return `Error listing "${path}": ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      },
    }),

    search_code: tool({
      description:
        'Search for code patterns, identifiers, or keywords across the linked GitHub repo (read-only).',
      inputSchema: searchCodeSchema,
      execute: async ({ repo: repoFullName, query }: z.infer<typeof searchCodeSchema>) => {
        const resolved = await resolveRepoContext(repoFullName)
        if ('error' in resolved) return resolved.error
        try {
          const results = await searchRepoCode(user.id, resolved.repo.repoOwner, resolved.repo.repoName, query, resolved.auth)
          if (results.length === 0) return `No results found for "${query}".`
          return results
            .map(r => {
              const fragments = r.fragments.length > 0 ? `\n${r.fragments.map(f => `  | ${f}`).join('\n')}` : ''
              return `${r.path}${fragments}`
            })
            .join('\n\n')
        } catch (error) {
          return `Error searching for "${query}": ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      },
    }),

    list_pull_requests: tool({
      description: 'List pull requests on the linked GitHub repo (read-only).',
      inputSchema: listPullRequestsSchema,
      execute: async ({ repo: repoFullName, state }: z.infer<typeof listPullRequestsSchema>) => {
        const resolved = await resolveRepoContext(repoFullName)
        if ('error' in resolved) return resolved.error
        try {
          const prs = await listPullRequests(
            user.id,
            resolved.repo.repoOwner,
            resolved.repo.repoName,
            { state },
            resolved.auth
          )
          if (prs.length === 0) return `No ${state} pull requests.`
          return prs
            .map(
              pr =>
                `#${pr.number} ${pr.title} (${pr.state}${pr.draft ? ', draft' : ''}) — ` +
                `${pr.head.ref} → ${pr.base.ref}, by ${pr.user.login}, updated ${pr.updated_at}`
            )
            .join('\n')
        } catch (error) {
          return `Error listing pull requests: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      },
    }),

    get_pull_request: tool({
      description:
        'Get a pull request\'s details and diff (read-only) — what it changes, its status, and the ' +
        'actual file patches.',
      inputSchema: getPullRequestSchema,
      execute: async ({ repo: repoFullName, number }: z.infer<typeof getPullRequestSchema>) => {
        const resolved = await resolveRepoContext(repoFullName)
        if ('error' in resolved) return resolved.error
        try {
          const [pr, files] = await Promise.all([
            getPullRequest(user.id, resolved.repo.repoOwner, resolved.repo.repoName, number, resolved.auth),
            getPullRequestFiles(user.id, resolved.repo.repoOwner, resolved.repo.repoName, number, resolved.auth),
          ])
          const header =
            `#${pr.number} ${pr.title} (${pr.state}${pr.merged ? ', merged' : ''})\n` +
            `${pr.head.ref} → ${pr.base.ref} by ${pr.user.login}\n` +
            `+${pr.additions}/-${pr.deletions} across ${pr.changed_files} file(s)\n` +
            (pr.body ? `\n${pr.body}\n` : '')
          return truncateText(`${header}\n${formatDiffFiles(files)}`, MAX_DIFF_CHARS)
        } catch (error) {
          return `Error fetching PR #${number}: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      },
    }),

    compare_branches: tool({
      description:
        'Diff two refs in the linked GitHub repo (read-only) — e.g. a PR branch or any branch ' +
        'against main, to see exactly what differs.',
      inputSchema: compareBranchesSchema,
      execute: async ({ repo: repoFullName, base, head }: z.infer<typeof compareBranchesSchema>) => {
        const resolved = await resolveRepoContext(repoFullName)
        if ('error' in resolved) return resolved.error
        const effectiveBase = base ?? resolved.repo.defaultBranch
        try {
          const result = await compareCommits(
            user.id,
            resolved.repo.repoOwner,
            resolved.repo.repoName,
            effectiveBase,
            head,
            resolved.auth
          )
          const header =
            `${head} vs ${effectiveBase}: ${result.status}, ${result.ahead_by} ahead / ` +
            `${result.behind_by} behind (${result.total_commits} commit(s))\n`
          return truncateText(`${header}\n${formatDiffFiles(result.files)}`, MAX_DIFF_CHARS)
        } catch (error) {
          return `Error comparing "${head}" against "${effectiveBase}": ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      },
    }),
  }
}
