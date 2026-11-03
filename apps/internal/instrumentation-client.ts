import posthog, { type CaptureResult } from 'posthog-js'

// Public invoice links carry their access token in the path. Keep it out of
// analytics: anyone with PostHog access would otherwise hold working links.
const SHARE_TOKEN_PATTERN = /(\/share\/invoices\/)[^/?#\s]+/g
const maskShareTokens = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return value.replace(SHARE_TOKEN_PATTERN, '$1[token]')
  }
  if (Array.isArray(value)) return value.map(maskShareTokens)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key, maskShareTokens(inner)])
    )
  }
  return value
}

// Event properties are small, so walk them all ($current_url, $referrer,
// $pathname, person properties, ...). Session-recording snapshots are large
// and skipped; the page itself never starts analytics (below).
const beforeSend = (event: CaptureResult | null) => {
  if (!event || event.event === '$snapshot') return event
  return {
    ...event,
    properties: maskShareTokens(
      event.properties
    ) as CaptureResult['properties'],
    $set: maskShareTokens(event.$set) as CaptureResult['$set'],
    $set_once: maskShareTokens(event.$set_once) as CaptureResult['$set_once'],
  }
}

// Dev sessions were flooding the production PostHog project with Turbopack
// build-error overlays, mid-edit HMR ReferenceErrors, and localhost analytics,
// so capture is limited to production builds. The public invoice page is
// for clients, not staff, so analytics don't start there at all. Also
// skipped when the key is unset, so a deployment without PostHog env vars
// still boots quietly (as in the client portal).
if (
  process.env.NODE_ENV === 'production' &&
  process.env.NEXT_PUBLIC_POSTHOG_KEY &&
  !window.location.pathname.startsWith('/share/')
) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: '/relay-HVAq/',
    ui_host: process.env.NEXT_PUBLIC_POSTHOG_HOST!,
    defaults: '2025-05-24',
    before_send: beforeSend,
    capture_exceptions: true,
    capture_heatmaps: true,
    capture_dead_clicks: true,
    capture_pageleave: true,
    capture_pageview: true,
    capture_performance: true,
  })
}
