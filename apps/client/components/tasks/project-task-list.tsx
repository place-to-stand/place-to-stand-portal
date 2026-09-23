import { Badge } from '@pts/ui/badge'
import { Card } from '@pts/ui/card'
import { EmptyState } from '@pts/ui/empty-state'
import { cn } from '@/lib/utils'
import { getTaskStatusLabel, getTaskStatusToken } from '@/lib/tasks/task-status'
import type { ClientTask, ProjectTasks } from '@/lib/data/tasks'

/**
 * Task rows with no surface of their own.
 *
 * Shared by the project page (inside a bordered card) and the dashboard's
 * expandable project rows, so both render the same work identically.
 */
function TaskRows({ tasks }: { tasks: ClientTask[] }) {
  return (
    <ul className='divide-border divide-y'>
      {tasks.map(task => (
        <li
          key={task.id}
          className='flex items-start justify-between gap-3 py-2.5'
        >
          <span className='text-card-foreground min-w-0 text-sm'>
            {task.title}
          </span>
          <Badge
            variant='outline'
            className={cn('shrink-0', getTaskStatusToken(task.status))}
          >
            {getTaskStatusLabel(task.status)}
          </Badge>
        </li>
      ))}
    </ul>
  )
}

export function ProjectTaskList({ tasks }: { tasks: ProjectTasks }) {
  const hasAny = tasks.current.length > 0 || tasks.completed.length > 0

  if (!hasAny) {
    return (
      <section className='space-y-2'>
        <SectionLabel>Tasks</SectionLabel>
        <EmptyState message='No tasks yet.' />
      </section>
    )
  }

  return (
    <div className='space-y-6'>
      {tasks.current.length > 0 && (
        <section className='space-y-2'>
          <SectionLabel>In progress</SectionLabel>
          <TaskGroup tasks={tasks.current} />
        </section>
      )}

      {tasks.completed.length > 0 && (
        <section className='space-y-2'>
          <SectionLabel>Completed</SectionLabel>
          <TaskGroup tasks={tasks.completed} />
        </section>
      )}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
      {children}
    </h2>
  )
}

function TaskGroup({ tasks }: { tasks: ClientTask[] }) {
  return (
    <Card className='gap-0 overflow-hidden px-4 py-0'>
      <TaskRows tasks={tasks} />
    </Card>
  )
}
