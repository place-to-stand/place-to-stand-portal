import { sql } from 'drizzle-orm'

/**
 * One name per record (migration 0109):
 *  - a client (a company's billing record) is called by its company's name;
 *  - a user (a person's sign-in) is called by their contact's name.
 * Correlated subqueries written table-qualified, because drizzle drops the
 * table name from an interpolated column inside a selected fragment.
 */

/** A client's name: its company's. Correlated on the outer `clients`. */
export const clientNameSql = sql<string>`(select co.name from companies co where co.id = "clients"."company_id")`

/**
 * A user's name: their contact's. `table` is the outer users table's name
 * or alias (`users` unless the query aliases it).
 */
export function personNameOf(table = 'users') {
  return sql<string | null>`(select c.name from contacts c where c.user_id = ${sql.raw(
    `"${table}"."id"`
  )} and c.deleted_at is null order by c.created_at limit 1)`
}

/** A user's name, correlated on the outer `users`. */
export const personNameSql = personNameOf('users')
