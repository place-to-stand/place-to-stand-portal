'use client'

import { ChevronDownIcon } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { PortalClientOption } from '@/lib/auth/view-as'
import { SignOutButton } from './sign-out-button'
import { ThemeToggle } from './theme-toggle'

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
      <DropdownMenuTrigger className="flex min-w-0 items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-foreground outline-none hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring">
        <span className="truncate">Account</span>
        <ChevronDownIcon className="size-3.5 shrink-0" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {scopedClients.length > 0 && (
          <>
            {/* Only worth a heading when there is a list to head. A single name
                under an "Account" trigger needs no further label. */}
            {scopedClients.length > 1 && (
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                Your accounts
              </DropdownMenuLabel>
            )}
            {scopedClients.map(client => (
              <DropdownMenuLabel
                key={client.id}
                className="py-1 font-normal text-foreground"
              >
                <span className="block truncate text-sm">{client.name}</span>
              </DropdownMenuLabel>
            ))}
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm text-muted-foreground">
            {email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={event => event.preventDefault()}>
          <ThemeToggle />
        </DropdownMenuItem>
        <DropdownMenuItem>
          <SignOutButton />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
