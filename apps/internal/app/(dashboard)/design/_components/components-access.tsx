'use client'

import { useState } from 'react'

import { Label } from '@pts/ui/label'
import { Switch } from '@pts/ui/switch'
import { RoleBadge } from '@/components/auth/role-badge'
import { SaveSideEffect } from '@/components/sheets/save-side-effect'
import { SheetSection } from '@/components/sheets/sheet-section'
import { ENTITY_ICONS } from '@/lib/entity-accents'

import { DesignSection, Specimen } from './specimen'

/** The heading's "Can sign in" switch, as on the person sheet. */
function CanSignIn({
  id,
  checked,
  onChange,
}: {
  id: string
  checked: boolean
  onChange?: (on: boolean) => void
}) {
  return (
    <span className='flex items-center gap-2'>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        disabled={!onChange}
      />
      <Label htmlFor={id}>Can sign in</Label>
    </span>
  )
}

/** The person sheet's Sign-in section, live but saving nothing. */
export function ComponentsAccess() {
  const [on, setOn] = useState(false)

  return (
    <DesignSection
      id='access'
      title='Person sign-in'
      when='Can this person sign in, and as what? The person sheet’s Sign-in section works like a company’s Client section: a “Can sign in” switch at the right of the heading makes (or switches off) their sign-in on Save, with a caution saying so; once on, Role says what they get into (Admin, Sales: this portal; Client: the client portal, at the companies whose Portal switch is on). Read-only for Sales.'
    >
      <Specimen
        label='New sign-in'
        note='contact-access-section.tsx · SheetSection action + SaveSideEffect'
        className='block max-w-2xl'
      >
        <SheetSection
          title='Sign-in'
          icon={ENTITY_ICONS.user}
          className='gap-4'
          action={
            <CanSignIn id='design-sign-in-new' checked={on} onChange={setOn} />
          }
        >
          {on ? (
            <SaveSideEffect>
              Saving creates a sign-in for Ada Lovelace at ada@acme.com and
              emails them a link to the client portal.
            </SaveSideEffect>
          ) : null}
        </SheetSection>
      </Specimen>
      <Specimen
        label='Client sign-in'
        note='Role, the email they sign in with, and what they see'
        className='block max-w-2xl'
      >
        <SheetSection
          title='Sign-in'
          icon={ENTITY_ICONS.user}
          className='gap-4'
          action={<CanSignIn id='design-sign-in-client' checked />}
        >
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <div className='flex flex-col gap-2'>
              <span className='text-sm font-medium'>Role</span>
              <span className='flex h-9 items-center'>
                <RoleBadge role='CLIENT' />
              </span>
            </div>
            <div className='flex flex-col gap-2'>
              <span className='text-sm font-medium'>Signs in with</span>
              <span className='flex h-9 items-center text-sm'>
                ada@acme.com
              </span>
            </div>
          </div>
          <p className='text-muted-foreground text-sm'>
            Sees Acme and Beta in the client portal. Turn Portal on or off on
            each company above.
          </p>
        </SheetSection>
      </Specimen>
      <Specimen
        label='Read-only (Sales)'
        note='No switch: only an admin manages sign-ins'
        className='block max-w-2xl'
      >
        <SheetSection title='Sign-in' icon={ENTITY_ICONS.user}>
          <p className='text-muted-foreground text-sm'>
            Only an admin can see or change someone&rsquo;s sign-in.
          </p>
        </SheetSection>
      </Specimen>
    </DesignSection>
  )
}
