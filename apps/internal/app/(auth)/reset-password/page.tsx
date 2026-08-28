import type { Metadata } from "next";
import Link from "next/link";

import {
  AuthShell,
  authErrorClass,
  authLinkClass,
} from "@pts/ui/auth-shell";

import { getSupabaseServerClient } from "@/lib/supabase/server";

import { PasswordResetForm } from "../force-reset-password/force-reset-form";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

type PageProps = {
  searchParams?: Promise<{
    code?: string;
    error?: string;
    error_description?: string;
    redirect?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Set new password | Place To Stand Portal",
};

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const supabase = getSupabaseServerClient();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const redirectTo = resolvedSearchParams?.redirect;
  let errorMessage: string | null = null;

  if (resolvedSearchParams?.error_description) {
    errorMessage = resolvedSearchParams.error_description;
  }

  if (resolvedSearchParams?.code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
      resolvedSearchParams.code
    );

    if (exchangeError) {
      console.error("Failed to exchange password recovery code", exchangeError);
      errorMessage = "This password reset link is invalid or has expired.";
    }
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("Failed to resolve user during password recovery", error);
    errorMessage = "We couldn't verify your session. Please request a new reset link.";
  }

  if (!user) {
    return (
      <AuthShell
        label="Internal Portal"
        title="Reset link not valid"
        description={
          errorMessage ??
          "We couldn't verify that link. It may have expired or already been used."
        }
        footer={
          <Link href="/forgot-password" className={authLinkClass}>
            Request a new reset link
          </Link>
        }
      >
        {null}
      </AuthShell>
    );
  }

  return (
    <AuthShell
      wide
      label="Internal Portal"
      title="Create a new password"
      description="Choose a strong password to keep your account secure."
    >
      {errorMessage ? <p className={authErrorClass}>{errorMessage}</p> : null}
      <PasswordResetForm redirectTo={redirectTo} email={user.email} />
    </AuthShell>
  );
}
