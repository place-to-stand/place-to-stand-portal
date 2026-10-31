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
 * or alias (`users` unless the query aliases it). A sign-in has at most one
 * contact (`contacts_user_id_key`), archived or not, so an archived person
 * keeps their name in history (time logs, the close, comments).
 */
export function personNameOf(table = 'users') {
  return sql<string | null>`(select c.name from contacts c where c.user_id = ${sql.raw(
    `"${table}"."id"`
  )})`
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
  )})`
}

/** A user's photo, correlated on the outer `users`. */
export const personAvatarSql = personAvatarOf('users')
