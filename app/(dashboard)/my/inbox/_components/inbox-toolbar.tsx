'use client'

import Link from 'next/link'
import {
  CircleDashed,
  Filter,
  PenSquare,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import type { InboxView } from './inbox-sidebar'

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

export function InboxToolbar({
  currentView,
  onViewChange,
  searchInput,
  onSearchInputChange,
  isSearching,
  onClearSearch,
  isConnected,
  onCompose,
  unclassifiedCount,
}: InboxToolbarProps) {
  const displayText = getDisplayText(searchInput)
  const { hasAttachment, isUnread } = getOperators(searchInput)
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

      {/* Quick Search Filters */}
      {isConnected && (
        <div className='hidden items-center gap-4 lg:flex'>
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

      {/* Right side - unclassified indicator + compose */}
      <div className='ml-auto flex min-w-0 flex-shrink-0 items-center gap-3'>
        {unclassifiedCount !== undefined && unclassifiedCount > 0 && (
          <Link
            href='/my/inbox/triage'
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
