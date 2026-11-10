import { forwardRef, useId } from 'react'
import type { LucideIcon, LucideProps } from 'lucide-react'

import { cn } from '@/lib/utils'

const LUCIDE_ONLY_PROPS = ['absoluteStrokeWidth', 'nonScalingStroke']

/** The mark's centre and radius in the icon's 24×24 box, and the gap around it. */
const MARK = { cx: 19, cy: 19, r: 4.5, gap: 2 }

/**
 * A record's icon in one of its states: the base entity's icon (a company's
 * building, a person's card) with a coloured dot in its lower right corner. A
 * client is a company with the green dot; a sign-in is a person with the
 * sign-in dot. The record keeps its shape in every state, so a list scans by
 * shape and the dot says the state.
 *
 * The dot is cut out of the icon with a mask, not ringed with a background
 * colour, so it reads on any surface (rows, hovers, tinted bands). It takes
 * every prop a lucide icon takes; size and colour come from `className`, as
 * with the base icon. Only the registry builds these (see `ENTITIES`).
 */
export function withStateMark(
  Base: LucideIcon,
  markClassName: string,
  displayName: string
): LucideIcon {
  const Marked = forwardRef<SVGSVGElement, LucideProps>(function Marked(
    {
      className,
      size = 24,
      strokeWidth = 2,
      color = 'currentColor',
      children,
      ...lucideProps
    },
    ref
  ) {
    // Lucide-only props stay off the DOM <svg>.
    const props: Record<string, unknown> = { ...lucideProps }
    for (const key of LUCIDE_ONLY_PROPS) delete props[key]
    // As lucide does: decorative unless the caller names it.
    const named = Object.keys(props).some(
      key => key.startsWith('aria-') || key === 'role' || key === 'title'
    )
    // useId returns characters a url(#…) reference can't hold.
    const maskId = `state-mark-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
    return (
      <svg
        ref={ref}
        xmlns='http://www.w3.org/2000/svg'
        width={size}
        height={size}
        viewBox='0 0 24 24'
        fill='none'
        className={cn('lucide', className)}
        aria-hidden={named ? undefined : true}
        {...props}
      >
        <mask
          id={maskId}
          maskUnits='userSpaceOnUse'
          x='0'
          y='0'
          width='24'
          height='24'
        >
          <rect width='24' height='24' fill='white' />
          <circle
            cx={MARK.cx}
            cy={MARK.cy}
            r={MARK.r + MARK.gap}
            fill='black'
          />
        </mask>
        <g mask={`url(#${maskId})`}>
          {/* The inline size beats host CSS that sizes every nested svg
              (menus, buttons: `[&_svg]:size-4`), which would shrink the
              base inside the box while the dot stays put. */}
          <Base
            width={24}
            height={24}
            x={0}
            y={0}
            style={{ width: 24, height: 24 }}
            color={color}
            strokeWidth={strokeWidth}
          />
        </g>
        <circle
          cx={MARK.cx}
          cy={MARK.cy}
          r={MARK.r}
          stroke='none'
          className={markClassName}
        />
        {children}
      </svg>
    )
  })
  Marked.displayName = displayName
  return Marked as unknown as LucideIcon
}
