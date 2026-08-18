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
import { AuthShell, authLinkClass } from '@pts/ui/auth-shell'

export default function AccountNotSetUpPage() {
  return (
    <AuthShell
      label="Client Portal"
      title="This account isn't set up yet"
      description="We couldn't find a Place to Stand account for that email. If you're expecting access, contact your account manager and we'll get you set up."
      footer={
        <a href="/sign-in" className={authLinkClass}>
          Back to sign in
        </a>
      }
    >
      {null}
    </AuthShell>
  )
}
