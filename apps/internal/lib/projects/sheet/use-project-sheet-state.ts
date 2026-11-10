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
} from '@/app/(dashboard)/projects/project-sheet-actions'
import { toastLink, useToast } from '@/components/ui/use-toast'
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'
import type { SheetSaveMode } from '@/lib/sheets/save-mode'
import { useReloadSheetRecord } from '@/lib/sheets/use-reload-sheet-record'
import type { SaveConflictGuard } from '@/lib/sheets/save-conflict/use-save-conflict'
import { useSaveAndStay } from '@/lib/sheets/use-save-and-stay'
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
  type ClientPickerRow,
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
  /** Prefills the create sheet's client (a company's Projects (its sheet's Client column)). */
  initialCompanyId?: string
  clients: ClientPickerRow[]
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
  /** Field edits or repo links not yet saved. */
  hasUnsavedChanges: boolean
  isEditing: boolean
  isPending: boolean
  projectType: ProjectSheetFormValues['projectType']
  requiresClientSelection: boolean
  clientOptions: ClientOption[]
  submitButton: SubmitButtonState
  deleteButton: DeleteButtonState
  isDeleteDialogOpen: boolean
  unsavedChangesDialog: ReturnType<typeof useUnsavedChangesWarning>['dialog']
  saveConflict: SaveConflictGuard
  handleLoadTheirs: () => void
  handleSheetOpenChange: (open: boolean) => void
  handleSubmit: (
    values: ProjectSheetFormValues,
    changes: ProjectSheetLinkChanges,
    mode?: SheetSaveMode,
    onLinksSaved?: () => void
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
  initialCompanyId,
  clients,
}: UseProjectSheetStateArgs): UseProjectSheetStateReturn {
  // New projects start on the first type the viewer may create
  // (`saveProject` enforces the same list).
  const { role } = useViewerAccess()
  const newProjectType = useMemo(() => {
    const creatable = creatableProjectTypes(role, PROJECT_TYPE_ENUM_VALUES)
    // A prefilled client means a client project, when the viewer may make one.
    if (initialCompanyId && creatable.includes('CLIENT')) return 'CLIENT'
    return creatable[0] ?? 'CLIENT'
  }, [role, initialCompanyId])
  const isEditing = Boolean(project)
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
    defaultValues: buildProjectFormDefaults(
      project,
      newProjectType,
      initialCompanyId
    ),
  })

  const hasUnsavedChanges = form.formState.isDirty || isReposDirty
  const projectType =
    useWatch({
      control: form.control,
      name: 'projectType',
    }) ?? 'CLIENT'
  const requiresClientSelection = projectType === 'CLIENT'

  const resetFormState = useCallback(() => {
    const defaults = buildProjectFormDefaults(
      project,
      newProjectType,
      initialCompanyId
    )

    form.reset(defaults, { keepDefaultValues: false })
    form.clearErrors()
    setIsReposDirty(false)
  }, [form, newProjectType, project, initialCompanyId])

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
    saveConflict,
  } = useSheetLifecycle({
    open,
    onOpenChange,
    isDirty: hasUnsavedChanges,
    onReset: resetFormState,
    resetKey: project?.id ?? null,
    version: project?.updated_at ?? null,
  })
  const reloadRecord = useReloadSheetRecord('project', project?.id ?? null)
  // Drop the edits; the lifecycle re-seeds when the newer project lands.
  const handleLoadTheirs = useCallback(() => {
    resetFormState()
    reloadRecord()
  }, [reloadRecord, resetFormState])

  const { stay, isReopening } = useSaveAndStay(
    'project',
    project?.id ?? null,
    open
  )

  const handleSubmit = useCallback(
    (
      values: ProjectSheetFormValues,
      changes: ProjectSheetLinkChanges,
      mode: SheetSaveMode = 'close',
      /** Keep-open saves: forget the link edits Save just applied. */
      onLinksSaved?: () => void
    ) => {
      const {
        pendingRepos,
        removedRepoIds,
        pendingIntegrationLinks,
        removedIntegrationLinkIds,
      } = changes
      startSave(async () => {
        form.clearErrors()

        if (isEditing && !values.slug?.trim()) {
          form.setError('slug', { type: 'manual', message: 'Slug is required' })
          return
        }

        // One server call saves the row, members and every link change in
        // one transaction: nothing is written unless all of it is.
        const payload: ProjectSavePayload = {
          ...createProjectSavePayload({ values, project }),
          expectedUpdatedAt: project ? saveConflict.expected() : undefined,
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
          form.setError('slug', {
            type: 'manual',
            message: 'Slug must be at least 3 characters when provided.',
          })
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

          if (saveConflict.catchConflict(result, mode)) {
            finishSettingsInteraction(interaction, {
              status: 'error',
              error: result.error ?? 'conflict',
            })
            return
          }
          if (result.error) {
            finishSettingsInteraction(interaction, {
              status: 'error',
              error: result.error,
            })
            toast({
              title: 'Unable to save project',
              description: result.error,
              variant: 'destructive',
              link: toastLink('project', payload.id),
            })
            return
          }

          saveConflict.saved(result.updatedAt)
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

          // Keep open: no toast; stay() makes its Save button say "Saved".
          if (mode === 'close') {
            toast({
              title: isEditing ? 'Project saved' : 'Project created',
              description: payload.name,
              link: toastLink('project', targetProjectId),
            })
          }

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

          if (mode === 'stay') {
            stay({
              id: targetProjectId,
              rebaseline: () => onLinksSaved?.(),
            })
            return
          }

          onOpenChange(false)
          onComplete()
        } catch (error) {
          finishSettingsInteraction(interaction, {
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          })
          toast({
            title: 'Unable to save project',
            description:
              error instanceof Error ? error.message : 'Unknown error.',
            variant: 'destructive',
            link: toastLink('project', payload.id),
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
      saveConflict,
      startSave,
      stay,
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
          toast({
            title: 'Unable to archive project',
            description: result.error,
            variant: 'destructive',
            link: toastLink('project', project.id),
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
          link: toastLink('project', project.id, { archived: true }),
        })

        onOpenChange(false)
        onComplete()
      } catch (error) {
        finishSettingsInteraction(interaction, {
          status: 'error',
          targetId: project.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        toast({
          title: 'Unable to archive project',
          description:
            error instanceof Error ? error.message : 'Unknown error.',
          variant: 'destructive',
          link: toastLink('project', project.id),
        })
      }
    })
  }, [form, isPending, onComplete, onOpenChange, project, startSave, toast])

  const submitButton = useMemo(
    () =>
      deriveSubmitButtonState(
        isPending || isReopening,
        isEditing,
        clientOptions,
        requiresClientSelection
      ),
    [clientOptions, isEditing, isPending, isReopening, requiresClientSelection]
  )

  const deleteButton = useMemo(
    () => deriveDeleteButtonState(isEditing, isPending, project),
    [isEditing, isPending, project]
  )

  return {
    form,
    hasUnsavedChanges,
    isEditing,
    isPending,
    projectType,
    requiresClientSelection,
    clientOptions,
    submitButton,
    deleteButton,
    isDeleteDialogOpen,
    unsavedChangesDialog,
    saveConflict,
    handleLoadTheirs,
    handleSheetOpenChange,
    handleSubmit,
    handleReposDirtyChange,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
  }
}
