'use client'

import * as React from 'react'
import { useMemo, type ReactNode } from 'react'

import type { AppUser } from '@/lib/auth/session'
import { SidebarProvider } from '@/components/ui/sidebar'
import { BusinessNameProvider } from '@/components/providers/business-name'
import { ViewerAccessProvider } from '@/components/providers/viewer-access-provider'

import { KeyboardShortcutsProvider } from '@/components/keyboard/keyboard-shortcuts-dialog'

import { Sidebar, type SidebarBrand } from './sidebar'
import { CommandPaletteProvider } from './command-palette'
import { ListRefreshProvider } from './list-refresh'

interface Props {
  user: AppUser
  children: ReactNode
  unacknowledgedSubmissionsCount?: number
  /** Server-read `sidebar_state` cookie value (PRD 004 §02). */
  sidebarDefaultOpen?: boolean
  /** Names sheet presence channels (`presenceRoomKey`). */
  presenceKey?: string
  /** The business name and uploaded images (Settings → Business). */
  brand: SidebarBrand
  /** A notice above every page (the business setup banner). */
  banner?: ReactNode
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
  presenceKey,
  brand,
  banner,
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
    // there (user-revised placement of PW1). The shortcuts provider sits
    // outside it so the palette and the user menu can both open the list.
    <ViewerAccessProvider
      role={user.role}
      userId={user.id}
      name={user.full_name ?? user.email}
      hasPhoto={Boolean(user.avatar_url)}
      presenceKey={presenceKey}
    >
      <BusinessNameProvider name={brand.name}>
        <KeyboardShortcutsProvider>
          <CommandPaletteProvider>
            <SidebarProvider
              defaultOpen={sidebarDefaultOpen}
              style={{ '--sidebar-width': '13rem' } as React.CSSProperties}
              className='bg-muted h-dvh min-h-0 overflow-hidden'
            >
              <Sidebar user={user} badges={navBadges} brand={brand} />
              <div className='flex h-dvh min-h-0 min-w-0 flex-1 flex-col'>
                {banner}
                <ListRefreshProvider>{children}</ListRefreshProvider>
              </div>
            </SidebarProvider>
          </CommandPaletteProvider>
        </KeyboardShortcutsProvider>
      </BusinessNameProvider>
    </ViewerAccessProvider>
  )
}
