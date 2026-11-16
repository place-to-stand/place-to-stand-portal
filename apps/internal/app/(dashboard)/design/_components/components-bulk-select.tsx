'use client'

import { useState } from 'react'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pts/ui/table'
import {
  BulkActionBar,
  RowSelectionProvider,
  SelectAllHead,
  SelectRowCell,
  useRowSelection,
} from '@/components/table/bulk-select'
import {
  BOARD_CARD_SELECTED_CLASS,
  BoardSelectionProvider,
  useBoardSelection,
  useSelectableCard,
} from '@/components/board/board-selection'
import { ENTITY_ACCENTS } from '@/lib/entity-accents'
import { withoutHidden } from '@/lib/dnd/board-selection'
import { CLICKABLE_ROW_CLASS } from '@/lib/table/clickable-row'
import { UNREAD_ROW_CLASS } from '@/lib/table/unread-row'
import { cn } from '@/lib/utils'

import { DesignSection, Specimen } from './specimen'

const SAMPLE_ROWS = [
  {
    id: 'a',
    name: 'Ada Lovelace',
    form: 'Subscribe',
    when: '2 hours ago',
    unread: true,
  },
  {
    id: 'b',
    name: 'Grace Hopper',
    form: 'Audit',
    when: 'Yesterday',
    unread: true,
  },
  {
    id: 'c',
    name: 'Alan Turing',
    form: 'Subscribe',
    when: '3 days ago',
    unread: false,
  },
  {
    id: 'd',
    name: 'Katherine Johnson',
    form: 'Subscribe',
    when: 'Last week',
    unread: false,
  },
]

/** Pretends 118 submissions match, so "Select all 118" shows. */
const MATCHING = 118

export function ComponentsBulkSelect() {
  const [rows, setRows] = useState(SAMPLE_ROWS)
  const selection = useRowSelection(
    rows.map(row => row.id),
    MATCHING
  )

  return (
    <DesignSection
      id='bulk-select'
      title='Bulk select'
      when='Every list with an Archive row action. The first column holds a box that shows on hover (the header box always shows); once one row is ticked every box shows and the bulk bar rises from the bottom. An unread dot shares the column and gives way to the box on hover, while the row keeps its unread weight and tint. The header box ticks the page, then the bar offers every matching row across pages.'
    >
      <Specimen
        label='RowSelectionProvider, SelectAllHead, SelectRowCell, BulkActionBar'
        note='components/table/bulk-select. Hover a row, tick it, shift-click for a range, tick the header for the page. Archive here only hides the rows.'
        className='block'
      >
        <div className='overflow-hidden rounded-lg border'>
          <RowSelectionProvider selection={selection} entity='submission'>
            <Table density='compact' layout='fixed' stack>
              <TableHeader>
                <TableRow className='bg-muted/40'>
                  <SelectAllHead />
                  <TableHead className='w-32'>Received</TableHead>
                  <TableHead className='w-28'>Form</TableHead>
                  <TableHead>Person</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(row => (
                  <TableRow
                    key={row.id}
                    data-selected={selection.isSelected(row.id) || undefined}
                    className={cn(
                      CLICKABLE_ROW_CLASS,
                      row.unread && UNREAD_ROW_CLASS
                    )}
                  >
                    <SelectRowCell
                      id={row.id}
                      label={row.name}
                      unread={row.unread}
                      unreadLabel='Unacknowledged'
                    />
                    <TableCell>{row.when}</TableCell>
                    <TableCell label='Form'>{row.form}</TableCell>
                    <TableCell className='max-md:order-first max-md:basis-full'>
                      {row.name}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </RowSelectionProvider>
        </div>
        <BulkActionBar
          selection={selection}
          entity='submission'
          mode='active'
          nameOf={id => rows.find(row => row.id === id)?.name}
          onDone={() => undefined}
          resolveMatching={async () => ({ ids: rows.map(row => row.id) })}
          runAction={async ({ selection: input }) => {
            const ids =
              input.kind === 'ids' ? input.ids : rows.map(row => row.id)
            setRows(current => current.filter(row => !ids.includes(row.id)))
            return { done: ids.length, failed: [], warnings: [] }
          }}
        />
      </Specimen>
      <BoardSpecimen />
    </DesignSection>
  )
}

const SAMPLE_COLUMNS = [
  {
    label: 'On deck',
    cards: [
      { id: 't1', title: 'Update the homepage copy' },
      { id: 't2', title: 'Fix the cart drawer on Safari' },
      { id: 't3', title: 'Add order notes to the export' },
    ],
  },
  {
    label: 'In progress',
    cards: [
      { id: 't4', title: 'Move the blog to the new CMS' },
      { id: 't5', title: 'Speed up the product page' },
    ],
  },
]

/** A board's cards: shift, ⌘ or Ctrl to select, and the same bulk bar. */
function BoardSpecimen() {
  const [columns, setColumns] = useState(SAMPLE_COLUMNS)
  const selection = useBoardSelection(
    columns.map(column => column.cards.map(card => card.id)),
    true
  )
  const all = columns.flatMap(column => column.cards)

  return (
    <Specimen
      label='useBoardSelection, BoardSelectionProvider, BoardBulkBar'
      note='components/board. Shift-click a range down a column, or ⌘-click (Ctrl) to add or drop one card. A plain click opens the card. Escape clears. Archive here only hides the cards.'
      className='block'
    >
      <BoardSelectionProvider selection={selection}>
        <div className='grid max-w-xl grid-cols-2 gap-4'>
          {columns.map(column => (
            <div key={column.label} className='space-y-2'>
              <p className='text-muted-foreground text-xs font-medium'>
                {column.label}
              </p>
              {withoutHidden(column.cards, selection.hidden).map(card => (
                <SpecimenCard key={card.id} id={card.id} title={card.title} />
              ))}
            </div>
          ))}
        </div>
      </BoardSelectionProvider>
      <BulkActionBar
        selection={selection}
        entity='task'
        mode='active'
        nameOf={id => all.find(card => card.id === id)?.title}
        onDone={() => undefined}
        runAction={async ({ selection: input }) => {
          const ids = input.kind === 'ids' ? input.ids : []
          setColumns(current =>
            current.map(column => ({
              ...column,
              cards: column.cards.filter(card => !ids.includes(card.id)),
            }))
          )
          return { done: ids.length, failed: [], warnings: [] }
        }}
      />
    </Specimen>
  )
}

function SpecimenCard({ id, title }: { id: string; title: string }) {
  const card = useSelectableCard(id, () => undefined, undefined)
  return (
    <div
      role='button'
      tabIndex={0}
      {...card.props}
      className={cn(
        'bg-card rounded-lg border p-4 text-sm font-semibold shadow-sm transition-[color,background-color,border-color,box-shadow] select-none',
        ENTITY_ACCENTS.task.card,
        card.selected && BOARD_CARD_SELECTED_CLASS
      )}
    >
      {title}
      {card.note}
    </div>
  )
}
