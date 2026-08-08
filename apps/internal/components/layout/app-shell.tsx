'use client'

import { useMemo, type ReactNode } from 'react'

import type { AppUser } from '@/lib/auth/session'
import { SidebarProvider } from '@/components/ui/sidebar'

import { Sidebar } from './sidebar'
import { CommandPaletteProvider } from './command-palette'

interface Props {
  user: AppUser
  children: ReactNode
  unacknowledgedSubmissionsCount?: number
  /** Server-read `sidebar_state` cookie value (PRD 004 §02). */
  sidebarDefaultOpen?: boolean
}

/**
 * Dashboard chrome (PRD 004 §01/§02): sidebar + command palette + content
 * column. Pages own their header via `PageShell` — the shell renders no
 * header row of its own, so header ownership is server-known everywhere (R4).
 */
export function AppShell({
  user,
  children,
  unacknowledgedSubmissionsCount,
  sidebarDefaultOpen = true,
}: Props) {
  // Keyed by nav href so future counts (e.g. leads) reuse the same channel.
  const navBadges = useMemo(
    () =>
      unacknowledgedSubmissionsCount
        ? { '/submissions': unacknowledgedSubmissionsCount }
        : undefined,
    [unacknowledgedSubmissionsCount]
  )

  return (
    <SidebarProvider
      defaultOpen={sidebarDefaultOpen}
      className='bg-muted h-screen min-h-0 overflow-hidden'
    >
      <Sidebar user={user} badges={navBadges} />
      <CommandPaletteProvider>
        <div className='flex h-screen min-h-0 min-w-0 flex-1 flex-col'>
          {children}
        </div>
      </CommandPaletteProvider>
    </SidebarProvider>
  )
}
