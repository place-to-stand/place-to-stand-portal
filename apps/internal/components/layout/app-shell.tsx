'use client'

import * as React from 'react'
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
    // Palette provider wraps the sidebar too — the search affordance lives
    // there (user-revised placement of PW1).
    <CommandPaletteProvider>
      <SidebarProvider
        defaultOpen={sidebarDefaultOpen}
        style={{ '--sidebar-width': '13rem' } as React.CSSProperties}
        className='bg-muted h-screen min-h-0 overflow-hidden'
      >
        <Sidebar user={user} badges={navBadges} />
        <div className='flex h-screen min-h-0 min-w-0 flex-1 flex-col'>
          {children}
        </div>
      </SidebarProvider>
    </CommandPaletteProvider>
  )
}
