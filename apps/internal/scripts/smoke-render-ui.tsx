/**
 * SSR smoke-render for the Base UI ports (PRD 004, completed later by the
 * Slot/tabs/hover-card/tiptap ports). Renders every ported wrapper in its real
 * consumer compositions — open/keepMounted states included — via
 * renderToString. Catches runtime context-invariant throws (the class that
 * crashed DropdownMenuLabel) that tsc cannot see.
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
import {
  Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger,
} from '../components/ui/sheet'
import { Slot } from '@pts/ui/slot'
import { Badge } from '../components/ui/badge'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '../components/ui/hover-card'
import {
  Popover as TiptapPopover, PopoverContent as TiptapPopoverContent,
  PopoverTrigger as TiptapPopoverTrigger,
} from '../components/tiptap-ui-primitive/popover/popover'
import {
  DropdownMenu as TiptapDropdownMenu, DropdownMenuContent as TiptapDropdownMenuContent,
  DropdownMenuItem as TiptapDropdownMenuItem, DropdownMenuTrigger as TiptapDropdownMenuTrigger,
} from '../components/tiptap-ui-primitive/dropdown-menu/dropdown-menu'

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
  {
    name: 'sheet (open, entity-sheet shape: size, hideCloseButton, skipMountAnimation)',
    element: (
      <Sheet open onOpenChange={noop}>
        <SheetContent size='lg' hideCloseButton skipMountAnimation>
          <SheetHeader>
            <SheetTitle>Edit client</SheetTitle>
            <SheetDescription>desc</SheetDescription>
          </SheetHeader>
          <SheetClose asChild>
            <Button>close</Button>
          </SheetClose>
        </SheetContent>
      </Sheet>
    ),
  },
  {
    name: 'sheet (closed, trigger asChild — read-only sheet shape)',
    element: (
      <Sheet>
        <SheetTrigger asChild>
          <Button>open</Button>
        </SheetTrigger>
        <SheetContent size='xl'>
          <SheetHeader>
            <SheetTitle>Details</SheetTitle>
            <SheetDescription>desc</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    ),
  },
  // --- Slot / asChild: the composition every `asChild` call site depends on.
  {
    name: 'slot (bare, prop + className merge)',
    element: (
      <Slot className='outer' data-outer=''>
        <a href='/x' className='inner'>link</a>
      </Slot>
    ),
  },
  {
    name: 'button asChild (link)',
    element: <Button asChild size='sm'><a href='/x'>Go</a></Button>,
  },
  { name: 'badge asChild (link)', element: <Badge asChild><a href='/x'>New</a></Badge> },
  // --- Tabs on Base UI, including the board's Link-as-tab shape.
  {
    name: 'tabs (asChild link triggers — project board shape)',
    element: (
      <Tabs value='overview'>
        <TabsList>
          <TabsTrigger value='overview' asChild><a href='/overview'>Overview</a></TabsTrigger>
          <TabsTrigger value='tasks' asChild><a href='/tasks'>Tasks</a></TabsTrigger>
        </TabsList>
        <TabsContent value='overview'>content</TabsContent>
      </Tabs>
    ),
  },
  // --- hover-card: the deferred port, now on Base UI popover.
  {
    name: 'hover-card (open, trigger asChild)',
    element: (
      <HoverCard open>
        <HoverCardTrigger asChild><a href='/x'>hover me</a></HoverCardTrigger>
        <HoverCardContent>card body</HoverCardContent>
      </HoverCard>
    ),
  },
  {
    name: 'hover-card (closed — uncontrolled default)',
    element: (
      <HoverCard>
        <HoverCardTrigger asChild><a href='/x'>hover me</a></HoverCardTrigger>
        <HoverCardContent>card body</HoverCardContent>
      </HoverCard>
    ),
  },
  // --- tiptap primitives: inline (portal=false) is the editor's default.
  {
    name: 'tiptap popover (open, trigger asChild)',
    element: (
      <TiptapPopover open>
        <TiptapPopoverTrigger asChild><button type='button'>link</button></TiptapPopoverTrigger>
        <TiptapPopoverContent aria-label='Link'>body</TiptapPopoverContent>
      </TiptapPopover>
    ),
  },
  {
    name: 'tiptap dropdown (open, inline portal=false, asChild item)',
    element: (
      <TiptapDropdownMenu open>
        <TiptapDropdownMenuTrigger asChild><button type='button'>H</button></TiptapDropdownMenuTrigger>
        <TiptapDropdownMenuContent align='start' portal={false}>
          <TiptapDropdownMenuItem asChild><button type='button'>H1</button></TiptapDropdownMenuItem>
        </TiptapDropdownMenuContent>
      </TiptapDropdownMenu>
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
