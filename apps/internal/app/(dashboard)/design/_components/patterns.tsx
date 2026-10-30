import { Archive, Link2, Plus, Save } from 'lucide-react'

import { Badge } from '@pts/ui/badge'
import { Button } from '@pts/ui/button'
import { EmptyState } from '@pts/ui/empty-state'
import { Input } from '@pts/ui/input'
import { Switch } from '@pts/ui/switch'
import { SheetFooterBar } from '@/components/sheets/sheet-form-footer'

import { DesignSection, DoDont } from './specimen'

/** A miniature sheet frame for the do/don't examples (layout only). */
function MiniSheet({
  tabs,
  children,
}: {
  tabs: string[]
  children: React.ReactNode
}) {
  return (
    <div className='bg-background w-full overflow-hidden rounded-lg border text-sm shadow-sm'>
      <div className='flex gap-4 border-b px-3 pt-2'>
        {tabs.map((tab, index) => (
          <span
            key={tab}
            className={
              index === 0
                ? 'border-foreground border-b-2 pb-1.5 font-medium'
                : 'text-muted-foreground pb-1.5'
            }
          >
            {tab}
          </span>
        ))}
      </div>
      {children}
    </div>
  )
}

export function PatternsHouseRules() {
  return (
    <DesignSection
      id='house-rules'
      title='House rules'
      when='The behaviours that make every screen work the same way. When a design bends one of these, it is the design that changes.'
    >
      <DoDont
        rule='One Save per sheet'
        why='All tabs of a sheet stay mounted and save together. Save is always enabled (only a save in flight or a real validation failure disables it) and a successful save closes the sheet.'
        doExample={
          <MiniSheet tabs={['Details', 'People', 'Billing']}>
            <div className='space-y-2 p-3'>
              <Input defaultValue='Acme Industries' aria-label='Name' />
            </div>
            <SheetFooterBar>
              <Button size='xs'>Save</Button>
              <Button
                size='icon-sm'
                variant='destructive'
                aria-label='Archive company'
              >
                <Archive />
              </Button>
            </SheetFooterBar>
          </MiniSheet>
        }
        doCaption='One footer, one Save, for every tab.'
        dontExample={
          <MiniSheet tabs={['Details', 'People', 'Billing']}>
            <div className='flex items-center gap-2 p-3'>
              <Input defaultValue='Acme Industries' aria-label='Name' />
              <Button size='sm' variant='outline'>
                <Save />
                Save details
              </Button>
            </div>
            <div className='flex justify-end border-t p-2'>
              <Button size='xs' disabled>
                Save
              </Button>
            </div>
          </MiniSheet>
        }
        dontCaption='A Save per tab, or a Save that waits for changes.'
      />

      <DoDont
        rule='Nothing pops over a sheet except a destructive confirm'
        why='Edit inline, in a sheet section. The only thing allowed on top of a sheet is a ConfirmDialog for an action that destroys or can’t be undone; a related record opens as its own sheet.'
        doExample={
          <MiniSheet tabs={['People']}>
            <div className='space-y-2 p-3'>
              <div className='flex items-center justify-between'>
                <span className='font-semibold'>People</span>
                <Button size='xs' variant='outline'>
                  <Plus />
                  Add person
                </Button>
              </div>
              <div className='bg-muted/40 rounded-md border px-3 py-2'>
                Ada Lovelace
              </div>
            </div>
          </MiniSheet>
        }
        doCaption='Add and edit inside the section; open a record as a sheet.'
        dontExample={
          <MiniSheet tabs={['People']}>
            <div className='relative p-3'>
              <div className='text-muted-foreground opacity-40'>
                Ada Lovelace
              </div>
              <div className='bg-popover absolute inset-x-6 top-2 rounded-lg border p-3 shadow-lg'>
                <p className='font-medium'>Edit person</p>
                <Input className='mt-2' defaultValue='Ada' aria-label='Name' />
              </div>
              <div className='h-16' />
            </div>
          </MiniSheet>
        }
        dontCaption='A dialog or popover editing a record over the sheet.'
      />

      <DoDont
        rule='One control per job'
        why='Each setting has exactly one control, in one place. Two controls for the same state make people wonder which one wins.'
        doExample={
          <div className='flex items-center gap-2'>
            <Switch id='design-rule-portal' defaultChecked />
            <label htmlFor='design-rule-portal' className='text-sm'>
              Portal access
            </label>
          </div>
        }
        doCaption='One switch, in Edit client › Portal access.'
        dontExample={
          <div className='flex flex-wrap items-center gap-3'>
            <Switch defaultChecked aria-label='Portal access' />
            <Badge variant='outline'>Portal: on</Badge>
            <Button size='sm' variant='outline'>
              Disable portal
            </Button>
          </div>
        }
        dontCaption='A switch, a status badge and a button for the same setting.'
      />
    </DesignSection>
  )
}

export function PatternsCopy() {
  return (
    <DesignSection
      id='copy'
      title='Copy'
      when='Sentence case, verbs first, the entity named. No emoji, no exclamation marks, no marketing adjectives.'
    >
      <DoDont
        rule='Create, Add, Link'
        why='Create makes a new record. Add puts an existing record on a list. Link joins a company and its client, the same record seen from two sides.'
        doExample={
          <>
            <Button size='sm'>
              <Plus />
              Create company
            </Button>
            <Button size='sm' variant='outline'>
              <Plus />
              Add person
            </Button>
            <Button size='sm' variant='outline'>
              <Link2 />
              Link client
            </Button>
          </>
        }
        doCaption='The verb says whether a record is made, listed or joined.'
        dontExample={
          <>
            <Button size='sm'>New</Button>
            <Button size='sm' variant='outline'>
              Add new record
            </Button>
            <Button size='sm' variant='outline'>
              Connect
            </Button>
          </>
        }
        dontCaption='Vague verbs, or no entity at all.'
      />

      <DoDont
        rule='Name the entity'
        why='Copy uses the entity names: company, person, client, sign-in, lead, project, task, invoice, hour block. Never a stand-in such as user, account, login, contact or record.'
        doExample={
          <div className='w-full space-y-3'>
            <div className='flex flex-wrap gap-2'>
              <Button size='sm' variant='outline'>
                Create sign-in
              </Button>
              <Button size='sm' variant='destructive'>
                Archive company
              </Button>
            </div>
            <EmptyState message='No people here yet.' />
          </div>
        }
        doCaption='"Create sign-in", "Archive company", "No people here yet."'
        dontExample={
          <div className='w-full space-y-3'>
            <div className='flex flex-wrap gap-2'>
              <Button size='sm' variant='outline'>
                Create login
              </Button>
              <Button size='sm' variant='destructive'>
                Delete account
              </Button>
            </div>
            <EmptyState message='No records found!' />
          </div>
        }
        dontCaption='"Create login", "Delete account", "Add user", "No records found!"'
      />

      <DoDont
        rule='Toasts: past tense, or "Unable to…"'
        why='Success is short and past tense. Failure reads "Unable to <verb> <noun>" with the reason in the description.'
        doExample={
          <div className='w-full space-y-2 text-sm'>
            <ToastMock title='Invoice sent' />
            <ToastMock
              title='Unable to save invoice'
              description='The billing email is missing.'
              destructive
            />
          </div>
        }
        doCaption='"Invoice sent" · "Unable to save invoice"'
        dontExample={
          <div className='w-full space-y-2 text-sm'>
            <ToastMock title='Invoice was sent successfully!' />
            <ToastMock title='Error: Failed to save' destructive />
          </div>
        }
        dontCaption='"…successfully!", "Error", "Failed to…"'
      />
    </DesignSection>
  )
}

/** A static picture of a toast (the real one fires from Toasts and errors). */
function ToastMock({
  title,
  description,
  destructive = false,
}: {
  title: string
  description?: string
  destructive?: boolean
}) {
  return (
    <div
      className={
        destructive
          ? 'border-destructive/40 bg-destructive/5 rounded-lg border px-3 py-2'
          : 'bg-popover rounded-lg border px-3 py-2 shadow-sm'
      }
    >
      <p
        className={destructive ? 'text-destructive font-medium' : 'font-medium'}
      >
        {title}
      </p>
      {description ? (
        <p className='text-muted-foreground text-xs'>{description}</p>
      ) : null}
    </div>
  )
}
