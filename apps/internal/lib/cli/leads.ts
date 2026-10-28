import 'server-only'

import type { z } from 'zod'

import { revalidateLeadsPath } from '@/app/(dashboard)/leads/_actions/utils'
import type { AppUser } from '@/lib/auth/session'
import { BadRequestError, NotFoundError } from '@/lib/errors/http'
import { createLeadUpdateForActor } from '@/lib/leads/lead-update-core'
import { extractLeadNotes } from '@/lib/leads/notes'
import {
  saveLeadForActor,
  type SaveLeadResult,
} from '@/lib/leads/save-lead-core'
import { listLeadUpdates } from '@/lib/queries/lead-updates'
import type { ActivitySourceValue } from '@/lib/types'

import { toRichTextHtml } from './description'
import { getLeadForCli } from './queries/leads'
import { resolveAssigneeIds } from './queries/users'
import type {
  cliCreateLeadSchema,
  cliCreateLeadUpdateSchema,
  cliUpdateLeadSchema,
} from './schemas/leads'
import { serializeLead, type CliLead } from './serializers/lead'
import {
  serializeLeadUpdate,
  type CliLeadUpdate,
} from './serializers/lead-update'

export type CreateLeadInput = z.output<typeof cliCreateLeadSchema>
export type UpdateLeadInput = z.output<typeof cliUpdateLeadSchema>
export type CreateLeadUpdateInput = z.output<typeof cliCreateLeadUpdateSchema>

/** A staff user's UUID or email, or null to unassign. Never a CLIENT user. */
export async function resolveLeadAssignee(
  user: AppUser,
  reference: string | null | undefined
): Promise<string | null> {
  if (!reference) {
    return null
  }

  const [id] = await resolveAssigneeIds(user, [reference])

  return id ?? null
}

/**
 * Create a lead from the CLI / MCP payload. Shared by both channels so they
 * cannot drift; only `source` tells their activity rows apart.
 */
export async function createLeadFromInput(
  user: AppUser,
  payload: CreateLeadInput,
  source: ActivitySourceValue
): Promise<CliLead> {
  const assigneeId = await resolveLeadAssignee(user, payload.assignee)

  const result = await saveLeadForActor(
    user,
    {
      contactName: payload.name,
      status: payload.status,
      sourceType: payload.source ?? null,
      sourceDetail: payload.sourceDetail ?? null,
      assigneeId,
      contactEmail: payload.email ?? null,
      contactPhone: payload.phone ?? null,
      companyName: payload.company ?? null,
      companyWebsite: payload.website ?? null,
      notes: payload.notes ? toRichTextHtml(payload.notes) : null,
    },
    source
  )

  return finishLeadWrite(user, result)
}

/**
 * Partial update. The underlying save is a full replace, so every omitted
 * field is read back from the current row and sent unchanged. An explicit
 * `null` clears a field; `undefined` (omitted) preserves it.
 *
 * A status change here goes through the same path as the sheet's status
 * picker: stage history, rank reset, and the resolved/converted bookkeeping.
 */
export async function updateLeadFromInput(
  user: AppUser,
  leadId: string,
  payload: UpdateLeadInput,
  source: ActivitySourceValue
): Promise<CliLead> {
  const lead = await getLeadForCli(user, leadId)

  const keep = <T>(next: T | undefined, current: T): T =>
    next === undefined ? current : next

  const result = await saveLeadForActor(
    user,
    {
      id: lead.id,
      contactName: payload.name ?? lead.contactName,
      status: payload.status ?? lead.status,
      sourceType: keep(payload.source, lead.sourceType),
      sourceDetail: keep(payload.sourceDetail, lead.sourceDetail),
      assigneeId:
        payload.assignee === undefined
          ? lead.assigneeId
          : await resolveLeadAssignee(user, payload.assignee),
      contactEmail: keep(payload.email, lead.contactEmail),
      contactPhone: keep(payload.phone, lead.contactPhone),
      companyName: keep(payload.company, lead.companyName),
      companyWebsite: keep(payload.website, lead.companyWebsite),
      notes:
        payload.notes === undefined
          ? extractLeadNotes(lead.notes)
          : payload.notes === null
            ? null
            : toRichTextHtml(payload.notes),
    },
    source
  )

  return finishLeadWrite(user, result)
}

/**
 * Unlike tasks there is no partial-success case — the lead write is one row
 * plus its history — so a failed result never left anything behind and is
 * safe to surface as an error.
 */
async function finishLeadWrite(
  user: AppUser,
  result: SaveLeadResult
): Promise<CliLead> {
  if (!result.success || !result.leadId) {
    if (result.notFound) {
      throw new NotFoundError(result.error ?? 'Lead not found.')
    }

    throw new BadRequestError(result.error ?? 'Unable to save lead.')
  }

  revalidateLeadsPath()

  return serializeLead(await getLeadForCli(user, result.leadId))
}

/** Log a call, email, text or meeting on a lead's timeline. */
export async function addLeadUpdate(
  user: AppUser,
  leadId: string,
  payload: CreateLeadUpdateInput,
  source: ActivitySourceValue
): Promise<CliLeadUpdate | { id: string; leadId: string }> {
  const lead = await getLeadForCli(user, leadId)

  const result = await createLeadUpdateForActor(
    user,
    {
      leadId: lead.id,
      type: payload.type,
      // Timeline entries render through the same sanitizer as comments, so
      // plain text needs the same conversion to keep its paragraphs.
      body: toRichTextHtml(payload.body),
      occurredAt: payload.occurredAt ?? undefined,
    },
    source
  )

  if (!result.success || !result.updateId) {
    if (result.notFound) {
      throw new NotFoundError(result.error ?? 'Lead not found.')
    }

    throw new BadRequestError(result.error ?? 'Unable to log update.')
  }

  revalidateLeadsPath()

  const rows = await listLeadUpdates(user, lead.id)
  const created = rows.find(row => row.id === result.updateId)

  return created
    ? serializeLeadUpdate(created)
    : { id: result.updateId, leadId: lead.id }
}
