import type { Metadata } from 'next'
import { Check, Minus } from 'lucide-react'

import { Badge } from '@pts/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pts/ui/table'
import { PageShell } from '@/components/layout/page-shell'
import {
  CAPABILITIES,
  CAPABILITY_AREAS,
  PERMISSION_ROLES,
  capabilityScope,
  roleCan,
  type Capability,
  type CapabilitySurface,
} from '@/lib/auth/capabilities'
import { ROLE_LABELS } from '@/lib/auth/roles'
import { requireRole } from '@/lib/auth/session'
import { MCP_TOOL_CAPABILITIES } from '@/lib/mcp/tool-capabilities'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'

export const metadata: Metadata = {
  title: 'Roles & permissions | Settings',
}

const SURFACE_LABELS: Record<CapabilitySurface, string> = {
  app: 'Portal',
  mcp: 'MCP',
  cli: 'CLI',
}

const CAPABILITY_KEYS = Object.keys(CAPABILITIES) as Capability[]

function toolsFor(capability: Capability): string[] {
  return Object.entries(MCP_TOOL_CAPABILITIES)
    .filter(([, required]) => required === capability)
    .map(([tool]) => tool)
}

/**
 * Read-only view of `lib/auth/capabilities.ts`: every capability, which
 * roles hold it, where it's enforced, and the MCP tools behind it. Changing
 * a permission is a code change to that file, so this page can't drift.
 */
export default async function PermissionsPage() {
  await requireRole('ADMIN')

  return (
    <PageShell breadcrumbs={crumbsForNav('/settings/permissions')}>
      <div className='space-y-6'>
        <p className='text-muted-foreground max-w-3xl text-sm'>
          What each role can do across the portal, the MCP connector and the
          CLI. Anything not listed is admin-only. A note under a check means
          the role has it only within that scope.
        </p>
        {CAPABILITY_AREAS.map(area => {
          const keys = CAPABILITY_KEYS.filter(
            key => CAPABILITIES[key].area === area
          )
          if (!keys.length) return null

          return (
            <section
              key={area}
              className='bg-background rounded-xl border shadow-sm'
              aria-labelledby={`area-${area}`}
            >
              <h2
                id={`area-${area}`}
                className='border-b px-4 py-3 text-sm font-semibold'
              >
                {area}
              </h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='w-[45%]'>Permission</TableHead>
                    {PERMISSION_ROLES.map(role => (
                      <TableHead key={role} className='w-[15%] text-center'>
                        {ROLE_LABELS[role]}
                      </TableHead>
                    ))}
                    <TableHead>Applies in</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.map(key => {
                    const capability = CAPABILITIES[key]
                    const tools = toolsFor(key)
                    return (
                      <TableRow key={key}>
                        <TableCell className='align-top whitespace-normal'>
                          <div className='font-medium'>{capability.label}</div>
                          <div className='text-muted-foreground text-xs'>
                            {capability.description}
                          </div>
                          {tools.length ? (
                            <div className='text-muted-foreground mt-1 font-mono text-[11px]'>
                              MCP: {tools.join(', ')}
                            </div>
                          ) : null}
                        </TableCell>
                        {PERMISSION_ROLES.map(role => {
                          const allowed = roleCan(role, key)
                          const scope = capabilityScope(key, role)
                          return (
                            <TableCell
                              key={role}
                              className='text-center align-top whitespace-normal'
                            >
                              {allowed ? (
                                <Check
                                  className='text-success mx-auto size-4'
                                  aria-label='Allowed'
                                />
                              ) : (
                                <Minus
                                  className='text-muted-foreground/50 mx-auto size-4'
                                  aria-label='Not allowed'
                                />
                              )}
                              {allowed && scope ? (
                                <div className='text-muted-foreground mt-1 text-xs'>
                                  {scope}
                                </div>
                              ) : null}
                            </TableCell>
                          )
                        })}
                        <TableCell className='align-top'>
                          <div className='flex flex-wrap gap-1'>
                            {capability.surfaces.map(surface => (
                              <Badge key={surface} variant='outline'>
                                {SURFACE_LABELS[surface]}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </section>
          )
        })}
      </div>
    </PageShell>
  )
}
