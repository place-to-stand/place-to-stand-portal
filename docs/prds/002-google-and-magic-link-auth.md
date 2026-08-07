# PRD 002 — Google + Magic Link Authentication

**Status:** Planned — awaiting review
**Apps:** `apps/client/`, `apps/internal/`, `supabase/config.toml`
**Depends on:** A Google OAuth client + the provider enabled in hosted Supabase (Kris)
**Blocks:** Client portal invoices — we confirm auth works before starting those

---

## Context

Client portal sign-in is email + password only. Accounts are admin-created in the internal app ("Create portal account"), which generates a temporary password and emails it in plaintext via `sendPortalInviteEmail`, with `must_reset_password: true` forcing a reset during onboarding.

Clients forget these passwords. We want two more ways in — **Continue with Google** and **email me a sign-in link** — so they don't have to remember anything. Google is being enabled on the Supabase project, which serves both apps, so both sign-in pages get it.

The invite email stays the single entry point to every account (D6), but stops carrying a password and carries a magic link instead (D2). What changes downstream: onboarding no longer assumes a password, and instead asks how they want to sign in from then on, attaching whichever credentials they pick to the one auth user created at invite time (D5).

## Decisions

| # | Decision |
|---|---|
| D1 | Google + magic link on **both** apps' sign-in pages. Password sign-in stays. |
| D2 | **Invite email carries a magic link, not a password.** A temp password is still generated at auth-user create so the account always has a password credential — but it is never disclosed to anyone. Onboarding offers to set a real one; if they go passwordless, the undisclosed value simply stays, and `/forgot-password` still works because the credential exists. See §6. |
| D3 | **Invite-only provisioning.** Portal access is granted by an admin promoting a contact, which creates the `auth.users` row (`create-user.ts:27`) *and* the `public.users` row (`:60`). `ensureUserProfile` stops auto-inserting. Authenticating without a `users` row signs you out and shows "account isn't set up". |
| D4 | Google works in local dev via `[auth.external.google]` in `config.toml` reading env vars. |
| D5 | **One auth user, many identities.** Password, magic link and Google are alternative doors into the *same* `auth.users` row — an OR, not a fork. A user may end up with one or several. Any flow that mints a **second** auth user for a person who already has one is a bug, not an acceptable variant. |
| D6 | **Email is the only entry point — client portal only (O1).** Every client account starts from the invite email; the sign-in method is chosen *afterwards*, during onboarding, and can be added to later. Google and magic link are ways back in for provisioned users, never first-time entry points for a stranger. Internal admins are out of scope: their accounts already exist and their temp-password + forced-reset flow stays as-is. |
| D7 | Mismatched Google email handled with `linkIdentity()` during onboarding, while already authenticated. |

## Resolved — earlier questions

- **Q1 — one auth user per person.** Settled by D5: this is now a requirement, not an assumption. What's still unknown is the *mechanism* — whether Supabase auto-links a Google identity to an existing auth user on a verified email match (our users are created `email_confirm: true`, which should satisfy it). **T1 decides which of two builds we do**, so it runs before any UI:
  - *Auto-links* → §5's linking step is convenience for the mismatched-email case only.
  - *Mints a second auth user* → auto-linking can't be relied on, `linkIdentity()` in §5 becomes the **only** way Google attaches, and §4's Google button must be presented as sign-in-for-existing-users rather than a general entry point. D6 already positions it that way, which limits the blast radius of a negative result.
- **Q2 — `must_reset_password`.** Superseded by D6. It stops meaning "you must set a password" and starts meaning "you haven't chosen how you sign in yet." Any of the three choices in §5 clears it.
- **Q3 — "account isn't set up" self-service.** No form, contact copy only. D3 and D6 leave no self-service path by design: if you weren't invited, there is nothing for you here.
- **Temp password in the client's inbox.** Closed by D2 — it is never sent, so there is nothing to rotate, expire, or nag about. The generated value stays on the account undisclosed, which is what keeps `/forgot-password` a working recovery path for passwordless clients. §6.

## Resolved — this round

- **O1 — scope D6 to the client portal only.** Admin accounts already exist and their flow stays as-is: settings-created ADMINs keep the temp-password email and `apps/internal/proxy.ts:62`'s forced reset. One correction rides along in the role branch — their email currently links to the *client* portal, which is a plain bug; see §6. §6 therefore **branches on role** — see below. Google and magic link still appear on internal's sign-in page (D1); what admins don't get is the §5 choice step. Richer admin auth flows are deliberate future work.
- **O2 — leave `otp_expiry = 3600`.** No config change. The invite email tells a client whose link has gone stale to request a fresh one from the sign-in page, which works because §4 puts magic link there and the account already exists.

## Production state — de-risks §2 and §6

**No client has portal access in production yet.** The client portal has no real users, which means:

- §6's invite change has **no existing clients to disrupt** — no one holds an old temp-password email whose behaviour changes underneath them.
- The `find-or-create-portal-user.ts:94` password-reset bug has **never fired against a real client**. Still fix it (it would bite the first re-promotion), but it is not an incident.
- §2's lockout risk narrows to **admins only**. T0 still runs against production — an orphaned *admin* auth user locks out the back office, which is worse than a client lockout, not better.

## Not in scope

- Removing password sign-in, `/forgot-password`, or `/force-reset-password`.
- Offering the sign-in-method choice to internal admins, or changing how admin accounts are invited (O1). Explicitly future work.
- Other OAuth providers; `[auth.external.apple]` stays disabled. MFA (present, disabled).
- Client portal invoices, top-up, reminder thresholds — separate PRDs.
- Restricting Google to specific email domains. Account unlinking / "manage connected accounts" UI.

---

## §1 — Supabase configuration

**Problem.** `supabase/config.toml` has no `[auth.external.google]` block at all (only a disabled Apple one). Enabling Google in the hosted dashboard covers deploys but **not local dev**. Three other settings block the plan: `enable_manual_linking = false` prevents `linkIdentity()`; `site_url` is `http://127.0.0.1:3000` with no `3001` anywhere, so the portal is unreachable as a redirect target; `[auth.rate_limit] email_sent = 2` means two emails per hour, which magic-link testing blows through in minutes.

**Google provider** — add alongside `[auth.external.apple]`:

```toml
[auth.external.google]
enabled = true
client_id = "env(SUPABASE_AUTH_GOOGLE_CLIENT_ID)"
secret = "env(SUPABASE_AUTH_GOOGLE_SECRET)"
# Supabase's own callback, NOT an app route. Both apps redirect here first,
# then Supabase redirects on to the app's /auth/callback.
redirect_uri = "http://127.0.0.1:54321/auth/v1/callback"
skip_nonce_check = false
```

The Google OAuth client needs `http://127.0.0.1:54321/auth/v1/callback` for local plus `https://<project-ref>.supabase.co/auth/v1/callback` for hosted.

**Manual linking** — `enable_manual_linking = true`. Without it `linkIdentity()` fails at runtime and §5 is dead.

**Redirect URLs:**

```toml
additional_redirect_urls = [
  "https://127.0.0.1:3000",
  "http://127.0.0.1:3000/auth/callback",
  "http://localhost:3000/auth/callback",
  "http://127.0.0.1:3001/auth/callback",
  "http://localhost:3001/auth/callback",
]
```

Both `127.0.0.1` and `localhost` because the apps are reached at `localhost:300x` in the browser while config uses `127.0.0.1` — Supabase treats these as distinct origins. **Hosted Supabase needs the production equivalents for both apps**, or redirects silently fall back to `site_url` and users land on the wrong app.

**Local email rate limit** — raise `email_sent` from `2` to `30` **for local only**. Don't raise it in hosted without thinking about abuse: the sign-in page lets an unauthenticated visitor trigger email to any address.

**Env vars** — add `SUPABASE_AUTH_GOOGLE_CLIENT_ID` / `SUPABASE_AUTH_GOOGLE_SECRET` to both `.env.example` files and local `.env.local`. These are read by the **Supabase CLI parsing `config.toml`, not by app code**, so they do *not* go in either `lib/env.server.ts` and do *not* need `turbo.json` entries.

**Verify:** `npx supabase stop && npx supabase start` boots clean; `curl -s http://127.0.0.1:54321/auth/v1/settings | jq '.external.google'` → `true`.

> **Gotcha.** `redirect_uri` in the Google block is Supabase's callback, not an app route. Getting it wrong produces `redirect_uri_mismatch` from Google, which reads like an app bug but is console configuration.

---

## §2 — Strict provisioning

**Problem.** `apps/internal/lib/auth/profile.ts:26` inserts a `users` row for any authenticated user who lacks one:

```ts
const DEFAULT_ROLE: UserRole = 'CLIENT'
...
if (!existing) {
  await db.insert(usersTable).values({ id: user.id, email: nextEmail, role: resolvedRole, ... })
  return
}
```

With `enable_signup = true` and Google live, **any Google account can self-provision a `users` row** by completing an OAuth flow and landing on internal's `/auth/callback`. Blast radius is *not* data access — internal requires `requireRole('ADMIN')`, the portal scopes on `client_members` — it's unbounded row creation in `users`, visible in the admin user list. Reachable the moment the provider goes live, before any button exists, so this ships with or before the provider.

Separately, the **client portal has the opposite failure**: `apps/client/lib/auth/session.ts` returns `null` for a missing row, so `requireUser()` redirects to `/sign-in` while the visitor is already signed in — an infinite loop. That becomes reachable as soon as §3 adds a callback.

**Verified safe to make strict:**

- `apps/internal/lib/settings/users/services/create-user.ts:60` inserts the `users` row explicitly — admin-created accounts never depended on `ensureUserProfile`.
- `session.ts:161` (`syncUserProfile`) only fires on email change, where the row exists.
- The password sign-in and `/auth/confirm` callers run for provisioned users.
- `auth.users` left-joined against `public.users` → **0 orphans locally** (verified). Must also be 0 in production before deploy — see T0.

**Change** — `ensureUserProfile` reports rather than creates:

```ts
export type EnsureProfileResult = 'ok' | 'not_provisioned'

export async function ensureUserProfile(user: User): Promise<EnsureProfileResult> {
  const existing = (await db.select({ ... }).from(usersTable)
    .where(eq(usersTable.id, user.id)).limit(1))[0]

  // Accounts are provisioned by an admin (create-user.ts inserts the row).
  // Authenticating is not enough to earn one — otherwise any Google account
  // could self-provision via the OAuth callback.
  if (!existing) return 'not_provisioned'

  // ...existing update-if-changed logic, unchanged...
  return 'ok'
}
```

The existing `metadataRole ?? existing?.role ?? DEFAULT_ROLE` order already prefers metadata then the existing row, so it can't downgrade an ADMIN. Leave that ordering alone.

**Update all four callers:**

| Caller | Change |
|---|---|
| `apps/internal/app/auth/callback/route.ts:36` | On `not_provisioned`: `await supabase.auth.signOut()`, redirect `/account-not-set-up` |
| `apps/internal/app/auth/confirm/route.ts:39` | Same |
| `apps/internal/app/(auth)/sign-in/actions.ts:85` | Same — a provisioned user can't hit this, but handle it rather than ignore the return |
| `apps/internal/lib/auth/session.ts:161` | Log only; do **not** sign out mid-request |

Signing out matters: without it the visitor holds a valid session resolving to no profile, and every request re-runs the redirect.

**New pages** — `apps/internal/app/(auth)/account-not-set-up/page.tsx` and `apps/client/app/(auth)/account-not-set-up/page.tsx`. Static, unauthenticated, no form (Q3):

> **This account isn't set up yet**
> We couldn't find a Place to Stand account for that email. If you're expecting access, contact your account manager and we'll get you set up.

Distinct from `/unauthorized`, which means *wrong role* rather than *no account* — don't merge them, or a real permission problem looks like a provisioning problem. **Deliberately vague**: identical copy for unknown and known-but-unprovisioned emails, so it isn't an enumeration oracle.

> **Risk.** Any orphaned auth user in production becomes an immediate lockout. Run T0 against production first.
> **Risk.** The return value is currently ignored at all four call sites; TypeScript won't flag unhandled cases. Check each one deliberately.

---

## §3 — Client portal auth callback

**Problem.** `apps/client` has **no auth callback route** — its only callback is `app/api/github/callback/route.ts`. Both magic link and Google redirect back with a PKCE `code` that must be exchanged server-side, and there's nowhere for it to land. Password auth needed none, which is why this gap exists.

**New file** — `apps/client/app/auth/callback/route.ts`. Path is **outside** the `(auth)` and `(portal)` route groups: inside `(portal)`, the layout's `requireClientUser()` runs first and redirects before the code is exchanged.

```ts
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const redirectTo = request.nextUrl.searchParams.get('redirect_to') ?? '/'

  if (!code) return NextResponse.redirect(new URL('/sign-in?error=missing_code', request.url))

  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.user) {
    console.error('Failed to exchange auth code for session', error)
    return NextResponse.redirect(new URL('/sign-in?error=exchange_failed', request.url))
  }

  // Invite-only: authenticating does not earn an account (§2).
  const [profile] = await db.select({ id: users.id }).from(users)
    .where(and(eq(users.id, data.user.id), isNull(users.deletedAt), isNull(users.disabledAt)))
    .limit(1)

  if (!profile) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/account-not-set-up', request.url))
  }

  // Relative paths only — prevents an open redirect via ?redirect_to=//evil.com
  const safePath =
    redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/'
  return NextResponse.redirect(new URL(safePath, request.url))
}
```

The `deletedAt` / `disabledAt` filters mirror `apps/client/lib/auth/session.ts` exactly — without them a disabled user exchanges a code, passes the callback, then gets rejected on the next request: a confusing half-signed-in state. The open-redirect guard is copied verbatim from internal's callback; keep it.

**Also add** `apps/client/app/auth/confirm/route.ts` mirroring internal's — reads `token_hash` + `type`, calls `verifyOtp`, then the same profile check. Needed because Supabase email templates may deliver `token_hash` rather than `code`. Restrict accepted `type` values to `magiclink`, `email`, `recovery` rather than passing the param through.

**Don't reuse `ensureUserProfile`** — it lives in the internal app and can't be imported. The check above is a deliberate read-only lookup; the portal has no reason to write to `users`.

> **Gotcha.** `getSupabaseServerClient` in the client app sets `autoRefreshToken: false` and swallows the RSC cookie-set error with a `console.warn`. Cookie writes work from a route handler, but if sessions seem not to persist, check that warn first.

---

## §4 — Sign-in methods on both apps

**Problem.** Both pages are password-only. `apps/client/app/(auth)/sign-in/page.tsx` is `'use client'`, calls `signInWithPassword` directly, then hard-navigates. `apps/internal/app/(auth)/sign-in/` uses a zod-validated server action with a `redirectTo` guard already in place. Internal's `/auth/callback` exists but nothing initiates a flow into it.

**Google** — client-side, since it needs a browser redirect:

```ts
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: `${window.location.origin}/auth/callback` },
})
```

On internal, append `?redirect_to=${encodeURIComponent(redirectTo)}` so the post-sign-in destination survives; the callback already validates it's relative.

**Magic link:**

```ts
await supabase.auth.signInWithOtp({
  email,
  options: {
    emailRedirectTo: `${window.location.origin}/auth/callback`,
    shouldCreateUser: false,   // ← required
  },
})
```

> **`shouldCreateUser: false` is not optional.** It defaults to `true`, which mints an `auth.users` row for any email typed into the box — the self-provisioning problem §2 closes, reintroduced one layer lower. §2 stops them getting a `users` row; this stops them getting an `auth.users` row at all.

**Don't leak account existence.** With `shouldCreateUser: false`, Supabase errors on unknown emails. Don't surface it — show the same confirmation either way:

> If an account exists for that email, we've sent a sign-in link. Check your inbox.

Log the real error server-side. Distinguishing the two turns the page into an enumeration oracle.

**Client layout** — Google and magic link first, divider, then the existing email + password form. All three always visible, no toggle: under D5 a given client may have any combination of the three, and the page can't know which without leaking account existence. Copy must read as *sign in*, never *sign up* — under D6 these are doors back into an account that already exists. The page uses raw `<input>` because the client app has no `input`/`label` primitives vendored; copying them from `apps/internal/components/ui/` needs no new npm packages, so no `package.json` edit. Optional — only if it doesn't balloon the change.

**Internal** — add the two buttons above the existing form in `sign-in-form.tsx`, which is already `'use client'`, so the server-action password path and the client-side methods coexist fine. Password path untouched.

**Rate limiting** — hosted Supabase enforces `email_sent` per hour. Disable the magic-link button for ~30s after a send and say so, or users hit an opaque failure.

> **Gotcha.** The client app's password path uses `window.location.href = '/'` rather than `router.push` so the server picks up the new cookie. Keep it — switching produces a stale-session bug that looks like sign-in silently failing.

---

## §5 — Choosing a sign-in method during onboarding

**Problem.** D6 says setup starts from the invite email and the client then picks how they sign in going forward. The wizard doesn't ask — `apps/client/components/onboarding/onboarding-wizard.tsx` is Welcome → Password (conditional) → Done, which *assumes* password and offers no alternative. A client who'd rather use Google or a link each time has no way to say so, and under D5 they must not go create a second account to get one.

Underneath sits the mismatched-email case: an admin invites `kris@company.com`; the client wants `kris@gmail.com`. Those addresses can't auto-link on any Supabase behaviour, so without an explicit step their `users` row, `client_members` links and hours stay stranded on the invited identity.

**Fix.** Replace the conditional password step with a **"How would you like to sign in?"** step. They arrive already authenticated — the invite magic link (§6) signed them in — and that existing session is what makes all three options safe to attach to the one auth user.

| Choice | Action | Result |
|---|---|---|
| Set a password | Existing `SetPasswordStep`, unchanged | `email` identity, password they chose |
| Connect Google | `linkIdentity({ provider: 'google' })` | `google` identity added to the **same** auth user, any address |
| Email me a link each time | No credential action | `email` identity, magic link only |

They are not exclusive (D5) — completing one leaves the others available later from the sign-in page. Whichever they pick, clear the flag:

```ts
await supabase.auth.updateUser({ data: { must_reset_password: false } })
```

`SetPasswordStep` already makes this exact call, so reuse it rather than writing a second path. `must_reset_password` lives in Supabase `user_metadata`, not the `users` table, and is read by `apps/client/app/onboarding/page.tsx`. Under D6 it now means *"hasn't chosen a sign-in method yet"* — leaving it set for the two passwordless choices strands those clients on the password step forever.

`onboarding_completed_at` on the `users` row is separate and already gates the `/onboarding` redirect. Don't conflate them.

**Linking call:**

```ts
await supabase.auth.linkIdentity({
  provider: 'google',
  options: { redirectTo: `${window.location.origin}/auth/callback?redirect_to=/onboarding` },
})
```

> **The wizard's step state is `useState` with no persistence.** `linkIdentity` does a full-page redirect to Google, so on return the wizard remounts at step 0 — the exact failure the removed GitHub step had. Derive the initial step from a URL param (`?step=choose-sign-in`) or `sessionStorage`. **Don't skip this**, or linking appears to do nothing.

> **Risk.** Manual linking lets a client attach *any* Google account to their portal user. That's the intent under D6, but it means a Google identity is not evidence of who someone is — anything that later trusts email identity must read the `users` row, not the OAuth identity.
> **Risk.** If T1 is negative, this step is the only way Google ever attaches, so it moves from "nice to have" to load-bearing — build it before shipping §4's Google button, not after.
> **Note.** "Set a password" is genuinely optional now. A client who skips it keeps the undisclosed generated credential from §6, so `/forgot-password` remains a working way in if they later lose access to their email or Google account.

---

## §6 — Invite email becomes a magic link

**Problem.** `apps/internal/lib/email/send-portal-invite.ts:28` and `:46` put the temp password in the email body, in both the text and HTML parts. That makes every invite a permanent plaintext credential living in the client's inbox and in Resend's message logs. It also hard-codes the assumption that password is *the* way in, which D6 replaces.

**Two creation paths send it. Under O1 only the client one changes:**

| Path | Roles | Change |
|---|---|---|
| `services/find-or-create-portal-user.ts:92-113` | CLIENT only (contact promotion) | Magic link |
| `services/create-user.ts:25-34,104` | `input.role` is `z.enum(USER_ROLES)` — **either** | Branch: CLIENT → magic link, ADMIN → unchanged |

`create-user.ts` is the settings "create user" form and accepts either role, so it can't switch wholesale without changing how admins are invited — which O1 puts out of scope. Branch on `input.role` and leave the ADMIN path byte-for-byte as it is.

That means `sendPortalInviteEmail` grows two shapes rather than being rewritten. Cleanest split is two functions over one shared layout — `sendPortalInviteEmail({ to, fullName, actionLink })` for clients, the existing signature retained for admins — so neither carries a nullable field the other ignores.

**Change (client path).** Keep `generateTemporaryPassword()` and keep passing it to `createUser` — the account needs *a* password credential so `/forgot-password` has something to reset (D2). Stop passing it to the email. Generate a link instead:

```ts
const { data, error } = await adminClient.auth.admin.generateLink({
  type: 'magiclink',           // NOT 'invite' — 'invite' creates a user, ours already exists
  email: input.email,
  options: {
    redirectTo: `${serverEnv.CLIENT_PORTAL_URL}/auth/callback?redirect_to=/onboarding`,
  },
})
```

Send `data.properties.action_link` in the email. This is the **admin** API, so it doesn't consume the `email_sent` rate limit that §4's client-side `signInWithOtp` does, and delivery stays on Resend with our branding rather than moving to Supabase's mailer.

`generateLink` also returns `hashed_token`, so the link resolves through the `token_hash` + `type` flow — which is exactly what §3's `apps/client/app/auth/confirm/route.ts` is for. **§6 depends on §3 existing**; shipping the new invite email first sends clients to a 404.

The client email drops the credentials list and says the link signs them in and lets them pick how to sign in from then on. Per O2 it must also say what to do with a stale link — *"this link expires in an hour; if it has, request a new one from the sign-in page"* — because that sentence is the entire recovery path we chose instead of raising the expiry.

**Admin email — point it at the right app.** `send-portal-invite.ts:31,50` builds the sign-in URL from `serverEnv.CLIENT_PORTAL_URL` for *every* invite, so a new **ADMIN** created in settings is currently sent to the client portal instead of the internal app. It half-works because admins can load the portal via view-as, which is why it went unnoticed. Fix it in the role branch — the admin path otherwise stays exactly as it is (temp password, forced reset).

Use the fallback chain already established at `forgot-password/actions.ts:50-53` and `sign-in/actions.ts:120` rather than inventing one:

```ts
const headersList = await headers()
const adminBaseUrl =
  headersList.get('origin') ?? serverEnv.APP_BASE_URL ?? 'http://localhost:3000'
```

`headers()` first matters: **`APP_BASE_URL` is `.optional()`** in `apps/internal/lib/env.server.ts:15`, unlike the required `CLIENT_PORTAL_URL:30`. Reading it directly would mail a `undefined/sign-in` link wherever it isn't set. `create-user.ts` runs inside a server action, so the request origin is available and is the most accurate value anyway.

Clients keep using `serverEnv.CLIENT_PORTAL_URL` — that one is required, and the portal is a different origin from the internal app that's sending the email, so `headers()` would be wrong there.

> **Bug this exposes — `find-or-create-portal-user.ts:94`.** That path calls `updateUserById({ password: temporaryPassword })` on an **existing** auth user. Re-promoting a contact who already has portal access therefore silently destroys the password they chose. Today that's masked because they're mailed the replacement; under D2 nothing is mailed, so they're locked out of a password they thought they had — and if they'd gone Google-only under D5, the reset is pure collateral damage. **Drop the `password` field from that call.** The user already has a credential; the magic link is what gets them in.

> **Gotcha.** Invite dispatch failure is fatal in `create-user.ts` (rolls back the auth user, the `users` row and the avatar) but non-fatal in `find-or-create-portal-user.ts:116` (logged, returns success). Keep that asymmetry — a half-created user is worse than a missing email, whereas the promotion path has already linked a real contact. But `generateLink` is a new failure mode in both; make sure it's inside the existing try, not before it.

---

## Test plan

Local Supabase `127.0.0.1:54322`, internal `:3000`, portal `:3001`, Inbucket `127.0.0.1:54324`.

Existing local accounts: `kris@placetostandagency.com` (ADMIN), `test@test.com` (ADMIN), `11crawfordk@gmail.com` (CLIENT — Acme, New Client), `kris@krismakesmusic.com` (CLIENT — Kris Music CLient).

**T0 — Orphan check. Run before deploying §2.**
```sql
select a.id, a.email, a.created_at from auth.users a
left join public.users u on u.id = a.id where u.id is null;
```
Local: 0 rows (verified). Must also be 0 in **production** — any row becomes an immediate lockout.

**T1 — Auto-linking on matching email. Decides which §5 we build; run before any UI.**
Google sign-in as `11crawfordk@gmail.com`, then check `auth.users` and `auth.identities` for that email.
*PASS* — one `auth.users` row, unchanged id, both `email` and `google` identities → D5 holds for free; §5's Google option covers the mismatched-email case only.
*FAIL* — a second `auth.users` row with a new id → **D5 is violated by the platform.** Stop. §5's `linkIdentity()` becomes the only route, and §4's Google button ships only after it.

**T2 — Magic link, provisioned client.** Link for `kris@krismakesmusic.com`, open from Inbucket, lands authenticated with hours card rendering. `auth.users` count unchanged.

**T3 — Magic link, unknown email.** Request for `nobody@example.com` → identical "if an account exists…" copy, **no** new `auth.users` row, no email delivered.

**T4 — Google, provisioned client.** Matching Google address → portal home, correct client name in header, same `users.id`.

**T5 — Google, unprovisioned (internal).** Google account with no `users` row → `/account-not-set-up`, **signed out** (navigating to `/` goes to `/sign-in`, not a loop), `public.users` count unchanged.

**T6 — Google, unprovisioned (portal).** Same on `:3001`. Specifically confirm **no redirect loop** between `/` and `/sign-in`.

**T7 — Disabled user.** Set `disabled_at`, magic-link sign-in → rejected at the callback, signed out, not half-signed-in. Clear it after.

**T8 — Password regression.** Both apps: password sign-in, `redirectTo` on internal, hard-nav on client, `/forgot-password`, `/force-reset-password`.

**T9 — Mismatched-email linking.** Invite a non-Google address → open the invite link → onboarding → "How would you like to sign in?" → **Connect Google** with a *different* Gmail → returns **at that step, not step 0** → `auth.identities` has both, `auth.users` count **unchanged** → sign out → "Continue with Google" with that Gmail → same `users` row and client scoping.

**T10 — All three choices clear the flag (D6).** Run onboarding three times, one choice each: set password / connect Google / email me a link. Each → `must_reset_password` false, no password step on next visit, portal loads. A choice that leaves the flag set is a fail.

**T11 — Methods are additive, not exclusive (D5).** After completing onboarding via *one* method, sign out and sign in with each of the others in turn. All land on the same `users` row. `auth.users` count never increases at any point.

**T11b — Recovery for a passwordless client.** Complete onboarding choosing "email me a link", sign out, then run `/forgot-password`. A reset email arrives and the new password works — proving the undisclosed credential from §6 leaves recovery intact.

**T12 — Cross-app isolation regression.** As `11crawfordk@gmail.com`: GreenWatt project → `notFound()`; INTERNAL project `b6fc181b-b871-4fa2-ae42-1cb87af6cf18` → `notFound()`; hours show only Acme and New Client.

**T13 — Client invite carries no credential (§6).** Promote a contact to portal access. Read the Inbucket message **source**, both text *and* HTML parts — checking only the rendered view misses a password left in the other part. No password string anywhere; one working action link; clicking it lands authenticated on `/onboarding`.

**T14 — Re-promoting an existing portal user doesn't reset their password.** Promote a contact, complete onboarding with a password you choose, then promote the same contact again. Sign in with the password you chose — it still works. This is the `find-or-create-portal-user.ts:94` bug; it fails before the fix.

**T15 — Expired invite link recovers (O2).** Wait out `otp_expiry` (or expire the token directly), click the invite link → a clear error, not a blank page or a redirect loop. Then "email me a sign-in link" from the sign-in page gets them in, same `users` row. The copy promising this must actually be in the T13 email.

**T16 — Admin invite: unchanged except the URL (O1).** Create an **ADMIN** from settings. Email still carries a temp password; `apps/internal/proxy.ts` still forces `/force-reset-password`; sign-in at `:3000` works. The one difference from today: the link points at the **internal app**, not the client portal. Run after §6 — this is the regression the role branch exists to prevent.

**T16b — Admin link with `APP_BASE_URL` unset.** Unset it locally and create an admin. The link must still resolve via the `headers()` origin, not `undefined/sign-in`. Cheap to check and the failure is invisible until someone clicks.

**Build.** From repo root: `npm run lint`, `npm run type-check`, `npm run build`.

## Deploy checklist

- [ ] T0 run against **production**, 0 rows
- [ ] Google OAuth client has all redirect URIs (local + hosted Supabase callbacks)
- [ ] Hosted Supabase: Google enabled, manual linking on, production redirect URLs for **both** apps
- [ ] `email_sent` rate limit reviewed for hosted — do **not** copy the raised local value
- [ ] `SUPABASE_AUTH_GOOGLE_*` set wherever the Supabase CLI reads config
- [ ] §3's `/auth/callback` + `/auth/confirm` deployed to the portal **before** §6's new invite email — otherwise every invite link 404s
- [ ] `CLIENT_PORTAL_URL` correct in the internal app's production env — §6 builds the invite link from it, so a wrong value mails a dead link
- [ ] T16 green — admin invites still carry a temp password and now link to the internal app
- [ ] `APP_BASE_URL` set in the internal app's production env (it is optional in the schema, so nothing fails loudly if it's missing)
