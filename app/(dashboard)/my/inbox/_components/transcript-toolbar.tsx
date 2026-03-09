'use client'

import Link from 'next/link'
import {
  CircleDashed,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
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

import type { TranscriptView } from './transcript-sidebar'

type Client = { id: string; name: string; slug: string | null }
type Project = {
  id: string
  name: string
  slug: string | null
  clientId: string | null
  type: 'CLIENT' | 'PERSONAL' | 'INTERNAL'
  ownerId: string | null
  createdBy: string | null
}
type Lead = { id: string; contactName: string }

interface TranscriptToolbarProps {
  currentView: TranscriptView
  onViewChange: (view: string) => void
  searchInput: string
  onSearchInputChange: (value: string) => void
  isSearching: boolean
  onClearSearch: () => void
  unclassifiedCount?: number
  clients?: Client[]
  projects?: Project[]
  leads?: Lead[]
  filterClientId?: string
  filterProjectId?: string
  filterLeadId?: string
  currentUserId?: string
  isFilterPending?: boolean
  onFilterChange?: (key: 'client' | 'project' | 'lead', value: string | undefined) => void
  onClearFilters?: () => void
}

const ALL = '__all__'

export function TranscriptToolbar({
  currentView,
  onViewChange,
  searchInput,
  onSearchInputChange,
  isSearching,
  onClearSearch,
  unclassifiedCount,
  clients,
  projects,
  leads,
  filterClientId,
  filterProjectId,
  filterLeadId,
  currentUserId,
  isFilterPending,
  onFilterChange,
  onClearFilters,
}: TranscriptToolbarProps) {
  const hasActiveFilter = !!(filterClientId || filterProjectId || filterLeadId)

  // Filter projects based on selected client
  const visibleProjects = projects?.filter(p => {
    if (filterClientId) return p.clientId === filterClientId
    return true
  }) ?? []

  const clientProjects = visibleProjects.filter(p => p.type === 'CLIENT')
  const internalProjects = visibleProjects.filter(p => p.type === 'INTERNAL')
  const personalProjects = visibleProjects.filter(
    p => p.type === 'PERSONAL' && currentUserId && (p.ownerId ?? p.createdBy) === currentUserId
  )

  const showFilters = onFilterChange && clients && projects && leads

  const filterTriggerCls = 'h-9 text-xs'

  return (
    <div className='flex flex-wrap items-center gap-3'>
      {/* Mobile-only view dropdown */}
      <Select value={currentView} onValueChange={onViewChange}>
        <SelectTrigger className='w-40 md:hidden'>
          <span className='flex items-center'>
            <Filter className='mr-2 h-4 w-4' />
            <SelectValue />
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='inbox'>All Transcripts</SelectItem>
          <SelectItem value='unclassified'>Unclassified</SelectItem>
          <SelectItem value='classified'>Classified</SelectItem>
          <SelectItem value='dismissed'>Dismissed</SelectItem>
        </SelectContent>
      </Select>

      {/* Search */}
      <div className='relative min-w-0 max-w-64 flex-1'>
        {isSearching ? (
          <RefreshCw className='text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin' />
        ) : (
          <Search className='text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2' />
        )}
        <Input
          type='text'
          placeholder='Search transcripts...'
          value={searchInput}
          onChange={e => onSearchInputChange(e.target.value)}
          className='h-9 pl-10 pr-9'
        />
        {searchInput && (
          <button
            type='button'
            onClick={onClearSearch}
            className='text-muted-foreground hover:text-foreground absolute right-3 top-1/2 -translate-y-1/2'
          >
            <X className='h-4 w-4' />
            <span className='sr-only'>Clear search</span>
          </button>
        )}
      </div>

      {/* Entity filter dropdowns */}
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

          {/* Project filter */}
          <Select
            value={filterProjectId ?? ALL}
            onValueChange={v => onFilterChange('project', v === ALL ? undefined : v)}
          >
            <SelectTrigger className={cn(filterTriggerCls, 'w-40')}>
              <SelectValue placeholder='All projects' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All projects</SelectItem>
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

      {/* Right side */}
      <div className='ml-auto flex min-w-0 flex-shrink-0 items-center gap-3'>
        {hasActiveFilter && onClearFilters && (
          isFilterPending ? (
            <Loader2 className='text-muted-foreground h-3.5 w-3.5 animate-spin' />
          ) : (
            <button
              type='button'
              onClick={onClearFilters}
              className='text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors'
            >
              <X className='h-3 w-3' />
              Clear filters
            </button>
          )
        )}
        {unclassifiedCount !== undefined && unclassifiedCount > 0 && (
          <Link
            href='/my/inbox/transcripts/unclassified'
            className='text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors'
          >
            <CircleDashed className='h-3.5 w-3.5 text-yellow-500' />
            <span>{unclassifiedCount} unclassified</span>
          </Link>
        )}
      </div>
    </div>
  )
}
