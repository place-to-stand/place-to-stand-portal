import 'server-only'

import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import { statusSchema } from '@/app/(dashboard)/projects/actions/shared-schemas'
import {
  fetchAssigneeIdsByTask,
  fetchBoardLocationsByProject,
  listTasksForCli,
} from '@/lib/cli/queries/tasks'
import { resolveUserIds } from '@/lib/cli/queries/users'
import {
  cliCreateCommentFields,
  cliCreateTaskFields,
  cliUpdateTaskFields,
} from '@/lib/cli/schemas/tasks'
import { serializeComment } from '@/lib/cli/serializers/comment'
import { serializeTask } from '@/lib/cli/serializers/task'
import {
  addTaskComment,
  createTaskFromInput,
  loadSerializedTask,
  resolveProjectId,
  updateTaskFromInput,
} from '@/lib/cli/tasks'
import { BadRequestError } from '@/lib/errors/http'
import { listTaskComments } from '@/lib/queries/task-comments'

import { clip, listLimit, page } from '../output'
import { defineTool } from '../tool'

const taskId = z.string().uuid().describe('Task UUID.')

const RECENT_COMMENTS = 20

export function registerTaskTools(server: McpServer) {
  defineTool(server, {
    name: 'list_tasks',
    title: 'List tasks',
    description:
      'List tasks, most recently updated first. Filter by project, lead, status or assignee. Descriptions are plain-text previews; get_task returns the full task and its comments.',
    effect: 'read',
    input: {
      project: z
        .string()
        .trim()
        .min(1)
        .describe('Project slug or UUID.')
        .optional(),
      lead: z.string().uuid().describe('Lead UUID.').optional(),
      status: statusSchema.optional(),
      assignee: z
        .string()
        .trim()
        .min(1)
        .describe('Assignee email or UUID.')
        .optional(),
      limit: listLimit,
    },
    run: async ({ project, lead, status, assignee, limit }, { user }) => {
      const [projectId, assigneeIds] = await Promise.all([
        project ? resolveProjectId(user, project) : undefined,
        assignee ? resolveUserIds(user, [assignee]) : [],
      ])

      const rows = await listTasksForCli(user, {
        projectId,
        leadId: lead,
        status,
        assigneeId: assigneeIds[0],
        limit: limit + 1,
      })

      const [assignees, locations] = await Promise.all([
        fetchAssigneeIdsByTask(rows.map(row => row.id)),
        fetchBoardLocationsByProject(rows.map(row => row.projectId)),
      ])

      const tasks = rows.map(row => {
        const task = serializeTask(
          row,
          assignees.get(row.id) ?? [],
          locations.get(row.projectId) ?? null
        )

        return { ...task, description: clip(task.description, 'get_task') }
      })

      return page(tasks, limit)
    },
  })

  defineTool(server, {
    name: 'get_task',
    title: 'Get task',
    description: `One task with its full description and its ${RECENT_COMMENTS} most recent comments.`,
    effect: 'read',
    input: { taskId },
    run: async ({ taskId }, { user }) => {
      const [task, comments] = await Promise.all([
        loadSerializedTask(user, taskId),
        listTaskComments(user, taskId, { limit: RECENT_COMMENTS }),
      ])

      return {
        task,
        comments: comments.items.map(serializeComment),
        hasMoreComments: comments.pageInfo.hasNextPage,
      }
    },
  })

  defineTool(server, {
    name: 'create_task',
    title: 'Create task',
    description:
      'Create a task on a project board, as the connected user. project is required unless leadId is set (a lead task with no project goes to the internal Sales project).',
    effect: 'write',
    input: cliCreateTaskFields,
    run: async (args, { user }) => {
      if (!args.project && !args.leadId) {
        throw new BadRequestError('project is required unless leadId is set.')
      }

      const { task, warning } = await createTaskFromInput(user, args, 'MCP')

      return { task, ...(warning ? { warning } : {}) }
    },
  })

  defineTool(server, {
    name: 'update_task',
    title: 'Update task',
    description:
      'Change a task: title, description, status, due date, assignees, project or lead. Omitted fields keep their value; null clears one. assigneeIds replaces the whole list. No tool archives or deletes a task: set status DONE, or archive it in the portal.',
    effect: 'idempotent-write',
    input: { taskId, ...cliUpdateTaskFields },
    run: async ({ taskId, ...changes }, { user }) => {
      if (!Object.values(changes).some(value => value !== undefined)) {
        throw new BadRequestError('Provide at least one field to update.')
      }

      const { task, warning } = await updateTaskFromInput(
        user,
        taskId,
        changes,
        'MCP'
      )

      return { task, ...(warning ? { warning } : {}) }
    },
  })

  defineTool(server, {
    name: 'add_task_comment',
    title: 'Comment on task',
    description:
      'Post a comment on a task as the connected user. Clients may read task comments, so lead with the outcome and keep technical detail last.',
    effect: 'write',
    input: { taskId, ...cliCreateCommentFields },
    run: async ({ taskId, body }, { user }) => ({
      comment: await addTaskComment(user, taskId, body, 'MCP'),
    }),
  })
}
