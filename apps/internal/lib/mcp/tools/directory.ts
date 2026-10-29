import 'server-only'

import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import type { AppUser } from '@/lib/auth/session'
import { listUsersForCli } from '@/lib/cli/queries/users'
import { serializeClient } from '@/lib/cli/serializers/client'
import {
  serializeContact,
  serializeContactCompanies,
} from '@/lib/cli/serializers/contact'
import { listContactMemberships } from '@/lib/queries/memberships'
import { serializeProject } from '@/lib/cli/serializers/project'
import { serializeUser, serializeUserRow } from '@/lib/cli/serializers/user'
import {
  fetchClientsWithMetrics,
  resolveClientIdentifier,
} from '@/lib/data/clients'
import {
  fetchProjectsLite,
  fetchProjectsWithRelationsByIds,
  resolveProjectIdentifier,
} from '@/lib/data/projects'
import { NotFoundError } from '@/lib/errors/http'
import { listContactsForSettings } from '@/lib/queries/contacts/settings/list-contacts'
import {
  getContactSheetInputById,
  listAllActiveClients,
  listContactClients,
} from '@/lib/queries/contacts/settings/contact-clients'

import { listLimit, page, searchText } from '../output'
import { defineTool } from '../tool'

const clientRef = z.string().trim().min(1).describe('Client slug or UUID.')

async function resolveContactFilterClient(
  user: AppUser,
  reference: string
): Promise<string> {
  const clients = await listAllActiveClients(user)
  const match = clients.find(
    client => client.id === reference || client.slug === reference
  )

  if (!match) {
    throw new NotFoundError('Client not found.')
  }

  return match.id
}

/** People, clients, contacts and projects: everything read-only (D4). */
export function registerDirectoryTools(server: McpServer) {
  defineTool(server, {
    name: 'whoami',
    title: 'Who am I',
    description:
      'Return the Place To Stand portal user this connection acts as (including their role), and the app it is connected through.',
    effect: 'read',
    input: {},
    run: async (_args, { user, agent }) => ({
      user: serializeUser(user),
      agent,
    }),
  })

  defineTool(server, {
    name: 'list_users',
    title: 'List users',
    description:
      'List portal users (team members and client portal users) — for sales users, only the admin and sales staff. Use it to find the email or id to assign a task or lead to; only admin and sales users can be assigned.',
    effect: 'read',
    input: {
      search: searchText.optional(),
      role: z.enum(['ADMIN', 'SALES', 'CLIENT']).optional(),
      limit: listLimit,
    },
    run: async ({ search, role, limit }, { user }) => {
      const rows = await listUsersForCli(user, {
        search,
        role,
        limit: limit + 1,
      })

      return page(rows.map(serializeUserRow), limit)
    },
  })

  defineTool(server, {
    name: 'list_clients',
    title: 'List clients',
    description:
      'List clients with their billing type, project counts and prepaid hours balance (purchased, used, remaining). hoursRemaining can be negative when a client is over; net_30 clients have no meaningful balance.',
    effect: 'read',
    input: {
      search: searchText.optional(),
      limit: listLimit,
    },
    run: async ({ search, limit }, { user }) => {
      const clients = await fetchClientsWithMetrics(user, search)

      return page(clients.map(serializeClient), limit)
    },
  })

  defineTool(server, {
    name: 'get_client',
    title: 'Get client',
    description:
      'One client with its hours balance, its Portal access people (who can see it in the client portal) and projects.',
    effect: 'read',
    input: { client: clientRef },
    run: async ({ client: reference }, { user }) => {
      const resolved = await resolveClientIdentifier(user, reference)
      // The metrics query is the only source of the hours balance, and it is
      // per-request cached, so filtering the full list costs nothing extra.
      const clients = await fetchClientsWithMetrics(user)
      const client = clients.find(row => row.id === resolved.resolvedId)

      if (!client) {
        throw new NotFoundError('Client not found.')
      }

      return {
        client: serializeClient(client),
        contacts: client.contacts,
        projects: client.allProjects,
      }
    },
  })

  defineTool(server, {
    name: 'list_contacts',
    title: 'List contacts',
    description:
      'List contacts (people at clients and prospects), optionally only those linked to one client.',
    effect: 'read',
    input: {
      search: searchText.optional(),
      client: clientRef.optional(),
      limit: listLimit,
    },
    run: async ({ search, client, limit }, { user }) => {
      // The same client list the portal's contacts filter offers (ADMIN and
      // SALES): active clients by id or slug. `resolveClientIdentifier` would
      // load the full client record, which is admin-only.
      const clientId = client
        ? await resolveContactFilterClient(user, client)
        : null

      const result = await listContactsForSettings(user, {
        search: search ?? null,
        clientId,
        limit,
      })

      const memberships = await listContactMemberships(
        result.items.map(contact => contact.id)
      )
      return {
        items: result.items.map(contact => ({
          ...serializeContact(contact, memberships.get(contact.id)),
          clients: contact.metrics.clients,
        })),
        hasMore: result.totalCount > result.items.length,
        totalCount: result.totalCount,
      }
    },
  })

  defineTool(server, {
    name: 'get_contact',
    title: 'Get contact',
    description:
      'One contact, the companies they belong to (title, primary, portal access) and the clients they can see in the portal.',
    effect: 'read',
    input: { contactId: z.string().uuid().describe('Contact UUID.') },
    run: async ({ contactId }, { user }) => {
      const [contact, clients, memberships] = await Promise.all([
        getContactSheetInputById(user, contactId),
        listContactClients(user, contactId),
        listContactMemberships([contactId]),
      ])

      return {
        contact,
        companies: serializeContactCompanies(memberships.get(contactId) ?? []),
        clients,
      }
    },
  })

  defineTool(server, {
    name: 'list_projects',
    title: 'List projects',
    description:
      'List projects (CLIENT, INTERNAL and PERSONAL), optionally for one client. Use a project slug to scope task tools.',
    effect: 'read',
    input: {
      search: searchText.optional(),
      client: clientRef.optional(),
      limit: listLimit,
    },
    run: async ({ search, client, limit }, { user }) => {
      const clientId = client
        ? (await resolveClientIdentifier(user, client)).resolvedId
        : null
      const needle = search?.toLowerCase()

      const projects = (await fetchProjectsLite()).filter(
        project =>
          (!clientId || project.client_id === clientId) &&
          (!needle ||
            project.name.toLowerCase().includes(needle) ||
            project.slug?.toLowerCase().includes(needle))
      )

      return page(projects.map(serializeProject), limit)
    },
  })

  defineTool(server, {
    name: 'get_project',
    title: 'Get project',
    description: 'One project by slug or UUID.',
    effect: 'read',
    input: {
      project: z.string().trim().min(1).describe('Project slug or UUID.'),
    },
    run: async ({ project: reference }, { user }) => {
      const resolved = await resolveProjectIdentifier(user, reference)
      const [project] = await fetchProjectsWithRelationsByIds([
        resolved.resolvedId,
      ])

      if (!project) {
        throw new NotFoundError('Project not found.')
      }

      return { project: serializeProject(project) }
    },
  })
}
