'use client'

import { useQuery } from '@tanstack/react-query'
import { Building2 } from 'lucide-react'

import { fetchCompanyOptions } from '@/app/(dashboard)/companies/actions'
import {
  EntityLinkPicker,
  type EntityLinkOption,
} from '@/components/ui/entity-link-picker'
import type { CompanyOption } from '@/lib/companies/types'

export const COMPANY_OPTIONS_QUERY_KEY = ['companyOptions'] as const

export function useCompanyOptions() {
  return useQuery<CompanyOption[]>({
    queryKey: COMPANY_OPTIONS_QUERY_KEY,
    queryFn: () => fetchCompanyOptions(),
    staleTime: 0,
  })
}

export type CompanyLink = { id: string; name: string }

type CompanyLinkPickerProps = {
  value: CompanyLink | null
  onChange: (value: CompanyLink | null) => void
  disabled?: boolean
  id?: string
}

const toOption = (company: CompanyLink): EntityLinkOption => ({
  id: company.id,
  label: company.name,
})

/** Link a record to a company: search, create (stacked sheet), clear, open. */
export function CompanyLinkPicker({
  value,
  onChange,
  disabled,
  id,
}: CompanyLinkPickerProps) {
  const { data = [] } = useCompanyOptions()

  return (
    <EntityLinkPicker
      id={id}
      entity='company'
      entityLabel='company'
      aria-label='Company'
      icon={Building2}
      value={value ? toOption(value) : null}
      onChange={option =>
        onChange(option ? { id: option.id, name: option.label } : null)
      }
      options={data.map(toOption)}
      disabled={disabled}
      toOption={toOption}
      createPrefillParam='companyName'
    />
  )
}
