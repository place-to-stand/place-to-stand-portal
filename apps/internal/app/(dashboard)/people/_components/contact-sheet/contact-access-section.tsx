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
import { Label } from '@pts/ui/label'
import { Skeleton } from '@pts/ui/skeleton'
import { Switch } from '@pts/ui/switch'
import { EffectiveMonthSelect } from '@/components/billing/effective-month-select'
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
import { SheetSection } from '@/components/sheets/sheet-section'
import { ENTITY_ICONS } from '@/lib/entity-accents'
import { listNames } from '@/lib/settings/contacts/person-access'
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

const ALL_ROLES = [
  'ADMIN',
  'SALES',
  'CLIENT',
] as const satisfies readonly Role[]

type ContactSignInSectionProps = {
  form: UseFormReturn<ContactFormData>
  /** The viewer can change sign-ins and portal access (admins). */
  canManage: boolean
  /** Their sign-in; undefined while loading, null when they have none. */
  account: PortalAccountSummary | null | undefined
  hasSignIn: boolean
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
 * The person sheet's Sign-in section, like a company's Client section: a
 * "Can sign in" switch at the right of the heading creates (or switches off)
 * their sign-in on Save; once on, their Role says what they get into (Admin
 * or Sales: this portal; Client: the client portal, at the companies whose
 * Portal switch is on). Everything saves with the sheet's Save; the invite
 * goes out after it. Sales see that only an admin manages sign-ins.
 */
export function ContactSignInSection(props: ContactSignInSectionProps) {
  if (!props.canManage) {
    return (
      <SheetSection title='Sign-in' icon={ENTITY_ICONS.user}>
        <p className='text-muted-foreground text-sm'>
          Only an admin can see or change someone&rsquo;s sign-in.
        </p>
      </SheetSection>
    )
  }
  return <ManagedSignIn {...props} />
}

function ManagedSignIn({
  form,
  account,
  hasSignIn,
  contactId,
  personName,
  personEmail,
  roleMonths,
  isPending,
  pendingReason,
}: ContactSignInSectionProps) {
  const { toast } = useToast()
  const { userId: viewerId } = useViewerAccess()
  const [isSending, startSending] = useTransition()
  const enabled = Boolean(
    useWatch({ control: form.control, name: 'signIn.enabled' })
  )
  const role = useWatch({ control: form.control, name: 'signIn.role' })
  const companies = useWatch({ control: form.control, name: 'companies' }) ?? []

  const loading = hasSignIn && account === undefined
  const loadFailed = hasSignIn && account === null
  const isSelf = Boolean(account && viewerId === account.id)
  const isStaff = companies.some(entry => entry.isStaff && !entry.archived)
  const noEmail = !personEmail.trim()
  const lockedReason = isPending
    ? pendingReason
    : isSelf
      ? 'You can’t change your own sign-in.'
      : loading || loadFailed
        ? 'Their sign-in is still loading.'
        : null
  // A new sign-in needs an email: it is how they sign in.
  const switchReason =
    lockedReason ??
    (!hasSignIn && !enabled && noEmail
      ? 'Add an email first: it is how they sign in.'
      : null)

  const savedPortalAccess = new Map(
    (form.formState.defaultValues?.companies ?? []).flatMap(entry =>
      entry?.companyId ? [[entry.companyId, Boolean(entry.portalAccess)]] : []
    )
  )
  const setCompanies = (next: ContactCompanyEntry[]) =>
    form.setValue('companies', next, { shouldDirty: true })

  const setSignIn = (nextEnabled: boolean, nextRole: Role) => {
    const month = currentMonthStartUtc()
    form.setValue(
      'signIn',
      {
        enabled: nextEnabled,
        role: nextRole,
        // Stopping being Admin starts next month by default, so this
        // month's hours still count as payroll.
        effectiveFrom: account
          ? defaultRoleMonth(account.role, nextRole, month)
          : month,
      },
      { shouldDirty: true }
    )
    // Staff don't use the client portal: off everywhere (written on Save).
    // Back to Client restores what was saved.
    if (nextEnabled && nextRole !== 'CLIENT') {
      setCompanies(companies.map(entry => ({ ...entry, portalAccess: false })))
    } else if (nextRole === 'CLIENT' && role !== 'CLIENT') {
      setCompanies(
        companies.map(entry => ({
          ...entry,
          portalAccess: savedPortalAccess.get(entry.companyId) ?? false,
        }))
      )
    }
  }

  const switchOn = (on: boolean) =>
    setSignIn(
      on,
      // Their saved role, else Sales for staff and Client for everyone else.
      account?.role ??
        (on ? (isStaff ? 'SALES' : 'CLIENT') : (role ?? 'CLIENT'))
    )

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

  const who = personName || 'They'
  const live = Boolean(account && !account.disabledAt && !account.deletedAt)
  const roleChanged = Boolean(
    hasSignIn && account && enabled && role && role !== account.role
  )
  // Staff sign in here, not to the client portal (kept while it's theirs).
  const roles =
    isStaff && role !== 'CLIENT'
      ? ALL_ROLES.filter(option => option !== 'CLIENT')
      : ALL_ROLES
  const seen = companies
    .filter(
      entry =>
        Boolean(entry.clientCompanyId) && !entry.archived && entry.portalAccess
    )
    .map(entry => entry.companyName || entry.clientName || 'Company')

  // What Save does, as a caution; or where they stand.
  const saveNote = !enabled
    ? live
      ? `${who} won’t be able to sign in once you save.`
      : null
    : !hasSignIn
      ? `Saving creates a sign-in for ${who} at ${personEmail} and emails them ${role === 'CLIENT' ? 'a link to the client portal' : 'an invite'}.`
      : !live
        ? `${who} can sign in again once you save.`
        : null

  return (
    <SheetSection
      title='Sign-in'
      icon={ENTITY_ICONS.user}
      // Fields, not a list: 16px under the heading (as the Client section).
      className='gap-4'
      action={
        <DisabledFieldTooltip
          disabled={Boolean(switchReason)}
          reason={switchReason}
          className='w-auto'
        >
          <span className='flex items-center gap-2'>
            <Switch
              id='contact-sign-in-switch'
              checked={enabled}
              disabled={Boolean(switchReason)}
              onCheckedChange={switchOn}
            />
            <Label htmlFor='contact-sign-in-switch'>Can sign in</Label>
          </span>
        </DisabledFieldTooltip>
      }
    >
      {loading ? (
        <div className='flex flex-col gap-2'>
          <Skeleton className='h-9 w-72' />
          <Skeleton className='h-5 w-full' />
        </div>
      ) : loadFailed ? (
        <p className='text-muted-foreground text-sm'>
          Couldn&rsquo;t load their sign-in. Close and reopen the sheet to
          change it.
        </p>
      ) : (
        <>
          {saveNote ? <SaveSideEffect>{saveNote}</SaveSideEffect> : null}
          {enabled ? (
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
              <FormField
                control={form.control}
                name='signIn.role'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className='w-fit'>Role</FormLabel>
                    <FormControl>
                      <DisabledFieldTooltip
                        disabled={Boolean(lockedReason)}
                        reason={lockedReason}
                      >
                        <Select
                          onValueChange={next => setSignIn(true, next as Role)}
                          value={field.value}
                          disabled={Boolean(lockedReason)}
                        >
                          <SelectTrigger>
                            {/* The role reads as the badge it shows elsewhere. */}
                            <SelectValue>
                              {field.value ? (
                                <RoleBadge role={field.value} />
                              ) : null}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map(option => (
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
              <div className='flex flex-col gap-2'>
                <span className='text-sm font-medium'>Signs in with</span>
                <span className='flex h-9 items-center text-sm break-all'>
                  {personEmail || '—'}
                </span>
              </div>
            </div>
          ) : null}
          {enabled ? (
            <p className='text-muted-foreground text-sm'>
              {role === 'ADMIN'
                ? 'Admins sign in to this portal and see everything.'
                : role === 'SALES'
                  ? 'Sales sign in to this portal: leads, people, companies, and their own tasks and projects.'
                  : seen.length
                    ? `Sees ${listNames(seen)} in the client portal. Turn Portal on or off on each company above.`
                    : 'Sees no companies in the client portal yet. Turn Portal on for a client company above.'}
            </p>
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
          {enabled && account?.scheduledRole && !roleChanged ? (
            <p className='text-muted-foreground text-sm'>
              Becomes {ROLE_LABELS[account.scheduledRole.role]} from{' '}
              {monthLabel(account.scheduledRole.effectiveFrom)}.
            </p>
          ) : null}
          {/* Only a live, saved sign-in that stays on: a reset needs one. */}
          {enabled && live && account ? (
            <div className='flex flex-wrap items-center justify-between gap-3 text-sm'>
              <span className='text-muted-foreground'>
                Last sign-in:{' '}
                {formatRelativeTime(account.lastSignInAt) ?? 'never'}
              </span>
              <DisabledFieldTooltip
                disabled={isSending || isPending || isSelf}
                reason={
                  isSelf ? 'Use Forgot password on the sign-in page.' : null
                }
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
      )}
    </SheetSection>
  )
}
