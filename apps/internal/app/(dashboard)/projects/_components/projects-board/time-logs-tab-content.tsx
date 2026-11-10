'use client'

import type { ReactNode } from 'react'

import { TabsContent } from '@pts/ui/tabs'
import { ProjectsBoardEmpty } from '../projects-board-empty'
import { NO_SELECTION_MESSAGE } from './projects-board-tabs.constants'
import type { ProjectsBoardActiveProject } from './board-tab-content'

type TimeLogsTabContentProps = {
  isActive: boolean
  activeProject: ProjectsBoardActiveProject
  /** The Time logs list held to this project (`ProjectTimeLogsList`). */
  list: ReactNode
}

export function TimeLogsTabContent({
  isActive,
  activeProject,
  list,
}: TimeLogsTabContentProps) {
  if (!isActive) {
    return null
  }

  return (
    <TabsContent
      value='timeLogs'
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
