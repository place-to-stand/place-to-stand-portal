import { readFileSync } from 'node:fs'
import path from 'node:path'

import { expect, test } from '@playwright/test'

/**
 * A task written with a bearer token (no cookie), assigned to someone else,
 * must save, answer success and run its side effects. MCP and the CLI share
 * this path from `createTaskFromInput` on; the Nov 2 bug was a cookie-only
 * guard after the insert, which made every token write report a 500.
 *
 * Drives the CLI endpoint: MCP itself needs an OAuth client token, which the
 * local setup can't mint yet. Writes data, so E2E_WRITES only.
 */
test.skip(!process.env.E2E_WRITES, 'set E2E_WRITES=1 on a throwaway database')

const ADMIN = process.env.E2E_ADMIN_EMAIL ?? 'jason@local.test'
const OTHER = process.env.E2E_SALES_EMAIL ?? 'dave@local.test'

function localSupabase() {
  const file = path.join(__dirname, '../../apps/internal/.env.local')
  const env: Record<string, string> = {}
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match) env[match[1]] = match[2].replace(/^"|"$/g, '')
  }
  const url = process.env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Local Supabase URL and key not found')
  const host = new URL(url).hostname
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error(`Only runs against a local Supabase (got ${host})`)
  }
  return { url, key }
}

/** A real session access token for `email`, as the CLI would hold. */
async function accessToken(email: string) {
  const { url, key } = localSupabase()
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  }
  const link = await fetch(`${url}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ type: 'magiclink', email }),
  })
  const linkBody = (await link.json()) as {
    hashed_token?: string
    properties?: { hashed_token?: string }
  }
  const tokenHash = linkBody.properties?.hashed_token ?? linkBody.hashed_token
  expect(tokenHash, `sign-in link for ${email}`).toBeTruthy()
  const verify = await fetch(`${url}/auth/v1/verify`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ type: 'magiclink', token_hash: tokenHash }),
  })
  const session = (await verify.json()) as { access_token?: string }
  expect(session.access_token, 'session from the link').toBeTruthy()
  return session.access_token!
}

test('a token task write assigned to someone else succeeds with its side effects', async ({
  request,
}) => {
  const token = await accessToken(ADMIN)
  const auth = { Authorization: `Bearer ${token}` }

  const projects = await request.get('/api/cli/v1/projects?limit=1', {
    headers: auth,
  })
  expect(projects.status()).toBe(200)
  const project = ((await projects.json()) as { data: { id: string }[] })
    .data[0]
  expect(project, 'a project to put the task on').toBeTruthy()

  const created = await request.post('/api/cli/v1/tasks', {
    headers: auth,
    data: {
      project: project.id,
      title: `Token write check ${Date.now()}`,
      assigneeIds: [OTHER],
    },
  })
  // Was a 500 (a redirect from a cookie-only guard) though the row saved.
  expect(created.status()).toBe(201)
  const body = (await created.json()) as {
    ok: boolean
    data: { id: string; assigneeIds: string[] }
    warning?: string
  }
  expect(body.ok).toBe(true)
  expect(body.warning).toBeUndefined()
  expect(body.data.assigneeIds).toHaveLength(1)

  // Side effect: the assignee was told.
  const { url, key } = localSupabase()
  const notes = await fetch(
    `${url}/rest/v1/notifications?select=type&type=eq.task_assigned&href=like.*${body.data.id}*`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  )
  expect(await notes.json()).toHaveLength(1)

  // The update path ends the same way; also tidies the task away.
  const updated = await request.patch(`/api/cli/v1/tasks/${body.data.id}`, {
    headers: auth,
    data: { status: 'DONE' },
  })
  expect(updated.status()).toBe(200)
  expect(((await updated.json()) as { ok: boolean }).ok).toBe(true)
})
