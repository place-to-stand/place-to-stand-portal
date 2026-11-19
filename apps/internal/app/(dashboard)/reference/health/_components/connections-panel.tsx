import { formatRelativeTime } from '@pts/ui/dates'

import type { ConnectionHealth } from '@/lib/health/queries'

import { HealthPanel, PanelNote, StateLabel } from './health-parts'

const PROVIDER_NAMES: Record<ConnectionHealth['provider'], string> = {
  GOOGLE: 'Google',
  GITHUB: 'GitHub',
  VERCEL: 'Vercel',
  SUPABASE: 'Supabase',
}

/**
 * Everyone's connected accounts and whether each still works, plus the
 * company-wide keys the portal needs, so a quietly broken one shows up.
 */
export function ConnectionsPanel({
  connections,
  keys,
  now,
}: {
  connections: ConnectionHealth[]
  keys: { name: string; set: boolean; does: string }[]
  now: Date
}) {
  const broken = connections.filter(row => row.status !== 'ACTIVE').length
  const missing = keys.filter(key => !key.set).length
  const problems = broken + missing

  return (
    <HealthPanel
      title='Connected accounts'
      status={problems ? `${problems} need a look` : 'All working'}
      alert={problems > 0}
    >
      <ul className='divide-y'>
        {connections.map(row => {
          const working = row.status === 'ACTIVE'
          return (
            <li
              key={row.id}
              className='grid grid-cols-1 gap-1 px-4 py-3 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_minmax(0,14rem)] md:gap-4'
            >
              <div className='flex flex-col gap-0.5'>
                <span className='text-sm font-semibold'>
                  {PROVIDER_NAMES[row.provider]}
                </span>
                <span className='text-muted-foreground text-sm'>
                  {row.ownerName}
                </span>
              </div>
              <span className='text-sm break-words'>{row.account ?? '—'}</span>
              <div className='flex flex-col gap-0.5'>
                <StateLabel alert={!working}>
                  {working ? 'Working' : 'Needs reconnecting'}
                </StateLabel>
                {!working ? (
                  <span className='text-muted-foreground text-xs'>
                    Only {row.ownerName} can reconnect it, in Account →
                    Integrations.
                  </span>
                ) : row.lastSyncAt ? (
                  <span className='text-muted-foreground text-xs'>
                    Last used {formatRelativeTime(row.lastSyncAt, now)}
                  </span>
                ) : null}
              </div>
            </li>
          )
        })}
        {keys.map(key => (
          <li
            key={key.name}
            className='grid grid-cols-1 gap-1 px-4 py-3 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_minmax(0,14rem)] md:gap-4'
          >
            <div className='flex flex-col gap-0.5'>
              <span className='text-sm font-semibold'>{key.name}</span>
              <span className='text-muted-foreground text-sm'>
                Company-wide
              </span>
            </div>
            <span className='text-sm'>{key.does}</span>
            <StateLabel alert={!key.set}>
              {key.set ? 'Set' : 'Not set'}
            </StateLabel>
          </li>
        ))}
      </ul>
      <PanelNote>
        Google tells the portal when a sign-in stops working, and its owner gets
        a notification. GitHub, Vercel and Supabase sign-ins are checked when
        someone uses them.
      </PanelNote>
    </HealthPanel>
  )
}
