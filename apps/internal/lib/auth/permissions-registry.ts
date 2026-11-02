import 'server-only'

import {
  CAPABILITIES,
  CAPABILITY_AREAS,
  type Capability,
  type CapabilityArea,
} from '@/lib/auth/capabilities'
import { MCP_TOOL_CAPABILITIES } from '@/lib/mcp/tool-capabilities'

import manifest from './permissions-manifest.json'

/**
 * Joins the two halves of the permissions registry for Settings → Roles &
 * permissions: `capabilities.ts` (what each role may do) and the generated
 * `permissions-manifest.json` (every endpoint and the guard it calls; run
 * `npm run permissions-manifest`, checked by `npm run lint`).
 */
export type EndpointType = 'route' | 'action' | 'page'

export type Endpoint = {
  type: EndpointType
  name: string
  file: string
  kind: 'capability' | 'admin' | 'token' | 'public' | 'delegated'
  capability: string | null
}

const endpoints = manifest as Endpoint[]

export type CapabilityWithEndpoints = {
  key: Capability
  endpoints: Endpoint[]
  mcpTools: string[]
}

export type PermissionsRegistry = {
  areas: { area: CapabilityArea; capabilities: CapabilityWithEndpoints[] }[]
  /** Admin-only endpoints, by the section of the app they belong to. */
  adminOnly: { section: string; endpoints: Endpoint[] }[]
  open: Endpoint[]
  totals: Record<Endpoint['kind'], number> & { all: number }
}

/** `/api/clients/[id]`, `app/(dashboard)/clients/…` or `lib/settings/…` → "clients" / "settings". */
function sectionOf(endpoint: Endpoint) {
  const path = endpoint.file
    .replace(/^apps\/internal\/(?:app|lib|components)\//, '')
    .split('/')
    .filter(part => !/^\(.*\)$/.test(part) && part !== 'api' && part !== 'v1')
  return path[0]?.replace(/\.tsx?$/, '') || 'other'
}

export function buildPermissionsRegistry(): PermissionsRegistry {
  const keys = Object.keys(CAPABILITIES) as Capability[]
  const byCapability = new Map<string, Endpoint[]>()
  for (const endpoint of endpoints) {
    if (endpoint.kind !== 'capability' || !endpoint.capability) continue
    const list = byCapability.get(endpoint.capability) ?? []
    list.push(endpoint)
    byCapability.set(endpoint.capability, list)
  }

  const areas = CAPABILITY_AREAS.map(area => ({
    area,
    capabilities: keys
      .filter(key => CAPABILITIES[key].area === area)
      .map(key => ({
        key,
        endpoints: byCapability.get(key) ?? [],
        mcpTools: Object.entries(MCP_TOOL_CAPABILITIES)
          .filter(([, capability]) => capability === key)
          .map(([tool]) => tool),
      })),
  })).filter(group => group.capabilities.length > 0)

  const sections = new Map<string, Endpoint[]>()
  for (const endpoint of endpoints) {
    if (endpoint.kind !== 'admin') continue
    const section = sectionOf(endpoint)
    sections.set(section, [...(sections.get(section) ?? []), endpoint])
  }

  const totals = {
    all: endpoints.length,
    capability: 0,
    admin: 0,
    token: 0,
    public: 0,
    delegated: 0,
  }
  for (const endpoint of endpoints) totals[endpoint.kind] += 1

  return {
    areas,
    adminOnly: [...sections.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([section, list]) => ({ section, endpoints: list })),
    open: endpoints.filter(e => e.kind === 'public' || e.kind === 'token'),
    totals,
  }
}
