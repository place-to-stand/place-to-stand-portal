'use client'

import Link from 'next/link'

import type { AssignedTaskSummary } from '@/lib/data/tasks'

import { cn } from '@/lib/utils'
import { useMyTasksWidgetState } from '@/lib/projects/tasks/use-my-tasks-widget-state'
import { Button } from '@pts/ui/button'

import { EmptyState } from './empty-state'
import { TaskList } from './task-list'

type MyTasksWidgetProps = {
  tasks: AssignedTaskSummary[]
  totalCount: number
  className?: string
}

export function MyTasksWidget({
  tasks,
  totalCount,
  className,
}: MyTasksWidgetProps) {

  const { items } = useMyTasksWidgetState({
    initialTasks: tasks,
  })
  const visibleCount = Math.min(items.length, totalCount)

  return (
    <section
      className={cn(
        'bg-card flex flex-col overflow-hidden rounded-xl border shadow-sm',
        className
      )}
      aria-labelledby='my-tasks-heading'
    >
      <header className='flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5'>
        <div className='min-w-0 flex-1'>
          <h2 id='my-tasks-heading' className='text-sm font-semibold'>
            My Tasks
          </h2>
        </div>
        <div className='flex items-center gap-2'>
          <p className='text-muted-foreground text-xs font-medium'>
            {visibleCount} of {totalCount} tasks
          </p>
          <Button asChild size='xs' variant='outline'>
            <Link href='/my/tasks/board' aria-label='View all assigned tasks'>
              See all
            </Link>
          </Button>
        </div>
      </header>
      <div className='flex-1 overflow-hidden'>
        {items.length ? <TaskList items={items} /> : <EmptyState />}
      </div>
    </section>
  )
}
