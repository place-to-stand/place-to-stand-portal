import { NavRow } from '@/components/ui/nav-row'
import { SummaryHeader } from '@/components/ui/summary-header'
import { cn } from '@/lib/utils'
import type { ClientProject } from '@/lib/data/projects'

function openTaskLabel(count: number): string {
  if (count === 0) return 'No open tasks'
  return count === 1 ? '1 open task' : `${count} open tasks`
}

/**
 * Mirror of the account card: a headline stat on top, then one row per project
 * leading to its detail page.
 *
 * The progress bar counts completed work against everything the client can see
 * — done plus every open status (on deck, in progress, and blocked). Blocked
 * work is still owed, so excluding it would quietly inflate the percentage.
 */
export function ProjectsCard({
  projects,
  /** Only name the client when the viewer has more than one. */
  showClientName,
  className,
}: {
  projects: ClientProject[]
  showClientName: boolean
  className?: string
}) {
  const done = projects.reduce((sum, p) => sum + p.doneTaskCount, 0)
  const open = projects.reduce((sum, p) => sum + p.openTaskCount, 0)
  const total = done + open
  const percent = total > 0 ? (done / total) * 100 : 0

  return (
    <div
      className={cn(
        'divide-y divide-border overflow-hidden rounded-lg border border-border bg-card',
        className
      )}
    >
      <SummaryHeader
        label="Tasks Completed"
        value={String(done)}
        suffix={total === 1 ? 'of 1 task' : `of ${total} tasks`}
        percent={percent}
        progressLabel="Tasks completed"
      />

      {projects.map(project => (
        <NavRow
          key={project.id}
          href={`/projects/${project.id}`}
          title={project.name}
          meta={
            <span className="truncate text-sm text-muted-foreground">
              {showClientName && project.clientName
                ? `${project.clientName} · ${openTaskLabel(project.openTaskCount)}`
                : openTaskLabel(project.openTaskCount)}
            </span>
          }
        />
      ))}
    </div>
  )
}
