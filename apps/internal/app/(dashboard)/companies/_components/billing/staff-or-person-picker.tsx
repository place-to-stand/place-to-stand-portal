'use client'

import type { ReactElement } from 'react'

import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import {
  SearchableCombobox,
  type SearchableComboboxItem,
} from '@/components/ui/searchable-combobox'
import { personPhotoSrc } from '@/components/ui/user-avatar'

/** Someone a commission can go to: a staff sign-in or a person. */
export type StaffOrPersonCandidate = {
  kind: 'user' | 'contact'
  id: string
  name: string
  email: string | null
  /** They have a photo, shown in the list; else their initials. */
  hasPhoto?: boolean
}

type StaffOrPersonPickerProps<T extends StaffOrPersonCandidate> = {
  staff: T[]
  people: T[]
  onSelect: (candidate: T) => void
  /** The button that opens the list. */
  trigger: ReactElement
  /** Classes for the trigger's wrapper (e.g. `w-full`). */
  triggerClassName?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  disabled: boolean
  disabledReason: string | null
  /** While saving, picks are ignored. */
  isPending: boolean
  /** Open the person create sheet with what was typed. */
  onCreatePerson: (query: string) => void
}

const keyOf = (candidate: StaffOrPersonCandidate) =>
  `${candidate.kind}:${candidate.id}`

function toItem(candidate: StaffOrPersonCandidate): SearchableComboboxItem {
  return {
    value: keyOf(candidate),
    label: candidate.name,
    description:
      candidate.email && candidate.email !== candidate.name
        ? candidate.email
        : undefined,
    keywords: candidate.email ? [candidate.email] : undefined,
    // Each person shows their own avatar; the field's label carries the
    // person icon.
    avatar: {
      src: personPhotoSrc({
        hasPhoto: candidate.hasPhoto ?? false,
        ...(candidate.kind === 'contact'
          ? { contactId: candidate.id }
          : { userId: candidate.id }),
      }),
    },
  }
}

/**
 * One searchable list of staff, then people, with a pinned "Create person"
 * row: the origination picker and the closers editor both pick from it.
 */
export function StaffOrPersonPicker<T extends StaffOrPersonCandidate>({
  staff,
  people,
  onSelect,
  trigger,
  triggerClassName,
  open,
  onOpenChange,
  disabled,
  disabledReason,
  isPending,
  onCreatePerson,
}: StaffOrPersonPickerProps<T>) {
  const pick = (value: string) => {
    if (isPending) return
    const candidate = [...staff, ...people].find(c => keyOf(c) === value)
    if (candidate) onSelect(candidate)
  }

  return (
    // Never disabled for an empty list: the create row is the escape hatch.
    <DisabledFieldTooltip disabled={disabled} reason={disabledReason}>
      <div className={triggerClassName}>
        <SearchableCombobox
          trigger={trigger}
          open={open}
          onOpenChange={onOpenChange}
          value={null}
          onChange={pick}
          ariaLabel='Add person'
          searchPlaceholder='Search people…'
          groups={[
            { label: 'Staff', items: staff.map(toItem) },
            { label: 'People', items: people.map(toItem) },
          ]}
          onCreate={onCreatePerson}
          createEntityLabel='person'
        />
      </div>
    </DisabledFieldTooltip>
  )
}
