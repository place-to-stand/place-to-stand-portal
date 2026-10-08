import type { NextConfig } from 'next'
import { withPostHogConfig } from '@posthog/nextjs-config'

/**
 * Baseline security headers. The CSP is limited to directives that do not
 * govern scripts or styles (Next.js emits inline scripts); a full script-src
 * policy needs a nonce pipeline and a report collector before it can be
 * enforced safely. `frame-ancestors 'none'` is what stops clickjacking.
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
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
]

const nextConfig: NextConfig = {
  reactCompiler: true,
  reactStrictMode: true,
  experimental: {
    // Rust port of the React Compiler; replaces the Babel pass under Turbopack.
    turbopackRustReactCompiler: true,
    // Dev only: prunes unreachable work from .next/dev's persistent cache.
    turbopackGc: true,
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
  async rewrites() {
    // PostHog reverse proxy to avoid ad blockers
    // The relay path must match the api_host in instrumentation-client.ts
    const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'
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
        project: 'place-to-stand-client-portal',
        version: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA!,
      },
    })
  : nextConfig
