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

const shouldUploadSourceMaps =
  process.env.DISABLE_POSTHOG_UPLOAD_SOURCEMAPS !== 'true'

export default withPostHogConfig(nextConfig, {
  personalApiKey: process.env.POSTHOG_PERSONAL_API_KEY!, // Your personal API key from PostHog settings
  envId: process.env.POSTHOG_PROJECT_ID!, // Your environment ID (project ID)
  host: process.env.NEXT_PUBLIC_POSTHOG_HOST!, // Optional: Your PostHog instance URL, defaults to https://us.posthog.com
  sourcemaps: {
    enabled: shouldUploadSourceMaps, // Optional: Enable sourcemaps generation and upload, defaults to true on production builds
    project: 'place-to-stand-portal', // Optional: Project name, defaults to git repository name
    version: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA!, // Optional: Release version, defaults to current git commit
  },
})
