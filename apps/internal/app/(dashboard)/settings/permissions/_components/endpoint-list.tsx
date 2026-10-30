import { Badge } from '@pts/ui/badge'
import type { Endpoint } from '@/lib/auth/permissions-registry'

const TYPE_LABELS: Record<Endpoint['type'], string> = {
  route: 'API',
  action: 'Action',
  page: 'Page',
}

/** Endpoints as compact mono rows: type badge, method/path or action name. */
export function EndpointList({ endpoints }: { endpoints: Endpoint[] }) {
  if (endpoints.length === 0) {
    return (
      <p className='text-muted-foreground text-xs'>
        No endpoints check this directly.
      </p>
    )
  }

  return (
    <ul className='space-y-1'>
      {endpoints.map(endpoint => (
        <li
          key={`${endpoint.file}:${endpoint.name}`}
          className='flex min-w-0 items-center gap-2'
          title={endpoint.file}
        >
          <Badge variant='outline' className='w-16 shrink-0 justify-center'>
            {TYPE_LABELS[endpoint.type]}
          </Badge>
          <code className='text-muted-foreground truncate font-mono text-xs'>
            {endpoint.name}
          </code>
        </li>
      ))}
    </ul>
  )
}
