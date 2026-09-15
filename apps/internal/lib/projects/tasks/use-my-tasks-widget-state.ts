'use client'

import { useCallback, useMemo, useState } from 'react'

import type { AssignedTaskSummary } from '@/lib/data/tasks'
import { MY_TASKS_WIDGET_PAGE_SIZE } from '@/lib/dashboard/types'

import { sortAssignedTasks } from './assigned-task-utils'

const API_ENDPOINT = '/api/dashboard/my-tasks'

type UseMyTasksWidgetStateOptions = {
  initialTasks: AssignedTaskSummary[]
  initialTotalCount: number
}

type MyTasksPage = {
  items: AssignedTaskSummary[]
  totalCount: number
}

export function useMyTasksWidgetState({
  initialTasks,
  initialTotalCount,
}: UseMyTasksWidgetStateOptions) {
  const [tasks, setTasks] = useState(initialTasks)
  const [totalCount, setTotalCount] = useState(initialTotalCount)
  // Tracked separately from `tasks.length`: dedupe can drop rows, and
  // deriving the next offset from the deduped count would advance slower
  // than the server consumed, re-requesting overlapping pages forever.
  const [offset, setOffset] = useState(initialTasks.length)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const items = useMemo(() => buildVisibleTasks(tasks), [tasks])

  const loadMore = useCallback(async () => {
    if (isLoadingMore) {
      return
    }

    setIsLoadingMore(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        offset: String(offset),
        limit: String(MY_TASKS_WIDGET_PAGE_SIZE),
      })
      const response = await fetch(`${API_ENDPOINT}?${params}`, {
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error('Request failed')
      }

      const page = (await response.json()) as MyTasksPage

      // Advance by what the server actually returned, not by how many
      // survived dedupe, so a task inserted above the boundary can't stall
      // the cursor.
      setOffset(current => current + page.items.length)
      setTotalCount(page.totalCount)
      setTasks(current => {
        // A task completed or reordered between pages shifts the offset and
        // can re-deliver a row already on screen; dedupe by id so it can't
        // double up.
        const seen = new Set(current.map(task => task.id))
        return [...current, ...page.items.filter(task => !seen.has(task.id))]
      })
    } catch (requestError) {
      console.error('Failed to load more tasks', requestError)
      setError('Unable to load more tasks. Please try again.')
    } finally {
      setIsLoadingMore(false)
    }
  }, [isLoadingMore, offset])

  return { items, totalCount, isLoadingMore, error, loadMore }
}

function buildVisibleTasks(tasks: AssignedTaskSummary[]) {
  const filtered = tasks.filter(task => task.status !== 'DONE')
  return sortAssignedTasks(filtered)
}
