import 'server-only'

import { getEnv } from '@/lib/env.server'

/**
 * This portal's own address, from configuration only.
 *
 * Sign-in and reset links carry one-time tokens, so their host must never come
 * from a request header (Origin, Host, X-Forwarded-Host): a forged header would
 * mail the token to someone else's site. Order: APP_BASE_URL, then the address
 * Vercel gives this deployment, then localhost outside production.
 */
export function appOrigin(): string {
  return resolveAppOrigin(getEnv().APP_BASE_URL)
}

export function resolveAppOrigin(configured: string | undefined): string {
  const vercelHost =
    process.env.VERCEL_ENV === 'production'
      ? process.env.VERCEL_PROJECT_PRODUCTION_URL
      : process.env.VERCEL_URL
  const origin =
    configured || (vercelHost ? `https://${vercelHost}` : undefined)

  if (origin) return origin.replace(/\/+$/, '')

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Cannot build a link to this portal: set APP_BASE_URL.')
  }

  return 'http://localhost:3001'
}
