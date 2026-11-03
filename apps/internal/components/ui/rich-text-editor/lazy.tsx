'use client'

import dynamic from 'next/dynamic'

import type { RichTextEditorProps } from './index'

const loadEditor = () => import('./index').then(module => module.RichTextEditor)

// The editor (TipTap and ProseMirror) is only needed once a sheet opens, so
// it stays out of the first download of the board, Leads and Companies
// pages. It is fetched as soon as the browser is idle, so it is normally in
// place before anyone opens a sheet.
if (typeof window !== 'undefined') {
  const preload = () => void loadEditor()
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(preload, { timeout: 3000 })
  } else {
    setTimeout(preload, 1500)
  }
}

/** Placeholder with the editor's frame while its code loads. */
function EditorPlaceholder() {
  return (
    <div
      aria-hidden
      className='bg-background min-h-[200px] w-full rounded-md border shadow-xs'
    />
  )
}

/** `RichTextEditor`, loaded on demand. Same props. */
export const LazyRichTextEditor = dynamic<RichTextEditorProps>(loadEditor, {
  ssr: false,
  loading: EditorPlaceholder,
})
