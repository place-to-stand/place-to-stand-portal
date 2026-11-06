'use client'

import * as React from 'react'
import type { LucideIcon } from 'lucide-react'
import { ChevronsUpDownIcon, XIcon } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { PopoverTrigger } from '@pts/ui/popover'
import { RowActionButton } from '@pts/ui/row-action-button'

import { SheetRecordRow } from '@/components/sheets/sheet-record-row'
import { ENTITY_ICONS } from '@/lib/entity-accents'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'

/**
 * Trial (Nov 2026): a picker holding a record shows it as its preview card
 * (the card every sheet list uses) instead of the field plus an Open button.
 * The card opens the record; × clears it; the chevron opens the list again.
 * Set to false to go back to the field and its Open button everywhere.
 */
export const PICKED_RECORD_CARDS = true

/**
 * What a picker needs to show its pick as a record: the entity's registry
 * icon and noun, and how to open it. Leave `onOpen` out when the viewer
 * can't open that record; the card then only changes and clears.
 */
export type PickedRecord = {
  icon: LucideIcon
  /** Singular noun: "company" → "Open company", "Change company". */
  entityLabel: string
  onOpen?: () => void
}

/**
 * For a client picker (invoice, hour block, project): call at the top of the
 * component, then pass `record={clientRecord(field.value)}`. A client is a
 * company, so its card opens the company sheet.
 */
export function useClientRecord(): (
  companyId: string | null | undefined
) => PickedRecord {
  const { open } = useSheetParams()
  return companyId => ({
    icon: ENTITY_ICONS.client,
    entityLabel: 'client',
    onOpen: companyId ? () => open('company', companyId) : undefined,
  })
}

type PickedRecordCardProps = {
  record: PickedRecord
  title: React.ReactNode
  /** The record's name, for the open button's accessible name. */
  name: string
  description?: React.ReactNode
  /** Clears the pick. Required fields pass it too: the form's check stops an empty save. */
  onClear?: () => void
  /** Read-only: the card still opens the record but can't change. */
  disabled?: boolean
  /** The chevron is the popover's trigger; these are the field's props. */
  triggerProps: React.ComponentProps<'button'>
  triggerRef?: React.Ref<HTMLButtonElement>
}

/**
 * A picked record, as its preview card: icon, name, detail line. The whole
 * card is the click target that opens the record (stacked as its sheet),
 * so it's easier to hit than the small Open button it replaces.
 */
export const PickedRecordCard = React.forwardRef<
  HTMLDivElement,
  PickedRecordCardProps
>(function PickedRecordCard(
  {
    record,
    title,
    name,
    description,
    onClear,
    disabled = false,
    triggerProps,
    triggerRef,
  },
  ref
) {
  const changeLabel = `Change ${record.entityLabel}`
  return (
    <div ref={ref} className='min-w-0 flex-1'>
      <SheetRecordRow
        icon={record.icon}
        title={title}
        description={description}
        onOpen={record.onOpen}
        openLabel={`Open ${name}`}
        // One line sits at the fields' height; a detail line gets the
        // roomier two-line card.
        size={description ? 'default' : 'field'}
        actions={
          disabled ? undefined : (
            <>
              {onClear ? (
                <RowActionButton
                  type='button'
                  label={`Clear ${record.entityLabel}`}
                  icon={<XIcon />}
                  className='text-muted-foreground'
                  onClick={onClear}
                />
              ) : null}
              {/* No tooltip: the sheet focuses this on open, and a tooltip
                  would pop up every time. Its aria-label names it. */}
              <PopoverTrigger asChild>
                <Button
                  ref={triggerRef}
                  type='button'
                  // The field's trigger, so the sheet's first-field focus
                  // and screen readers find it as the picker it is.
                  role='combobox'
                  variant='ghost'
                  size='icon-sm'
                  className='text-muted-foreground'
                  {...triggerProps}
                  aria-label={changeLabel}
                >
                  <ChevronsUpDownIcon aria-hidden />
                </Button>
              </PopoverTrigger>
            </>
          )
        }
      />
    </div>
  )
})
