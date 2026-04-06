import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { ensureUserProfile } from "@/lib/auth/profile";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

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
    await ensureUserProfile(data.user);
  }

  // Only allow relative redirects to prevent open redirect attacks
  const safePath =
    redirectTo.startsWith("/") && !redirectTo.startsWith("//")
      ? redirectTo
      : "/";

  return NextResponse.redirect(new URL(safePath, request.url));
}

type SessionTokens = {
  access_token: string;
  refresh_token: string;
};

export async function POST(request: Request) {
  const payload = await request.json();
  const cookieStore = await cookies();

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll().map(({ name, value }) => ({ name, value }));
        },
        setAll(cookies) {
          cookies.forEach(({ name, value, options }) => {
            cookieStore.set({ name, value, ...options });
          });
        },
      },
    }
  );

  const tokens: SessionTokens | null = payload.session ?? null;

  if (tokens) {
    await supabase.auth.setSession(tokens);
  }

  if (payload.event === "SIGNED_OUT" || payload.event === "USER_DELETED") {
    await supabase.auth.signOut();
  }

  return NextResponse.json({ status: "ok" });
}
