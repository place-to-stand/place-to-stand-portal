/**
 * Centralized route definitions for the application.
 *
 * Use these route builders instead of hardcoding paths throughout the codebase.
 * This makes route changes easier and ensures consistency.
 *
 * @example
 * import { routes } from '@/lib/routes'
 *
 * // Navigate to tasks board
 * router.push(routes.my.tasks.board())
 *
 * // Navigate to a specific task
 * router.push(routes.my.tasks.board('task-id-123'))
 *
 * // Build inbox URL with query params
 * routes.my.inbox({ thread: 'thread-id', filter: 'linked' })
 */

// ============================================================================
// Portal Routes (user-specific views)
// ============================================================================

export const routes = {
  /** User portal routes under /my/* */
  my: {
    /** Home dashboard */
    home: () => '/my/home' as const,

    /** Tasks routes */
    tasks: {
      /** Base tasks path (redirects to board) */
      index: () => '/my/tasks' as const,

      /** Board view, optionally with a task ID */
      board: (taskId?: string) =>
        taskId ? (`/my/tasks/board/${taskId}` as const) : ('/my/tasks/board' as const),

      /** Calendar view, optionally with a task ID */
      calendar: (taskId?: string) =>
        taskId ? (`/my/tasks/calendar/${taskId}` as const) : ('/my/tasks/calendar' as const),

      /** Build tasks view path with optional query params */
      withParams: (
        view: 'board' | 'calendar',
        options?: { taskId?: string; assignee?: string }
      ) => {
        const base = `/my/tasks/${view}${options?.taskId ? `/${options.taskId}` : ''}`
        if (options?.assignee) {
          return `${base}?assignee=${options.assignee}`
        }
        return base
      },
    },

    /** Inbox routes */
    inbox: (params?: { thread?: string; filter?: string; page?: number }) => {
      if (!params) return '/my/inbox' as const

      const searchParams = new URLSearchParams()
      if (params.thread) searchParams.set('thread', params.thread)
      if (params.filter && params.filter !== 'all') searchParams.set('filter', params.filter)
      if (params.page && params.page > 1) searchParams.set('page', String(params.page))

      const queryString = searchParams.toString()
      return queryString ? `/my/inbox?${queryString}` : '/my/inbox'
    },

    /** Suggestions routes */
    suggestions: (params?: { filter?: string }) => {
      if (!params?.filter || params.filter === 'pending') {
        return '/my/suggestions' as const
      }
      return `/my/suggestions?filter=${params.filter}`
    },
  },

  // ============================================================================
  // Project Routes
  // ============================================================================

  projects: {
    /** Projects list */
    index: () => '/projects' as const,

    /** Project board */
    board: (clientSlug: string, projectSlug: string, taskId?: string) =>
      taskId
        ? `/projects/${clientSlug}/${projectSlug}/board/${taskId}`
        : `/projects/${clientSlug}/${projectSlug}/board`,

    /** Project calendar */
    calendar: (clientSlug: string, projectSlug: string) =>
      `/projects/${clientSlug}/${projectSlug}/calendar`,

    /** Project backlog */
    backlog: (clientSlug: string, projectSlug: string) =>
      `/projects/${clientSlug}/${projectSlug}/backlog`,

    /** Project activity */
    activity: (clientSlug: string, projectSlug: string) =>
      `/projects/${clientSlug}/${projectSlug}/activity`,

    /** Project review */
    review: (clientSlug: string, projectSlug: string) =>
      `/projects/${clientSlug}/${projectSlug}/review`,
  },

  // ============================================================================
  // Client Routes
  // ============================================================================

  clients: {
    /** Clients list */
    index: () => '/clients' as const,

    /** Client detail */
    detail: (clientSlug: string) => `/clients/${clientSlug}`,

    /** Client archive */
    archive: () => '/clients/archive' as const,

    /** Client activity */
    activity: () => '/clients/activity' as const,
  },

  // ============================================================================
  // Leads Routes
  // ============================================================================

  leads: {
    /** Leads board */
    board: () => '/leads/board' as const,
  },

  // ============================================================================
  // Settings Routes
  // ============================================================================

  settings: {
    /** Users settings */
    users: () => '/settings/users' as const,

    /** Hour blocks settings */
    hourBlocks: () => '/settings/hour-blocks' as const,

    /** Integrations settings */
    integrations: () => '/settings/integrations' as const,
  },

  // ============================================================================
  // Auth Routes
  // ============================================================================

  auth: {
    signIn: () => '/sign-in' as const,
    forgotPassword: () => '/forgot-password' as const,
    resetPassword: () => '/reset-password' as const,
  },
} as const

// Type helper for route values
export type RouteValue = string
