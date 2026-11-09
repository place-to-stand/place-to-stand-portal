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
import { EmptyState } from '@pts/ui/empty-state'

import type { ProjectWithClient, ProjectsTableMode } from './types'
import { ProjectsTableRow } from './projects-table-row'
import {
  RowSelectionProvider,
  SelectAllHead,
  type RowSelection,
} from '@/components/table/bulk-select'

type ProjectsTableSectionProps = {
  projects: ProjectWithClient[]
  selection: RowSelection
  mode: ProjectsTableMode
  onEdit: (project: ProjectWithClient) => void
  onRequestDelete: (project: ProjectWithClient) => void
  onRestore: (project: ProjectWithClient) => void
  isPending: boolean
  pendingReason: string
  pendingDeleteId: string | null
  pendingRestoreId: string | null
  emptyMessage: string
}

function isProjectSortValue(value: string): boolean {
  const [field, direction] = value.split(':')
  return (
    (field === 'name' || field === 'created') &&
    (direction === 'asc' || direction === 'desc')
  )
}

export function ProjectsTableSection({
  projects,
  selection,
  mode,
  onEdit,
  onRequestDelete,
  onRestore,
  isPending,
  pendingReason,
  pendingDeleteId,
  pendingRestoreId,
  emptyMessage,
}: ProjectsTableSectionProps) {
  const { update, getParam } = useListParams({
    basePath: '/projects/archive',
    resetKeys: ['page'],
  })
  const rawSort = getParam('sort')
  const sort = rawSort && isProjectSortValue(rawSort) ? rawSort : undefined

  return (
    <div className='overflow-hidden rounded-lg border'>
      <RowSelectionProvider selection={selection} entity='project'>
        <Table
          density='compact'
          layout='fixed'
          stack
          className='md:min-w-[40rem]'
        >
          <TableHeader>
            <TableRow className='bg-muted/40'>
              <SelectAllHead />
              <SortableTableHead
                field='name'
                sort={sort}
                defaultSort='name:asc'
                onSortChange={next => update({ sort: next })}
              >
                Name
              </SortableTableHead>
              <TableHead className='w-[25%]'>Owner</TableHead>
              <SortableTableHead
                field='created'
                sort={sort}
                defaultSort='name:asc'
                onSortChange={next => update({ sort: next })}
                className='w-[32%]'
              >
                Timeline
              </SortableTableHead>
              {/* Archive is in the right-click menu and the bulk bar; only the
                  Archive tab keeps a row button (Restore). */}
              {mode === 'archive' ? (
                <TableHead className='w-20 text-right'>Actions</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map(project => (
              <ProjectsTableRow
                key={project.id}
                project={project}
                mode={mode}
                isPending={isPending}
                pendingReason={pendingReason}
                pendingDeleteId={pendingDeleteId}
                pendingRestoreId={pendingRestoreId}
                onEdit={onEdit}
                onRequestDelete={onRequestDelete}
                onRestore={onRestore}
              />
            ))}
            {projects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={mode === 'archive' ? 5 : 4} className='p-4'>
                  <EmptyState message={emptyMessage} />
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </RowSelectionProvider>
    </div>
  )
}
