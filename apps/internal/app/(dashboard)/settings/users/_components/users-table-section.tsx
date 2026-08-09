'use client'

import { SortableTableHead } from '@/components/table-toolbar/sortable-table-head'
import { useListParams } from '@/hooks/use-list-params'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pts/ui/table'
import { isUserSortValue } from '@/lib/settings/users/filters'
import type { UserRowState } from '@/lib/settings/users/state/use-users-table-state'

import { UsersTableRow } from '../components/table/users-table-row'

type UsersTableSectionProps = {
  rows: UserRowState[]
  mode: 'active' | 'archive'
  emptyMessage: string
  selfDeleteReason: string
  /** Route the sort/filter params live on (PRD 004 §03). */
  basePath: string
}

export function UsersTableSection({
  rows,
  mode,
  emptyMessage,
  selfDeleteReason,
  basePath,
}: UsersTableSectionProps) {
  const { update, getParam } = useListParams({
    basePath,
    resetKeys: ['page'],
  })
  const rawSort = getParam('sort')
  const sort = rawSort && isUserSortValue(rawSort) ? rawSort : undefined

  return (
    <div className='overflow-hidden rounded-lg border'>
      <Table density='compact'>
        <TableHeader>
          <TableRow className='bg-muted/40'>
            <SortableTableHead
              field='name'
              sort={sort}
              defaultSort='name:asc'
              onSortChange={next => update({ sort: next })}
            >
              Name
            </SortableTableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Access</TableHead>
            <SortableTableHead
              field='created'
              sort={sort}
              defaultSort='name:asc'
              onSortChange={next => update({ sort: next })}
            >
              Joined
            </SortableTableHead>
            <TableHead className='w-32 text-right'>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(row => (
            <UsersTableRow
              key={row.user.id}
              row={row}
              mode={mode}
              selfDeleteReason={selfDeleteReason}
            />
          ))}
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className='text-muted-foreground py-10 text-center text-sm'
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  )
}
