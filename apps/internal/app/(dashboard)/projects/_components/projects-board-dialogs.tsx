'use client'

import type {
  DbUser,
  ProjectWithRelations,
  TaskWithRelations,
} from '@/lib/types'
import type { BoardColumnId } from '@/lib/projects/board/board-constants'
import { buildProjectTimeLogDialogParams } from '@/lib/projects/time-log/dialog-params'
import type { TimeLogEntry } from '@/lib/projects/time-log/types'

import { TaskSheet } from '../task-sheet'
import { ProjectTimeLogDialog } from './project-time-log/project-time-log-dialog'

type SheetState = {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: TaskWithRelations | undefined
  canManage: boolean
  admins: DbUser[]
  currentUserId: string
  defaultStatus: BoardColumnId
  defaultDueOn: string | null
  onTaskCreated: (taskId: string, projectId: string) => void
}

type TimeLogState = {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  timeLogProjectId: string | null
  tasks: TaskWithRelations[]
  currentUserId: string
  admins: DbUser[]
  mode: 'create' | 'edit'
  editingEntry: TimeLogEntry | null
}

export type ProjectsBoardDialogsProps = {
  activeProject: ProjectWithRelations | null
  sheetState: SheetState
  timeLogState: TimeLogState
  projects: ProjectWithRelations[]
}

export function ProjectsBoardDialogs({
  activeProject,
  sheetState,
  timeLogState,
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
    onTaskCreated,
  } = sheetState

  const {
    isOpen: isTimeLogOpen,
    onOpenChange: onTimeLogOpenChange,
    timeLogProjectId,
    tasks,
    currentUserId: timeLogUserId,
    admins: timeLogAdmins,
    mode: timeLogMode,
    editingEntry,
  } = timeLogState

  const timeLogDialogOpen =
    isTimeLogOpen && timeLogProjectId === activeProject.id

  return (
    <>
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
        defaultAssigneeId={null}
        onTaskCreated={onTaskCreated}
      />

      <ProjectTimeLogDialog
        open={timeLogDialogOpen}
        onOpenChange={onTimeLogOpenChange}
        {...buildProjectTimeLogDialogParams(activeProject, {
          tasks,
          currentUserId: timeLogUserId,
          admins: timeLogAdmins,
        })}
        mode={timeLogMode}
        timeLogEntry={editingEntry}
      />
    </>
  )
}
