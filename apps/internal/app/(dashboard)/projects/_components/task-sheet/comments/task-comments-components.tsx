'use client'

import { useCallback, useMemo } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Loader2, MoreHorizontal, Pencil, Send, Trash2, X } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@pts/ui/avatar'
import { Button } from '@pts/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@pts/ui/dropdown-menu'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import {
  isContentEmpty,
  sanitizeEditorHtml,
} from '@/components/ui/rich-text-editor/utils'
import type { TaskCommentWithAuthor } from '@/lib/types'
import { getInitials } from '@/lib/users/initials'
import { cn } from '@/lib/utils'

export type TaskCommentsPanelShellProps = {
  /** Omit inside an already-labelled tab — the tab is the heading. */
  title?: string
  description: string
  children: ReactNode
  action?: ReactNode
}

export function TaskCommentsPanelShell(props: TaskCommentsPanelShellProps) {
  const { title, description, children, action } = props
  return (
    <section className='space-y-4 rounded-xl border px-5 py-4 shadow-sm'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          {title ? <h3 className='text-sm font-semibold'>{title}</h3> : null}
          <p className='text-muted-foreground text-xs'>{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export type TaskCommentComposerProps = {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  disabled: boolean
  pending: boolean
  canComment: boolean
}

export function TaskCommentComposer(props: TaskCommentComposerProps) {
  const { value, onChange, onSubmit, disabled, pending, canComment } = props

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!disabled) {
        onSubmit()
      }
    },
    [disabled, onSubmit]
  )

  const isEmpty = isContentEmpty(value)

  return (
    <form onSubmit={handleSubmit} className='space-y-3'>
      <RichTextEditor
        id='task-comment-composer'
        value={value}
        onChange={onChange}
        placeholder={
          canComment
            ? 'Share context, ask a question, or leave an update for the team.'
            : 'You do not have permission to post comments on this task.'
        }
        disabled={disabled}
        contentMinHeightClassName='[&_.ProseMirror]:min-h-20'
      />
      <div className='flex justify-end'>
        <DisabledFieldTooltip
          disabled={disabled}
          reason={
            canComment
              ? disabled
                ? 'Finish editing or wait for the previous action to complete.'
                : null
              : 'Only project collaborators can post comments.'
          }
        >
          <Button
            type='submit'
            disabled={disabled || isEmpty}
            className='flex items-center gap-2'
          >
            {pending ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : (
              <Send className='h-4 w-4' />
            )}
            Post comment
          </Button>
        </DisabledFieldTooltip>
      </div>
    </form>
  )
}

export type TaskCommentItemProps = {
  comment: TaskCommentWithAuthor
  isAuthor: boolean
  isEditing: boolean
  editingDraft: string
  onChangeEditingDraft: (value: string) => void
  onStartEdit: (comment: TaskCommentWithAuthor) => void
  onCancelEdit: () => void
  onConfirmEdit: () => void
  onRequestDelete: (id: string) => void
  disableActions: boolean
}

export function TaskCommentItem(props: TaskCommentItemProps) {
  const {
    comment,
    isAuthor,
    isEditing,
    editingDraft,
    onChangeEditingDraft,
    onStartEdit,
    onCancelEdit,
    onConfirmEdit,
    onRequestDelete,
    disableActions,
  } = props

  // Matches the time-log history component: a user with no display name
  // still has an email, which identifies them far better than 'Unknown user'.
  const authorName =
    comment.author?.full_name ?? comment.author?.email ?? 'Unknown user'
  const createdAgo = formatDistanceToNow(new Date(comment.created_at), {
    addSuffix: true,
  })
  const edited = comment.updated_at && comment.updated_at !== comment.created_at
  const sanitizedBody = useMemo(
    () => sanitizeEditorHtml(comment.body ?? ''),
    [comment.body]
  )
  const isEditingEmpty = isContentEmpty(editingDraft)

  if (isEditing) {
    return (
      <div className='border-primary/30 bg-primary/5 rounded-lg border p-4 shadow-sm'>
        <div className='text-muted-foreground mb-2 flex items-center justify-between gap-2 text-xs'>
          <span className='text-foreground font-medium'>
            Editing your comment
          </span>
          <span>{createdAgo}</span>
        </div>
        <RichTextEditor
          key={`comment-edit-${comment.id}`}
          value={editingDraft}
          onChange={onChangeEditingDraft}
          disabled={disableActions}
          placeholder='Update your comment...'
          contentMinHeightClassName='[&_.ProseMirror]:min-h-20'
        />
        <div className='mt-3 flex items-center justify-end gap-2'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={onCancelEdit}
          >
            <X className='mr-1 h-3.5 w-3.5' /> Cancel
          </Button>
          <Button
            type='button'
            size='sm'
            onClick={onConfirmEdit}
            disabled={isEditingEmpty || disableActions}
          >
            <Send className='mr-1 h-3.5 w-3.5' /> Save
          </Button>
        </div>
      </div>
    )
  }

  return (
    <article className='relative rounded-lg border px-4 py-3 shadow-sm'>
      {isAuthor ? (
        <div className='absolute top-2 right-2'>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className='text-muted-foreground hover:text-foreground h-7 w-7 p-0'
                  disabled={disableActions}
                  aria-label='Comment actions'
                />
              }
            >
              <MoreHorizontal className='h-4 w-4' />
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-36'>
              <DropdownMenuItem onClick={() => onStartEdit(comment)}>
                <Pencil className='h-3.5 w-3.5' /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                variant='destructive'
                onClick={() => onRequestDelete(comment.id)}
              >
                <Trash2 className='h-3.5 w-3.5' /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}
      <div
        className={cn(
          'text-foreground [&_a]:text-primary [&_code]:bg-muted [&_pre]:bg-muted space-y-2 text-sm leading-relaxed [&_a]:underline [&_a]:underline-offset-4 [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:p-3 [&_ul]:list-disc [&_ul]:pl-5',
          // Keep the first line clear of the absolutely-positioned menu button.
          isAuthor && 'pr-8'
        )}
        dangerouslySetInnerHTML={{ __html: sanitizedBody }}
      />
      <footer className='text-muted-foreground mt-3 flex flex-wrap items-center gap-2 text-xs'>
        <div className='flex flex-wrap items-center gap-2'>
          <Avatar className='h-5 w-5'>
            {comment.author?.avatar_url ? (
              <AvatarImage
                src={`/api/storage/user-avatar/${comment.author.id}`}
                alt={authorName}
              />
            ) : null}
            <AvatarFallback className='text-[9px]'>
              {getInitials(comment.author?.full_name)}
            </AvatarFallback>
          </Avatar>
          <span className='text-foreground font-medium'>{authorName}</span>
          <span>{createdAgo}</span>
          {edited ? <span>Edited</span> : null}
        </div>
      </footer>
    </article>
  )
}

export type TaskCommentsErrorStateProps = {
  onRetry: () => void
}

export function TaskCommentsErrorState(props: TaskCommentsErrorStateProps) {
  const { onRetry } = props
  return (
    <div className='border-destructive/40 bg-destructive/10 text-destructive flex flex-col items-center gap-3 rounded-lg border px-4 py-6 text-center text-sm'>
      <p>We couldn&apos;t load the latest comments.</p>
      <Button variant='outline' size='sm' onClick={onRetry}>
        Retry
      </Button>
    </div>
  )
}
