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
