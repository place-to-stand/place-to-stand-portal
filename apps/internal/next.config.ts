import type { NextConfig } from 'next'
import { withPostHogConfig } from '@posthog/nextjs-config'

const nextConfig: NextConfig = {
  cacheComponents: false,
  reactCompiler: true,
  reactStrictMode: true,
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
        project: 'place-to-stand-portal',
        version: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA!,
      },
    })
  : nextConfig
