import { Card } from '@pts/ui/card'

import { NavRow } from '@/components/ui/nav-row'
import { SummaryHeader } from '@/components/ui/summary-header'
import { cn } from '@/lib/utils'
import type { ClientProject } from '@/lib/data/projects'

function openTaskLabel(count: number): string {
  if (count === 0) return 'No open tasks'
  return count === 1 ? '1 open task' : `${count} open tasks`
}

/**
 * Mirror of the account card, for one client: tasks remaining on top (read
 * like the hours balance beside it), then one row per project leading to its
 * detail page.
 *
 * "Remaining" is every open status (on deck, in progress, and blocked);
 * blocked work is still owed, so leaving it out would quietly shrink the
 * figure. The bar shows what's left, the way the hours bar does.
 */
export function ProjectsCard({
  projects,
  className,
}: {
  projects: ClientProject[]
  className?: string
}) {
  const done = projects.reduce((sum, p) => sum + p.doneTaskCount, 0)
  const open = projects.reduce((sum, p) => sum + p.openTaskCount, 0)
  const total = done + open
  const percent = total > 0 ? (open / total) * 100 : 0

  return (
    <Card className={cn('gap-0 divide-y overflow-hidden py-0', className)}>
      {total === 0 ? (
        // An empty bar, like a client with 0h left, so the two cards match.
        <SummaryHeader
          label='Tasks'
          value='0'
          suffix='tasks yet'
          percent={0}
          progressLabel='Tasks remaining'
        />
      ) : (
        <SummaryHeader
          label='Tasks'
          value={String(open)}
          suffix={
            total === 1
              ? 'remaining of 1 total task'
              : `remaining of ${total} total tasks`
          }
          percent={percent}
          progressLabel='Tasks remaining'
        />
      )}

      {projects.map(project => (
        <NavRow
          key={project.id}
          href={`/projects/${project.id}`}
          title={project.name}
          meta={
            <span className='text-muted-foreground truncate text-sm'>
              {openTaskLabel(project.openTaskCount)}
            </span>
          }
        />
      ))}
    </Card>
  )
}
