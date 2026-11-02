'use client'

import { useState } from 'react'

import { Label } from '@pts/ui/label'
import { Switch } from '@pts/ui/switch'
import { RoleBadge } from '@/components/auth/role-badge'
import { SaveSideEffect } from '@/components/sheets/save-side-effect'
import { SheetSection } from '@/components/sheets/sheet-section'
import {
  RecordRowField,
  SheetRecordRow,
} from '@/components/sheets/sheet-record-row'
import { UiRef } from '@/components/ui/ui-ref'
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

/** The person sheet's User section, live but saving nothing. */
export function ComponentsAccess() {
  const [on, setOn] = useState(false)

  return (
    <DesignSection
      id='access'
      title='Person sign-in'
      when='Can this person sign in, and as what? The person sheet’s User section works like a company’s Client section: a “Can sign in” switch at the right of the heading makes (or switches off) their sign-in on Save, with a caution saying so; once on, Role says what they get into (Admin, Sales: this portal; Client: the client portal, at the companies whose Portal switch is on). Read-only for Sales.'
    >
      <Specimen
        label='New sign-in'
        note='contact-access-section.tsx · SheetSection action + SaveSideEffect'
        className='block max-w-2xl'
      >
        <SheetSection
          title='User'
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
        label='Live sign-in'
        note='One SheetRecordRow with the person icon uncoloured (muted); RecordRowField note keeps the label level with the control'
        className='block max-w-2xl'
      >
        <SheetSection
          title='User'
          icon={ENTITY_ICONS.user}
          className='gap-4'
          action={<CanSignIn id='design-sign-in-client' checked />}
        >
          <SheetRecordRow
            leading={
              <ENTITY_ICONS.contact
                className='text-muted-foreground size-4'
                aria-hidden
              />
            }
            title='ada@acme.com'
            description='Last sign-in: never'
            fieldsClassName='gap-y-4 py-3'
            fields={
              <RecordRowField
                label='Role'
                note='Sees Acme and Beta in the client portal.'
              >
                <RoleBadge role='CLIENT' />
              </RecordRowField>
            }
          />
        </SheetSection>
      </Specimen>
      <Specimen
        label='Naming a control in helper text'
        note='UiRef (components/ui/ui-ref.tsx): medium weight, normal colour, no quotes'
        className='block max-w-2xl'
      >
        <SheetSection title='Portal access'>
          <p className='text-muted-foreground text-xs'>
            Needs a sign-in with the Client role. Turn on{' '}
            <UiRef>Can sign in</UiRef> below.
          </p>
        </SheetSection>
      </Specimen>
      <Specimen
        label='Read-only (Sales)'
        note='No switch: only an admin manages sign-ins'
        className='block max-w-2xl'
      >
        <SheetSection title='User' icon={ENTITY_ICONS.user}>
          <p className='text-muted-foreground text-sm'>
            Only an admin can see or change someone&rsquo;s sign-in.
          </p>
        </SheetSection>
      </Specimen>
    </DesignSection>
  )
}
