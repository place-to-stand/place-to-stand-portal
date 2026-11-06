'use client'

import type { ReactNode } from 'react'

import { TooltipProvider } from '@pts/ui/tooltip'

import { Toaster } from '@/components/ui/toaster'

import { ReactQueryProvider } from './react-query-provider'
import { PostHogProvider } from './posthog-provider'
import { ThemeProvider } from './theme-provider'

type Props = {
  children: ReactNode
}

export function AppProviders({ children }: Props) {
  return (
    <PostHogProvider>
      <ThemeProvider>
        <ReactQueryProvider>
          <TooltipProvider>
            {children}
            <Toaster />
          </TooltipProvider>
        </ReactQueryProvider>
      </ThemeProvider>
    </PostHogProvider>
  )
}
