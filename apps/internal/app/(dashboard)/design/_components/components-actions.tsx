'use client'

import { useState } from 'react'
import { Loader2, Plus, Send, Trash2 } from 'lucide-react'

import { Badge } from '@pts/ui/badge'
import { BADGE_TINTS, type BadgeTint } from '@pts/ui/badge-tints'
import { Button } from '@pts/ui/button'
import { RowActionButton } from '@pts/ui/row-action-button'
import { RoleBadge } from '@/components/auth/role-badge'
import { BillingTypeBadge } from '@/components/billing/billing-type-badge'
import { LeadStatusBadge } from '@/components/leads/lead-status-badge'
import { ProjectStatusCell } from '@/components/projects/project-status-cell'
import { EntityList } from '@/components/sheets/entity-list'
import { InlineReveal } from '@/components/ui/inline-reveal'
import {
  RecordRowAction,
  RecordRowActions,
} from '@/components/table/record-row-action'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { InvoiceStatusBadge } from '@/app/(dashboard)/invoices/_components/invoice-status-badge'
import { ROLE_LABELS } from '@/lib/auth/roles'
import { ProjectStatusBadge } from '@/components/projects/project-status-badge'
import {
  PROJECT_STATUS_OPTIONS,
  type ProjectStatusValue,
} from '@/lib/constants'
import { LEAD_STATUS_VALUES } from '@/lib/leads/constants'
import {
  getTaskStatusLabel,
  getTaskStatusToken,
} from '@/lib/projects/task-status'
import { cn } from '@/lib/utils'

import { Code, DesignSection, Example, Specimen } from './specimen'

const VARIANTS = [
  'default',
  'outline',
  'secondary',
  'ghost',
  'destructive',
  'link',
] as const
const SIZES = ['xs', 'sm', 'default', 'lg'] as const
const ICON_SIZES = ['icon-sm', 'icon', 'icon-lg'] as const

const TASK_STATUSES = [
  'ON_DECK',
  'IN_PROGRESS',
  'BLOCKED',
  'DONE',
  'ACCEPTED',
  'ARCHIVED',
] as const

const INVOICE_STATUSES = ['DRAFT', 'SENT', 'VIEWED', 'PAID', 'VOID'] as const

const ROLES = Object.keys(ROLE_LABELS) as Array<keyof typeof ROLE_LABELS>

export function ComponentsButtons() {
  const [saving, setSaving] = useState(false)

  return (
    <DesignSection
      id='buttons'
      title='Buttons'
      when='One primary (default) Button per view, for the thing the view is for. Outline and ghost for everything else; destructive names what it destroys. Icons go first and the built-in gap spaces them.'
    >
      <Specimen label='Variants × sizes' bleed>
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead className='bg-muted/40 text-muted-foreground border-b text-xs'>
              <tr>
                <th className='px-5 py-2 text-left font-medium'>variant</th>
                {SIZES.map(size => (
                  <th key={size} className='px-3 py-2 text-left font-medium'>
                    {size}
                  </th>
                ))}
                <th className='px-3 py-2 text-left font-medium'>icon sizes</th>
                <th className='px-3 py-2 text-left font-medium'>disabled</th>
              </tr>
            </thead>
            <tbody className='divide-y'>
              {VARIANTS.map(variant => (
                <tr key={variant}>
                  <td className='px-5 py-3'>
                    <Code>{variant}</Code>
                  </td>
                  {SIZES.map(size => (
                    <td key={size} className='px-3 py-3'>
                      <Button variant={variant} size={size}>
                        {variant === 'destructive' ? 'Archive' : 'Save'}
                      </Button>
                    </td>
                  ))}
                  <td className='px-3 py-3'>
                    <span className='flex items-center gap-2'>
                      {ICON_SIZES.map(size => (
                        <Button
                          key={size}
                          variant={variant}
                          size={size}
                          aria-label={`Add (${size})`}
                        >
                          <Plus />
                        </Button>
                      ))}
                    </span>
                  </td>
                  <td className='px-3 py-3'>
                    <Button variant={variant} disabled>
                      Save
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Specimen>

      <Specimen
        label='States and composition'
        className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3'
      >
        <Example caption='icon first, no margin classes'>
          <Button>
            <Plus />
            Create lead
          </Button>
          <Button variant='outline'>
            <Send />
            Send invoice
          </Button>
        </Example>
        <Example caption='loading: spinner + disabled + "…ing" label'>
          <Button
            disabled={saving}
            onClick={() => {
              setSaving(true)
              window.setTimeout(() => setSaving(false), 1500)
            }}
          >
            {saving ? <Loader2 className='animate-spin' /> : null}
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </Example>
        <Example caption='disabled with a reason (DisabledFieldTooltip)'>
          <DisabledFieldTooltip
            disabled
            reason='Add a billing email before sending.'
            className='w-auto'
          >
            <Button disabled>
              <Send />
              Send invoice
            </Button>
          </DisabledFieldTooltip>
        </Example>
        <Example caption='EntityList: the + only comes with its list (empty: clickable; locked: disabled with a reason)'>
          <div className='grid w-full gap-6 sm:grid-cols-2'>
            <EntityList
              title='People'
              add={{ label: 'Add person', onAdd: noop }}
              isEmpty
              emptyMessage='No people here yet.'
            />
            <EntityList
              title='Projects'
              add={{
                label: 'Create project',
                disabledReason: 'Save the company first.',
              }}
              isEmpty
              emptyMessage='Add projects after you save the company.'
            />
            <InlineFormExample />
          </div>
        </Example>
        <Example caption='RowActionButton: icon-only, real tooltip'>
          <RowActionButton label='Delete attachment' icon={<Trash2 />} />
          <RowActionButton label='Add task' icon={<Plus />} variant='outline' />
        </Example>
        <Example caption='RecordRowAction: fixed icon, colour and wording'>
          <RecordRowActions>
            <RecordRowAction kind='edit' entity='company' onClick={noop} />
            <RecordRowAction kind='preview' onClick={noop} />
            <RecordRowAction kind='promote' onClick={noop} />
            <RecordRowAction kind='restore' entity='company' onClick={noop} />
            <RecordRowAction kind='archive' entity='company' onClick={noop} />
            <RecordRowAction
              kind='archive'
              entity='company'
              onClick={noop}
              pending
            />
          </RecordRowActions>
        </Example>
      </Specimen>
    </DesignSection>
  )
}

export function ComponentsBadges() {
  const [projectStatus, setProjectStatus] =
    useState<ProjectStatusValue>('ACTIVE')

  return (
    <DesignSection
      id='badges'
      title='Badges'
      when='One badge, two looks. Status (a state that changes) is a soft tinted fill: an outline Badge with a BADGE_TINTS hue, mapped once per domain. Label (what something is: Client, a role) is an outline with no fill; an entity state carries its icon. Every badge is the same size and weight, in caps with a little letter-spacing (set by the component); lint fails on case, tracking, weight or size overrides.'
    >
      <Specimen label='Variants' note='@pts/ui/badge'>
        <Badge>Default</Badge>
        <Badge variant='secondary'>Secondary</Badge>
        <Badge variant='outline'>Outline</Badge>
        <Badge variant='destructive'>Overdue</Badge>
      </Specimen>

      <Specimen
        label='Tints'
        note='BADGE_TINTS (@pts/ui/badge-tints): 100 fill + 800 ink in light, 900/40 + 200 in dark'
      >
        {(Object.keys(BADGE_TINTS) as BadgeTint[]).map(tint => (
          <Badge key={tint} variant='outline' className={BADGE_TINTS[tint]}>
            {tint}
          </Badge>
        ))}
      </Specimen>

      <Specimen
        label='Domain badges'
        className='grid grid-cols-1 gap-6 md:grid-cols-2'
      >
        <Example caption='Status: CompanyBillingMark, a company billed now (admins only; nothing for Sales)'>
          <BillingTypeBadge billingType='prepaid' />
          <BillingTypeBadge billingType='net_30' />
        </Example>
        <Example caption='Status: RoleBadge, a sign-in role. Grey with its state when switched off or archived'>
          {ROLES.map(role => (
            <RoleBadge key={role} role={role} />
          ))}
          <RoleBadge role='SALES' state='off' />
        </Example>
        <Example caption='Status: LeadStatusBadge'>
          {LEAD_STATUS_VALUES.map(status => (
            <LeadStatusBadge key={status} status={status} />
          ))}
        </Example>
        <Example caption='Status: ProjectStatusBadge · ProjectStatusCell (click to change)'>
          {PROJECT_STATUS_OPTIONS.map(option => (
            <ProjectStatusBadge key={option.value} status={option.value} />
          ))}
          <ProjectStatusCell
            projectId='design-sample'
            status={projectStatus}
            variant='standalone'
            onStatusChange={async (_id, next) => setProjectStatus(next)}
          />
        </Example>
        <Example caption='Status: task'>
          {TASK_STATUSES.map(status => (
            <Badge
              key={status}
              variant='outline'
              className={cn(getTaskStatusToken(status))}
            >
              {getTaskStatusLabel(status)}
            </Badge>
          ))}
        </Example>
        <Example caption='Status: InvoiceStatusBadge'>
          {INVOICE_STATUSES.map(status => (
            <InvoiceStatusBadge key={status} status={status} />
          ))}
        </Example>
      </Specimen>
    </DesignSection>
  )
}

function noop() {}

/** EntityList with an inline form: the + turns into an X while it's open. */
function InlineFormExample() {
  const [open, setOpen] = useState(false)
  return (
    <EntityList
      title='Comments'
      add={{ label: 'Add comment', onAdd: () => setOpen(true) }}
      inlineForm={
        <InlineReveal open={open}>
          <div className='pb-2'>
            <div className='bg-card flex justify-end gap-2 rounded-lg border p-3'>
              <Button variant='outline' onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setOpen(false)}>Comment</Button>
            </div>
          </div>
        </InlineReveal>
      }
      inlineFormOpen={open}
      onInlineFormClose={() => setOpen(false)}
      isEmpty
      emptyMessage='No comments yet.'
    />
  )
}
