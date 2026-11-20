import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

import { isMarkdownPaste, markdownToHtml } from './markdown'

/**
 * Markdown HTML in the shape the editor reads: task lists as checklists,
 * and a lone paragraph unwrapped, so `**bold**` pasted mid-sentence joins
 * that sentence instead of splitting it into a new paragraph.
 */
function toEditorHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  convertTaskLists(doc)
  dropUnsupported(doc)
  const blocks = Array.from(doc.body.children)
  const onlyText = Array.from(doc.body.childNodes).every(
    node => node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim()
  )
  if (blocks.length === 1 && blocks[0].tagName === 'P' && onlyText) {
    return blocks[0].innerHTML
  }
  return doc.body.innerHTML
}

/**
 * What the editor can't keep: an image becomes its link (the editor would
 * load it, and saving a comment strips it), and a table becomes one
 * paragraph per row with its cells joined by a bar.
 */
function dropUnsupported(doc: Document) {
  for (const image of Array.from(doc.querySelectorAll('img'))) {
    const src = image.getAttribute('src') ?? ''
    // A blocked URL (micromark empties `javascript:`) keeps only its text.
    if (!src) {
      image.replaceWith(doc.createTextNode(image.getAttribute('alt') ?? ''))
      continue
    }
    const link = doc.createElement('a')
    link.setAttribute('href', src)
    link.textContent = image.getAttribute('alt') || src
    image.replaceWith(link)
  }
  for (const table of Array.from(doc.querySelectorAll('table'))) {
    const rows = Array.from(table.querySelectorAll('tr')).map(row => {
      const paragraph = doc.createElement('p')
      paragraph.textContent = Array.from(row.querySelectorAll('th, td'))
        .map(cell => cell.textContent?.trim() ?? '')
        .join(' | ')
      return paragraph
    })
    table.replaceWith(...rows)
  }
}

/**
 * GitHub's task list markup (`<li class="task-list-item"><input
 * type="checkbox" checked> text`) in the shape the editor's checklist reads:
 * `<ul data-type="taskList"><li data-type="taskItem" data-checked>`.
 */
function convertTaskLists(doc: Document) {
  const boxOf = (item: Element) =>
    item.querySelector(
      ':scope > input[type="checkbox"], :scope > p:first-child > input[type="checkbox"]'
    )
  for (const list of Array.from(doc.querySelectorAll('ul, ol'))) {
    const items = Array.from(list.children).filter(
      child => child.tagName === 'LI'
    )
    const boxes = items.map(boxOf)
    if (!boxes.some(Boolean)) continue
    // A checklist holds only checklist items and is never numbered, so a
    // list mixing ticked and plain items (Markdown reads a checklist and a
    // bullet list split by a blank line as one list) splits into runs.
    const runs: { checklist: boolean; items: Element[] }[] = []
    items.forEach((item, index) => {
      const checklist = Boolean(boxes[index])
      const last = runs.at(-1)
      if (last && last.checklist === checklist) last.items.push(item)
      else runs.push({ checklist, items: [item] })
    })
    let position = Number(list.getAttribute('start') ?? 1) || 1
    const lists = runs.map(run => {
      const next = doc.createElement(run.checklist ? 'ul' : list.tagName)
      if (run.checklist) next.setAttribute('data-type', 'taskList')
      // A numbered run keeps counting from where it sits in the list.
      else if (list.tagName === 'OL' && position !== 1) {
        next.setAttribute('start', String(position))
      }
      position += run.items.length
      run.items.forEach(item => {
        const box = boxOf(item)
        if (run.checklist) {
          item.setAttribute('data-type', 'taskItem')
          item.setAttribute(
            'data-checked',
            box?.hasAttribute('checked') ? 'true' : 'false'
          )
          box?.remove()
        }
        next.append(item)
      })
      return next
    })
    list.replaceWith(...lists)
  }
}

/**
 * Pasting Markdown (from a chat with Claude, a README, a code editor) turns
 * it into formatting instead of leaving the `#`, `-` and `**` as text. Text
 * that doesn't look like Markdown, pastes whose HTML is already formatted,
 * pastes into a code block and Shift+⌘V (paste as plain text) keep the
 * normal paste.
 */
export const MarkdownPaste = Extension.create({
  name: 'markdownPaste',
  addProseMirrorPlugins() {
    const editor = this.editor
    return [
      new Plugin({
        key: new PluginKey('markdownPaste'),
        props: {
          handlePaste: (view, event) => {
            if (!editor.isEditable) return false
            // ProseMirror records Shift on paste (Shift+⌘V = plain text).
            const input = (
              view as unknown as { input?: { shiftKey?: boolean } }
            ).input
            if (input?.shiftKey) return false
            if (editor.isActive('codeBlock') || editor.isActive('code')) {
              return false
            }

            const data = event.clipboardData
            const text = data?.getData('text/plain') ?? ''
            const html = data?.getData('text/html') || null
            if (!isMarkdownPaste(text, html)) return false

            const converted = toEditorHtml(markdownToHtml(text))
            try {
              return editor.commands.insertContent(converted, {
                parseOptions: { preserveWhitespace: false },
              })
            } catch (error) {
              // Content the schema won't take: fall back to the normal paste.
              console.warn('Markdown paste failed; pasting as text', error)
              return false
            }
          },
        },
      }),
    ]
  },
})
