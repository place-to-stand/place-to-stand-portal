'use client'

import { Plus } from 'lucide-react'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@pts/ui/breadcrumb'
import { Button } from '@pts/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@pts/ui/tabs'
import { PageShell } from '@/components/layout/page-shell'
import { TabsNav, type TabsNavTab } from '@/components/layout/tabs-nav'

import { SampleProjectList } from './components-data'
import { DesignSection, Example, Specimen } from './specimen'

/** Inert route tabs: every href points back at /design. */
const ROUTE_TABS: readonly TabsNavTab[] = [
  { value: 'projects', label: 'Projects', href: '/design' },
  { value: 'archive', label: 'Archive', href: '/design' },
  { value: 'activity', label: 'Activity', href: '/design' },
]

export function ComponentsTabs() {
  return (
    <DesignSection
      id='tabs'
      title='Tabs'
      when='Pill tabs (default) switch views of a page; TabsNav is the route version in the page toolbar. Line tabs divide a sheet or a section into parts that all stay mounted.'
    >
      <Specimen
        label='Variants'
        className='grid grid-cols-1 items-start gap-8 md:grid-cols-2'
      >
        <Example caption="TabsList variant='default': a segmented control">
          <Tabs defaultValue='board'>
            <TabsList>
              <TabsTrigger value='board'>Board</TabsTrigger>
              <TabsTrigger value='calendar'>Calendar</TabsTrigger>
              <TabsTrigger value='list'>List</TabsTrigger>
            </TabsList>
          </Tabs>
        </Example>
        <Example caption="TabsList variant='line': sheets and sections">
          <Tabs defaultValue='details' className='w-full'>
            <div className='border-b'>
              <TabsList variant='line'>
                <TabsTrigger value='details'>Details</TabsTrigger>
                <TabsTrigger value='people'>
                  People
                  <span
                    aria-label='Unsaved changes'
                    className='bg-warning size-1.5 rounded-full'
                  />
                </TabsTrigger>
                <TabsTrigger value='billing'>Billing</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent
              value='details'
              className='text-muted-foreground pt-3 text-sm'
            >
              A dot marks a tab with unsaved edits.
            </TabsContent>
            <TabsContent
              value='people'
              className='text-muted-foreground pt-3 text-sm'
            >
              People panel.
            </TabsContent>
            <TabsContent
              value='billing'
              className='text-muted-foreground pt-3 text-sm'
            >
              Billing panel.
            </TabsContent>
          </Tabs>
        </Example>
        <Example caption='TabsNav: route tabs in the page toolbar'>
          <TabsNav tabs={ROUTE_TABS} activeTab='projects' />
        </Example>
        <Example caption='Breadcrumb: pages title themselves here'>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href='/design'>Projects</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Website rebuild</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </Example>
      </Specimen>
    </DesignSection>
  )
}

export function ComponentsPageShell() {
  return (
    <DesignSection
      id='page-shell'
      title='Page shell'
      when='Every dashboard page is a PageShell: one header row with the breadcrumb, an optional toolbar (tabs at the left, the count and one primary action at the right), then the scrolling content. The body itself never scrolls.'
    >
      <Specimen
        label='PageShell'
        note='The real component in a frame; this page uses it too'
        bleed
      >
        <div className='bg-muted/40 flex h-[34rem] flex-col'>
          <PageShell
            breadcrumbs={[{ label: 'Work' }, { label: 'Projects' }]}
            tabs={ROUTE_TABS}
            activeTab='projects'
            count={{ label: 'projects', total: 118, filteredTotal: 24 }}
            primaryAction={
              <Button size='sm'>
                <Plus />
                Create project
              </Button>
            }
          >
            <SampleProjectList density='compact' />
          </PageShell>
        </div>
      </Specimen>
    </DesignSection>
  )
}
