'use client'

import { useId, useMemo, useState } from 'react'
import type { Control } from 'react-hook-form'
import { X } from 'lucide-react'

import { Input } from '@pts/ui/input'
import { RowActionButton } from '@pts/ui/row-action-button'

import {
  EffectiveMonthPicker,
  type EffectiveMonthOption,
} from '@/components/billing/effective-month-select'
import { EntityList } from '@/components/sheets/entity-list'
import { SheetRecordRow } from '@/components/sheets/sheet-record-row'
import { usePendingRemovals } from '@/components/sheets/use-pending-removals'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { SearchableCombobox } from '@/components/ui/searchable-combobox'
import {
  addMonths,
  currentMonthStartUtc,
  monthLabel,
} from '@/lib/billing/months'
import type { ProfitShareStaff } from '@/lib/business/settings-query'
import { ENTITY_ICONS } from '@/lib/entity-accents'

import type { TextInput, TextOutput } from './business-form-fields'

/** The select's value for "no start month" (a select item can't be ''). */
const OFF = 'off'

/**
 * The partner profit share on the monthly close: from which month, the cash
 * the business keeps before splitting, and who splits it. It stays off until
 * a start month and at least one person are set.
 */
export function ProfitShareFields({
  control,
  staff,
  savedPartnerIds,
  disabled,
}: {
  control: Control<TextInput, unknown, TextOutput>
  staff: ProfitShareStaff[]
  /** The partners as saved, so a removed one shows as Pending removal. */
  savedPartnerIds: string[]
  disabled: boolean
}) {
  return (
    <section className='grid gap-4'>
      <div className='grid gap-1'>
        <h2 className='text-lg font-semibold'>Profit share</h2>
        <p className='text-muted-foreground text-sm'>
          The monthly close splits the month-end bank balance, less partner
          payouts and the minimum, between the people below. Off until you pick
          a start month and at least one person.
        </p>
      </div>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
        <FormField
          control={control}
          name='profitShareStartMonth'
          render={({ field }) => (
            <StartMonthField
              value={field.value}
              onChange={field.onChange}
              disabled={disabled}
            />
          )}
        />
        <FormField
          control={control}
          name='profitShareMinimumBalance'
          render={({ field }) => (
            <FormItem>
              <FormLabel optional>Minimum balance</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  inputMode='decimal'
                  placeholder='0'
                  disabled={disabled}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name='profitSharePartnerIds'
          render={({ field }) => (
            <FormItem className='sm:col-span-2'>
              <PartnerList
                // A save keeps this page mounted: start a fresh list from
                // what was saved, so a saved removal stops reading as pending.
                key={savedPartnerIds.join()}
                value={field.value}
                onChange={field.onChange}
                staff={staff}
                savedIds={savedPartnerIds}
                disabled={disabled}
              />
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </section>
  )
}

function StartMonthField({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  disabled: boolean
}) {
  const id = useId()
  const months = useMemo(() => monthOptions(value), [value])
  return (
    <FormItem>
      <FormLabel optional htmlFor={id}>
        Start month
      </FormLabel>
      <EffectiveMonthPicker
        id={id}
        ariaLabel='Start month'
        value={value || OFF}
        onChange={next => onChange(next === OFF ? '' : next)}
        options={months}
        disabled={disabled}
        className='w-full'
      />
      <FormMessage />
    </FormItem>
  )
}

/** Off, then every month from three years back to a year ahead, newest first. */
function monthOptions(current: string): EffectiveMonthOption<string>[] {
  const thisMonth = currentMonthStartUtc()
  const keys = new Set<string>()
  for (let offset = 12; offset >= -36; offset--) {
    keys.add(addMonths(thisMonth, offset).slice(0, 7))
  }
  if (current) keys.add(current)
  const months = [...keys]
    .sort()
    .reverse()
    .map(key => ({ value: key, label: monthLabel(`${key}-01`) }))
  return [{ value: OFF, label: 'Off' }, ...months]
}

/**
 * Who splits the profit share: the house list of related records (preview
 * cards, + to add from a staff picker, Pending removal with Undo until Save).
 */
function PartnerList({
  value,
  onChange,
  staff,
  savedIds,
  disabled,
}: {
  value: string[]
  onChange: (ids: string[]) => void
  staff: ProfitShareStaff[]
  savedIds: string[]
  disabled: boolean
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const byId = useMemo(
    () => new Map(staff.map(person => [person.id, person])),
    [staff]
  )
  const picked = value.flatMap(id => byId.get(id) ?? [])
  const savedKeys = useMemo(() => new Set(savedIds), [savedIds])
  const removals = usePendingRemovals<ProfitShareStaff>(
    person => person.id,
    picked,
    savedKeys
  )
  const available = staff.filter(person => !value.includes(person.id))
  const rank = (id: string) => {
    const index = savedIds.indexOf(id)
    return index === -1 ? Number.POSITIVE_INFINITY : index
  }
  // Saved people first, in saved order; new picks keep their order after.
  const inSavedOrder = (ids: string[]) =>
    [...ids].sort((a, b) => rank(a) - rank(b))

  return (
    <EntityList
      title='Split between'
      add={{
        label: 'Add person',
        onAdd: () => setPickerOpen(true),
        disabled,
        render: button => (
          <SearchableCombobox
            trigger={button}
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            value={null}
            onChange={id => {
              if (!value.includes(id)) onChange([...value, id])
              setPickerOpen(false)
            }}
            ariaLabel='Add person'
            searchPlaceholder='Search staff…'
            items={available.map(person => ({
              value: person.id,
              label: person.name,
              description:
                person.email !== person.name ? person.email : undefined,
              keywords: [person.email],
              userId: person.id,
            }))}
          />
        ),
      }}
      isEmpty={picked.length === 0 && removals.pending.length === 0}
      emptyMessage='Nobody yet. Each person gets an equal share.'
    >
      {removals.rows.map(({ item: person, pending }) => (
        <SheetRecordRow
          key={person.id}
          icon={ENTITY_ICONS.contact}
          title={person.name}
          description={person.email !== person.name ? person.email : null}
          pendingRemoval={
            pending
              ? {
                  disabled,
                  // Back where it was saved, not at the end.
                  onUndo: () => onChange(inSavedOrder([...value, person.id])),
                }
              : undefined
          }
          actions={
            <RowActionButton
              type='button'
              label={`Remove ${person.name}`}
              icon={<X />}
              className='text-muted-foreground hover:text-destructive shrink-0'
              onClick={() => {
                removals.markRemoved(person)
                onChange(value.filter(id => id !== person.id))
              }}
              disabled={disabled}
            />
          }
        />
      ))}
    </EntityList>
  )
}
