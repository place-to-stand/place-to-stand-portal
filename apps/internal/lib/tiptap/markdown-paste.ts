import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

import { isMarkdownPaste, markdownToHtml } from './markdown'

/**
 * Markdown HTML in the shape the editor reads: task lists as checklists,
 * and a lone paragraph unwrapped, so `**bold**` pasted mid-sentence joins
 * that sentence instead of splitting it into a new paragraph.
 */
export function toEditorHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  convertTaskLists(doc)
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
 * GitHub's task list markup (`<li class="task-list-item"><input
 * type="checkbox" checked> text`) in the shape the editor's checklist reads:
 * `<ul data-type="taskList"><li data-type="taskItem" data-checked>`.
 */
function convertTaskLists(doc: Document) {
  for (const item of Array.from(doc.querySelectorAll('li'))) {
    const box = item.querySelector(
      ':scope > input[type="checkbox"], :scope > p > input[type="checkbox"]'
    )
    if (!box) continue
    const checked = box.hasAttribute('checked')
    box.remove()
    item.setAttribute('data-type', 'taskItem')
    item.setAttribute('data-checked', checked ? 'true' : 'false')
    item.parentElement?.setAttribute('data-type', 'taskList')
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
            return editor.commands.insertContent(converted, {
              parseOptions: { preserveWhitespace: false },
            })
          },
        },
      }),
    ]
  },
})
