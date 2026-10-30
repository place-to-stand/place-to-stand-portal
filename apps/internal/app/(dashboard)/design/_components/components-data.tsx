'use client'

import { useMemo, useState } from 'react'
import { Star } from 'lucide-react'

import { Badge } from '@pts/ui/badge'
import { Button } from '@pts/ui/button'
import { RowActionButton } from '@pts/ui/row-action-button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pts/ui/table'
import { ClientBadge } from '@/components/clients/client-badge'
import {
  CompanyRecordRow,
  ContactRecordRow,
  LeadRecordRow,
} from '@/components/sheets/entity-record-rows'
import { LinkedRecordCard } from '@/components/sheets/linked-record-card'
import {
  SheetRecordList,
  SheetRecordRow,
} from '@/components/sheets/sheet-record-row'
import { EmptyValue } from '@/components/table/empty-value'
import {
  RecordRowAction,
  RecordRowActions,
} from '@/components/table/record-row-action'
import { FilterBar } from '@/components/table-toolbar/filter-bar'
import { FilterSelect } from '@/components/table-toolbar/filter-select'
import { SearchInput } from '@/components/table-toolbar/search-input'
import { SortableTableHead } from '@/components/table-toolbar/sortable-table-head'
import { LinkedRecordsHoverCell } from '@/components/ui/linked-records-hover-cell'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { RecordRowButton } from '@/components/ui/record-row-button'
import { TruncationTooltip } from '@/components/ui/truncation-tooltip'
import { PersonAvatar, UserAvatar } from '@/components/ui/user-avatar'
import { ENTITY_ACCENTS, ENTITY_ICONS } from '@/lib/entity-accents'
import { cn } from '@/lib/utils'
import { getProjectStatusLabel, getProjectStatusToken } from '@/lib/constants'

import { DesignSection, Example, Specimen } from './specimen'

const AVATAR_SIZES = ['xs', 'sm', 'md', 'lg'] as const

export function ComponentsAvatars() {
  return (
    <DesignSection
      id='avatars'
      title='Avatars'
      when='A person is their photo, falling back to initials. Pick a size; the initials scale with it. In dense table cells, PersonAvatar shows just the face and names it in a tooltip.'
    >
      <Specimen
        label='UserAvatar and PersonAvatar'
        note='components/ui/user-avatar'
        className='grid grid-cols-1 gap-6 sm:grid-cols-2'
      >
        <Example caption="UserAvatar size='xs' | 'sm' | 'md' | 'lg'">
          {AVATAR_SIZES.map(size => (
            <UserAvatar
              key={size}
              name='Ada Lovelace'
              hasPhoto={false}
              size={size}
            />
          ))}
        </Example>
        <Example caption='PersonAvatar: a stack in a table cell (hover)'>
          <span className='flex -space-x-1.5 [&>span]:rounded-full [&>span]:ring-2 [&>span]:ring-[var(--card)]'>
            {['Ada Lovelace', 'Grace Hopper', 'Alan Turing'].map(name => (
              <PersonAvatar key={name} name={name} hasPhoto={false} />
            ))}
          </span>
        </Example>
      </Specimen>
    </DesignSection>
  )
}

export function ComponentsRecordRows() {
  const [starred, setStarred] = useState(true)
  return (
    <DesignSection
      id='record-rows'
      title='Record rows'
      when='A record inside a sheet list or widget: the entity’s icon, its name, one muted detail line and trailing actions. Every list of people, companies or leads uses the same row so they read the same everywhere.'
    >
      <Specimen
        label='Entity preview rows'
        note='components/sheets/entity-record-rows (clicks off here; in the app a row opens its sheet)'
        className='grid grid-cols-1 gap-6 lg:grid-cols-2'
      >
        <SheetRecordList>
          <ContactRecordRow
            contact={{
              id: 'design-ada',
              name: 'Ada Lovelace',
              email: 'ada@acme.com',
              jobTitle: 'Head of product',
            }}
            openable={false}
            actions={
              <RowActionButton
                label={
                  starred ? 'Unset primary contact' : 'Set primary contact'
                }
                icon={<Star className={cn(starred && 'fill-current')} />}
                onClick={() => setStarred(value => !value)}
              />
            }
          />
          <ContactRecordRow
            contact={{
              id: 'design-grace',
              name: 'Grace Hopper',
              email: 'grace@cobalt.co',
            }}
            note='Pending save'
            openable={false}
          />
          <CompanyRecordRow
            company={{ id: 'design-acme', name: 'Acme Industries' }}
            titleAddon={<ClientBadge />}
            linked
            openable={false}
          />
          <LeadRecordRow
            lead={{
              id: 'design-lead',
              contactName: 'Northwind redesign',
              status: 'PROPOSAL_SENT',
              assigneeName: 'Jason D.',
            }}
            openable={false}
          />
        </SheetRecordList>
        <div className='space-y-4'>
          <SheetRecordRow
            leading={<UserAvatar name='Alan Turing' hasPhoto={false} />}
            title='Alan Turing'
            description='SheetRecordRow with an avatar in place of the icon'
          />
          <LinkedRecordCard
            icon={ENTITY_ICONS.user}
            title='ada@acme.com'
            description='Sign-in · Sales'
            details={[
              { label: 'Last sign-in', value: 'Sep 23, 2026' },
              { label: 'Status', value: 'Active' },
            ]}
            action={
              <Button type='button' variant='outline' size='sm'>
                Open sign-in
              </Button>
            }
          />
          <div className='rounded-lg border'>
            <RecordRowButton
              title='Ship pricing page'
              subtitle='Website rebuild · Due Sep 30, 2026'
              trailing={
                <Badge
                  variant='outline'
                  className={getProjectStatusToken('ACTIVE')}
                >
                  In progress
                </Badge>
              }
              onClick={() => undefined}
              className='rounded-t-lg'
            />
            <RecordRowButton
              title='Book the design review'
              subtitle='RecordRowButton · widget lists'
              onClick={() => undefined}
              className='rounded-b-lg border-t'
            />
          </div>
        </div>
      </Specimen>
    </DesignSection>
  )
}

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ON_HOLD', label: 'On hold' },
  { value: 'COMPLETED', label: 'Completed' },
]

type SampleProject = {
  name: string
  company: string
  status: 'ACTIVE' | 'ON_HOLD' | 'COMPLETED'
  hours: number
  people: string[]
  due: string | null
}

const PROJECTS: SampleProject[] = [
  {
    name: 'Website rebuild',
    company: 'Acme Industries',
    status: 'ACTIVE',
    hours: 32.5,
    people: ['Ada Lovelace', 'Grace Hopper'],
    due: 'Oct 31, 2026',
  },
  {
    name: 'Brand refresh and a much longer name that truncates',
    company: 'Birchwood Labs',
    status: 'ON_HOLD',
    hours: 12,
    people: [],
    due: null,
  },
  {
    name: 'App migration',
    company: 'Cobalt & Co',
    status: 'ACTIVE',
    hours: 58.25,
    people: ['Alan Turing'],
    due: 'Dec 12, 2026',
  },
  {
    name: 'Pricing page',
    company: 'Acme Industries',
    status: 'COMPLETED',
    hours: 8,
    people: ['Ada Lovelace'],
    due: 'Aug 2, 2026',
  },
]

/** The list page body: toolbar, a fixed-layout sortable table, pagination. */
export function SampleProjectList({
  density = 'default',
}: {
  density?: 'default' | 'compact'
}) {
  const [search, setSearch] = useState<string | undefined>()
  const [statuses, setStatuses] = useState<string[]>([])
  const [sort, setSort] = useState<string | undefined>()
  const [page, setPage] = useState(1)

  const rows = useMemo(() => {
    const query = search?.toLowerCase() ?? ''
    const filtered = PROJECTS.filter(
      row =>
        (!query ||
          row.name.toLowerCase().includes(query) ||
          row.company.toLowerCase().includes(query)) &&
        (!statuses.length || statuses.includes(row.status))
    )
    const [field, direction] = (sort ?? 'name:asc').split(':')
    const sign = direction === 'desc' ? -1 : 1
    return [...filtered].sort((a, b) =>
      field === 'hours'
        ? (a.hours - b.hours) * sign
        : a.name.localeCompare(b.name) * sign
    )
  }, [search, statuses, sort])

  const filtered = Boolean(search) || statuses.length > 0

  return (
    <div className='space-y-3'>
      <FilterBar
        search={
          <SearchInput
            value={search}
            onCommit={setSearch}
            placeholder='Search projects…'
          />
        }
        activeFilterCount={statuses.length ? 1 : 0}
        showReset={filtered}
        onReset={() => {
          setSearch(undefined)
          setStatuses([])
        }}
      >
        <FilterSelect
          mode='multi'
          values={statuses}
          onChange={setStatuses}
          placeholder='Status'
          options={STATUS_OPTIONS}
        />
      </FilterBar>
      <div className='overflow-hidden rounded-lg border'>
        <Table
          density={density}
          layout='fixed'
          stack
          className='md:min-w-[40rem]'
        >
          <TableHeader>
            <TableRow className='bg-muted/40'>
              <SortableTableHead
                field='name'
                sort={sort}
                defaultSort='name:asc'
                onSortChange={setSort}
                className='w-[38%]'
              >
                Project
              </SortableTableHead>
              <TableHead className='w-[22%]'>Company</TableHead>
              <TableHead className='w-[14%]'>Status</TableHead>
              <TableHead className='w-[10%]'>People</TableHead>
              <SortableTableHead
                field='hours'
                sort={sort}
                defaultSort='name:asc'
                onSortChange={setSort}
                className='w-[8%]'
              >
                Hours
              </SortableTableHead>
              <TableHead className='w-[8%] text-right'>
                <span className='sr-only'>Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              <TableRow className='hover:bg-transparent'>
                {/* A group row: one cell across, the shared height. */}
                <TableCell
                  colSpan={6}
                  className={cn(ENTITY_ACCENTS.client.tint, 'max-md:px-3')}
                >
                  <span className='flex items-center gap-2 text-sm font-semibold'>
                    <ENTITY_ICONS.client
                      className={cn(ENTITY_ACCENTS.client.icon, 'size-4')}
                      aria-hidden
                    />
                    Acme Industries
                  </span>
                </TableCell>
              </TableRow>
            ) : null}
            {rows.length ? (
              rows.map(row => (
                <TableRow key={row.name}>
                  <TableCell>
                    <span className='flex min-w-0 items-center gap-2'>
                      <ENTITY_ICONS.project
                        className={cn(
                          ENTITY_ACCENTS.project.icon,
                          'size-4 shrink-0'
                        )}
                        aria-hidden
                      />
                      <TruncationTooltip content={row.name}>
                        <span className='truncate font-medium'>{row.name}</span>
                      </TruncationTooltip>
                    </span>
                  </TableCell>
                  <TableCell label='Company' className='truncate'>
                    {row.company}
                  </TableCell>
                  <TableCell label='Status'>
                    <Badge
                      variant='outline'
                      className={cn(
                        'text-xs',
                        getProjectStatusToken(row.status)
                      )}
                    >
                      {getProjectStatusLabel(row.status)}
                    </Badge>
                  </TableCell>
                  <TableCell label='People'>
                    <LinkedRecordsHoverCell
                      count={row.people.length}
                      items={row.people.map(name => ({
                        id: name,
                        label: name,
                        sublabel: 'Member',
                      }))}
                      icon={ENTITY_ICONS.contact}
                      ariaLabel={`${row.people.length} people on ${row.name}`}
                    />
                  </TableCell>
                  <TableCell label='Hours' className='tabular-nums'>
                    {row.hours}
                  </TableCell>
                  <TableCell className='max-md:ml-auto'>
                    <RecordRowActions>
                      <RecordRowAction
                        kind='archive'
                        entity='project'
                        onClick={() => undefined}
                      />
                    </RecordRowActions>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className='text-muted-foreground h-24 text-center'
                >
                  No matching projects.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <PaginationControls
        mode='paged'
        currentPage={page}
        totalPages={5}
        totalItems={118}
        pageSize={25}
        onPageChange={setPage}
      />
    </div>
  )
}

export function ComponentsTables() {
  return (
    <DesignSection
      id='tables'
      title='Tables and toolbar'
      when='Lists of records. Search first, then filters inline (a Filters sheet on phones). Sortable tables use layout="fixed" with a width on every header; rows stack into cards below md. A missing value is an em dash. One row height for every list, group rows included: the shared TableCell sets it (a 28px content box: 41px compact, 45px default); never pad or size a cell to change it.'
    >
      <Specimen
        label='List: FilterBar, sortable fixed table, row actions, pagination'
        note='Try the search, the status filter, the sort heads and a phone width'
        className='block'
      >
        <SampleProjectList />
      </Specimen>
      <Specimen
        label="density='compact'"
        note='Reports and dense sheet tables'
        bleed
      >
        <Table density='compact'>
          <TableHeader>
            <TableRow className='bg-muted/40'>
              <TableHead>Company</TableHead>
              <TableHead>Billing</TableHead>
              <TableHead className='text-right'>Hours left</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>
                <span className='flex items-center gap-2'>
                  <ENTITY_ICONS.company
                    className={cn(ENTITY_ACCENTS.company.icon, 'size-4')}
                    aria-hidden
                  />
                  Acme Industries <ClientBadge />
                </span>
              </TableCell>
              <TableCell>Prepaid</TableCell>
              <TableCell className='text-success text-right tabular-nums'>
                12.5
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>
                <span className='flex items-center gap-2'>
                  <ENTITY_ICONS.company
                    className={cn(ENTITY_ACCENTS.company.icon, 'size-4')}
                    aria-hidden
                  />
                  Birchwood Labs
                </span>
              </TableCell>
              <TableCell>
                <EmptyValue />
              </TableCell>
              <TableCell className='text-destructive text-right tabular-nums'>
                -3.0
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Specimen>
      <Specimen label='PaginationControls: cursor mode' className='block'>
        <PaginationControls
          hasNextPage
          hasPreviousPage
          onNext={() => undefined}
          onPrevious={() => undefined}
        />
      </Specimen>
    </DesignSection>
  )
}
