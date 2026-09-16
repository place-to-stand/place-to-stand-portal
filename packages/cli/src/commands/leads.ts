import { readFileSync } from 'node:fs'

import type { Command } from 'commander'

import { apiGet, apiPatch, apiPost } from '../client.js'
import { resolveApiContext } from '../context.js'
import { emit, emitMessage } from '../output.js'

type Lead = {
  id: string
  path?: string | null
}

type ListOptions = {
  status?: string
  assignee?: string
  search?: string
  limit?: string
}

type CreateOptions = {
  name: string
  status?: string
  source?: string
  sourceDetail?: string
  assignee?: string
  email?: string
  phone?: string
  company?: string
  website?: string
  notes?: string
}

type EditOptions = CreateOptions & {
  name?: string
  clearNotes?: boolean
  clearAssignee?: boolean
}

type LogOptions = {
  type: string
  body: string
  at?: string
}

const STATUSES =
  'NEW_OPPORTUNITIES | ACTIVE_OPPORTUNITIES | PROPOSAL_SENT | ON_ICE | CLOSED_WON | CLOSED_LOST | UNQUALIFIED'

const MARKDOWN_HELP =
  'Plain text or minimal markdown: paragraphs on blank lines, - bullets, 1. numbered lists, **bold**, *italic*, `code`, [text](https://…) links; "-" reads stdin'

/** Same stdin convention as `tasks`: `-` reads the whole of stdin. */
function textOrStdin(value: string | undefined): string | undefined {
  return value === '-' ? readFileSync(0, 'utf8') : value
}

/** The portal URL goes to stderr so `pts leads … | jq` sees clean JSON. */
async function emitLeadUrl(lead: Lead): Promise<void> {
  if (!lead.path) {
    return
  }

  const apiUrl = await resolveApiContext()
  emitMessage(`View: ${apiUrl}${lead.path}`)
}

/** The detail flags shared by create and edit, minus the create-only name. */
function addDetailOptions(command: Command): Command {
  return command
    .option('--source <source>', 'REFERRAL | WEBSITE | EVENT')
    .option('--source-detail <text>', 'Who referred them, which event, …')
    .option('--assignee <user>', 'Owner, by email or user id')
    .option('--email <email>')
    .option('--phone <phone>')
    .option('--company <name>')
    .option('--website <url>')
    .option('--notes <text>', `Lead notes. ${MARKDOWN_HELP}`)
}

export function registerLeadCommands(program: Command): void {
  const leads = program
    .command('leads')
    .description('Read and write the leads board')

  leads
    .command('list')
    .description('List leads, most recently updated first')
    .option('--status <status>', STATUSES)
    .option('--assignee <user>', 'Only leads owned by this email or user id')
    .option('--search <text>', 'Match on name, company or email')
    .option('--limit <count>', 'Maximum rows (default 50, max 200)')
    .action(async (options: ListOptions) => {
      const { data } = await apiGet('api/cli/v1/leads', {
        status: options.status,
        assignee: options.assignee,
        search: options.search,
        limit: options.limit,
      })

      emit(data)
    })

  leads
    .command('show <leadId>')
    .description('Show one lead')
    .action(async (leadId: string) => {
      const { data } = await apiGet<Lead>(`api/cli/v1/leads/${leadId}`)

      emit(data)
      await emitLeadUrl(data)
    })

  addDetailOptions(
    leads
      .command('create')
      .description(
        'Create a lead. This does not create a contact — contacts are made when a CLOSED_WON lead is converted in the portal.'
      )
      .requiredOption('--name <name>', 'Contact name')
      .option('--status <status>', `Defaults to NEW_OPPORTUNITIES. ${STATUSES}`)
  ).action(async (options: CreateOptions) => {
    const { data } = await apiPost<Lead>('api/cli/v1/leads', {
      name: options.name,
      status: options.status,
      source: options.source,
      sourceDetail: options.sourceDetail,
      assignee: options.assignee,
      email: options.email,
      phone: options.phone,
      company: options.company,
      website: options.website,
      notes: textOrStdin(options.notes),
    })

    emit(data)
    await emitLeadUrl(data)
  })

  addDetailOptions(
    leads
      .command('edit <leadId>')
      .description(
        'Update a lead; omitted fields keep their current values. --status moves it on the board.'
      )
      .option('--name <name>', 'Contact name')
      .option('--status <status>', STATUSES)
      .option('--clear-notes', 'Remove the notes')
      .option('--clear-assignee', 'Unassign the lead')
  ).action(async (leadId: string, options: EditOptions) => {
    // Only keys actually present are sent: absent means "leave alone", an
    // explicit null means "clear" — what the --clear-* flags produce.
    const payload: Record<string, unknown> = {}

    if (options.name !== undefined) payload.name = options.name
    if (options.status !== undefined) payload.status = options.status
    if (options.source !== undefined) payload.source = options.source
    if (options.sourceDetail !== undefined)
      payload.sourceDetail = options.sourceDetail
    if (options.email !== undefined) payload.email = options.email
    if (options.phone !== undefined) payload.phone = options.phone
    if (options.company !== undefined) payload.company = options.company
    if (options.website !== undefined) payload.website = options.website

    if (options.clearAssignee) {
      payload.assignee = null
    } else if (options.assignee !== undefined) {
      payload.assignee = options.assignee
    }

    if (options.clearNotes) {
      payload.notes = null
    } else if (options.notes !== undefined) {
      payload.notes = textOrStdin(options.notes)
    }

    if (!Object.keys(payload).length) {
      throw new Error('Provide at least one field to update.')
    }

    const { data } = await apiPatch<Lead>(`api/cli/v1/leads/${leadId}`, payload)

    emit(data)
    await emitLeadUrl(data)
  })

  leads
    .command('log <leadId>')
    .description(
      'Log an interaction (meeting, call, email, note) on the lead’s timeline'
    )
    .requiredOption('--type <type>', 'MEETING | PHONE_CALL | EMAIL | NOTE')
    .requiredOption('--body <text>', `What happened. ${MARKDOWN_HELP}`)
    .option(
      '--at <datetime>',
      'When it happened, ISO 8601 with offset (defaults to now; cannot be in the future)'
    )
    .action(async (leadId: string, options: LogOptions) => {
      const { data } = await apiPost(`api/cli/v1/leads/${leadId}/updates`, {
        type: options.type,
        body: textOrStdin(options.body),
        occurredAt: options.at,
      })

      emit(data)
    })

  leads
    .command('updates <leadId>')
    .description('List the interactions logged on a lead, newest first')
    .option('--limit <count>', 'Maximum rows (default 50, max 200)')
    .action(async (leadId: string, options: { limit?: string }) => {
      const { data } = await apiGet(`api/cli/v1/leads/${leadId}/updates`, {
        limit: options.limit,
      })

      emit(data)
    })
}
