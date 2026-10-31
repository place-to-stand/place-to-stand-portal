'use client'

import { useTransition } from 'react'
import { useWatch, type UseFormReturn } from 'react-hook-form'

import { Button } from '@pts/ui/button'
import { formatRelativeTime } from '@pts/ui/dates'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pts/ui/select'
import { Skeleton } from '@pts/ui/skeleton'
import { EffectiveMonthSelect } from '@/components/billing/effective-month-select'
import { PersonAccessChoice } from '@/components/contacts/person-access-choice'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { useToast } from '@/components/ui/use-toast'
import { useViewerAccess } from '@/components/providers/viewer-access-provider'
import { SaveSideEffect } from '@/components/sheets/save-side-effect'
import { sendPersonPasswordResetAction } from '@/app/(dashboard)/people/actions'
import { currentMonthStartUtc } from '@/lib/billing/months'
import type { PortalAccountSummary } from '@/lib/queries/users/portal-account'
import {
  accessKindOf,
  accessSummary,
  type AccessKind,
} from '@/lib/settings/contacts/person-access'
import type {
  ContactCompanyEntry,
  ContactFormData,
} from '@/lib/settings/contacts/use-contact-sheet-state'
import {
  defaultRoleMonth,
  monthLabel,
  rolePayrollWarning,
  type RoleMonthOption,
} from '@/lib/settings/users/role-months'
import type { USER_ROLES } from '@/lib/settings/users/user-validation'
import { RoleBadge } from '@/components/auth/role-badge'
import { ROLE_LABELS } from '@/lib/auth/roles'

type Role = (typeof USER_ROLES)[number]

const TEAM_ROLES = ['ADMIN', 'SALES'] as const satisfies readonly Role[]

/** The client companies they see in the portal, for the sentence. */
function seenCompanies(companies: readonly ContactCompanyEntry[]): string[] {
  return companies
    .filter(
      entry =>
        Boolean(entry.clientCompanyId) && !entry.archived && entry.portalAccess
    )
    .map(entry => entry.companyName || entry.clientName || 'Company')
}

/**
 * The choices on offer. Staff (at the agency's own company) are team or
 * nothing; the client portal stays listed only while it's what they have.
 */
function accessKindsFor(
  companies: readonly ContactCompanyEntry[],
  current: AccessKind
): AccessKind[] {
  const isStaff = companies.some(entry => entry.isStaff && !entry.archived)
  return isStaff && current !== 'portal'
    ? ['none', 'team']
    : ['none', 'portal', 'team']
}

type ContactAccessFieldsProps = {
  form: UseFormReturn<ContactFormData>
  /** The viewer can change sign-ins and portal access (admins). */
  canManage: boolean
  /** Their sign-in; undefined while loading, null when they have none. */
  account: PortalAccountSummary | null | undefined
  hasSignIn: boolean
  /** Their live sign-in's role as saved (for viewers who can't edit it). */
  savedRole: Role | null
  contactId: string | null
  personName: string
  /** Their email as typed: the one they sign in with after Save. */
  personEmail: string
  /** Months a role change can start from. */
  roleMonths: RoleMonthOption[]
  isPending: boolean
  pendingReason: string
}

/**
 * What can this person get into? One choice (No access, Client portal,
 * Team) over the data the sheet already saves: their sign-in (on/off and
 * role) and, for the client portal, each client membership's portal access.
 * Changes save with the sheet's Save. Read-only for anyone who can't
 * manage sign-ins (Sales).
 */
export function ContactAccessFields(props: ContactAccessFieldsProps) {
  if (!props.canManage) return <ReadOnlyAccess />
  return <ManagedAccess {...props} />
}

/** Sales: the saved state and its sentence, the choice locked. */
// Sign-ins are admin-only information (as on the people list): people who
// can't manage them see that, not someone's role or portal companies.
function ReadOnlyAccess() {
  return (
    <p className='text-muted-foreground text-sm'>
      Only an admin can see or change someone&rsquo;s access.
    </p>
  )
}

function ManagedAccess({
  form,
  account,
  hasSignIn,
  contactId,
  personName,
  personEmail,
  roleMonths,
  isPending,
  pendingReason,
}: ContactAccessFieldsProps) {
  const { toast } = useToast()
  const { userId: viewerId } = useViewerAccess()
  const [isSending, startSending] = useTransition()
  const enabled = useWatch({ control: form.control, name: 'signIn.enabled' })
  const role = useWatch({ control: form.control, name: 'signIn.role' })
  const companies = useWatch({ control: form.control, name: 'companies' }) ?? []

  if (hasSignIn && account === undefined) {
    return (
      <div className='flex flex-col gap-2'>
        <Skeleton className='h-9 w-72' />
        <Skeleton className='h-5 w-full' />
      </div>
    )
  }

  // Their sign-in exists but couldn't be loaded: don't offer choices that
  // would be judged against a blank form.
  if (hasSignIn && account === null) {
    return (
      <p className='text-muted-foreground text-sm'>
        Couldn&rsquo;t load their sign-in. Close and reopen the sheet to change
        their access.
      </p>
    )
  }

  const kind = accessKindOf({
    enabled: Boolean(enabled),
    role: role ?? 'CLIENT',
  })
  // A role change on an existing sign-in asks which month it starts.
  const roleChanged = Boolean(
    hasSignIn && account && kind !== 'none' && role && role !== account.role
  )
  const isSelf = Boolean(account && viewerId === account.id)
  const noEmail = !personEmail
  const lockedReason = isPending
    ? pendingReason
    : isSelf
      ? 'You can’t change your own sign-in.'
      : null
  const kinds = accessKindsFor(companies, kind)
  // A sign-in needs an email (it is the login).
  const disabledKinds: AccessKind[] =
    !hasSignIn && noEmail ? ['portal', 'team'] : []

  const savedPortalAccess = new Map(
    (form.formState.defaultValues?.companies ?? []).flatMap(entry =>
      entry?.companyId ? [[entry.companyId, Boolean(entry.portalAccess)]] : []
    )
  )

  const setCompanies = (next: ContactCompanyEntry[]) =>
    form.setValue('companies', next, { shouldDirty: true })

  const choose = (next: AccessKind) => {
    if (next === kind) return
    const month = currentMonthStartUtc()
    const nextRole: Role =
      next === 'none'
        ? (account?.role ?? 'CLIENT')
        : next === 'portal'
          ? 'CLIENT'
          : account && account.role !== 'CLIENT'
            ? account.role
            : role && role !== 'CLIENT'
              ? role
              : 'SALES'
    form.setValue(
      'signIn',
      {
        enabled: next !== 'none',
        role: nextRole,
        // Stopping being Admin starts next month by default, so this
        // month's hours still count as payroll.
        effectiveFrom: account
          ? defaultRoleMonth(account.role, nextRole, month)
          : month,
      },
      { shouldDirty: true }
    )
    // Team staff don't use the client portal: choosing Team turns every
    // company's portal access off (written on Save).
    if (next === 'team') {
      setCompanies(companies.map(entry => ({ ...entry, portalAccess: false })))
    } else if (kind === 'portal' || kind === 'team') {
      // Leaving Client portal for No access undoes the ticks made here (what
      // was saved stays, as turning a sign-in off always has); coming back
      // from Team restores what was saved.
      setCompanies(
        companies.map(entry => ({
          ...entry,
          portalAccess: savedPortalAccess.get(entry.companyId) ?? false,
        }))
      )
    }
  }

  const sendReset = () =>
    startSending(async () => {
      if (!contactId) return
      const result = await sendPersonPasswordResetAction(contactId)
      toast(
        result.error
          ? {
              title: 'Unable to send password reset',
              description: result.error,
              variant: 'destructive',
            }
          : {
              title: 'Password reset sent',
              description: `${personName || personEmail} gets a link to set a new password.`,
            }
      )
    })

  const summary = accessSummary({
    kind,
    email: personEmail,
    role: role ?? 'CLIENT',
    companies: seenCompanies(companies),
  })
  // A new sign-in is a save side effect: an account and an email.
  const createsSignIn = !hasSignIn && kind !== 'none'
  // A live sign-in turned off with this Save.
  const turnsOff = Boolean(
    account && !account.disabledAt && !account.deletedAt && kind === 'none'
  )
  const who = personName || 'They'

  return (
    <>
      <PersonAccessChoice
        value={kind}
        onChange={choose}
        kinds={kinds}
        disabledKinds={disabledKinds}
        lockedReason={lockedReason}
        hint={
          disabledKinds.length
            ? 'Add an email to give them a sign-in: it is how they sign in.'
            : null
        }
        summary={summary}
      >
        {kind === 'team' ? (
          <FormField
            control={form.control}
            name='signIn.role'
            render={({ field }) => (
              <FormItem className='sm:max-w-xs'>
                <FormLabel className='w-fit'>Role</FormLabel>
                <FormControl>
                  <DisabledFieldTooltip
                    disabled={Boolean(lockedReason)}
                    reason={lockedReason}
                  >
                    <Select
                      onValueChange={next => {
                        field.onChange(next)
                        if (account) {
                          form.setValue(
                            'signIn.effectiveFrom',
                            defaultRoleMonth(
                              account.role,
                              next as Role,
                              currentMonthStartUtc()
                            ),
                            { shouldDirty: true }
                          )
                        }
                      }}
                      value={field.value === 'CLIENT' ? 'SALES' : field.value}
                      disabled={Boolean(lockedReason)}
                    >
                      <SelectTrigger>
                        {/* The role reads as the badge it shows elsewhere. */}
                        <SelectValue>
                          {field.value ? (
                            <RoleBadge
                              role={
                                field.value === 'CLIENT' ? 'SALES' : field.value
                              }
                            />
                          ) : null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {TEAM_ROLES.map(option => (
                          <SelectItem key={option} value={option}>
                            <RoleBadge role={option} />
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </DisabledFieldTooltip>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}
        {roleChanged ? (
          <FormField
            control={form.control}
            name='signIn.effectiveFrom'
            render={({ field }) => (
              <FormItem>
                <EffectiveMonthSelect
                  id='contact-role-starts'
                  title='Role starts'
                  value={field.value}
                  onChange={field.onChange}
                  options={roleMonths}
                  note={
                    (account &&
                      role &&
                      rolePayrollWarning(
                        account.role,
                        role,
                        field.value ?? '',
                        currentMonthStartUtc()
                      )) ??
                    'The monthly close counts them in this role from this month. Closed months can’t be changed.'
                  }
                  disabled={Boolean(lockedReason)}
                  disabledReason={lockedReason}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}
        {account?.scheduledRole && !roleChanged ? (
          <p className='text-muted-foreground text-sm'>
            Becomes {ROLE_LABELS[account.scheduledRole.role]} from{' '}
            {monthLabel(account.scheduledRole.effectiveFrom)}.
          </p>
        ) : null}
      </PersonAccessChoice>

      {createsSignIn ? (
        <SaveSideEffect>
          {role === 'CLIENT'
            ? `${who} will get a client portal sign-in (${personEmail}) and an email link when you save.`
            : `${who} will get ${role === 'ADMIN' ? 'an Admin' : 'a Sales'} sign-in to this portal (${personEmail}) and an email invite when you save.`}
        </SaveSideEffect>
      ) : turnsOff ? (
        <SaveSideEffect>
          {who} won’t be able to sign in once you save.
        </SaveSideEffect>
      ) : null}

      {hasSignIn && account ? (
        <div className='flex flex-wrap items-center justify-between gap-3 text-sm'>
          <span className='text-muted-foreground'>
            Last sign-in: {formatRelativeTime(account.lastSignInAt) ?? 'never'}
          </span>
          <DisabledFieldTooltip
            disabled={isSending || isPending || isSelf}
            reason={isSelf ? 'Use Forgot password on the sign-in page.' : null}
            className='w-auto'
          >
            <Button
              type='button'
              variant='outline'
              size='sm'
              disabled={isSending || isPending || isSelf}
              onClick={sendReset}
            >
              {isSending ? 'Sending…' : 'Send password reset'}
            </Button>
          </DisabledFieldTooltip>
        </div>
      ) : null}
    </>
  )
}
