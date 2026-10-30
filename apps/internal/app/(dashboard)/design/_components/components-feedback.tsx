'use client'

import { useState } from 'react'
import {
  Archive,
  Copy,
  Info,
  Loader2,
  MoreHorizontal,
  Pencil,
  TriangleAlert,
} from 'lucide-react'

import {
  Alert,
  AlertAction,
  AlertContent,
  AlertDescription,
  AlertTitle,
} from '@pts/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@pts/ui/alert-dialog'
import { Button } from '@pts/ui/button'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@pts/ui/accordion'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@pts/ui/collapsible'
import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@pts/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@pts/ui/dropdown-menu'
import { EmptyState } from '@pts/ui/empty-state'
import { Input } from '@pts/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@pts/ui/popover'
import { Progress } from '@pts/ui/progress'
import { Skeleton } from '@pts/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@pts/ui/tooltip'
import { ArchiveConfirmDialog } from '@/components/sheets/archive-confirm-dialog'
import { SaveSideEffect } from '@/components/sheets/save-side-effect'
import { DeepLinkNotFoundNotice } from '@/components/table/deep-link-not-found'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { ToastCard } from '@/components/ui/toast-card'
import { useToast } from '@/components/ui/use-toast'

import { DesignSection, Example, Specimen } from './specimen'

export function ComponentsEmptyLoading() {
  const [noticeShown, setNoticeShown] = useState(true)
  return (
    <DesignSection
      id='empty-loading'
      title='Empty and loading'
      when='An empty state is one plain sentence in a dashed box: no illustration, no pep. Loading keeps the layout: skeletons in the shape of what is coming, a spinner inside the button that started it.'
    >
      <Specimen
        label='EmptyState'
        note='@pts/ui/empty-state'
        className='grid grid-cols-1 gap-6 md:grid-cols-3'
      >
        <Example caption='message only' className='[&>div]:w-full'>
          <EmptyState message='No leads yet.' />
        </Example>
        <Example
          caption='onClick: the box is the action'
          className='[&>div]:w-full'
        >
          <EmptyState
            message='Add the first person'
            onClick={() => undefined}
          />
        </Example>
        <Example caption='with an action' className='[&>div]:w-full'>
          <EmptyState
            message='No matching tasks.'
            action={
              <Button variant='outline' size='sm'>
                Reset filters
              </Button>
            }
          />
        </Example>
      </Specimen>
      <Specimen
        label='Loading'
        className='grid grid-cols-1 gap-6 md:grid-cols-3'
      >
        <Example caption='Skeleton: a record row' className='[&>div]:w-full'>
          <div className='flex w-full items-center gap-3'>
            <Skeleton className='size-8 rounded-full' />
            <div className='flex-1 space-y-2'>
              <Skeleton className='h-4 w-2/3' />
              <Skeleton className='h-3 w-1/2' />
            </div>
          </div>
        </Example>
        <Example caption='Progress: hours used' className='[&>div]:w-full'>
          <div className='w-full space-y-2'>
            <Progress value={64} />
            <p className='text-muted-foreground text-xs tabular-nums'>
              25.5 of 40 hours used
            </p>
          </div>
        </Example>
        <Example caption='inline spinner'>
          <span className='text-muted-foreground flex items-center gap-2 text-sm'>
            <Loader2 className='size-4 animate-spin' aria-hidden />
            Loading activity…
          </span>
        </Example>
      </Specimen>
      <Specimen
        label='Missing record'
        note='DeepLinkNotFoundNotice: a ?client= link to a deleted record'
        className='block'
      >
        {noticeShown ? (
          <DeepLinkNotFoundNotice
            entity='client'
            onDismiss={() => setNoticeShown(false)}
          />
        ) : (
          <Button
            variant='outline'
            size='sm'
            onClick={() => setNoticeShown(true)}
          >
            Show notice again
          </Button>
        )}
      </Specimen>
    </DesignSection>
  )
}

export function ComponentsFeedback() {
  const { toast } = useToast()
  return (
    <DesignSection
      id='feedback'
      title='Alerts, toasts and errors'
      when='A toast confirms what just happened: short and past tense on success; "Unable to <verb> <noun>" on failure, with the reason in the description. An Alert stays on the page while its cause does: warning for something worth a look that never blocks saving (with the fix as its action), destructive for something broken. A sheet or dialog’s save result, success or failure, is always a toast, the same on every sheet; only a field’s own error (required, format) stays under the field.'
    >
      <Specimen label='Alert' note='@pts/ui/alert' className='block space-y-3'>
        <Alert variant='warning'>
          <TriangleAlert />
          <AlertContent>
            <AlertDescription>
              Ada Lovelace isn’t at Acme Industries.
            </AlertDescription>
          </AlertContent>
          <AlertAction>
            <Button type='button' variant='outline' size='xs'>
              Add to Acme Industries
            </Button>
          </AlertAction>
        </Alert>
        <Alert variant='destructive'>
          <TriangleAlert />
          <AlertContent>
            <AlertTitle>Unable to read the saved close</AlertTitle>
            <AlertDescription>
              The figures below are live, not the saved close.
            </AlertDescription>
          </AlertContent>
        </Alert>
        <Alert>
          <Info />
          <AlertContent>
            <AlertDescription>
              Acme Industries has no primary contact yet.
            </AlertDescription>
          </AlertContent>
        </Alert>
        <SaveSideEffect>
          Saving emails a portal invite to Ada Lovelace.
        </SaveSideEffect>
      </Specimen>
      <Specimen
        label='Toast'
        note='components/ui/use-toast; each kind shown as it appears'
        className='block space-y-2'
      >
        <ToastCard title='Invoice sent' onDismiss={() => {}} />
        <ToastCard
          variant='destructive'
          title='Unable to save invoice'
          description='The billing email is missing.'
          onDismiss={() => {}}
        />
        <ToastCard
          variant='warning'
          title='Closed month affected'
          description='September is closed: reopen it to include this change.'
          onDismiss={() => {}}
        />
        <ToastCard
          variant='info'
          title='Copied'
          description='The share link is on your clipboard.'
          onDismiss={() => {}}
        />
        <div className='flex flex-wrap gap-2 pt-2'>
          <Button
            variant='outline'
            onClick={() => toast({ title: 'Invoice sent' })}
          >
            Success toast
          </Button>
          <Button
            variant='outline'
            onClick={() =>
              toast({
                title: 'Unable to save invoice',
                description: 'The billing email is missing.',
                variant: 'destructive',
              })
            }
          >
            Failure toast
          </Button>
        </div>
      </Specimen>
      <Specimen
        label='Sheet save results'
        note='every sheet: a toast, never an inline box; a refusal gives its reason'
        className='block space-y-2'
      >
        <ToastCard
          title='Company saved'
          description='Acme Industries'
          onDismiss={() => {}}
        />
        <ToastCard
          variant='destructive'
          title='Unable to save company'
          description='Someone else saved this company. Reload to see their changes.'
          onDismiss={() => {}}
        />
      </Specimen>
    </DesignSection>
  )
}

export function ComponentsOverlays() {
  return (
    <DesignSection
      id='overlays'
      title='Tooltips and menus'
      when='A tooltip names an icon or explains why something is disabled. A dropdown menu holds a record’s secondary actions. Popovers and hover cards preview; none of them edit a record that lives in a sheet.'
    >
      <Specimen
        label='Hover and press surfaces'
        className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3'
      >
        <Example caption='Tooltip'>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant='outline' size='icon' aria-label='Copy link'>
                <Copy />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy link</TooltipContent>
          </Tooltip>
        </Example>
        <Example caption='DisabledFieldTooltip: hover the field'>
          <DisabledFieldTooltip
            disabled
            reason='Locked once the invoice is sent.'
            className='w-56'
          >
            <Input defaultValue='INV-0142' disabled />
          </DisabledFieldTooltip>
        </Example>
        <Example caption='HoverCard: a preview'>
          <HoverCard>
            <HoverCardTrigger asChild>
              <button
                type='button'
                className='text-muted-foreground hover:text-foreground text-sm hover:underline'
              >
                Acme Industries
              </button>
            </HoverCardTrigger>
            <HoverCardContent className='w-64 text-sm'>
              <p className='font-medium'>Acme Industries</p>
              <p className='text-muted-foreground'>
                Client since Jan 12, 2026 · 3 projects
              </p>
            </HoverCardContent>
          </HoverCard>
        </Example>
        <Example caption='DropdownMenu: record actions'>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant='outline'
                size='icon'
                aria-label='Company actions'
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className='w-52'>
              <DropdownMenuLabel>Acme Industries</DropdownMenuLabel>
              <DropdownMenuItem>
                <Pencil />
                Edit company
                <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Copy</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem>Copy link</DropdownMenuItem>
                  <DropdownMenuItem>Copy ID</DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuCheckboxItem checked>
                Show archived
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant='destructive'>
                <Archive />
                Archive company
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Example>
        <Example caption='Popover'>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant='outline'>Billing terms</Button>
            </PopoverTrigger>
            <PopoverContent className='w-64 text-sm'>
              Net 30 since Jan 2026.
            </PopoverContent>
          </Popover>
        </Example>
        <Example caption='Collapsible'>
          <Collapsible className='w-56'>
            <CollapsibleTrigger render={<Button variant='ghost' size='sm' />}>
              Show 3 older updates
            </CollapsibleTrigger>
            <CollapsibleContent className='text-muted-foreground px-3 pt-1 text-sm'>
              Proposal sent · Call booked · Intro email
            </CollapsibleContent>
          </Collapsible>
        </Example>
        <Example caption='Accordion (the house accordion: a sheet’s Activity)'>
          <Accordion className='w-72'>
            <AccordionItem value='activity'>
              <AccordionTrigger>Activity (3)</AccordionTrigger>
              <AccordionContent className='text-muted-foreground'>
                Logged 1.5h · Moved to In progress · Created
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value='older'>
              <AccordionTrigger>Older updates</AccordionTrigger>
              <AccordionContent className='text-muted-foreground'>
                Proposal sent · Call booked
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Example>
      </Specimen>
      <Specimen label='Command palette' className='block'>
        <p className='text-muted-foreground text-sm'>
          The palette (components/ui/command.tsx) is mounted app-wide: press{' '}
          <kbd className='bg-muted rounded border px-1.5 py-0.5 font-mono text-[11px]'>
            ⌘K
          </kbd>{' '}
          to open the real one.
        </p>
      </Specimen>
    </DesignSection>
  )
}

export function ComponentsDialogs() {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const { toast } = useToast()
  return (
    <DesignSection
      id='dialogs'
      title='Dialogs'
      when='Rare. ConfirmDialog confirms a destructive or irreversible action; Dialog holds a small one-step form (link a repo, email an invoice, log time), even over a sheet. Records are edited in sheets, never in dialogs.'
    >
      <Specimen label='ConfirmDialog, AlertDialog, Dialog' note='@pts/ui'>
        <Button variant='destructive' onClick={() => setConfirmOpen(true)}>
          <Archive />
          Archive company
        </Button>
        <ConfirmDialog
          open={confirmOpen}
          title='Archive Acme Industries?'
          description='It leaves every list. You can restore it from the archive.'
          confirmLabel='Archive company'
          confirmVariant='destructive'
          onConfirm={() => {
            setConfirmOpen(false)
            toast({ title: 'Company archived' })
          }}
          onCancel={() => setConfirmOpen(false)}
        />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant='outline'>AlertDialog</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Void invoice INV-0142?</AlertDialogTitle>
              <AlertDialogDescription>
                The client can no longer pay it.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction>Void invoice</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant='outline'>Dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Keyboard shortcuts</DialogTitle>
              <DialogDescription>
                A read-only dialog: reference, not editing.
              </DialogDescription>
            </DialogHeader>
            <ul className='space-y-2 text-sm'>
              <li className='flex justify-between'>
                Save <kbd className='font-mono text-xs'>⌘S</kbd>
              </li>
              <li className='flex justify-between'>
                Search <kbd className='font-mono text-xs'>⌘K</kbd>
              </li>
            </ul>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant='outline'>Close</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Specimen>
      <Specimen
        label='ArchiveConfirmDialog'
        note='components/sheets/archive-confirm-dialog.tsx'
      >
        <Button variant='destructive' onClick={() => setArchiveOpen(true)}>
          <Archive />
          Archive project
        </Button>
        <ArchiveConfirmDialog
          open={archiveOpen}
          entity='project'
          name='Website refresh'
          list='active projects'
          onConfirm={() => {
            setArchiveOpen(false)
            toast({ title: 'Project archived' })
          }}
          onCancel={() => setArchiveOpen(false)}
        />
      </Specimen>
    </DesignSection>
  )
}
