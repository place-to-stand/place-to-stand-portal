/**
 * Dev utility: exercise the MCP server (PRD 009) end to end, the way a real
 * connector does — dynamic client registration, PKCE authorize, consent,
 * token exchange — then call every tool and check the attribution it leaves.
 *
 * The consent step is the one shortcut: instead of a browser on
 * /oauth/consent, the script approves the authorization with the signed-in
 * user's session, which is exactly what that page's server action does.
 *
 * Requires local Supabase with `[auth.oauth_server]` enabled and the internal
 * app running (`npm run dev`), then, from apps/internal:
 *
 *   MCP_TEST_EMAIL=... MCP_TEST_PASSWORD=... npx tsx scripts/test-mcp.ts
 *
 * The user must be an ADMIN. Writes a task, a comment, a lead and a lead
 * update to whatever DATABASE_URL points at, and creates two throwaway users
 * (a SALES user and an admin mid password reset) to prove they are refused,
 * then deletes all of it — do not aim it at production.
 */

import { createHash, randomBytes } from 'crypto'

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { eq, inArray } from 'drizzle-orm'

config({ path: '.env.local', override: false })
config({ path: '.env', override: false })

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'
const MCP_URL = `${BASE_URL}/api/mcp`
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const EMAIL = process.env.MCP_TEST_EMAIL
const PASSWORD = process.env.MCP_TEST_PASSWORD
const REDIRECT_URI = 'http://127.0.0.1:8976/callback'
const CLIENT_NAME = 'test-mcp script'

let failures = 0

function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log(`  ✓ ${label}`)
  } else {
    failures += 1
    console.error(`  ✗ ${label}`, detail === undefined ? '' : detail)
  }
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

function base64url(buffer: Buffer): string {
  return buffer.toString('base64url')
}

/**
 * Tool output is asserted field by field below, so a loose shape keeps those
 * reads short; the server's own types are the contract, not this script.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any

/** Every OAuth client this run registers, deleted in cleanup. */
const registeredClients: string[] = []

type Discovery = {
  metadata: Loose
  resource: Loose
}

/** The 401 challenge and the discovery documents it points at. */
async function discover(): Promise<Discovery> {
  const challenge = await fetch(MCP_URL, { method: 'POST' })
  const resourceMetadata = challenge.headers
    .get('www-authenticate')
    ?.match(/resource_metadata="([^"]+)"/)?.[1]

  check('unauthenticated call is challenged with 401', challenge.status === 401)
  check('challenge points at the discovery document', Boolean(resourceMetadata))

  const resource = await (await fetch(resourceMetadata!)).json()
  const [authServer] = resource.authorization_servers as string[]
  const metadata = await (
    await fetch(`${authServer}/.well-known/oauth-authorization-server`)
  ).json()

  check('discovery names an authorization server', Boolean(metadata.issuer))

  return { metadata, resource }
}

/**
 * DCR → PKCE authorize → approve → token, as one user. Throws rather than
 * exiting so callers' cleanup still runs.
 */
async function authorizeAs(
  { metadata, resource }: Discovery,
  email: string,
  password: string
): Promise<{
  accessToken: string
  sessionToken: string
  clientId: string
}> {
  const supabase = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: signIn, error: signInError } =
    await supabase.auth.signInWithPassword({ email, password })

  if (signInError || !signIn.session) {
    throw new Error(`Sign-in failed for ${email}: ${signInError?.message ?? 'no session'}`)
  }

  const registration = await fetch(metadata.registration_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: CLIENT_NAME,
      redirect_uris: [REDIRECT_URI],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    }),
  })
  const client = await registration.json()

  check('dynamic client registration succeeds', Boolean(client.client_id), client)
  registeredClients.push(client.client_id)

  const verifier = base64url(randomBytes(32))
  const authorizeUrl = new URL(metadata.authorization_endpoint)
  authorizeUrl.search = new URLSearchParams({
    response_type: 'code',
    client_id: client.client_id,
    redirect_uri: REDIRECT_URI,
    code_challenge: base64url(createHash('sha256').update(verifier).digest()),
    code_challenge_method: 'S256',
    state: base64url(randomBytes(8)),
    resource: resource.resource,
  }).toString()

  const authorize = await fetch(authorizeUrl, { redirect: 'manual' })
  const consentUrl = new URL(authorize.headers.get('location') ?? '', BASE_URL)
  const authorizationId = consentUrl.searchParams.get('authorization_id')

  check(
    'authorize redirects to /oauth/consent',
    consentUrl.pathname === '/oauth/consent' && Boolean(authorizationId),
    authorize.headers.get('location')
  )

  // The consent page reads the request before offering approval, and Supabase
  // binds the authorization to the viewing user on that read — approving
  // without it is "authorization not found".
  const { data: details, error: detailsError } =
    await supabase.auth.oauth.getAuthorizationDetails(authorizationId!)

  check(
    'consent sees the registered client name',
    // Same field skew the consent page handles: `name` or `client_name`.
    Boolean(
      details &&
        'client' in details &&
        [details.client.name, (details.client as { client_name?: string }).client_name]
          .includes(CLIENT_NAME)
    ),
    detailsError ?? details
  )

  const { data: approval, error: approvalError } =
    await supabase.auth.oauth.approveAuthorization(authorizationId!, {
      skipBrowserRedirect: true,
    })
  const code = approval?.redirect_url
    ? new URL(approval.redirect_url).searchParams.get('code')
    : null

  check('consent approval returns a code', Boolean(code), approvalError)

  const token = await fetch(metadata.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code!,
      redirect_uri: REDIRECT_URI,
      client_id: client.client_id,
      code_verifier: verifier,
    }),
  })
  const tokens = await token.json()

  check('token exchange issues an access token', Boolean(tokens.access_token), tokens)

  if (!tokens.access_token) {
    throw new Error('Cannot continue without an access token.')
  }

  return {
    accessToken: tokens.access_token,
    sessionToken: signIn.session!.access_token,
    clientId: client.client_id,
  }
}

type RpcResponse = {
  status: number
  body: {
    result?: {
      tools?: { name: string }[]
      isError?: boolean
      structuredContent?: Record<string, unknown>
      content?: { type: string; text: string }[]
    }
    error?: { message: string }
  } | null
}

let rpcId = 0

/**
 * One stateless JSON-RPC call. The server may answer as JSON or as a single
 * SSE event, depending on what it negotiates; both are read here.
 */
async function rpc(
  token: string | null,
  method: string,
  params: Record<string, unknown> = {}
): Promise<RpcResponse> {
  rpcId += 1

  const response = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: rpcId, method, params }),
  })

  const text = await response.text()
  const json = text.startsWith('{')
    ? text
    : text
        .split('\n')
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trim())
        .pop()

  return { status: response.status, body: json ? JSON.parse(json) : null }
}

async function callTool(
  token: string,
  name: string,
  args: Record<string, unknown> = {}
) {
  const { body } = await rpc(token, 'tools/call', { name, arguments: args })
  const result = body?.result

  return {
    ok: Boolean(result && !result.isError),
    data: (result?.structuredContent ?? {}) as Record<string, Loose>,
    message: result?.content?.[0]?.text ?? body?.error?.message,
  }
}

function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Prove a valid OAuth token is still refused for a user who may not use the
 * server. Supabase's approve endpoint answers to any signed-in user — the
 * consent page's admin check is UI only — so the token check in
 * `verifyMcpToken` is the gate, and this tests it directly.
 */
async function checkRefused(
  discovery: Discovery,
  label: string,
  user: { role: 'ADMIN' | 'SALES'; mustReset: boolean },
  expected: RegExp,
  insertProfile: (row: { id: string; email: string; role: 'ADMIN' | 'SALES' }) => Promise<void>,
  deleteProfile: (id: string) => Promise<void>
) {
  const admin = adminClient()
  const email = `mcp-test-${randomBytes(4).toString('hex')}@example.com`
  const password = base64url(randomBytes(18))
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: user.mustReset ? { must_reset_password: true } : {},
  })

  if (error || !data.user) {
    throw new Error(`Could not create the ${label} test user: ${error?.message}`)
  }

  try {
    await insertProfile({ id: data.user.id, email, role: user.role })

    const { accessToken } = await authorizeAs(discovery, email, password)
    const refused = await rpc(accessToken, 'tools/list')

    check(
      `${label} is refused with 403`,
      refused.status === 403 && expected.test(refused.body?.error?.message ?? ''),
      refused
    )
  } finally {
    await deleteProfile(data.user.id)
    await admin.auth.admin.deleteUser(data.user.id)
  }
}

/** Each run registers fresh OAuth clients (and grants); remove them all. */
async function deleteRegisteredClients() {
  const admin = adminClient()

  await Promise.all(
    registeredClients.map(clientId => admin.auth.admin.oauth.deleteClient(clientId))
  )
}

async function main() {
  if (!EMAIL || !PASSWORD) {
    fail('Set MCP_TEST_EMAIL and MCP_TEST_PASSWORD (a local ADMIN).')
  }

  if (!SERVICE_ROLE_KEY) {
    fail('SUPABASE_SERVICE_ROLE_KEY is required to create and remove test users.')
  }

  if (!process.env.DATABASE_URL) {
    fail('DATABASE_URL is required to verify the activity rows.')
  }

  // Connect directly rather than via `@/lib/db` — that module is marked
  // `server-only`, which does not resolve outside the Next runtime.
  const { createDb } = await import('@pts/db/client')
  const { activityLogs, leads, leadUpdates, taskComments, tasks, users: userProfiles } =
    await import('@pts/db/schema')
  const db = createDb(process.env.DATABASE_URL)

  console.log(`\nTarget: ${MCP_URL}\n\nOAuth`)
  const discovery = await discover()
  const { accessToken, sessionToken } = await authorizeAs(discovery, EMAIL!, PASSWORD!)

  console.log('\nRejections')
  const cliToken = await rpc(sessionToken, 'tools/list')
  check('a CLI session token (no client_id) is refused', cliToken.status === 401)
  const noToken = await rpc(null, 'tools/list')
  check('a call with no token is refused', noToken.status === 401)

  const insertProfile = async (row: { id: string; email: string; role: 'ADMIN' | 'SALES' }) => {
    await db.insert(userProfiles).values(row)
  }
  const deleteProfile = async (id: string) => {
    await db.delete(userProfiles).where(eq(userProfiles.id, id))
  }

  await checkRefused(discovery, 'a SALES user', { role: 'SALES', mustReset: false },
    /admin users only/, insertProfile, deleteProfile)
  await checkRefused(discovery, 'an admin mid password reset', { role: 'ADMIN', mustReset: true },
    /must reset its password/, insertProfile, deleteProfile)

  console.log('\nTools')
  const list = await rpc(accessToken, 'tools/list')
  const names = (list.body?.result?.tools ?? []).map(tool => tool.name)
  const expected = [
    'whoami', 'list_users', 'list_clients', 'get_client', 'list_contacts',
    'get_contact', 'list_projects', 'get_project', 'list_tasks', 'get_task',
    'create_task', 'update_task', 'add_task_comment', 'list_leads', 'get_lead',
    'create_lead', 'update_lead', 'add_lead_update',
  ]
  check(
    `tools/list has all ${expected.length} tools`,
    expected.every(name => names.includes(name)),
    names
  )
  check(
    'no time-log tool is exposed (D5)',
    !names.some(name => name.includes('time'))
  )

  const whoami = await callTool(accessToken, 'whoami')
  check('whoami acts as the signed-in user', whoami.data.user?.email === EMAIL, whoami)
  check('whoami names the agent', whoami.data.agent?.name === CLIENT_NAME, whoami.data.agent)
  const userId = whoami.data.user?.id as string

  console.log('\nReads')
  const clients = await callTool(accessToken, 'list_clients', { limit: 2 })
  check('list_clients returns items with an hours balance',
    clients.ok && clients.data.items.every((c: Loose) => 'hoursRemaining' in c), clients.message)
  check('list_clients honours limit', clients.data.items?.length <= 2)

  const firstClient = clients.data.items?.[0]
  if (firstClient) {
    const client = await callTool(accessToken, 'get_client', { client: firstClient.slug ?? firstClient.id })
    check('get_client resolves by slug with contacts and projects',
      client.ok && Array.isArray(client.data.contacts) && Array.isArray(client.data.projects), client.message)
  }

  const contacts = await callTool(accessToken, 'list_contacts', { limit: 3 })
  check('list_contacts returns items', contacts.ok && Array.isArray(contacts.data.items), contacts.message)
  const firstContact = contacts.data.items?.[0]
  if (firstContact) {
    const contact = await callTool(accessToken, 'get_contact', { contactId: firstContact.id })
    check('get_contact returns the contact and its clients',
      contact.ok && contact.data.contact?.id === firstContact.id, contact.message)
  }

  const users = await callTool(accessToken, 'list_users', { role: 'ADMIN', limit: 5 })
  check('list_users filters by role', users.ok && users.data.items.every((u: Loose) => u.role === 'ADMIN'), users.message)

  const projects = await callTool(accessToken, 'list_projects', { limit: 100 })
  check('list_projects returns items', projects.ok && projects.data.items.length > 0, projects.message)
  const project = projects.data.items?.find((p: Loose) => p.type === 'INTERNAL' && p.slug)
    ?? projects.data.items?.find((p: Loose) => p.slug)

  if (!project) {
    fail('No project with a slug to write a test task into.')
  }

  const gotProject = await callTool(accessToken, 'get_project', { project: project.slug })
  check('get_project resolves a slug', gotProject.data.project?.id === project.id, gotProject.message)

  const badInput = await callTool(accessToken, 'get_task', { taskId: 'not-a-uuid' })
  check('invalid input is a tool error, not a crash', !badInput.ok && Boolean(badInput.message))

  const missing = await callTool(accessToken, 'get_task', {
    taskId: '00000000-0000-4000-8000-000000000000',
  })
  check('an unknown task is a not-found tool error', !missing.ok && /not found/i.test(missing.message ?? ''), missing.message)

  console.log('\nWrites')
  const created: { taskId?: string; leadId?: string } = {}

  try {
    const createTask = await callTool(accessToken, 'create_task', {
      project: project.slug,
      title: `MCP smoke test ${new Date().toISOString()}`,
      description: 'Created by **scripts/test-mcp.ts**.\n\n- safe to delete',
      assigneeIds: [EMAIL],
    })
    created.taskId = createTask.data.task?.id
    check('create_task creates the task', createTask.ok && Boolean(created.taskId), createTask.message)
    check('create_task resolves an email assignee',
      createTask.data.task?.assigneeIds?.includes(userId), createTask.data.task?.assigneeIds)

    const update = await callTool(accessToken, 'update_task', {
      taskId: created.taskId, status: 'IN_PROGRESS',
    })
    check('update_task changes status', update.data.task?.status === 'IN_PROGRESS', update.message)
    check('update_task keeps omitted fields', update.data.task?.assigneeIds?.includes(userId))

    const emptyUpdate = await callTool(accessToken, 'update_task', { taskId: created.taskId })
    check('update_task with no fields is refused', !emptyUpdate.ok, emptyUpdate.message)

    const comment = await callTool(accessToken, 'add_task_comment', {
      taskId: created.taskId, body: 'Smoke test comment.',
    })
    check('add_task_comment posts as the user', comment.data.comment?.authorId === userId, comment.message)

    const task = await callTool(accessToken, 'get_task', { taskId: created.taskId })
    check('get_task returns the comment', task.data.comments?.length === 1, task.message)

    const listed = await callTool(accessToken, 'list_tasks', { project: project.slug, assignee: EMAIL, limit: 5 })
    check('list_tasks filters by project and assignee email',
      listed.ok && listed.data.items.some((t: Loose) => t.id === created.taskId), listed.message)
    const preview = listed.data.items?.find((t: Loose) => t.id === created.taskId)?.description
    check('list_tasks previews the description as plain text',
      typeof preview === 'string' && preview.includes('safe to delete') && !/<[a-z/]/i.test(preview), preview)

    const createLead = await callTool(accessToken, 'create_lead', {
      name: 'MCP Smoke Test', company: 'test-mcp.ts', notes: 'Safe to delete.',
    })
    created.leadId = createLead.data.lead?.id
    check('create_lead creates the lead', createLead.ok && Boolean(created.leadId), createLead.message)

    const moved = await callTool(accessToken, 'update_lead', {
      leadId: created.leadId, status: 'ACTIVE_OPPORTUNITIES',
    })
    check('update_lead moves the stage', moved.data.lead?.status === 'ACTIVE_OPPORTUNITIES', moved.message)

    const logged = await callTool(accessToken, 'add_lead_update', {
      leadId: created.leadId, type: 'PHONE_CALL', body: 'Smoke test call.',
    })
    check('add_lead_update logs the entry', logged.ok && Boolean(logged.data.update?.id), logged.message)

    const lead = await callTool(accessToken, 'get_lead', { leadId: created.leadId })
    check('get_lead returns the timeline', lead.data.updates?.length === 1, lead.message)

    const leadsList = await callTool(accessToken, 'list_leads', { search: 'MCP Smoke Test', limit: 5 })
    check('list_leads finds it by text', leadsList.data.items?.some((l: Loose) => l.id === created.leadId), leadsList.message)

    console.log('\nAttribution')
    const targetIds = [created.taskId, created.leadId].filter(Boolean) as string[]
    const commentRows = created.taskId
      ? await db.select({ id: taskComments.id }).from(taskComments).where(eq(taskComments.taskId, created.taskId))
      : []
    const rows = await db
      .select()
      .from(activityLogs)
      .where(inArray(activityLogs.targetId, [...targetIds, ...commentRows.map(row => row.id)]))

    check('every write logged activity', rows.length >= 5, rows.length)
    check('activity rows are source MCP', rows.length > 0 && rows.every(row => row.source === 'MCP'),
      rows.map(row => row.source))
    check('activity rows name the human as actor', rows.every(row => row.actorId === userId))
    check('activity rows carry the agent', rows.every(row =>
      (row.metadata as { agent?: { name?: string } })?.agent?.name === CLIENT_NAME))
  } finally {
    console.log('\nCleanup')

    if (created.taskId) {
      const commentIds = (await db.select({ id: taskComments.id }).from(taskComments)
        .where(eq(taskComments.taskId, created.taskId))).map(row => row.id)
      await db.delete(activityLogs).where(inArray(activityLogs.targetId, [created.taskId, ...commentIds]))
      await db.delete(tasks).where(eq(tasks.id, created.taskId))
    }

    if (created.leadId) {
      const updateIds = (await db.select({ id: leadUpdates.id }).from(leadUpdates)
        .where(eq(leadUpdates.leadId, created.leadId))).map(row => row.id)
      await db.delete(activityLogs).where(inArray(activityLogs.targetId, [created.leadId, ...updateIds]))
      // Stage history and timeline entries cascade with the lead.
      await db.delete(leads).where(eq(leads.id, created.leadId))
    }

    await deleteRegisteredClients()

    console.log('  removed test rows and the OAuth clients')
  }

  console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.')
  process.exit(failures ? 1 : 0)
}

main().catch(async error => {
  console.error(error)
  await deleteRegisteredClients().catch(() => {})
  process.exit(1)
})
