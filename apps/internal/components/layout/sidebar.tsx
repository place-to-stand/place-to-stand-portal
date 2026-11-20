'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Search } from 'lucide-react'

import { BrandLogo, BrandLogoMark } from '@pts/ui/brand'

import { cn } from '@/lib/utils'
import type { AppUser } from '@/lib/auth/session'
import { isNavItemActive } from '@/lib/navigation/active-route'
import {
  Sidebar as SidebarRoot,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@pts/ui/tooltip'

import { ShortcutKeys } from '@/components/keyboard/shortcut-keys'
import { SHORTCUTS } from '@/lib/keyboard/shortcuts'

import { UserMenu } from './user-menu'
import { NavLinkPending } from './nav-link-pending'
import { useCommandPalette } from './command-palette'
import { NAV_GROUPS } from './navigation-config'
import { filterNavGroupsForRole, homePathForRole } from '@/lib/auth/roles'

const isDev = process.env.NODE_ENV === 'development'

export type SidebarBrand = {
  name: string
  logoSrc: string | null
  iconSrc: string | null
}

type Props = {
  user: AppUser
  brand: SidebarBrand
  /** Count pills keyed by nav item href (e.g. unread submissions). */
  badges?: Record<string, number>
}

export function Sidebar({ user, badges, brand }: Props) {
  const pathname = usePathname()
  const { state: sidebarState, setOpenMobile } = useSidebar()
  const { setOpen: setPaletteOpen } = useCommandPalette()
  // The item whose page is on its way. It takes the highlight at the click
  // rather than when the page lands, so the highlight never trails the
  // click, and a page from an earlier click in a quick burst can't light
  // its own item on the way through.
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const handlePendingChange = useCallback((href: string, pending: boolean) => {
    setPendingHref(current =>
      pending ? href : current === href ? null : current
    )
  }, [])
  const navGroups = useMemo(
    () => filterNavGroupsForRole(NAV_GROUPS, user.role),
    [user.role]
  )

  // The dashboard layout persists across client navigation, so the mobile
  // sheet stays open over the new page unless we close it on route change.
  useEffect(() => {
    setOpenMobile(false)
  }, [pathname, setOpenMobile])

  return (
    <SidebarRoot collapsible='icon' className='border-r'>
      {/* pt-4 above the logo and 13px (+ the header's 8px gap) below it put
          the search box on the same center line as the page tabs in
          PageShell. The dev-only badge pushes it down; production has none. */}
      <SidebarHeader className='space-y-[13px] px-3 pt-4 pb-4 group-data-[collapsible=icon]:space-y-3 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:pt-4'>
        <div className='flex flex-col items-center group-data-[collapsible=icon]:px-0'>
          <Link
            href={homePathForRole(user.role)}
            aria-label={`${brand.name} — home`}
            className='block'
          >
            <BrandLogo
              size='md'
              className='group-data-[collapsible=icon]:hidden'
              {...brand}
            />
            <BrandLogoMark
              size={20}
              name={brand.name}
              iconSrc={brand.iconSrc}
              className='mx-auto hidden group-data-[collapsible=icon]:flex'
            />
          </Link>
        </div>
        {isDev ? (
          <>
            <div className='text-micro flex items-center justify-center gap-1.5 rounded-sm bg-amber-500 px-2 py-1 font-semibold text-amber-950 group-data-[collapsible=icon]:hidden'>
              <span className='inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-amber-950/60' />
              Development
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className='mx-auto hidden size-2 animate-pulse rounded-full bg-amber-500 group-data-[collapsible=icon]:block' />
              </TooltipTrigger>
              <TooltipContent
                side='right'
                hidden={sidebarState !== 'collapsed'}
              >
                Development
              </TooltipContent>
            </Tooltip>
          </>
        ) : null}
        {/* Palette entry point, above the Portal group. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type='button'
              onClick={() => setPaletteOpen(true)}
              aria-label='Open command palette'
              className='text-muted-foreground hover:bg-muted hover:text-foreground border-input focus-visible:border-ring focus-visible:ring-ring/50 flex w-full cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-xs leading-normal transition outline-none group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:p-0 focus-visible:ring-[3px]'
            >
              <Search className='size-3.5 shrink-0' />
              <span className='group-data-[collapsible=icon]:hidden'>
                Search
              </span>
              <ShortcutKeys
                shortcut={SHORTCUTS.commandPalette}
                size='sm'
                className='ml-auto group-data-[collapsible=icon]:hidden'
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side='right' hidden={sidebarState !== 'collapsed'}>
            Search{' '}
            <ShortcutKeys shortcut={SHORTCUTS.commandPalette} size='sm' />
          </TooltipContent>
        </Tooltip>
      </SidebarHeader>
      <SidebarContent className='px-1 group-data-[collapsible=icon]:px-0'>
        {navGroups.map((group, index) => (
          <SidebarGroup key={group.title ?? `group-${index}`} className='py-1'>
            {group.title ? (
              <SidebarGroupLabel className='text-muted-foreground/60 text-overline h-6 px-1 pb-1 font-semibold tracking-wide uppercase duration-300 ease-in-out group-data-[collapsible=icon]:-mt-6 group-data-[collapsible=icon]:opacity-0'>
                {group.title}
              </SidebarGroupLabel>
            ) : null}
            <SidebarGroupContent>
              <SidebarMenu className='gap-0.5'>
                {group.items.map(item => {
                  const Icon = item.icon
                  // The page actually shown, for assistive tech.
                  const isCurrentPage = isNavItemActive(pathname, item)
                  const isActive = pendingHref
                    ? item.href === pendingHref
                    : isCurrentPage
                  const badgeCount = badges?.[item.href]

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.label}
                        className={cn(
                          'h-auto gap-2 rounded-sm px-2 py-1.5 text-xs leading-normal',
                          // No transitions at all. Width: snap between the
                          // full row and the icon square, since animating it
                          // squeezed each label to "Compan…". Colour: the
                          // highlight jumps from item to item, since a fade
                          // left the old item glowing beside the new one on
                          // quick clicks.
                          'transition-none',
                          'data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:font-normal',
                          // The primitive's hover swaps to the accent surface,
                          // inverting the active pill; just dim it instead.
                          'data-[active=true]:hover:bg-primary/90 data-[active=true]:hover:text-primary-foreground',
                          !isActive &&
                            'text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                      >
                        <Link
                          href={item.href}
                          aria-current={isCurrentPage ? 'page' : undefined}
                        >
                          <NavLinkPending
                            href={item.href}
                            onPendingChange={handlePendingChange}
                          />
                          <Icon className='size-3.5 shrink-0' />
                          <span className='transition-opacity duration-200 group-data-[collapsible=icon]:opacity-0'>
                            {item.label}
                          </span>
                          {badgeCount ? (
                            <span className='sr-only'>
                              ({badgeCount} unacknowledged)
                            </span>
                          ) : null}
                        </Link>
                      </SidebarMenuButton>
                      {badgeCount ? (
                        <>
                          <SidebarMenuBadge
                            aria-hidden='true'
                            className={cn(
                              'text-micro right-1.5 h-4 min-w-4 rounded-full px-1 font-semibold tabular-nums',
                              // The primitive swaps badge text to the accent
                              // color on hover/active — unreadable on our
                              // bg-primary pill; pin it in every state.
                              'peer-hover/menu-button:text-primary-foreground peer-data-[active=true]/menu-button:text-primary-foreground',
                              isActive
                                ? 'bg-primary-foreground/20 text-primary-foreground'
                                : 'bg-primary text-primary-foreground'
                            )}
                          >
                            {badgeCount > 99 ? '99+' : badgeCount}
                          </SidebarMenuBadge>
                          <span
                            aria-hidden='true'
                            className='bg-primary absolute top-1 right-1 hidden size-1.5 rounded-full group-data-[collapsible=icon]:block'
                          />
                        </>
                      ) : null}
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className='px-3 py-3 group-data-[collapsible=icon]:px-1'>
        <UserMenu user={user} align='start' inSidebar />
      </SidebarFooter>
    </SidebarRoot>
  )
}
