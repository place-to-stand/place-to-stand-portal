# PRD 009 — PTS MCP server (internal, admin-only v1)

**Status:** Built on the branch (PR #274). Implementation notes are at the end.
**Created:** 2026-10-19
**Branch:** `feat/mcp-server`
**Repos touched:** `place-to-stand-portal` only

---

## Why this exists

We want Claude — in claude.ai Projects and in the cloud environments we build client projects in —
to read and act on the business database directly: pull a client's hours and contacts, find and
update tasks, create tasks, and work leads. The `pts` CLI (`packages/cli`, `/api/cli/v1`) already
proved the data contract, but it only runs where a shell and a loopback browser login exist.
claude.ai cannot run it.

An MCP server hosted by the internal portal gives claude.ai and Claude Code the same capabilities
through a remote connector with proper OAuth, and attributes every write to both the human who
connected it and the agent that made the call.

This is internal first. A client-facing version (clients asking about their own projects and
engagement standing) is explicitly out of scope until this one proves useful.

## Decisions (Kris, 2026-10-19)

| # | Decision |
| --- | --- |
| D1 | **Hosted on Vercel, inside `apps/internal`**, as a route next to the data layer — not a separate Cloudflare service. |
| D2 | **Proper OAuth from day one**, so it works as a claude.ai custom connector. No static tokens. |
| D3 | **The agent acts on the connecting user's behalf**, and writes record both the human and the agent. |
| D4 | **Reads plus a fixed set of writes**: tasks (create, update), task comments, leads (create, edit, move stage, log updates). Clients and contacts are read-only. |
| D5 | **No time logging.** Hours stay a manual human process because they feed the shared bank account / profit share. Time logs are readable (`list_time_logs`, revised 2026-10-26). |
| D6 | **ADMIN only for v1.** SALES is not admitted yet, but the tool registry is role-aware so admitting SALES to the CRM tools later is a config change, not a redesign. |
| D7 | **Users manage their connected apps in Settings > Integrations**, alongside their Vercel / Supabase / GitHub connections. |
| D8 | **Client-facing MCP is deferred.** Nothing in v1 is exposed to CLIENT users. |

**Answered during the build (Kris, 2026-10-20)**

| # | Decision |
| --- | --- |
| D9 | **Billing is read-only** (was Q1; revised 2026-10-26, which reversed "no invoices in v1, not even read-only"). Invoices, hour blocks and the monthly close are readable; nothing creates, sends, voids or closes them. The monthly close never calls Mercury: a closed month is served from its snapshot, and an open month's profit share is reported unavailable. |
| D10 | **`list_tasks` matches the CLI** (was Q2): every project, other admins' PERSONAL projects included. |
| D11 | **Agent attribution lives in the activity log only** (was Q4). No column on `task_comments` or `tasks`. |
| D13 | **Hard allow-list of redirect hosts at consent** (was Q3): codes go only to `https://claude.ai`, `https://claude.com` or a loopback address (Claude Code, MCP Inspector). The security review found an MCP access token is a full Supabase session for the admin, so warn-and-allow would let a phished click hand an attacker the account. |
| D14 | **Timestamps in CLI and MCP output are ISO 8601 UTC** (`isoTimestamp`, `lib/cli/serializers/timestamp.ts`), matching what `occurredAt` input takes. Date-only fields stay `YYYY-MM-DD`. |
| D15 | **The connected-apps card ships in this PR** (§6), so an admin can revoke without the Supabase dashboard. |
| D12 | **One PostHog event per tool call:** `mcp.tool_call`, dot style like the other server events, with properties `tool`, `outcome` (`ok` / `error`), `error_code`, `duration_ms`, `agent_name`. `distinct_id` is the user id. |

## Non-goals

- Client-portal or CLIENT-role access of any kind.
- Time-log writes, invoice writes, hour-block writes, closing or reopening a month.
- Archive, restore or delete of any entity.
- Lead conversion, client-update emails, portal account management.
- A local stdio MCP or an MCP wrapper around the `pts` binary.

## Design

### §1 Shape

```
claude.ai / Claude Code ──HTTP (streamable, stateless)──▶ apps/internal  /api/mcp
        │                                                    │
        │ OAuth 2.1 (discovery, DCR, PKCE)                   ├─ resolve principal (§3)
        ▼                                                    ├─ tool registry (§4)
Supabase Auth OAuth server ◀── consent UI: /oauth/consent    └─ lib/cli/* + lib/data + serializers
```

- One route: `apps/internal/app/api/mcp/route.ts`, built with Vercel's `mcp-handler` (chosen in
  the spike), running stateless so any function instance can serve any request.
- Tools call the same modules the CLI routes use (`lib/cli/tasks.ts`, `lib/cli/leads.ts`,
  `lib/cli/queries/`, `lib/cli/serializers/`). **The MCP never calls `/api/cli/v1` over HTTP.**
- The serializers stay the contract. Tool output is the serializer's camelCase shape, so an
  agent that learned the CLI learns nothing new.

### §2 OAuth: Supabase Auth as the authorization server

Supabase Auth ships an OAuth 2.1 server with dynamic client registration aimed at MCP clients.
`supabase/config.toml` already has the (disabled) `[auth.oauth_server]` block. We use it rather
than writing our own token endpoints.

- **Enable** `[auth.oauth_server]` locally with `allow_dynamic_registration = true` and
  `authorization_url_path = "/oauth/consent"`; mirror in the hosted projects' dashboards.
- **Discovery.** `/api/mcp` answers unauthenticated requests with `401` +
  `WWW-Authenticate: Bearer resource_metadata=…`. The portal serves
  `/.well-known/oauth-protected-resource/api/mcp` (RFC 9728 puts the resource path after the
  well-known segment) pointing at the Supabase project as its authorization server, which publishes `/.well-known/oauth-authorization-server/auth/v1`.
- **Consent page** `apps/internal/app/(auth)/oauth/consent/page.tsx`: requires a signed-in
  ADMIN (redirects to `/sign-in` and back, preserving the authorization request), shows the
  client name, redirect host and what it will be able to do, and approves or denies through the
  Supabase OAuth API. A non-ADMIN sees a refusal, never an approve button. This is UI only:
  Supabase's approve endpoint accepts any signed-in user, so the token check on `/api/mcp` (§3)
  is the real gate, and the smoke test proves it by approving as a SALES user directly.
- **Redirect URI guard (D13).** DCR lets any client register with any redirect URI. The consent
  page and its server action both refuse any redirect outside the allow-list in
  `lib/mcp/redirects.ts`, so an authorization code can only reach Claude or the admin's machine.
- **The token is a full session.** A Supabase OAuth access token is an ordinary user session
  with a `client_id` claim: whoever holds it can call Supabase Auth as the user (change their
  password, edit `user_metadata`). PostgREST is closed (migration 0073 revoked the grants), but
  the token is still a credential for the whole account, which is why D13 is a hard list.
- **Proxy allowlist.** `/api/mcp` and `/.well-known/oauth-protected-resource` join the `proxy.ts`
  allowlist. As with `/api/cli/`, the route must authenticate itself — there is no edge fallback.

### §3 Principal resolution and attribution

Generalise `resolveCliUser` (`lib/cli/auth.ts`) into a shared resolver that both `withCliAuth`
and the MCP route call:

```ts
type ApiPrincipal = {
  user: AppUser              // the human; same AppUser the rest of the app uses
  channel: 'CLI' | 'MCP'
  agent: { clientId: string; name: string } | null   // MCP only, from the token's client_id
}
```

- Same checks as the CLI: valid Supabase JWT, not `must_reset_password`, active profile,
  `role === 'ADMIN'`.
- MCP tokens are OAuth-issued, so they carry a `client_id`; the resolver looks up the registered
  client's name (cached per instance). A token *without* a `client_id` is rejected on `/api/mcp`,
  so a CLI session token cannot be replayed against the MCP.
- **Attribution follows the CLI precedent.** CLI writes log `activity_logs.source = 'CLI'` with
  `actor_id` = the human. MCP writes log:
  - `source = 'MCP'` — new value on the `activity_source` enum (migration via `db:generate`).
  - `actor_id` / `actor_role` = the human.
  - `metadata.agent = { clientId, name }` — the agent.
- The activity feed (`components/activity/activity-feed-item.tsx`, which already labels `CLI`)
  renders MCP rows with an **MCP** badge and **"via {client name}"** (e.g. "via Claude Code"). The human half falls back to the email when
  `fullName` is empty.
- Task comments and created tasks keep `author` / `created_by` = the human. The agent half of the
  attribution lives in the activity log, not new columns on every table (D11).

### §4 Tool registry

Each tool declares its input (Zod), its required access, and MCP annotations
(`readOnlyHint`, `destructiveHint: false`, `idempotentHint`) so claude.ai can decide when to ask
for confirmation.

```ts
type ToolAccess = 'admin' | 'crm'   // 'crm' = assertCrmAccess (ADMIN or SALES)
```

v1 admits ADMIN only (D6), but tools are tagged so SALES can later be let into `crm` tools by
changing the resolver's role check alone.

**Reads**

| Tool | Access | Backs onto |
| --- | --- | --- |
| `whoami` | admin | `/api/cli/v1/whoami` logic |
| `list_clients` / `get_client` | admin | client serializer (includes hours balance, §5) + contacts + projects |
| `list_contacts` / `get_contact` | crm | contact serializer |
| `list_projects` / `get_project` | admin | project serializer (slug or UUID) |
| `list_tasks` / `get_task` | admin | task serializer, filters: project, lead, status, assignee |
| `list_leads` / `get_lead` | crm | lead serializer + recent lead updates |
| `list_users` | admin | user serializer (for resolving assignees and owners) |
| `list_activity` / `recent_activity` | crm / admin | `fetchActivityLogs` / `fetchActivityLogsSince`, filters: target, project, client, source, actor, since/until (`recent_activity`: one time window, oldest first, `truncated` flag) |
| `list_time_logs` | admin | `listTimeLogs`, filters: project, user, work-date range; `totalCount` / `totalHours` over every match (D5) |
| `list_invoices` / `get_invoice` | admin | invoice serializer, filters: client, status, text; no share token or Stripe ids (D9) |
| `list_hour_blocks` / `get_client_hour_balance` | admin | hour-block queries, filters: client, text; + client hours totals (D9) |
| `get_monthly_close` | admin | `fetchMonthlyCloseForAgent`: snapshot or live, never Mercury, no bank account identifiers (D9) |

**Writes**

| Tool | Access | Backs onto |
| --- | --- | --- |
| `create_task` | admin | `lib/cli/tasks.ts` create path |
| `update_task` | admin | status, title, description, assignees, due date, project |
| `add_task_comment` | admin | CLI comment path (same markdown subset and escaping) |
| `create_lead` | crm | `lib/cli/leads.ts` create path |
| `update_lead` | crm | fields + stage move (writes `lead_stage_history`) |
| `add_lead_update` | crm | CLI lead-updates path (calls, emails, texts, meetings) |

Writes run the same validation, `ensure*Access` checks and activity logging as the CLI routes.
Where a CLI route has that logic inline, it is lifted into `lib/cli/` first so both channels share
one implementation.

**Output bounds.** List tools take a `limit` (default 25, max 100) and return `{ items, hasMore }`;
`hasMore` tells the agent to narrow its filters rather than page. List results truncate long
rich-text fields to a preview with a marker pointing at the `get_*` tool, so a large project
cannot flood the model's context.

### §5 Client hours

"Client hours" means the balance only — hours remaining on a prepaid client — not the client
portal's full Hours view. Nothing new is needed: the CLI client serializer
(`lib/cli/serializers/client.ts`) already returns `totalHoursPurchased`, `totalHoursUsed` and
`hoursRemaining`, computed by the same `getClientHoursTotals` in `@pts/db/hours` that the client
portal uses, so the two can never disagree. `list_clients` and `get_client` return it as-is.
`hoursRemaining` can go negative when a client is over their purchased hours; net_30 clients have
no meaningful balance.

### §6 Connected apps (Settings > Integrations)

A "Connected AI apps" card on `settings/integrations` lists the signed-in user's OAuth grants
(client name, first authorised, last used) with a **Revoke** action, using the Supabase OAuth
grant APIs (`listGrants`, `revokeGrant`, run with the user's own session). Revoking deletes the
app's sessions, and `/api/mcp` checks the session on every call (`auth.getUser`), so access ends
at once rather than when the access token expires. Local Supabase needs a newer auth server for the
grant endpoints (the CLI pinned `v2.180.0`, which 404s).

### §7 Observability

- Every tool call logs one PostHog server-side event, `mcp.tool_call` (D12).
- Unhandled errors go through `captureException`; tool errors return a generic message, never a
  driver message (same rule as `withCliAuth`).

### §8 Spike before building (half a day)

Prove the unknowns end to end with one read tool (`whoami`) before writing the rest:

1. Local Supabase OAuth server: DCR, consent redirect, token issue.
2. Supabase OAuth access token validates with `auth.getUser(token)` and exposes `client_id`.
3. Grant listing / revocation API is available for §6.
4. `mcp-handler` vs SDK transport on Next 16 / Fluid compute.
5. Claude Code connects to `localhost` and calls `whoami`.

Any "no" here changes §2, §3 or §6 and gets written back into this PRD before implementation.

## Testing

All pre-deploy testing is local. There is no hosted or claude.ai test before launch: this is
internal, nothing is reachable until an admin adds the connector, and fixes ship as normal pushes.
The first production connection is the end-to-end check (Rollout step 4).

**Setup:** `supabase/config.toml` now enables the OAuth server and dynamic registration locally;
restart Supabase once (`supabase stop && supabase start`) after pulling, then run `npm run dev`
(internal on :3000).

1. **MCP Inspector — the build loop.** `npx @modelcontextprotocol/inspector`, pointed at
   `http://localhost:3000/api/mcp`. Runs the real OAuth flow (discovery → DCR → consent → token),
   lists tools with their schemas and annotations, and calls each one by hand with the raw
   response visible.
2. **Scripted smoke test.** `apps/internal/scripts/test-mcp.ts`, run with `tsx` from
   `apps/internal` (`MCP_TEST_EMAIL=… MCP_TEST_PASSWORD=… npx tsx scripts/test-mcp.ts`). Runs the
   real OAuth flow with plain JSON-RPC over `fetch`, then calls every tool against local data,
   asserting:
   - result shapes match the serializers;
   - each write logs `activity_logs.source = 'MCP'` with `actor_id` = the human and
     `metadata.agent` set;
   - a SALES user's token, a reset-pending admin's token, a CLI token (no `client_id`) and no
     token are all rejected. The script creates the two throwaway users and deletes them.

   It deletes everything it wrote, including its OAuth clients.
3. **Claude Code against localhost.**
   `claude mcp add --transport http pts-local http://localhost:3000/api/mcp`, then `/mcp` to sign
   in. First test with a real model picking tools, so it checks that tool names, descriptions and
   input schemas lead to the right calls, and that write confirmations appear. No tunnel needed.

## Rollout

1. Migration (`activity_source` + `MCP`) applies with the normal prod `db:migrate:prod` step.
2. Enable the OAuth server and DCR on the hosted Supabase project; set the authorization path.
3. Deploy. Nothing is reachable until an ADMIN adds the connector in claude.ai.
4. **Prod smoke test (the end-to-end check).** Kris adds the connector in claude.ai, completes
   consent, and calls `whoami`, one read and one write. This is the first time Anthropic's servers
   are the caller, so it is where hosted-only misconfiguration shows up: the hosted Supabase OAuth
   server settings, redirect URLs, and the `/.well-known/oauth-protected-resource` document. Fix
   forward with a push.
5. Kris dogfoods for a week before other admins are told about it.

**Rollback:** disable the OAuth server in Supabase (no new grants, refresh fails) and remove
`/api/mcp` from the proxy allowlist. No data migration to undo.

## Open questions

Q1–Q4 are answered (D9–D11, D13).

| # | Question |
| --- | --- |
| Q6 | **Agent identity granularity** — the OAuth client ("Claude") is all we get from the token. Is that enough, or do we want an optional `agentLabel` argument on writes (e.g. "Claude Code — acme-site repo")? Either way the name is self-reported at registration (the spike connected as "Claude Code (pts-local)"), so it is a label for attribution, never something to authorize on. *v1 ships the client name only.* |

## Implementation notes (2026-10-20)

Where the build departs from the design above, or settles something it left open:

- **No cursors.** Lists cap at `limit` and return `hasMore` (§4).
- **Rich text comes back as stored HTML**, not markdown: the repo has no HTML-to-markdown
  converter. Writes still take the CLI's markdown subset, so agents write markdown and read HTML.
  List previews are the exception: they are converted to plain text before truncating, so a cut
  never leaves a tag open.
- **No archive, restore or delete** (Non-goals). `update_task` and `update_lead` say so in their
  descriptions and point at DONE, CLOSED_LOST / UNQUALIFIED, or the portal. Archived tasks are a
  soft delete (`deletedAt`), not a status value.
- **`crm`-tagged tools still need ADMIN underneath.** Contact and lead tools are tagged `crm`, but
  some helpers behind them (`listLeadsForCli`, `resolveUserIds`, `resolveClientIdentifier`) assert
  admin. Admitting SALES (D6) needs those opened up too; it is not yet the one-line change §4
  promised.
- **No shared `ApiPrincipal` type.** The CLI and MCP share `resolveAdminFromToken`
  (`lib/cli/auth.ts`); the MCP adds the agent in `lib/mcp/auth.ts`. Attribution reaches
  `logActivity` through a request-scoped context (`lib/activity/agent-context.ts`), so the
  shared write paths in `lib/cli/tasks.ts` and `lib/cli/leads.ts` take no agent parameter.
- **Write paths moved out of the CLI routes** into those two modules; the CLI routes are now thin
  wrappers over the same functions the MCP calls.
- **Consent page client name.** auth-js types the client as `{ name }`, but the local auth server
  returns `{ client_name }`; the page reads both.
- **Known rough edges from the first Claude Code test run**, not fixed in v1:
  - empty lead notes come back as `""` rather than `null`;
  - only `list_contacts` returns `totalCount`.
