/**
 * SSR smoke-render for the Base UI ports (PRD 004). Renders every ported
 * wrapper in its real consumer compositions — open/keepMounted states
 * included — via renderToString. Catches runtime context-invariant throws
 * (the class that crashed DropdownMenuLabel) that tsc cannot see.
 */
import * as React from 'react'
import { renderToString } from 'react-dom/server'

import { Button } from '@pts/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@pts/ui/tabs'
import { Skeleton } from '@pts/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@pts/ui/table'
import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@pts/ui/alert-dialog'
import { Avatar, AvatarFallback } from '@pts/ui/avatar'
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@pts/ui/breadcrumb'
import { Checkbox } from '@pts/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@pts/ui/collapsible'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@pts/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@pts/ui/dropdown-menu'
import { Label } from '@pts/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@pts/ui/popover'
import { Progress } from '@pts/ui/progress'
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@pts/ui/select'
import { Separator } from '@pts/ui/separator'
import { Switch } from '@pts/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@pts/ui/tooltip'

type Case = { name: string; element: React.ReactElement }

const noop = () => {}

const cases: Case[] = [
  { name: 'button', element: <Button size='sm'>Go</Button> },
  {
    name: 'tabs',
    element: (
      <Tabs value='a'>
        <TabsList><TabsTrigger value='a'>A</TabsTrigger><TabsTrigger value='b'>B</TabsTrigger></TabsList>
        <TabsContent value='a'>content</TabsContent>
      </Tabs>
    ),
  },
  { name: 'skeleton', element: <Skeleton className='h-4 w-24' /> },
  {
    name: 'table-compact',
    element: (
      <Table density='compact'>
        <TableHeader><TableRow><TableHead>H</TableHead></TableRow></TableHeader>
        <TableBody><TableRow><TableCell>c</TableCell></TableRow></TableBody>
      </Table>
    ),
  },
  { name: 'avatar', element: <Avatar><AvatarFallback>AB</AvatarFallback></Avatar> },
  {
    name: 'breadcrumb (asChild link)',
    element: (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem><span>Work</span></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild><a href='/x'>Section</a></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>Here</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    ),
  },
  { name: 'checkbox (checked)', element: <Checkbox checked onCheckedChange={noop} /> },
  { name: 'switch sm (checked)', element: <Switch size='sm' checked onCheckedChange={noop} /> },
  { name: 'label', element: <Label htmlFor='x'>Field</Label> },
  { name: 'separator', element: <Separator /> },
  { name: 'progress', element: <Progress value={40} /> },
  {
    name: 'collapsible (open)',
    element: (
      <Collapsible open>
        <CollapsibleTrigger>t</CollapsibleTrigger>
        <CollapsibleContent>c</CollapsibleContent>
      </Collapsible>
    ),
  },
  {
    name: 'dialog (open, showCloseButton)',
    element: (
      <Dialog open onOpenChange={noop}>
        <DialogTrigger asChild><Button>open</Button></DialogTrigger>
        <DialogContent showCloseButton>
          <DialogHeader><DialogTitle>T</DialogTitle><DialogDescription>D</DialogDescription></DialogHeader>
          <DialogFooter><Button>Ok</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    ),
  },
  {
    name: 'alert-dialog (open, trigger asChild)',
    element: (
      <AlertDialog open onOpenChange={noop}>
        <AlertDialogTrigger asChild><Button>open</Button></AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>T</AlertDialogTitle><AlertDialogDescription>D</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><Button>Ok</Button></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    ),
  },
  {
    name: 'confirm-dialog (open)',
    element: <ConfirmDialog open title='Sure?' description='really' onConfirm={noop} onCancel={noop} />,
  },
  {
    name: 'popover (open, trigger asChild)',
    element: (
      <Popover open onOpenChange={noop}>
        <PopoverTrigger asChild><Button>t</Button></PopoverTrigger>
        <PopoverContent align='start' className='w-64'>hello</PopoverContent>
      </Popover>
    ),
  },
  {
    // The exact user-menu shape that crashed: keepMounted content with a
    // free-standing Label + Separator + Group of items.
    name: 'dropdown-menu (user-menu shape: open, forceMount, bare Label)',
    element: (
      <DropdownMenu open onOpenChange={noop}>
        <DropdownMenuTrigger className='x'>t</DropdownMenuTrigger>
        <DropdownMenuContent className='w-56' align='end' forceMount>
          <DropdownMenuLabel>Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={e => e.preventDefault()}>Toggle theme</DropdownMenuItem>
            <DropdownMenuItem disabled>Sign out</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
  {
    name: 'dropdown-menu (closed, forceMount — the SSR crash path)',
    element: (
      <DropdownMenu>
        <DropdownMenuTrigger className='x'>t</DropdownMenuTrigger>
        <DropdownMenuContent forceMount>
          <DropdownMenuLabel>Account</DropdownMenuLabel>
          <DropdownMenuItem>i</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
  {
    name: 'select (open, value, groups + bare label)',
    element: (
      <Select value='b' onValueChange={noop} open onOpenChange={noop}>
        <SelectTrigger size='sm'><SelectValue placeholder='Pick' /></SelectTrigger>
        <SelectContent>
          <SelectLabel>Bare label</SelectLabel>
          <SelectGroup>
            <SelectLabel>Grouped</SelectLabel>
            <SelectItem value='a'>Alpha</SelectItem>
            <SelectItem value='b'>Beta</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    ),
  },
  {
    name: 'select (closed, value — trigger label resolution)',
    element: (
      <Select value='a' onValueChange={noop}>
        <SelectTrigger><SelectValue placeholder='Pick' /></SelectTrigger>
        <SelectContent>
          <SelectItem value='a'>Alpha</SelectItem>
        </SelectContent>
      </Select>
    ),
  },
  {
    name: 'tooltip (open, trigger asChild, provider)',
    element: (
      <TooltipProvider delayDuration={0}>
        <Tooltip open>
          <TooltipTrigger asChild><Button>t</Button></TooltipTrigger>
          <TooltipContent side='right'>tip</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ),
  },
]

let failures = 0
for (const testCase of cases) {
  try {
    const html = renderToString(testCase.element)
    console.log(`PASS  ${testCase.name} (${html.length}b)`)
  } catch (error) {
    failures += 1
    console.error(`FAIL  ${testCase.name}\n      ${(error as Error).message}`)
  }
}

if (failures > 0) {
  console.error(`\n${failures} case(s) failed`)
  process.exit(1)
}
console.log(`\nAll ${cases.length} cases rendered`)
