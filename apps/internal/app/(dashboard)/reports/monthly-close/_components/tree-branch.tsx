type TreeBranchProps = {
  first: boolean
  last: boolean
  /** The child row's vertical padding (px): the line runs through it so rows join up. */
  rowPaddingY?: number
  /** The parent row's bottom padding (px): the first line reaches up into it. */
  reachUp?: number
}

/** Breathing room (px) between the parent's text and the top of the line. */
const GAP_BELOW_PARENT = 8

/**
 * Tree connector at the start of a child row: a vertical rule down from the
 * parent (stopping at the midline on the last child) and a tick into the row.
 * Place it as the row's first flex item; the row must be `items-center`.
 */
export function TreeBranch({
  first,
  last,
  rowPaddingY = 6,
  reachUp = 6,
}: TreeBranchProps) {
  return (
    <span
      aria-hidden
      className='relative ml-2 w-4 shrink-0 self-stretch'
      style={{ marginBlock: -rowPaddingY }}
    >
      <span
        className='bg-muted-foreground/40 absolute left-1 w-px'
        style={{
          top: first ? GAP_BELOW_PARENT - reachUp : 0,
          bottom: last ? '50%' : 0,
        }}
      />
      <span className='bg-muted-foreground/40 absolute top-1/2 left-1 h-px w-2.5' />
    </span>
  )
}
