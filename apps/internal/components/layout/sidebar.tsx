'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ExternalLink } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { AppUser } from '@/lib/auth/session'

import { UserMenu } from './user-menu'
import Image from 'next/image'

import PTSLogoBlackTransparent from '../../public/pts-logo-black-transparent.png'
import PTSLogoWhiteTransparent from '../../public/pts-logo-white-transparent.png'
import { Separator } from '../ui/separator'
import { useTheme } from '@/components/providers/theme-provider'
import { NAV_GROUPS } from './navigation-config'

const isDev = process.env.NODE_ENV === 'development'

type Props = {
  user: AppUser
  /** Count pills keyed by nav item href (e.g. unread submissions). */
  badges?: Record<string, number>
}

export function Sidebar({ user, badges }: Props) {
  const pathname = usePathname()
  const role = user.role
  const { theme, mounted: themeMounted } = useTheme()

  // Compute logo source - always start with black to match SSR, then update after mount
  const logoSrc = useMemo(() => {
    // During SSR or initial render, always return black to avoid hydration mismatch
    // The theme provider will update this after mount
    if (!themeMounted) {
      return PTSLogoBlackTransparent
    }

    // After theme provider is mounted, use theme from context
    return theme === 'dark' ? PTSLogoWhiteTransparent : PTSLogoBlackTransparent
  }, [theme, themeMounted])

  return (
    <aside className='bg-background/90 hidden h-screen w-56 shrink-0 overflow-y-auto border-r md:flex md:flex-col'>
      <div className='flex flex-1 flex-col'>
        <div className='space-y-6 px-3 py-6'>
          <div suppressHydrationWarning className='flex flex-col items-center'>
            <Link href='/my/home' className='block'>
              <Image
                key={logoSrc.src}
                src={logoSrc}
                alt='Place To Stand Agency logo'
                className='max-w-[140px]'
              />
            </Link>
          </div>
          {isDev ? (
            <div className='bg-amber-500 text-amber-950 flex items-center justify-center gap-1.5 rounded px-2 py-1 text-[10px] font-semibold'>
              <span className='inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-amber-950/60' />
              Development
            </div>
          ) : (
            <Separator className='w-full' />
          )}
          <nav className='space-y-6'>
            {NAV_GROUPS.filter(group => group.roles.includes(role)).map(
              (group, index) => (
                <div
                  key={group.title ?? `group-${index}`}
                  className='space-y-0.5'
                >
                  {group.title ? (
                    <p className='text-muted-foreground/60 mb-1 px-1 text-[11px] font-semibold tracking-wide uppercase'>
                      {group.title}
                    </p>
                  ) : null}
                  <div className='space-y-0.5'>
                    {group.items
                      .filter(item => !item.roles || item.roles.includes(role))
                      .map(item => {
                        const Icon = item.icon
                        const matchCandidates = [
                          item.href,
                          ...(item.matchHrefs ?? []),
                        ]
                        const isActive =
                          !item.external &&
                          matchCandidates.some(matchHref => {
                            if (!matchHref) return false
                            return (
                              pathname === matchHref ||
                              pathname.startsWith(`${matchHref}/`)
                            )
                          })
                        const linkClassName = cn(
                          'focus-visible:ring-primary focus-visible:ring-offset-background flex items-center gap-2 rounded px-2 py-1.5 text-[12px] transition focus-visible:ring-2 focus-visible:ring-offset-2',
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        )

                        if (item.external) {
                          return (
                            <a
                              key={item.href}
                              href={item.href}
                              target='_blank'
                              rel='noopener noreferrer'
                              className={linkClassName}
                            >
                              <Icon className='size-3.5 shrink-0' />
                              <span>{item.label}</span>
                              <ExternalLink
                                className='ml-auto size-3 shrink-0 opacity-60'
                                aria-hidden='true'
                              />
                              <span className='sr-only'>
                                (opens in a new tab)
                              </span>
                            </a>
                          )
                        }

                        const badgeCount = badges?.[item.href]

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={linkClassName}
                            aria-current={isActive ? 'page' : undefined}
                          >
                            <Icon className='size-3.5 shrink-0' />
                            <span>{item.label}</span>
                            {badgeCount ? (
                              <>
                                <span
                                  className={cn(
                                    'ml-auto inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums',
                                    isActive
                                      ? 'bg-primary-foreground/20 text-primary-foreground'
                                      : 'bg-primary text-primary-foreground'
                                  )}
                                  aria-hidden='true'
                                >
                                  {badgeCount > 99 ? '99+' : badgeCount}
                                </span>
                                <span className='sr-only'>
                                  ({badgeCount} unacknowledged)
                                </span>
                              </>
                            ) : null}
                          </Link>
                        )
                      })}
                  </div>
                </div>
              )
            )}
          </nav>
        </div>
        <div className='mt-auto px-3 py-3'>
          <UserMenu user={user} align='start' />
        </div>
      </div>
    </aside>
  )
}
