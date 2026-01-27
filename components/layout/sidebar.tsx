'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'
import type { AppUser } from '@/lib/auth/session'

import { UserMenu } from './user-menu'
import Image from 'next/image'

import PTSLogoBlackTransparent from '../../public/pts-logo-black-transparent.png'
import PTSLogoWhiteTransparent from '../../public/pts-logo-white-transparent.png'
import { Separator } from '../ui/separator'

const isDev = process.env.NODE_ENV === 'development'
import { useTheme } from '@/components/providers/theme-provider'
import { NAV_GROUPS } from './navigation-config'

type Props = {
  user: AppUser
}

export function Sidebar({ user }: Props) {
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
                    {group.items.map(item => {
                      const Icon = item.icon
                      const matchCandidates = [
                        item.href,
                        ...(item.matchHrefs ?? []),
                      ]
                      const isActive = matchCandidates.some(matchHref => {
                        if (!matchHref) return false
                        return (
                          pathname === matchHref ||
                          pathname.startsWith(`${matchHref}/`)
                        )
                      })

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            'focus-visible:ring-primary focus-visible:ring-offset-background flex items-center gap-2 rounded px-2 py-1.5 text-[12px] transition focus-visible:ring-2 focus-visible:ring-offset-2',
                            isActive
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          )}
                          aria-current={isActive ? 'page' : undefined}
                        >
                          <Icon className='size-3.5 shrink-0' />
                          <span>{item.label}</span>
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
