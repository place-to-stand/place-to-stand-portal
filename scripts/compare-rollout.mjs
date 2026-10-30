#!/usr/bin/env node
/**
 * Rollout check for PR #279 (migrations 0089–0112): compares a copy of
 * production before the batch with the same copy after it and prints
 * pass/fail per check, with counts only (no names, emails or ids), so the
 * output can be pasted anywhere.
 *
 *   node scripts/compare-rollout.mjs \
 *     --before postgresql://postgres:postgres@127.0.0.1:54322/prod_rehearsal_before \
 *     --after  postgresql://postgres:postgres@127.0.0.1:54322/prod_rehearsal
 *
 * Local databases only: it refuses any host but 127.0.0.1 / localhost, so
 * it can't be pointed at production. Exits 1 if any check fails.
 */
import postgres from 'postgres'

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce((pairs, arg, index, all) => {
      if (arg.startsWith('--')) pairs.push([arg.slice(2), all[index + 1]])
      return pairs
    }, [])
)
for (const key of ['before', 'after']) {
  const url = args[key]
  if (!url) throw new Error(`--${key} <url> is required`)
  const host = new URL(url).hostname
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error(`--${key} must be a local database (got ${host})`)
  }
}

const before = postgres(args.before, { max: 1, onnotice: () => {} })
const after = postgres(args.after, { max: 1, onnotice: () => {} })
const results = []
const check = (name, ok, detail) => results.push({ name, ok, detail })
const rows = (db, query) => db.unsafe(query)
const set = list => new Set(list)
const missing = (from, to) => [...from].filter(value => !to.has(value))

// Old client id → the company it became (written by 0111).
const clientToCompany = new Map(
  (
    await rows(
      after,
      'select client_id::text, company_id::text from archive_sales_tools.client_id_map'
    )
  ).map(row => [row.client_id, row.company_id])
)
const company = clientId => (clientId ? clientToCompany.get(clientId) : null)

// 1. Every record kept.
for (const table of [
  'contacts',
  'users',
  'projects',
  'tasks',
  'time_logs',
  'time_log_tasks',
  'hour_blocks',
  'invoices',
  'invoice_line_items',
  'leads',
  'task_comments',
  'task_assignees',
  'lead_stage_history',
  'activity_logs',
  'monthly_close_snapshots',
]) {
  const old = set((await rows(before, `select id::text from ${table}`)).map(r => r.id))
  const now = set((await rows(after, `select id::text from ${table}`)).map(r => r.id))
  const lost = missing(old, now)
  const added = missing(now, old)
  const allowedAdds = table === 'contacts' ? 'people for sign-ins without one (0109)' : null
  check(
    `${table}: every row kept`,
    lost.length === 0 && (added.length === 0 || allowedAdds),
    `${old.size} before, ${now.size} after, ${lost.length} lost` +
      (added.length ? `, ${added.length} added${allowedAdds ? ` (${allowedAdds})` : ''}` : '')
  )
}

// Contacts added by the batch: a sign-in's person (0109) or a lead's (0106).
{
  const old = set((await rows(before, 'select id::text from contacts')).map(r => r.id))
  const added = (
    await rows(
      after,
      `select c.id::text, c.user_id, exists (select 1 from leads l where l.contact_id = c.id) is_lead
       from contacts c`
    )
  ).filter(r => !old.has(r.id))
  const stray = added.filter(r => !r.user_id && !r.is_lead)
  check(
    'new people are sign-ins’ or leads’ people',
    stray.length === 0,
    `${added.length} added: ${added.filter(r => r.user_id).length} for sign-ins, ${added.filter(r => !r.user_id && r.is_lead).length} for leads, ${stray.length} other`
  )
}

// 2. Clients carried onto their company.
{
  const clients = await rows(
    before,
    'select id::text, slug, state, notes, deleted_at, billing_type from clients'
  )
  const unmapped = clients.filter(c => !company(c.id))
  check('every client maps to a company', unmapped.length === 0, `${clients.length} clients, ${unmapped.length} unmapped`)

  const companies = new Map(
    (await rows(after, 'select id::text, slug, state, notes, client_since, client_ended_at from companies')).map(
      c => [c.id, c]
    )
  )
  const live = clients.filter(c => !c.deleted_at)
  const wrong = live.filter(c => {
    const co = companies.get(company(c.id))
    return !co || co.slug !== c.slug || (co.state ?? null) !== (c.state ?? null)
  })
  check('live clients: slug and state on the company', wrong.length === 0, `${live.length} live, ${wrong.length} differ`)

  const stateWrong = clients.filter(c => {
    const co = companies.get(company(c.id))
    if (!co) return true
    return c.deleted_at ? co.client_since === null : co.client_since === null || co.client_ended_at !== null
  })
  check('client state on the company (live / former)', stateWrong.length === 0, `${stateWrong.length} wrong`)

  const notesLost = clients.filter(c => {
    const note = (c.notes ?? '').trim()
    return note && !(companies.get(company(c.id))?.notes ?? '').includes(note)
  })
  check('client notes kept on the company', notesLost.length === 0, `${notesLost.length} lost`)

  // Billing type: the old column was a cache of the newest term.
  const newest = new Map(
    (
      await rows(
        after,
        `select distinct on (company_id) company_id::text, billing_type from billing_terms
         where deleted_at is null and effective_from <= current_date
         order by company_id, effective_from desc`
      )
    ).map(r => [r.company_id, r.billing_type])
  )
  const billingWrong = live.filter(c => c.billing_type && newest.get(company(c.id)) !== c.billing_type)
  check('billing type per client unchanged', billingWrong.length === 0, `${billingWrong.length} differ`)
}

// Terms: same rows on the mapped company.
for (const [oldTable, newTable] of [
  ['client_billing_terms', 'billing_terms'],
  ['client_commission_terms', 'commission_terms'],
]) {
  const extra = oldTable === 'client_billing_terms' ? 'billing_type' : 'origination_user_id, origination_contact_id'
  const old = await rows(before, `select id::text, client_id::text, effective_from::text, ${extra} from ${oldTable} where deleted_at is null`)
  const now = new Map(
    (await rows(after, `select id::text, company_id::text, effective_from::text, ${extra} from ${newTable} where deleted_at is null`)).map(
      r => [r.id, r]
    )
  )
  const wrong = old.filter(t => {
    const n = now.get(t.id)
    if (!n) return true
    if (n.company_id !== company(t.client_id) || n.effective_from !== t.effective_from) return true
    return extra
      .split(', ')
      .some(column => String(n[column] ?? '') !== String(t[column] ?? ''))
  })
  check(`${newTable}: every term on the right company`, wrong.length === 0, `${old.length} terms, ${wrong.length} differ`)
}

// Closers: old per-term closer_user_id became a closer row (0086/0108).
{
  const old = await rows(
    before,
    `select t.id::text term_id, t.closer_user_id::text user_id from client_commission_terms t
     where t.deleted_at is null and t.closer_user_id is not null
     union select c.term_id::text, c.closer_user_id::text from client_commission_term_closers c
     where c.deleted_at is null and c.closer_user_id is not null`
  )
  const now = set(
    (
      await rows(
        after,
        `select term_id::text || '/' || closer_user_id::text k from commission_term_closers
         where deleted_at is null and closer_user_id is not null`
      )
    ).map(r => r.k)
  )
  const lost = old.filter(r => !now.has(`${r.term_id}/${r.user_id}`))
  check('commission closers kept', lost.length === 0, `${old.length} closers, ${lost.length} lost`)
}

// Projects, hour blocks, invoices: on the client's company, timestamps untouched.
for (const table of ['projects', 'hour_blocks', 'invoices']) {
  const old = await rows(before, `select id::text, client_id::text, updated_at::text from ${table}`)
  const now = new Map(
    (await rows(after, `select id::text, company_id::text, updated_at::text from ${table}`)).map(r => [r.id, r])
  )
  const wrong = old.filter(r => {
    const n = now.get(r.id)
    return !n || (n.company_id ?? null) !== (company(r.client_id) ?? null)
  })
  const touched = old.filter(r => now.get(r.id) && now.get(r.id).updated_at !== r.updated_at)
  check(`${table}: on the client's company`, wrong.length === 0, `${old.length} rows, ${wrong.length} wrong`)
  check(`${table}: updated_at untouched`, touched.length === 0, `${touched.length} changed`)
}

// 3. Every foreign key resolves (including ones not enforced as constraints).
{
  const fks = await rows(
    after,
    `select conrelid::regclass::text tbl, confrelid::regclass::text ref,
       (select attname from pg_attribute where attrelid = conrelid and attnum = conkey[1]) col,
       (select attname from pg_attribute where attrelid = confrelid and attnum = confkey[1]) refcol
     from pg_constraint where contype = 'f' and connamespace = 'public'::regnamespace and array_length(conkey, 1) = 1`
  )
  // Columns with no constraint, checked by hand, with their pre-batch name.
  const soft = [
    ['activity_logs', 'target_company_id', 'companies', 'id', 'target_client_id', 'clients'],
    ['activity_logs', 'target_project_id', 'projects', 'id', 'target_project_id', 'projects'],
  ]
  const count = async (db, tbl, col, ref, refcol) =>
    (
      await rows(
        db,
        `select count(*)::int n from ${tbl} t where t.${col} is not null and not exists (select 1 from ${ref} r where r.${refcol} = t.${col})`
      )
    )[0].n
  const bad = []
  for (const [tbl, col, ref, refcol] of fks.map(f => [f.tbl, f.col, f.ref, f.refcol])) {
    const n = await count(after, tbl, col, ref, refcol)
    if (n) bad.push(`${tbl}.${col}: ${n}`)
  }
  // Activity can point at records deleted long ago: only new orphans count.
  const known = []
  for (const [tbl, col, ref, refcol, oldCol, oldRef] of soft) {
    const now = await count(after, tbl, col, ref, refcol)
    const was = await count(before, tbl, oldCol, oldRef, refcol)
    if (now > was) bad.push(`${tbl}.${col}: ${now} (was ${was})`)
    else if (now) known.push(`${tbl}.${col}: ${now}, as before`)
  }
  check(
    'every foreign key resolves',
    bad.length === 0,
    `${fks.length + soft.length} keys checked, ${bad.length} with new orphans` +
      (bad.length ? `: ${bad.join(', ')}` : '') +
      (known.length ? ` (already orphaned before the batch: ${known.join('; ')})` : '')
  )
}

// 4. Every sign-in tied to the right person.
{
  const old = await rows(before, 'select id::text, user_id::text from contacts where user_id is not null')
  const now = new Map((await rows(after, 'select id::text, user_id::text from contacts')).map(r => [r.id, r.user_id]))
  const moved = old.filter(r => now.get(r.id) !== r.user_id)
  check('sign-ins keep their person', moved.length === 0, `${old.length} links, ${moved.length} moved`)

  const [{ n }] = await rows(
    after,
    `select count(*)::int n from users u where u.deleted_at is null and
     (select count(*) from contacts c where c.user_id = u.id and c.deleted_at is null) <> 1`
  )
  check('every live sign-in has exactly one live person', n === 0, `${n} without`)

  const users = await rows(before, 'select id::text, email, role::text, disabled_at::text, deleted_at::text, avatar_url from users')
  const nowUsers = new Map(
    (
      await rows(
        after,
        `select u.id::text, u.email, u.role::text, u.disabled_at::text, u.deleted_at::text,
           (select c.avatar_url from contacts c where c.user_id = u.id and c.deleted_at is null limit 1) avatar_url
         from users u`
      )
    ).map(r => [r.id, r])
  )
  const changed = users.filter(u => {
    const n = nowUsers.get(u.id)
    return !n || ['email', 'role', 'disabled_at', 'deleted_at'].some(k => n[k] !== u[k])
  })
  check('sign-ins: email, role, off switch unchanged', changed.length === 0, `${users.length} sign-ins, ${changed.length} changed`)
  const photos = users.filter(u => u.avatar_url && !u.deleted_at && nowUsers.get(u.id)?.avatar_url !== u.avatar_url)
  check('photos now on the person', photos.length === 0, `${users.filter(u => u.avatar_url).length} photos, ${photos.length} lost`)
}

// 5. Portal access identical (old: contact_clients + a live sign-in + live client).
{
  const old = set(
    (
      await rows(
        before,
        `select cc.client_id::text, c.id::text contact_id, u.id::text user_id
         from contact_clients cc
         join contacts c on c.id = cc.contact_id and c.deleted_at is null
         join users u on u.id = c.user_id and u.deleted_at is null and u.disabled_at is null
         join clients cl on cl.id = cc.client_id and cl.deleted_at is null`
      )
    ).map(r => `${company(r.client_id)}/${r.contact_id}/${r.user_id}`)
  )
  const now = set(
    (await rows(after, 'select company_id::text, contact_id::text, user_id::text from client_portal_access')).map(
      r => `${r.company_id}/${r.contact_id}/${r.user_id}`
    )
  )
  const lost = missing(old, now)
  const gained = missing(now, old)
  check('portal access identical', lost.length === 0 && gained.length === 0, `${old.size} before, ${now.size} after, ${lost.length} lost, ${gained.length} gained`)
}

// 6. People at two companies keep both.
{
  const old = await rows(before, 'select contact_id::text, client_id::text from contact_clients')
  const byContact = new Map()
  for (const r of old) {
    const co = company(r.client_id)
    if (!co) continue
    byContact.set(r.contact_id, (byContact.get(r.contact_id) ?? new Set()).add(co))
  }
  const multi = [...byContact].filter(([, cos]) => cos.size > 1)
  const memberships = set(
    (await rows(after, 'select contact_id::text || \'/\' || company_id::text k from memberships where ended_at is null')).map(r => r.k)
  )
  const lost = multi.filter(([contact, cos]) => [...cos].some(co => !memberships.has(`${contact}/${co}`)))
  check('people at two companies keep both', lost.length === 0, `${multi.length} people, ${lost.length} lost a company`)
}

// 7. Closed months: every snapshot the same once ids are mapped.
{
  const old = await rows(before, 'select id::text, report::text from monthly_close_snapshots')
  const now = new Map((await rows(after, 'select id::text, report::text from monthly_close_snapshots')).map(r => [r.id, r.report]))
  const differ = old.filter(s => {
    let text = s.report
    for (const [clientId, companyId] of clientToCompany) text = text.split(clientId).join(companyId)
    const n = now.get(s.id)
    return !n || JSON.stringify(JSON.parse(n)) !== JSON.stringify(JSON.parse(text))
  })
  check('closed-month snapshots unchanged', differ.length === 0, `${old.length} snapshots, ${differ.length} differ`)
}

// 8–9. Money per client: hours bought, hours logged, invoice totals.
for (const [label, oldSql, newSql] of [
  [
    'hours bought per client',
    'select client_id::text k, sum(hours_purchased)::text v from hour_blocks where deleted_at is null group by 1',
    'select company_id::text k, sum(hours_purchased)::text v from hour_blocks where deleted_at is null group by 1',
  ],
  [
    'hours logged per client',
    'select p.client_id::text k, sum(t.hours)::text v from time_logs t join projects p on p.id = t.project_id where t.deleted_at is null and p.client_id is not null group by 1',
    'select p.company_id::text k, sum(t.hours)::text v from time_logs t join projects p on p.id = t.project_id where t.deleted_at is null and p.company_id is not null group by 1',
  ],
  [
    'invoice totals per client',
    'select client_id::text k, sum(total)::text v from invoices where deleted_at is null group by 1',
    'select company_id::text k, sum(total)::text v from invoices where deleted_at is null group by 1',
  ],
]) {
  const old = new Map()
  for (const r of await rows(before, oldSql)) {
    const co = company(r.k)
    old.set(co, (Number(old.get(co) ?? 0) + Number(r.v)).toFixed(2))
  }
  const now = new Map((await rows(after, newSql)).map(r => [r.k, Number(r.v).toFixed(2)]))
  const differ = [...old].filter(([k, v]) => now.get(k) !== v)
  check(label, differ.length === 0 && old.size === now.size, `${old.size} clients, ${differ.length} differ`)
}

await before.end()
await after.end()

const width = Math.max(...results.map(r => r.name.length))
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(width)}  ${r.detail}`)
}
const failed = results.filter(r => !r.ok).length
console.log(`\n${results.length - failed}/${results.length} checks pass`)
process.exit(failed ? 1 : 0)
