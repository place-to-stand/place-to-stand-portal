'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { ClipboardList, HelpCircle } from 'lucide-react'

import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@pts/ui/tooltip'
import { cn } from '@/lib/utils'
import { useSheetFormControls } from '@/lib/hooks/use-sheet-form-controls'

import type {
  DbUser,
  ProjectWithRelations,
  TaskWithRelations,
} from '@/lib/types'
import { useTaskSheetState } from '@/lib/projects/task-sheet/use-task-sheet-state'
import { buildProjectTimeLogDialogParams } from '@/lib/projects/time-log/dialog-params'
import type { TimeLogEntry } from '@/lib/projects/time-log/types'

import { ProjectTimeLogDialog } from './_components/project-time-log/project-time-log-dialog'
import { TimeLogSection } from './_components/task-sheet/time-log-section'
import { TASK_TIME_LOGS_KEY } from './_components/task-sheet/use-task-time-logs'
import { SheetFormFooter } from '@/components/sheets/sheet-form-footer'
import { SheetFormHeader } from '@/components/sheets/sheet-form-header'
import { TaskSheetForm } from './_components/task-sheet/task-sheet-form'
import { TASK_FORM_ID } from './_components/task-sheet/form/task-sheet-form'
import { PlanningPanel } from './_components/task-sheet/planning-panel'
import { TaskCommentsPanel } from './_components/task-sheet/task-comments-panel'
import { TaskActivityPanel } from './_components/task-sheet/task-activity-panel'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@pts/ui/tabs'
import type { BoardColumnId } from '@/lib/projects/board/board-constants'

// Survives page remounts (module scope): navigating to a task URL changes a
// dynamic route param, which remounts the whole page — including this sheet.
// When the outgoing page had the sheet open (the create→edit transition, or
// switching tasks with the sheet up), the incoming instance skips its mount
// animation so the swap doesn't read as the sheet closing and reopening.
let sheetOpenBeforePageSwap = false

type TaskSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  task?: TaskWithRelations
  canManage: boolean
  admins: DbUser[]
  currentUserId: string
  defaultStatus: BoardColumnId
  defaultDueOn: string | null
  projects: ProjectWithRelations[]
  projectSelectionProjects?: ProjectWithRelations[]
  defaultProjectId: string | null
  defaultAssigneeId: string | null
  defaultLeadId?: string | null
  closeOnSave?: boolean
  onTaskCreated?: (taskId: string, projectId: string) => void
}

export function TaskSheet(props: TaskSheetProps) {
  const {
    form,
    feedback,
    isPending,
    isDeleteDialogOpen,
    assigneeItems,
    projectItems,
    projectGroups,
    sheetTitle,
    deleteDisabled,
    deleteDisabledReason,
    submitDisabled,
    submitDisabledReason,
    unsavedChangesDialog,
    handleSheetOpenChange,
    handleFormSubmit,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
    resolveDisabledReason,
    editorKey,
    taskStatuses,
    unassignedValue,
    attachments,
    handleAttachmentUpload,
    handleAttachmentRemove,
    isUploadingAttachments,
    acceptedAttachmentTypes,
    maxAttachmentSize,
    attachmentsDisabledReason,
  } = useTaskSheetState({
    open: props.open,
    onOpenChange: props.onOpenChange,
    task: props.task,
    canManage: props.canManage,
    admins: props.admins,
    defaultStatus: props.defaultStatus,
    defaultDueOn: props.defaultDueOn,
    projects: props.projects,
    projectSelectionProjects: props.projectSelectionProjects,
    defaultProjectId: props.defaultProjectId,
    defaultAssigneeId: props.defaultAssigneeId,
    defaultLeadId: props.defaultLeadId ?? null,
    currentUserId: props.currentUserId,
    closeOnSave: props.closeOnSave,
    onTaskCreated: props.onTaskCreated,
  })

  const [isDragActive, setIsDragActive] = useState(false)
  // Frozen at mount: skip the slide-in only when this instance mounts
  // already-open right after a page swap that also had the sheet open.
  const [skipMountAnimation] = useState(
    () => props.open && sheetOpenBeforePageSwap
  )

  useEffect(() => {
    sheetOpenBeforePageSwap = props.open
    return () => {
      // Reset after unmount so an unrelated later mount (e.g. the lead task
      // overlay) doesn't inherit a stale "was open" flag. A page-swap
      // replacement reads the flag during render, before this cleanup runs.
      sheetOpenBeforePageSwap = false
    }
  }, [props.open])

  // Planning panel is collapsed by default; user expands it on demand.
  const [isPlanningOpen, setIsPlanningOpen] = useState(false)
  // Deferred mount: the panel creates a planning session when it mounts, so
  // it only mounts on first expand — after that it stays mounted so the
  // collapse animation has content to slide away.
  const [hasPlanningMounted, setHasPlanningMounted] = useState(false)
  const planningTaskId = props.task?.id ?? null
  const [prevPlanningTaskId, setPrevPlanningTaskId] = useState(planningTaskId)

  // The board reuses one TaskSheet instance across tasks — reset planning
  // state on task switch so a hidden mounted panel can't create planning
  // sessions for tasks the user never expanded planning on. Adjust-during-
  // render (not an effect) so React restarts the render immediately.
  if (prevPlanningTaskId !== planningTaskId) {
    setPrevPlanningTaskId(planningTaskId)
    setIsPlanningOpen(false)
    setHasPlanningMounted(false)
  }
  const dragCounterRef = useRef(0)
  const attachmentsDisabled = isPending || !props.canManage
  const dropDisabled = attachmentsDisabled || isUploadingAttachments

  // ---- Form controls (undo/redo, keyboard shortcuts) ----
  const isEditing = Boolean(props.task)
  const historyKey = props.task?.id ?? 'task:new'

  const handleSave = useCallback(
    () => form.handleSubmit(handleFormSubmit)(),
    [form, handleFormSubmit]
  )

  const { undo, redo, canUndo, canRedo } = useSheetFormControls({
    form,
    isActive: props.open,
    canSave: !submitDisabled,
    onSave: handleSave,
    historyKey,
  })

  const saveLabel = useMemo(() => {
    if (isPending) return 'Saving...'
    if (isEditing) return 'Save changes'
    return 'Create task'
  }, [isEditing, isPending])

  // ---- Drag & drop ----
  const hasDraggedFiles = useCallback(
    (event: DragEvent<HTMLDivElement>) =>
      Array.from(event.dataTransfer?.types ?? []).includes('Files'),
    []
  )

  const handleDragEnter = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!hasDraggedFiles(event)) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      if (dropDisabled) {
        return
      }

      dragCounterRef.current += 1
      setIsDragActive(true)
    },
    [dropDisabled, hasDraggedFiles]
  )

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!hasDraggedFiles(event)) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      if (dropDisabled) {
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = 'none'
        }
        return
      }

      event.dataTransfer.dropEffect = 'copy'
    },
    [dropDisabled, hasDraggedFiles]
  )

  const handleDragLeave = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!hasDraggedFiles(event)) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      if (dropDisabled) {
        dragCounterRef.current = 0
        setIsDragActive(false)
        return
      }

      dragCounterRef.current = Math.max(dragCounterRef.current - 1, 0)
      if (dragCounterRef.current === 0) {
        setIsDragActive(false)
      }
    },
    [dropDisabled, hasDraggedFiles]
  )

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!hasDraggedFiles(event)) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      const files = event.dataTransfer?.files
      dragCounterRef.current = 0
      setIsDragActive(false)

      if (dropDisabled || !files || files.length === 0) {
        return
      }

      handleAttachmentUpload(files)
    },
    [dropDisabled, handleAttachmentUpload, hasDraggedFiles]
  )

  const taskProject = useMemo(() => {
    if (!props.task) {
      return null
    }
    return props.projects.find(project => project.id === props.task?.project_id)
  }, [props.projects, props.task])

  // ---- Time section + time-log dialog (edit mode only) ----
  const queryClient = useQueryClient()
  const [isTimeLogDialogOpen, setIsTimeLogDialogOpen] = useState(false)
  const [timeLogDialogMode, setTimeLogDialogMode] = useState<'create' | 'edit'>(
    'create'
  )
  const [editingTimeLogEntry, setEditingTimeLogEntry] =
    useState<TimeLogEntry | null>(null)

  const taskId = props.task?.id ?? null

  const initialLinkedTaskIds = useMemo(
    () => (taskId ? [taskId] : []),
    [taskId]
  )

  const handleLogTime = useCallback(() => {
    setTimeLogDialogMode('create')
    setEditingTimeLogEntry(null)
    setIsTimeLogDialogOpen(true)
  }, [])

  const handleEditTimeLogEntry = useCallback((entry: TimeLogEntry) => {
    setTimeLogDialogMode('edit')
    setEditingTimeLogEntry(entry)
    setIsTimeLogDialogOpen(true)
  }, [])

  const handleTimeLogDialogOpenChange = useCallback((open: boolean) => {
    setIsTimeLogDialogOpen(open)
    if (!open) {
      setTimeLogDialogMode('create')
      setEditingTimeLogEntry(null)
    }
  }, [])

  const handleTimeLogMutationSuccess = useCallback(() => {
    if (taskId) {
      queryClient.invalidateQueries({ queryKey: [TASK_TIME_LOGS_KEY, taskId] })
    }
  }, [queryClient, taskId])

  // The DB check `time_log_tasks_project_match` makes the PERSISTED project
  // authoritative — an unsaved project change must block logging until saved.
  const watchedProjectId = form.watch('projectId') ?? null
  const taskUnavailableForTime = Boolean(
    props.task && (props.task.deleted_at || props.task.status === 'ARCHIVED')
  )
  const projectFieldUnsaved = Boolean(
    props.task && watchedProjectId !== props.task.project_id
  )
  const logTimeDisabledReason = taskUnavailableForTime
    ? 'Time cannot be logged on an archived task.'
    : projectFieldUnsaved
      ? 'Save or revert the project change before logging time.'
      : null

  const taskPanelProjectId = props.task?.project_id ?? null
  const taskPanelClientId = taskProject?.client?.id ?? null
  const canDeploy = Boolean(
    props.task && taskProject?.githubRepos && taskProject.githubRepos.length > 0
  )

  return (
    <>
      <Sheet open={props.open} onOpenChange={handleSheetOpenChange}>
        <SheetContent
          hideCloseButton
          skipMountAnimation={skipMountAnimation}
          size='2xl'
          className={cn(
            'flex w-full flex-col gap-0 overflow-hidden p-0',
            // Widen for the planning rail (36px) and, when expanded, the
            // 560px planning panel.
            props.task &&
              (canDeploy && isPlanningOpen
                ? 'sm:max-w-[1268px]'
                : 'sm:max-w-[708px]')
          )}
          // Inline so it wins over the primitive's transition classes: the
          // sheet edge glides in sync with the panel's width transition.
          style={
            props.task
              ? { transition: 'max-width 300ms ease-in-out' }
              : undefined
          }
        >
          {/* Header — spans full width */}
          <SheetFormHeader entity='task' title={sheetTitle} />

          {/* Two-column body */}
          <div className='flex flex-1 overflow-hidden'>
            {/* Left column: task content */}
            <div className='flex h-full w-full flex-col sm:w-[672px] sm:shrink-0'>
              {/* Scrollable area */}
              <div
                className='flex flex-1 flex-col gap-6 overflow-y-auto pb-4 pt-6'
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <TaskSheetForm
                  form={form}
                  onSubmit={handleFormSubmit}
                  feedback={feedback}
                  isPending={isPending}
                  canManage={props.canManage}
                  assigneeItems={assigneeItems}
                  projectItems={projectItems}
                  projectGroups={projectGroups}
                  resolveDisabledReason={resolveDisabledReason}
                  taskStatuses={taskStatuses}
                  unassignedValue={unassignedValue}
                  editorKey={editorKey}
                  isSheetOpen={props.open}
                  attachments={attachments}
                  onAttachmentUpload={handleAttachmentUpload}
                  onAttachmentRemove={handleAttachmentRemove}
                  isUploadingAttachments={isUploadingAttachments}
                  acceptedAttachmentTypes={acceptedAttachmentTypes}
                  maxAttachmentSize={maxAttachmentSize}
                  attachmentsDisabledReason={attachmentsDisabledReason}
                  isDragActive={!dropDisabled && isDragActive}
                />
                {/* Time is only tracked against client work — internal and
                    personal projects have no billing target for it. */}
                {props.task && taskProject?.type === 'CLIENT' ? (
                  <TimeLogSection
                    taskId={props.task.id}
                    enabled={props.open}
                    logTimeDisabledReason={logTimeDisabledReason}
                    onLogTime={handleLogTime}
                    onEditEntry={handleEditTimeLogEntry}
                  />
                ) : null}
                {props.task && taskPanelProjectId ? (
                  <div className='px-6'>
                    <Tabs defaultValue='comments' className='w-full'>
                      <TabsList className='grid w-full grid-cols-2'>
                        <TabsTrigger value='comments'>Comments</TabsTrigger>
                        <TabsTrigger value='activity'>Activity</TabsTrigger>
                      </TabsList>
                      <TabsContent value='comments' className='mt-6'>
                        <TaskCommentsPanel
                          taskId={props.task.id}
                          projectId={taskPanelProjectId}
                          currentUserId={props.currentUserId}
                          canComment
                          taskTitle={props.task.title}
                          clientId={taskPanelClientId}
                        />
                      </TabsContent>
                      <TabsContent value='activity' className='mt-6'>
                        <TaskActivityPanel
                          taskId={props.task.id}
                          projectId={taskPanelProjectId}
                          clientId={taskPanelClientId}
                        />
                      </TabsContent>
                    </Tabs>
                  </div>
                ) : null}
              </div>

              {/* Footer — always at bottom, outside scroll area */}
              <SheetFormFooter
                formId={TASK_FORM_ID}
                deleteAriaLabel='Archive task'
                saveLabel={saveLabel}
                submitDisabled={submitDisabled}
                submitDisabledReason={submitDisabledReason}
                undo={undo}
                redo={redo}
                canUndo={canUndo}
                canRedo={canRedo}
                isEditing={isEditing}
                deleteDisabled={deleteDisabled}
                deleteDisabledReason={deleteDisabledReason}
                onRequestDelete={handleRequestDelete}
              />
            </div>

            {/* Planning rail — vertical accordion tab, stays left of the panel */}
            {props.task ? (
              canDeploy ? (
                <button
                  type='button'
                  onClick={() => {
                    setHasPlanningMounted(true)
                    setIsPlanningOpen(open => !open)
                  }}
                  aria-expanded={isPlanningOpen}
                  title={isPlanningOpen ? 'Hide planning' : 'Show planning'}
                  className={cn(
                    'text-muted-foreground hover:text-foreground hover:bg-muted/60 flex w-9 shrink-0 cursor-pointer flex-col items-center gap-2 border-l py-3 transition-colors',
                    isPlanningOpen ? 'bg-muted/60' : 'bg-muted/30'
                  )}
                >
                  <ClipboardList className='h-4 w-4' />
                  <span className='rotate-180 text-xs font-medium tracking-wide [writing-mode:vertical-rl]'>
                    Planning
                  </span>
                </button>
              ) : (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        tabIndex={0}
                        className='bg-muted/30 text-muted-foreground/50 flex w-9 shrink-0 flex-col items-center gap-2 border-l py-3'
                      >
                        <ClipboardList className='h-4 w-4' />
                        <span className='rotate-180 text-xs font-medium tracking-wide [writing-mode:vertical-rl]'>
                          Planning
                        </span>
                        <HelpCircle className='h-3.5 w-3.5' />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side='left' className='max-w-[220px]'>
                      Planning needs a GitHub repo linked to this task&rsquo;s
                      project. Link one in the project&rsquo;s settings to
                      enable it.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )
            ) : null}

            {/* Planning panel — width-animated so it slides open from the rail.
                Mounted on first expand only (opening a session writes rows),
                then kept mounted so the collapse can animate. */}
            {canDeploy ? (
              <div
                // `inert` (not just aria-hidden) — the mounted-but-collapsed
                // panel must not keep keyboard-focusable controls in the tab
                // order.
                inert={!isPlanningOpen}
                className={cn(
                  'shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out',
                  isPlanningOpen ? 'w-[560px]' : 'w-0'
                )}
              >
                {hasPlanningMounted &&
                  props.task &&
                  taskProject?.githubRepos &&
                  taskProject.githubRepos.length > 0 && (
                    <PlanningPanel
                      task={props.task}
                      githubRepos={taskProject.githubRepos}
                    />
                  )}
              </div>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
      {/* Params are built lazily inside this branch (W4): the lead overlay's
          init payload doesn't guarantee the full ProjectWithRelations shape,
          and it never renders the section (create-only). */}
      {props.task && taskProject ? (
        <ProjectTimeLogDialog
          open={isTimeLogDialogOpen}
          onOpenChange={handleTimeLogDialogOpenChange}
          {...buildProjectTimeLogDialogParams(taskProject, {
            tasks: taskProject.tasks,
            currentUserId: props.currentUserId,
            admins: props.admins,
          })}
          mode={timeLogDialogMode}
          timeLogEntry={editingTimeLogEntry}
          initialLinkedTaskIds={
            timeLogDialogMode === 'create' ? initialLinkedTaskIds : undefined
          }
          onMutationSuccess={handleTimeLogMutationSuccess}
        />
      ) : null}
      <ConfirmDialog
        open={isDeleteDialogOpen}
        title='Archive task?'
        description='Archiving this task removes it from the project board. Proceed?'
        confirmLabel='Archive'
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
      {unsavedChangesDialog}
    </>
  )
}
