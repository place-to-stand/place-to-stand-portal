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
 * update to whatever DATABASE_URL points at, and creates throwaway users: a
 * CLIENT user and an admin mid password reset, to prove they are refused; a
 * CLIENT user nobody may assign anything to; and a SALES user, to prove SALES
 * reaches exactly the portal's CRM (leads, contacts and their activity) and
 * nothing else. Then it deletes all of it — do not aim it at production.
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

/** Tools whose output carried a Postgres-text timestamp instead of ISO 8601. */
const nonIsoTimestamps = new Set<string>()
const POSTGRES_TIMESTAMP = /\d{4}-\d{2}-\d{2} \d{2}:\d{2}/

async function callTool(
  token: string,
  name: string,
  args: Record<string, unknown> = {}
) {
  const { body } = await rpc(token, 'tools/call', { name, arguments: args })
  const result = body?.result

  if (POSTGRES_TIMESTAMP.test(JSON.stringify(result?.structuredContent ?? {}))) {
    nonIsoTimestamps.add(name)
  }

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

type Role = 'ADMIN' | 'SALES' | 'CLIENT'

type ProfileStore = {
  insert: (row: { id: string; email: string; role: Role }) => Promise<void>
  remove: (id: string) => Promise<void>
}

type TestUser = { id: string; email: string; password: string }

/**
 * A throwaway auth user plus profile with `role`. The caller must pass the
 * result to `deleteTestUser`, even on failure.
 */
async function createTestUser(
  label: string,
  role: Role,
  profiles: ProfileStore,
  { mustReset = false }: { mustReset?: boolean } = {}
): Promise<TestUser> {
  const admin = adminClient()
  const email = `mcp-test-${randomBytes(4).toString('hex')}@example.com`
  const password = base64url(randomBytes(18))
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: mustReset ? { must_reset_password: true } : {},
  })

  if (error || !data.user) {
    throw new Error(`Could not create the ${label} test user: ${error?.message}`)
  }

  try {
    await profiles.insert({ id: data.user.id, email, role })
  } catch (insertError) {
    await admin.auth.admin.deleteUser(data.user.id)
    throw insertError
  }

  return { id: data.user.id, email, password }
}

async function deleteTestUser(user: TestUser, profiles: ProfileStore) {
  await profiles.remove(user.id)
  await adminClient().auth.admin.deleteUser(user.id)
}

/**
 * Prove a valid OAuth token is still refused for a user who may not use the
 * server. Supabase's approve endpoint answers to any signed-in user — the
 * consent page's role check is UI only — so the token check in
 * `verifyMcpToken` is the gate, and this tests it directly.
 */
async function checkRefused(
  discovery: Discovery,
  label: string,
  user: { role: Role; mustReset: boolean },
  expected: RegExp,
  profiles: ProfileStore
) {
  const testUser = await createTestUser(label, user.role, profiles, {
    mustReset: user.mustReset,
  })

  try {
    const { accessToken } = await authorizeAs(discovery, testUser.email, testUser.password)
    const refused = await rpc(accessToken, 'tools/list')

    check(
      `${label} is refused with 403`,
      refused.status === 403 && expected.test(refused.body?.error?.message ?? ''),
      refused
    )
  } finally {
    await deleteTestUser(testUser, profiles)
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
  const {
    activityLogs, leads, leadUpdates, monthlyCloseSnapshots, taskComments, tasks, users: userProfiles,
  } = await import('@pts/db/schema')
  const db = createDb(process.env.DATABASE_URL)

  console.log(`\nTarget: ${MCP_URL}\n\nOAuth`)
  const discovery = await discover()
  const { accessToken, sessionToken } = await authorizeAs(discovery, EMAIL!, PASSWORD!)

  console.log('\nRejections')
  const cliToken = await rpc(sessionToken, 'tools/list')
  check('a CLI session token (no client_id) is refused', cliToken.status === 401)
  const noToken = await rpc(null, 'tools/list')
  check('a call with no token is refused', noToken.status === 401)

  const profiles: ProfileStore = {
    insert: async row => {
      await db.insert(userProfiles).values(row)
    },
    remove: async id => {
      await db.delete(userProfiles).where(eq(userProfiles.id, id))
    },
  }

  // SALES is admitted since PRD 009 D6 was revised; CLIENT never is.
  await checkRefused(discovery, 'a CLIENT user', { role: 'CLIENT', mustReset: false },
    /admin and sales users only/, profiles)
  await checkRefused(discovery, 'an admin mid password reset', { role: 'ADMIN', mustReset: true },
    /must reset its password/, profiles)

  console.log('\nTools')
  const list = await rpc(accessToken, 'tools/list')
  const names = (list.body?.result?.tools ?? []).map(tool => tool.name)
  const expected = [
    'whoami', 'list_users', 'list_clients', 'get_client', 'list_contacts',
    'get_contact', 'list_projects', 'get_project', 'list_tasks', 'get_task',
    'create_task', 'update_task', 'add_task_comment', 'list_leads', 'get_lead',
    'create_lead', 'update_lead', 'add_lead_update', 'list_activity',
    'recent_activity', 'list_time_logs', 'list_invoices', 'get_invoice',
    'list_hour_blocks', 'get_client_hour_balance', 'get_monthly_close',
  ]
  check(
    `tools/list has all ${expected.length} tools`,
    expected.every(name => names.includes(name)),
    names
  )
  check(
    'the only time-log tool is read-only (D5)',
    (list.body?.result?.tools ?? [])
      .filter((tool: Loose) => tool.name.includes('time'))
      .every((tool: Loose) => tool.name === 'list_time_logs' && tool.annotations?.readOnlyHint === true)
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

  const timeLogs = await callTool(accessToken, 'list_time_logs', { project: project.slug, limit: 3 })
  check('list_time_logs filters by project with totals',
    timeLogs.ok && timeLogs.data.items.every((t: Loose) => t.projectId === project.id)
      && typeof timeLogs.data.totalHours === 'number' && typeof timeLogs.data.totalCount === 'number',
    timeLogs.message)
  const myTimeFilters = { user: EMAIL, from: '2000-01-01', to: new Date().toISOString().slice(0, 10), limit: 3 }
  const myTime = await callTool(accessToken, 'list_time_logs', myTimeFilters)
  check('list_time_logs filters by user email and date range',
    myTime.ok && myTime.data.items.every((t: Loose) => t.userId === userId), myTime.message)
  check('list_time_logs hasMore is true exactly when more entries match than were returned',
    myTime.data.hasMore === (myTime.data.totalCount > myTime.data.items?.length)
      && myTime.data.items?.length <= myTimeFilters.limit && !('nextOffset' in myTime.data), myTime.data)
  const oneDay = myTime.data.items?.[0]?.loggedOn
  if (oneDay) {
    const narrowed = await callTool(accessToken, 'list_time_logs', { user: EMAIL, from: oneDay, to: oneDay, limit: 100 })
    check('list_time_logs narrows to a single work date',
      narrowed.ok && narrowed.data.items.every((t: Loose) => t.loggedOn === oneDay)
        && narrowed.data.totalCount <= myTime.data.totalCount, narrowed.message)
  }

  console.log('\nBilling (read-only, D9)')
  const billingTools = (list.body?.result?.tools ?? []).filter((tool: Loose) =>
    ['list_invoices', 'get_invoice', 'list_hour_blocks', 'get_client_hour_balance', 'get_monthly_close'].includes(tool.name))
  check('billing tools are all read-only',
    billingTools.length === 5 && billingTools.every((tool: Loose) => tool.annotations?.readOnlyHint === true))

  const invoices = await callTool(accessToken, 'list_invoices', { limit: 3 })
  check('list_invoices returns items, hasMore and a total',
    invoices.ok && Array.isArray(invoices.data.items) && typeof invoices.data.totalCount === 'number'
      && invoices.data.hasMore === (invoices.data.totalCount > invoices.data.items.length)
      && !('nextOffset' in invoices.data), invoices.message)
  const invoiceClientId = invoices.data.items?.[0]?.clientId
  if (invoiceClientId) {
    const forClient = await callTool(accessToken, 'list_invoices', { client: invoiceClientId, limit: 100 })
    check('list_invoices narrows by client',
      forClient.ok && forClient.data.items.length > 0
        && forClient.data.items.every((i: Loose) => i.clientId === invoiceClientId), forClient.message)
  }
  const firstInvoice = invoices.data.items?.[0]
  if (firstInvoice) {
    const invoice = await callTool(accessToken, 'get_invoice', { invoiceId: firstInvoice.id })
    check('get_invoice returns line items', invoice.ok && Array.isArray(invoice.data.invoice?.lineItems), invoice.message)
    check('get_invoice leaks no share token or Stripe ids',
      !/share_?token|stripe|payment_?intent|checkout_?session/i.test(JSON.stringify(invoice.data)))
  }

  const blocks = await callTool(accessToken, 'list_hour_blocks', { limit: 3 })
  check('list_hour_blocks returns items with hasMore set from the total',
    blocks.ok && Array.isArray(blocks.data.items)
      && blocks.data.hasMore === (blocks.data.totalCount > blocks.data.items.length)
      && !('nextOffset' in blocks.data), blocks.message)
  const blockClientId = blocks.data.items?.[0]?.clientId
  if (blockClientId) {
    const forClient = await callTool(accessToken, 'list_hour_blocks', { client: blockClientId, limit: 5 })
    check('list_hour_blocks filters by client',
      forClient.ok && forClient.data.items.every((b: Loose) => b.clientId === blockClientId), forClient.message)
  }
  const prepaid = clients.data.items?.find((c: Loose) => c.billingType === 'prepaid' && c.slug)
  if (prepaid) {
    const balance = await callTool(accessToken, 'get_client_hour_balance', { client: prepaid.slug })
    check('get_client_hour_balance matches get_client by slug',
      balance.ok && balance.data.hoursRemaining === prepaid.hoursRemaining, balance.message)
  }

  const lastMonth = new Date()
  lastMonth.setUTCDate(1)
  lastMonth.setUTCMonth(lastMonth.getUTCMonth() - 1)
  const close = await callTool(accessToken, 'get_monthly_close', {
    year: lastMonth.getUTCFullYear(), month: lastMonth.getUTCMonth() + 1,
  })
  check('get_monthly_close says where the data came from',
    close.ok && ['snapshot', 'live'].includes(close.data.source)
      && (close.data.source === 'live' || Boolean(close.data.closedAt)), close.message)
  check('get_monthly_close returns per-person payroll',
    Array.isArray(close.data.report?.payroll?.rows), close.data.report && Object.keys(close.data.report))
  check('an open month never reports a profit share (no Mercury read)',
    close.data.source === 'snapshot' || close.data.profitShare?.status !== 'ready', close.data.profitShare)

  // Mercury account ids and names (which carry the account number's last
  // digits) are frozen into every snapshot with a profit share; none may
  // reach the agent. Checked against the newest snapshots that have one.
  const frozen = (await db
    .select({ year: monthlyCloseSnapshots.year, month: monthlyCloseSnapshots.month, report: monthlyCloseSnapshots.report })
    .from(monthlyCloseSnapshots))
    .map(row => ({ ...row, accounts: ((row.report as Loose)?.profitShare?.accounts ?? []) as Loose[] }))
    .filter(row => row.accounts.length > 0)
    .sort((a, b) => b.year - a.year || b.month - a.month)
    .slice(0, 3)
  const closes = [close, ...await Promise.all(frozen.map(row =>
    callTool(accessToken, 'get_monthly_close', { year: row.year, month: row.month })))]
  const bankIdentifiers = frozen.flatMap(row =>
    row.accounts.flatMap((account: Loose) => [account.id, account.name])).filter(Boolean) as string[]
  const leaked = bankIdentifiers.filter(identifier =>
    closes.some(result => JSON.stringify(result.data).includes(identifier)))
  check(`get_monthly_close leaks no Mercury account id or name (${frozen.length} snapshot(s) checked)`,
    leaked.length === 0 && closes.every(result => result.ok), leaked.length ? `${leaked.length} identifier(s) leaked` : undefined)
  check('get_monthly_close keeps per-account balances and nothing else',
    closes.every(result => (result.data.profitShare?.data?.accounts ?? []).every((account: Loose) =>
      Object.keys(account).join() === 'balance' && typeof account.balance === 'number')))

  const badInput = await callTool(accessToken, 'get_task', { taskId: 'not-a-uuid' })
  check('invalid input is a tool error, not a crash', !badInput.ok && Boolean(badInput.message))

  const missing = await callTool(accessToken, 'get_task', {
    taskId: '00000000-0000-4000-8000-000000000000',
  })
  check('an unknown task is a not-found tool error', !missing.ok && /not found/i.test(missing.message ?? ''), missing.message)

  console.log('\nWrites')
  const created: { taskId?: string; leadId?: string; salesLeadId?: string } = {}
  let salesUser: TestUser | null = null
  // A portal (CLIENT) user nobody may assign anything to.
  let clientUser: TestUser | null = null

  try {
    clientUser = await createTestUser('CLIENT assignee', 'CLIENT', profiles)
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

    const taskActivity = await callTool(accessToken, 'list_activity', {
      targetId: created.taskId, source: 'MCP', actor: EMAIL, limit: 1,
    })
    check('list_activity filters by target, source and actor email',
      taskActivity.ok && taskActivity.data.items.length > 0 && taskActivity.data.items.every((a: Loose) =>
        a.target?.id === created.taskId && a.source === 'MCP' && a.actor?.id === userId), taskActivity.message)
    check('list_activity names the agent', taskActivity.data.items?.every((a: Loose) => a.agent === CLIENT_NAME),
      taskActivity.data.items)
    // This run wrote at least two rows on the task itself (create, then the
    // status change), so a limit of 1 must report more.
    check('list_activity sets hasMore when the limit cuts rows off',
      taskActivity.data.items?.length === 1 && taskActivity.data.hasMore === true
        && !('nextCursor' in taskActivity.data), taskActivity.data)
    const allTaskActivity = await callTool(accessToken, 'list_activity', { targetId: created.taskId, limit: 100 })
    check('list_activity hasMore is false once everything fits',
      allTaskActivity.ok && allTaskActivity.data.hasMore === false, allTaskActivity.data.hasMore)
    const windowed = await callTool(accessToken, 'list_activity', {
      targetId: created.taskId, since: new Date(Date.now() - 60 * 60 * 1000).toISOString(), limit: 100,
    })
    check('list_activity narrows by since',
      windowed.ok && windowed.data.items.length === allTaskActivity.data.items?.length, windowed.message)
    const beforeRun = await callTool(accessToken, 'list_activity', {
      targetId: created.taskId, until: '2000-01-01', limit: 100,
    })
    check('list_activity narrows by until', beforeRun.ok && beforeRun.data.items.length === 0, beforeRun.message)

    const leadActivity = await callTool(accessToken, 'list_activity', { targetType: ['LEAD'], limit: 5 })
    check('list_activity filters by target type',
      leadActivity.ok && leadActivity.data.items.every((a: Loose) => a.target?.type === 'LEAD'), leadActivity.message)

    const recent = await callTool(accessToken, 'recent_activity', {
      since: new Date(Date.now() - 60 * 60 * 1000).toISOString(), source: 'MCP', actor: userId, limit: 50,
    })
    check('recent_activity returns this run\'s writes, oldest first',
      recent.ok && recent.data.items.some((a: Loose) => a.target?.id === created.leadId)
        && recent.data.items.every((a: Loose, i: number, all: Loose[]) => i === 0 || all[i - 1].occurredAt <= a.occurredAt),
      recent.message)
    const backwards = await callTool(accessToken, 'recent_activity', { since: '2026-02-02', until: '2026-02-01' })
    check('recent_activity refuses an inverted window', !backwards.ok, backwards.message)

    console.log('\nAssignment (staff only, any role)')
    const clientRef = clientUser.email
    const assignChecks: [string, Record<string, unknown>][] = [
      ['create_task', { project: project.slug, title: 'Must not be created (CLIENT assignee)', assigneeIds: [clientRef] }],
      ['update_task', { taskId: created.taskId, assigneeIds: [EMAIL, clientUser.id] }],
      ['create_lead', { name: 'Must not be created (CLIENT assignee)', assignee: clientRef }],
      ['update_lead', { leadId: created.leadId, assignee: clientUser.id }],
    ]
    for (const [name, args] of assignChecks) {
      const result = await callTool(accessToken, name, args)
      check(`an admin cannot assign a CLIENT user with ${name}`,
        !result.ok && /no assignable staff user matches/i.test(result.message ?? ''), result.message)
    }
    const cliHeaders = { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' }
    const cliLead = await fetch(`${BASE_URL}/api/cli/v1/leads`, {
      method: 'POST', headers: cliHeaders,
      body: JSON.stringify({ name: 'Must not be created (CLIENT assignee)', assignee: clientRef }),
    })
    check('the CLI cannot assign a CLIENT user to a lead', cliLead.status === 404, cliLead.status)
    const cliTask = await fetch(`${BASE_URL}/api/cli/v1/tasks`, {
      method: 'POST', headers: cliHeaders,
      body: JSON.stringify({ project: project.slug, title: 'Must not be created (CLIENT assignee)', assigneeIds: [clientRef] }),
    })
    check('the CLI cannot assign a CLIENT user to a task', cliTask.status === 404, cliTask.status)
    const leftovers = [
      ...await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.title, 'Must not be created (CLIENT assignee)')),
      ...await db.select({ id: leads.id }).from(leads).where(eq(leads.contactName, 'Must not be created (CLIENT assignee)')),
    ]
    check('refused assignments wrote nothing', leftovers.length === 0, leftovers.length)
    const keptAssignees = await callTool(accessToken, 'get_task', { taskId: created.taskId })
    check('a refused reassignment keeps the old assignees',
      JSON.stringify(keptAssignees.data.task?.assigneeIds) === JSON.stringify([userId]), keptAssignees.data.task?.assigneeIds)
    const clientFilter = await callTool(accessToken, 'list_leads', { assignee: clientUser.email, limit: 1 })
    check('an admin can still filter leads by any user (read filters keep their behaviour)', clientFilter.ok, clientFilter.message)

    check('every timestamp in tool output is ISO 8601', nonIsoTimestamps.size === 0,
      [...nonIsoTimestamps])

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

    console.log('\nSALES (the portal CRM: leads, contacts and their activity)')
    salesUser = await createTestUser('SALES', 'SALES', profiles)
    const sales = (await authorizeAs(discovery, salesUser.email, salesUser.password)).accessToken

    const salesList = await rpc(sales, 'tools/list')
    check('a SALES token is admitted (tools/list answers 200)', salesList.status === 200, salesList.status)

    const salesWho = await callTool(sales, 'whoami')
    check('whoami acts as the SALES user', salesWho.ok && salesWho.data.user?.email === salesUser.email
      && salesWho.data.user?.role === 'SALES', salesWho.message)

    // Everything the portal keeps behind requireUser() / assertAdmin().
    const prepaidRef = clients.data.items?.[0]?.slug ?? clients.data.items?.[0]?.id ?? 'acme'
    const denied: [string, Record<string, unknown>][] = [
      ['list_clients', {}],
      ['get_client', { client: prepaidRef }],
      ['list_projects', {}],
      ['get_project', { project: project.slug }],
      ['list_tasks', {}],
      ['list_tasks', { lead: created.leadId }],
      ['get_task', { taskId: created.taskId }],
      ['create_task', { leadId: created.leadId, title: 'SALES must not create this' }],
      ['update_task', { taskId: created.taskId, status: 'DONE' }],
      ['add_task_comment', { taskId: created.taskId, body: 'SALES must not post this.' }],
      ['list_time_logs', {}],
      ['list_invoices', {}],
      ['get_invoice', { invoiceId: firstInvoice?.id ?? '00000000-0000-4000-8000-000000000000' }],
      ['list_hour_blocks', {}],
      ['get_client_hour_balance', { client: prepaidRef }],
      ['get_monthly_close', { year: lastMonth.getUTCFullYear(), month: lastMonth.getUTCMonth() + 1 }],
    ]
    for (const [name, args] of denied) {
      const result = await callTool(sales, name, args)
      check(`SALES is refused ${name}${Object.keys(args).length ? ` (${Object.keys(args).join(', ')})` : ''}`,
        !result.ok && /available to admin users only/.test(result.message ?? '')
          && Object.keys(result.data).length === 0, result.message)
    }

    const taskAfter = await callTool(accessToken, 'get_task', { taskId: created.taskId })
    check('refused task writes changed nothing', taskAfter.data.task?.status === 'IN_PROGRESS'
      && taskAfter.data.comments?.length === 1, taskAfter.data.task?.status)
    const salesTasks = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.title, 'SALES must not create this'))
    check('refused create_task wrote no task', salesTasks.length === 0, salesTasks.length)

    // Leads: SALES sees the whole board, as on /leads.
    const salesLeads = await callTool(sales, 'list_leads', { search: 'MCP Smoke Test', limit: 5 })
    check('SALES list_leads sees the board', salesLeads.ok && salesLeads.data.items.some((l: Loose) => l.id === created.leadId),
      salesLeads.message)
    const salesLead = await callTool(sales, 'get_lead', { leadId: created.leadId })
    check('SALES get_lead returns the lead and its timeline', salesLead.ok && salesLead.data.updates?.length === 1,
      salesLead.message)

    const salesCreate = await callTool(sales, 'create_lead', {
      name: 'MCP Smoke Test (sales)', company: 'test-mcp.ts', assignee: salesUser.email,
    })
    created.salesLeadId = salesCreate.data.lead?.id
    check('SALES create_lead creates and self-assigns', salesCreate.ok && salesCreate.data.lead?.assigneeId === salesUser.id,
      salesCreate.message)
    const reassigned = await callTool(sales, 'update_lead', {
      leadId: created.salesLeadId, status: 'PROPOSAL_SENT', assignee: EMAIL,
    })
    check('SALES update_lead moves the stage and assigns to CRM staff',
      reassigned.ok && reassigned.data.lead?.status === 'PROPOSAL_SENT' && reassigned.data.lead?.assigneeId === userId,
      reassigned.message)
    const salesLogged = await callTool(sales, 'add_lead_update', {
      leadId: created.salesLeadId, type: 'EMAIL', body: 'Smoke test email (sales).',
    })
    check('SALES add_lead_update logs the entry', salesLogged.ok && Boolean(salesLogged.data.update?.id), salesLogged.message)
    const byOwner = await callTool(sales, 'list_leads', { assignee: EMAIL, limit: 100 })
    check('SALES list_leads filters by a CRM owner email',
      byOwner.ok && byOwner.data.items.some((l: Loose) => l.id === created.salesLeadId), byOwner.message)

    // Assignees resolve only to staff for everyone; read filters resolve only
    // CRM staff for SALES (the portal's lead assignee picker).
    const toClient = await callTool(sales, 'update_lead', { leadId: created.salesLeadId, assignee: clientUser.email })
    check('SALES cannot assign a lead to a CLIENT user', !toClient.ok && /no assignable staff user matches/i.test(toClient.message ?? ''),
      toClient.message)
    const byClient = await callTool(sales, 'list_leads', { assignee: clientUser.id })
    check('SALES cannot resolve a CLIENT user as a lead owner', !byClient.ok && /no active user matches/i.test(byClient.message ?? ''),
      byClient.message)

    // list_users: CRM staff only for SALES.
    const [adminUsers, salesUsers, salesClients, salesFind] = await Promise.all([
      callTool(accessToken, 'list_users', { role: 'CLIENT', limit: 100 }),
      callTool(sales, 'list_users', { limit: 100 }),
      callTool(sales, 'list_users', { role: 'CLIENT', limit: 100 }),
      callTool(sales, 'list_users', { search: clientUser.email, limit: 5 }),
    ])
    check('an admin list_users still sees CLIENT users',
      adminUsers.ok && adminUsers.data.items.some((u: Loose) => u.id === clientUser!.id), adminUsers.message)
    check('SALES list_users lists only admin and sales staff',
      salesUsers.ok && salesUsers.data.items.length > 0
        && salesUsers.data.items.every((u: Loose) => ['ADMIN', 'SALES'].includes(u.role))
        && salesUsers.data.items.some((u: Loose) => u.id === salesUser!.id), salesUsers.message)
    check('SALES list_users finds no CLIENT user by role or search',
      salesClients.ok && salesClients.data.items.length === 0 && salesFind.ok && salesFind.data.items.length === 0,
      [salesClients.data.items?.length, salesFind.data.items?.length])

    // Contacts: read-only, with the contacts page's client filter.
    const salesContacts = await callTool(sales, 'list_contacts', { limit: 3 })
    check('SALES list_contacts returns items', salesContacts.ok && Array.isArray(salesContacts.data.items), salesContacts.message)
    if (firstContact) {
      const salesContact = await callTool(sales, 'get_contact', { contactId: firstContact.id })
      check('SALES get_contact returns the contact and its client links',
        salesContact.ok && salesContact.data.contact?.id === firstContact.id && Array.isArray(salesContact.data.clients),
        salesContact.message)
    }
    const linkedClient = (contacts.data.items ?? []).flatMap((c: Loose) => c.clients ?? [])[0]
    if (linkedClient) {
      const ref = linkedClient.slug ?? linkedClient.id
      const [asAdmin, asSales] = await Promise.all([
        callTool(accessToken, 'list_contacts', { client: ref, limit: 100 }),
        callTool(sales, 'list_contacts', { client: ref, limit: 100 }),
      ])
      check('SALES list_contacts filters by client exactly as an admin sees it',
        asSales.ok && asAdmin.ok && JSON.stringify(asSales.data.items.map((c: Loose) => c.id))
          === JSON.stringify(asAdmin.data.items.map((c: Loose) => c.id)), asSales.message)
    }

    // Activity: LEAD and CONTACT only, named by targetType, never by project
    // or client (`canReadActivity`).
    const salesLeadActivity = await callTool(sales, 'list_activity', {
      targetType: ['LEAD', 'CONTACT'], since: new Date(Date.now() - 60 * 60 * 1000).toISOString(), limit: 100,
    })
    check('SALES list_activity reads lead and contact activity only',
      salesLeadActivity.ok && salesLeadActivity.data.items.length > 0
        && salesLeadActivity.data.items.every((a: Loose) => ['LEAD', 'CONTACT'].includes(a.target?.type)),
      salesLeadActivity.message)
    const ownActivity = await callTool(sales, 'list_activity', {
      targetType: ['LEAD'], targetId: created.salesLeadId, source: 'MCP', actor: salesUser.email, limit: 100,
    })
    check('SALES list_activity filters by target, source and actor',
      ownActivity.ok && ownActivity.data.items.length >= 3 && ownActivity.data.items.every((a: Loose) =>
        a.actor?.id === salesUser!.id && a.source === 'MCP' && a.agent === CLIENT_NAME), ownActivity.message)
    const taskViaLead = await callTool(sales, 'list_activity', { targetType: ['LEAD'], targetId: created.taskId })
    check('SALES cannot reach task activity through a lead filter', taskViaLead.ok && taskViaLead.data.items.length === 0,
      taskViaLead.data.items?.length)
    const activityDenied: [string, Record<string, unknown>][] = [
      ['no targetType', { targetId: created.taskId }],
      ['targetType TASK', { targetType: ['TASK'] }],
      ['LEAD plus TASK', { targetType: ['LEAD', 'TASK'] }],
      ['a project', { targetType: ['LEAD'], project: project.slug }],
      ['a client', { targetType: ['LEAD'], client: prepaidRef }],
    ]
    for (const [label, args] of activityDenied) {
      const result = await callTool(sales, 'list_activity', args)
      check(`SALES list_activity is refused with ${label}`,
        !result.ok && /lead and contact activity only/.test(result.message ?? '') && Object.keys(result.data).length === 0,
        result.message)
    }

    // recent_activity: LEAD and CONTACT only, by default or by name.
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const salesRecent = await callTool(sales, 'recent_activity', { since: hourAgo, limit: 500 })
    check('SALES recent_activity defaults to lead and contact activity',
      salesRecent.ok && salesRecent.data.items.some((a: Loose) => a.target?.id === created.salesLeadId)
        && salesRecent.data.items.every((a: Loose) => ['LEAD', 'CONTACT'].includes(a.target?.type)), salesRecent.message)
    const adminRecent = await callTool(accessToken, 'recent_activity', { since: hourAgo, limit: 500 })
    check('an admin recent_activity still sees task activity',
      adminRecent.ok && adminRecent.data.items.some((a: Loose) => a.target?.id === created.taskId), adminRecent.message)
    const salesRecentLeads = await callTool(sales, 'recent_activity', { since: hourAgo, targetType: ['LEAD'], actor: salesUser.email })
    check('SALES recent_activity filters by target type and actor',
      salesRecentLeads.ok && salesRecentLeads.data.items.length > 0 && salesRecentLeads.data.items.every((a: Loose) =>
        a.target?.type === 'LEAD' && a.actor?.id === salesUser!.id), salesRecentLeads.message)
    for (const targetType of [['TASK'], ['LEAD', 'PROJECT']]) {
      const result = await callTool(sales, 'recent_activity', { since: hourAgo, targetType })
      check(`SALES recent_activity is refused with targetType ${targetType.join(' + ')}`,
        !result.ok && /lead and contact activity only/.test(result.message ?? '') && Object.keys(result.data).length === 0,
        result.message)
    }

    const salesRows = created.salesLeadId
      ? await db.select().from(activityLogs).where(eq(activityLogs.targetId, created.salesLeadId))
      : []
    check('SALES writes are attributed to the SALES user, via MCP',
      salesRows.length >= 2 && salesRows.every(row => row.source === 'MCP' && row.actorId === salesUser!.id
        && row.actorRole === 'SALES' && (row.metadata as { agent?: { name?: string } })?.agent?.name === CLIENT_NAME),
      salesRows.map(row => [row.source, row.actorRole]))
    check('every timestamp in SALES tool output is ISO 8601', nonIsoTimestamps.size === 0, [...nonIsoTimestamps])
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

    if (created.salesLeadId) {
      const updateIds = (await db.select({ id: leadUpdates.id }).from(leadUpdates)
        .where(eq(leadUpdates.leadId, created.salesLeadId))).map(row => row.id)
      await db.delete(activityLogs).where(inArray(activityLogs.targetId, [created.salesLeadId, ...updateIds]))
      await db.delete(leads).where(eq(leads.id, created.salesLeadId))
    }

    if (salesUser) {
      await deleteTestUser(salesUser, profiles)
    }

    if (clientUser) {
      await deleteTestUser(clientUser, profiles)
    }

    await deleteRegisteredClients()

    console.log('  removed test rows, the test users and the OAuth clients')
  }

  console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.')
  process.exit(failures ? 1 : 0)
}

main().catch(async error => {
  console.error(error)
  await deleteRegisteredClients().catch(() => {})
  process.exit(1)
})
