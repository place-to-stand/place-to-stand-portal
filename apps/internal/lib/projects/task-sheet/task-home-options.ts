import type {
  SearchableComboboxGroup,
  SearchableComboboxItem,
} from '@/components/ui/searchable-combobox'
import { ENTITY_ICONS } from '@/lib/entity-accents'
import { LEAD_STATUS_LABELS } from '@/lib/leads/constants'
import type { TaskLead, TaskLeadOption } from '@/lib/types'

/**
 * The task sheet's one "Project or lead" field. A task lives on a project or
 * on a lead, never both, so one picker lists both (each option marked with
 * its entity's icon) and its value says which: `project:<id>` or
 * `lead:<id>`.
 */
export type TaskHomeValue = { projectId: string | null; leadId: string | null }

const PROJECT_PREFIX = 'project:'
const LEAD_PREFIX = 'lead:'

export const encodeTaskHome = ({ projectId, leadId }: TaskHomeValue) =>
  leadId
    ? `${LEAD_PREFIX}${leadId}`
    : projectId
      ? `${PROJECT_PREFIX}${projectId}`
      : ''

export const decodeTaskHome = (value: string): TaskHomeValue =>
  value.startsWith(LEAD_PREFIX)
    ? { projectId: null, leadId: value.slice(LEAD_PREFIX.length) }
    : value.startsWith(PROJECT_PREFIX)
      ? { projectId: value.slice(PROJECT_PREFIX.length), leadId: null }
      : { projectId: null, leadId: null }

type BuildTaskHomeOptionsArgs = {
  /** The project picker's own groups (`buildProjectSelectionOptions`). */
  projectGroups: SearchableComboboxGroup[]
  /** Null when the viewer can't put tasks on leads. */
  leads: TaskLeadOption[] | null
  /** The task's current lead, kept listed if it's no longer offered. */
  currentLead: TaskLead | null
  /**
   * Leads come first for people who mostly work leads (Sales), projects
   * first for everyone else.
   */
  leadsFirst: boolean
}

export function buildTaskHomeOptions({
  projectGroups,
  leads,
  currentLead,
  leadsFirst,
}: BuildTaskHomeOptionsArgs): {
  items: SearchableComboboxItem[]
  groups: SearchableComboboxGroup[]
} {
  const leadItems: SearchableComboboxItem[] = (leads ?? []).map(lead => ({
    value: `${LEAD_PREFIX}${lead.id}`,
    label: lead.name,
    description: lead.companyName ?? undefined,
    keywords: [
      lead.companyName,
      LEAD_STATUS_LABELS[lead.status],
      'lead',
    ].filter((keyword): keyword is string => Boolean(keyword)),
    icon: ENTITY_ICONS.lead,
  }))

  if (
    currentLead &&
    !leadItems.some(item => item.value === `${LEAD_PREFIX}${currentLead.id}`)
  ) {
    leadItems.unshift({
      value: `${LEAD_PREFIX}${currentLead.id}`,
      label: currentLead.name,
      icon: ENTITY_ICONS.lead,
      keywords: ['lead'],
    })
  }

  const projects = projectGroups.map(group => ({
    label: group.label,
    items: group.items.map(item => ({
      ...item,
      value: `${PROJECT_PREFIX}${item.value}`,
      icon: ENTITY_ICONS.project,
    })),
  }))

  const leadGroups = leadItems.length
    ? [{ label: 'Leads', items: leadItems }]
    : []
  const groups = leadsFirst
    ? [...leadGroups, ...projects]
    : [...projects, ...leadGroups]

  return { items: groups.flatMap(group => group.items), groups }
}
