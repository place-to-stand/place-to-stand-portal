import type { NextConfig } from 'next'
import { withPostHogConfig } from '@posthog/nextjs-config'

/**
 * Baseline security headers. The CSP is intentionally limited to directives
 * that do not govern scripts or styles: Next.js emits inline scripts and the
 * PostHog snippet loads workers, so a full script-src policy needs a nonce
 * pipeline and a report collector before it can be enforced safely.
 * `frame-ancestors 'none'` is what stops clickjacking; the rest is hygiene.
 */
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(self)',
  },
]

const nextConfig: NextConfig = {
  transpilePackages: ['@pts/ui'],
  cacheComponents: false,
  reactCompiler: true,
  reactStrictMode: true,
  experimental: {
    // Dev only: prunes unreachable work from .next/dev's persistent cache.
    turbopackGc: true,
  },
  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      // The Settings → Templates page frames its own PDF previews. Later
      // entries override earlier ones for the same header key, so this route
      // alone may be framed, and only by this origin.
      {
        source: '/api/templates/pdf/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'",
          },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ]
  },
  /**
   * Every retired or index route, in one place. Next carries the query
   * string over, so sheet params (`?contact=…`) survive. Routes whose new
   * address needs a database lookup stay as pages: `/clients/[clientSlug]`
   * (slug to company) and `/settings/users` (`?user=` to person). Old
   * `?client=` / `?user=` sheet params are mapped in `proxy.ts`.
   */
  async redirects() {
    const to = (source: string, destination: string) => ({
      source,
      destination,
      permanent: false,
    })
    return [
      // Index routes.
      to('/my/tasks', '/my/tasks/board'),
      to('/reports', '/reports/monthly-close'),
      to('/settings', '/settings/permissions'),
      to('/settings/templates', '/settings/templates/emails'),
      // Contacts are called People.
      to('/contacts', '/people'),
      to('/contacts/:path*', '/people/:path*'),
      // A client is a company you bill.
      {
        source: '/clients',
        has: [{ type: 'query' as const, key: 'search', value: '(?<q>.*)' }],
        destination: '/companies/clients?q=:q',
        permanent: false,
      },
      to('/clients', '/companies/clients'),
      to('/clients/archive', '/companies?type=former'),
      to('/clients/activity', '/companies/activity'),
      // A sign-in is managed on its person.
      to('/settings/users/archive', '/people'),
      to('/settings/users/activity', '/people/activity'),
      to('/settings/projects', '/projects'),
      // The project Overview and Scope tabs are gone: the board is Tasks.
      to(
        '/projects/:clientSlug/:projectSlug/overview',
        '/projects/:clientSlug/:projectSlug/tasks'
      ),
      to(
        '/projects/:clientSlug/:projectSlug/scope',
        '/projects/:clientSlug/:projectSlug/tasks'
      ),
      // A project's archived tasks live on its Review tab.
      to(
        '/projects/:clientSlug/:projectSlug/archive',
        '/projects/:clientSlug/:projectSlug/review'
      ),
    ]
  },
  async rewrites() {
    // PostHog reverse proxy to avoid ad blockers
    // The relay path must match the api_host in instrumentation-client.ts
    const posthogHost =
      process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'
    return [
      {
        source: '/relay-HVAq/static/:path*',
        destination: `${posthogHost}/static/:path*`,
      },
      {
        source: '/relay-HVAq/:path*',
        destination: `${posthogHost}/:path*`,
      },
    ]
  },
}

const posthogApiKey = process.env.POSTHOG_PERSONAL_API_KEY
const posthogProjectId = process.env.POSTHOG_PROJECT_ID
const shouldUploadSourceMaps =
  process.env.DISABLE_POSTHOG_UPLOAD_SOURCEMAPS !== 'true'

export default posthogApiKey && posthogProjectId
  ? withPostHogConfig(nextConfig, {
      personalApiKey: posthogApiKey,
      projectId: posthogProjectId,
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST!,
      sourcemaps: {
        enabled: shouldUploadSourceMaps,
        project: 'place-to-stand-portal',
        version: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA!,
      },
    })
  : nextConfig
