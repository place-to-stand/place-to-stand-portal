'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  useForm,
  useWatch,
  type Resolver,
  type UseFormReturn,
} from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'

import type { IntegrationProvider } from '@/lib/types/integrations'

import {
  saveProject,
  softDeleteProject,
} from '@/app/(dashboard)/settings/projects/actions'
import { useToast } from '@/components/ui/use-toast'
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'
import { useSheetLifecycle } from '@/lib/sheets/use-sheet-lifecycle'
import {
  finishSettingsInteraction,
  startSettingsInteraction,
} from '@/lib/posthog/settings'
import { useViewerAccess } from '@/components/providers/viewer-access-provider'
import { creatableProjectTypes } from '@/lib/auth/capabilities'
import {
  PROJECT_TYPE_ENUM_VALUES,
  buildProjectFormDefaults,
  createProjectSavePayload,
  projectSheetFormSchema,
  PROJECT_FORM_FIELDS,
  sortClientsByName,
  type ClientRow,
  type ContractorUserSummary,
  type ProjectSavePayload,
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

export type UseProjectSheetStateArgs = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
  project: ProjectWithClient | null
  clients: ClientRow[]
  contractorDirectory?: ContractorUserSummary[]
  projectContractors?: Record<string, ContractorUserSummary[]>
}

type PendingRepo = {
  repoFullName: string
  source?: 'oauth' | 'app'
  sourceId?: string
}

export type PendingIntegrationLink = {
  provider: IntegrationProvider
  externalId: string
  externalName: string
  ownerName: string | null
}

/**
 * Link edits the sheet accumulates; Save sends them with the project to
 * `saveProject`, which writes everything in one transaction. Only ids are
 * needed to unlink; pending entries carry what the link needs.
 */
export type ProjectSheetLinkChanges = {
  pendingRepos: PendingRepo[]
  removedRepoIds: string[]
  pendingIntegrationLinks: PendingIntegrationLink[]
  removedIntegrationLinkIds: string[]
}

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
    changes: ProjectSheetLinkChanges
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
  // New projects start on the first type the viewer may create
  // (`saveProject` enforces the same list).
  const { role } = useViewerAccess()
  const newProjectType = useMemo(
    () => creatableProjectTypes(role, PROJECT_TYPE_ENUM_VALUES)[0] ?? 'CLIENT',
    [role]
  )
  const isEditing = Boolean(project)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isReposDirty, setIsReposDirty] = useState(false)
  const { toast } = useToast()
  const queryClient = useQueryClient()

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
    defaultValues: buildProjectFormDefaults(project, newProjectType),
  })

  const hasUnsavedChanges = form.formState.isDirty || isReposDirty
  const projectType =
    useWatch({
      control: form.control,
      name: 'projectType',
    }) ?? 'CLIENT'
  const requiresClientSelection = projectType === 'CLIENT'

  const resetFormState = useCallback(() => {
    const defaults = buildProjectFormDefaults(project, newProjectType)

    form.reset(defaults, { keepDefaultValues: false })
    form.clearErrors()
    setFeedback(null)
    setIsReposDirty(false)
  }, [form, newProjectType, project])

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

  const {
    isSaving: isPending,
    startSave,
    handleSheetOpenChange,
    unsavedChangesDialog,
  } = useSheetLifecycle({
    open,
    onOpenChange,
    isDirty: hasUnsavedChanges,
    onReset: resetFormState,
    resetKey: project?.id ?? null,
  })

  const handleSubmit = useCallback(
    (values: ProjectSheetFormValues, changes: ProjectSheetLinkChanges) => {
      const {
        pendingRepos,
        removedRepoIds,
        pendingIntegrationLinks,
        removedIntegrationLinkIds,
      } = changes
      startSave(async () => {
        setFeedback(null)
        form.clearErrors()

        if (isEditing && !values.slug?.trim()) {
          form.setError('slug', { type: 'manual', message: 'Slug is required' })
          return
        }

        // One server call saves the row, members and every link change in
        // one transaction: nothing is written unless all of it is.
        const payload: ProjectSavePayload = {
          ...createProjectSavePayload({ values, project }),
          repoLinks: {
            add: pendingRepos.map(repo => ({
              repoFullName: repo.repoFullName,
              source: repo.source,
              sourceId: repo.sourceId,
            })),
            remove: removedRepoIds,
          },
          integrationLinks: {
            add: pendingIntegrationLinks.map(link => ({
              provider: link.provider,
              externalId: link.externalId,
            })),
            remove: removedIntegrationLinkIds,
          },
        }

        if (payload.slug && payload.slug.length < 3) {
          setFeedback('Slug must be at least 3 characters when provided.')
          return
        }

        const interaction = startSettingsInteraction({
          entity: 'project',
          mode: isEditing ? 'edit' : 'create',
          targetId: payload.id ?? null,
          metadata: {
            companyId: payload.companyId,
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

          const targetProjectId = result.projectId ?? payload.id
          if (targetProjectId) {
            // The sheet stays mounted between opens, so the links section's
            // query never remounts — invalidate it or the next open shows
            // the pre-save list.
            await Promise.all([
              queryClient.invalidateQueries({
                queryKey: ['projectIntegrationLinks', targetProjectId],
              }),
              queryClient.invalidateQueries({ queryKey: ['projectMembers'] }),
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
            companyId: payload.companyId ?? '',
            status: payload.status,
            startsOn: payload.startsOn ?? '',
            endsOn: payload.endsOn ?? '',
            slug: payload.slug ?? '',
            ownerId: payload.ownerId ?? '',
            memberIds: payload.memberIds,
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
      queryClient,
      onComplete,
      onOpenChange,
      project,
      startSave,
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
    startSave(async () => {
      setFeedback(null)
      form.clearErrors()
      const interaction = startSettingsInteraction({
        entity: 'project',
        mode: 'delete',
        targetId: project.id,
        metadata: {
          companyId: project.company_id ?? null,
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
  }, [form, isPending, onComplete, onOpenChange, project, startSave, toast])

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
