import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Account not set up | Place to Stand Portal",
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-6 py-12">
      <div className="w-full max-w-md space-y-6 rounded-xl bg-background p-10 text-center shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight">
          This account isn&apos;t set up yet
        </h1>
        <p className="text-sm text-muted-foreground">
          We couldn&apos;t find a Place to Stand account for that email. If
          you&apos;re expecting access, contact your account manager and
          we&apos;ll get you set up.
        </p>
        <Link
          className="text-sm font-medium text-primary underline"
          href="/sign-in"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
