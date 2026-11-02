import { sql, type SQL } from 'drizzle-orm'

/**
 * Billing and commission terms, read "as of" a date in one place (D2 / D24).
 * Both go through SQL functions that take the company id (migration 0117),
 * like `client-state.ts`, so no query correlates a subquery with an outer
 * column. Pass `CURRENT_TERM` for the newest term, even one scheduled ahead:
 * that is what the company sheet last saved.
 */

export type BillingTypeValue = 'prepaid' | 'net_30'

/** The billing type of a client with no term yet: the one default. */
export const DEFAULT_BILLING_TYPE: BillingTypeValue = 'prepaid'

/** As-of value that picks the newest term, scheduled or not. */
export const CURRENT_TERM = 'infinity'

type AsOf = string | SQL

/**
 * The outer company, written table-qualified: drizzle drops the table name
 * from a column inside a selected fragment, and these fragments also sit
 * inside subqueries (where a bare "id" would bind to the subquery's table).
 */
const outerCompanyId = sql.raw('"companies"."id"')

const asOfDate = (asOf: AsOf): SQL => sql`${asOf}::date`

/**
 * The billing type in force on `asOf` for `companyId` (default: the outer
 * `companies` row). NULL when no term has started, which the monthly close
 * relies on to leave a client out of months before its first term.
 */
export function billingTypeAsOfSql(
  asOf: AsOf,
  companyId: SQL = outerCompanyId
) {
  return sql<BillingTypeValue | null>`billing_type_as_of(${companyId}, ${asOfDate(asOf)})`
}

/** As `billingTypeAsOfSql`, with `DEFAULT_BILLING_TYPE` when none has started. */
export function billingTypeOrDefaultSql(
  asOf: AsOf,
  companyId: SQL = outerCompanyId
) {
  return sql<BillingTypeValue>`coalesce(${billingTypeAsOfSql(asOf, companyId)}, ${DEFAULT_BILLING_TYPE}::client_billing_type)`
}

/** The billing type the company sheet last saved (newest term), or the default. */
export function currentBillingTypeSql() {
  return billingTypeOrDefaultSql(CURRENT_TERM)
}

type CommissionColumn = 'id' | 'origination_user_id' | 'origination_contact_id'

/**
 * One column of the commission term in force on `asOf` for the outer
 * company. NULL when no term has started or it leaves the column empty.
 */
export function commissionTermColumnAsOfSql(
  column: CommissionColumn,
  asOf: AsOf
) {
  return sql<
    string | null
  >`(commission_term_as_of(${outerCompanyId}, ${asOfDate(asOf)})).${sql.identifier(column)}`
}
