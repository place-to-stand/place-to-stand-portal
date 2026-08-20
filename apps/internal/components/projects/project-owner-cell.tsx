'use client'

import { useState, useTransition } from 'react'
import { ChevronDown, Loader2, UserX } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@pts/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@pts/ui/dropdown-menu'
import { cn } from '@/lib/utils'

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
    return (
      <span
        className={cn(
          'border-muted-foreground/30 text-muted-foreground/50 flex items-center justify-center rounded-full border border-dashed',
          className
        )}
      >
        <UserX className='h-3.5 w-3.5' aria-hidden />
      </span>
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
 * Inline owner picker for the projects landing — the owner column's sibling
 * of `ProjectStatusCell`: same hover surface, same reveal-on-hover caret,
 * same optimistic swap with rollback on failure.
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
  const [isOpen, setIsOpen] = useState(false)

  const handleSelect = (next: ProjectOwnerOption | null) => {
    if ((next?.id ?? null) === (optimisticOwner?.id ?? null)) {
      setIsOpen(false)
      return
    }

    setOptimisticOwner(next)
    setIsOpen(false)

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
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger
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
        onClick={event => {
          // The whole row navigates on click — the picker must not.
          event.stopPropagation()
        }}
      >
        {isPending ? (
          <span className='flex h-7 w-7 items-center justify-center'>
            <Loader2 className='text-muted-foreground h-4 w-4 animate-spin' />
          </span>
        ) : (
          <OwnerAvatar owner={optimisticOwner} className='h-7 w-7' />
        )}
        <ChevronDown className='text-foreground/70 h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100' />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align='start'
        onClick={event => event.stopPropagation()}
      >
        {options.map(option => (
          <DropdownMenuItem
            key={option.id}
            onClick={() => handleSelect(option)}
            className={cn(
              'cursor-pointer gap-2',
              option.id === optimisticOwner?.id && 'bg-accent/50'
            )}
          >
            <OwnerAvatar owner={option} className='h-5 w-5' />
            {option.name}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem
          onClick={() => handleSelect(null)}
          className={cn(
            'text-muted-foreground cursor-pointer gap-2',
            !optimisticOwner && 'bg-accent/50'
          )}
        >
          <UserX className='h-4 w-4' aria-hidden />
          Unassigned
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
