import type {
  DbUser,
  ProjectWithRelations,
  TaskWithRelations,
} from '@/lib/types'
import type {
  SearchableComboboxGroup,
  SearchableComboboxItem,
} from '@/components/ui/searchable-combobox'

import type { BoardColumnId } from '../board-constants'
import type { useBoardDnDState } from '../state/use-board-dnd'
import type { useBoardNavigation } from '../state/use-board-navigation'
import type { useBoardSheetState } from '../state/use-board-sheet-state'
import type { BoardView } from '../board-constants'

export type UseProjectsBoardStateArgs = {
  projects: ProjectWithRelations[]
  clients: Array<{ id: string; name: string; slug: string | null }>
  currentUserId: string
  admins: DbUser[]
  activeClientId: string | null
  activeProjectId: string | null
  activeTaskId: string | null
  currentView: BoardView
  /**
   * Server-rendered instant the Done column's rolling window measures back
   * from. Optional because only the tasks route renders the board tab; pages
   * that never show a Done column can let the client pin its own anchor.
   */
  now?: string
}

export type MemberDirectoryEntry = { name: string; avatarUrl: string | null }

export type ProjectsBoardState = {
  isPending: boolean
  feedback: string | null
  selectedProjectId: string | null
  projectItems: SearchableComboboxItem[]
  projectGroups: SearchableComboboxGroup[]
  canSelectNextProject: boolean
  canSelectPreviousProject: boolean
  activeProject: ProjectWithRelations | null
  activeProjectTasks: TaskWithRelations[]
  activeProjectArchivedTasks: TaskWithRelations[]
  activeProjectAcceptedTasks: TaskWithRelations[]
  canManageTasks: boolean
  memberDirectory: Map<string, MemberDirectoryEntry>
  /** Board render view: the DONE bucket is limited to the rolling window. */
  tasksByColumn: Map<string, TaskWithRelations[]>
  /** Every unaccepted DONE task, unwindowed — the Review tab's source. */
  allDoneTasks: TaskWithRelations[]
  /** Current Done window width in weeks. */
  doneWeeks: number
  /** DONE tasks completed before the window (and so not rendered). */
  hiddenDoneCount: number
  /** Widens the window by one step; instant, all tasks are client-side. */
  widenDoneWindow: () => void
  draggingTask: TaskWithRelations | null
  addTaskDisabled: boolean
  addTaskDisabledReason: string | null
  isSheetOpen: boolean
  sheetTask: TaskWithRelations | undefined
  handleProjectSelect: (projectId: string | null) => void
  handleSelectNextProject: () => void
  handleSelectPreviousProject: () => void
  handleDragStart: ReturnType<typeof useBoardDnDState>['handleDragStart']
  handleDragOver: ReturnType<typeof useBoardDnDState>['handleDragOver']
  handleDragEnd: ReturnType<typeof useBoardDnDState>['handleDragEnd']
  openCreateSheet: ReturnType<typeof useBoardSheetState>['openCreateSheet']
  handleEditTask: ReturnType<typeof useBoardSheetState>['handleEditTask']
  handleSheetOpenChange: ReturnType<
    typeof useBoardSheetState
  >['handleSheetOpenChange']
  defaultTaskStatus: BoardColumnId
  defaultTaskDueOn: string | null
  navigateToProject: ReturnType<typeof useBoardNavigation>
  activeDropColumnId: ReturnType<typeof useBoardDnDState>['activeDropColumnId']
  dropPreview: ReturnType<typeof useBoardDnDState>['dropPreview']
  recentlyMovedTaskId: ReturnType<
    typeof useBoardDnDState
  >['recentlyMovedTaskId']
}
