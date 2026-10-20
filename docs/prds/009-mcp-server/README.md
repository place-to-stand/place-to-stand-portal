# PRD 009 — PTS MCP server (internal, admin-only v1)

**Status:** Draft, for audit (`/audit-prd`)
**Created:** 2026-10-19
**Branch:** not yet created
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
| D5 | **No time logging.** Hours stay a manual human process because they feed the shared bank account / profit share. |
| D6 | **ADMIN only for v1.** SALES is not admitted yet, but the tool registry is role-aware so admitting SALES to the CRM tools later is a config change, not a redesign. |
| D7 | **Users manage their connected apps in Settings > Integrations**, alongside their Vercel / Supabase / GitHub connections. |
| D8 | **Client-facing MCP is deferred.** Nothing in v1 is exposed to CLIENT users. |

## Non-goals

- Client-portal or CLIENT-role access of any kind.
- Time-log writes, invoice writes, hour-block writes.
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

- One route: `apps/internal/app/api/mcp/route.ts`, built with Vercel's `mcp-handler` (or the
  official `@modelcontextprotocol/sdk` streamable-HTTP transport — pick in the spike, §8), running
  stateless so any function instance can serve any request.
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
  `/.well-known/oauth-protected-resource` pointing at the Supabase project as its authorization
  server, which publishes `/.well-known/oauth-authorization-server/auth/v1`.
- **Consent page** `apps/internal/app/(auth)/oauth/consent/page.tsx`: requires a signed-in
  ADMIN (redirects to `/sign-in` and back, preserving the authorization request), shows the
  client name, redirect host and what it will be able to do, and approves or denies through the
  Supabase OAuth API. A non-ADMIN sees a refusal, never an approve button.
- **Redirect URI guard.** DCR lets any client register. The consent page shows the redirect host
  prominently, and we keep an allow-list of known hosts (claude.ai, claude.com, localhost for
  Claude Code / Inspector) that skip a "this app is not recognised" warning. Unknown hosts are
  allowed only after the warning — open question Q3.
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
  renders MCP rows as **"Kris via Claude"**. The human half falls back to the email when
  `fullName` is empty.
- Task comments and created tasks keep `author` / `created_by` = the human. The agent half of the
  attribution lives in the activity log, not new columns on every table — open question Q4.

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
| `list_tasks` / `get_task` | admin | task serializer, filters: project, status, assignee, due |
| `list_leads` / `get_lead` | crm | lead serializer + recent lead updates |
| `list_users` | admin | user serializer (for resolving assignees and owners) |

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

**Output bounds.** List tools page (default 25, max 100) and return a `nextCursor`; long rich-text
fields are converted to markdown and truncated with a marker, so a large project cannot flood
the model's context.

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
grant APIs. Revoking kills the refresh token; the current access token expires on its normal
schedule (Supabase default, ~1h) — documented on the card.

### §7 Observability

- Every tool call logs through PostHog server-side with the tool name, success / error code and
  duration — **event and property names to be agreed before implementation** (CLAUDE.md rule).
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

**Setup:** turn on the OAuth server locally (`[auth.oauth_server] enabled = true`,
`allow_dynamic_registration = true`, then `supabase stop && supabase start`) and run
`npm run dev` (internal on :3000).

1. **MCP Inspector — the build loop.** `npx @modelcontextprotocol/inspector`, pointed at
   `http://localhost:3000/api/mcp`. Runs the real OAuth flow (discovery → DCR → consent → token),
   lists tools with their schemas and annotations, and calls each one by hand with the raw
   response visible.
2. **Scripted smoke test.** `apps/internal/scripts/test-mcp.ts`, run with `tsx`, following
   `scripts/test-form-intake.ts`. Uses the MCP SDK client to connect, list tools and call every
   read and write against local data, asserting:
   - result shapes match the serializers;
   - each write logs `activity_logs.source = 'MCP'` with `actor_id` = the human and
     `metadata.agent` set;
   - a non-ADMIN token, a reset-pending user and a CLI token (no `client_id`) are all rejected.
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

| # | Question |
| --- | --- |
| Q1 | **Invoices** — read-only in v1 (status, amount, due) alongside client hours, or out entirely? |
| Q2 | **Task scope** — should `list_tasks` include PERSONAL projects of other admins, or only CLIENT / INTERNAL? |
| Q3 | **Unknown redirect hosts** at consent — warn-and-allow, or hard allow-list only? |
| Q4 | **Agent attribution on rows** — is the activity log enough, or do task comments need a visible "via Claude" marker in the task sheet itself (a column on `task_comments`)? |
| Q6 | **Agent identity granularity** — the OAuth client ("Claude") is all we get from the token. Is that enough, or do we want an optional `agentLabel` argument on writes (e.g. "Claude Code — acme-site repo")? Either way the name is self-reported at registration (the spike connected as "Claude Code (pts-local)"), so it is a label for attribution, never something to authorize on. |
