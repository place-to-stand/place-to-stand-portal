'use server'

import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { requireUser } from '@/lib/auth/session'
import { ensureClientAccessByTaskId } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { tasks } from '@/lib/db/schema'
import { NotFoundError, ForbiddenError } from '@/lib/errors/http'
import { getProjectRepos } from '@/lib/data/github-repos'
import { listIssueComments, type GitHubComment } from '@/lib/github/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WorkerCommentStatus =
  | 'working'
  | 'plan_ready'
  | 'implementing'
  | 'pr_created'
  | 'done_no_changes'
  | 'error'
  | 'unknown'

export type WorkerComment = {
  id: number
  body: string
  login: string
  avatarUrl: string
  createdAt: string
  htmlUrl: string
  status: WorkerCommentStatus
  isBot: boolean
}

export type WorkerStatusResult =
  | {
      comments: WorkerComment[]
      prUrl: string | null
      latestStatus: WorkerCommentStatus | null
    }
  | { error: string }

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

const WORKER_BOT_LOGIN = 'pts-worker[bot]'
const PR_URL_REGEX = /\*\*Pull request:\*\*\s+(https:\/\/github\.com\/\S+)/
const PLAN_HEADING = '## Implementation Plan'
const WORKING_PATTERNS = ['Agent working', 'Planning...', '🔄', 'Working on']
const ERROR_PATTERNS = ['**Agent failed**', '**Budget limit**', '❌ Agent failed', '❌ Budget']

function classifyWorkerComment(body: string): WorkerCommentStatus {
  if (ERROR_PATTERNS.some(p => body.includes(p))) return 'error'
  if (PR_URL_REGEX.test(body)) return 'pr_created'
  if (body.includes('**No changes made**') || body.includes('**Changes committed**')) return 'done_no_changes'
  if (body.includes(PLAN_HEADING)) return 'plan_ready'
  if (WORKING_PATTERNS.some(p => body.includes(p))) return 'working'
  return 'unknown'
}

function extractPrUrl(comments: WorkerComment[]): string | null {
  for (let i = comments.length - 1; i >= 0; i--) {
    const match = comments[i].body.match(PR_URL_REGEX)
    if (match) return match[1]
  }
  return null
}

// ---------------------------------------------------------------------------
// Server action
// ---------------------------------------------------------------------------

const fetchSchema = z.object({
  taskId: z.string().uuid(),
})

/**
 * Fetch the current worker status for a task by reading GitHub issue comments.
 */
export async function fetchWorkerStatus(input: {
  taskId: string
}): Promise<WorkerStatusResult> {
  const user = await requireUser()

  const parsed = fetchSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid payload.' }

  const { taskId } = parsed.data

  try {
    await ensureClientAccessByTaskId(user, taskId)
  } catch (error) {
    if (error instanceof NotFoundError) return { error: 'Task not found.' }
    if (error instanceof ForbiddenError) return { error: 'Permission denied.' }
    console.error('fetchWorkerStatus auth error', error)
    return { error: 'Unable to authorize request.' }
  }

  // Load task
  const [task] = await db
    .select({
      id: tasks.id,
      projectId: tasks.projectId,
      githubIssueNumber: tasks.githubIssueNumber,
    })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1)

  if (!task) return { error: 'Task not found.' }
  if (!task.githubIssueNumber) {
    return { comments: [], prUrl: null, latestStatus: null }
  }

  // Find the repo link for this project to get connection credentials
  const repos = await getProjectRepos(task.projectId)
  if (repos.length === 0) return { error: 'No linked repository found.' }

  // Use the first active repo link (most common case)
  const repoLink = repos[0]

  let rawComments: GitHubComment[]
  try {
    rawComments = await listIssueComments(
      user.id,
      repoLink.repoOwner,
      repoLink.repoName,
      task.githubIssueNumber,
      repoLink.oauthConnectionId
    )
  } catch (error) {
    console.error('Failed to fetch issue comments', error)
    return {
      error:
        error instanceof Error
          ? `GitHub API error: ${error.message}`
          : 'Failed to fetch issue comments.',
    }
  }

  // Map all comments, classifying bot comments and marking others
  const allComments: WorkerComment[] = rawComments.map(c => {
    const isBot = c.user.login === WORKER_BOT_LOGIN
    return {
      id: c.id,
      body: c.body,
      login: c.user.login,
      avatarUrl: c.user.avatar_url,
      createdAt: c.created_at,
      htmlUrl: c.html_url,
      status: isBot ? classifyWorkerComment(c.body) : 'unknown',
      isBot,
    }
  })

  // Post-process: reclassify 'working' bot comments as 'implementing' when
  // the preceding user command was an implement/execute request (no /plan flag).
  for (let i = 0; i < allComments.length; i++) {
    if (allComments[i].isBot && allComments[i].status === 'working') {
      // Walk backwards to find the nearest preceding user command
      for (let j = i - 1; j >= 0; j--) {
        if (!allComments[j].isBot && allComments[j].body.includes('@pts-worker')) {
          if (!allComments[j].body.includes('/plan')) {
            allComments[i].status = 'implementing'
          }
          break
        }
      }
    }
  }

  const botComments = allComments.filter(c => c.isBot)
  const prUrl = extractPrUrl(botComments)
  const latestStatus =
    botComments.length > 0
      ? botComments[botComments.length - 1].status
      : null

  // Persist the latest worker status to the task for board display
  if (latestStatus && latestStatus !== 'unknown') {
    await db
      .update(tasks)
      .set({ workerStatus: latestStatus })
      .where(eq(tasks.id, taskId))
  }

  return { comments: botComments, prUrl, latestStatus }
}
