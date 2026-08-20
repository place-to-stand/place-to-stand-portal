'use client'

import { useMemo, useState, useTransition } from 'react'
import { UserRoundPlus } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@pts/ui/avatar'
import { SearchableCombobox } from '@/components/ui/searchable-combobox'
import {
  buildOwnerOptions,
  type AdminUserForOwner,
} from '@/lib/settings/projects/project-sheet-ui-state'
import { cn } from '@/lib/utils'

export type ProjectOwnerSummary = {
  id: string
  full_name: string | null
  avatar_url: string | null
}

export type ProjectOwnerCellProps = {
  projectId: string
  owner: ProjectOwnerSummary | null
  admins: AdminUserForOwner[]
  /** Throw on failure so the cell can roll back its optimistic owner. */
  onOwnerChange: (projectId: string, ownerId: string | null) => Promise<void>
}

function getInitials(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

/**
 * Owner avatar as an instant table-row control: clicking it opens the same
 * searchable owner picker the project edit sheet uses, and picking someone
 * saves immediately with optimistic state + rollback (the ProjectStatusCell
 * precedent — table-row controls may mutate instantly, sheets apply on save).
 */
export function ProjectOwnerCell({
  projectId,
  owner,
  admins,
  onOwnerChange,
}: ProjectOwnerCellProps) {
  const [isPending, startTransition] = useTransition()
  const [optimisticOwnerId, setOptimisticOwnerId] = useState<string | null>(
    owner?.id ?? null
  )

  // Adopt server updates (router.refresh after save) over stale optimism.
  const serverOwnerId = owner?.id ?? null
  const [prevServerOwnerId, setPrevServerOwnerId] = useState(serverOwnerId)
  if (prevServerOwnerId !== serverOwnerId) {
    setPrevServerOwnerId(serverOwnerId)
    setOptimisticOwnerId(serverOwnerId)
  }

  const ownerOptions = useMemo(() => buildOwnerOptions(admins), [admins])

  // While optimistic, the new owner's display data comes from the admin
  // directory; once the refresh lands, the server row takes over again.
  const displayOwner = useMemo<ProjectOwnerSummary | null>(() => {
    if (optimisticOwnerId === serverOwnerId) {
      return owner
    }

    if (!optimisticOwnerId) {
      return null
    }

    const admin = admins.find(entry => entry.id === optimisticOwnerId)
    return admin
      ? {
          id: admin.id,
          full_name: admin.full_name ?? admin.email,
          avatar_url: admin.avatar_url,
        }
      : null
  }, [admins, optimisticOwnerId, owner, serverOwnerId])

  const handleChange = (value: string) => {
    const nextOwnerId = value ? value : null

    if (nextOwnerId === optimisticOwnerId) {
      return
    }

    const previousOwnerId = optimisticOwnerId
    setOptimisticOwnerId(nextOwnerId)

    startTransition(async () => {
      try {
        await onOwnerChange(projectId, nextOwnerId)
      } catch {
        setOptimisticOwnerId(previousOwnerId)
      }
    })
  }

  const triggerLabel = displayOwner
    ? `Change owner (currently ${displayOwner.full_name ?? 'unnamed'})`
    : 'Assign owner'

  return (
    <SearchableCombobox
      items={ownerOptions}
      value={optimisticOwnerId ?? ''}
      onChange={handleChange}
      searchPlaceholder='Search team members...'
      emptyMessage='No team members found.'
      className='w-fit'
      trigger={
        <button
          type='button'
          disabled={isPending}
          aria-label={triggerLabel}
          title={displayOwner?.full_name ?? 'Assign owner'}
          className={cn(
            'focus-visible:ring-ring hover:ring-ring/50 cursor-pointer rounded-full transition-shadow hover:ring-2 focus:outline-none focus-visible:ring-2',
            isPending && 'animate-pulse'
          )}
        >
          {displayOwner ? (
            <Avatar className='h-7 w-7'>
              {displayOwner.avatar_url && (
                <AvatarImage
                  src={`/api/storage/user-avatar/${displayOwner.id}`}
                  alt={displayOwner.full_name ?? 'Owner'}
                />
              )}
              <AvatarFallback className='text-xs'>
                {getInitials(displayOwner.full_name)}
              </AvatarFallback>
            </Avatar>
          ) : (
            <Avatar className='h-7 w-7 border border-dashed'>
              <AvatarFallback className='bg-transparent'>
                <UserRoundPlus className='text-muted-foreground/60 h-3.5 w-3.5' />
              </AvatarFallback>
            </Avatar>
          )}
        </button>
      }
    />
  )
}
