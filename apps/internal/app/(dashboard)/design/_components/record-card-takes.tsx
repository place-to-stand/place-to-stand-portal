'use client'

import { useState, type ReactNode } from 'react'
import { Star, X } from 'lucide-react'

import { Input } from '@pts/ui/input'
import { RowActionButton } from '@pts/ui/row-action-button'
import { Switch } from '@pts/ui/switch'

import { ENTITY_ACCENTS, ENTITY_ICONS } from '@/lib/entity-accents'
import { cn } from '@/lib/utils'

import { DesignSection, Specimen } from './specimen'

/*
 * Three takes on a record card that holds fields, on the same data, for the
 * owner to pick one. The pick becomes the shared SheetRecordRow; the others
 * are deleted with this file.
 */

/** Reads as text until hovered or focused; the box appears only then. */
const GHOST_INPUT =
  'h-8 border-transparent bg-transparent px-2 shadow-none hover:border-input focus-visible:border-ring dark:bg-transparent dark:hover:bg-input/30 placeholder:text-muted-foreground/70 truncate'

type Person = {
  name: string
  email: string
  title: string
  portal: boolean
  primary: boolean
}

const PEOPLE: Person[] = [
  {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    title: 'Head of operations',
    portal: true,
    primary: true,
  },
  {
    name: 'Grace Hopper-Montgomery, Accounts Payable',
    email: 'payables@example.com',
    title: '',
    portal: false,
    primary: false,
  },
]

function usePeople() {
  const [people, setPeople] = useState(PEOPLE)
  const update = (index: number, patch: Partial<Person>) =>
    setPeople(current =>
      current.map((person, i) =>
        i === index ? { ...person, ...patch } : person
      )
    )
  return { people, update }
}

function PersonIcon() {
  return (
    <ENTITY_ICONS.contact
      className={cn(ENTITY_ACCENTS.contact.icon, 'size-4 shrink-0')}
      aria-hidden
    />
  )
}

function CloserIcon() {
  return (
    <ENTITY_ICONS.contact
      className={cn(ENTITY_ACCENTS.contact.icon, 'size-4 shrink-0')}
      aria-hidden
    />
  )
}

function StarButton({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <RowActionButton
      type='button'
      label={on ? 'Primary contact' : 'Make primary contact'}
      icon={
        <Star
          className={cn(on && 'fill-amber-400 text-amber-400')}
          aria-hidden
        />
      }
      onClick={onClick}
    />
  )
}

function RemoveButton() {
  return (
    <RowActionButton type='button' label='Remove' icon={<X aria-hidden />} />
  )
}

function NameBlock({ person }: { person: Pick<Person, 'name' | 'email'> }) {
  return (
    <span className='flex min-w-0 flex-col leading-tight'>
      <span className='truncate text-sm font-medium' title={person.name}>
        {person.name}
      </span>
      <span className='text-muted-foreground truncate text-xs'>
        {person.email}
      </span>
    </span>
  )
}

/* ── Take A: quiet inline ───────────────────────────────────────────── */

function TakeA() {
  const { people, update } = usePeople()
  const [share, setShare] = useState('60')
  return (
    <div className='flex flex-col gap-2'>
      {people.map((person, index) => (
        <div
          key={person.email}
          className='bg-card hover:bg-muted/40 flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-1.5 transition-colors'
        >
          <PersonIcon />
          <span className='min-w-40 flex-1 basis-40'>
            <NameBlock person={person} />
          </span>
          <Input
            value={person.title}
            onChange={event => update(index, { title: event.target.value })}
            placeholder='Add title'
            aria-label={`${person.name}'s title`}
            className={cn(GHOST_INPUT, 'w-44')}
          />
          <label className='text-muted-foreground flex h-8 items-center gap-2 text-sm'>
            Portal
            <Switch
              checked={person.portal}
              onCheckedChange={portal => update(index, { portal })}
              aria-label={`Portal access for ${person.name}`}
            />
          </label>
          <span className='flex items-center'>
            <StarButton
              on={person.primary}
              onClick={() => update(index, { primary: !person.primary })}
            />
            <RemoveButton />
          </span>
        </div>
      ))}
      <div className='bg-card hover:bg-muted/40 flex min-h-12 items-center gap-3 rounded-md border px-3 py-1.5 transition-colors'>
        <CloserIcon />
        <span className='min-w-0 flex-1'>
          <NameBlock person={{ name: 'Sam Rivera', email: 'Closer' }} />
        </span>
        <span className='relative'>
          <Input
            value={share}
            onChange={event => setShare(event.target.value)}
            inputMode='decimal'
            aria-label='Sam Rivera share'
            className={cn(GHOST_INPUT, 'w-20 pr-6 text-right tabular-nums')}
          />
          <span className='text-muted-foreground pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-sm'>
            %
          </span>
        </span>
        <RemoveButton />
      </div>
    </div>
  )
}

/* ── Take B: label and value grid ───────────────────────────────────── */

function FieldGrid({ children }: { children: ReactNode }) {
  return (
    <dl className='grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-x-4 gap-y-0.5 px-3 py-2'>
      {children}
    </dl>
  )
}

function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className='text-muted-foreground text-sm'>{label}</dt>
      <dd className='flex min-h-8 min-w-0 items-center'>{children}</dd>
    </>
  )
}

function TakeB() {
  const { people, update } = usePeople()
  const [share, setShare] = useState('60')
  return (
    <div className='flex flex-col gap-2'>
      {people.map((person, index) => (
        <div
          key={person.email}
          className='bg-card divide-border/60 divide-y rounded-md border'
        >
          <div className='flex min-h-12 items-center gap-3 px-3 py-1.5'>
            <PersonIcon />
            <span className='min-w-0 flex-1'>
              <NameBlock person={person} />
            </span>
            <StarButton
              on={person.primary}
              onClick={() => update(index, { primary: !person.primary })}
            />
            <RemoveButton />
          </div>
          <FieldGrid>
            <FieldRow label='Title'>
              <Input
                value={person.title}
                onChange={event => update(index, { title: event.target.value })}
                placeholder='Add title'
                aria-label={`${person.name}'s title`}
                className={cn(GHOST_INPUT, '-ml-2 w-full max-w-72')}
              />
            </FieldRow>
            <FieldRow label='Portal access'>
              <span className='flex items-center gap-2 text-sm'>
                <Switch
                  checked={person.portal}
                  onCheckedChange={portal => update(index, { portal })}
                  aria-label={`Portal access for ${person.name}`}
                />
                <span className='text-muted-foreground'>
                  {person.portal ? 'Can see this company' : 'Off'}
                </span>
              </span>
            </FieldRow>
          </FieldGrid>
        </div>
      ))}
      <div className='bg-card divide-border/60 divide-y rounded-md border'>
        <div className='flex min-h-12 items-center gap-3 px-3 py-1.5'>
          <CloserIcon />
          <span className='min-w-0 flex-1'>
            <NameBlock person={{ name: 'Sam Rivera', email: 'Closer' }} />
          </span>
          <RemoveButton />
        </div>
        <FieldGrid>
          <FieldRow label='Share'>
            <span className='relative'>
              <Input
                value={share}
                onChange={event => setShare(event.target.value)}
                inputMode='decimal'
                aria-label='Sam Rivera share'
                className={cn(GHOST_INPUT, '-ml-2 w-20 pr-6 tabular-nums')}
              />
              <span className='text-muted-foreground pointer-events-none absolute top-1/2 right-0 -translate-y-1/2 text-sm'>
                %
              </span>
            </span>
          </FieldRow>
        </FieldGrid>
      </div>
    </div>
  )
}

/* ── Take C: list without boxes ─────────────────────────────────────── */

const LIST_COLUMNS =
  'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 sm:grid-cols-[minmax(0,1fr)_11rem_5.5rem_auto]'

function TakeC() {
  const { people, update } = usePeople()
  return (
    <div className='bg-card overflow-hidden rounded-md border'>
      <div
        className={cn(
          LIST_COLUMNS,
          'text-muted-foreground bg-muted/30 hidden px-3 py-1.5 text-xs sm:grid'
        )}
      >
        <span>Person</span>
        <span className='pl-2'>Title</span>
        <span>Portal</span>
        <span className='sr-only'>Actions</span>
      </div>
      <ul className='divide-border/60 divide-y'>
        {people.map((person, index) => (
          <li
            key={person.email}
            className={cn(
              LIST_COLUMNS,
              'hover:bg-muted/40 min-h-12 px-3 py-1.5 transition-colors'
            )}
          >
            <span className='flex min-w-0 items-center gap-3'>
              <PersonIcon />
              <NameBlock person={person} />
            </span>
            <Input
              value={person.title}
              onChange={event => update(index, { title: event.target.value })}
              placeholder='Add title'
              aria-label={`${person.name}'s title`}
              className={cn(
                GHOST_INPUT,
                'col-span-2 row-start-2 ml-5 sm:col-span-1 sm:row-start-auto sm:ml-0'
              )}
            />
            <span className='col-span-2 row-start-3 ml-7 flex h-8 items-center sm:col-span-1 sm:row-start-auto sm:ml-0'>
              <Switch
                checked={person.portal}
                onCheckedChange={portal => update(index, { portal })}
                aria-label={`Portal access for ${person.name}`}
              />
            </span>
            <span className='col-start-2 row-start-1 flex items-center sm:col-start-auto sm:row-start-auto'>
              <StarButton
                on={person.primary}
                onClick={() => update(index, { primary: !person.primary })}
              />
              <RemoveButton />
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ComponentsRecordCardTakes() {
  return (
    <DesignSection
      id='record-card-takes'
      title='Record cards with fields: pick one'
      when='Three takes on the same cards (a person at a company with a title, portal access and the primary star; a closer with a share). Fields read as text until you hover or focus them. Try each at this width and on a phone.'
    >
      <Specimen
        label='A · Quiet inline'
        note='One line per record; fields sit beside the name and wrap on narrow sheets.'
        className='block'
      >
        <TakeA />
      </Specimen>
      <Specimen
        label='B · Label and value'
        note='Header line, a hairline, then aligned label / value rows.'
        className='block'
      >
        <TakeB />
      </Specimen>
      <Specimen
        label='C · List'
        note='One bordered list with a column header and hairlines between rows, like a small table.'
        className='block'
      >
        <TakeC />
      </Specimen>
    </DesignSection>
  )
}
