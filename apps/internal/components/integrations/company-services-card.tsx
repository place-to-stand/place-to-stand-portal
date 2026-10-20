'use client'

import { useQuery } from '@tanstack/react-query'
import {
  CircleAlert,
  CircleCheck,
  CircleMinus,
  FileInput,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import {
  siGithub,
  siGooglechat,
  siPosthog,
  siResend,
  siStripe,
  siVercel,
} from 'simple-icons/icons'
import type { ReactNode } from 'react'

import { Button } from '@pts/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@pts/ui/card'
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
    purpose: 'Card payments on shared invoices, with each one’s sales tax.',
    icon: <BrandIcon icon={siStripe} />,
  },
  resend: {
    name: 'Resend',
    purpose: 'Invoice, client update, and website form emails.',
    icon: <BrandIcon icon={siResend} />,
  },
  posthog: {
    name: 'PostHog',
    purpose: 'Product analytics and error tracking.',
    icon: <BrandIcon icon={siPosthog} />,
  },
  ai_gateway: {
    name: 'Vercel AI Gateway',
    purpose: 'AI planning and activity summaries.',
    icon: <BrandIcon icon={siVercel} />,
  },
  github_app: {
    name: 'GitHub App',
    purpose: 'Repository access for linked projects.',
    icon: <BrandIcon icon={siGithub} />,
  },
  google_chat: {
    name: 'Google Chat',
    purpose: 'Paid-invoice alerts in the Sales space.',
    icon: <BrandIcon icon={siGooglechat} />,
  },
  marketing_forms: {
    name: 'Website forms',
    purpose: 'Contact and audit submissions from placetostandagency.com.',
    icon: <FileInput className='size-4' />,
  },
}

const STATUS: Record<
  CompanyService['status'],
  { label: string; icon: ReactNode; className: string }
> = {
  connected: {
    label: 'Connected',
    icon: <CircleCheck className='size-3.5' />,
    className: 'text-success',
  },
  configured: {
    label: 'Set up',
    icon: <CircleCheck className='size-3.5' />,
    className: 'text-success',
  },
  not_configured: {
    label: 'Not set up',
    icon: <CircleMinus className='size-3.5' />,
    className: 'text-muted-foreground',
  },
  error: {
    label: 'Needs attention',
    icon: <CircleAlert className='size-3.5' />,
    className: 'text-destructive',
  },
}

function ServiceRow({ service }: { service: CompanyService }) {
  const meta = SERVICES[service.id]
  const status = STATUS[service.status]
  const showEnv =
    service.status === 'not_configured' || service.status === 'error'

  return (
    <li className='flex items-start gap-3 border-t px-3 py-2.5 first:border-t-0'>
      <span className='text-foreground/80 mt-0.5 shrink-0'>{meta.icon}</span>
      <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
        <div className='flex items-center justify-between gap-3'>
          <span className='text-sm font-medium'>{meta.name}</span>
          <span
            className={cn(
              'flex shrink-0 items-center gap-1 text-xs font-medium',
              status.className
            )}
          >
            {status.icon}
            {status.label}
          </span>
        </div>
        <span className='text-muted-foreground text-xs'>{meta.purpose}</span>
        {service.detail ? (
          <span
            className={cn(
              'text-xs',
              service.status === 'error'
                ? 'text-destructive'
                : 'text-foreground/80'
            )}
          >
            {service.detail}
          </span>
        ) : null}
        {showEnv ? (
          <span className='text-muted-foreground font-mono text-[11px]'>
            {service.envVars.join(' · ')}
          </span>
        ) : null}
      </div>
    </li>
  )
}

/**
 * Every company service the portal talks to through server env vars. Stripe
 * is checked live; the rest report whether their variables are set.
 */
export function CompanyServicesCard() {
  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['companyServicesStatus'],
    queryFn: async () => {
      const res = await fetch('/api/integrations/services/status')
      if (!res.ok) throw new Error('Failed to check services')
      const body = (await res.json()) as { ok: boolean; data: CompanyService[] }
      return body.data
    },
  })

  return (
    <Card className='gap-4'>
      <CardHeader>
        <CardTitle className='flex items-center justify-between gap-2'>
          Services
          <Button
            type='button'
            variant='ghost'
            size='icon-sm'
            className='text-muted-foreground'
            aria-label='Check services again'
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            <RefreshCw className={cn(isFetching && 'animate-spin')} />
          </Button>
        </CardTitle>
        <CardDescription>
          Change these in the internal app’s Vercel environment, then redeploy.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className='flex items-center gap-3 rounded-lg border p-3'>
            <Loader2 className='text-muted-foreground size-5 animate-spin' />
            <span className='text-sm font-medium'>Checking services…</span>
          </div>
        ) : isError || !data ? (
          <div className='border-destructive/35 bg-destructive/5 dark:bg-destructive/10 flex items-center gap-3 rounded-lg border p-3'>
            <CircleAlert className='text-destructive size-5 shrink-0' />
            <span className='text-destructive text-sm font-medium'>
              Unable to check services
            </span>
          </div>
        ) : (
          <ul className='overflow-hidden rounded-lg border'>
            {data.map(service => (
              <ServiceRow key={service.id} service={service} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
