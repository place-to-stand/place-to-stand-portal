'use client'

import Link from 'next/link'
import { CheckIcon, ChevronDownIcon } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@pts/ui/dropdown-menu'
import { TABS_TRIGGER_CLASS } from '@pts/ui/tabs'
import { cn } from '@/lib/utils'

import { TOOLBAR_TAB_CLASS, TOOLBAR_TABS_LIST_CLASS } from './tabs-nav-classes'

export type ToolbarTabsMenuTab = {
  value: string
  label: string
  href: string
  disabled?: boolean
}

type ToolbarTabsMenuProps = {
  tabs: readonly ToolbarTabsMenuTab[]
  activeTab: string
  /** Fires as a tab is picked, before the route changes (optimistic label). */
  onSelect?: (value: string) => void
  className?: string
}

/**
 * The toolbar's tab strip on phones: one pill that looks like the active
 * tab, with a chevron, opening a menu of every tab (the current one checked
 * on the right). It keeps tabs, count and the primary action on one row.
 * Each item is a real link, so the URL stays the state. A strip with a
 * single tab shows the pill alone, with no chevron and no menu.
 */
export function ToolbarTabsMenu({
  tabs,
  activeTab,
  onSelect,
  className,
}: ToolbarTabsMenuProps) {
  const active = tabs.find(tab => tab.value === activeTab) ?? tabs[0]
  if (!active) return null

  const pillClass = cn(TABS_TRIGGER_CLASS, TOOLBAR_TAB_CLASS)

  return (
    // Never shrinks or scrolls: when the row is tight, the count truncates.
    <div
      className={cn(
        TOOLBAR_TABS_LIST_CLASS,
        'flex shrink-0 overflow-visible',
        className
      )}
    >
      {tabs.length === 1 ? (
        <span data-active='' className={cn(pillClass, 'cursor-default')}>
          {active.label}
        </span>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger
            data-active=''
            aria-label={`${active.label}, switch tab`}
            className={cn(pillClass, 'gap-1.5 pr-2')}
          >
            {active.label}
            <ChevronDownIcon className='text-muted-foreground' aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent className='min-w-40'>
            {tabs.map(tab => {
              const isActive = tab.value === active.value
              return (
                <DropdownMenuItem
                  key={tab.value}
                  disabled={tab.disabled}
                  render={<Link href={tab.href} prefetch={false} />}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={event => {
                    // A modified click opens a new tab; this page stays put.
                    const opensElsewhere =
                      event.metaKey ||
                      event.ctrlKey ||
                      event.shiftKey ||
                      event.altKey ||
                      event.button !== 0
                    if (!isActive && !opensElsewhere) onSelect?.(tab.value)
                  }}
                >
                  {tab.label}
                  {isActive ? (
                    <CheckIcon className='ml-auto' aria-hidden />
                  ) : null}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
