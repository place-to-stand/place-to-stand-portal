'use client'

import { useMemo } from 'react'

import type { AssignedTaskSummary } from '@/lib/data/tasks'

import { sortAssignedTasks } from './assigned-task-utils'

type UseMyTasksWidgetStateOptions = {
  initialTasks: AssignedTaskSummary[]
}

export function useMyTasksWidgetState({
  initialTasks,
}: UseMyTasksWidgetStateOptions) {
  const items = useMemo(() => buildVisibleTasks(initialTasks), [initialTasks])

  return { items }
}

function buildVisibleTasks(tasks: AssignedTaskSummary[]) {
  const filtered = tasks.filter(task => task.status !== 'DONE')
  return sortAssignedTasks(filtered)
}
