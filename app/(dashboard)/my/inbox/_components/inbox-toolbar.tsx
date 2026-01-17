'use client'

import { formatDistanceToNow } from 'date-fns'
import {
  CheckCircle,
  Circle,
  Filter,
  PenSquare,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

import type { InboxView } from './inbox-sidebar'

type SyncStatus = {
  connected: boolean
  lastSyncAt: string | null
  unread: number
}

type Pagination = {
  totalItems: number
}

interface InboxToolbarProps {
  currentView: InboxView
  onViewChange: (view: InboxView) => void
  searchInput: string
  onSearchInputChange: (value: string) => void
  isSearching: boolean
  onClearSearch: () => void
  syncStatus: SyncStatus
  pagination: Pagination
  isSyncing: boolean
  onSync: () => void
  onCompose: () => void
}

export function InboxToolbar({
  currentView,
  onViewChange,
  searchInput,
  onSearchInputChange,
  isSearching,
  onClearSearch,
  syncStatus,
  pagination,
  isSyncing,
  onSync,
  onCompose,
}: InboxToolbarProps) {
  return (
    <div className='flex flex-wrap items-center gap-4'>
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
          <SelectItem value='inbox'>Inbox</SelectItem>
          <SelectItem value='sent'>Sent</SelectItem>
          <SelectItem value='drafts'>Drafts</SelectItem>
          <SelectItem value='linked'>Linked</SelectItem>
          <SelectItem value='unlinked'>Unlinked</SelectItem>
        </SelectContent>
      </Select>

      {/* Search Input */}
      <div className='relative w-64'>
        {isSearching ? (
          <RefreshCw className='text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin' />
        ) : (
          <Search className='text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2' />
        )}
        <Input
          type='text'
          placeholder='Search emails...'
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

      {/* Quick Search Filters - Toggle buttons */}
      {syncStatus.connected && (
        <div className='hidden items-center gap-1.5 lg:flex'>
          <Button
            variant={searchInput.includes('has:attachment') ? 'default' : 'outline'}
            size='sm'
            className='h-7 text-xs'
            onClick={() => {
              if (searchInput.includes('has:attachment')) {
                onSearchInputChange(searchInput.replace(/\s*has:attachment\s*/g, ' ').trim())
              } else {
                onSearchInputChange((searchInput + ' has:attachment').trim())
              }
            }}
          >
            Has attachment
          </Button>
          <Button
            variant={searchInput.includes('is:unread') ? 'default' : 'outline'}
            size='sm'
            className='h-7 text-xs'
            onClick={() => {
              if (searchInput.includes('is:unread')) {
                onSearchInputChange(searchInput.replace(/\s*is:unread\s*/g, ' ').trim())
              } else {
                onSearchInputChange((searchInput + ' is:unread').trim())
              }
            }}
          >
            Unread
          </Button>
        </div>
      )}

      <div className='text-muted-foreground flex items-center gap-2 text-sm'>
        {syncStatus.connected ? (
          <CheckCircle className='h-4 w-4 text-green-500' />
        ) : (
          <Circle className='h-4 w-4' />
        )}
        <span>{pagination.totalItems} threads</span>
        {syncStatus.unread > 0 && (
          <Badge variant='secondary' className='text-xs'>
            {syncStatus.unread} unread
          </Badge>
        )}
      </div>

      <div className='ml-auto flex items-center gap-4'>
        {syncStatus.lastSyncAt && (
          <span className='text-muted-foreground text-xs'>
            Last sync{' '}
            {formatDistanceToNow(new Date(syncStatus.lastSyncAt))} ago
          </span>
        )}
        {syncStatus.connected && (
          <>
            <Button
              variant='outline'
              size='sm'
              onClick={onSync}
              disabled={isSyncing}
            >
              <RefreshCw
                className={cn('mr-2 h-4 w-4', isSyncing && 'animate-spin')}
              />
              {isSyncing ? 'Syncing...' : 'Sync'}
            </Button>
            {/* Mobile-only compose button */}
            <Button
              size='sm'
              className='md:hidden'
              onClick={onCompose}
            >
              <PenSquare className='mr-2 h-4 w-4' />
              Compose
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
