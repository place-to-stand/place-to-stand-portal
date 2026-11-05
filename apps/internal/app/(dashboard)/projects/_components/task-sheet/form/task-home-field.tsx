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
import { OpenRecordButton } from '@/components/ui/open-record-button'
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
 * clears the other. The button on the right opens the picked record, stacked
 * as its sheet.
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
        const selected = items.find(item => item.value === value) ?? null
        const home = decodeTaskHome(value)
        const openable = home.leadId !== null || canOpenProject

        return (
          <FormItem>
            <FormLabel className='gap-1'>
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
                  trailingAction={
                    selected && openable ? (
                      <OpenRecordButton
                        name={selected.label}
                        entityLabel={home.leadId ? 'lead' : 'project'}
                        onOpen={() =>
                          home.leadId
                            ? open('lead', home.leadId)
                            : home.projectId && open('project', home.projectId)
                        }
                      />
                    ) : null
                  }
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

/** An entity's icon right before its name, as on every picker label. */
function EntityName({ entity }: { entity: 'project' | 'lead' }) {
  return (
    <span className='inline-flex items-center gap-2'>
      <EntityLabelIcon entity={entity} />
      {entity === 'project' ? 'Project' : 'Lead'}
    </span>
  )
}

/**
 * Empty, the label offers both ("[icon] Project or [icon] Lead"); filled, it
 * names only the kind picked, so a saved task reads at a glance.
 */
function TaskHomeLabel({ kind }: { kind: 'project' | 'lead' | null }) {
  if (kind) return <EntityName entity={kind} />
  return (
    <>
      <EntityName entity='project' />
      or
      <EntityName entity='lead' />
    </>
  )
}
