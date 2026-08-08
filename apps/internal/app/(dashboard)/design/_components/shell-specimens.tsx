'use client'

import { Plus } from 'lucide-react'

import { TabsNav, type TabsNavTab } from '@/components/layout/tabs-nav'
import { Button } from '@/components/ui/button'

import { DesignSection, Specimen } from './specimen'

/** Inert tabs — every href points back at /design so clicks are harmless. */
const SPECIMEN_TABS: readonly TabsNavTab[] = [
  { value: 'tasks', label: 'Tasks', href: '/design' },
  { value: 'overview', label: 'Overview', href: '/design' },
  { value: 'activity', label: 'Activity', href: '/design' },
  { value: 'archive', label: 'Archive', href: '/design' },
]

export function ShellSpecimens() {
  return (
    <DesignSection
      id='shell'
      title='Shell specimens'
      description='Layout chrome patterns from PRD 004 §01. The header row at the top of this page IS the PageShell specimen — trigger, breadcrumb, and palette affordance are the real thing.'
    >
      <Specimen
        label='TabsNav'
        note='route-pushing tab strip; hrefs here point back at /design'
      >
        <TabsNav tabs={SPECIMEN_TABS} activeTab='tasks' />
      </Specimen>

      <Specimen label='Toolbar row' note='tabs · count · primary action'>
        <div className='flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <TabsNav tabs={SPECIMEN_TABS} activeTab='overview' />
          <div className='flex items-center gap-6'>
            <span className='text-muted-foreground text-sm whitespace-nowrap'>
              Showing 12 of 48
            </span>
            <Button size='sm'>
              <Plus />
              New task
            </Button>
          </div>
        </div>
      </Specimen>

      <Specimen label='PageShell' className='block'>
        <p className='text-muted-foreground text-sm'>
          This page renders inside <code className='font-mono'>PageShell</code>{' '}
          (components/layout/page-shell.tsx): one compact header row (sidebar
          trigger · breadcrumb · ⌘K search affordance · optional right slot),
          an optional toolbar row (TabsNav · count · primary action), then the
          scrollable content pane. The shell owns the page scroll — the body
          never scrolls.
        </p>
      </Specimen>
    </DesignSection>
  )
}
