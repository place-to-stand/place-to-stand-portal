'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { UserRoundX } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@pts/ui/avatar'
import {
  ContextMenuItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from '@pts/ui/context-menu'

import { toastLink, useToast } from '@/components/ui/use-toast'
import type { AssigneeOption, SetAssigneeResult } from '@/lib/assignees/types'
import { ENTITY_ICONS } from '@/lib/entity-accents'
import { MUTED_STATE_MARK_CLASS } from '@/lib/entity-state-icon'
import { getJson } from '@/lib/http/get-json'
import type { SheetEntityKey } from '@/lib/sheets/entities'

export type AssigneeMenuConfig = {
  /** The record's current assignee; its row shows the check. */
  currentId: string | null
  /** The GET route listing who can take this record. */
  optionsUrl: string
  /** The server action: sets the assignee, or clears it with null. */
  set: (assigneeId: string | null) => Promise<SetAssigneeResult>
  /** The record's name, for the toast's link. */
  name: string
  /** Lists that hold their own copy of the record refetch it here. */
  onAssigned?: () => void
}

const Icon = ENTITY_ICONS.user

/**
 * "Set assignee ›" in a record's right-click menu: hovering it opens the
 * people who can take the record, with the current one checked, then
 * "Clear assignee". Picking one saves at once and confirms with a toast
 * that links to the record.
 */
export function AssigneeSubmenu({
  entity,
  id,
  currentId,
  optionsUrl,
  set,
  name,
  onAssigned,
}: AssigneeMenuConfig & { entity: SheetEntityKey; id: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  // Loads when the menu opens (the items mount only then), so the list is
  // usually there by the time the pointer reaches the submenu.
  const options = useQuery<AssigneeOption[]>({
    queryKey: ['assigneeOptions', optionsUrl],
    queryFn: () => getJson<AssigneeOption[]>(optionsUrl),
    staleTime: 30_000,
  })

  const choose = (assigneeId: string | null) => {
    if (assigneeId === currentId) return
    const assigneeName =
      options.data?.find(person => person.id === assigneeId)?.name ?? null
    startTransition(async () => {
      const result = await set(assigneeId).catch((): SetAssigneeResult => ({
        ok: false,
        error: 'Something went wrong. Try again.',
      }))
      if (!result.ok) {
        toast({
          variant: 'destructive',
          title: 'Unable to set assignee',
          description: result.error,
          link: toastLink(entity, id),
        })
        return
      }
      toast({
        title: assigneeName
          ? `Assigned to ${assigneeName}`
          : 'Assignee cleared',
        description: name,
        link: toastLink(entity, id),
      })
      onAssigned?.()
      router.refresh()
    })
  }

  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger disabled={isPending}>
        <Icon className={MUTED_STATE_MARK_CLASS} />
        Set assignee
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className='min-w-48'>
        {options.isPending ? (
          <ContextMenuItem disabled>Loading people…</ContextMenuItem>
        ) : options.isError ? (
          <ContextMenuItem disabled>Unable to load people.</ContextMenuItem>
        ) : (
          <ContextMenuRadioGroup value={currentId ?? ''}>
            {options.data.map(person => (
              <ContextMenuRadioItem
                key={person.id}
                value={person.id}
                closeOnClick
                onClick={() => choose(person.id)}
              >
                <PersonAvatar person={person} />
                <span className='truncate'>{person.name}</span>
              </ContextMenuRadioItem>
            ))}
          </ContextMenuRadioGroup>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem disabled={!currentId} onClick={() => choose(null)}>
          <UserRoundX />
          Clear assignee
        </ContextMenuItem>
      </ContextMenuSubContent>
    </ContextMenuSub>
  )
}

/** The same small avatar the assignee pickers show beside each name. */
function PersonAvatar({ person }: { person: AssigneeOption }) {
  return (
    <Avatar size='xs' className='ring-border shrink-0 ring-1'>
      {person.avatarUrl ? (
        <AvatarImage src={`/api/storage/user-avatar/${person.id}`} alt='' />
      ) : null}
      <AvatarFallback>{person.name.slice(0, 2).toUpperCase()}</AvatarFallback>
    </Avatar>
  )
}
