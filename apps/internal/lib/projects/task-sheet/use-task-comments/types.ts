import type { TaskCommentWithAuthor } from '@/lib/types'
export type UseTaskCommentsOptions = {
  taskId: string | null
  projectId: string | null
  currentUserId: string
  canComment: boolean
  taskTitle?: string | null
  companyId?: string | null
  /**
   * Display name for the optimistic comment's byline. Only used until the
   * refetch lands; falls back to the author on a cached comment by this user.
   */
  currentUserName?: string | null
}

export type UseTaskCommentsState = {
  taskId: string | null
  comments: TaskCommentWithAuthor[]
  isLoading: boolean
  isError: boolean
  refresh: () => void
  composer: {
    value: string
    onChange: (value: string) => void
    isOpen: boolean
    open: () => void
    close: () => void
    submit: () => void
    disabled: boolean
    isSubmitting: boolean
    canComment: boolean
  }
  /** Typed but not posted: a new comment, or changes to one being edited. */
  unsent: { composer: boolean; edit: boolean }
  editing: {
    commentId: string | null
    draft: string
    setDraft: (value: string) => void
    start: (comment: TaskCommentWithAuthor) => void
    cancel: () => void
    confirm: () => void
    /** The edit is being saved: its Cancel waits for the result. */
    isSaving: boolean
  }
  deletion: {
    targetId: string | null
    request: (id: string) => void
    cancel: () => void
    confirm: () => void
    isPending: boolean
  }
  isMutating: boolean
  pagination: {
    hasNextPage: boolean
    isFetchingNextPage: boolean
    loadMore: () => void
  }
}
