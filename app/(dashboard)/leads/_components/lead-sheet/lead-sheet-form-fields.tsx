'use client'

import { useMemo } from 'react'
import type { Control } from 'react-hook-form'

import { Badge } from '@/components/ui/badge'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/ui/phone-input'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { SearchableCombobox } from '@/components/ui/searchable-combobox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  LEAD_SOURCE_LABELS,
  LEAD_SOURCE_TYPES,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_ORDER,
  getLeadStatusToken,
  type LeadSourceTypeValue,
  type LeadStatusValue,
} from '@/lib/leads/constants'
import type { LeadAssigneeOption } from '@/lib/leads/types'
import type { PriorityTier } from '@/lib/leads/intelligence-types'

import { PriorityBadge } from '../priority-badge'
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
  const assigneeItems = useMemo(
    () => [
      {
        value: '',
        label: 'Unassigned',
        description: 'Leave unassigned for now.',
      },
      ...assignees.map(assignee => ({
        value: assignee.id,
        label: assignee.name,
        description: assignee.email ?? undefined,
        userId: assignee.id,
        avatarUrl: assignee.avatarUrl,
      })),
    ],
    [assignees]
  )

  const leadStatuses = useMemo(
    () =>
      LEAD_STATUS_ORDER.map(status => ({
        value: status,
        label: LEAD_STATUS_LABELS[status],
        token: getLeadStatusToken(status),
      })),
    []
  )

  return (
    <div className='space-y-6'>
      <FormField
        control={control}
        name='contactName'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Contact Name</FormLabel>
            <FormControl>
              <Input
                {...field}
                value={field.value ?? ''}
                placeholder='Jordan Smith'
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className='grid gap-4 sm:grid-cols-2'>
        <FormField
          control={control}
          name='contactEmail'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contact Email</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ''}
                  type='email'
                  placeholder='name@org.com'
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name='contactPhone'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contact Phone</FormLabel>
              <FormControl>
                <PhoneInput
                  value={field.value ?? ''}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <div className='grid gap-4 sm:grid-cols-2'>
        <FormField
          control={control}
          name='companyName'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company Name</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ''}
                  placeholder='Acme Corporation'
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name='companyWebsite'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company Website</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ''}
                  type='url'
                  placeholder='https://acme.com'
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <div className='grid gap-4 sm:grid-cols-2'>
        <FormField
          control={control}
          name='sourceType'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Source</FormLabel>
              <Select
                value={field.value ?? undefined}
                onValueChange={(value: LeadSourceTypeValue) =>
                  field.onChange(value)
                }
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder='Select source' />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
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
              <FormLabel>Source Info</FormLabel>
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
      <FormField
        control={control}
        name='status'
        render={({ field }) => {
          const selectedStatus = leadStatuses.find(
            status => status.value === field.value
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
                        <Badge
                          variant='outline'
                          className={cn(
                            'text-xs font-semibold tracking-wide uppercase',
                            selectedStatus.token
                          )}
                        >
                          {selectedStatus.label}
                        </Badge>
                      ) : null}
                    </SelectValue>
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {leadStatuses.map(status => (
                    <SelectItem key={status.value} value={status.value}>
                      <Badge
                        variant='outline'
                        className={cn(
                          'text-xs font-semibold tracking-wide uppercase',
                          status.token
                        )}
                      >
                        {status.label}
                      </Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )
        }}
      />
      <div className='grid gap-4 sm:grid-cols-2'>
        <FormField
          control={control}
          name='priorityTier'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Priority</FormLabel>
              <Select
                value={field.value ?? 'none'}
                onValueChange={(value) =>
                  field.onChange(value === 'none' ? null : value as PriorityTier)
                }
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder='Set priority'>
                      {field.value ? (
                        <PriorityBadge tier={field.value} />
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
                  <SelectItem value='hot'>
                    <PriorityBadge tier='hot' />
                  </SelectItem>
                  <SelectItem value='warm'>
                    <PriorityBadge tier='warm' />
                  </SelectItem>
                  <SelectItem value='cold'>
                    <PriorityBadge tier='cold' />
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
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
                  value={field.value ?? ''}
                  onChange={value =>
                    field.onChange(value.length ? value : null)
                  }
                  placeholder='Assign teammate'
                  searchPlaceholder='Search teammates'
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
              />
            </FormControl>
            <FormDescription>
              Capture context, meeting notes, or next steps.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
