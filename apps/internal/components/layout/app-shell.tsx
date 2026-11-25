'use client'

import * as React from 'react'
import { Suspense, useMemo, type ReactNode } from 'react'

import type { AppUser } from '@/lib/auth/session'
import { SidebarProvider } from '@/components/ui/sidebar'
import { BusinessNameProvider } from '@/components/providers/business-name'
import { ViewerAccessProvider } from '@/components/providers/viewer-access-provider'

import { AccountSheet } from '@/components/account/account-sheet'
import { KeyboardShortcutsProvider } from '@/components/keyboard/keyboard-shortcuts-dialog'
import { GetHelpProvider } from '@/components/help/get-help-dialog'
import { WhatsNewProvider } from '@/components/help/whats-new-dialog'
import type { ChangelogWeek } from '@/lib/help/changelog-utils'

import { Sidebar, type SidebarBrand } from './sidebar'
import { CommandPaletteProvider } from './command-palette'
import { ListRefreshProvider } from './list-refresh'

interface Props {
  user: AppUser
  children: ReactNode
  unacknowledgedSubmissionsCount?: number
  /** Feedback reports nobody has looked at yet. */
  newFeedbackCount?: number
  /** Server-read `sidebar_state` cookie value. */
  sidebarDefaultOpen?: boolean
  /** Names sheet presence channels (`presenceRoomKey`). */
  presenceKey?: string
  /** The business name and uploaded images (Settings → Business). */
  brand: SidebarBrand
  /** A notice above every page (the business setup banner). */
  banner?: ReactNode
  /** What's new, from CHANGELOG.md, newest week first. */
  changelog: ChangelogWeek[]
}

/**
 * Dashboard chrome: sidebar + command palette + content column. Pages own
 * their header via `PageShell`: the shell renders no header row of its own,
 * so header ownership is server-known everywhere.
 */
export function AppShell({
  user,
  children,
  unacknowledgedSubmissionsCount,
  newFeedbackCount,
  sidebarDefaultOpen = true,
  presenceKey,
  brand,
  banner,
  changelog,
}: Props) {
  // Keyed by nav href so future counts (e.g. leads) reuse the same channel.
  const navBadges = useMemo(() => {
    const badges: Record<string, number> = {}
    if (unacknowledgedSubmissionsCount) {
      badges['/submissions'] = unacknowledgedSubmissionsCount
    }
    if (newFeedbackCount) badges['/feedback'] = newFeedbackCount
    return Object.keys(badges).length > 0 ? badges : undefined
  }, [unacknowledgedSubmissionsCount, newFeedbackCount])

  return (
    // Palette provider wraps the sidebar too: the search box lives there.
    // The shortcuts provider sits
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
          <GetHelpProvider>
            <WhatsNewProvider weeks={changelog}>
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
                  {/* Reads `?account=`; Suspense keeps the URL read client-only. */}
                  <Suspense fallback={null}>
                    <AccountSheet user={user} />
                  </Suspense>
                </SidebarProvider>
              </CommandPaletteProvider>
            </WhatsNewProvider>
          </GetHelpProvider>
        </KeyboardShortcutsProvider>
      </BusinessNameProvider>
    </ViewerAccessProvider>
  )
}
