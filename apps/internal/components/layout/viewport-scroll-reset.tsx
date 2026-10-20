'use client'

import { useEffect } from 'react'

const EDITABLE = 'input, textarea, select, [contenteditable="true"]'

function isEditing() {
  const active = document.activeElement
  return active instanceof HTMLElement && active.matches(EDITABLE)
}

/**
 * Undoes the document scroll iOS Safari leaves behind after the keyboard.
 *
 * The document never scrolls here (`html` is `overflow: hidden`; each page
 * scrolls its own pane), but iOS scrolls it anyway to lift a focused field
 * above the keyboard. When the keyboard closes nothing scrolls it back, and
 * `overflow: hidden` stops the user doing it by hand, so the page header was
 * left stuck under the status bar with the sidebar trigger out of reach.
 *
 * Once focus leaves every editable field (or the visual viewport grows back
 * after the keyboard), reset the document to the top. While a field still
 * has focus the offset is iOS keeping it visible, so it's left alone.
 */
export function ViewportScrollReset() {
  useEffect(() => {
    let frame = 0

    const reset = () => {
      cancelAnimationFrame(frame)
      // Next frame: during focusout the incoming field isn't focused yet.
      frame = requestAnimationFrame(() => {
        if (isEditing()) return
        if (window.scrollX !== 0 || window.scrollY !== 0) {
          window.scrollTo(0, 0)
        }
      })
    }

    const viewport = window.visualViewport
    window.addEventListener('focusout', reset)
    viewport?.addEventListener('resize', reset)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('focusout', reset)
      viewport?.removeEventListener('resize', reset)
    }
  }, [])

  return null
}
