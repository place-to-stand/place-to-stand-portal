'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'
import type { AppUser } from '@/lib/auth/session'
import { isNavItemActive } from '@/lib/navigation/active-route'
import { useTheme } from '@/components/providers/theme-provider'
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
} from '@/components/ui/sidebar'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'

import { UserMenu } from './user-menu'
import { NAV_GROUPS } from './navigation-config'
import PTSLogoBlackTransparent from '../../public/pts-logo-black-transparent.png'
import PTSLogoWhiteTransparent from '../../public/pts-logo-white-transparent.png'

const isDev = process.env.NODE_ENV === 'development'

type Props = {
  user: AppUser
  /** Count pills keyed by nav item href (e.g. unread submissions). */
  badges?: Record<string, number>
}

export function Sidebar({ user, badges }: Props) {
  const pathname = usePathname()
  const { theme, mounted: themeMounted } = useTheme()

  // Always start with black to match SSR; theme provider updates after mount.
  const logoSrc = useMemo(() => {
    if (!themeMounted) {
      return PTSLogoBlackTransparent
    }
    return theme === 'dark' ? PTSLogoWhiteTransparent : PTSLogoBlackTransparent
  }, [theme, themeMounted])

  return (
    <SidebarRoot collapsible='icon' className='border-r'>
      <SidebarHeader className='space-y-4 px-3 pt-6'>
        <div suppressHydrationWarning className='flex flex-col items-center'>
          <Link href='/my/home' className='block'>
            <Image
              key={logoSrc.src}
              src={logoSrc}
              alt='Place To Stand Agency logo'
              className='max-w-[140px] group-data-[collapsible=icon]:hidden'
            />
            <span
              aria-hidden='true'
              className='bg-primary text-primary-foreground hidden size-7 items-center justify-center rounded-md text-sm font-bold group-data-[collapsible=icon]:flex'
            >
              P
            </span>
          </Link>
        </div>
        {isDev ? (
          <>
            <div className='flex items-center justify-center gap-1.5 rounded bg-amber-500 px-2 py-1 text-[10px] font-semibold text-amber-950 group-data-[collapsible=icon]:hidden'>
              <span className='inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-amber-950/60' />
              Development
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className='mx-auto hidden size-2 animate-pulse rounded-full bg-amber-500 group-data-[collapsible=icon]:block' />
              </TooltipTrigger>
              <TooltipContent side='right'>Development</TooltipContent>
            </Tooltip>
          </>
        ) : (
          <Separator className='w-full' />
        )}
      </SidebarHeader>
      <SidebarContent className='px-1'>
        {NAV_GROUPS.map((group, index) => (
          <SidebarGroup key={group.title ?? `group-${index}`} className='py-1'>
            {group.title ? (
              <SidebarGroupLabel className='text-muted-foreground/60 h-auto px-1 pb-1 text-[11px] font-semibold tracking-wide uppercase'>
                {group.title}
              </SidebarGroupLabel>
            ) : null}
            <SidebarGroupContent>
              <SidebarMenu className='gap-0.5'>
                {group.items.map(item => {
                  const Icon = item.icon
                  const isActive = isNavItemActive(pathname, item)
                  const badgeCount = badges?.[item.href]

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.label}
                        className={cn(
                          'h-auto gap-2 rounded px-2 py-1.5 text-[12px]',
                          'data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:font-normal',
                          !isActive &&
                            'text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                      >
                        <Link
                          href={item.href}
                          aria-current={isActive ? 'page' : undefined}
                        >
                          <Icon className='size-3.5 shrink-0' />
                          <span>{item.label}</span>
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
                              'h-4 min-w-4 rounded-full px-1 text-[10px] font-semibold tabular-nums',
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
      <SidebarFooter className='px-3 py-3'>
        <UserMenu user={user} align='start' inSidebar />
      </SidebarFooter>
    </SidebarRoot>
  )
}
