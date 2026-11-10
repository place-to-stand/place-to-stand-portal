import { TagBadge } from './tag-badge'

/**
 * A record's tags on one line, for a list row: the first few as badges and
 * "+N" for the rest (all of them in its tooltip), so rows keep one height.
 */
export function TagList({
  names,
  max = 2,
}: {
  names: readonly string[]
  max?: number
}) {
  const shown = names.slice(0, max)
  const hidden = names.length - shown.length
  return (
    <span className='flex min-w-0 items-center gap-1 overflow-hidden'>
      {shown.map(name => (
        // Badges truncate before the "+N" does.
        <TagBadge key={name} name={name} className='min-w-0 shrink' />
      ))}
      {hidden > 0 ? (
        <span
          className='text-muted-foreground shrink-0 text-xs'
          title={names.join(', ')}
        >
          +{hidden}
        </span>
      ) : null}
    </span>
  )
}
