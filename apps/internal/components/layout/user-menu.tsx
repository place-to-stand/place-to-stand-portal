'use client'

import { useState, useTransition } from 'react'
import { Loader2, LogOut, Moon, Sun, UserCog } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@pts/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@pts/ui/dropdown-menu'

import { cn } from '@/lib/utils'
import type { AppUser } from '@/lib/auth/session'
import { signOut } from '@/app/(dashboard)/_actions/sign-out'
import { useTheme } from '@/components/providers/theme-provider'

import { EditProfileDialog } from './edit-profile-dialog'

type Props = {
  user: AppUser
  align?: 'start' | 'center' | 'end'
  /** Sidebar-footer mode: collapses to a square avatar trigger in icon mode (PRD 004 §02). */
  inSidebar?: boolean
}

export function UserMenu({ user, align = 'end', inSidebar = false }: Props) {
  const [isPending, startTransition] = useTransition()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()

  const initials = user.full_name
    ? user.full_name
        .split(' ')
        .map(segment => segment[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : user.email.slice(0, 2).toUpperCase()
  const avatarSrc = user.avatar_url
    ? `/api/storage/user-avatar/${user.id}?v=${encodeURIComponent(user.updated_at ?? '')}`
    : null

  const handleProfileDialogChange = (open: boolean) => {
    setIsProfileDialogOpen(open)
    if (!open) {
      setIsMenuOpen(false)
    }
  }

  return (
    <>
      <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <DropdownMenuTrigger
          className={cn(
            'hover:bg-muted flex w-full items-center gap-2 rounded border px-2 py-1.5 text-[13px] font-medium transition',
            inSidebar &&
              'group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:px-0'
          )}
        >
          <Avatar className='h-6 w-6'>
            {avatarSrc ? (
              <AvatarImage src={avatarSrc} alt={user.full_name ?? user.email} />
            ) : null}
            <AvatarFallback className='text-[10px]'>{initials}</AvatarFallback>
          </Avatar>
          <div
            className={cn(
              'hidden min-w-0 flex-1 flex-col text-left leading-tight sm:flex',
              inSidebar && 'group-data-[collapsible=icon]:hidden'
            )}
          >
            <span className='truncate text-[13px] font-medium'>
              {user.full_name ?? user.email}
            </span>
            <span className='text-muted-foreground truncate text-[11px] capitalize'>
              {user.role.toLowerCase()}
            </span>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent className='w-56' align={align} forceMount>
          <DropdownMenuLabel>
            <div className='flex flex-col'>
              <span className='text-sm font-semibold'>
                {user.full_name ?? user.email}
              </span>
              <span className='text-muted-foreground text-xs'>
                {user.email}
              </span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              onSelect={event => {
                event.preventDefault()
                setIsMenuOpen(false)
                setIsProfileDialogOpen(true)
              }}
              className='flex items-center gap-2'
            >
              <UserCog className='h-4 w-4' />
              <span>Edit profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={event => {
                event.preventDefault()
                toggleTheme()
              }}
              className='flex items-center gap-2'
            >
              {theme === 'dark' ? (
                <Sun className='h-4 w-4' />
              ) : (
                <Moon className='h-4 w-4' />
              )}
              <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={isPending}
              onSelect={event => {
                event.preventDefault()
                setIsMenuOpen(false)
                startTransition(async () => {
                  await signOut()
                })
              }}
              className='flex items-center gap-2'
            >
              {isPending ? (
                <Loader2 className='h-4 w-4 animate-spin' />
              ) : (
                <LogOut className='h-4 w-4' />
              )}
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <EditProfileDialog
        user={user}
        open={isProfileDialogOpen}
        onOpenChange={handleProfileDialogChange}
      />
    </>
  )
}
