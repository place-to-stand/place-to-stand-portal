'use client'

import { PENDING_REASON } from '@/lib/forms/form-controls'

import { PortalAccessControl } from '@/components/clients/portal-access-control'
import { useCompanyBilling } from './company-billing-section'
import { CompanyPeopleSection } from './company-people-section'

type CompanyPeopleTabProps = Omit<
  Parameters<typeof CompanyPeopleSection>[0],
  'portalAccessFor' | 'footer'
> & {
  /**
   * Portal access switches (people who can manage clients only), staged in
   * the company form; null hides them.
   */
  portal: {
    ids: string[]
    onChange: (contactId: string, on: boolean) => void
    disabled: boolean
  } | null
}

/**
 * The People section (on the Details tab): the list, plus each person's Portal switch while the
 * company is (or is becoming) billed, and on a former client, whose
 * switches show as they are (access returns with billing). Turning it on
 * for someone without a sign-in gives them one on Save.
 */
export function CompanyPeopleTab({ portal, ...props }: CompanyPeopleTabProps) {
  const billing = useCompanyBilling()
  const formerClient = billing.mode === 'former' && !billing.billingOn
  const showPortal =
    portal !== null &&
    billing.status === 'ready' &&
    (billing.billingOn || billing.mode === 'ending' || formerClient)

  const access = new Set(portal?.ids ?? [])
  const portalAccessFor = showPortal
    ? (contactId: string) => {
        const saved = props.contacts.find(contact => contact.id === contactId)
        const joining = props.added.find(contact => contact.id === contactId)
        const person = saved
          ? {
              id: saved.id,
              name: saved.name,
              email: saved.email,
              hasSignIn: saved.hasPortalLogin,
              signInDisabled: saved.signInDisabled,
            }
          : joining
            ? {
                id: joining.id,
                name: joining.name,
                email: joining.email,
                hasSignIn: null,
              }
            : null
        if (!person) return null
        return (
          <PortalAccessControl
            person={person}
            hasAccess={access.has(contactId)}
            disabled={portal.disabled}
            disabledReason={PENDING_REASON}
            showLabel={false}
            onChange={on => portal.onChange(contactId, on)}
          />
        )
      }
    : null

  // Saved people switched on who have no sign-in get one, and an invite
  // email, on Save. (Someone joining on Save might already have a sign-in,
  // so they aren't named here.)
  const removed = new Set(props.removedIds)
  const invitees = showPortal
    ? props.contacts.filter(
        contact =>
          access.has(contact.id) &&
          !contact.portalAccess &&
          !contact.hasPortalLogin &&
          !removed.has(contact.id)
      )
    : []
  // Each of them gets the note beside their own switch.
  const inviteeIds = new Set(invitees.map(contact => contact.id))
  const portalHintFor = (contactId: string) =>
    inviteeIds.has(contactId) ? 'Invite emailed when you save' : null

  const formerNote =
    showPortal && formerClient ? (
      <p className='text-muted-foreground text-xs'>
        Portal access returns if billing restarts.
      </p>
    ) : null

  return (
    <CompanyPeopleSection
      {...props}
      portalAccessFor={portalAccessFor}
      portalHintFor={portalHintFor}
      footer={formerNote}
    />
  )
}
