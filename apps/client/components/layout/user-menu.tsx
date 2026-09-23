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
  /** Clients this session is scoped to. Listed inside the menu. */
  scopedClients: PortalClientOption[]
}

/**
 * Account and session controls. Labelled for what the menu does, not for whose
 * data is on screen — the client name is the dashboard's own title.
 */
export function UserMenu({ email, scopedClients }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' size='sm' className='min-w-0'>
          <span className='truncate'>Account</span>
          <ChevronDownIcon aria-hidden='true' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-60'>
        {scopedClients.length > 0 && (
          <>
            {/* Only worth a heading when there is a list to head. A single name
                under an "Account" trigger needs no further label. */}
            {scopedClients.length > 1 && (
              <DropdownMenuLabel className='text-muted-foreground text-xs font-normal'>
                Your accounts
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
