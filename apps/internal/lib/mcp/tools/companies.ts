import 'server-only'

import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import type { AppUser } from '@/lib/auth/session'
import { toRichTextHtml } from '@/lib/cli/description'
import { saveCompanySheet } from '@/lib/companies/save-company-sheet'
import type { CompanyDetail, CompanyListItem } from '@/lib/companies/types'
import { BadRequestError, NotFoundError } from '@/lib/errors/http'
import { getCompanyDetail, listCompanies } from '@/lib/queries/companies'
import { tagKey, tagNamesSchema, uniqueTagNames } from '@/lib/tags/names'
import { listTagOptions } from '@/lib/tags/server'

import { searchText, listLimit } from '../output'
import { defineTool } from '../tool'
import {
  companyId,
  personId,
  revalidateDirectory,
  richText,
  webAddress,
} from './directory-inputs'
import { registerPersonWriteTools } from './people-write'

/** A list row: billing fields are already null for people who can't see them. */
function serializeCompanyRow(company: CompanyListItem) {
  return {
    id: company.id,
    name: company.name,
    website: company.website,
    tags: company.tags,
    isClient: company.companyId !== null,
    formerClient: company.formerClient,
    billingType: company.billingType,
    hours: company.hours,
    primaryContactName: company.primaryContactName,
    people: company.people,
    leadCount: company.leadCount,
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
    tags: company.tags,
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

const tagNames = tagNamesSchema.describe(
  'Tag names. An existing tag in any case is reused with its spelling; a new name creates the tag. See list_company_tags.'
)

/** Applies addTags/removeTags (or a full replacement) to the current tags. */
function nextTags(
  current: string[],
  changes: { tags?: string[]; addTags?: string[]; removeTags?: string[] }
): string[] | undefined {
  if (!changes.tags && !changes.addTags && !changes.removeTags) return undefined
  const removed = new Set((changes.removeTags ?? []).map(tagKey))
  return uniqueTagNames([
    ...(changes.tags ?? current),
    ...(changes.addTags ?? []),
  ]).filter(name => !removed.has(tagKey(name)))
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
      'List companies (clients and prospects), A to Z, with their tags, people, lead counts (all and open) and projects. For admins, clients also show billing type and prepaid hours.',
    effect: 'read',
    input: {
      search: searchText.describe('Match on company name.').optional(),
      archived: z
        .boolean()
        .default(false)
        .describe('List archived companies instead.'),
      tags: z
        .array(z.string().max(40))
        .max(20)
        .describe('Only companies with any of these tags (any case).')
        .optional(),
      limit: listLimit,
    },
    run: async ({ search, archived, tags, limit }, { user }) => {
      const rows = await listCompanies(user, {
        status: archived ? 'archived' : 'active',
        search,
      })
      const wanted = new Set((tags ?? []).map(tagKey))
      const matched = wanted.size
        ? rows.filter(row => row.tags.some(tag => wanted.has(tagKey(tag))))
        : rows
      return {
        items: matched.slice(0, limit).map(serializeCompanyRow),
        hasMore: matched.length > limit,
      }
    },
  })

  defineTool(server, {
    name: 'get_company',
    title: 'Get company',
    description:
      'One company with its tags, notes (HTML), people (title, primary contact) and leads. For admins, also who has portal access and when billing ends.',
    effect: 'read',
    input: { companyId },
    run: async ({ companyId }, { user }) => readCompany(user, companyId),
  })

  defineTool(server, {
    name: 'list_company_tags',
    title: 'List company tags',
    description:
      'Every company tag, A to Z, with how many live companies carry it. Reuse these names when tagging so the same kind of company gets the same tag.',
    effect: 'read',
    input: {},
    run: async () => ({
      items: (await listTagOptions('company')).map(tag => ({
        name: tag.name,
        companies: tag.count,
      })),
    }),
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
      tags: tagNames.optional(),
      notes: richText.nullish(),
    },
    run: async ({ name, website, linkedinUrl, tags, notes }, { user }) => {
      const result = await saveCompanySheet(user, {
        name,
        website: website ?? null,
        linkedinUrl: linkedinUrl ?? null,
        tags,
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
      "Edit a company's details and people in one save. Omitted fields keep their value; null clears one. tags replaces all of the company's tags ([] clears them); addTags and removeTags change just those. addPeople adds existing people (they keep their other companies), removePeople ends their place here, titles sets each person's title here, primaryContactId picks the primary contact (a client's primary contact is admin-only). Billing and portal access stay in the portal.",
    effect: 'idempotent-write',
    input: {
      companyId,
      name: z.string().trim().min(1).max(160).optional(),
      website: webAddress.nullable().optional(),
      linkedinUrl: webAddress.nullable().optional(),
      tags: tagNames.optional(),
      addTags: tagNames.optional(),
      removeTags: tagNames.optional(),
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
        tags: nextTags(current.tags, changes),
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

  registerPersonWriteTools(server)
}
