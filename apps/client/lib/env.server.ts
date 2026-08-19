import 'server-only'

import { z } from 'zod'

const schema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  APP_BASE_URL: z.url().optional(),
  // Full URL of the internal portal (e.g. https://portal.placetostandagency.com). The
  // mirror of CLIENT_PORTAL_URL in the internal app. Used to hand off to the
  // shared invoice page, which is where invoice payment lives.
  INTERNAL_PORTAL_URL: z.url(),
  // Optional so local development — which routes mail to Mailpit and needs no
  // Resend credentials — boots without them, and so the unrelated GitHub routes
  // that share this schema don't start failing on a missing mail key. The email
  // module checks for what it actually needs and names the gap when sending.
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.email().optional(),
  RESEND_REPLY_TO_EMAIL: z.email().optional(),
  GITHUB_APP_ID: z.string().min(1),
  GITHUB_APP_PRIVATE_KEY: z.string().min(1),
  GITHUB_APP_WEBHOOK_SECRET: z.string().min(1),
  GITHUB_APP_CLIENT_ID: z.string().min(1),
  GITHUB_APP_CLIENT_SECRET: z.string().min(1),
})

function emptyToUndefined(val: string | undefined): string | undefined {
  return val === '' ? undefined : val
}

function getServerEnv() {
  return schema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    APP_BASE_URL: emptyToUndefined(process.env.APP_BASE_URL),
    INTERNAL_PORTAL_URL: process.env.INTERNAL_PORTAL_URL,
    RESEND_API_KEY: emptyToUndefined(process.env.RESEND_API_KEY),
    RESEND_FROM_EMAIL: emptyToUndefined(process.env.RESEND_FROM_EMAIL),
    RESEND_REPLY_TO_EMAIL: emptyToUndefined(process.env.RESEND_REPLY_TO_EMAIL),
    GITHUB_APP_ID: process.env.GITHUB_APP_ID,
    GITHUB_APP_PRIVATE_KEY: process.env.GITHUB_APP_PRIVATE_KEY,
    GITHUB_APP_WEBHOOK_SECRET: process.env.GITHUB_APP_WEBHOOK_SECRET,
    GITHUB_APP_CLIENT_ID: process.env.GITHUB_APP_CLIENT_ID,
    GITHUB_APP_CLIENT_SECRET: process.env.GITHUB_APP_CLIENT_SECRET,
  })
}

// Lazy singleton — env vars are validated on first access, not at import time.
// This prevents build failures when env vars aren't available during static analysis.
let _serverEnv: z.infer<typeof schema> | undefined

export function getEnv() {
  if (!_serverEnv) {
    _serverEnv = getServerEnv()
  }
  return _serverEnv
}
