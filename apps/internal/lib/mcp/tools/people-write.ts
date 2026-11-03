import 'server-only'

import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import { toRichTextHtml } from '@/lib/cli/description'
import { BadRequestError, NotFoundError } from '@/lib/errors/http'
import { loadExistingContact } from '@/lib/people/actions/save-contact'
import { savePersonSheet } from '@/lib/people/person-sheet/save-person-sheet'

import { defineTool } from '../tool'
import {
  companyId,
  personId,
  revalidateDirectory,
  richText,
  webAddress,
} from './directory-inputs'
import { readPerson } from './people-read'

/**
 * A title belongs to one company: the save ignores `jobTitle` without one,
 * so refuse it rather than report a change that didn't happen.
 */
function assertTitleHasCompany(args: {
  jobTitle?: string | null
  companyId?: string | null
  companyName?: string | null
}) {
  if (args.jobTitle !== undefined && !args.companyId && !args.companyName) {
    throw new BadRequestError(
      "jobTitle needs companyId or companyName. To change someone's title at a company they're already at, use update_company's titles."
    )
  }
}

/** create_person and update_person (registered after the company tools). */
export function registerPersonWriteTools(server: McpServer) {
  defineTool(server, {
    name: 'create_person',
    title: 'Create person',
    description:
      'Add a person (contact). Give companyId to put them at a company (or companyName to match one by name, created when new), with jobTitle as their title there.',
    effect: 'write',
    input: {
      name: z.string().trim().min(1).max(160),
      email: z.string().trim().max(160).nullish(),
      phone: z.string().trim().max(40).nullish(),
      linkedinUrl: webAddress.nullish(),
      companyId: companyId.nullish(),
      companyName: z.string().trim().max(160).nullish(),
      jobTitle: z.string().trim().max(160).nullish(),
      notes: richText.nullish(),
    },
    run: async (args, { user }) => {
      assertTitleHasCompany(args)
      const result = await savePersonSheet(user, {
        name: args.name,
        email: args.email ?? null,
        phone: args.phone ?? null,
        linkedinUrl: args.linkedinUrl ?? null,
        companyId: args.companyId ?? undefined,
        companyName: args.companyId
          ? undefined
          : (args.companyName ?? undefined),
        jobTitle: args.jobTitle ?? undefined,
        notes: args.notes ? toRichTextHtml(args.notes) : null,
      })
      if (result.error || !result.id) {
        throw new BadRequestError(result.error ?? 'Unable to create person.')
      }
      revalidateDirectory()
      return readPerson(user, result.id)
    },
  })

  defineTool(server, {
    name: 'update_person',
    title: 'Update person',
    description:
      "Edit a person's details. Omitted fields keep their value; null clears one. companyId (or companyName) adds them to a company, keeping their others, with jobTitle as their title there. To take someone off a company, use update_company's removePeople. People who can sign in are edited by admins only.",
    effect: 'idempotent-write',
    input: {
      personId,
      name: z.string().trim().min(1).max(160).optional(),
      email: z.string().trim().max(160).nullable().optional(),
      phone: z.string().trim().max(40).nullable().optional(),
      linkedinUrl: webAddress.nullable().optional(),
      companyId: companyId.optional(),
      companyName: z.string().trim().max(160).optional(),
      jobTitle: z.string().trim().max(160).nullable().optional(),
      notes: richText
        .describe('Replaces the notes. Plain text or minimal markdown.')
        .nullable()
        .optional(),
    },
    run: async ({ personId, ...changes }, { user }) => {
      if (!Object.values(changes).some(value => value !== undefined)) {
        throw new BadRequestError('Provide at least one field to update.')
      }
      assertTitleHasCompany(changes)
      const current = await loadExistingContact(personId)
      if (!current || current.deletedAt) {
        throw new NotFoundError('Person not found.')
      }
      const keep = <T>(next: T | undefined, value: T): T =>
        next === undefined ? value : next

      const result = await savePersonSheet(user, {
        id: personId,
        name: changes.name ?? current.name,
        email: keep(changes.email, current.email),
        phone: keep(changes.phone, current.phone),
        // Omitted keeps it as stored (not re-checked).
        linkedinUrl: changes.linkedinUrl,
        companyId: changes.companyId,
        companyName: changes.companyId ? undefined : changes.companyName,
        jobTitle: changes.jobTitle,
        notes:
          changes.notes === undefined || changes.notes === null
            ? changes.notes
            : toRichTextHtml(changes.notes),
        // Refuses the save if someone changed them since the read.
        loadedUpdatedAt: current.updatedAt,
      })
      if (result.error) {
        throw new BadRequestError(result.error)
      }
      revalidateDirectory()
      return readPerson(user, personId)
    },
  })
}
