'use client'

import { PENDING_REASON } from '@/lib/forms/form-controls'

import { PortalAccessControl } from '@/components/companies/portal-access-control'
import { useCompanyBilling } from './company-billing-section'
import { CompanyPeopleSection } from './company-people-section'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'

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
 * switches show as they are (access returns with billing). Only someone who
 * can already sign in can be switched on (sign-ins are made on the person
 * sheet).
 */
export function CompanyPeopleTab({ portal, ...props }: CompanyPeopleTabProps) {
  const billing = useCompanyBilling()
  const { open } = useSheetParams()
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
              signInRole: saved.signInRole,
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
            onChange={on => portal.onChange(contactId, on)}
            onOpenPerson={saved ? () => open('contact', saved.id) : undefined}
            notBilled={formerClient}
          />
        )
      }
    : null

  // Sign-ins are made on the person sheet, so no Save here invites anyone.
  const portalHintFor = () => null

  return (
    <CompanyPeopleSection
      {...props}
      portalAccessFor={portalAccessFor}
      portalHintFor={portalHintFor}
    />
  )
}
