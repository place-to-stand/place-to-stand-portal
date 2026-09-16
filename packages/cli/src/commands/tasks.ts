import { readFileSync } from 'node:fs'

import type { Command } from 'commander'

import { apiGet, apiPatch, apiPost } from '../client.js'
import { resolveApiContext } from '../context.js'
import { emit, emitMessage } from '../output.js'

type Task = {
  id: string
  /** Absent from servers that predate it, so the URL line is best-effort. */
  path?: string | null
}

type ListOptions = {
  project?: string
  lead?: string
  status?: string
  assignee?: string
  limit?: string
}

type CreateOptions = {
  title: string
  project?: string
  lead?: string
  description?: string
  status?: string
  due?: string
  assignee?: string[]
}

type EditOptions = {
  title?: string
  project?: string
  description?: string
  status?: string
  due?: string
  assignee?: string[]
  clearDescription?: boolean
  clearDue?: boolean
}

/**
 * Multi-paragraph text is awkward to pass as one shell argument, so every
 * free-text flag (`--body`, `--description`) accepts `-` to read stdin — a
 * heredoc, usually — like `updates draft --items -`.
 */
function textOrStdin(value: string | undefined): string | undefined {
  return value === '-' ? readFileSync(0, 'utf8') : value
}

/**
 * The server sends a portal-relative `path`; the CLI knows which portal it is
 * talking to, so it adds the absolute `url` an agent can paste into a reply
 * without reconstructing it. Null when the project has no board URL.
 */
async function withUrl<T extends Task>(task: T): Promise<T & { url: string | null }> {
  const apiUrl = await resolveApiContext()

  return { ...task, url: task.path ? `${apiUrl}${task.path}` : null }
}

async function withUrls<T extends Task>(tasks: T[]): Promise<(T & { url: string | null })[]> {
  return Promise.all(tasks.map(withUrl))
}

/**
 * The portal URL also goes to stderr, as `updates draft` does, so a human
 * watching the terminal sees it while `pts tasks create | jq` still gets
 * clean JSON on stdout.
 */
function emitTaskUrl(task: { url: string | null }): void {
  if (task.url) {
    emitMessage(`View: ${task.url}`)
  }
}

export function registerTaskCommands(program: Command): void {
  const tasks = program.command('tasks').description('Read and write tasks')

  tasks
    .command('list')
    .description('List tasks, most recently updated first')
    .option('--project <ref>', 'Project UUID or slug')
    .option('--lead <leadId>', 'Only tasks linked to this lead')
    .option('--status <status>', 'ON_DECK | IN_PROGRESS | BLOCKED | DONE')
    .option('--assignee <userId>', 'Only tasks assigned to this user id')
    .option('--limit <count>', 'Maximum rows (default 50, max 200)')
    .action(async (options: ListOptions) => {
      const { data } = await apiGet<Task[]>('api/cli/v1/tasks', {
        project: options.project,
        lead: options.lead,
        status: options.status,
        assignee: options.assignee,
        limit: options.limit,
      })

      emit(await withUrls(data))
    })

  tasks
    .command('show <taskId>')
    .description('Show one task')
    .action(async (taskId: string) => {
      const task = await withUrl(
        (await apiGet<Task>(`api/cli/v1/tasks/${taskId}`)).data
      )

      emit(task)
      emitTaskUrl(task)
    })

  tasks
    .command('create')
    .description('Create a task')
    .requiredOption('--title <title>', 'Task title')
    .option(
      '--project <ref>',
      'Project UUID or slug; required unless --lead is given'
    )
    .option(
      '--lead <leadId>',
      'Link the task to a lead; without --project it goes in the Sales project'
    )
    .option('--description <text>', 'Task description; "-" reads stdin')
    .option('--status <status>', 'Defaults to ON_DECK')
    .option('--due <date>', 'Due date as YYYY-MM-DD')
    .option('--assignee <user...>', 'Assign by email or user id')
    .action(async (options: CreateOptions) => {
      if (!options.project && !options.lead) {
        throw new Error('Provide --project, or --lead for a sales task.')
      }

      const { data, warning } = await apiPost<Task>('api/cli/v1/tasks', {
        title: options.title,
        project: options.project,
        leadId: options.lead,
        description: textOrStdin(options.description),
        status: options.status,
        dueOn: options.due,
        assigneeIds: options.assignee,
      })

      const task = await withUrl(data)

      emit(task, warning)
      emitTaskUrl(task)
    })

  tasks
    .command('comment <taskId>')
    .description(
      'Add a comment to a task. The body is minimal markdown: paragraphs on blank lines, - bullets, 1. numbered lists, **bold**, *italic*, `code`, [text](https://…) links.'
    )
    .requiredOption('--body <text>', 'Comment body; "-" reads stdin')
    .action(async (taskId: string, options: { body: string }) => {
      const body = textOrStdin(options.body)

      const { data } = await apiPost(`api/cli/v1/tasks/${taskId}/comments`, {
        body,
      })

      emit(data)

      // A comment is the most common "I touched this task" moment, so it gets
      // the same View line as an edit — one extra read for a pasteable link.
      const task = await withUrl(
        (await apiGet<Task>(`api/cli/v1/tasks/${taskId}`)).data
      )
      emitTaskUrl(task)
    })

  tasks
    .command('comments <taskId>')
    .description('List comments on a task')
    .option('--limit <count>', 'Maximum rows (default 50, max 100)')
    .action(async (taskId: string, options: { limit?: string }) => {
      const { data } = await apiGet(`api/cli/v1/tasks/${taskId}/comments`, {
        limit: options.limit,
      })

      emit(data)
    })

  tasks
    .command('edit <taskId>')
    .description('Update a task; omitted fields keep their current values')
    .option('--title <title>')
    .option('--project <ref>', 'Move the task to another project')
    .option('--description <text>', 'Task description; "-" reads stdin')
    .option('--status <status>')
    .option('--due <date>', 'Due date as YYYY-MM-DD')
    .option('--assignee <user...>', 'Replace assignees, by email or user id')
    .option('--clear-description', 'Remove the description')
    .option('--clear-due', 'Remove the due date')
    .action(async (taskId: string, options: EditOptions) => {
      // Only keys actually present are sent. The API treats an absent key as
      // "leave alone" and an explicit null as "clear", which is what the
      // --clear-* flags produce.
      const payload: Record<string, unknown> = {}

      if (options.title !== undefined) payload.title = options.title
      if (options.project !== undefined) payload.project = options.project
      if (options.status !== undefined) payload.status = options.status
      if (options.assignee !== undefined) payload.assigneeIds = options.assignee

      if (options.clearDescription) {
        payload.description = null
      } else if (options.description !== undefined) {
        payload.description = textOrStdin(options.description)
      }

      if (options.clearDue) {
        payload.dueOn = null
      } else if (options.due !== undefined) {
        payload.dueOn = options.due
      }

      if (!Object.keys(payload).length) {
        throw new Error('Provide at least one field to update.')
      }

      const { data, warning } = await apiPatch<Task>(
        `api/cli/v1/tasks/${taskId}`,
        payload
      )
      const task = await withUrl(data)

      emit(task, warning)
      emitTaskUrl(task)
    })
}
