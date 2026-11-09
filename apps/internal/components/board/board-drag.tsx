'use client'

import type { ReactNode } from 'react'
import {
  defaultDropAnimationSideEffects,
  DragOverlay,
  type DropAnimation,
} from '@dnd-kit/core'

/**
 * The card under the pointer while dragging on a kanban board. dnd-kit sizes
 * the overlay to the card that was picked up, so previews fill it
 * (`w-full`) and never change width on drop. On drop it glides into the
 * card's new slot.
 */
export function BoardDragOverlay({ children }: { children: ReactNode }) {
  return (
    <DragOverlay dropAnimation={BOARD_DROP_ANIMATION}>{children}</DragOverlay>
  )
}

const BOARD_DROP_ANIMATION: DropAnimation = {
  duration: 180,
  easing: 'ease-out',
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: '0' } },
  }),
}

/**
 * The dragged card's own slot in its column: an empty outline the card's
 * exact height, which is where it will land.
 */
export const BOARD_CARD_GHOST_CLASS =
  'border-primary/40 bg-primary/5 border-dashed shadow-none *:invisible'
