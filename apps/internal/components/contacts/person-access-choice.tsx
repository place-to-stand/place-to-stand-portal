'use client'

import type { ReactNode } from 'react'

import { Checkbox } from '@pts/ui/checkbox'
import { Label } from '@pts/ui/label'
import { SegmentedControl } from '@pts/ui/segmented-control'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import {
  ACCESS_LABELS,
  type AccessKind,
} from '@/lib/settings/contacts/person-access'

const ALL_KINDS: AccessKind[] = ['none', 'portal', 'team']

/**
 * The person sheet's Access choice: No access / Client portal / Team, with
 * one plain sentence under it saying what that means for this person.
 * Presentational: the sheet binds it to its form (and /design shows it).
 * `children` are the chosen option's details (portal companies, role).
 */
export function PersonAccessChoice({
  value,
  onChange,
  kinds = ALL_KINDS,
  disabledKinds = [],
  lockedReason = null,
  hint = null,
  summary,
  children,
}: {
  value: AccessKind
  onChange?: (next: AccessKind) => void
  /** The choices on offer (staff: no client portal). */
  kinds?: readonly AccessKind[]
  /** Offered but not possible yet (no email); `hint` says why. */
  disabledKinds?: readonly AccessKind[]
  /** The whole choice is locked (Sales, your own sign-in, saving): why. */
  lockedReason?: string | null
  hint?: ReactNode
  summary: string
  children?: ReactNode
}) {
  const locked = Boolean(lockedReason)
  return (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-col gap-2'>
        <DisabledFieldTooltip
          disabled={locked}
          reason={lockedReason}
          className='w-fit max-w-full'
        >
          <SegmentedControl
            aria-label='Access'
            value={value}
            onValueChange={onChange}
            disabled={locked}
            options={kinds.map(kind => ({
              value: kind,
              label: ACCESS_LABELS[kind],
              disabled: disabledKinds.includes(kind) && kind !== value,
            }))}
          />
        </DisabledFieldTooltip>
        <p className='text-sm' data-testid='person-access-summary'>
          {summary}
        </p>
        {hint ? (
          <p className='text-muted-foreground text-sm'>{hint}</p>
        ) : null}
      </div>
      {children}
    </div>
  )
}

/** One client company they can (or can't) see in the portal. */
export type PortalCompanyOption = {
  companyId: string
  name: string
  checked: boolean
  /** Can't be ticked (a former client): why, shown beside it. */
  note?: string | null
  disabled?: boolean
}

/**
 * Client portal details: the sign-in email, then a checkbox per client
 * company they belong to. Ticking one is that membership's portal access.
 */
export function PortalCompaniesField({
  email,
  companies,
  disabled = false,
  onToggle,
}: {
  email: string
  companies: readonly PortalCompanyOption[]
  disabled?: boolean
  onToggle?: (companyId: string, checked: boolean) => void
}) {
  return (
    <div className='flex flex-col gap-3'>
      <AccessField label='Sign-in email'>
        <span className='text-sm break-all'>{email || '—'}</span>
      </AccessField>
      <AccessField label='Sees'>
        {companies.length === 0 ? (
          <span className='text-muted-foreground text-sm'>
            Not at a client company yet. Add one under Companies.
          </span>
        ) : (
          <ul className='flex flex-col gap-2'>
            {companies.map(company => {
              const id = `portal-company-${company.companyId}`
              return (
                // Only the box and its name toggle it: the row hugs them.
                <li
                  key={company.companyId}
                  className='flex w-fit items-center gap-2'
                >
                  <Checkbox
                    id={id}
                    checked={company.checked}
                    disabled={disabled || company.disabled}
                    onCheckedChange={checked =>
                      onToggle?.(company.companyId, Boolean(checked))
                    }
                  />
                  <Label htmlFor={id} className='font-normal'>
                    {company.name}
                  </Label>
                  {company.note ? (
                    <span className='text-muted-foreground text-xs'>
                      {company.note}
                    </span>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </AccessField>
    </div>
  )
}

/** A label beside its value, in the Access section's details. */
export function AccessField({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className='grid grid-cols-1 gap-1 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-3'>
      <span className='text-muted-foreground pt-px text-sm'>{label}</span>
      <div className='min-w-0'>{children}</div>
    </div>
  )
}
