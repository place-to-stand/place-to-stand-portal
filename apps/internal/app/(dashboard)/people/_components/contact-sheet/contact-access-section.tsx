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
import { Input } from '@pts/ui/input'
import { Label } from '@pts/ui/label'
import { Skeleton } from '@pts/ui/skeleton'
import { Switch } from '@pts/ui/switch'
import { EffectiveMonthPicker } from '@/components/billing/effective-month-select'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import {
  FIELD_STACK_CLASS,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form'
import { toastLink, useToast } from '@/components/ui/use-toast'
import { useViewerAccess } from '@/components/providers/viewer-access-provider'
import { SaveSideEffect } from '@/components/sheets/save-side-effect'
import { sendPersonPasswordResetAction } from '@/app/(dashboard)/people/actions'
import { currentMonthStartUtc } from '@/lib/billing/months'
import type { PortalAccountSummary } from '@/lib/queries/users/portal-account'
import { SheetSection } from '@/components/sheets/sheet-section'
import { ENTITY_ICONS } from '@/lib/entity-accents'
import type {
  ContactCompanyEntry,
  ContactFormData,
} from '@/lib/people/use-contact-sheet-state'
import {
  defaultRoleMonth,
  monthLabel,
  rolePayrollWarning,
  type RoleMonthOption,
} from '@/lib/users/role-months'
import type { USER_ROLES } from '@/lib/users/user-validation'
import { RoleBadge } from '@/components/auth/role-badge'
import { ROLE_LABELS } from '@/lib/auth/roles'

type Role = (typeof USER_ROLES)[number]

// A–Z, as everywhere roles are listed.
const ALL_ROLES = [
  'ADMIN',
  'CLIENT',
  'SALES',
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
 * The person sheet's User section, like a company's Client section: a
 * "Can sign in" switch at the right of the heading creates (or switches off)
 * their sign-in on Save; once on, their Role says what they get into (Admin
 * or Sales: this portal; Client: the client portal, at the companies whose
 * Portal switch is on). Everything saves with the sheet's Save; the invite
 * goes out after it. Sales see that only an admin manages sign-ins.
 */
export function ContactSignInSection(props: ContactSignInSectionProps) {
  if (!props.canManage) {
    return (
      <SheetSection title='User' icon={ENTITY_ICONS.user}>
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
              link: toastLink('contact', contactId),
            }
          : {
              title: 'Password reset sent',
              description: `${personName || personEmail} gets a link to set a new password.`,
              link: toastLink('contact', contactId),
            }
      )
    })

  const who = personName || 'They'
  const live = Boolean(account && !account.disabledAt && !account.deletedAt)
  const roleChanged = Boolean(
    hasSignIn && account && enabled && role && role !== account.role
  )
  // Every role, always: Admin and Sales put them at the staff company, and
  // Client takes them off it again on Save (syncStaffMembership).
  const roles = ALL_ROLES
  const staffCompanyName =
    companies.find(entry => entry.isStaff && !entry.archived)?.companyName ??
    'the staff company'
  const leavesStaff =
    enabled && role === 'CLIENT' && isStaff && account?.role !== 'CLIENT'
  // What Save does, as a caution; or where they stand.
  const saveNote = !enabled
    ? live
      ? `${who} won’t be able to sign in once you save.`
      : null
    : !hasSignIn
      ? `Saving creates a sign-in for ${who} at ${personEmail} and emails them ${role === 'CLIENT' ? 'a link to the client portal' : 'an invite'}.`
      : !live
        ? `${who} can sign in again once you save.`
        : leavesStaff
          ? `Saving takes ${who} off ${staffCompanyName}: a Client isn’t staff.`
          : null

  return (
    <SheetSection
      title='User'
      icon={ENTITY_ICONS.user}
      // Fields, not a list: 16px under the heading (as the Client section).
      className='gap-4'
      action={
        <>
          {
            // Only a live, saved sign-in that stays on: a reset needs one.
            enabled && live && account ? (
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
                  // 16px from the switch, so the two read as separate controls.
                  className='mr-2'
                  disabled={isSending || isPending || isSelf}
                  onClick={sendReset}
                >
                  {isSending ? 'Sending…' : 'Send reset link'}
                </Button>
              </DisabledFieldTooltip>
            ) : null
          }
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
        </>
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
            // Fields, as in a company's Client section: the sign-in is a
            // state of this person, not a record of its own.
            <div className='grid grid-cols-1 items-start gap-4 sm:grid-cols-2'>
              <div className={FIELD_STACK_CLASS}>
                <Label htmlFor='contact-sign-in-email'>Signs in as</Label>
                {/* Shown so the sign-in reads whole; changed as Email above. */}
                <DisabledFieldTooltip
                  disabled
                  reason='Change it in Email above: they sign in with that address.'
                >
                  <Input
                    id='contact-sign-in-email'
                    value={personEmail}
                    placeholder='Add an email above'
                    disabled
                  />
                </DisabledFieldTooltip>
                <p className='text-muted-foreground text-xs'>
                  {!hasSignIn
                    ? 'New sign-in'
                    : live && account
                      ? `Last sign-in: ${formatRelativeTime(account.lastSignInAt) ?? 'never'}`
                      : null}
                </p>
              </div>
              <FormField
                control={form.control}
                name='signIn.role'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <DisabledFieldTooltip
                      disabled={Boolean(lockedReason)}
                      reason={lockedReason}
                    >
                      <Select
                        onValueChange={next => setSignIn(true, next as Role)}
                        value={field.value}
                        disabled={Boolean(lockedReason)}
                      >
                        <FormControl>
                          <SelectTrigger aria-label='Role' className='w-full'>
                            {/* The role reads as the badge it shows elsewhere. */}
                            <SelectValue>
                              {field.value ? (
                                <RoleBadge role={field.value} />
                              ) : null}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {roles.map(option => (
                            <SelectItem key={option} value={option}>
                              <RoleBadge role={option} />
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </DisabledFieldTooltip>
                  </FormItem>
                )}
              />
              {roleChanged ? (
                <FormField
                  control={form.control}
                  name='signIn.effectiveFrom'
                  render={({ field }) => (
                    <FormItem>
                      <Label htmlFor='contact-role-starts'>Role starts</Label>
                      <EffectiveMonthPicker
                        id='contact-role-starts'
                        ariaLabel='Role starts'
                        value={field.value}
                        onChange={field.onChange}
                        options={roleMonths}
                        disabled={Boolean(lockedReason)}
                        disabledReason={lockedReason}
                        className='w-full'
                      />
                      <FormDescription>
                        {(account &&
                          role &&
                          rolePayrollWarning(
                            account.role,
                            role,
                            field.value ?? '',
                            currentMonthStartUtc()
                          )) ??
                          `Counts toward the monthly close from ${monthLabel(field.value ?? '')}.`}
                      </FormDescription>
                    </FormItem>
                  )}
                />
              ) : null}
            </div>
          ) : null}
          {enabled && account?.scheduledRole && !roleChanged ? (
            <p className='text-muted-foreground text-sm'>
              Becomes {ROLE_LABELS[account.scheduledRole.role]} from{' '}
              {monthLabel(account.scheduledRole.effectiveFrom)}.
            </p>
          ) : null}
        </>
      )}
    </SheetSection>
  )
}
