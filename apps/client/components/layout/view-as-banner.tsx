'use client'

import { useTransition } from 'react'
import { CheckIcon, ChevronDownIcon, EyeIcon } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { PortalContactOption } from '@/lib/auth/view-as'
import { setViewAsContact } from '@/app/(portal)/_actions/set-view-as-contact'

type ViewAsBannerProps = {
  availableContacts: PortalContactOption[]
  viewingAsContactId: string | null
}

/**
 * Admin-only strip for previewing the portal as a given contact.
 *
 * Shows all non-deleted contacts; promoted contacts (those with a portal
 * account) display a "Portal" badge so admins can tell who has an account.
 *
 * Styled to be unmistakable so it can never be confused for the real client
 * view. Rendering is gated by the layout; the authority check lives in the
 * server action.
 */
export function ViewAsBanner({
  availableContacts,
  viewingAsContactId,
}: ViewAsBannerProps) {
  const [isPending, startTransition] = useTransition()

  const selectedContact =
    availableContacts.find(c => c.id === viewingAsContactId) ?? null

  return (
    <div className="border-b border-amber-500/40 bg-amber-500/10">
      <div className="mx-auto flex h-11 max-w-5xl items-center gap-3 px-4">
        <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-amber-700 uppercase dark:text-amber-500">
          <EyeIcon className="size-3.5" aria-hidden="true" />
          Admin preview
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={isPending || availableContacts.length === 0}
            className="flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-background px-2.5 py-1 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            {selectedContact?.name ?? 'Select a contact to preview'}
            <ChevronDownIcon className="size-3.5" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-80 w-72 overflow-y-auto">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Viewing as
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {availableContacts.map(contact => (
              <DropdownMenuItem
                key={contact.id}
                onSelect={() =>
                  startTransition(() => {
                    void setViewAsContact(contact.id)
                  })
                }
              >
                <CheckIcon
                  className={
                    contact.id === viewingAsContactId
                      ? 'size-3.5 opacity-100'
                      : 'size-3.5 opacity-0'
                  }
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate">{contact.name}</span>
                {contact.isPromoted && (
                  <span className="ml-2 shrink-0 rounded border border-amber-500/40 px-1 py-px text-[10px] font-medium leading-none text-amber-700 dark:text-amber-500">
                    Portal
                  </span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {selectedContact && (
          <span className="hidden text-xs text-muted-foreground sm:inline">
            You are seeing {selectedContact.name}&rsquo;s portal view.
          </span>
        )}
        {!selectedContact && (
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Select a contact above to preview the portal.
          </span>
        )}
      </div>
    </div>
  )
}
