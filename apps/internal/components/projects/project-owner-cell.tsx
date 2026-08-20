'use client'

import { useMemo, useState, useTransition } from 'react'
import { ChevronDown, Loader2, User } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@pts/ui/avatar'
import {
  SearchableCombobox,
  type SearchableComboboxItem,
} from '@/components/ui/searchable-combobox'
import { cn } from '@/lib/utils'

const UNASSIGNED_VALUE = '__UNASSIGNED__'

export type ProjectOwnerOption = {
  id: string
  name: string
  avatarUrl: string | null
}

export type ProjectOwnerCellProps = {
  projectId: string
  owner: ProjectOwnerOption | null
  options: ProjectOwnerOption[]
  onOwnerChange: (projectId: string, ownerId: string | null) => Promise<void>
  disabled?: boolean
  className?: string
}

const getInitials = (name: string) =>
  name
    .split(/\s+/)
    .map(part => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?'

function OwnerAvatar({
  owner,
  className,
}: {
  owner: ProjectOwnerOption | null
  className?: string
}) {
  if (!owner) {
    // Same muted icon-avatar the assignee dropdown gives its Unassigned row.
    return (
      <Avatar className={className}>
        <AvatarFallback className='bg-muted'>
          <User className='text-muted-foreground h-3.5 w-3.5' aria-hidden />
        </AvatarFallback>
      </Avatar>
    )
  }

  return (
    <Avatar className={className}>
      {owner.avatarUrl && (
        <AvatarImage
          src={`/api/storage/user-avatar/${owner.id}`}
          alt={owner.name}
        />
      )}
      <AvatarFallback className='text-xs'>
        {getInitials(owner.name)}
      </AvatarFallback>
    </Avatar>
  )
}

/**
 * Inline owner picker for the projects landing. The trigger mirrors
 * `ProjectStatusCell` (hover surface + reveal-on-hover caret); the popup IS
 * the task sheet's assignee dropdown — the same SearchableCombobox with the
 * same search input, avatar rows, and Unassigned entry.
 */
export function ProjectOwnerCell({
  projectId,
  owner,
  options,
  onOwnerChange,
  disabled,
  className,
}: ProjectOwnerCellProps) {
  const [isPending, startTransition] = useTransition()
  const [optimisticOwner, setOptimisticOwner] = useState(owner)

  const items = useMemo<SearchableComboboxItem[]>(
    () => [
      {
        value: UNASSIGNED_VALUE,
        label: 'Unassigned',
        keywords: ['unassigned'],
        icon: User,
      },
      ...options.map(option => ({
        value: option.id,
        label: option.name,
        keywords: ['admin'],
        userId: option.id,
        avatarUrl: option.avatarUrl,
      })),
    ],
    [options]
  )

  const handleChange = (nextValue: string) => {
    const next =
      nextValue === UNASSIGNED_VALUE
        ? null
        : (options.find(option => option.id === nextValue) ?? null)

    if ((next?.id ?? null) === (optimisticOwner?.id ?? null)) {
      return
    }

    setOptimisticOwner(next)

    startTransition(async () => {
      try {
        await onOwnerChange(projectId, next?.id ?? null)
      } catch {
        setOptimisticOwner(owner)
      }
    })
  }

  if (disabled) {
    return (
      <OwnerAvatar owner={optimisticOwner} className={cn('h-7 w-7', className)} />
    )
  }

  return (
    <SearchableCombobox
      className='w-auto'
      items={items}
      value={optimisticOwner?.id ?? UNASSIGNED_VALUE}
      onChange={handleChange}
      searchPlaceholder='Search collaborators...'
      emptyMessage='No eligible collaborators found.'
      disabled={isPending}
      renderTrigger={() => (
        <button
          type='button'
          className={cn(
            'group focus-visible:ring-ring hover:bg-accent/60 -mx-1 inline-flex cursor-pointer items-center gap-1.5 rounded-md p-1 focus:outline-none focus-visible:ring-2',
            className
          )}
          disabled={isPending}
          aria-label={
            optimisticOwner
              ? `Change owner (currently ${optimisticOwner.name})`
              : 'Set project owner'
          }
          // The whole row navigates on click — the picker must not. Plain
          // onClick (not capture): React delegates events at the root, so a
          // capture-phase stopPropagation would also silence the popover
          // trigger's own merged handler.
          onClick={event => event.stopPropagation()}
        >
          {isPending ? (
            <span className='flex h-7 w-7 items-center justify-center'>
              <Loader2 className='text-muted-foreground h-4 w-4 animate-spin' />
            </span>
          ) : (
            <OwnerAvatar owner={optimisticOwner} className='h-7 w-7' />
          )}
          <ChevronDown className='text-foreground/70 h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100' />
        </button>
      )}
    />
  )
}
