import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";

import { ensureUserProfile } from "@/lib/auth/profile";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Handles PKCE code exchange for magic links and other email-based auth flows.
 * Supabase redirects here with a `code` query param after verifying an email token.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const redirectTo = searchParams.get("redirect_to") ?? "/";

  if (!code) {
    return NextResponse.redirect(
      new URL("/sign-in?error=missing_code", request.url)
    );
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Failed to exchange auth code for session", error);
    return NextResponse.redirect(
      new URL("/sign-in?error=exchange_failed", request.url)
    );
  }

  if (data.user) {
    const result = await ensureUserProfile(data.user);

    // Two distinct rejections, deliberately not collapsed into one role check.
    // "No account" and "wrong app" are different facts and get different pages;
    // `profile?.role !== "ADMIN"` alone would be true for both.
    if (result === "not_provisioned") {
      // Sign out rather than leaving a valid session that resolves to no profile —
      // otherwise every subsequent request re-runs this redirect.
      await supabase.auth.signOut();
      return NextResponse.redirect(
        new URL("/account-not-set-up", request.url)
      );
    }

    // The internal portal is admin-only. Portal (CLIENT) users belong on the
    // client portal — drop the session and send them there.
    const [profile] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, data.user.id))
      .limit(1);

    if (profile?.role !== "ADMIN") {
      await supabase.auth.signOut();
      return NextResponse.redirect(
        new URL("/sign-in?notice=client-portal", request.url)
      );
    }
  }

  // Only allow relative redirects to prevent open redirect attacks
  const safePath =
    redirectTo.startsWith("/") && !redirectTo.startsWith("//")
      ? redirectTo
      : "/";

  return NextResponse.redirect(new URL(safePath, request.url));
}
