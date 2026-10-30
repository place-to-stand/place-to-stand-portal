import { eq, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'

import { companies, contacts, leads } from '@/lib/db/schema'

/**
 * A lead is a person (its contact) and optionally a company. Their name,
 * email, phone and the company's name and website are read from those
 * records, never copied onto the lead. Two ways to read them:
 *
 * - Joins: `leadContact` / `leadCompany` aliases (so a query that already
 *   joins `contacts` or `companies` for something else doesn't collide) plus
 *   `leadDisplayFields` for the select.
 * - Correlated subqueries (`leadContactNameSql`, ...) where a join is
 *   awkward, e.g. an UPDATE ... RETURNING.
 */
export const leadContact = alias(contacts, 'lead_contact')
export const leadCompany = alias(companies, 'lead_company')

/** Join conditions for the aliases above. */
export const leadContactJoin = eq(leadContact.id, leads.contactId)
export const leadCompanyJoin = eq(leadCompany.id, leads.companyId)

/** The lead's display fields, read through its contact and company. */
export const leadDisplayFields = {
  contactName: leadContact.name,
  contactEmail: leadContact.email,
  contactPhone: leadContact.phone,
  companyName: leadCompany.name,
  companyWebsite: leadCompany.website,
}

// Correlated subqueries on `leads`, the outer column written out
// table-qualified (drizzle drops the table name from an interpolated
// column inside a selected fragment).

/** The lead contact's name, as a correlated subquery on `leads`. */
export const leadContactNameSql = sql<string>`(
  select lc.name from contacts lc where lc.id = "leads"."contact_id"
)`
