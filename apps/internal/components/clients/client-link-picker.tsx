'use client'

import type { ReactElement } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building } from 'lucide-react'

import { fetchClientLinkOptions } from '@/app/(dashboard)/companies/actions'
import {
  EntityLinkPicker,
  type EntityLinkOption,
} from '@/components/ui/entity-link-picker'
import type { ClientLinkOption } from '@/lib/companies/types'

export const CLIENT_LINK_OPTIONS_QUERY_KEY = ['clientLinkOptions'] as const

/** Live clients with their company (admin-only; empty for others). */
export function useClientLinkOptions(enabled = true) {
  return useQuery<ClientLinkOption[]>({
    queryKey: CLIENT_LINK_OPTIONS_QUERY_KEY,
    queryFn: () => fetchClientLinkOptions(),
    staleTime: 0,
    enabled,
  })
}

export type ClientLink = { id: string; name: string }

type ClientLinkPickerProps = {
  value: ClientLink | null
  onChange: (value: ClientLink | null) => void
  disabled?: boolean
  id?: string
  /** Clients not to offer (e.g. ones already on the list). */
  excludeIds?: readonly string[]
  /** Aux params for "Create client" (e.g. the company to preselect). */
  createParams?: Record<string, string>
  /** A button in place of the field; see `EntityLinkPicker`. */
  trigger?: ReactElement
  /** Controlled open state; see `EntityLinkPicker`. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/** Link a record to a client: search, create (stacked sheet), clear, open. */
export function ClientLinkPicker({
  value,
  onChange,
  disabled,
  id,
  excludeIds,
  createParams,
  trigger,
  open,
  onOpenChange,
}: ClientLinkPickerProps) {
  const { data = [] } = useClientLinkOptions()
  const excluded = new Set(excludeIds)
  const options: EntityLinkOption[] = data
    .filter(client => !excluded.has(client.id))
    .map(client => ({
      id: client.id,
      label: client.name,
      description: client.companyName,
    }))

  return (
    <EntityLinkPicker
      id={id}
      entity='client'
      entityLabel='client'
      aria-label='Client'
      icon={Building}
      value={value ? { id: value.id, label: value.name } : null}
      onChange={option =>
        onChange(option ? { id: option.id, name: option.label } : null)
      }
      options={options}
      disabled={disabled}
      toOption={record => ({ id: record.id, label: record.name })}
      createPrefillParam='clientName'
      createParams={createParams}
      trigger={trigger}
      open={open}
      onOpenChange={onOpenChange}
    />
  )
}
