'use client'

import { useState } from 'react'

import { Avatar, AvatarFallback } from '@pts/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@pts/ui/breadcrumb'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { Progress } from '@pts/ui/progress'
import { Separator } from '@pts/ui/separator'
import { Skeleton } from '@pts/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pts/ui/table'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@pts/ui/tabs'

import { DesignSection, Specimen } from './specimen'

const SAMPLE_ROWS = [
  { name: 'Website redesign', client: 'Acme Corp', status: 'Active', hours: '32.5' },
  { name: 'Brand refresh', client: 'Globex', status: 'On hold', hours: '12.0' },
  { name: 'App migration', client: 'Initech', status: 'Active', hours: '58.25' },
]

export function PrimitivesDisplay() {
  const [page, setPage] = useState(6)

  return (
    <DesignSection
      id='display'
      title='Display & data'
      description='Static display primitives: tabs, avatars, loading states, tables, and pagination.'
    >
      <Specimen label='Tabs' note='static content Tabs (not route nav)'>
        <Tabs defaultValue='overview' className='w-full max-w-md'>
          <TabsList>
            <TabsTrigger value='overview'>Overview</TabsTrigger>
            <TabsTrigger value='details'>Details</TabsTrigger>
            <TabsTrigger value='history'>History</TabsTrigger>
          </TabsList>
          <TabsContent value='overview' className='text-muted-foreground text-sm'>
            Overview panel content.
          </TabsContent>
          <TabsContent value='details' className='text-muted-foreground text-sm'>
            Details panel content.
          </TabsContent>
          <TabsContent value='history' className='text-muted-foreground text-sm'>
            History panel content.
          </TabsContent>
        </Tabs>
      </Specimen>

      <Specimen label='Avatar' note='image-less fallback'>
        <Avatar>
          <AvatarFallback>JD</AvatarFallback>
        </Avatar>
        <Avatar className='size-6'>
          <AvatarFallback className='text-[10px]'>PT</AvatarFallback>
        </Avatar>
      </Specimen>

      <Specimen label='Skeleton' className='max-w-md flex-col items-stretch'>
        <div className='flex items-center gap-3'>
          <Skeleton className='size-9 rounded-full' />
          <div className='flex-1 space-y-2'>
            <Skeleton className='h-4 w-2/3' />
            <Skeleton className='h-3 w-1/2' />
          </div>
        </div>
      </Specimen>

      <Specimen label='Progress' className='max-w-md flex-col items-stretch'>
        <Progress value={0} />
        <Progress value={33} />
        <Progress value={66} />
        <Progress value={100} />
      </Specimen>

      <Specimen label='Separator' className='max-w-md flex-col items-stretch'>
        <div className='text-sm'>
          Above the line
          <Separator className='my-3' />
          Below the line
        </div>
        <div className='flex h-6 items-center gap-3 text-sm'>
          <span>Left</span>
          <Separator orientation='vertical' />
          <span>Right</span>
        </div>
      </Specimen>

      <Specimen label='Breadcrumb' className='flex-col items-start'>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Clients</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href='#'>Clients</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Acme Corp</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <span className='text-muted-foreground'>Work</span>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href='#'>Projects</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Website redesign</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </Specimen>

      <Specimen
        label='PaginationControls — cursor mode'
        className='max-w-md flex-col items-stretch'
      >
        <PaginationControls
          hasNextPage
          hasPreviousPage
          onNext={() => undefined}
          onPrevious={() => undefined}
        />
      </Specimen>

      <Specimen
        label='PaginationControls — paged mode'
        className='max-w-xl flex-col items-stretch'
      >
        <PaginationControls
          mode='paged'
          currentPage={page}
          totalPages={20}
          totalItems={487}
          pageSize={25}
          onPageChange={setPage}
        />
      </Specimen>

      <Specimen label='Table' note='standard bg-muted/40 header' className='block p-0'>
        <Table>
          <TableHeader className='bg-muted/40'>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className='text-right'>Hours</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SAMPLE_ROWS.map(row => (
              <TableRow key={row.name}>
                <TableCell className='font-medium'>{row.name}</TableCell>
                <TableCell>{row.client}</TableCell>
                <TableCell>
                  <Badge variant='secondary'>{row.status}</Badge>
                </TableCell>
                <TableCell className='text-right tabular-nums'>
                  {row.hours}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Specimen>

      <Specimen label='Table — empty state' className='block p-0'>
        <Table>
          <TableHeader className='bg-muted/40'>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell
                colSpan={3}
                className='text-muted-foreground h-24 text-center'
              >
                No projects found.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Specimen>

      <Specimen label='Sidebar' className='block'>
        <p className='text-muted-foreground text-sm'>
          The sidebar (components/ui/sidebar.tsx) is live app chrome — the one
          on the left of this page is the specimen. It is not re-rendered here.
        </p>
      </Specimen>
    </DesignSection>
  )
}
