import type { Modifier } from '@dnd-kit/core'

/**
 * Keep the dragged widget inside the grid container. Without this a widget
 * can be dragged past the page edge, which grows the scroll pane and enables
 * horizontal scrolling.
 *
 * Horizontally the whole rect is clamped. Vertically only the rect's center
 * is clamped: a widget as tall as the grid (one alone in its column) would
 * otherwise have zero vertical slack and feel stuck, and it needs to travel
 * down to be dropped under a widget in the other column.
 */
export function createRestrictToGrid(grid: HTMLElement | null): Modifier {
  return ({ transform, draggingNodeRect }) => {
    if (!grid || !draggingNodeRect) return transform

    const bounds = grid.getBoundingClientRect()
    const minX = bounds.left - draggingNodeRect.left
    const maxX = bounds.right - draggingNodeRect.right
    const centerY = draggingNodeRect.top + draggingNodeRect.height / 2
    const minY = bounds.top - centerY
    const maxY = bounds.bottom - centerY

    return {
      ...transform,
      x: clamp(transform.x, minX, maxX),
      y: clamp(transform.y, minY, maxY),
    }
  }
}

function clamp(value: number, min: number, max: number) {
  if (min > max) return min
  return Math.min(Math.max(value, min), max)
}
