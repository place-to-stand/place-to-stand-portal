'use client'

import { useState } from 'react'
import { MoreHorizontal, type LucideIcon } from 'lucide-react'

import { Badge } from '@pts/ui/badge'
import { Button } from '@pts/ui/button'
import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@pts/ui/dropdown-menu'
import { Input } from '@pts/ui/input'
import { Label } from '@pts/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pts/ui/select'
import { Separator } from '@pts/ui/separator'
import { Switch } from '@pts/ui/switch'
import { Textarea } from '@pts/ui/textarea'
import { CONCEPT_ICONS } from '@/lib/concept-icons'
import { ClientBadge } from '@/components/clients/client-badge'
import { LeadStatusBadge } from '@/components/leads/lead-status-badge'
import { ContactRecordRow } from '@/components/sheets/entity-record-rows'
import { EmptyState } from '@pts/ui/empty-state'
import { EntityList } from '@/components/sheets/entity-list'
import { SheetActivityDisclosure } from '@/components/sheets/sheet-activity-section'
import { SheetFormFooter } from '@/components/sheets/sheet-form-footer'
import { SheetFormHeader } from '@/components/sheets/sheet-form-header'
import { SheetSection } from '@/components/sheets/sheet-section'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SHEET_SIDE_COLUMN_CLASSES,
} from '@/components/ui/sheet'
import { UserAvatar } from '@/components/ui/user-avatar'
import { useToast } from '@/components/ui/use-toast'
import {
  type AccentEntity,
  ENTITY_ACCENTS,
  ENTITY_ICONS,
} from '@/lib/entity-accents'
import { cn } from '@/lib/utils'

import { DesignSection, Specimen } from './specimen'

const FORM_ID = 'design-sample-sheet-form'

type Variant = {
  entity: AccentEntity
  noun: string
  title: string
  icon: LucideIcon
}

const VARIANTS: Variant[] = [
  {
    entity: 'company',
    noun: 'company',
    title: 'Acme Industries',
    icon: ENTITY_ICONS.company,
  },
  {
    entity: 'contact',
    noun: 'person',
    title: 'Ada Lovelace',
    icon: ENTITY_ICONS.contact,
  },
  {
    entity: 'lead',
    noun: 'lead',
    title: 'Northwind redesign',
    icon: ENTITY_ICONS.lead,
  },
]

const SIZES = [1, 2] as const

export function ComponentsSheets() {
  const [variant, setVariant] = useState<Variant | null>(null)

  return (
    <DesignSection
      id='sheets'
      title='Sheets'
      when='Every record opens in a right-side sheet over its list, addressed by a query param. Header, sections (beside a side column on a two-column sheet), one footer. Everything saves together with the one Save, which closes the sheet.'
    >
      <Specimen
        label='Entity sheet'
        note='SheetFormHeader · SheetSection · SheetActivitySection (collapsed, last) · SheetFormFooter · side column (SHEET_SIDE_COLUMN_CLASSES.even, the company’s Client)'
      >
        {VARIANTS.map(option => {
          const Icon = option.icon
          return (
            <Button
              key={option.entity}
              variant='outline'
              onClick={() => setVariant(option)}
            >
              <Icon className={ENTITY_ACCENTS[option.entity].icon} />
              Open {option.noun} sheet
            </Button>
          )
        })}
        <SampleEntitySheet variant={variant} onClose={() => setVariant(null)} />
      </Specimen>

      <Specimen
        label='Widths'
        note='SheetContent columns={1} (720px: fits the full rich text toolbar) or columns={2} (1184px from lg), whose side column splits `default` (384px, invoice) or `even` (480px, lead and company): named splits only'
      >
        {SIZES.map(size => (
          <SizeSheet key={size} size={size} />
        ))}
      </Specimen>
    </DesignSection>
  )
}

function SizeSheet({ size }: { size: (typeof SIZES)[number] }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant='outline' size='sm' onClick={() => setOpen(true)}>
        {size === 1 ? 'One column' : 'Two columns'}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent columns={size}>
          <SheetHeader>
            <SheetTitle>{size === 1 ? 'One column' : 'Two columns'}</SheetTitle>
            <SheetDescription>
              {size === 1
                ? 'Person, task, project, hour block, submission, template.'
                : 'A form beside a side column: company (Client), lead, invoice.'}
            </SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    </>
  )
}

function SampleEntitySheet({
  variant,
  onClose,
}: {
  variant: Variant | null
  onClose: () => void
}) {
  const { toast } = useToast()
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [name, setName] = useState('')
  const [lastVariant, setLastVariant] = useState<Variant | null>(null)

  // Reset the form whenever a different sample opens.
  if (variant && variant !== lastVariant) {
    setLastVariant(variant)
    setName(variant.title)
  }
  const shown = variant ?? lastVariant
  if (!shown) return null
  const Icon = shown.icon

  return (
    <>
      <Sheet open={Boolean(variant)} onOpenChange={next => !next && onClose()}>
        <SheetContent
          hideCloseButton
          columns={2}
          className='flex h-full w-full flex-col gap-0 overflow-hidden p-0'
        >
          <SheetFormHeader
            entity={shown.entity}
            title={name || shown.title}
            leading={
              shown.entity === 'contact' ? (
                <UserAvatar name={name} hasPhoto={false} size='sm' />
              ) : (
                <Icon
                  aria-hidden
                  className={cn(
                    ENTITY_ACCENTS[shown.entity].icon,
                    'size-4 shrink-0'
                  )}
                />
              )
            }
            badges={
              shown.entity === 'company' ? (
                <ClientBadge />
              ) : shown.entity === 'contact' ? (
                <Badge variant='outline'>Sales</Badge>
              ) : (
                <LeadStatusBadge status='PROPOSAL_SENT' />
              )
            }
            menu={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant='ghost'
                    size='icon-sm'
                    aria-label={`${shown.noun} actions`}
                  >
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end'>
                  <DropdownMenuItem>Copy link</DropdownMenuItem>
                  <DropdownMenuItem>View activity</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            }
          />
          {/* Two columns: the record's form, then a side column (the
              company's Client). Below lg they stack into one scroll with the
              footer pinned to the bottom. */}
          <form
            id={FORM_ID}
            className='flex min-h-0 flex-1 max-lg:flex-col max-lg:overflow-y-auto'
            onSubmit={event => {
              event.preventDefault()
              toast({ title: `${capitalise(shown.noun)} saved` })
              onClose()
            }}
          >
            <div className='flex flex-1 flex-col overflow-hidden max-lg:contents lg:border-r'>
              <div className='flex flex-1 flex-col gap-6 px-6 pt-6 pb-8 lg:overflow-y-auto [&>*]:shrink-0'>
                <SheetSection>
                  <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                    <div className='space-y-2'>
                      <Label htmlFor='design-sheet-name'>Name</Label>
                      <Input
                        id='design-sheet-name'
                        data-autofocus
                        value={name}
                        onChange={event => setName(event.target.value)}
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='design-sheet-website'>Website</Label>
                      <Input
                        id='design-sheet-website'
                        defaultValue='acme.com'
                      />
                    </div>
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='design-sheet-notes'>Notes</Label>
                    <Textarea id='design-sheet-notes' rows={3} />
                  </div>
                </SheetSection>
                <EntityList
                  title='People'
                  add={{ label: 'Add person', onAdd: () => undefined }}
                  isEmpty={false}
                  emptyMessage='No people here yet.'
                >
                  <ContactRecordRow
                    contact={{
                      id: 'design-ada',
                      name: 'Ada Lovelace',
                      email: 'ada@acme.com',
                      jobTitle: 'Head of product',
                    }}
                    openable={false}
                  />
                  <ContactRecordRow
                    contact={{
                      id: 'design-grace',
                      name: 'Grace Hopper',
                      email: 'grace@acme.com',
                    }}
                    openable={false}
                  />
                </EntityList>
                <EntityList
                  title='Projects'
                  add={{ label: 'Create project', onAdd: () => undefined }}
                  isEmpty
                  emptyMessage='No projects yet.'
                />
                {/* The bottom of a sheet: comments or updates, then
                        the collapsed Activity, always last. */}
                <SheetSection
                  list
                  title='Comments'
                  icon={CONCEPT_ICONS.comment}
                >
                  <EmptyState message='No comments yet.' />
                </SheetSection>
                <SheetActivityDisclosure total={2}>
                  <ul className='text-muted-foreground space-y-2 pt-4 text-sm'>
                    <li>Ada Lovelace updated the website · Today</li>
                    <li>Grace Hopper created this {shown.noun} · Mon</li>
                  </ul>
                </SheetActivityDisclosure>
              </div>
              <div className='max-lg:sticky max-lg:bottom-0 max-lg:z-10 max-lg:order-last'>
                <SheetFormFooter
                  formId={FORM_ID}
                  saveLabel='Save'
                  submitDisabled={false}
                  submitDisabledReason={null}
                  undo={() => undefined}
                  redo={() => undefined}
                  canUndo={false}
                  canRedo={false}
                  isEditing
                  archiveDisabled={false}
                  archiveDisabledReason={null}
                  onRequestArchive={() => setArchiveOpen(true)}
                  archiveAriaLabel={`Archive ${shown.noun}`}
                />
              </div>
            </div>
            <div
              className={cn(
                'bg-muted/20 flex-shrink-0 max-lg:border-t lg:overflow-y-auto',
                SHEET_SIDE_COLUMN_CLASSES.even
              )}
            >
              <div className='flex flex-col gap-6 px-6 pt-6 pb-8'>
                <SheetSection title='Client'>
                  <div className='space-y-2'>
                    <Label>Billing type</Label>
                    <Select defaultValue='net-30'>
                      <SelectTrigger className='w-full sm:w-60'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='prepaid'>Prepaid</SelectItem>
                        <SelectItem value='net-30'>Net 30</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </SheetSection>
                <Separator />
                <SheetSection title='Portal access'>
                  <div className='flex items-center gap-2'>
                    <Switch id='design-sheet-portal' defaultChecked />
                    <Label htmlFor='design-sheet-portal'>
                      People at this company can sign in to the client portal
                    </Label>
                  </div>
                </SheetSection>
              </div>
            </div>
          </form>
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={archiveOpen}
        title={`Archive ${name || shown.title}?`}
        description='It leaves every list. You can restore it from the archive.'
        confirmLabel={`Archive ${shown.noun}`}
        confirmVariant='destructive'
        onConfirm={() => {
          setArchiveOpen(false)
          toast({ title: `${capitalise(shown.noun)} archived` })
          onClose()
        }}
        onCancel={() => setArchiveOpen(false)}
      />
    </>
  )
}

function capitalise(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
