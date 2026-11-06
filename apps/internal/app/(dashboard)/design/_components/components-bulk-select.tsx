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
import { CLICKABLE_ROW_CLASS } from '@/lib/table/clickable-row'
import { UNREAD_ROW_CLASS } from '@/lib/table/unread-row'
import { cn } from '@/lib/utils'

import { DesignSection, Specimen } from './specimen'

const SAMPLE_ROWS = [
  {
    id: 'a',
    name: 'Ada Lovelace',
    form: 'Contact',
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
    form: 'Contact',
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
      when='Every list with an Archive row action. The first column holds a box that shows on hover (the header box while the table is hovered); once one row is ticked every box shows and the bulk bar rises from the bottom. An unread dot shares the column and gives way to the box on hover, while the row keeps its unread weight and leading bar. The header box ticks the page, then the bar offers every matching row across pages.'
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
                  <TableHead>Contact</TableHead>
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
          runAction={async ({ selection: input }) => {
            const ids =
              input.kind === 'ids' ? input.ids : rows.map(row => row.id)
            setRows(current => current.filter(row => !ids.includes(row.id)))
            return { done: ids.length, failed: [], warnings: [] }
          }}
        />
      </Specimen>
    </DesignSection>
  )
}
