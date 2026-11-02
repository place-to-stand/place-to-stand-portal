// permission: public — shown before sign-in completes
import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell, authLinkClass } from "@pts/ui/auth-shell";

export const metadata: Metadata = {
  title: 'Not set up yet',
};

/**
 * Shown when someone authenticates successfully but has no `users` row.
 *
 * Deliberately distinct from `/unauthorized`, which means *wrong role* rather than
 * *no account* — merging them would make a real permission problem look like a
 * provisioning problem.
 *
 * The copy is intentionally identical for unknown emails and known-but-unprovisioned
 * ones, so this page can't be used to enumerate who does and doesn't have an account.
 */
export default function AccountNotSetUpPage() {
  return (
    <AuthShell
      wide
      label="Internal Portal"
      title="You're not set up yet"
      description="We couldn't find a sign-in for that email. If you're expecting access, ask a Place To Stand admin to set you up."
      footer={
        <Link className={authLinkClass} href="/sign-in">
          Back to sign in
        </Link>
      }
    >
      {null}
    </AuthShell>
  );
}
