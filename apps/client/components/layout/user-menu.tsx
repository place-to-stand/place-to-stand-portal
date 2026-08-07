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

type UserMenuProps = {
  email: string
  /** Clients this session is scoped to. Drives the header label. */
  scopedClients: PortalClientOption[]
}

/**
 * Shows the client name rather than a user avatar, so it is always obvious
 * whose account is on screen.
 */
export function UserMenu({ email, scopedClients }: UserMenuProps) {
  const label = buildLabel(scopedClients, email)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex min-w-0 items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-foreground outline-none hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring">
        <span className="truncate">{label}</span>
        <ChevronDownIcon className="size-3.5 shrink-0" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {scopedClients.length > 0 && (
          <>
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              {scopedClients.length > 1 ? 'Your accounts' : 'Account'}
            </DropdownMenuLabel>
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
        <DropdownMenuItem>
          <SignOutButton />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function buildLabel(clients: PortalClientOption[], email: string): string {
  if (clients.length === 1) return clients[0].name
  if (clients.length > 1) return `${clients[0].name} +${clients.length - 1}`
  // Admins previewing with nothing selected, or a user with no memberships.
  return email
}
