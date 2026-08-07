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
import type { PortalClientOption } from '@/lib/auth/view-as'
import { setViewAsClient } from '@/app/(portal)/_actions/set-view-as-client'

type ViewAsBannerProps = {
  availableClients: PortalClientOption[]
  viewingAsClientId: string | null
}

/**
 * Admin-only strip for previewing the portal as a given client.
 *
 * Styled to be unmistakable so it can never be confused for the real client
 * view. Rendering is gated by the layout; the authority check lives in the
 * server action.
 */
export function ViewAsBanner({
  availableClients,
  viewingAsClientId,
}: ViewAsBannerProps) {
  const [isPending, startTransition] = useTransition()

  const selectedClient =
    availableClients.find(client => client.id === viewingAsClientId) ?? null

  return (
    <div className="border-b border-amber-500/40 bg-amber-500/10">
      <div className="mx-auto flex h-11 max-w-5xl items-center gap-3 px-4">
        <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-amber-700 uppercase dark:text-amber-500">
          <EyeIcon className="size-3.5" aria-hidden="true" />
          Admin preview
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={isPending || availableClients.length === 0}
            className="flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-background px-2.5 py-1 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            {selectedClient?.name ?? 'Select a client to preview'}
            <ChevronDownIcon className="size-3.5" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-80 w-64 overflow-y-auto">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Viewing as
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {availableClients.map(client => (
              <DropdownMenuItem
                key={client.id}
                onSelect={() =>
                  startTransition(() => {
                    void setViewAsClient(client.id)
                  })
                }
              >
                <CheckIcon
                  className={
                    client.id === viewingAsClientId
                      ? 'size-3.5 opacity-100'
                      : 'size-3.5 opacity-0'
                  }
                  aria-hidden="true"
                />
                <span className="truncate">{client.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="hidden text-xs text-muted-foreground sm:inline">
          You are seeing this client&rsquo;s portal, not your own.
        </span>
      </div>
    </div>
  )
}
