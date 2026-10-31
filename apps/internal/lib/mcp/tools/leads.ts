import 'server-only'

import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import {
  addLeadUpdate,
  createLeadFromInput,
  updateLeadFromInput,
} from '@/lib/cli/leads'
import { getLeadForCli, listLeadsForCli } from '@/lib/cli/queries/leads'
import { resolveUserIds } from '@/lib/cli/queries/users'
import {
  cliCreateLeadFields,
  cliCreateLeadUpdateFields,
  cliUpdateLeadFields,
} from '@/lib/cli/schemas/leads'
import { serializeLead } from '@/lib/cli/serializers/lead'
import { serializeLeadUpdate } from '@/lib/cli/serializers/lead-update'
import { BadRequestError } from '@/lib/errors/http'
import { LEAD_STATUS_VALUES } from '@/lib/leads/constants'
import { listLeadUpdates } from '@/lib/queries/lead-updates'

import { clip, listLimit, page, searchText } from '../output'
import { defineTool } from '../tool'

const leadId = z.string().uuid().describe('Lead UUID.')

const RECENT_UPDATES = 20

export function registerLeadTools(server: McpServer) {
  defineTool(server, {
    name: 'list_leads',
    title: 'List leads',
    description:
      'List sales pipeline leads, most recently updated first. Filter by stage, owner or text. Notes are plain-text previews; get_lead returns the full lead and its timeline.',
    effect: 'read',
    input: {
      status: z.enum(LEAD_STATUS_VALUES).optional(),
      assignee: z
        .string()
        .trim()
        .min(1)
        .describe('Owner email or UUID.')
        .optional(),
      search: searchText.optional(),
      limit: listLimit,
    },
    run: async ({ status, assignee, search, limit }, { user }) => {
      const [assigneeId] = assignee
        ? await resolveUserIds(user, [assignee])
        : []

      const rows = await listLeadsForCli(user, {
        status,
        assigneeId,
        search,
        limit: limit + 1,
      })

      const leads = rows.map(row => {
        const lead = serializeLead(row)

        return { ...lead, notes: clip(lead.notes, 'get_lead') }
      })

      return page(leads, limit)
    },
  })

  defineTool(server, {
    name: 'get_lead',
    title: 'Get lead',
    description: `One lead with its full notes and its ${RECENT_UPDATES} most recent timeline entries (calls, emails, texts, meetings).`,
    effect: 'read',
    input: { leadId },
    run: async ({ leadId }, { user }) => {
      const lead = await getLeadForCli(user, leadId)
      const updates = await listLeadUpdates(user, lead.id)

      return {
        lead: serializeLead(lead),
        updates: updates.slice(0, RECENT_UPDATES).map(serializeLeadUpdate),
        hasMoreUpdates: updates.length > RECENT_UPDATES,
      }
    },
  })

  defineTool(server, {
    name: 'create_lead',
    title: 'Create lead',
    description:
      'Add a lead to the sales pipeline, as the connected user. Starts in NEW_OPPORTUNITIES unless status is given.',
    effect: 'write',
    input: cliCreateLeadFields,
    run: async (args, { user }) => ({
      lead: await createLeadFromInput(user, args, 'MCP'),
    }),
  })

  defineTool(server, {
    name: 'update_lead',
    title: 'Update lead',
    description:
      'Edit a lead or move it to another stage. Omitted fields keep their value; null clears one. Does not convert a lead to a client. No tool archives or deletes a lead: move it to CLOSED_LOST or UNQUALIFIED, or archive it in the portal.',
    effect: 'idempotent-write',
    input: { leadId, ...cliUpdateLeadFields },
    run: async ({ leadId, ...changes }, { user }) => {
      if (!Object.values(changes).some(value => value !== undefined)) {
        throw new BadRequestError('Provide at least one field to update.')
      }

      return { lead: await updateLeadFromInput(user, leadId, changes, 'MCP') }
    },
  })

  defineTool(server, {
    name: 'add_lead_update',
    title: 'Log lead update',
    description:
      "Log a call, email, text, meeting or note on a lead's timeline, as the connected user.",
    effect: 'write',
    input: { leadId, ...cliCreateLeadUpdateFields },
    run: async ({ leadId, ...update }, { user }) => ({
      update: await addLeadUpdate(user, leadId, update, 'MCP'),
    }),
  })
}
