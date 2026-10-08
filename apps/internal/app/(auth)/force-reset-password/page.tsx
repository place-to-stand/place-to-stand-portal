import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@pts/ui/auth-shell";

import { getSupabaseServerClient } from "@/lib/supabase/server";

import { PasswordResetForm } from "./force-reset-form";

export const metadata: Metadata = {
  title: 'Update password',
};

export default async function ForceResetPasswordPage({
  searchParams,
}: PageProps<'/force-reset-password'>) {
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

  const resolvedSearchParams = (await searchParams) as { redirect?: string };
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
