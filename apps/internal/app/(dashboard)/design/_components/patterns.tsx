import { Archive, Link2, Plus, Save } from 'lucide-react'

import { ToastCard } from '@/components/ui/toast-card'
import { Badge } from '@pts/ui/badge'
import { Button } from '@pts/ui/button'
import { EmptyState } from '@pts/ui/empty-state'
import { Input } from '@pts/ui/input'
import { Switch } from '@pts/ui/switch'
import { SheetFooterBar } from '@/components/sheets/sheet-form-footer'

import { DesignSection, DoDont } from './specimen'

/**
 * A miniature sheet frame for the do/don't examples (layout only). `parts`
 * names what the sheet shows: one section, or a two-column sheet's columns
 * (the company's Company and Client).
 */
function MiniSheet({
  parts,
  children,
}: {
  parts: string[]
  children: React.ReactNode
}) {
  return (
    <div className='bg-background w-full overflow-hidden rounded-lg border text-sm shadow-sm'>
      <div className='text-muted-foreground flex divide-x border-b text-xs'>
        {parts.map(part => (
          <span key={part} className='flex-1 px-3 py-1.5'>
            {part}
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
        why='Everything in a sheet, both columns of a two-column sheet included, saves together. Save is always enabled (only a save in flight or a real validation failure disables it) and a successful save closes the sheet.'
        doExample={
          <MiniSheet parts={['Company', 'Client']}>
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
        doCaption='One footer, one Save, for both columns.'
        dontExample={
          <MiniSheet parts={['Company', 'Client']}>
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
        dontCaption='A Save per section, or a Save that waits for changes.'
      />

      <DoDont
        rule='Related records stack'
        why='Opening a person, company, lead or task from inside a sheet opens its own sheet on top; closing it goes back to the sheet underneath, where you were. Small focused tasks (link a repo, email an invoice, log time) can use a dialog.'
        doExample={
          <MiniSheet parts={['People']}>
            <div className='space-y-2 p-3'>
              <span className='font-semibold'>People</span>
              <div className='bg-background flex items-center justify-between rounded-md border px-3 py-2'>
                Ada Lovelace
                <span className='text-muted-foreground text-xs'>
                  Opens on top
                </span>
              </div>
            </div>
          </MiniSheet>
        }
        doCaption='Click a person: their sheet stacks on top; Close returns to the company.'
        dontExample={
          <MiniSheet parts={['People']}>
            <div className='space-y-2 p-3'>
              <span className='font-semibold'>People</span>
              <div className='bg-background flex items-center justify-between rounded-md border px-3 py-2'>
                Ada Lovelace
                <span className='text-muted-foreground text-xs'>
                  Leaves this page
                </span>
              </div>
            </div>
          </MiniSheet>
        }
        dontCaption='Navigating away or replacing the sheet, so you lose your place.'
      />

      <DoDont
        rule='One Save, one transaction'
        why='Every control in a sheet changes the form; Save writes the record and everything with it (people, billing, sign-in, links) at once, or nothing. Comments, lead updates, logging time, invoice send and void, and planning are their own actions and save on their own click.'
        doExample={
          <MiniSheet parts={['People']}>
            <div className='space-y-2 p-3'>
              <div className='bg-background flex items-center justify-between rounded-md border px-3 py-2'>
                Ada Lovelace
                <Switch defaultChecked aria-label='Portal access' />
              </div>
              <div className='flex justify-end'>
                <Button size='sm'>Save</Button>
              </div>
            </div>
          </MiniSheet>
        }
        doCaption='Flip the portal switch, then Save: the company, its people and their access commit together.'
        dontExample={
          <MiniSheet parts={['People']}>
            <div className='space-y-2 p-3'>
              <div className='bg-background flex items-center justify-between rounded-md border px-3 py-2'>
                Ada Lovelace
                <span className='text-muted-foreground text-xs'>
                  Saved on toggle
                </span>
              </div>
              <p className='text-destructive text-xs'>
                Company saved, but its people were not.
              </p>
            </div>
          </MiniSheet>
        }
        dontCaption='Saving on toggle, or in several steps that can half-fail.'
      />

      <DoDont
        rule='Create and edit are the same sheet'
        why='A new record shows every section and field it will have. What needs the new record (its people, billing, sign-in) is filled in now and saved with it. Only history, dates, archive and share links wait until it exists.'
        doExample={
          <MiniSheet parts={['Company', 'Client']}>
            <div className='text-muted-foreground p-3'>
              New company: both columns, the Bill this company switch included.
            </div>
          </MiniSheet>
        }
        doCaption='Create a company with its people and billing in one pass.'
        dontExample={
          <MiniSheet parts={['Company']}>
            <div className='text-muted-foreground p-3'>
              Save, close and reopen to make it a client.
            </div>
          </MiniSheet>
        }
        dontCaption='A create sheet that hides parts until the record exists.'
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
        doCaption='One switch per person, on the company’s People section.'
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
                Add person
              </Button>
              <Button size='sm' variant='destructive'>
                Archive company
              </Button>
            </div>
            <EmptyState message='No people here yet.' />
          </div>
        }
        doCaption='"Add person", "Archive company", "No people here yet."'
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
    <ToastCard
      title={title}
      description={description}
      variant={destructive ? 'destructive' : 'success'}
      className='shadow-none'
    />
  )
}
