'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useWatch, type UseFormReturn } from 'react-hook-form'
import { X } from 'lucide-react'

import { EmptyState } from '@pts/ui/empty-state'
import { RowActionButton } from '@pts/ui/row-action-button'
import { Skeleton } from '@pts/ui/skeleton'
import {
  SheetRecordList,
  SheetRecordRow,
} from '@/components/sheets/sheet-record-row'
import { SectionAddButton } from '@/components/sheets/section-add-button'
import { SheetSection } from '@/components/sheets/sheet-section'
import { SearchableCombobox } from '@/components/ui/searchable-combobox'
import type { ProjectSheetFormValues } from '@/lib/settings/projects/use-project-sheet-state'

import {
  buildMemberOptions,
  type MemberCandidate,
} from './project-members-utils'
import { UserAvatar } from '@/components/ui/user-avatar'

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

  // Registered so resetField below reaches it: the field has no input of its
  // own, and resetField skips fields that were never registered.
  useEffect(() => {
    form.register('memberIds')
  }, [form])
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

  // The + and the empty state open the same picker.
  const [pickerOpen, setPickerOpen] = useState(false)
  const canAdd = options.length > 0 && !disabled

  const addButton = <SectionAddButton label='Add member' disabled={disabled} />

  // Same section shape as GitHub, Vercel and Supabase below: title row with
  // an add button, one boxed row per member, an empty state.
  return (
    <SheetSection
      title='Members'
      description='Admins see every project. Sales staff see only the projects they are members of.'
      action={
        canAdd ? (
          <SearchableCombobox
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            items={options}
            value=''
            onChange={value => {
              if (!value) return
              setMembers([...(memberIds ?? []), value])
            }}
            searchPlaceholder='Search people…'
            emptyMessage='No sales staff found.'
            ariaLabel='Add member'
            trigger={addButton}
          />
        ) : (
          addButton
        )
      }
    >
      {isLoading ? (
        <Skeleton className='h-11 w-full' />
      ) : isError ? (
        <p className='text-destructive text-sm'>
          Members could not be loaded. Saving won&rsquo;t change them.
        </p>
      ) : members.length === 0 ? (
        <EmptyState
          message={
            options.length > 0 ? 'No members yet.' : 'No sales staff yet.'
          }
          label={canAdd ? 'Add member' : undefined}
          onClick={canAdd ? () => setPickerOpen(true) : undefined}
        />
      ) : (
        <SheetRecordList>
          {members.map(member => {
            const name = member.fullName ?? member.email
            return (
              <SheetRecordRow
                key={member.id}
                leading={
                  <UserAvatar
                    size='xs'
                    userId={member.id}
                    name={name}
                    hasPhoto={Boolean(member.avatarUrl)}
                    alt=''
                  />
                }
                title={name}
                description={member.fullName ? member.email : null}
                actions={
                  <RowActionButton
                    type='button'
                    label={`Remove ${name}`}
                    icon={<X />}
                    className='text-muted-foreground hover:text-destructive'
                    disabled={disabled}
                    onClick={() =>
                      setMembers(
                        (memberIds ?? []).filter(id => id !== member.id)
                      )
                    }
                  />
                }
              />
            )
          })}
        </SheetRecordList>
      )}
    </SheetSection>
  )
}
