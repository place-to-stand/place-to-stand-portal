'use client'

import Link from 'next/link'
import {
  CircleDashed,
  Filter,
  Loader2,
  PenSquare,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import type { InboxView } from './inbox-sidebar'

type Client = { id: string; name: string; slug: string | null }
type Project = { id: string; name: string; slug: string | null; clientId: string | null; clientSlug: string | null; type: 'CLIENT' | 'PERSONAL' | 'INTERNAL'; ownerId: string | null; createdBy: string | null }
type Lead = { id: string; contactName: string }

interface InboxToolbarProps {
  currentView: InboxView
  onViewChange: (view: InboxView) => void
  searchInput: string
  onSearchInputChange: (value: string) => void
  isSearching: boolean
  onClearSearch: () => void
  isConnected: boolean
  onCompose: () => void
  unclassifiedCount?: number
  clients?: Client[]
  projects?: Project[]
  leads?: Lead[]
  filterClientId?: string
  filterProjectId?: string
  filterProjectType?: 'CLIENT' | 'INTERNAL' | 'PERSONAL'
  filterLeadId?: string
  currentUserId?: string
  isFilterPending?: boolean
  onFilterChange?: (key: 'client' | 'project' | 'projectType' | 'lead', value: string | undefined) => void
  onClearFilters?: () => void
}

/** Strip operator tokens from the search string for display */
function getDisplayText(query: string): string {
  return query.replace(/\s*(has:attachment|is:unread)\s*/g, ' ').trim()
}

/** Extract operator tokens from the full search string */
function getOperators(query: string): { hasAttachment: boolean; isUnread: boolean } {
  return {
    hasAttachment: query.includes('has:attachment'),
    isUnread: query.includes('is:unread'),
  }
}

/** Rebuild the full search string from display text and operator flags */
function buildSearchString(text: string, hasAttachment: boolean, isUnread: boolean): string {
  const parts = [text.trim()]
  if (hasAttachment) parts.push('has:attachment')
  if (isUnread) parts.push('is:unread')
  return parts.filter(Boolean).join(' ')
}

// Sentinel values for Radix Select (doesn't allow empty string)
const ALL = '__all__'
const TYPE_CLIENT = '__type_CLIENT__'
const TYPE_INTERNAL = '__type_INTERNAL__'
const TYPE_PERSONAL = '__type_PERSONAL__'

export function InboxToolbar({
  currentView,
  onViewChange,
  searchInput,
  onSearchInputChange,
  isSearching,
  isConnected,
  onCompose,
  unclassifiedCount,
  clients,
  projects,
  leads,
  filterClientId,
  filterProjectId,
  filterProjectType,
  filterLeadId,
  currentUserId,
  isFilterPending,
  onFilterChange,
  onClearFilters,
}: InboxToolbarProps) {
  const displayText = getDisplayText(searchInput)
  const { hasAttachment, isUnread } = getOperators(searchInput)

  const hasActiveFilter = !!(filterClientId || filterProjectId || filterProjectType || filterLeadId || hasAttachment || isUnread)

  // Compute current project select value from the two possible filter modes
  const projectSelectValue = filterProjectId
    ? filterProjectId
    : filterProjectType === 'CLIENT' ? TYPE_CLIENT
    : filterProjectType === 'INTERNAL' ? TYPE_INTERNAL
    : filterProjectType === 'PERSONAL' ? TYPE_PERSONAL
    : ALL

  // Handle project dropdown change — route to either projectType or specific project
  const handleProjectChange = (v: string) => {
    if (!onFilterChange) return
    if (v === ALL) {
      // Clearing project also clears projectType in the handler
      onFilterChange('project', undefined)
    } else if (v === TYPE_CLIENT) {
      onFilterChange('projectType', 'CLIENT')
    } else if (v === TYPE_INTERNAL) {
      onFilterChange('projectType', 'INTERNAL')
    } else if (v === TYPE_PERSONAL) {
      onFilterChange('projectType', 'PERSONAL')
    } else {
      onFilterChange('project', v)
    }
  }

  // Filter projects based on selected client
  const visibleProjects = projects?.filter(p => {
    if (filterClientId) return p.clientId === filterClientId
    return true
  }) ?? []

  const clientProjects = visibleProjects.filter(p => p.type === 'CLIENT')
  const internalProjects = visibleProjects.filter(p => p.type === 'INTERNAL')
  const personalProjects = visibleProjects.filter(p => p.type === 'PERSONAL' && currentUserId && (p.ownerId ?? p.createdBy) === currentUserId)

  const showFilters = onFilterChange && clients && projects && leads

  const filterTriggerCls = 'h-9 text-xs'

  return (
    <div className='flex flex-wrap items-center gap-3'>
      {/* Mobile-only view dropdown */}
      <Select
        value={currentView}
        onValueChange={onViewChange}
      >
        <SelectTrigger className='w-40 md:hidden'>
          <span className='flex items-center'>
            <Filter className='mr-2 h-4 w-4' />
            <SelectValue />
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='inbox'>All Emails</SelectItem>
          <SelectItem value='sent'>Sent</SelectItem>
          <SelectItem value='drafts'>Drafts</SelectItem>
          <SelectItem value='unclassified'>Unclassified</SelectItem>
          <SelectItem value='classified'>Classified</SelectItem>
          <SelectItem value='dismissed'>Dismissed</SelectItem>
        </SelectContent>
      </Select>

      {/* Search Input */}
      <div className='relative min-w-0 max-w-64 flex-1'>
        {isSearching ? (
          <RefreshCw className='text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin' />
        ) : (
          <Search className='text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2' />
        )}
        <Input
          type='text'
          placeholder='Search emails...'
          value={displayText}
          onChange={e => onSearchInputChange(buildSearchString(e.target.value, hasAttachment, isUnread))}
          className='h-9 pl-10 pr-9'
        />
        {displayText && (
          <button
            type='button'
            onClick={() => onSearchInputChange(buildSearchString('', hasAttachment, isUnread))}
            className='text-muted-foreground hover:text-foreground absolute right-3 top-1/2 -translate-y-1/2'
          >
            <X className='h-4 w-4' />
            <span className='sr-only'>Clear search</span>
          </button>
        )}
      </div>

      {/* Entity filter dropdowns — inline with search */}
      {showFilters && (
        <>
          {/* Client filter */}
          <Select
            value={filterClientId ?? ALL}
            onValueChange={v => onFilterChange('client', v === ALL ? undefined : v)}
          >
            <SelectTrigger className={cn(filterTriggerCls, 'w-36')}>
              <SelectValue placeholder='All clients' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All clients</SelectItem>
              {clients.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Project filter (with type-level options) */}
          <Select
            value={projectSelectValue}
            onValueChange={handleProjectChange}
          >
            <SelectTrigger className={cn(filterTriggerCls, 'w-40')}>
              <SelectValue placeholder='All projects' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All projects</SelectItem>
              {!filterClientId && (
                <>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel className='text-xs'>By type</SelectLabel>
                    <SelectItem value={TYPE_CLIENT}>All client projects</SelectItem>
                    <SelectItem value={TYPE_INTERNAL}>All internal projects</SelectItem>
                    <SelectItem value={TYPE_PERSONAL}>All personal projects</SelectItem>
                  </SelectGroup>
                </>
              )}
              {clientProjects.length > 0 && (
                <>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel className='text-xs'>Client</SelectLabel>
                    {clientProjects.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectGroup>
                </>
              )}
              {internalProjects.length > 0 && (
                <>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel className='text-xs'>Internal</SelectLabel>
                    {internalProjects.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectGroup>
                </>
              )}
              {personalProjects.length > 0 && (
                <>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel className='text-xs'>Personal</SelectLabel>
                    {personalProjects.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectGroup>
                </>
              )}
            </SelectContent>
          </Select>

          {/* Lead filter */}
          <Select
            value={filterLeadId ?? ALL}
            onValueChange={v => onFilterChange('lead', v === ALL ? undefined : v)}
          >
            <SelectTrigger className={cn(filterTriggerCls, 'w-36')}>
              <SelectValue placeholder='All leads' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All leads</SelectItem>
              {leads.map(l => (
                <SelectItem key={l.id} value={l.id}>{l.contactName}</SelectItem>
              ))}
            </SelectContent>
          </Select>

        </>
      )}

      {/* Quick Search Filters */}
      {isConnected && (
        <div className='hidden items-center gap-4 xl:flex'>
          <div className='flex items-center gap-2'>
            <Checkbox
              id='filter-attachment'
              checked={hasAttachment}
              onCheckedChange={checked => {
                onSearchInputChange(buildSearchString(displayText, !!checked, isUnread))
              }}
            />
            <Label htmlFor='filter-attachment' className='text-sm font-normal cursor-pointer'>
              Has attachment
            </Label>
          </div>
          <div className='flex items-center gap-2'>
            <Checkbox
              id='filter-unread'
              checked={isUnread}
              onCheckedChange={checked => {
                onSearchInputChange(buildSearchString(displayText, hasAttachment, !!checked))
              }}
            />
            <Label htmlFor='filter-unread' className='text-sm font-normal cursor-pointer'>
              Unread
            </Label>
          </div>
        </div>
      )}

      {/* Right side - clear + unclassified indicator + compose */}
      <div className='ml-auto flex min-w-0 flex-shrink-0 items-center gap-3'>
        {hasActiveFilter && onClearFilters && (
          isFilterPending ? (
            <Loader2 className='text-muted-foreground h-3.5 w-3.5 animate-spin' />
          ) : (
            <button
              type='button'
              onClick={() => {
                onClearFilters()
                // Also clear search operator checkboxes
                if (hasAttachment || isUnread) {
                  onSearchInputChange(buildSearchString(displayText, false, false))
                }
              }}
              className='text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors'
            >
              <X className='h-3 w-3' />
              Clear filters
            </button>
          )
        )}
        {unclassifiedCount !== undefined && unclassifiedCount > 0 && (
          <Link
            href='/my/communications/triage'
            className='text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors'
          >
            <CircleDashed className='h-3.5 w-3.5 text-yellow-500' />
            <span>{unclassifiedCount} unclassified</span>
          </Link>
        )}
        {isConnected && (
          <Button
            size='sm'
            onClick={onCompose}
          >
            <PenSquare className='h-4 w-4' />
            Compose
          </Button>
        )}
      </div>
    </div>
  )
}
