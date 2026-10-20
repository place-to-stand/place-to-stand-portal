"use client"

import { useMemo } from "react"
import { MouseSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core"

/**
 * Mouse drags start after 8px of travel. Touch drags start on a short
 * press-and-hold instead: a swipe has to stay a scroll on a phone, and a
 * PointerSensor can't tell the two apart (the browser claims the gesture
 * for panning, so a touch drag never activated at all).
 */
export function useProjectsBoardSensors() {
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  )

  return useMemo(() => ({ sensors }), [sensors])
}
