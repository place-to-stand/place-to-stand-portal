'use client'

import type {
  DbUser,
  ProjectWithRelations,
  TaskWithRelations,
} from '@/lib/types'
import type { BoardColumnId } from '@/lib/projects/board/board-constants'

import { TaskSheet } from '../task-sheet'
import { PageSheetEntry } from '@/lib/sheets/page-sheet-entry'

type SheetState = {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: TaskWithRelations | undefined
  canManage: boolean
  admins: DbUser[]
  currentUserId: string
  defaultStatus: BoardColumnId
  defaultDueOn: string | null
}

export type ProjectsBoardDialogsProps = {
  activeProject: ProjectWithRelations | null
  sheetState: SheetState
  projects: ProjectWithRelations[]
}

export function ProjectsBoardDialogs({
  activeProject,
  sheetState,
  projects,
}: ProjectsBoardDialogsProps) {
  if (!activeProject) {
    return null
  }

  const {
    open,
    onOpenChange,
    task,
    canManage,
    admins,
    currentUserId,
    defaultStatus,
    defaultDueOn,
  } = sheetState

  return (
    <PageSheetEntry entity='task'>
      <TaskSheet
        open={open}
        onOpenChange={onOpenChange}
        task={task}
        canManage={canManage}
        admins={admins}
        currentUserId={currentUserId}
        defaultStatus={defaultStatus}
        defaultDueOn={defaultDueOn}
        projects={projects}
        defaultProjectId={activeProject.id}
        // A new task starts assigned to you, like My tasks.
        defaultAssigneeId={currentUserId}
      />
    </PageSheetEntry>
  )
}
