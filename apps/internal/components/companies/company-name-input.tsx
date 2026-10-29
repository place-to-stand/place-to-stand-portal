'use client'

import { useId } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2 } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { Input } from '@pts/ui/input'
import { fetchCompanyOptions } from '@/app/(dashboard)/companies/actions'
import type { CompanyOption } from '@/lib/companies/types'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'

export const COMPANY_OPTIONS_QUERY_KEY = ['companyOptions'] as const

export function useCompanyOptions() {
  return useQuery<CompanyOption[]>({
    queryKey: COMPANY_OPTIONS_QUERY_KEY,
    queryFn: () => fetchCompanyOptions(),
    staleTime: 0,
  })
}

type CompanyNameInputProps = {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  disabled?: boolean
  placeholder?: string
  /** The linked company, when the saved record has one. */
  linkedCompanyId?: string | null
  name?: string
}

/**
 * A free-text company field that suggests existing companies. Saving with a
 * name that matches one (ignoring case) links to it; a new name creates the
 * company. Typing is never blocked by the list loading.
 */
export function CompanyNameInput({
  value,
  onChange,
  onBlur,
  disabled,
  placeholder = 'Acme Inc.',
  linkedCompanyId,
  name,
}: CompanyNameInputProps) {
  const listId = useId()
  const { data: options = [] } = useCompanyOptions()
  const { open } = useSheetParams()

  return (
    <div className='flex items-center gap-2'>
      <Input
        name={name}
        value={value}
        onChange={event => onChange(event.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        placeholder={placeholder}
        list={listId}
        autoComplete='off'
      />
      <datalist id={listId}>
        {options.map(option => (
          <option key={option.id} value={option.name} />
        ))}
      </datalist>
      {linkedCompanyId ? (
        <Button
          type='button'
          variant='outline'
          size='icon'
          className='shrink-0'
          aria-label='Open company'
          title='Open company'
          onClick={() => open('company', linkedCompanyId)}
        >
          <Building2 className='h-4 w-4' />
        </Button>
      ) : null}
    </div>
  )
}
