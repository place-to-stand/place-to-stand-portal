import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { AuthShell } from "@pts/ui/auth-shell";

import { getSupabaseServerClient } from "@/lib/supabase/server";

import { PasswordResetForm } from "./force-reset-form";

type PageProps = {
  searchParams?: Promise<{ redirect?: string }>;
};

export const metadata: Metadata = {
  title: "Update password | Place to Stand Portal",
};

// Supabase auth check + search-param read live here, behind Suspense, so the
// page keeps a prerenderable shell (Cache Components instant-navigation
// pattern).
async function ForceResetPasswordContent({ searchParams }: PageProps) {
  const supabase = getSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/sign-in");
  }

  const mustReset = Boolean(user.user_metadata?.must_reset_password);

  if (!mustReset) {
    redirect("/");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const redirectTo = resolvedSearchParams?.redirect;

  return (
    <AuthShell
      wide
      label="Internal Portal"
      title="Create a new password"
      description="For security, you need to update your password before accessing the portal."
    >
      <PasswordResetForm redirectTo={redirectTo} email={user.email} />
    </AuthShell>
  );
}

export default function ForceResetPasswordPage({ searchParams }: PageProps) {
  return (
    <Suspense fallback={null}>
      <ForceResetPasswordContent searchParams={searchParams} />
    </Suspense>
  );
}
