'use client'

import { Loader2 } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { taskCommentMentionOptionsUrl } from '@/lib/tiptap/mention-urls'
import { ConfirmDialog } from '@pts/ui/confirm-dialog'

import { EntityList } from '@/components/sheets/entity-list'
import { CONCEPT_ICONS } from '@/lib/concept-icons'
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'
import { useTaskComments } from '@/lib/projects/task-sheet/use-task-comments'
import { isOptimisticComment } from '@/lib/projects/task-sheet/use-task-comments/mutations'

import {
  TaskCommentComposer,
  TaskCommentItem,
  TaskCommentsErrorState,
} from './task-comments-components'

type TaskCommentsPanelProps = {
  taskId: string | null
  projectId: string | null
  currentUserId: string
  /** Byline for the optimistic comment until the refetch replaces it. */
  currentUserName?: string | null
  canComment: boolean
  taskTitle?: string | null
  companyId?: string | null
  className?: string
}

/**
 * The task's Comments, the same list as a lead's Updates: the + (or the
 * empty state) opens the comment form under the heading, newest comment
 * first. Comments are their own records and post on their own click.
 */
export function TaskCommentsPanel(props: TaskCommentsPanelProps) {
  const state = useTaskComments(props)
  const { composer } = state
  // A comment posts on its own click, so the task's Save never sees it:
  // closing the sheet with one typed asks first.
  const composerGuard = useUnsavedChangesWarning({
    isDirty: state.unsent.composer,
    draft: true,
    title: 'Discard this comment?',
    description: "Your comment hasn't been posted.",
    cancelLabel: 'Keep writing',
  })
  // Same for an edit: closing, or editing another comment, asks first.
  const editGuard = useUnsavedChangesWarning({
    isDirty: state.unsent.edit,
    draft: true,
    title: 'Discard your changes?',
    description: "Your changes to this comment haven't been saved.",
    cancelLabel: 'Keep editing',
  })
  // The task's assignee options: the people who can open it.
  const mentionOptionsUrl = props.taskId
    ? taskCommentMentionOptionsUrl(props.taskId)
    : undefined

  return (
    <>
      <EntityList
        className={props.className}
        title='Comments'
        icon={CONCEPT_ICONS.comment}
        add={{
          label: 'Add comment',
          onAdd: composer.open,
          disabledReason: composer.canComment
            ? null
            : 'Only project collaborators can post comments.',
        }}
        inlineForm={
          <TaskCommentComposer
            open={composer.isOpen}
            onCancel={composer.close}
            value={composer.value}
            onChange={composer.onChange}
            onSubmit={composer.submit}
            disabled={composer.disabled}
            pending={composer.isSubmitting}
            canComment={composer.canComment}
            mentionOptionsUrl={mentionOptionsUrl}
          />
        }
        inlineFormOpen={composer.isOpen}
        onInlineFormClose={composer.close}
        isEmpty={state.comments.length === 0}
        emptyMessage='No comments yet.'
        status={
          state.isLoading ? (
            <div className='text-muted-foreground flex items-center gap-2 text-sm'>
              <Loader2 className='h-4 w-4 animate-spin' /> Loading comments…
            </div>
          ) : state.isError ? (
            <TaskCommentsErrorState onRetry={state.refresh} />
          ) : undefined
        }
      >
        <div className='space-y-4'>
          {state.comments.map(comment => (
            <TaskCommentItem
              key={comment.id}
              comment={comment}
              isAuthor={comment.author_id === props.currentUserId}
              isEditing={state.editing.commentId === comment.id}
              editingDraft={
                state.editing.commentId === comment.id
                  ? state.editing.draft
                  : ''
              }
              onChangeEditingDraft={state.editing.setDraft}
              onStartEdit={comment =>
                editGuard.requestConfirmation(() =>
                  state.editing.start(comment)
                )
              }
              // Cancel asks too, as a lead update's Cancel does.
              onCancelEdit={() =>
                editGuard.requestConfirmation(state.editing.cancel)
              }
              onConfirmEdit={state.editing.confirm}
              onRequestDelete={state.deletion.request}
              isSavingEdit={
                state.editing.commentId === comment.id && state.editing.isSaving
              }
              mentionOptionsUrl={mentionOptionsUrl}
              // The optimistic row's id isn't a real comment yet, so it
              // stays inert until the refetch swaps in the saved one.
              disableActions={
                state.isMutating || isOptimisticComment(comment.id)
              }
            />
          ))}
          {/* Older comments load in below the newest. */}
          {state.pagination.hasNextPage ? (
            <div className='flex justify-center'>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={state.pagination.loadMore}
                disabled={state.pagination.isFetchingNextPage}
              >
                {state.pagination.isFetchingNextPage
                  ? 'Loading…'
                  : 'Load older comments'}
              </Button>
            </div>
          ) : null}
        </div>
      </EntityList>
      <ConfirmDialog
        open={Boolean(state.deletion.targetId)}
        title='Delete comment?'
        description='This comment will be removed from the task.'
        confirmLabel='Delete'
        confirmVariant='destructive'
        confirmDisabled={state.deletion.isPending}
        onCancel={state.deletion.cancel}
        onConfirm={state.deletion.confirm}
      />
      {composerGuard.dialog}
      {editGuard.dialog}
    </>
  )
}
