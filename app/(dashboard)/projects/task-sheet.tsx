'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'

import { Loader2, Rocket, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Sheet, SheetClose, SheetContent } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { useSheetFormControls } from '@/lib/hooks/use-sheet-form-controls'

import type {
  DbUser,
  ProjectWithRelations,
  TaskWithRelations,
} from '@/lib/types'
import { useTaskSheetState } from '@/lib/projects/task-sheet/use-task-sheet-state'

import { TaskSheetForm } from './_components/task-sheet/task-sheet-form'
import { TaskSheetFormFooter } from './_components/task-sheet/form/task-sheet-form-footer'
import { TaskSheetHeader } from './_components/task-sheet/task-sheet-header'
import { DeploymentPanel } from './_components/task-sheet/deployment-panel'
import { useWorkerStatus } from './_components/task-sheet/use-worker-status'
import type { WorkerCommentStatus } from './actions/fetch-worker-status'
import type { UserRole } from '@/lib/auth/session'
import { TaskCommentsPanel } from './_components/task-sheet/task-comments-panel'
import { TaskActivityPanel } from './_components/task-sheet/task-activity-panel'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { BoardColumnId } from '@/lib/projects/board/board-constants'

type TaskSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  task?: TaskWithRelations
  canManage: boolean
  admins: DbUser[]
  currentUserId: string
  currentUserRole: UserRole
  defaultStatus: BoardColumnId
  defaultDueOn: string | null
  projects: ProjectWithRelations[]
  projectSelectionProjects?: ProjectWithRelations[]
  defaultProjectId: string | null
  defaultAssigneeId: string | null
  defaultLeadId?: string | null
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
    projectName,
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

  const [isDragActive, setIsDragActive] = useState(false)
  const [isDeployOpen, setIsDeployOpen] = useState(false)
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

  const taskPanelProjectId = props.task?.project_id ?? null
  const taskPanelClientId = taskProject?.client?.id ?? null
  const canDeploy = Boolean(
    props.task && taskProject?.githubRepos && taskProject.githubRepos.length > 0
  )

  // Local state to track just-created issue before server props refresh
  const [localIssueData, setLocalIssueData] = useState<{
    issueNumber: number
    issueUrl: string
    workerStatus: 'working' | 'implementing'
  } | null>(null)

  // Clear local override once server props catch up or task changes
  useEffect(() => {
    if (props.task?.github_issue_number) setLocalIssueData(null)
  }, [props.task?.github_issue_number])

  const hasIssue = Boolean(props.task?.github_issue_number) || Boolean(localIssueData)
  const workerStatus = useWorkerStatus(props.task?.id ?? '', hasIssue && canDeploy)

  const headerDescription = projectName ? (
    <>
      Task belongs to <span className='font-medium'>{projectName}</span>.
    </>
  ) : (
    'Select a project so we know where to track this task.'
  )

  return (
    <>
      <Sheet open={props.open} onOpenChange={open => {
        if (!open) setIsDeployOpen(false)
        handleSheetOpenChange(open)
      }}>
        <SheetContent
          hideCloseButton
          className={cn(
            'flex w-full flex-col overflow-hidden p-0 sm:max-w-[676px]',
            isDeployOpen && 'sm:max-w-[1236px]'
          )}
        >
          <div className='flex h-full'>
            {/* Left column: task content */}
            <div className='flex h-full w-full flex-col sm:w-[676px] sm:shrink-0'>
              {/* Scrollable area */}
              <div
                className='flex flex-1 flex-col gap-6 overflow-y-auto pb-4'
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <TaskSheetHeader
                  title={sheetTitle}
                  description={headerDescription}
                >
                  <div className='flex items-center gap-2'>
                    {canDeploy && (
                      <Button
                        variant={isDeployOpen ? 'secondary' : 'outline'}
                        size='sm'
                        onClick={() => setIsDeployOpen(prev => !prev)}
                      >
                        {workerStatus.isWorking || (!workerStatus.latestStatus && localIssueData) ? (
                          <Loader2 className='mr-1.5 h-3.5 w-3.5 animate-spin' />
                        ) : (
                          <Rocket className='mr-1.5 h-3.5 w-3.5' />
                        )}
                        Deploy
                        {(workerStatus.latestStatus ?? localIssueData?.workerStatus) && (
                          <DeployButtonBadge status={(workerStatus.latestStatus ?? localIssueData?.workerStatus)!} />
                        )}
                      </Button>
                    )}
                    <SheetClose asChild>
                      <Button variant='ghost' size='icon' className='h-7 w-7 opacity-70 hover:opacity-100'>
                        <X className='h-4 w-4' />
                        <span className='sr-only'>Close</span>
                      </Button>
                    </SheetClose>
                  </div>
                </TaskSheetHeader>
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
              <TaskSheetFormFooter
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

            {/* Right column: deployment panel */}
            {isDeployOpen && props.task && taskProject?.githubRepos && (
              <DeploymentPanel
                task={props.task}
                githubRepos={taskProject.githubRepos}
                workerStatus={workerStatus}
                localIssueData={localIssueData}
                onDeploySuccess={setLocalIssueData}
                onClose={() => setIsDeployOpen(false)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
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

// ---------------------------------------------------------------------------
// Deploy button status badge
// ---------------------------------------------------------------------------

const DEPLOY_BADGE_MAP: Partial<Record<WorkerCommentStatus, { label: string; className: string }>> = {
  working: { label: 'Planning', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  implementing: { label: 'Executing', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  plan_ready: { label: 'Plan Ready', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  pr_created: { label: 'PR Created', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  error: { label: 'Error', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  done_no_changes: { label: 'Done', className: 'bg-muted text-muted-foreground' },
}

function DeployButtonBadge({ status }: { status: WorkerCommentStatus }) {
  const config = DEPLOY_BADGE_MAP[status]
  if (!config) return null

  return (
    <Badge className={cn('ml-1 text-[10px] leading-none', config.className)}>
      {config.label}
    </Badge>
  )
}
