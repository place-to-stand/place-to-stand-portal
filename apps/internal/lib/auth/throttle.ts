import 'server-only'

import { headers } from 'next/headers'

import { clientIpFromHeaders, consumeAttemptLimits } from '@pts/db/rate-limit'

import { db } from '@/lib/db'

const WINDOW_SECONDS = 15 * 60

type AttemptPolicy = {
  /** Bucket namespace; changing it resets every live counter. */
  kind: string
  perSubjectLimit: number
  perIpLimit: number
  /** What the warning log calls a refused attempt. */
  label: string
}

/**
 * Magic-link and password-reset dispatch. These use the admin `generateLink`
 * API, which bypasses Supabase's own per-hour email limit, so without this
 * nothing server-side stops a caller from mailing a known address on a loop.
 */
const AUTH_EMAIL: AttemptPolicy = {
  kind: 'auth-email',
  perSubjectLimit: 3,
  perIpLimit: 10,
  label: 'Auth email throttled',
}

/**
 * Password sign-in. Supabase's own sign-in limit is per IP, and a call made
 * from the server only ever shows it Vercel's egress address — so it can't
 * stop one caller guessing one account's password, and one caller could
 * exhaust it for everyone. These counters key on the real client instead.
 */
const PASSWORD_SIGN_IN: AttemptPolicy = {
  kind: 'sign-in',
  perSubjectLimit: 10,
  perIpLimit: 30,
  label: 'Password sign-in throttled',
}

/** Shown when sign-in is refused. Says nothing about whether the account exists. */
export const SIGN_IN_THROTTLED_MESSAGE =
  'Too many sign-in attempts. Try again in a few minutes.'

/** Trimmed and lowercased, so `A@x.com ` and `a@x.com` share one bucket. */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Records one attempt against the subject and the caller's IP. Returns `false`
 * when either bucket is exhausted. A database error throws, so the attempt is
 * refused rather than let through.
 */
async function allowAttempt(
  policy: AttemptPolicy,
  subject: string
): Promise<boolean> {
  const ip = clientIpFromHeaders(await headers())

  const result = await consumeAttemptLimits(db, {
    kind: policy.kind,
    subject,
    ip,
    perSubjectLimit: policy.perSubjectLimit,
    perIpLimit: policy.perIpLimit,
    windowSeconds: WINDOW_SECONDS,
  })

  if (!result.allowed) {
    console.warn(policy.label, {
      subject,
      ip,
      subjectHits: result.subjectHits,
      ipHits: result.ipHits,
    })
  }

  return result.allowed
}

/**
 * Callers must still answer with the same generic success they give for an
 * unknown address — a distinguishable "slow down" would leak which addresses
 * exist.
 */
export async function allowAuthEmail(email: string): Promise<boolean> {
  return allowAttempt(AUTH_EMAIL, email)
}

/**
 * Call before handing the password to Supabase. Every attempt counts, known
 * address or not, so a refusal reveals nothing about the account.
 */
export async function allowPasswordSignIn(email: string): Promise<boolean> {
  return allowAttempt(PASSWORD_SIGN_IN, normaliseEmail(email))
}
