/**
 * Shown when someone authenticates successfully but has no `users` row.
 *
 * Portal access is granted by an admin promoting a contact — authenticating alone
 * never creates an account. Deliberately distinct from `/unauthorized`, which means
 * *wrong role* rather than *no account*.
 *
 * The copy is intentionally identical for unknown emails and known-but-unprovisioned
 * ones, so this page can't be used to enumerate who does and doesn't have an account.
 */
export default function AccountNotSetUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-sm text-center">
        <h1 className="text-2xl font-bold text-foreground">
          This account isn&apos;t set up yet
        </h1>
        <p className="mt-2 text-sm text-foreground/60">
          We couldn&apos;t find a Place to Stand account for that email. If
          you&apos;re expecting access, contact your account manager and
          we&apos;ll get you set up.
        </p>
        <a
          href="/sign-in"
          className="mt-4 inline-block text-sm underline hover:text-foreground"
        >
          Back to sign in
        </a>
      </div>
    </div>
  )
}
