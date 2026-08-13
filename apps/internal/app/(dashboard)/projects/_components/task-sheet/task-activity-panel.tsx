'use client'

import { ActivityFeed } from '@/components/activity/activity-feed'
import { Separator } from '@pts/ui/separator'

type TaskActivityPanelProps = {
  taskId: string | null
  projectId: string
  clientId?: string | null
}

export function TaskActivityPanel({
  taskId,
  projectId,
  clientId,
}: TaskActivityPanelProps) {
  if (!taskId) {
    return (
      <div className='space-y-2'>
        <Separator />
        <p className='text-muted-foreground text-sm'>
          Log history becomes available once the task is created.
        </p>
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      {/* No heading here — the enclosing tab is already labelled "Activity". */}
      <ActivityFeed
        targetType='TASK'
        targetId={taskId}
        projectId={projectId}
        clientId={clientId ?? null}
        pageSize={20}
        emptyState='No activity recorded yet.'
      />
    </div>
  )
}
