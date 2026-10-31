'use client'

import { EmptyState } from '@pts/ui/empty-state'
import { SheetSection } from '@/components/sheets/sheet-section'
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

import { ArchiveConfirmDialog } from '@/components/sheets/archive-confirm-dialog'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@pts/ui/tooltip'
import { cn } from '@/lib/utils'
import { useViewerAccess } from '@/components/providers/viewer-access-provider'
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
import {
  TimeLogSection,
  TimeLogSectionPlaceholder,
} from './_components/task-sheet/time-log-section'
import { TASK_TIME_LOGS_KEY } from './_components/task-sheet/use-task-time-logs'
import { SheetFormFooter } from '@/components/sheets/sheet-form-footer'
import { SheetFormHeader } from '@/components/sheets/sheet-form-header'
import { TaskSheetForm } from './_components/task-sheet/task-sheet-form'
import { TASK_FORM_ID } from './_components/task-sheet/form/task-sheet-form'
import { PlanningPanel } from './_components/task-sheet/planning-panel'
import { TaskCommentsPanel } from './_components/task-sheet/task-comments-panel'
import { SheetActivitySection } from '@/components/sheets/sheet-activity-section'
import type { BoardColumnId } from '@/lib/projects/board/board-constants'
import { getSubmitLabel } from '@/lib/forms/form-controls'

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
}

export function TaskSheet(props: TaskSheetProps) {
  const { isAdmin } = useViewerAccess()
  const {
    form,
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
  })

  // The assignee list already carries every internal user by id, so it doubles
  // as the lookup for the current user's display name — no extra plumbing for
  // the optimistic comment byline.
  const currentUserName = useMemo(
    () =>
      assigneeItems.find(item => item.value === props.currentUserId)?.label ??
      null,
    [assigneeItems, props.currentUserId]
  )

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
  // Deferred mount: the panel's reads (session, revisions, deployments) only
  // run once the user expands it — after that it stays mounted so the
  // collapse animation has content to slide away. Opening it never writes;
  // the session is created by Start planning.
  const [hasPlanningMounted, setHasPlanningMounted] = useState(false)
  const planningTaskId = props.task?.id ?? null
  const [prevPlanningTaskId, setPrevPlanningTaskId] = useState(planningTaskId)

  // The board reuses one TaskSheet instance across tasks — reset planning
  // state on task switch so a hidden mounted panel doesn't load planning for
  // tasks the user never expanded planning on. Adjust-during-
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

  const saveLabel = useMemo(
    () =>
      getSubmitLabel({
        isSaving: isPending,
        isEditing,
        createLabel: 'Create task',
      }),
    [isEditing, isPending]
  )

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

  const initialLinkedTaskIds = useMemo(() => (taskId ? [taskId] : []), [taskId])

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
  const taskUnavailableForTime = Boolean(props.task && props.task.deleted_at)
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
  // Project members (non-admins) don't see time logs or planning.
  const canDeploy = Boolean(
    isAdmin &&
    props.task &&
    taskProject?.githubRepos &&
    taskProject.githubRepos.length > 0
  )

  return (
    <>
      <Sheet open={props.open} onOpenChange={handleSheetOpenChange}>
        <SheetContent
          hideCloseButton
          skipMountAnimation={skipMountAnimation}
          columns={1}
          className={cn(
            'flex w-full flex-col gap-0 overflow-hidden p-0',
            // The one exception to the two widths: the expanded planning
            // panel (560px) widens the sheet beside the 720px task column
            // and the 36px rail, and gives it back when it collapses.
            props.task &&
              canDeploy &&
              isPlanningOpen &&
              'sm:max-w-[1316px] lg:w-[1316px] lg:max-w-[calc(100vw-2rem)]'
          )}
          // Inline so it wins over the primitive's transition classes: the
          // sheet edge glides in sync with the panel's width transition.
          style={
            props.task
              ? {
                  transition:
                    'max-width 300ms ease-in-out, width 300ms ease-in-out',
                }
              : undefined
          }
        >
          {/* Header — spans full width */}
          <SheetFormHeader entity='task' title={sheetTitle} />

          {/* Two-column body */}
          <div className='relative flex flex-1 overflow-hidden'>
            {/* Left column: task content */}
            <div
              className={cn(
                'flex h-full w-full min-w-0 flex-col',
                // Fills the sheet; held at 720px beside open planning.
                isPlanningOpen && canDeploy
                  ? 'sm:w-[720px] sm:shrink-0'
                  : 'flex-1'
              )}
            >
              {/* Scrollable area */}
              <div
                // pb-6 matches the px-6 the sections inside use, so the gap
                // under the last element reads the same as the side margins.
                className='flex flex-1 flex-col gap-6 overflow-y-auto pt-6 pb-6'
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <TaskSheetForm
                  form={form}
                  onSubmit={handleFormSubmit}
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
                {isAdmin && props.task && taskProject?.type === 'CLIENT' ? (
                  <TimeLogSection
                    taskId={props.task.id}
                    enabled={props.open}
                    logTimeDisabledReason={logTimeDisabledReason}
                    onLogTime={handleLogTime}
                    onEditEntry={handleEditTimeLogEntry}
                  />
                ) : isAdmin &&
                  !props.task &&
                  (!taskProject || taskProject.type === 'CLIENT') ? (
                  // Create shows the same sheet: time is its own record, so
                  // the section waits for the saved task. Shown until a
                  // project is picked, unless that project is internal or
                  // personal (no time is tracked there).
                  <TimeLogSectionPlaceholder />
                ) : null}
                {/* Sections, no inner tabs: Comments, then the collapsed
                    Activity, always last in a sheet. */}
                {props.task && taskPanelProjectId ? (
                  <>
                    <SheetSection title='Comments' className='px-6'>
                      <TaskCommentsPanel
                        taskId={props.task.id}
                        projectId={taskPanelProjectId}
                        currentUserId={props.currentUserId}
                        currentUserName={currentUserName}
                        canComment
                        taskTitle={props.task.title}
                        companyId={taskPanelClientId}
                      />
                    </SheetSection>
                    <SheetActivitySection
                      // Remount per task so a newly opened task starts collapsed.
                      key={props.task.id}
                      className='px-6'
                      targetType='TASK'
                      targetId={props.task.id}
                      projectId={taskPanelProjectId}
                      companyId={taskPanelClientId}
                    />
                  </>
                ) : !props.task ? (
                  <SheetSection title='Comments' className='px-6'>
                    <EmptyState message='Add comments after you save the task.' />
                  </SheetSection>
                ) : null}
              </div>

              {/* Footer — always at bottom, outside scroll area */}
              <SheetFormFooter
                formId={TASK_FORM_ID}
                archiveAriaLabel='Archive task'
                saveLabel={saveLabel}
                submitDisabled={submitDisabled}
                submitDisabledReason={submitDisabledReason}
                undo={undo}
                redo={redo}
                canUndo={canUndo}
                canRedo={canRedo}
                isEditing={isEditing}
                archiveDisabled={deleteDisabled}
                archiveDisabledReason={deleteDisabledReason}
                onRequestArchive={handleRequestDelete}
              />
            </div>

            {/* Planning rail — vertical accordion tab, stays left of the panel */}
            {props.task && isAdmin ? (
              canDeploy ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type='button'
                      onClick={() => {
                        setHasPlanningMounted(true)
                        setIsPlanningOpen(open => !open)
                      }}
                      aria-expanded={isPlanningOpen}
                      className={cn(
                        'text-muted-foreground hover:text-foreground hover:bg-muted/60 focus-visible:border-ring focus-visible:ring-ring/50 flex w-9 shrink-0 cursor-pointer flex-col items-center gap-2 border-l py-3 transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-inset',
                        isPlanningOpen ? 'bg-muted/60' : 'bg-muted/30'
                      )}
                    >
                      <ClipboardList className='h-4 w-4' />
                      <span className='rotate-180 text-xs font-medium tracking-wide [writing-mode:vertical-rl]'>
                        Planning
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side='left'>
                    {isPlanningOpen ? 'Hide planning' : 'Show planning'}
                  </TooltipContent>
                </Tooltip>
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
                Mounted on first expand only (it loads planning data), then
                kept mounted so the collapse can animate. */}
            {canDeploy ? (
              <div
                // `inert` (not just aria-hidden) — the mounted-but-collapsed
                // panel must not keep keyboard-focusable controls in the tab
                // order.
                inert={!isPlanningOpen}
                className={cn(
                  'shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out',
                  isPlanningOpen ? 'w-[560px]' : 'w-0',
                  // A phone has no room beside the task: the open panel
                  // covers it instead, leaving the rail as its toggle.
                  isPlanningOpen &&
                    'max-sm:bg-background max-sm:absolute max-sm:inset-y-0 max-sm:right-9 max-sm:left-0 max-sm:z-10 max-sm:w-auto'
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
      {isAdmin && props.task && taskProject ? (
        <ProjectTimeLogDialog
          open={isTimeLogDialogOpen}
          onOpenChange={handleTimeLogDialogOpenChange}
          {...buildProjectTimeLogDialogParams(taskProject, {
            tasks: taskProject.tasks,
            currentUserId: props.currentUserId,
            admins: props.admins.filter(user => user.role === 'ADMIN'),
          })}
          mode={timeLogDialogMode}
          timeLogEntry={editingTimeLogEntry}
          initialLinkedTaskIds={
            timeLogDialogMode === 'create' ? initialLinkedTaskIds : undefined
          }
          onMutationSuccess={handleTimeLogMutationSuccess}
        />
      ) : null}
      <ArchiveConfirmDialog
        open={isDeleteDialogOpen}
        entity='task'
        name={props.task?.title || 'this task'}
        list='the project board'
        pending={isPending}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
      {unsavedChangesDialog}
    </>
  )
}
