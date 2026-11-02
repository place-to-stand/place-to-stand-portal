'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'
import posthog from 'posthog-js'

type ErrorBoundaryProps = {
  /** Shown in place of the children after they throw. */
  fallback: ReactNode
  /** Tagged on the PostHog capture, e.g. "widget:pipeline". */
  scope: string
  children: ReactNode
}

/**
 * Contains a render error to one part of a page (a dashboard widget) so the
 * rest keeps working. Reports to PostHog like every error.tsx boundary.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    posthog.captureException(error, {
      scope: this.props.scope,
      componentStack: info.componentStack,
    })
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
