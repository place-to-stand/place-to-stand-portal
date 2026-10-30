import { sql } from 'drizzle-orm'

/**
 * One name per record (migration 0109):
 *  - a client is a company you bill, so it is called by the company's name;
 *  - a user (a person's sign-in) is called by their contact's name.
 * Correlated subqueries written table-qualified, because drizzle drops the
 * table name from an interpolated column inside a selected fragment.
 */

/** A client's name: its company's (a client is a company you bill). */
export const clientNameSql = sql<string>`"companies"."name"`

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

/**
 * A user's photo: their contact's (migration 0112; a photo belongs to the
 * person, signed in or not). `table` as for `personNameOf`.
 */
export function personAvatarOf(table = 'users') {
  return sql<string | null>`(select c.avatar_url from contacts c where c.user_id = ${sql.raw(
    `"${table}"."id"`
  )} and c.deleted_at is null order by c.created_at limit 1)`
}

/** A user's photo, correlated on the outer `users`. */
export const personAvatarSql = personAvatarOf('users')
