# PRD 002 — Google + Magic Link Authentication

**Status:** Implemented (2026-08-10) — deployed nowhere yet; see [Deploy checklist](#deploy-checklist)
**Apps:** `apps/client/`, `apps/internal/`, `supabase/config.toml`
**Depends on:** A Google OAuth client + the provider enabled in hosted Supabase (Kris)
**Blocks:** Client portal invoices — we confirm auth works before starting those
**Branch/PR:** `feat/client-portal-billing-and-auth` — [#122](https://github.com/place-to-stand/place-to-stand-portal/pull/122)

> **This document was reconciled against the code on 2026-08-11.** One decision reversed
> during implementation — D7, and with it §5's linking rules. The test plan has been
> rewritten in plain steps numbered 1–18; the old T-codes are gone. The reversal is
> recorded in place rather than rewritten away; see [Reversed during implementation](#reversed-during-implementation).
> Sections not marked otherwise describe what shipped.

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
| D7 | ~~Mismatched Google email handled with `linkIdentity()` during onboarding, while already authenticated.~~ **Reversed 2026-08-10.** A Google account is only accepted when its address matches the address the account was invited under. One email per user; multiple addresses per user is later work. See [Reversed during implementation](#reversed-during-implementation). |

## Resolved — earlier questions

- **Q1 — one auth user per person.** Settled by D5: this is now a requirement, not an assumption. What's still unknown is the *mechanism* — whether Supabase auto-links a Google identity to an existing auth user on a verified email match (our users are created `email_confirm: true`, which should satisfy it). **Still unanswered** — see "Reversed during implementation" below and **test 7**:
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
- §2's lockout risk narrows to **admins only**. Test 1 still runs against production — an orphaned *admin* auth user locks out the back office, which is worse than a client lockout, not better.

## Reversed during implementation

**D7 — a Google account must now carry the same address the portal account was invited under.**

As planned, an admin could invite `kris@company.com` and the client could attach `kris@gmail.com`
during onboarding; the two addresses would live on one auth user. That shipped, then was reversed
in `cea5e750`, because it means a client can sign in under an address the account was never issued
— and everything downstream that reads an email now has two answers for one person.

What the code does instead:

- Google's account chooser is pre-filled with the invited address (`login_hint`). It is a hint —
  Google still lets them switch — so it reduces mismatches without enforcing anything.
- The match can only be checked on the way back, since Google decides which account signs in.
  On return, a mismatched identity is **detached** (`unlinkIdentity`), not just reported. Leaving
  it attached would be the hole this check exists to close.
- Onboarding is the only place identities are linked — the sign-in pages use `signInWithOAuth`
  and there is no connected-accounts UI — so one check covers the whole surface.

D5 still holds: password, magic link and Google remain doors into a single auth user. What changed
is that every door must now carry the same address.

**Still open — does Google auto-link on a matching address?** The original Q1 question was never
recorded as answered, and the reversal makes it load-bearing in a way it wasn't before. A client who
onboards with a password and *later* clicks "Continue with Google" at the same address never passes
through `linkIdentity` — the sign-in page calls `signInWithOAuth`. If Supabase attaches that Google
identity to their existing auth user, it works. If it mints a second auth user instead, that user has
no `users` row and they get bounced to "account isn't set up" — a dead end for a legitimate client.
Test 7 below decides this, and it should run before the Google button is trusted in production.

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
- `auth.users` left-joined against `public.users` → **0 orphans locally** (verified). Must also be 0 in production before deploy — see test 1.

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

> **Risk.** Any orphaned auth user in production becomes an immediate lockout. Run test 1 against production first.
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
| Connect Google | `linkIdentity({ provider: 'google' })`, with `login_hint` set to the account address | `google` identity added to the **same** auth user — **only if the Google address matches**; a mismatch is detached on return (D7, reversed) |
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

> **The wizard's step state is `useState` with no persistence.** `linkIdentity` does a full-page redirect to Google, so on return the wizard remounts at step 0 — the exact failure the removed GitHub step had. **As built:** the server page reads `?step=link-return` and passes `returnedFromGoogle` down, so the wizard opens on the choice step. **Don't remove this**, or linking appears to do nothing.

> **As built — the two failure shapes are both knowable at render time**, so neither needs an effect: no identity came back at all (Google was cancelled), or one came back under the wrong address. The first shows "Google linking didn't complete"; the second names both addresses and detaches the identity.

> **Resolved by D7's reversal.** The original risk here was that manual linking lets a client attach *any* Google account, making a Google identity no evidence of who someone is. The match requirement removes that: an attached Google identity now always carries the account's own address.
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

**Where things run.** Internal app `:3000`, client portal `:3001`, local email inbox (Mailpit) at
`127.0.0.1:54324`, database `127.0.0.1:54322`.

**Local accounts.** `kris@placetostandagency.com` and `test@test.com` are admins.
`11crawfordk@gmail.com` (Acme, New Client) and `kris@krismakesmusic.com` (Kris Music Client) are
portal clients.

Tests 1, 16 and 17 need the database. Everything else is clicking through the apps.

---

### Run this one before deploying anything

**1. No accounts are stranded in production.** Against the **production** database:

```sql
select a.id, a.email, a.created_at from auth.users a
left join public.users u on u.id = a.id where u.id is null;
```

Must return **0 rows**. Any row here is someone who can log in but has no profile — after this
change they get locked out on their next sign-in. Locally this is already 0.

---

### Signing in

**2. Password still works.** Both apps: sign in with email + password. On the internal app, being
sent to a protected page first should return you there after signing in. Check "forgot password"
and the forced-reset screen still work. *Nothing about password sign-in was meant to change — this
is the regression check.*

**3. Email sign-in link, real client.** On the portal, ask for a link as
`kris@krismakesmusic.com`. Open it from Mailpit. You land signed in, with the hours card showing.

**4. Email sign-in link, address we don't know.** Ask for a link as `nobody@example.com`. You should
see the **same** "if an account exists, we've sent a link" message as in test 3, no email should
arrive, and no new account should be created. *Different messages here would let a stranger
discover who our clients are.*

**5. Google, client whose Google address matches their account.** Sign in with Google as
`11crawfordk@gmail.com` → portal home, correct client name in the header.

**6. Google, someone with no account.** Sign in with a Google account we've never invited, on
**both** apps. You should land on "this account isn't set up", be **signed out**, and going to `/`
should send you to the sign-in page — not bounce back and forth in a loop.

**7. ⚠️ Google after onboarding with a password — the open question.** Onboard a client who chooses
**Set a password**, so they never connect Google. Sign out, then click **Continue with Google**
using the *same* address as their account.

- Lands in the portal, same account → good, nothing more to do.
- Says "account isn't set up" → Google made them a *second* account behind the scenes. Legitimate
  clients would hit a dead end, and the Google button shouldn't ship until that's handled.

*This is the one test whose result we can't predict, and it decides whether the Google button is
safe for clients who didn't connect Google during onboarding.*

---

### Invites and onboarding

**8. The invite email contains no password.** Promote a contact to portal access. In Mailpit, view
the **message source**, not just the rendered email — check the plain-text and HTML parts, since a
password left in one is invisible in the other. There should be no password anywhere, one working
button, and clicking it lands them signed in on the onboarding screen.

**9. All three sign-in choices finish onboarding.** Run onboarding three times, picking a different
option each time: set a password / connect Google / email me a link. Each should finish and **not**
ask again on the next visit. *If any choice leaves them stuck on the "how do you want to sign in"
step forever, that's the bug this test exists for.*

**10. Connecting the wrong Google account is refused.** Invite someone at a non-Gmail address. At
the "how would you like to sign in" step choose **Connect Google**, and deliberately pick a
*different* Google account. You should come back to that step — not the beginning — with a message
naming both addresses, and the wrong account must **not** stay attached. Then connect the
*matching* Google account: that should work.

**11. An expired invite link recovers.** Let an invite link expire (an hour, or expire the token
directly), then click it. You should get a clear error, not a blank page or a loop — and "email me
a sign-in link" on the sign-in page should get them in.

**12. Re-inviting an existing client doesn't wipe their password.** Promote a contact, finish
onboarding with a password you pick, then promote that same contact again. The password you chose
must still work. *This was a real bug; it fails without the fix.*

**13. A passwordless client can still recover.** Finish onboarding choosing "email me a link", sign
out, then use "forgot password". A reset email should arrive and the new password should work.

**14. Admin invites are unchanged — except the link.** Create an **admin** from settings. The email
should still carry a temporary password, they should still be forced to reset it, and sign-in at
`:3000` should work. The one difference: the link points at the **internal app**, not the client
portal. *It used to send admins to the client portal, which was a plain bug.*

**15. Admin invite link when `APP_BASE_URL` isn't set.** Unset it locally and create an admin. The
link must still work, not read `undefined/sign-in`. *Cheap to check, and invisible until someone
clicks it.*

---

### Clients can't see each other's data

**16. Client scoping.** Signed in as `11crawfordk@gmail.com`: the GreenWatt project should be
not-found, the internal project `b6fc181b-b871-4fa2-ae42-1cb87af6cf18` should be not-found, and
hours should show only Acme and New Client.

**17. A disabled account can't get in.** Set `disabled_at` on a portal user, then try the email
sign-in link. It should be rejected and signed out — not half-signed-in. Clear the flag afterwards.

---

**18. Build.** From the repo root: `npm run lint`, `npm run type-check`, `npm run build`.

## Deploy checklist

Config and ordering. None of this is caught by the tests above.

- [ ] Test 1 run against **production**, 0 rows
- [ ] Google OAuth client lists every redirect URI (local *and* hosted Supabase callbacks)
- [ ] Hosted Supabase: Google enabled, manual linking on, production redirect URLs for **both** apps
- [ ] Hosted email rate limit reviewed — do **not** copy the raised local value; the sign-in page lets anyone trigger mail to any address
- [ ] The portal's `/auth/callback` + `/auth/confirm` are live **before** the new invite email ships, or every invite link 404s
- [ ] `CLIENT_PORTAL_URL` correct in the internal app's production env — the invite link is built from it, so a wrong value mails a dead link
- [ ] `APP_BASE_URL` set in the internal app's production env (it's optional in the schema, so a missing value fails silently — see test 15)
- [ ] Test 14 green — admin invites still carry a temp password and now link to the internal app
