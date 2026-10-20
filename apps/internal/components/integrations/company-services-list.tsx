'use client'

import { useQuery } from '@tanstack/react-query'
import { FileInput, Landmark, RefreshCw } from 'lucide-react'
import {
  siGithub,
  siGooglechat,
  siPosthog,
  siResend,
  siStripe,
  siVercel,
} from 'simple-icons/icons'
import type { ReactNode } from 'react'

import { Badge } from '@pts/ui/badge'
import { BADGE_TINTS } from '@pts/ui/badge-tints'
import { RowActionButton } from '@pts/ui/row-action-button'
import { Skeleton } from '@pts/ui/skeleton'
import { cn } from '@/lib/utils'
import type {
  CompanyService,
  CompanyServiceId,
} from '@/lib/types/integrations'

function BrandIcon({ icon }: { icon: { title: string; path: string } }) {
  return (
    <svg
      role='img'
      viewBox='0 0 24 24'
      className='size-4'
      xmlns='http://www.w3.org/2000/svg'
      fill='currentColor'
    >
      <title>{icon.title}</title>
      <path d={icon.path} />
    </svg>
  )
}

const SERVICES: Record<
  CompanyServiceId,
  { name: string; purpose: string; icon: ReactNode }
> = {
  stripe: {
    name: 'Stripe',
    purpose: 'Invoice card payments and their sales tax',
    icon: <BrandIcon icon={siStripe} />,
  },
  mercury: {
    name: 'Mercury',
    purpose: 'Bank balances for the profit share',
    icon: <Landmark className='size-4' />,
  },
  resend: {
    name: 'Resend',
    purpose: 'Invoice, client update and form emails',
    icon: <BrandIcon icon={siResend} />,
  },
  google_chat: {
    name: 'Google Chat',
    purpose: 'Paid-invoice alerts in the Sales space',
    icon: <BrandIcon icon={siGooglechat} />,
  },
  marketing_forms: {
    name: 'Website forms',
    purpose: 'Contact and audit submissions',
    icon: <FileInput className='size-4' />,
  },
  posthog: {
    name: 'PostHog',
    purpose: 'Analytics and error tracking',
    icon: <BrandIcon icon={siPosthog} />,
  },
  ai_gateway: {
    name: 'Vercel AI Gateway',
    purpose: 'Planning and activity summaries',
    icon: <BrandIcon icon={siVercel} />,
  },
  github_app: {
    name: 'GitHub App',
    purpose: 'Repository access for linked projects',
    icon: <BrandIcon icon={siGithub} />,
  },
}

const GROUPS: ReadonlyArray<{ label: string; ids: CompanyServiceId[] }> = [
  { label: 'Money', ids: ['stripe', 'mercury'] },
  { label: 'Messaging', ids: ['resend', 'google_chat', 'marketing_forms'] },
  { label: 'Platform', ids: ['posthog', 'ai_gateway', 'github_app'] },
]

// Only a live check earns green; a variable that's merely present stays
// quiet, so the eye lands on what needs attention.
const STATUS: Record<CompanyService['status'], { label: string; tint: string }> =
  {
    connected: { label: 'Connected', tint: BADGE_TINTS.emerald },
    configured: { label: 'Configured', tint: BADGE_TINTS.neutral },
    not_configured: { label: 'Not set up', tint: BADGE_TINTS.neutral },
    error: { label: 'Needs attention', tint: BADGE_TINTS.rose },
  }

function ServiceRow({ service }: { service: CompanyService }) {
  const meta = SERVICES[service.id]
  const status = STATUS[service.status]
  const isProblem = service.status === 'error'
  const isOff = service.status === 'not_configured'

  return (
    <li className='flex items-start gap-3 border-t px-4 py-3'>
      <span
        className={cn(
          'mt-0.5 shrink-0',
          isOff ? 'text-muted-foreground' : 'text-foreground'
        )}
      >
        {meta.icon}
      </span>
      <div className='min-w-0 flex-1'>
        <div className='flex flex-wrap items-baseline gap-x-2'>
          <span
            className={cn(
              'text-sm font-medium',
              isOff && 'text-muted-foreground'
            )}
          >
            {meta.name}
          </span>
          <span className='text-muted-foreground text-sm'>{meta.purpose}</span>
        </div>
        {isProblem && service.detail ? (
          <p className='text-destructive mt-0.5 text-xs'>{service.detail}</p>
        ) : null}
        {isProblem || isOff ? (
          <p className='text-muted-foreground mt-0.5 font-mono text-xs'>
            {service.envVars.join(' · ')}
          </p>
        ) : service.detail ? (
          <p className='text-muted-foreground mt-0.5 truncate text-xs md:hidden'>
            {service.detail}
          </p>
        ) : null}
      </div>
      {!isProblem && service.detail ? (
        <span className='text-muted-foreground hidden max-w-72 truncate pt-0.5 text-xs md:block'>
          {service.detail}
        </span>
      ) : null}
      <Badge variant='outline' className={cn('shrink-0', status.tint)}>
        {status.label}
      </Badge>
    </li>
  )
}

/**
 * Every company service the portal reaches through server env vars, grouped
 * by job. Stripe and Mercury are checked live; the rest report whether their
 * variables are set.
 */
export function CompanyServicesList() {
  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['companyServicesStatus'],
    queryFn: async () => {
      const res = await fetch('/api/integrations/services/status')
      if (!res.ok) throw new Error('Unable to check services')
      const body = (await res.json()) as { ok: boolean; data: CompanyService[] }
      return body.data
    },
  })

  const byId = new Map(data?.map(service => [service.id, service]))

  return (
    <div className='bg-card overflow-hidden rounded-xl border shadow-sm'>
      <div className='flex items-center justify-between gap-3 px-4 py-2.5'>
        <span className='text-muted-foreground text-xs'>
          {isLoading
            ? 'Checking…'
            : isError
              ? 'Unable to check services.'
              : 'Checked just now'}
        </span>
        <RowActionButton
          label='Check again'
          icon={<RefreshCw />}
          disabled={isFetching}
          className={cn(isFetching && '[&_svg]:animate-spin')}
          onClick={() => void refetch()}
        />
      </div>
      {GROUPS.map(group => (
        <section key={group.label} aria-label={group.label}>
          <h3 className='bg-muted/40 text-muted-foreground border-t px-4 py-1.5 text-[11px] font-semibold tracking-wide uppercase'>
            {group.label}
          </h3>
          <ul>
            {group.ids.map(id => {
              const service = byId.get(id)
              return service ? (
                <ServiceRow key={id} service={service} />
              ) : (
                <li key={id} className='border-t px-4 py-3'>
                  <Skeleton className='h-5 w-2/3' />
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
