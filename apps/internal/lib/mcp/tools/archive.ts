import 'server-only'

import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import { setCompanyArchived } from '@/lib/companies/archive'
import { BadRequestError } from '@/lib/errors/http'
import { setLeadArchived } from '@/lib/leads/archive'
import { revalidateLeadsPath } from '@/lib/leads/revalidate'
import {
  restoreContactMutation,
  softDeleteContactMutation,
} from '@/lib/people/actions'
import { archiveTask, restoreTask } from '@/lib/tasks/archive-task'
import { revalidateTaskViews } from '@/lib/tasks/revalidate-task-views'

import { defineTool } from '../tool'
import { companyId, personId, revalidateDirectory } from './directory-inputs'

const leadId = z.guid().describe('Lead UUID.')
const taskId = z.guid().describe('Task UUID.')

const ASKS = ' The person is asked to approve each call.'

/**
 * Archive and restore, as in the portal: archiving hides a record and
 * restoring brings it back; nothing is deleted for good. Each tool is
 * marked destructive, so the client asks before it runs. The same checks
 * as the portal's buttons apply (see each service).
 */
export function registerArchiveTools(server: McpServer) {
  defineTool(server, {
    name: 'archive_lead',
    title: 'Archive lead',
    description:
      'Archive a lead: it leaves the board and lists. restore_lead brings it back.' +
      ASKS,
    effect: 'destructive',
    input: { leadId },
    run: async ({ leadId }, { user }) => {
      await setLeadArchived(user, leadId, true)
      revalidateLeadsPath()
      return { leadId, archived: true }
    },
  })

  defineTool(server, {
    name: 'restore_lead',
    title: 'Restore lead',
    description:
      'Restore an archived lead (list_leads with archived: true finds them).' +
      ASKS,
    effect: 'destructive',
    input: { leadId },
    run: async ({ leadId }, { user }) => {
      await setLeadArchived(user, leadId, false)
      revalidateLeadsPath()
      return { leadId, archived: false }
    },
  })

  defineTool(server, {
    name: 'archive_task',
    title: 'Archive task',
    description:
      "Archive a task: it leaves the board. When an admin archives it, the task's attached files are deleted for good. Restoring is admin-only (restore_task)." +
      ASKS,
    effect: 'destructive',
    input: { taskId },
    run: async ({ taskId }, { user }) => {
      await archiveTask(user, taskId)
      revalidateTaskViews()
      return { taskId, archived: true }
    },
  })

  defineTool(server, {
    name: 'restore_task',
    title: 'Restore task',
    description:
      'Restore an archived task (admins only; list_tasks with archived: true finds them).' +
      ASKS,
    effect: 'destructive',
    input: { taskId },
    run: async ({ taskId }, { user }) => {
      await restoreTask(user, taskId)
      revalidateTaskViews()
      return { taskId, archived: false }
    },
  })

  defineTool(server, {
    name: 'archive_company',
    title: 'Archive company',
    description:
      "Archive a company; its people and leads stay linked. A company still being billed can't be archived, and archiving a former client turns off its people's portal access." +
      ASKS,
    effect: 'destructive',
    input: { companyId },
    run: async ({ companyId }, { user }) =>
      setCompanyArchivedOrThrow(user, companyId, true),
  })

  defineTool(server, {
    name: 'restore_company',
    title: 'Restore company',
    description:
      'Restore an archived company (list_companies with archived: true finds them). Portal access stays off.' +
      ASKS,
    effect: 'destructive',
    input: { companyId },
    run: async ({ companyId }, { user }) =>
      setCompanyArchivedOrThrow(user, companyId, false),
  })

  defineTool(server, {
    name: 'archive_person',
    title: 'Archive person',
    description:
      "Archive a person. Archiving someone who can sign in or has portal access ends both (admins only), and a client's primary contact needs an admin too." +
      ASKS,
    effect: 'destructive',
    input: { personId },
    run: async ({ personId }, { user }) => {
      const result = await softDeleteContactMutation({ user }, { id: personId })
      if (result.error) throw new BadRequestError(result.error)
      revalidateDirectory()
      return { personId, archived: true }
    },
  })

  defineTool(server, {
    name: 'restore_person',
    title: 'Restore person',
    description:
      'Restore an archived person (list_contacts with archived: true finds them). Sign-in and portal access stay off.' +
      ASKS,
    effect: 'destructive',
    input: { personId },
    run: async ({ personId }, { user }) => {
      const result = await restoreContactMutation({ user }, { id: personId })
      if (result.error) throw new BadRequestError(result.error)
      revalidateDirectory()
      return { personId, archived: false }
    },
  })
}

async function setCompanyArchivedOrThrow(
  user: Parameters<typeof setCompanyArchived>[0],
  companyId: string,
  archived: boolean
) {
  const result = await setCompanyArchived(user, companyId, archived)
  if (!result.ok) {
    throw new BadRequestError(result.error ?? 'Unable to change company.')
  }
  revalidateDirectory()
  return { companyId, archived }
}
