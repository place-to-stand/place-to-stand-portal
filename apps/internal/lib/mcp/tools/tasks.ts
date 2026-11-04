import 'server-only'

import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import { statusSchema } from '@/lib/tasks/schemas'
import {
  cliCreateCommentFields,
  cliCreateTaskFields,
  cliUpdateTaskFields,
} from '@/lib/cli/schemas/tasks'
import { serializeComment } from '@/lib/cli/serializers/comment'
import {
  addTaskComment,
  createTaskFromInput,
  listTasksForAgent,
  loadSerializedTask,
  updateTaskFromInput,
} from '@/lib/cli/tasks'
import { BadRequestError } from '@/lib/errors/http'
import { listTaskComments } from '@/lib/queries/task-comments'

import { archivedFlag, clip, listLimit } from '../output'
import { defineTool } from '../tool'

const taskId = z.string().uuid().describe('Task UUID.')

const RECENT_COMMENTS = 20

export function registerTaskTools(server: McpServer) {
  defineTool(server, {
    name: 'list_tasks',
    title: 'List tasks',
    description:
      'List tasks, most recently updated first. Filter by project, lead, status or assignee; archived: true lists archived tasks instead. Descriptions are plain-text previews; get_task returns the full task and its comments.',
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
      archived: archivedFlag,
      limit: listLimit,
    },
    run: async (args, { user }) => {
      const { items, hasMore } = await listTasksForAgent(user, args)

      return {
        items: items.map(task => ({
          ...task,
          description: clip(task.description, 'get_task'),
        })),
        hasMore,
      }
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
      'Create a task, as the connected user, on a project board or on a lead: give project or leadId, not both.',
    effect: 'write',
    input: cliCreateTaskFields,
    run: async (args, { user }) => {
      if (!args.project === !args.leadId) {
        throw new BadRequestError('Give a project or a leadId, not both.')
      }

      return createTaskFromInput(user, args, 'MCP')
    },
  })

  defineTool(server, {
    name: 'update_task',
    title: 'Update task',
    description:
      'Change a task: title, description, status, due date, assignee, project or lead. A task is on a project or a lead, never both: setting one moves the task there and clears the other. Omitted fields keep their value; null clears one. A task has one assignee: assigneeIds takes a one-item list ([] unassigns) and only its first entry is kept. To archive a task, use archive_task.',
    effect: 'idempotent-write',
    input: { taskId, ...cliUpdateTaskFields },
    run: async ({ taskId, ...changes }, { user }) => {
      if (!Object.values(changes).some(value => value !== undefined)) {
        throw new BadRequestError('Provide at least one field to update.')
      }
      if (changes.project && changes.leadId) {
        throw new BadRequestError('Give a project or a leadId, not both.')
      }

      return updateTaskFromInput(user, taskId, changes, 'MCP')
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
