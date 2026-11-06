'use client'

import type { UseFormReturn } from 'react-hook-form'

import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { EntityLabelIcon } from '@/components/ui/entity-label-icon'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  SearchableCombobox,
  type SearchableComboboxGroup,
  type SearchableComboboxItem,
} from '@/components/ui/searchable-combobox'
import {
  decodeTaskHome,
  encodeTaskHome,
} from '@/lib/projects/task-sheet/task-home-options'
import type { TaskSheetFormValues } from '@/lib/projects/task-sheet/task-sheet-schema'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'
import { ENTITY_ICONS } from '@/lib/entity-accents'

type TaskHomeFieldProps = {
  form: UseFormReturn<TaskSheetFormValues>
  items: SearchableComboboxItem[]
  groups: SearchableComboboxGroup[]
  disabled: boolean
  disabledReason: string | null
  /** False when the viewer can't open project sheets (non-admins). */
  canOpenProject: boolean
}

/**
 * Where the task lives: one project or one lead, never both. Picking one
 * clears the other. The picked record shows as its preview card, which opens
 * it, stacked as its sheet.
 */
export function TaskHomeField({
  form,
  items,
  groups,
  disabled,
  disabledReason,
  canOpenProject,
}: TaskHomeFieldProps) {
  const { open } = useSheetParams()

  return (
    <FormField
      control={form.control}
      name='projectId'
      render={({ field }) => {
        const leadId = form.watch('leadId') ?? null
        const value = encodeTaskHome({ projectId: field.value ?? null, leadId })
        const home = decodeTaskHome(value)
        const openable = home.leadId !== null || canOpenProject

        return (
          <FormItem>
            <FormLabel>
              <TaskHomeLabel
                kind={home.leadId ? 'lead' : home.projectId ? 'project' : null}
              />
            </FormLabel>
            <FormControl>
              <DisabledFieldTooltip disabled={disabled} reason={disabledReason}>
                <SearchableCombobox
                  items={items}
                  groups={groups}
                  value={value}
                  onChange={next => {
                    const picked = decodeTaskHome(next)
                    field.onChange(picked.projectId)
                    form.setValue('leadId', picked.leadId, {
                      shouldDirty: true,
                    })
                  }}
                  onBlur={field.onBlur}
                  name={field.name}
                  placeholder='Select a project or lead'
                  searchPlaceholder='Search projects and leads…'
                  emptyMessage='No projects or leads found.'
                  disabled={disabled}
                  // Clearing leaves neither: the schema's "Choose a project
                  // or a lead" stops the save.
                  onClear={() => {
                    field.onChange(null)
                    form.setValue('leadId', null, { shouldDirty: true })
                  }}
                  record={{
                    icon: ENTITY_ICONS[home.leadId ? 'lead' : 'project'],
                    entityLabel: home.leadId ? 'lead' : 'project',
                    onOpen: openable
                      ? () =>
                          home.leadId
                            ? open('lead', home.leadId)
                            : home.projectId && open('project', home.projectId)
                      : undefined,
                  }}
                />
              </DisabledFieldTooltip>
            </FormControl>
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}

/**
 * Empty, the label offers both ("[icon] Project or [icon] Lead"); filled, it
 * names only the kind picked, so a saved task reads at a glance. The icons
 * flow in the text (`EntityLabelIcon`), so the spacing is a word space.
 */
function TaskHomeLabel({ kind }: { kind: 'project' | 'lead' | null }) {
  return (
    <>
      {kind !== 'lead' ? <EntityLabelIcon entity='project' /> : null}
      {kind !== 'lead' ? 'Project' : null}
      {kind === null ? ' or ' : null}
      {kind !== 'project' ? <EntityLabelIcon entity='lead' /> : null}
      {kind !== 'project' ? 'Lead' : null}
    </>
  )
}
