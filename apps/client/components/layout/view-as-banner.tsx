'use client'

import { useTransition } from 'react'
import { CheckIcon, ChevronDownIcon, EyeIcon } from 'lucide-react'

import { Button } from '@pts/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@pts/ui/dropdown-menu'
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
    <div className='border-b border-amber-500/40 bg-amber-500/10'>
      <div className='mx-auto flex h-11 max-w-5xl items-center gap-3 px-4'>
        <span className='flex items-center gap-1.5 text-xs font-semibold tracking-wide text-amber-700 uppercase dark:text-amber-500'>
          <EyeIcon className='size-3.5' aria-hidden='true' />
          Admin preview
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger
            asChild
            disabled={isPending || availableContacts.length === 0}
          >
            {/* The amber edge ties the control to the preview band. */}
            <Button
              variant='outline'
              size='sm'
              className='border-amber-500/40 dark:border-amber-500/40'
            >
              {selectedContact?.name ?? 'Select a contact to preview'}
              <ChevronDownIcon aria-hidden='true' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className='max-h-80 w-72 overflow-y-auto'>
            <DropdownMenuLabel className='text-muted-foreground text-xs font-normal'>
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
                      ? 'opacity-100'
                      : 'opacity-0'
                  }
                  aria-hidden='true'
                />
                <span className='min-w-0 flex-1 truncate'>{contact.name}</span>
                {contact.isPromoted && (
                  <span className='shrink-0 rounded border border-amber-500/40 px-1 py-px text-[10px] leading-none font-semibold text-amber-700 dark:text-amber-500'>
                    Portal
                  </span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {selectedContact && (
          <span className='text-muted-foreground hidden text-xs sm:inline'>
            You are seeing {selectedContact.name}&rsquo;s portal view.
          </span>
        )}
        {!selectedContact && (
          <span className='text-muted-foreground hidden text-xs sm:inline'>
            Select a contact above to preview the portal.
          </span>
        )}
      </div>
    </div>
  )
}
