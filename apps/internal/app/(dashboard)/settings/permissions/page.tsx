import type { Metadata } from 'next'
import { Check, ChevronRight, Info, Minus } from 'lucide-react'

import { Badge } from '@pts/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@pts/ui/tooltip'
import { PageShell } from '@/components/layout/page-shell'
import {
  CAPABILITIES,
  PERMISSION_ROLES,
  capabilityScope,
  roleCan,
  type CapabilitySurface,
} from '@/lib/auth/capabilities'
import {
  buildPermissionsRegistry,
  type CapabilityWithEndpoints,
} from '@/lib/auth/permissions-registry'
import { ROLE_LABELS } from '@/lib/auth/roles'
import { requireRole } from '@/lib/auth/session'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { cn } from '@/lib/utils'

import { EndpointList } from './_components/endpoint-list'

export const metadata: Metadata = {
  title: 'Roles & permissions | Settings',
}

const SURFACE_LABELS: Record<CapabilitySurface, string> = {
  app: 'Portal',
  mcp: 'MCP',
  cli: 'CLI',
}

const GRID =
  'grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_9rem]'

/**
 * Settings → Roles & permissions, generated from the registry: what each
 * role can do (`lib/auth/capabilities.ts`) and every endpoint that enforces
 * it (`permissions-manifest.json`, built from the code and checked by
 * `npm run lint`). Changing a permission is a code change; this page follows.
 */
export default async function PermissionsPage() {
  await requireRole('ADMIN')
  const registry = buildPermissionsRegistry()
  const roleTotals = PERMISSION_ROLES.map(role => ({
    role,
    count: Object.keys(CAPABILITIES).filter(key =>
      roleCan(role, key as keyof typeof CAPABILITIES)
    ).length,
  }))
  const capabilityCount = Object.keys(CAPABILITIES).length

  return (
    <PageShell breadcrumbs={crumbsForNav('/settings/permissions')}>
      <div className='w-full space-y-6'>
        <section className='grid gap-3 sm:grid-cols-3'>
          {roleTotals.map(({ role, count }) => (
            <div
              key={role}
              className='bg-background rounded-xl border p-4 shadow-sm'
            >
              <p className='text-muted-foreground text-xs font-medium'>
                {ROLE_LABELS[role]}
              </p>
              <p className='mt-1 text-2xl font-semibold tabular-nums'>
                {count}
                <span className='text-muted-foreground text-sm font-normal'>
                  {' '}
                  of {capabilityCount} permissions
                </span>
              </p>
            </div>
          ))}
          <div className='bg-background rounded-xl border p-4 shadow-sm'>
            <p className='text-muted-foreground text-xs font-medium'>
              Endpoints checked
            </p>
            <p className='mt-1 text-2xl font-semibold tabular-nums'>
              {registry.totals.all}
            </p>
            <p className='text-muted-foreground text-xs'>
              {registry.totals.capability} by permission ·{' '}
              {registry.totals.admin} admin only ·{' '}
              {registry.totals.public + registry.totals.token} public or token
            </p>
          </div>
        </section>

        <p className='text-muted-foreground text-sm'>
          Generated from the code: each permission lists the pages, actions and
          API routes that check it, and the MCP tools behind it. Anything not
          listed is admin only.
        </p>

        {registry.areas.map(({ area, capabilities }) => (
          <section
            key={area}
            className='bg-background overflow-hidden rounded-xl border shadow-sm'
            aria-labelledby={`area-${area}`}
          >
            <div className={cn(GRID, 'bg-muted/40 border-b px-4 py-2.5')}>
              <h2 id={`area-${area}`} className='text-sm font-semibold'>
                {area}
              </h2>
              {PERMISSION_ROLES.map(role => (
                <span
                  key={role}
                  className='text-muted-foreground text-center text-xs font-medium'
                >
                  {ROLE_LABELS[role]}
                </span>
              ))}
              <span className='text-muted-foreground hidden text-xs font-medium sm:block'>
                Applies in
              </span>
            </div>
            <ul className='divide-y'>
              {capabilities.map(capability => (
                <CapabilityRow key={capability.key} capability={capability} />
              ))}
            </ul>
          </section>
        ))}

        <section className='bg-background overflow-hidden rounded-xl border shadow-sm'>
          <div className='bg-muted/40 border-b px-4 py-2.5'>
            <h2 className='text-sm font-semibold'>Admin only</h2>
            <p className='text-muted-foreground text-xs'>
              Everything else checks for the admin role, by section.
            </p>
          </div>
          <ul className='divide-y'>
            {registry.adminOnly.map(({ section, endpoints }) => (
              <li key={section}>
                <details className='group'>
                  <summary className='hover:bg-muted/40 flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm'>
                    <ChevronRight className='text-muted-foreground size-4 transition-transform group-open:rotate-90' />
                    <span className='font-medium capitalize'>
                      {section.replace(/-/g, ' ')}
                    </span>
                    <span className='text-muted-foreground ml-auto text-xs tabular-nums'>
                      {endpoints.length}
                    </span>
                  </summary>
                  <div className='px-10 pb-3'>
                    <EndpointList endpoints={endpoints} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>

        <section className='bg-background overflow-hidden rounded-xl border shadow-sm'>
          <details className='group'>
            <summary className='bg-muted/40 flex cursor-pointer list-none items-center gap-2 px-4 py-2.5'>
              <ChevronRight className='text-muted-foreground size-4 transition-transform group-open:rotate-90' />
              <span className='text-sm font-semibold'>
                Public and token-checked
              </span>
              <span className='text-muted-foreground ml-auto text-xs tabular-nums'>
                {registry.open.length}
              </span>
            </summary>
            <div className='px-10 py-3'>
              <p className='text-muted-foreground mb-2 text-xs'>
                Sign-in, share links, webhooks and crons. Each says why in a `//
                permission: public` comment or checks a token.
              </p>
              <EndpointList endpoints={registry.open} />
            </div>
          </details>
        </section>
      </div>
    </PageShell>
  )
}

function CapabilityRow({
  capability,
}: {
  capability: CapabilityWithEndpoints
}) {
  const definition = CAPABILITIES[capability.key]
  const total = capability.endpoints.length + capability.mcpTools.length
  const limits = PERMISSION_ROLES.flatMap(role => {
    const scope = roleCan(role, capability.key)
      ? capabilityScope(capability.key, role)
      : undefined
    return scope ? [{ role: ROLE_LABELS[role], detail: scope.detail }] : []
  })

  return (
    <li>
      <details className='group'>
        <summary
          className={cn(
            GRID,
            'hover:bg-muted/40 cursor-pointer list-none px-4 py-3'
          )}
        >
          <div className='flex min-w-0 items-start gap-2'>
            <ChevronRight
              className={cn(
                'text-muted-foreground mt-0.5 size-4 shrink-0 transition-transform group-open:rotate-90',
                total === 0 && 'invisible'
              )}
            />
            <div className='min-w-0'>
              <p className='flex items-center gap-1 text-sm font-medium'>
                {definition.label}
                {limits.length ? (
                  // The roles a data rule narrows, once per row, not under
                  // every tick.
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className='text-muted-foreground cursor-help'
                        aria-label={limits
                          .map(limit => `${limit.role}: ${limit.detail}`)
                          .join(' ')}
                      >
                        <Info className='size-3.5' aria-hidden />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {limits.map(limit => (
                        <p key={limit.role}>
                          {limit.role}: {limit.detail}
                        </p>
                      ))}
                    </TooltipContent>
                  </Tooltip>
                ) : null}
              </p>
              <p className='text-muted-foreground text-xs'>
                {definition.description}
              </p>
            </div>
          </div>
          {PERMISSION_ROLES.map(role => {
            const allowed = roleCan(role, capability.key)
            return (
              <div
                key={role}
                className='flex flex-col items-center text-center'
              >
                {allowed ? (
                  <Check className='text-success size-4' aria-label='Allowed' />
                ) : (
                  <Minus
                    className='text-muted-foreground/40 size-4'
                    aria-label='Not allowed'
                  />
                )}
              </div>
            )
          })}
          <div className='hidden flex-wrap gap-1 sm:flex'>
            {definition.surfaces.map(surface => (
              <Badge key={surface} variant='outline' className='text-xs'>
                {SURFACE_LABELS[surface]}
              </Badge>
            ))}
          </div>
        </summary>
        {total > 0 ? (
          <div className='space-y-3 px-10 pb-4'>
            <EndpointList endpoints={capability.endpoints} />
            {capability.mcpTools.length ? (
              <div className='flex flex-wrap items-center gap-1.5'>
                <span className='text-muted-foreground text-xs'>
                  MCP tools:
                </span>
                {capability.mcpTools.map(tool => (
                  <code
                    key={tool}
                    className='bg-muted rounded px-1.5 py-0.5 font-mono text-xs'
                  >
                    {tool}
                  </code>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </details>
    </li>
  )
}
