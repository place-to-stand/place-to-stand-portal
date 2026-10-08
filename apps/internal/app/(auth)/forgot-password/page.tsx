import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell, authLinkClass } from "@pts/ui/auth-shell";

import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = {
  title: 'Reset password',
};

export default async function ForgotPasswordPage({
  searchParams,
}: PageProps<'/forgot-password'>) {
  const resolvedSearchParams = (await searchParams) as { redirect?: string };
  const redirectTo = resolvedSearchParams?.redirect;

  return (
    <AuthShell
      label="Internal Portal"
      title="Reset your password"
      description="Enter your email and we'll send you a link to create a new password."
      footer={
        <Link
          href={
            redirectTo
              ? `/sign-in?redirect=${encodeURIComponent(redirectTo)}`
              : "/sign-in"
          }
          className={authLinkClass}
        >
          Back to sign in
        </Link>
      }
    >
      <ForgotPasswordForm redirectTo={redirectTo} />
    </AuthShell>
  );
}
