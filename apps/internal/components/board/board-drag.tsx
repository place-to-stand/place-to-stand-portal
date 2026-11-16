'use client'

import type { ReactNode } from 'react'
import {
  defaultDropAnimationSideEffects,
  DragOverlay,
  type DropAnimation,
} from '@dnd-kit/core'

import { BOARD_DROP_ANIMATION_MS } from '@/lib/dnd/kanban'

/**
 * The card under the pointer while dragging on a kanban board. dnd-kit sizes
 * the overlay to the card that was picked up, so previews fill it
 * (`w-full`) and never change width on drop. On drop it glides into the
 * card's new slot.
 */
export function BoardDragOverlay({
  children,
  count = 1,
}: {
  children: ReactNode
  /** Cards the drag moves: two or more shows a stack with the count. */
  count?: number
}) {
  return (
    <DragOverlay dropAnimation={count > 1 ? null : BOARD_DROP_ANIMATION}>
      {children && count > 1 ? (
        // Marked so Escape cancels the drag, not the selection.
        <div className='relative' data-board-dragging=''>
          {/* The cards behind it, offset like a stack. */}
          <div
            aria-hidden
            className='bg-card absolute inset-0 translate-x-1.5 translate-y-1.5 rounded-lg border shadow-sm'
          />
          <div className='relative'>{children}</div>
          <span
            data-drag-count={count}
            className='bg-primary text-primary-foreground absolute -top-2 -right-2 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums shadow-sm'
          >
            {count}
          </span>
        </div>
      ) : children ? (
        <div data-board-dragging=''>{children}</div>
      ) : null}
    </DragOverlay>
  )
}

const BOARD_DROP_ANIMATION: DropAnimation = {
  duration: BOARD_DROP_ANIMATION_MS,
  easing: 'ease-out',
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: '0' } },
  }),
}

/**
 * The dragged card's own slot in its column: a faint outline the card's
 * exact height, which is where it will land.
 */
export const BOARD_CARD_GHOST_CLASS =
  'border-primary/25 bg-primary/3 border-dashed shadow-none *:invisible'
