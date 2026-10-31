'use client'

import { useState } from 'react'

import { Label } from '@pts/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pts/ui/select'
import { PersonAccessChoice } from '@/components/contacts/person-access-choice'
import {
  accessSummary,
  type AccessKind,
} from '@/lib/settings/contacts/person-access'
import { SIGN_IN_ADMIN_ONLY } from '@/lib/settings/contacts/person-sheet-copy'

import { DesignSection, Specimen } from './specimen'

const EMAIL = 'ada@acme.com'

/** The person sheet's Access section, live but saving nothing. */
export function ComponentsAccess() {
  const [kind, setKind] = useState<AccessKind>('portal')
  const [role, setRole] = useState<'ADMIN' | 'SALES'>('ADMIN')
  const [seen] = useState<Record<string, boolean>>({
    acme: true,
    beta: true,
    cobalt: false,
  })
  const companies = [
    { companyId: 'acme', name: 'Acme' },
    { companyId: 'beta', name: 'Beta' },
    { companyId: 'cobalt', name: 'Cobalt' },
  ]
  const [staffKind, setStaffKind] = useState<AccessKind>('team')

  return (
    <DesignSection
      id='access'
      title='Person access'
      when='What can this person get into? One choice on the person sheet (No access, Client portal, Team) with one plain sentence under it. Client portal lists their client companies as checkboxes (each is that membership’s portal access); Team picks the role. Staff get No access or Team. Read-only for Sales.'
    >
      <Specimen
        label='Access, client contact'
        note='components/contacts/person-access-choice · SegmentedControl from @pts/ui/segmented-control'
        className='block max-w-2xl'
      >
        <PersonAccessChoice
          value={kind}
          onChange={setKind}
          summary={accessSummary({
            kind,
            email: EMAIL,
            role: kind === 'team' ? role : 'CLIENT',
            companies: companies
              .filter(company => seen[company.companyId])
              .map(company => company.name),
          })}
        >
          {kind === 'team' ? (
            <div className='flex flex-col gap-2 sm:max-w-xs'>
              <Label htmlFor='design-access-role' className='w-fit'>
                Role
              </Label>
              <Select
                value={role}
                onValueChange={next => setRole(next as 'ADMIN' | 'SALES')}
              >
                <SelectTrigger id='design-access-role'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='ADMIN'>Admin</SelectItem>
                  <SelectItem value='SALES'>Sales</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </PersonAccessChoice>
      </Specimen>
      <Specimen
        label='Access, staff person'
        note='No client portal for people at the staff company'
        className='block max-w-2xl'
      >
        <PersonAccessChoice
          value={staffKind}
          onChange={setStaffKind}
          kinds={['none', 'team']}
          summary={accessSummary({
            kind: staffKind,
            email: 'grace@placetostand.com',
            role: 'ADMIN',
            companies: [],
          })}
        />
      </Specimen>
      <Specimen
        label='Access, read-only (Sales)'
        note='Locked, with the reason on hover'
        className='block max-w-2xl'
      >
        <PersonAccessChoice
          value='none'
          lockedReason={SIGN_IN_ADMIN_ONLY}
          summary={accessSummary({
            kind: 'none',
            email: EMAIL,
            role: 'CLIENT',
            companies: null,
          })}
        />
      </Specimen>
    </DesignSection>
  )
}
