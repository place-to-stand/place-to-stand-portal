'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import type { ProjectTimeLogDialogParams } from './types'

type ProjectTask = ProjectTimeLogDialogParams['tasks'][number]

export type UseTimeLogTaskSelectionResult = {
  selectedTaskIds: string[]
  availableTasks: ProjectTimeLogDialogParams['tasks']
  selectedTasks: ProjectTimeLogDialogParams['tasks']
  isTaskPickerOpen: boolean
  onTaskPickerOpenChange: (open: boolean) => void
  onAddTask: (taskId: string) => void
  requestTaskRemoval: (task: ProjectTask) => void
  confirmTaskRemoval: () => void
  cancelTaskRemoval: () => void
  taskRemovalCandidate: ProjectTask | null
  initializeSelection: (taskIds?: string[]) => void
  resetSelection: () => void
}

export function useTimeLogTaskSelection(
  tasks: ProjectTimeLogDialogParams['tasks'],
  options?: {
    /**
     * Task ids that bypass the eligibility filter (task-sheet pre-link, C5):
     * an accepted task can take hours from its own sheet even though the
     * picker normally hides accepted tasks. Archived/deleted tasks never
     * reach here — the sheet disables the Log time button instead.
     */
    pinnedTaskIds?: string[]
  }
): UseTimeLogTaskSelectionResult {
  const pinnedTaskIds = options?.pinnedTaskIds
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
  const [isTaskPickerOpen, setIsTaskPickerOpen] = useState(false)
  const [taskRemovalCandidate, setTaskRemovalCandidate] =
    useState<ProjectTask | null>(null)

  const eligibleTasks = useMemo(() => {
    const pinnedSet = new Set(pinnedTaskIds ?? [])
    return tasks
      .filter(task => {
        if (pinnedSet.has(task.id)) {
          return true
        }
        if (task.deleted_at !== null) {
          return false
        }
        if (task.accepted_at !== null) {
          return false
        }
        return true
      })
      .sort((a, b) => {
        // Sort by most recently updated first
        const aTime = new Date(a.updated_at).getTime()
        const bTime = new Date(b.updated_at).getTime()
        return bTime - aTime
      })
  }, [pinnedTaskIds, tasks])

  const availableTasks = useMemo(() => {
    if (selectedTaskIds.length === 0) {
      return eligibleTasks
    }

    const selectedSet = new Set(selectedTaskIds)
    return eligibleTasks.filter(task => !selectedSet.has(task.id))
  }, [eligibleTasks, selectedTaskIds])

  useEffect(() => {
    if (!isTaskPickerOpen || availableTasks.length !== 0) {
      return
    }

    let cancelled = false

    queueMicrotask(() => {
      if (!cancelled) {
        setIsTaskPickerOpen(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [availableTasks.length, isTaskPickerOpen])

  const selectedTasks = useMemo(() => {
    if (selectedTaskIds.length === 0) {
      return []
    }

    const taskLookup = new Map<string, ProjectTask>()
    eligibleTasks.forEach(task => {
      taskLookup.set(task.id, task)
    })

    return selectedTaskIds
      .map(taskId => taskLookup.get(taskId))
      .filter((task): task is ProjectTask => Boolean(task))
  }, [eligibleTasks, selectedTaskIds])

  const onAddTask = useCallback((taskId: string) => {
    setSelectedTaskIds(prev => {
      if (prev.includes(taskId)) {
        return prev
      }
      return [...prev, taskId]
    })
  }, [])

  const requestTaskRemoval = useCallback((task: ProjectTask) => {
    setTaskRemovalCandidate(task)
  }, [])

  const confirmTaskRemoval = useCallback(() => {
    if (!taskRemovalCandidate) {
      return
    }

    setSelectedTaskIds(prev =>
      prev.filter(taskId => taskId !== taskRemovalCandidate.id)
    )
    setTaskRemovalCandidate(null)
  }, [taskRemovalCandidate])

  const cancelTaskRemoval = useCallback(() => {
    setTaskRemovalCandidate(null)
  }, [])

  const initializeSelection = useCallback((taskIds: string[] = []) => {
    setSelectedTaskIds(taskIds)
    setTaskRemovalCandidate(null)
  }, [])

  const resetSelection = useCallback(() => {
    setSelectedTaskIds([])
    setTaskRemovalCandidate(null)
  }, [])

  return {
    selectedTaskIds,
    availableTasks,
    selectedTasks,
    isTaskPickerOpen,
    onTaskPickerOpenChange: setIsTaskPickerOpen,
    onAddTask,
    requestTaskRemoval,
    confirmTaskRemoval,
    cancelTaskRemoval,
    taskRemovalCandidate,
    initializeSelection,
    resetSelection,
  }
}
