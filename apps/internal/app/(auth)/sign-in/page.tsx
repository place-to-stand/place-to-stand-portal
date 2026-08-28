import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@pts/ui/auth-shell";

import { getCurrentUser } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env.server";

import { ClientPortalNotice } from "./client-portal-notice";
import { SignInForm } from "./sign-in-form";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

type PageProps = {
  searchParams?: Promise<{ redirect?: string; notice?: string }>;
};

export const metadata: Metadata = {
  title: "Sign in | Place to Stand Portal",
};

export default async function SignInPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (user) {
    redirect("/");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const redirectTo = resolvedSearchParams?.redirect;
  const showClientPortalNotice =
    resolvedSearchParams?.notice === "client-portal";

  return (
    <AuthShell
      label="Internal Portal"
      title="Welcome back"
      description="Sign in with your work email to manage your projects."
    >
      {showClientPortalNotice ? (
        <ClientPortalNotice clientPortalUrl={serverEnv.CLIENT_PORTAL_URL} />
      ) : null}
      <SignInForm redirectTo={redirectTo} />
    </AuthShell>
  );
}
