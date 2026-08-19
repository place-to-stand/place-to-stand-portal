import type { Metadata } from "next";
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

export default async function ForceResetPasswordPage({ searchParams }: PageProps) {
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
