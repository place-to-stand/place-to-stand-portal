let editorStylesElement: HTMLStyleElement | null = null

export const ensureEditorStyles = () => {
  if (typeof document === 'undefined') {
    return
  }

  if (!editorStylesElement) {
    editorStylesElement = document.createElement('style')
    editorStylesElement.setAttribute('data-rich-text-editor-styles', 'true')
    document.head.appendChild(editorStylesElement)
  }

  const styles = `
    /* Ensure text selection works in the editor */
    .rich-text-editor .tiptap.ProseMirror {
      user-select: text !important;
      -webkit-user-select: text !important;
      -moz-user-select: text !important;
      -ms-user-select: text !important;
    }

    .rich-text-editor .tiptap.ProseMirror * {
      user-select: text !important;
      -webkit-user-select: text !important;
    }

    .rich-text-editor .ProseMirror p.is-editor-empty:first-child::before {
      color: var(--muted-foreground);
      content: attr(data-placeholder);
      float: left;
      height: 0;
      pointer-events: none;
      user-select: none !important;
      font-size: inherit;
    }

    /*
      Type scale and rhythm live here as two variables rather than being
      repeated across the rules below, which is how the old 1rem/1.6 pair
      ended up restated five times with !important.

      0.875rem matches the app's body text -- the editor was rendering a
      point larger than everything around it -- and the tighter leading and
      block margins fit more of a description on screen without crowding.
    */
    .rich-text-editor .ProseMirror {
      --rte-font-size: 0.875rem;
      --rte-line-height: 1.5;
    }

    .rich-text-editor .ProseMirror ul,
    .rich-text-editor .ProseMirror ol {
      padding-left: 1.125rem;
      margin: 0.375rem 0;
    }

    .rich-text-editor .ProseMirror li {
      margin: 0.125rem 0;
    }

    .rich-text-editor .ProseMirror li p {
      margin: 0;
    }

    /* Ensure first child elements (lists, paragraphs, etc.) have consistent font size */
    .rich-text-editor .ProseMirror > *:first-child {
      font-size: var(--rte-font-size) !important;
    }

    .rich-text-editor .ProseMirror > ul:first-child,
    .rich-text-editor .ProseMirror > ol:first-child {
      font-size: var(--rte-font-size) !important;
    }

    .rich-text-editor .ProseMirror > ul:first-child li,
    .rich-text-editor .ProseMirror > ol:first-child li {
      font-size: var(--rte-font-size) !important;
    }

    .rich-text-editor .ProseMirror p {
      margin: 0.25rem 0;
      font-size: var(--rte-font-size) !important;
      line-height: var(--rte-line-height) !important;
      font-weight: normal;
    }

    /* Ensure first paragraph has same font size as others */
    .rich-text-editor .ProseMirror p:first-child {
      font-size: var(--rte-font-size) !important;
      line-height: var(--rte-line-height) !important;
      font-weight: normal;
    }

    /* Headings kept proportional to the new body size, with tighter collars
       so a heading no longer pushes a paragraph-and-a-half of space. */
    .rich-text-editor .ProseMirror :is(h1, h2, h3, h4, h5, h6) {
      margin: 0.75rem 0 0.25rem;
      line-height: 1.25;
    }

    .rich-text-editor .ProseMirror > :is(h1, h2, h3, h4, h5, h6):first-child {
      margin-top: 0;
    }

    .rich-text-editor .ProseMirror blockquote,
    .rich-text-editor .ProseMirror pre {
      margin: 0.5rem 0;
    }

    /* No leading or trailing gap inside the editor's own padding. */
    .rich-text-editor .ProseMirror > *:first-child {
      margin-top: 0;
    }

    .rich-text-editor .ProseMirror > *:last-child {
      margin-bottom: 0;
    }

    .rich-text-editor .ProseMirror:focus {
      outline: none;
    }
  `

  editorStylesElement.textContent = styles

  // Add required TipTap CSS variables if they don't exist
  if (typeof document !== 'undefined') {
    const root = document.documentElement

    // Set TipTap CSS variables with fallbacks
    root.style.setProperty('--white', '#ffffff')
    root.style.setProperty('--black', '#000000')
    root.style.setProperty(
      '--tt-dropdown-menu-bg-color',
      'var(--background, #ffffff)'
    )
    root.style.setProperty(
      '--tt-dropdown-menu-border-color',
      'var(--border, #e5e5e5)'
    )
    root.style.setProperty(
      '--tt-dropdown-menu-text-color',
      'var(--foreground, #000000)'
    )
    root.style.setProperty(
      '--tiptap-card-bg-color',
      'var(--background, #ffffff)'
    )
    root.style.setProperty(
      '--tiptap-card-border-color',
      'var(--border, #e5e5e5)'
    )
  }
}
