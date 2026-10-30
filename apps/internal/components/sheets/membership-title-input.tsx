'use client'

import { Input } from '@pts/ui/input'

/**
 * A contact's title at a company, edited on a sheet row's fields line (the
 * person sheet's Companies list and the company sheet's People list), inside
 * a `RecordRowField` labelled "Title". Staged with the sheet; saved with
 * Save.
 */
export function MembershipTitleInput({
  value,
  onChange,
  ariaLabel,
  disabled = false,
}: {
  value: string
  onChange: (value: string) => void
  /** "Title at Acme" / "Jane Doe's title". */
  ariaLabel: string
  disabled?: boolean
}) {
  return (
    <Input
      value={value}
      onChange={event => onChange(event.target.value)}
      aria-label={ariaLabel}
      disabled={disabled}
      maxLength={160}
      className='h-8 w-36'
    />
  )
}
