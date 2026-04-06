'use server';

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { ensureUserProfile } from "@/lib/auth/profile";
import { serverEnv } from "@/lib/env.server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  redirectTo: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) {
        return null;
      }

      if (!value.startsWith("/")) {
        return null;
      }

      if (value.startsWith("//")) {
        return null;
      }

      return value;
    }),
});

export type SignInState = {
  error?: string;
};

export async function signInWithPassword(
  _prevState: SignInState,
  formData: FormData
): Promise<SignInState> {
  const result = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    redirectTo: formData.get("redirectTo"),
  });

  if (!result.success) {
    return {
      error: "Please provide a valid email and password.",
    };
  }

  const { email, password, redirectTo } = result.data;
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return {
      error: error?.message ?? "Unable to sign in. Please try again.",
    };
  }

  await ensureUserProfile(data.user);

  const mustReset = Boolean(
    (data.user.user_metadata?.must_reset_password as boolean | undefined)
  );

  if (mustReset) {
    redirect("/force-reset-password");
  }

  redirect(redirectTo ?? "/");
}

/* ------------------------------------------------------------------ */
/*  Magic link                                                        */
/* ------------------------------------------------------------------ */

export type MagicLinkState = {
  error?: string;
  success?: boolean;
};

export async function sendMagicLink(input: {
  email: string;
  redirectTo?: string | null;
}): Promise<MagicLinkState> {
  const email = input.email?.trim();
  if (!email || !z.string().email().safeParse(email).success) {
    return { error: "Enter a valid email address." };
  }

  const supabase = getSupabaseServerClient();
  const headersList = await headers();
  const origin =
    headersList.get("origin") ??
    serverEnv.APP_BASE_URL ??
    "http://localhost:3000";

  const callbackPath = input.redirectTo
    ? `/auth/callback?redirect_to=${encodeURIComponent(input.redirectTo)}`
    : "/auth/callback";

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}${callbackPath}`,
    },
  });

  if (error) {
    console.error("Failed to send magic link", error);
    return { error: "We couldn't send the link. Please try again." };
  }

  return { success: true };
}
