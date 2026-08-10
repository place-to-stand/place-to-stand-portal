import { useCallback, useState } from 'react'

import type { ProjectWithRelations } from '@/lib/types'
import type { TimeLogEntry } from '@/lib/projects/time-log/types'

type UseBoardTimeLogDialogsOptions = {
  activeProject: ProjectWithRelations | null
}

type UseBoardTimeLogDialogsReturn = {
  isTimeLogDialogOpen: boolean
  timeLogProjectId: string | null
  handleTimeLogDialogOpenChange: (open: boolean) => void
  openCreateTimeLogDialog: () => void
  openEditTimeLogDialog: (entry: TimeLogEntry) => void
  mode: 'create' | 'edit'
  editingEntry: TimeLogEntry | null
}

export function useBoardTimeLogDialogs(
  options: UseBoardTimeLogDialogsOptions
): UseBoardTimeLogDialogsReturn {
  const { activeProject } = options
  const [isTimeLogDialogOpen, setIsTimeLogDialogOpen] = useState(false)
  const [timeLogProjectId, setTimeLogProjectId] = useState<string | null>(null)
  const [mode, setMode] = useState<'create' | 'edit'>('create')
  const [editingEntry, setEditingEntry] = useState<TimeLogEntry | null>(null)

  const resetDialogState = useCallback(() => {
    setIsTimeLogDialogOpen(false)
    setTimeLogProjectId(null)
    setMode('create')
    setEditingEntry(null)
  }, [])

  const handleTimeLogDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        resetDialogState()
        return
      }

      if (!activeProject) {
        resetDialogState()
        return
      }

      setTimeLogProjectId(activeProject.id)
      setIsTimeLogDialogOpen(true)
    },
    [activeProject, resetDialogState]
  )

  const openCreateTimeLogDialog = useCallback(() => {
    if (!activeProject) {
      resetDialogState()
      return
    }

    setMode('create')
    setEditingEntry(null)
    setTimeLogProjectId(activeProject.id)
    setIsTimeLogDialogOpen(true)
  }, [activeProject, resetDialogState])

  const openEditTimeLogDialog = useCallback(
    (entry: TimeLogEntry) => {
      if (!activeProject) {
        resetDialogState()
        return
      }

      if (entry.project_id && entry.project_id !== activeProject.id) {
        resetDialogState()
        return
      }

      setMode('edit')
      setEditingEntry(entry)
      setTimeLogProjectId(activeProject.id)
      setIsTimeLogDialogOpen(true)
    },
    [activeProject, resetDialogState]
  )

  return {
    isTimeLogDialogOpen,
    timeLogProjectId,
    handleTimeLogDialogOpenChange,
    openCreateTimeLogDialog,
    openEditTimeLogDialog,
    mode,
    editingEntry,
  }
}
