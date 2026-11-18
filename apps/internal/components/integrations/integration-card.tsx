import type { ReactNode } from 'react'

import { Button } from '@pts/ui/button'

type Props = {
  icon: ReactNode
  title: string
  /** One line on what connecting it is for. */
  description: string
  /** Right of the title: Connect, a status or nothing. */
  action?: ReactNode
  /** Rows under the header: the connected accounts or apps. */
  children?: ReactNode
}

/**
 * One integration, compact: icon, name and a one-line description on a
 * single row with its action on the right, and what's connected listed
 * underneath. Account → Integrations stacks them.
 */
export function IntegrationCard({
  icon,
  title,
  description,
  action,
  children,
}: Props) {
  return (
    <div className='bg-card rounded-lg border'>
      <div className='flex items-center gap-3 px-4 py-3'>
        <span className='flex size-5 shrink-0 items-center justify-center [&_svg]:size-5'>
          {icon}
        </span>
        <div className='flex min-w-0 flex-1 flex-col'>
          <span className='text-sm font-medium' data-slot='card-title'>
            {title}
          </span>
          <span className='text-muted-foreground text-xs'>{description}</span>
        </div>
        {action ? <div className='shrink-0'>{action}</div> : null}
      </div>
      {children ? <div className='divide-y border-t'>{children}</div> : null}
    </div>
  )
}

/** The right-hand slot while a card's status loads or when it fails. */
export function IntegrationStatus({ children }: { children: ReactNode }) {
  return <span className='text-muted-foreground text-xs'>{children}</span>
}

/** "Connect" for a card with nothing connected. */
export function IntegrationConnectButton({
  label = 'Connect',
  pending = false,
  onClick,
}: {
  label?: string
  pending?: boolean
  onClick: () => void
}) {
  return (
    <Button
      type='button'
      variant='outline'
      size='xs'
      disabled={pending}
      onClick={onClick}
    >
      {pending ? 'Connecting...' : label}
    </Button>
  )
}
