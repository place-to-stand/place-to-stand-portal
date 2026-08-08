'use client'

import { useState } from 'react'

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
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useToast } from '@/components/ui/use-toast'

import { DesignSection, Specimen } from './specimen'

const SHEET_SIZES = ['sm', 'md', 'lg', 'xl', 'full'] as const

export function PrimitivesOverlays() {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { toast } = useToast()

  return (
    <DesignSection
      id='overlays'
      title='Overlays'
      description='Hover/press surfaces: tooltips, popovers, menus, dialogs, sheets, and toasts.'
    >
      <Specimen label='Tooltip / Popover / HoverCard / DropdownMenu'>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant='outline' size='sm'>
              Tooltip
            </Button>
          </TooltipTrigger>
          <TooltipContent>Short helper text</TooltipContent>
        </Tooltip>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant='outline' size='sm'>
              Popover
            </Button>
          </PopoverTrigger>
          <PopoverContent className='w-64 text-sm'>
            Popover content on a popover surface. Closes on outside click.
          </PopoverContent>
        </Popover>

        <HoverCard>
          <HoverCardTrigger asChild>
            <Button variant='link' size='sm'>
              Hover me
            </Button>
          </HoverCardTrigger>
          <HoverCardContent className='w-64 text-sm'>
            <p className='font-medium'>Hover card</p>
            <p className='text-muted-foreground'>
              Richer preview content shown on hover.
            </p>
          </HoverCardContent>
        </HoverCard>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='outline' size='sm'>
              Dropdown menu
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='start'>
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem>Edit</DropdownMenuItem>
            <DropdownMenuItem>Duplicate</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant='destructive'>Archive</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Specimen>

      <Specimen
        label='DisabledFieldTooltip'
        note='hover the disabled input for the reason'
        className='max-w-sm'
      >
        <DisabledFieldTooltip
          disabled
          reason='This field is locked while the invoice is sent.'
          className='w-full'
        >
          <Input placeholder='Locked field' disabled />
        </DisabledFieldTooltip>
      </Specimen>

      <Specimen label='Dialog / AlertDialog / ConfirmDialog'>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant='outline' size='sm'>
              Dialog
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sample dialog</DialogTitle>
              <DialogDescription>
                A standard dialog with header, body, and footer.
              </DialogDescription>
            </DialogHeader>
            <p className='text-sm'>Dialog body content.</p>
            <DialogFooter>
              <Button size='sm'>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant='outline' size='sm'>
              AlertDialog
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction>Continue</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button
          variant='outline'
          size='sm'
          onClick={() => setConfirmOpen(true)}
        >
          ConfirmDialog
        </Button>
        <ConfirmDialog
          open={confirmOpen}
          title='Archive this record?'
          description='You can restore it later from the archive tab.'
          confirmLabel='Archive'
          confirmVariant='destructive'
          onConfirm={() => setConfirmOpen(false)}
          onCancel={() => setConfirmOpen(false)}
        />
      </Specimen>

      <Specimen label='Sheet' note='sizes sm / md / lg / xl / full'>
        {SHEET_SIZES.map(size => (
          <Sheet key={size}>
            <SheetTrigger asChild>
              <Button variant='outline' size='sm'>
                {size}
              </Button>
            </SheetTrigger>
            <SheetContent size={size}>
              <SheetHeader>
                <SheetTitle>Sheet ({size})</SheetTitle>
                <SheetDescription>
                  Right-side sheet at size &ldquo;{size}&rdquo;.
                </SheetDescription>
              </SheetHeader>
              <p className='px-4 text-sm'>Sheet body content.</p>
            </SheetContent>
          </Sheet>
        ))}
      </Specimen>

      <Specimen label='Toast' note='via components/ui/use-toast'>
        <Button
          variant='outline'
          size='sm'
          onClick={() =>
            toast({
              title: 'Saved',
              description: 'Your changes have been saved.',
            })
          }
        >
          Default toast
        </Button>
        <Button
          variant='outline'
          size='sm'
          onClick={() =>
            toast({
              title: 'Something went wrong',
              description: 'The request failed. Try again.',
              variant: 'destructive',
            })
          }
        >
          Destructive toast
        </Button>
      </Specimen>

      <Specimen label='CommandDialog' className='block'>
        <p className='text-muted-foreground text-sm'>
          The command palette (components/ui/command.tsx) is rendered app-wide
          — press <kbd className='bg-muted rounded border px-1 font-mono text-[11px]'>⌘K</kbd>{' '}
          or use the Search affordance in the header above to open the real
          palette. No inert specimen is rendered here.
        </p>
      </Specimen>
    </DesignSection>
  )
}
