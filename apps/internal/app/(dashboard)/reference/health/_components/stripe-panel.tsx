import { formatRelativeTime } from '@pts/ui/dates'

import type { StripeHealth } from '@/lib/health/runs'

import { HealthPanel, PanelNote, Stat } from './health-parts'

/**
 * Whether Stripe's payment messages reach the portal and get booked. Money
 * that arrives but can't be booked is what this exists to catch.
 */
export function StripePanel({
  stripe,
  now,
}: {
  stripe: StripeHealth
  now: Date
}) {
  const problems = stripe.unmatched30d + stripe.failed30d
  const last = formatRelativeTime(stripe.lastEventAt, now)

  return (
    <HealthPanel
      title='Stripe payments'
      status={
        !stripe.recorded
          ? 'Not recorded yet'
          : problems
            ? `${problems} need a look`
            : 'Booking'
      }
      alert={problems > 0}
    >
      <dl className='grid grid-cols-2 divide-x divide-y sm:grid-cols-4 sm:divide-y-0'>
        <Stat
          label='Last message from Stripe'
          value={last ?? 'None yet'}
          hint='Every payment, checkout and expiry. Days of silence while invoices are out is a warning.'
        />
        <Stat
          label='Paid through Stripe'
          value={stripe.booked30d}
          hint='Invoices paid by card or bank through Stripe, last 30 days.'
        />
        <Stat
          label='Not booked'
          value={stripe.unmatched30d}
          hint='Money that arrived but matched no payable invoice. Refund it or reissue.'
          alert={stripe.unmatched30d > 0}
        />
        <Stat
          label='Failed'
          value={stripe.failed30d}
          hint='Messages the portal errored on and Stripe hasn’t yet retried successfully. Stripe retries for 3 days.'
          alert={stripe.failed30d > 0}
        />
      </dl>
      {stripe.recentProblems.length ? (
        <ul className='divide-y border-t'>
          {stripe.recentProblems.map(problem => (
            <li
              key={`${problem.at}-${problem.name}`}
              className='flex flex-col gap-0.5 px-4 py-2.5 md:flex-row md:gap-4'
            >
              <span className='text-muted-foreground shrink-0 text-xs md:w-32'>
                {formatRelativeTime(problem.at, now)}
              </span>
              <span className='text-sm break-words'>
                {problem.detail ?? problem.name}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <PanelNote>
        Recorded from this release on, and kept 90 days. Stripe&rsquo;s
        dashboard has the full history.
      </PanelNote>
    </HealthPanel>
  )
}
