'use client'

import { useState } from 'react'
import { Star, UserCheck, X } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { EmptyState } from '@pts/ui/empty-state'
import { RowActionButton } from '@pts/ui/row-action-button'
import { Switch } from '@pts/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@pts/ui/tooltip'
import { ContactRecordRow } from '@/components/sheets/entity-record-rows'
import { SheetRecordList } from '@/components/sheets/sheet-record-row'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'
import { useCreatePortalUser } from '@/lib/settings/contacts/use-create-portal-user'
import { PromoteToUserDialog } from '@/app/(dashboard)/people/_components/contact-sheet/promote-to-user-dialog'

type ClientContactOption = {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  /** Has a portal user (`contacts.user_id`). */
  hasPortalAccess: boolean
  /** Portal user's sign-in switched off on the Users page: no access until it's back on. */
  signInDisabled?: boolean
  companyId?: string | null
  /** The company's primary contact (read-only here). */
  isPrimary?: boolean
}

function PortalUserMark() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span aria-label='Has a portal user'>
          <UserCheck className='text-success h-3 w-3' />
        </span>
      </TooltipTrigger>
      <TooltipContent>Has a portal user</TooltipContent>
    </Tooltip>
  )
}

function PrimaryNote() {
  return (
    <span className='text-muted-foreground inline-flex items-center gap-1'>
      <Star className='text-warning size-3 fill-current' />
      Primary contact
    </span>
  )
}

export type ClientPortalAccessListProps = {
  /** The client's company; its people are the list. */
  companyId: string | null
  /** Everyone at the company (with or without access). */
  companyPeople: ClientContactOption[]
  /** Who has access now (staged until Save). */
  selectedContacts: ClientContactOption[]
  isPending: boolean
  pendingReason: string
  onGrant: (contact: ClientContactOption) => void
  onRevoke: (contact: ClientContactOption) => void
}

/**
 * Portal access: every person at the client's company, each with a switch.
 * People are added on the company; access is the client's own choice, since
 * not every company wants everyone in. Changes save with the sheet.
 * Access rows for anyone not at the company (older rows, or the client was
 * unlinked) are listed after, flagged, with remove only.
 */
export function ClientPortalAccessList({
  companyId,
  companyPeople,
  selectedContacts,
  isPending,
  pendingReason,
  onGrant,
  onRevoke,
}: ClientPortalAccessListProps) {
  const { open } = useSheetParams()
  // Portal users created here, so their rows switch over without a reload.
  const [createdUserIds, setCreatedUserIds] = useState<Set<string>>(
    () => new Set()
  )
  const [createTarget, setCreateTarget] = useState<ClientContactOption | null>(
    null
  )
  // Which row is creating, so only that row shows it (one at a time).
  const [creatingId, setCreatingId] = useState<string | null>(null)
  const { createPortalUser, isPending: isCreatingUser } = useCreatePortalUser()
  const people = companyPeople.map(contact =>
    createdUserIds.has(contact.id)
      ? { ...contact, hasPortalAccess: true }
      : contact
  )
  const selectedIds = new Set(selectedContacts.map(contact => contact.id))
  const companyIds = new Set(companyPeople.map(contact => contact.id))
  const outsiders = selectedContacts.filter(
    contact => !companyIds.has(contact.id)
  )

  const confirmCreate = () => {
    const target = createTarget
    setCreateTarget(null)
    if (!target) return
    setCreatingId(target.id)
    createPortalUser(target, {
      onSuccess: () => {
        setCreatedUserIds(previous => new Set(previous).add(target.id))
        setCreatingId(null)
      },
      onError: () => setCreatingId(null),
    })
  }

  if (companyPeople.length === 0 && outsiders.length === 0) {
    return companyId ? (
      <EmptyState
        message='No people at this company yet. Add them on the company.'
        label='Open company'
        onClick={() => open('company', companyId)}
      />
    ) : (
      <EmptyState message='Link a company first: its people are listed here.' />
    )
  }

  return (
    <>
      <SheetRecordList>
        {people.map(contact => {
          const label = contact.name ?? contact.email ?? 'this person'
          const hasAccess = selectedIds.has(contact.id)
          return (
            <ContactRecordRow
              key={contact.id}
              contact={contact}
              titleAddon={contact.hasPortalAccess ? <PortalUserMark /> : null}
              note={
                contact.signInDisabled ? (
                  <span className='text-warning'>
                    Sign-in off (Users page): no access until it&apos;s back on
                  </span>
                ) : contact.isPrimary ? (
                  <PrimaryNote />
                ) : contact.hasPortalAccess ? undefined : (
                  'No portal user'
                )
              }
              actions={
                // Access needs a portal user; create it here (same dialog and
                // action as the contact sheet). The switch still saves with Save.
                !contact.hasPortalAccess && !hasAccess ? (
                  (() => {
                    const isCreatingThis =
                      isCreatingUser && creatingId === contact.id
                    const createReason = isPending
                      ? pendingReason
                      : !contact.email
                        ? 'Add an email to this person first'
                        : isCreatingUser && !isCreatingThis
                          ? 'Creating another portal user'
                          : null
                    return (
                      <DisabledFieldTooltip
                        disabled={Boolean(createReason)}
                        reason={createReason}
                        className='w-auto'
                      >
                        <Button
                          type='button'
                          variant='outline'
                          size='xs'
                          disabled={Boolean(createReason) || isCreatingThis}
                          onClick={() => setCreateTarget(contact)}
                        >
                          {isCreatingThis ? 'Creating…' : 'Create user'}
                        </Button>
                      </DisabledFieldTooltip>
                    )
                  })()
                ) : (
                  <DisabledFieldTooltip
                    disabled={isPending}
                    reason={isPending ? pendingReason : null}
                    className='w-auto'
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className='inline-flex px-1.5'>
                          <Switch
                            checked={hasAccess}
                            disabled={isPending}
                            aria-label={`Portal access for ${label}`}
                            onCheckedChange={checked =>
                              checked ? onGrant(contact) : onRevoke(contact)
                            }
                          />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {hasAccess ? 'Has portal access' : 'No portal access'}
                      </TooltipContent>
                    </Tooltip>
                  </DisabledFieldTooltip>
                )
              }
            />
          )
        })}
        {outsiders.map(contact => {
          const label = contact.name ?? contact.email ?? 'this person'
          return (
            <ContactRecordRow
              key={contact.id}
              contact={contact}
              titleAddon={contact.hasPortalAccess ? <PortalUserMark /> : null}
              note={
                <span className='text-warning'>
                  {companyId ? 'Not at this company' : 'No linked company'}
                </span>
              }
              actions={
                <DisabledFieldTooltip
                  disabled={isPending}
                  reason={isPending ? pendingReason : null}
                  className='w-auto'
                >
                  <RowActionButton
                    type='button'
                    label={`Remove ${label} from Portal access`}
                    icon={<X />}
                    className='text-muted-foreground hover:text-destructive'
                    disabled={isPending}
                    onClick={() => onRevoke(contact)}
                  />
                </DisabledFieldTooltip>
              }
            />
          )
        })}
      </SheetRecordList>
      <PromoteToUserDialog
        open={Boolean(createTarget)}
        onOpenChange={next => {
          if (!next) setCreateTarget(null)
        }}
        contactName={createTarget?.name || createTarget?.email || ''}
        contactEmail={createTarget?.email || ''}
        isPending={isCreatingUser}
        onConfirm={confirmCreate}
      />
    </>
  )
}

/**
 * One person's portal access, for a row on the company's People list: a
 * switch once they have a sign-in, "Create sign-in" before. The switch is
 * staged and saves with the sheet.
 */
export function PortalAccessControl({
  contact,
  hasAccess,
  isPending,
  pendingReason,
  onGrant,
  onRevoke,
}: {
  contact: ClientContactOption
  hasAccess: boolean
  isPending: boolean
  pendingReason: string
  onGrant: (contact: ClientContactOption) => void
  onRevoke: (contact: ClientContactOption) => void
}) {
  const [created, setCreated] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { createPortalUser, isPending: isCreating } = useCreatePortalUser()
  const label = contact.name ?? contact.email ?? 'this person'
  const hasSignIn = contact.hasPortalAccess || created

  if (!hasSignIn && !hasAccess) {
    const reason = isPending
      ? pendingReason
      : !contact.email
        ? 'Add an email to this person first'
        : null
    return (
      <>
        <DisabledFieldTooltip
          disabled={Boolean(reason)}
          reason={reason}
          className='w-auto'
        >
          <Button
            type='button'
            variant='outline'
            size='xs'
            disabled={Boolean(reason) || isCreating}
            onClick={() => setConfirmOpen(true)}
          >
            {isCreating ? 'Creating…' : 'Create sign-in'}
          </Button>
        </DisabledFieldTooltip>
        <PromoteToUserDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          contactName={label}
          contactEmail={contact.email ?? ''}
          isPending={isCreating}
          onConfirm={() => {
            setConfirmOpen(false)
            createPortalUser(contact, { onSuccess: () => setCreated(true) })
          }}
        />
      </>
    )
  }

  return (
    <DisabledFieldTooltip
      disabled={isPending}
      reason={isPending ? pendingReason : null}
      className='w-auto'
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <span className='inline-flex items-center gap-1.5 px-1.5'>
            <span className='text-muted-foreground text-xs'>Portal</span>
            <Switch
              checked={hasAccess}
              disabled={isPending}
              aria-label={`Portal access for ${label}`}
              onCheckedChange={checked =>
                checked ? onGrant(contact) : onRevoke(contact)
              }
            />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {contact.signInDisabled
            ? 'Their sign-in is off: no access until it’s back on'
            : hasAccess
              ? 'Can see this client in the portal'
              : 'Can’t see this client in the portal'}
        </TooltipContent>
      </Tooltip>
    </DisabledFieldTooltip>
  )
}
