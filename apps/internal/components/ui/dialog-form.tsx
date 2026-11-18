'use client'

import type { ComponentProps } from 'react'

/**
 * The `<form>` inside a dialog. A dialog is portalled in the DOM but still
 * nested in React's tree, so its submit would bubble to a form the dialog
 * was opened from (a page form, a sheet) and save that too. This stops it.
 * Lint requires it for any form inside `DialogContent`.
 */
export function DialogForm({ onSubmit, ...props }: ComponentProps<'form'>) {
  return (
    <form
      {...props}
      onSubmit={event => {
        event.stopPropagation()
        onSubmit?.(event)
      }}
    />
  )
}
