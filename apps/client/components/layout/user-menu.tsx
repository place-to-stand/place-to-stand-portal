'use client'

import { ChevronDownIcon } from 'lucide-react'

import { Button } from '@pts/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@pts/ui/dropdown-menu'
import type { PortalClientOption } from '@/lib/auth/view-as'
import { SignOutMenuItem } from './sign-out-button'
import { ThemeToggleMenuItem } from './theme-toggle'

type UserMenuProps = {
  email: string
  /** The signed-in person's name, when their person record has one. */
  fullName: string | null
  /** Clients this session is scoped to. Listed inside the menu. */
  scopedClients: PortalClientOption[]
}

/** The first word of the person's name, else the email's local part. */
export function menuFirstName(fullName: string | null, email: string) {
  const first = fullName?.trim().split(/\s+/)[0]
  return first || email.split('@')[0] || email
}

/**
 * Account and session controls, labelled with the signed-in person's first
 * name (whose companies, email and sign-out these are). The client name is
 * the dashboard's own title.
 */
export function UserMenu({ email, fullName, scopedClients }: UserMenuProps) {
  const firstName = menuFirstName(fullName, email)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          size='sm'
          className='min-w-0'
          // Starts with the visible name (WCAG 2.5.3), then says what it is.
          aria-label={`${firstName}, your menu`}
        >
          <span className='truncate'>{firstName}</span>
          <ChevronDownIcon aria-hidden='true' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-60'>
        {scopedClients.length > 0 && (
          <>
            {/* Only worth a heading when there is a list to head. A single
                company name needs no further label. */}
            {scopedClients.length > 1 && (
              <DropdownMenuLabel className='text-muted-foreground text-xs font-normal'>
                Your companies
              </DropdownMenuLabel>
            )}
            {scopedClients.map(client => (
              <DropdownMenuLabel
                key={client.id}
                className='text-foreground py-1 font-normal'
              >
                <span className='block truncate text-sm'>{client.name}</span>
              </DropdownMenuLabel>
            ))}
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuLabel className='font-normal'>
          <span className='text-muted-foreground block truncate text-sm'>
            {email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ThemeToggleMenuItem />
        <SignOutMenuItem />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
