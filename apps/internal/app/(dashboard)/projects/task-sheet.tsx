'use client'

import { useCallback, useMemo, useRef, useState, type DragEvent } from 'react'

import { ClipboardList, HelpCircle, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Sheet, SheetClose, SheetContent } from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
import { PlanningPanel } from './_components/task-sheet/planning-panel'
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
  // Planning panel is collapsed by default; user expands it on demand.
  const [isPlanningOpen, setIsPlanningOpen] = useState(false)
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

  const headerDescription = projectName ? (
    <>
      Task belongs to <span className='font-medium'>{projectName}</span>.
    </>
  ) : (
    'Select a project so we know where to track this task.'
  )

  return (
    <>
      <Sheet open={props.open} onOpenChange={handleSheetOpenChange}>
        <SheetContent
          hideCloseButton
          className={cn(
            'flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[676px]',
            // Widen to fit the 560px planning panel when it is expanded.
            canDeploy && isPlanningOpen && 'sm:max-w-[1236px]'
          )}
        >
          {/* Header — spans full width */}
          <TaskSheetHeader
            title={sheetTitle}
            description={headerDescription}
            descriptionAction={
              canDeploy ? (
                <Button
                  variant='ghost'
                  size='sm'
                  className='h-7 shrink-0 cursor-pointer gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground'
                  onClick={() => setIsPlanningOpen(open => !open)}
                  aria-expanded={isPlanningOpen}
                >
                  <ClipboardList className='h-3.5 w-3.5' />
                  {isPlanningOpen ? 'Hide planning' : 'Planning'}
                </Button>
              ) : (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0} className='inline-flex shrink-0'>
                        <Button
                          variant='ghost'
                          size='sm'
                          disabled
                          className='h-7 gap-1.5 px-2 text-xs text-muted-foreground'
                        >
                          <ClipboardList className='h-3.5 w-3.5' />
                          Planning
                          <HelpCircle className='h-3.5 w-3.5' />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side='bottom' className='max-w-[220px]'>
                      Planning needs a GitHub repo linked to this task&rsquo;s
                      project. Link one in the project&rsquo;s settings to
                      enable it.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )
            }
          >
            <SheetClose asChild>
              <Button variant='ghost' size='icon' className='h-7 w-7 opacity-70 hover:opacity-100'>
                <X className='h-4 w-4' />
                <span className='sr-only'>Close</span>
              </Button>
            </SheetClose>
          </TaskSheetHeader>

          {/* Two-column body */}
          <div className='flex flex-1 overflow-hidden'>
            {/* Left column: task content */}
            <div className='flex h-full w-full flex-col sm:w-[676px] sm:shrink-0'>
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

            {/* Right column: planning panel — toggled from the header button */}
            {props.task &&
              taskProject?.githubRepos &&
              taskProject.githubRepos.length > 0 &&
              isPlanningOpen && (
                <PlanningPanel
                  task={props.task}
                  githubRepos={taskProject.githubRepos}
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
