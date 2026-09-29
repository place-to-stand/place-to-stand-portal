import posthog from 'posthog-js'

// Dev sessions were flooding the production PostHog project with Turbopack
// build-error overlays, mid-edit HMR ReferenceErrors, and localhost analytics,
// so capture is limited to production builds.
// Also skipped when the key is unset, so a deployment without PostHog env
// vars still boots quietly.
if (
  process.env.NODE_ENV === 'production' &&
  process.env.NEXT_PUBLIC_POSTHOG_KEY
) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: '/relay-HVAq/',
    ui_host: process.env.NEXT_PUBLIC_POSTHOG_HOST!,
    defaults: '2025-05-24',
    capture_exceptions: true,
    capture_heatmaps: true,
    capture_dead_clicks: true,
    capture_pageleave: true,
    capture_pageview: true,
    capture_performance: true,
  })
}
