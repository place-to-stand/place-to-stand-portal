'use client'

import { useMemo } from 'react'
import { useWatch, type Control } from 'react-hook-form'

import { LeadStatusBadge } from '@/components/leads/lead-status-badge'
import { CompanyLinkPicker } from '@/components/companies/company-link-picker'
import { ContactLinkPicker } from '@/components/contacts/contact-link-picker'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@pts/ui/input'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { SearchableCombobox } from '@/components/ui/searchable-combobox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pts/ui/select'
import { isSelectableUser } from '@/lib/users/selectable'
import {
  LEAD_SOURCE_LABELS,
  LEAD_SOURCE_TYPES,
  LEAD_STATUS_ORDER,
  type LeadSourceTypeValue,
  type LeadStatusValue,
} from '@/lib/leads/constants'
import type { LeadAssigneeOption } from '@/lib/leads/types'

import type { LeadFormValues } from './types'

type LeadSheetFormFieldsProps = {
  control: Control<LeadFormValues>
  assignees: LeadAssigneeOption[]
  selectedSourceType: LeadSourceTypeValue | null | undefined
}

export function LeadSheetFormFields({
  control,
  assignees,
  selectedSourceType,
}: LeadSheetFormFieldsProps) {
  // Disabled admins are not offered, but a lead they already hold keeps
  // them as a disabled entry so the picker still names the assignee.
  const currentAssigneeId = useWatch({ control, name: 'assigneeId' }) ?? null
  const assigneeItems = useMemo(
    () => [
      ...assignees
        .filter(
          assignee =>
            isSelectableUser(assignee) || assignee.id === currentAssigneeId
        )
        .map(assignee => ({
          value: assignee.id,
          label: assignee.name,
          description: assignee.email ?? undefined,
          userId: assignee.id,
          avatarUrl: assignee.avatarUrl,
          disabled: !isSelectableUser(assignee),
        })),
    ],
    [assignees, currentAssigneeId]
  )

  return (
    <div className='space-y-6'>
      <FormField
        control={control}
        name='contact'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Contact</FormLabel>
            <FormControl>
              <ContactLinkPicker
                value={field.value ?? null}
                onChange={next => field.onChange(next)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name='company'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Company</FormLabel>
            <FormControl>
              <CompanyLinkPicker
                value={field.value ?? null}
                onChange={next => field.onChange(next)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
        <FormField
          control={control}
          name='sourceType'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Source</FormLabel>
              <Select
                value={field.value ?? 'none'}
                onValueChange={(value: string) =>
                  field.onChange(
                    value === 'none' ? null : (value as LeadSourceTypeValue)
                  )
                }
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder='Select source'>
                      {field.value ? (
                        LEAD_SOURCE_LABELS[field.value]
                      ) : (
                        <span className='text-muted-foreground'>Not set</span>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value='none'>
                    <span className='text-muted-foreground'>Not set</span>
                  </SelectItem>
                  {LEAD_SOURCE_TYPES.map(source => (
                    <SelectItem key={source} value={source}>
                      {LEAD_SOURCE_LABELS[source]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name='sourceDetail'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Source info</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ''}
                  placeholder='Referral name, site URL, or event title'
                  disabled={!selectedSourceType}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
        <FormField
          control={control}
          name='status'
          render={({ field }) => {
            const selectedStatus = LEAD_STATUS_ORDER.find(
              status => status === field.value
            )

            return (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={(value: LeadStatusValue) =>
                    field.onChange(value)
                  }
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder='Select status'>
                        {selectedStatus ? (
                          <LeadStatusBadge status={selectedStatus} />
                        ) : null}
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {LEAD_STATUS_ORDER.map(status => (
                      <SelectItem key={status} value={status}>
                        <LeadStatusBadge status={status} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )
          }}
        />
        <FormField
          control={control}
          name='assigneeId'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Assignee</FormLabel>
              <FormControl>
                <SearchableCombobox
                  items={assigneeItems}
                  clearLabel='assignee'
                  value={field.value ?? ''}
                  onChange={value =>
                    field.onChange(value.length ? value : null)
                  }
                  placeholder='Unassigned'
                  searchPlaceholder='Search teammates…'
                  onClear={() => field.onChange(null)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <FormField
        control={control}
        name='notes'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Notes</FormLabel>
            <FormControl>
              <RichTextEditor
                id='lead-notes'
                value={field.value ?? ''}
                onChange={field.onChange}
                contentMinHeightClassName='[&_.ProseMirror]:min-h-[180px]'
                undoRedo={false}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
