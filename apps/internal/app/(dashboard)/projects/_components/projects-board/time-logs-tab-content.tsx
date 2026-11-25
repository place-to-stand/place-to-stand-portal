'use client'

import type { ReactNode } from 'react'

import { TabsContent } from '@placetostand/ui/tabs'
import { ProjectsBoardEmpty } from '../projects-board-empty'
import { NO_SELECTION_MESSAGE } from './projects-board-tabs.constants'
import type { ProjectsBoardActiveProject } from './board-tab-content'

type TimeLogsTabContentProps = {
  /** The tab it fills: Time logs, or Feedback (the same shape). */
  value?: 'timeLogs' | 'feedback'
  isActive: boolean
  activeProject: ProjectsBoardActiveProject
  /** The tab's list held to this project, rendered on the server. */
  list: ReactNode
}

export function TimeLogsTabContent({
  value = 'timeLogs',
  isActive,
  activeProject,
  list,
}: TimeLogsTabContentProps) {
  if (!isActive) {
    return null
  }

  return (
    <TabsContent
      value={value}
      className='flex min-h-0 flex-1 flex-col gap-4 sm:gap-6'
    >
      {activeProject && list ? (
        list
      ) : (
        <ProjectsBoardEmpty message={NO_SELECTION_MESSAGE} />
      )}
    </TabsContent>
  )
}
