import 'server-only'

import type { McpServer } from '@modelcontextprotocol/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import type { AppUser } from '@/lib/auth/session'
import { toRichTextHtml } from '@/lib/cli/description'
import { saveCompanySheet } from '@/lib/companies/save-company-sheet'
import type { CompanyDetail, CompanyListItem } from '@/lib/companies/types'
import { BadRequestError, NotFoundError } from '@/lib/errors/http'
import { loadExistingContact } from '@/lib/people/actions/save-contact'
import { savePersonSheet } from '@/lib/people/person-sheet/save-person-sheet'
import { getCompanyDetail, listCompanies } from '@/lib/queries/companies'

import { searchText, listLimit } from '../output'
import { defineTool } from '../tool'
import { readPerson } from './people-read'

const companyId = z.string().uuid().describe('Company UUID.')
const personId = z.string().uuid().describe('Person (contact) UUID.')

const richText = z
  .string()
  .max(20_000)
  .describe(
    'Plain text or minimal markdown: paragraphs, - bullets, 1. lists, **bold**, *italic*, `code`, [links](https://…).'
  )

/** Web address; a bare domain ("acme.com") is fine. */
const webAddress = z.string().trim().max(255)

/** The routes that list companies and people, as the sheets refresh them. */
const DIRECTORY_ROUTES = ['/companies', '/people', '/leads']

function revalidateDirectory() {
  for (const path of DIRECTORY_ROUTES) revalidatePath(path)
}

/** A list row: billing fields are already null for people who can't see them. */
function serializeCompanyRow(company: CompanyListItem) {
  return {
    id: company.id,
    name: company.name,
    website: company.website,
    isClient: company.companyId !== null,
    formerClient: company.formerClient,
    billingType: company.billingType,
    hours: company.hours,
    primaryContactName: company.primaryContactName,
    people: company.people,
    openLeadCount: company.openLeadCount,
    projects: company.projects,
  }
}

function serializeCompany(company: CompanyDetail) {
  return {
    id: company.id,
    name: company.name,
    website: company.website,
    linkedinUrl: company.linkedinUrl,
    notes: company.notes,
    isClient: company.clients.length > 0,
    formerClient: company.formerClientId !== null,
    billingEndsOn: company.billingEndsOn,
    isStaff: company.isStaff,
    primaryContactId: company.primaryContactId,
    people: company.contacts.map(person => ({
      id: person.id,
      name: person.name,
      email: person.email,
      jobTitle: person.jobTitle,
      isPrimary: person.isPrimary,
      portalAccess: person.portalAccess,
      hasSignIn: person.hasPortalLogin,
    })),
    leads: company.leads,
    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
    archivedAt: company.deletedAt,
  }
}

async function readCompany(user: AppUser, id: string) {
  return { company: serializeCompany(await getCompanyDetail(user, id)) }
}

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

/** Live companies only: an archived one is restored in the portal. */
async function loadLiveCompany(user: AppUser, id: string) {
  const company = await getCompanyDetail(user, id)
  if (company.deletedAt) {
    throw new NotFoundError(
      'Company is archived. Restore it in the portal first.'
    )
  }
  return company
}

/**
 * Companies and people (the portal's directory). Every write goes through
 * the same save as its sheet, in one transaction with the sheet's checks.
 * Billing, terms, commission and portal access stay in the portal (D9).
 */
export function registerCompanyTools(server: McpServer) {
  defineTool(server, {
    name: 'list_companies',
    title: 'List companies',
    description:
      'List companies (clients and prospects), A to Z, with their people, open lead count and projects. For admins, clients also show billing type and prepaid hours.',
    effect: 'read',
    input: {
      search: searchText.describe('Match on company name.').optional(),
      archived: z
        .boolean()
        .default(false)
        .describe('List archived companies instead.'),
      limit: listLimit,
    },
    run: async ({ search, archived, limit }, { user }) => {
      const rows = await listCompanies(user, {
        status: archived ? 'archived' : 'active',
        search,
      })
      return {
        items: rows.slice(0, limit).map(serializeCompanyRow),
        hasMore: rows.length > limit,
      }
    },
  })

  defineTool(server, {
    name: 'get_company',
    title: 'Get company',
    description:
      'One company with its notes (HTML), people (title, primary contact) and leads. For admins, also who has portal access and when billing ends.',
    effect: 'read',
    input: { companyId },
    run: async ({ companyId }, { user }) => readCompany(user, companyId),
  })

  defineTool(server, {
    name: 'create_company',
    title: 'Create company',
    description:
      'Add a company (a prospect; making it a client happens in the portal). Add people afterwards with update_company or create_person.',
    effect: 'write',
    input: {
      name: z.string().trim().min(1).max(160),
      website: webAddress.nullish(),
      linkedinUrl: webAddress.nullish(),
      notes: richText.nullish(),
    },
    run: async ({ name, website, linkedinUrl, notes }, { user }) => {
      const result = await saveCompanySheet(user, {
        name,
        website: website ?? null,
        linkedinUrl: linkedinUrl ?? null,
        notes: notes ? toRichTextHtml(notes) : null,
      })
      if (!result.ok || !result.id) {
        throw new BadRequestError(result.error ?? 'Unable to create company.')
      }
      revalidateDirectory()
      return readCompany(user, result.id)
    },
  })

  defineTool(server, {
    name: 'update_company',
    title: 'Update company',
    description:
      "Edit a company's details and people in one save. Omitted fields keep their value; null clears one. addPeople adds existing people (they keep their other companies), removePeople ends their place here, titles sets each person's title here, primaryContactId picks the primary contact (a client's primary contact is admin-only). Billing and portal access stay in the portal.",
    effect: 'idempotent-write',
    input: {
      companyId,
      name: z.string().trim().min(1).max(160).optional(),
      website: webAddress.nullable().optional(),
      linkedinUrl: webAddress.nullable().optional(),
      notes: richText
        .describe('Replaces the notes. Plain text or minimal markdown.')
        .nullable()
        .optional(),
      addPeople: z.array(personId).max(100).optional(),
      removePeople: z.array(personId).max(100).optional(),
      titles: z
        .array(
          z.object({
            personId,
            title: z
              .string()
              .max(160)
              .describe('Their title here; blank clears it.'),
          })
        )
        .max(100)
        .optional(),
      primaryContactId: personId.nullable().optional(),
    },
    run: async ({ companyId, ...changes }, { user }) => {
      if (!Object.values(changes).some(value => value !== undefined)) {
        throw new BadRequestError('Provide at least one field to update.')
      }
      const current = await loadLiveCompany(user, companyId)
      const keep = <T>(next: T | undefined, value: T): T =>
        next === undefined ? value : next

      const result = await saveCompanySheet(user, {
        id: companyId,
        name: changes.name ?? current.name,
        website: keep(changes.website, current.website),
        linkedinUrl: keep(changes.linkedinUrl, current.linkedinUrl),
        notes:
          changes.notes === undefined
            ? current.notes
            : changes.notes === null
              ? null
              : toRichTextHtml(changes.notes),
        addContactIds: changes.addPeople,
        removeContactIds: changes.removePeople,
        contactTitles: changes.titles?.map(entry => ({
          contactId: entry.personId,
          title: entry.title,
        })),
        primaryContactId: changes.primaryContactId,
        // Refuses the save if someone changed the company since the read.
        expectedUpdatedAt: current.updatedAt,
      })
      if (!result.ok) {
        throw new BadRequestError(result.error ?? 'Unable to save company.')
      }
      revalidateDirectory()
      return readCompany(user, companyId)
    },
  })

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
