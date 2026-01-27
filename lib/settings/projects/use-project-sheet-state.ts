'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import {
  useForm,
  useWatch,
  type Resolver,
  type UseFormReturn,
} from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import {
  saveProject,
  softDeleteProject,
} from '@/app/(dashboard)/settings/projects/actions'
import { useToast } from '@/components/ui/use-toast'
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'
import {
  finishSettingsInteraction,
  startSettingsInteraction,
} from '@/lib/posthog/settings'
import {
  buildProjectFormDefaults,
  createProjectSavePayload,
  projectSheetFormSchema,
  PROJECT_FORM_FIELDS,
  sortClientsByName,
  type ClientRow,
  type ContractorUserSummary,
  type ProjectSheetFormValues,
  type ProjectWithClient,
} from './project-sheet-form'
import {
  buildClientOptions,
  deriveDeleteButtonState,
  deriveSubmitButtonState,
  type ClientOption,
  type DeleteButtonState,
  type SubmitButtonState,
} from './project-sheet-ui-state'

export type {
  ContractorUserSummary,
  ProjectSheetFormValues,
  ProjectWithClient,
} from './project-sheet-form'
export { PROJECT_SHEET_MISSING_CLIENT_REASON } from './project-sheet-ui-state'

export type UseProjectSheetStateArgs = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
  project: ProjectWithClient | null
  clients: ClientRow[]
  contractorDirectory?: ContractorUserSummary[]
  projectContractors?: Record<string, ContractorUserSummary[]>
}

export type PendingRepo = {
  repoFullName: string
}

// Note: We only need the ID to unlink repos via the API

export type UseProjectSheetStateReturn = {
  form: UseFormReturn<ProjectSheetFormValues>
  feedback: string | null
  isEditing: boolean
  isPending: boolean
  projectType: ProjectSheetFormValues['projectType']
  requiresClientSelection: boolean
  clientOptions: ClientOption[]
  submitButton: SubmitButtonState
  deleteButton: DeleteButtonState
  isDeleteDialogOpen: boolean
  unsavedChangesDialog: ReturnType<typeof useUnsavedChangesWarning>['dialog']
  handleSheetOpenChange: (open: boolean) => void
  handleSubmit: (
    values: ProjectSheetFormValues,
    pendingRepos: PendingRepo[],
    removedRepoIds: string[]
  ) => void
  handleReposDirtyChange: (isDirty: boolean) => void
  handleRequestDelete: () => void
  handleCancelDelete: () => void
  handleConfirmDelete: () => void
}

export function useProjectSheetState({
  open,
  onOpenChange,
  onComplete,
  project,
  clients,
}: UseProjectSheetStateArgs): UseProjectSheetStateReturn {
  const isEditing = Boolean(project)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isReposDirty, setIsReposDirty] = useState(false)
  const { toast } = useToast()

  const sortedClients = useMemo(() => sortClientsByName(clients), [clients])

  const clientOptions = useMemo<ClientOption[]>(
    () => buildClientOptions(sortedClients),
    [sortedClients]
  )

  const resolver = zodResolver(
    projectSheetFormSchema
  ) as Resolver<ProjectSheetFormValues>

  const form = useForm<ProjectSheetFormValues>({
    resolver,
    defaultValues: buildProjectFormDefaults(project),
  })

  const hasUnsavedChanges = form.formState.isDirty || isReposDirty
  const projectType =
    useWatch({
      control: form.control,
      name: 'projectType',
    }) ?? 'CLIENT'
  const requiresClientSelection = projectType === 'CLIENT'

  const { requestConfirmation: confirmDiscard, dialog: unsavedChangesDialog } =
    useUnsavedChangesWarning({ isDirty: hasUnsavedChanges })

  const resetFormState = useCallback(() => {
    const defaults = buildProjectFormDefaults(project)

    form.reset(defaults, { keepDefaultValues: false })
    form.clearErrors()
    setFeedback(null)
    setIsReposDirty(false)
  }, [form, project])

  const handleReposDirtyChange = useCallback((isDirty: boolean) => {
    setIsReposDirty(isDirty)
  }, [])

  const applyServerFieldErrors = useCallback(
    (fieldErrors?: Record<string, string[]>) => {
      if (!fieldErrors) return

      PROJECT_FORM_FIELDS.forEach(field => {
        const message = fieldErrors[field]?.[0]
        if (!message) return
        form.setError(field, { type: 'server', message })
      })
    },
    [form]
  )

  useEffect(() => {
    if (!open) {
      return
    }

    startTransition(() => {
      resetFormState()
    })
  }, [open, resetFormState, startTransition])

  const handleSheetOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        confirmDiscard(() => {
          startTransition(() => {
            resetFormState()
          })
          onOpenChange(false)
        })
        return
      }

      onOpenChange(next)
    },
    [confirmDiscard, onOpenChange, resetFormState, startTransition]
  )

  const linkPendingRepos = useCallback(
    async (projectId: string, pendingRepos: PendingRepo[]) => {
      if (pendingRepos.length === 0) return

      const linkPromises = pendingRepos.map(repo =>
        fetch(`/api/projects/${projectId}/github-repos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repoFullName: repo.repoFullName }),
        })
      )

      try {
        await Promise.all(linkPromises)
      } catch {
        // Log but don't fail the save - repos can be linked manually later
        console.error('Failed to link some repositories')
      }
    },
    []
  )

  const unlinkRemovedRepos = useCallback(
    async (projectId: string, removedRepoIds: string[]) => {
      if (removedRepoIds.length === 0) return

      const unlinkPromises = removedRepoIds.map(repoId =>
        fetch(`/api/projects/${projectId}/github-repos/${repoId}`, {
          method: 'DELETE',
        })
      )

      try {
        await Promise.all(unlinkPromises)
      } catch {
        // Log but don't fail the save - repos can be unlinked manually later
        console.error('Failed to unlink some repositories')
      }
    },
    []
  )

  const handleSubmit = useCallback(
    (
      values: ProjectSheetFormValues,
      pendingRepos: PendingRepo[],
      removedRepoIds: string[]
    ) => {
      startTransition(async () => {
        setFeedback(null)
        form.clearErrors()

        if (isEditing && !values.slug?.trim()) {
          form.setError('slug', { type: 'manual', message: 'Slug is required' })
          return
        }

        const payload = createProjectSavePayload({
          values,
          project,
          isEditing,
        })

        if (payload.slug && payload.slug.length < 3) {
          setFeedback('Slug must be at least 3 characters when provided.')
          return
        }

        const interaction = startSettingsInteraction({
          entity: 'project',
          mode: isEditing ? 'edit' : 'create',
          targetId: payload.id ?? null,
          metadata: {
            clientId: payload.clientId,
            status: payload.status,
          },
        })

        try {
          const result = await saveProject(payload)

          applyServerFieldErrors(result.fieldErrors)

          if (result.error) {
            finishSettingsInteraction(interaction, {
              status: 'error',
              error: result.error,
            })
            setFeedback(result.error)
            toast({
              title: 'Unable to save project',
              description: result.error,
              variant: 'destructive',
            })
            return
          }

          // Link pending repos and unlink removed repos after successful save
          const targetProjectId = result.projectId ?? payload.id
          if (targetProjectId) {
            await Promise.all([
              pendingRepos.length > 0
                ? linkPendingRepos(targetProjectId, pendingRepos)
                : Promise.resolve(),
              removedRepoIds.length > 0
                ? unlinkRemovedRepos(targetProjectId, removedRepoIds)
                : Promise.resolve(),
            ])
          }

          finishSettingsInteraction(interaction, {
            status: 'success',
            targetId: targetProjectId ?? null,
          })

          toast({
            title: isEditing ? 'Project updated' : 'Project created',
            description: isEditing
              ? 'Changes saved successfully.'
              : 'The project is ready to track activity.',
          })

          form.reset({
            name: payload.name,
            projectType: payload.projectType,
            clientId: payload.clientId ?? '',
            status: payload.status,
            startsOn: payload.startsOn ?? '',
            endsOn: payload.endsOn ?? '',
            slug: payload.slug ?? '',
            ownerId: payload.ownerId ?? '',
          })

          onOpenChange(false)
          onComplete()
        } catch (error) {
          finishSettingsInteraction(interaction, {
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          })
          setFeedback('We could not save the project. Please try again.')
          toast({
            title: 'Unable to save project',
            description:
              error instanceof Error ? error.message : 'Unknown error.',
            variant: 'destructive',
          })
        }
      })
    },
    [
      applyServerFieldErrors,
      form,
      isEditing,
      linkPendingRepos,
      unlinkRemovedRepos,
      onComplete,
      onOpenChange,
      project,
      startTransition,
      toast,
    ]
  )

  const handleRequestDelete = useCallback(() => {
    if (!project || project.deleted_at || isPending) {
      return
    }

    setIsDeleteDialogOpen(true)
  }, [isPending, project])

  const handleCancelDelete = useCallback(() => {
    if (isPending) {
      return
    }

    setIsDeleteDialogOpen(false)
  }, [isPending])

  const handleConfirmDelete = useCallback(() => {
    if (!project || project.deleted_at || isPending) {
      return
    }

    setIsDeleteDialogOpen(false)
    startTransition(async () => {
      setFeedback(null)
      form.clearErrors()
      const interaction = startSettingsInteraction({
        entity: 'project',
        mode: 'delete',
        targetId: project.id,
        metadata: {
          clientId: project.client_id ?? null,
        },
      })

      try {
        const result = await softDeleteProject({ id: project.id })

        if (result.error) {
          finishSettingsInteraction(interaction, {
            status: 'error',
            targetId: project.id,
            error: result.error,
          })
          setFeedback(result.error)
          toast({
            title: 'Unable to archive project',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        finishSettingsInteraction(interaction, {
          status: 'success',
          targetId: project.id,
        })

        toast({
          title: 'Project archived',
          description: 'You can still find it in historical reporting.',
        })

        onOpenChange(false)
        onComplete()
      } catch (error) {
        finishSettingsInteraction(interaction, {
          status: 'error',
          targetId: project.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        setFeedback('We could not archive this project. Please try again.')
        toast({
          title: 'Unable to archive project',
          description:
            error instanceof Error ? error.message : 'Unknown error.',
          variant: 'destructive',
        })
      }
    })
  }, [
    form,
    isPending,
    onComplete,
    onOpenChange,
    project,
    startTransition,
    toast,
  ])

  const submitButton = useMemo(
    () =>
      deriveSubmitButtonState(
        isPending,
        isEditing,
        clientOptions,
        requiresClientSelection
      ),
    [clientOptions, isEditing, isPending, requiresClientSelection]
  )

  const deleteButton = useMemo(
    () => deriveDeleteButtonState(isEditing, isPending, project),
    [isEditing, isPending, project]
  )

  return {
    form,
    feedback,
    isEditing,
    isPending,
    projectType,
    requiresClientSelection,
    clientOptions,
    submitButton,
    deleteButton,
    isDeleteDialogOpen,
    unsavedChangesDialog,
    handleSheetOpenChange,
    handleSubmit,
    handleReposDirtyChange,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
  }
}
