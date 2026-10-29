'use client'

import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useWatch, type UseFormReturn } from 'react-hook-form'
import { Plus, X } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@pts/ui/avatar'
import { Button } from '@pts/ui/button'
import { Skeleton } from '@pts/ui/skeleton'
import {
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form'
import { SearchableCombobox } from '@/components/ui/searchable-combobox'
import type { ProjectSheetFormValues } from '@/lib/settings/projects/use-project-sheet-state'

import {
  buildMemberOptions,
  memberInitials,
  type MemberCandidate,
} from './project-members-utils'

type ProjectMembersResponse = {
  candidates: MemberCandidate[]
  memberIds: string[]
}

type ProjectMembersFieldProps = {
  form: UseFormReturn<ProjectSheetFormValues>
  projectId?: string
  disabled?: boolean
}

export const projectMembersQueryKey = (projectId: string | null) =>
  ['projectMembers', projectId] as const

/**
 * Sales users who may see this project. Admins see every project, so only
 * non-admin staff are offered. The list loads with the sheet; until it has,
 * the field stays undefined and a save leaves members untouched.
 */
export function ProjectMembersField({
  form,
  projectId,
  disabled = false,
}: ProjectMembersFieldProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: projectMembersQueryKey(projectId ?? null),
    queryFn: async (): Promise<ProjectMembersResponse> => {
      const query = projectId ? `?projectId=${projectId}` : ''
      const response = await fetch(`/api/project-members${query}`)
      if (!response.ok) {
        throw new Error('Unable to load project members.')
      }
      return response.json()
    },
    staleTime: 0,
  })

  const memberIds = useWatch({ control: form.control, name: 'memberIds' })

  // Seed the field as its default (so loading doesn't mark the sheet dirty)
  // whenever it is unset: on first load and after the sheet resets on reopen.
  useEffect(() => {
    if (!data || memberIds !== undefined) return
    form.resetField('memberIds', { defaultValue: data.memberIds })
  }, [data, form, memberIds])

  const candidates = useMemo(() => data?.candidates ?? [], [data])
  const members = useMemo(
    () =>
      (memberIds ?? [])
        .map(id => candidates.find(candidate => candidate.id === id))
        .filter((candidate): candidate is MemberCandidate =>
          Boolean(candidate)
        ),
    [candidates, memberIds]
  )
  const options = useMemo(
    () => buildMemberOptions(candidates, memberIds ?? []),
    [candidates, memberIds]
  )

  const setMembers = (next: string[]) =>
    form.setValue('memberIds', next, { shouldDirty: true })

  return (
    <FormField
      control={form.control}
      name='memberIds'
      render={() => (
        <FormItem>
          <FormLabel>Members</FormLabel>
          <FormDescription>
            Admins see every project. Sales users see only the projects they are
            members of.
          </FormDescription>
          {isLoading ? (
            <Skeleton className='h-9 w-full' />
          ) : isError ? (
            <p className='text-destructive text-sm'>
              Members could not be loaded. Saving won&rsquo;t change them.
            </p>
          ) : (
            <div className='flex flex-wrap items-center gap-2'>
              {members.map(member => (
                <span
                  key={member.id}
                  className='bg-muted/60 flex items-center gap-1.5 rounded-full border py-0.5 pr-1 pl-0.5 text-sm'
                >
                  <Avatar size='sm'>
                    {member.avatarUrl ? (
                      <AvatarImage
                        src={`/api/storage/user-avatar/${member.id}`}
                        alt={member.fullName ?? member.email}
                      />
                    ) : null}
                    <AvatarFallback>{memberInitials(member)}</AvatarFallback>
                  </Avatar>
                  {member.fullName ?? member.email}
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    className='h-5 w-5 rounded-full'
                    aria-label={`Remove ${member.fullName ?? member.email}`}
                    disabled={disabled}
                    onClick={() =>
                      setMembers(
                        (memberIds ?? []).filter(id => id !== member.id)
                      )
                    }
                  >
                    <X className='h-3 w-3' />
                  </Button>
                </span>
              ))}
              {options.length > 0 ? (
                <SearchableCombobox
                  items={options}
                  value=''
                  onChange={value => {
                    if (!value) return
                    setMembers([...(memberIds ?? []), value])
                  }}
                  searchPlaceholder='Search sales users...'
                  emptyMessage='No sales users found.'
                  disabled={disabled}
                  ariaLabel='Add member'
                  trigger={
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      disabled={disabled}
                    >
                      <Plus className='h-3.5 w-3.5' />
                      Add member
                    </Button>
                  }
                />
              ) : members.length === 0 ? (
                <p className='text-muted-foreground text-sm'>
                  No sales users yet.
                </p>
              ) : null}
            </div>
          )}
        </FormItem>
      )}
    />
  )
}
