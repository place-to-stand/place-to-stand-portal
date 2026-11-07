import Link from 'next/link'
import { Pencil, Plus } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { TabsList, TabsTrigger } from '@pts/ui/tabs'
import {
  TOOLBAR_TAB_CLASS,
  TOOLBAR_TABS_LIST_CLASS,
} from '@/components/layout/tabs-nav'
import { startBoardTabInteraction } from '@/lib/projects/board/board-tab-interaction'
import { ProjectStatusCell } from '@/components/projects/project-status-cell'
import type { ProjectStatusValue } from '@/lib/constants'

import type { ProjectActionControls } from './projects-board-tabs'

export type ProjectsBoardTabsHeaderProps = {
  initialTab: 'board' | 'activity' | 'review' | 'timeLogs'
  boardHref: string
  activityHref: string
  reviewHref: string
  timeLogsHref: string
  activityDisabled: boolean
  reviewDisabled: boolean
  timeLogsDisabled: boolean
  /** Project members see the Tasks tab only. */
  tasksOnly?: boolean
  projectActions: ProjectActionControls
  activeProjectId: string | null
  activeProjectStatus: string | null
  onProjectStatusChange: (
    projectId: string,
    status: ProjectStatusValue
  ) => Promise<void>
}

export function ProjectsBoardTabsHeader(props: ProjectsBoardTabsHeaderProps) {
  const {
    initialTab,
    boardHref,
    activityHref,
    reviewHref,
    timeLogsHref,
    activityDisabled,
    reviewDisabled,
    timeLogsDisabled,
    tasksOnly = false,
    projectActions,
    activeProjectId,
    activeProjectStatus,
    onProjectStatusChange,
  } = props

  return (
    <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
      <TabsList className={TOOLBAR_TABS_LIST_CLASS}>
        <TabsTrigger value='board' className={TOOLBAR_TAB_CLASS} asChild>
          <Link
            href={boardHref}
            prefetch={false}
            onClick={() => startBoardTabInteraction(initialTab, 'board')}
          >
            Tasks
          </Link>
        </TabsTrigger>
        {tasksOnly ? null : (
          <>
            <TabsTrigger
              value='review'
              className={TOOLBAR_TAB_CLASS}
              asChild
              disabled={reviewDisabled}
            >
              <Link
                href={reviewHref}
                prefetch={false}
                aria-disabled={reviewDisabled}
                tabIndex={reviewDisabled ? -1 : undefined}
                onClick={event => {
                  if (reviewDisabled) {
                    event.preventDefault()
                    return
                  }
                  startBoardTabInteraction(initialTab, 'review')
                }}
                className={
                  reviewDisabled ? 'pointer-events-none opacity-50' : undefined
                }
              >
                Review
              </Link>
            </TabsTrigger>
            <TabsTrigger
              value='timeLogs'
              className={TOOLBAR_TAB_CLASS}
              asChild
              disabled={timeLogsDisabled}
            >
              <Link
                href={timeLogsHref}
                prefetch={false}
                aria-disabled={timeLogsDisabled}
                tabIndex={timeLogsDisabled ? -1 : undefined}
                onClick={event => {
                  if (timeLogsDisabled) {
                    event.preventDefault()
                    return
                  }
                  startBoardTabInteraction(initialTab, 'timeLogs')
                }}
                className={
                  timeLogsDisabled
                    ? 'pointer-events-none opacity-50'
                    : undefined
                }
              >
                Time logs
              </Link>
            </TabsTrigger>
            <TabsTrigger
              value='activity'
              className={TOOLBAR_TAB_CLASS}
              asChild
              disabled={activityDisabled}
            >
              <Link
                href={activityHref}
                prefetch={false}
                aria-disabled={activityDisabled}
                tabIndex={activityDisabled ? -1 : undefined}
                onClick={event => {
                  if (activityDisabled) {
                    event.preventDefault()
                    return
                  }
                  startBoardTabInteraction(initialTab, 'activity')
                }}
                className={
                  activityDisabled
                    ? 'pointer-events-none opacity-50'
                    : undefined
                }
              >
                Activity
              </Link>
            </TabsTrigger>
          </>
        )}
      </TabsList>
      {projectActions ? (
        <div className='flex w-full items-center justify-end gap-2 pr-1 sm:w-auto'>
          {activeProjectId && activeProjectStatus ? (
            <ProjectStatusCell
              projectId={activeProjectId}
              status={activeProjectStatus}
              onStatusChange={onProjectStatusChange}
              disabled={!projectActions.canEdit}
              variant='standalone'
            />
          ) : null}
          {/* Toolbar actions are size sm (32px), level with the tabs and
              pickers on the row, as on every page. */}
          {projectActions.onLogTime ? (
            <Button
              type='button'
              size='sm'
              variant='outline'
              onClick={projectActions.onLogTime}
            >
              <Plus />
              Log time
            </Button>
          ) : null}
          <DisabledFieldTooltip
            disabled={!projectActions.canEdit}
            reason={projectActions.editDisabledReason}
          >
            <Button
              variant='outline'
              size='sm'
              onClick={projectActions.onEdit}
              disabled={!projectActions.canEdit}
            >
              <Pencil />
              Edit project
            </Button>
          </DisabledFieldTooltip>
        </div>
      ) : null}
    </div>
  )
}
