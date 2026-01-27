"use client"

import { MetricCard, MetricCardSkeleton } from "./metric-card"
import type { SummaryState } from "./use-recent-activity-summary"

type SummaryContentProps = {
  state: SummaryState
}

export function SummaryContent({ state }: SummaryContentProps) {
  if (state.status === "error") {
    return (
      <div className="text-destructive text-sm">
        {state.error ?? "We were unable to load the recent activity overview."}
      </div>
    )
  }

  if (state.status === "loading") {
    return <LoadingState />
  }

  if (!state.metrics) {
    return (
      <div className="text-muted-foreground text-sm">
        No updates to share just yet. As soon as activity is captured, you&apos;ll see
        a recap here.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <MetricCard value={state.metrics.tasksDone} label="tasks accepted" />
        <MetricCard value={state.metrics.newLeads} label="new leads" />
        <MetricCard value={state.metrics.activeProjects} label="active projects" />
        <MetricCard
          value={state.metrics.blockedTasks}
          label="tasks blocked"
          variant="warning"
        />
      </div>
      {state.highlight && (
        <p className="text-muted-foreground text-sm leading-relaxed">
          &ldquo;{state.highlight}&rdquo;
        </p>
      )}
    </div>
  )
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>
      <div className="bg-muted h-4 w-4/5 animate-pulse rounded" />
    </div>
  )
}
