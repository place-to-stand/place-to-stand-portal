'use client'

import { useMemo, useState } from 'react'

import {
  SortableTableHead,
  type SortValue,
} from '@/components/table-toolbar/sortable-table-head'
import { parseSortParam } from '@/lib/pagination/sort'
import { sortRows } from '@/lib/table/sort-rows'
import type { TaskWithRelations } from '@/lib/types'

/**
 * Sortable headers for the Review tab's three tables (Done, Accepted,
 * Archived). Three tables share the page, so each keeps its sort in local
 * state, as the invoice settings tables do. Default: Updated, newest first.
 */
const REVIEW_SORT_FIELDS = [
  'task',
  'comments',
  'files',
  'due',
  'updated',
] as const
type ReviewSortField = (typeof REVIEW_SORT_FIELDS)[number]
const DEFAULT_REVIEW_SORT = { field: 'updated', direction: 'desc' } as const

const time = (value: string | null | undefined) =>
  value ? Date.parse(value) : null

/**
 * `updatedFrom` is the date the Updated column shows (the accepted or
 * archived time on those tables, else the last update), so the column sorts
 * by what it says.
 */
export function useReviewTaskSort(
  tasks: TaskWithRelations[],
  updatedFrom: 'updated_at' | 'accepted_at' | 'deleted_at' = 'updated_at'
) {
  const [sort, setSort] = useState<SortValue | undefined>(undefined)
  const { field, direction } = parseSortParam(
    sort,
    REVIEW_SORT_FIELDS,
    DEFAULT_REVIEW_SORT
  )

  const sorted = useMemo(
    () =>
      sortRows(
        tasks,
        task => {
          switch (field) {
            case 'task':
              return task.title
            case 'comments':
              return task.commentCount || null
            case 'files':
              return (
                (task.attachmentCount ?? task.attachments?.length ?? 0) || null
              )
            case 'due':
              return task.due_on ?? null
            case 'updated':
              return time(task[updatedFrom] ?? task.updated_at)
          }
        },
        direction
      ),
    [tasks, field, direction, updatedFrom]
  )

  const head = (
    headField: ReviewSortField,
    label: string,
    align?: 'center'
  ) => (
    <SortableTableHead
      field={headField}
      sort={sort}
      defaultSort='updated:desc'
      onSortChange={setSort}
      align={align}
    >
      {label}
    </SortableTableHead>
  )

  const heads = (
    <>
      {head('task', 'Task')}
      {head('comments', 'Comments', 'center')}
      {head('files', 'Files', 'center')}
      {head('due', 'Due')}
      {head('updated', 'Updated')}
    </>
  )

  return { sorted, heads }
}
