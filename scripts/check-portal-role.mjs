#!/usr/bin/env node
/**
 * 0116 check: the client_portal_access view admits only a live CLIENT
 * sign-in. Inside one transaction that is always rolled back, it takes a
 * user the view admits, switches them to SALES, ADMIN, and a switched-off
 * CLIENT, and expects the view to drop them each time (and to keep them as
 * CLIENT). Nothing is written. Local databases only.
 *
 *   node scripts/check-portal-role.mjs --db postgresql://postgres:postgres@127.0.0.1:54322/prod_rehearsal
 */
import postgres from 'postgres'

const index = process.argv.indexOf('--db')
const url = index > -1 ? process.argv[index + 1] : null
if (!url) throw new Error('--db <url> is required')
const host = new URL(url).hostname
if (host !== '127.0.0.1' && host !== 'localhost') {
  throw new Error(`--db must be a local database (got ${host})`)
}

const sql = postgres(url, { max: 1, onnotice: () => {} })
let failures = 0
const check = (label, ok) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures += 1
}

try {
  await sql.begin(async tx => {
    const [subject] = await tx`select user_id from client_portal_access limit 1`
    if (!subject) {
      console.log('SKIP  no portal user in this database')
      throw new Error('rollback')
    }
    const userId = subject.user_id
    const admitted = async () =>
      (await tx`select count(*)::int as n from client_portal_access where user_id = ${userId}`)[0].n > 0

    check('a live Client sign-in is admitted', await admitted())
    for (const role of ['SALES', 'ADMIN']) {
      await tx`update users set role = ${role} where id = ${userId}`
      check(`a ${role} sign-in with portal_access on is not admitted`, !(await admitted()))
    }
    await tx`update users set role = 'CLIENT', disabled_at = now() where id = ${userId}`
    check('a switched-off Client sign-in is not admitted', !(await admitted()))
    await tx`update users set disabled_at = null where id = ${userId}`
    check('back to a live Client sign-in: admitted again', await admitted())
    throw new Error('rollback')
  })
} catch (error) {
  if (error.message !== 'rollback') throw error
} finally {
  await sql.end()
}

console.log(failures ? `${failures} check(s) failed` : 'portal role checks pass')
process.exit(failures ? 1 : 0)
