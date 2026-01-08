'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { UserRowState } from '@/lib/settings/users/state/use-users-table-state'

import { UsersTableRow } from '../components/table/users-table-row'

type UsersTableSectionProps = {
  rows: UserRowState[]
  mode: 'active' | 'archive'
  emptyMessage: string
  selfDeleteReason: string
}

export function UsersTableSection({
  rows,
  mode,
  emptyMessage,
  selfDeleteReason,
}: UsersTableSectionProps) {
  return (
    <div className='overflow-hidden rounded-xl border'>
      <Table>
        <TableHeader>
          <TableRow className='bg-muted/40'>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Joined</TableHead>
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
