'use client'

import { useState } from 'react'

import { Button } from '@pts/ui/button'
import { Input } from '@pts/ui/input'
import { Label } from '@pts/ui/label'
import { Switch } from '@pts/ui/switch'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { RoleBadge } from '@/components/auth/role-badge'
import { SaveSideEffect } from '@/components/sheets/save-side-effect'
import { SheetSection } from '@/components/sheets/sheet-section'
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
        note='Fields two to a row, full width, as in a company Client section: the sign-in is a state of the person, so no record card. Email is disabled here with a tooltip (changed as Email above); Send reset link is a small button left of the switch'
        className='block max-w-2xl'
      >
        <SheetSection
          title='User'
          icon={ENTITY_ICONS.user}
          className='gap-4'
          action={
            <>
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='mr-2'
              >
                Send reset link
              </Button>
              <CanSignIn id='design-sign-in-client' checked />
            </>
          }
        >
          <div className='grid grid-cols-1 items-start gap-4 sm:grid-cols-2'>
            <div className='grid gap-2'>
              <Label htmlFor='design-sign-in-email'>Signs in as</Label>
              <DisabledFieldTooltip
                disabled
                reason='Set it in Email above: they sign in with that address.'
              >
                <Input
                  id='design-sign-in-email'
                  value='ada@acme.com'
                  disabled
                />
              </DisabledFieldTooltip>
              <p className='text-muted-foreground text-xs'>
                Last sign-in: never
              </p>
            </div>
            <div className='grid gap-2'>
              <Label>Role</Label>
              <div className='border-input flex h-9 items-center rounded-md border px-3'>
                <RoleBadge role='CLIENT' />
              </div>
            </div>
          </div>
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
