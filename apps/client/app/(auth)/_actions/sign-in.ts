'use server'

import {
  allowPasswordSignIn,
  SIGN_IN_THROTTLED_MESSAGE,
} from '@/lib/auth/throttle'

export type SignInAttemptResult = { allowed: true } | { allowed: false; error: string }

/**
 * Counts one password sign-in attempt before the browser sends it to Supabase.
 *
 * Sign-in itself stays in the browser, so Supabase's per-IP limit keeps seeing
 * the real client rather than Vercel's egress address. This adds the
 * per-account limit Supabase doesn't have, plus a per-IP one of our own. Every
 * address is counted the same way, so a refusal says nothing about whether an
 * account exists.
 */
export async function recordSignInAttempt(
  email: string
): Promise<SignInAttemptResult> {
  if (await allowPasswordSignIn(email)) return { allowed: true }

  return { allowed: false, error: SIGN_IN_THROTTLED_MESSAGE }
}
