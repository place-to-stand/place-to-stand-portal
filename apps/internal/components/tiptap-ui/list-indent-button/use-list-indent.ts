'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'

import { useTiptapEditor } from '@/hooks/use-tiptap-editor'
import { SHORTCUTS } from '@/lib/keyboard/shortcuts'
import {
  innermostListItemType,
  type ListIndentDirection,
} from '@/lib/tiptap/list-indent'

export const LIST_INDENT_SHORTCUT_KEYS: Record<ListIndentDirection, string> = {
  indent: SHORTCUTS.indentListItem.keys,
  outdent: SHORTCUTS.outdentListItem.keys,
}

const LABELS: Record<ListIndentDirection, string> = {
  indent: SHORTCUTS.indentListItem.label,
  outdent: SHORTCUTS.outdentListItem.label,
}

/** Whether the item under the cursor can move a level in or out. */
export function canChangeListIndent(
  editor: Editor | null,
  direction: ListIndentDirection
): boolean {
  if (!editor || !editor.isEditable) return false
  const itemType = innermostListItemType(editor.state)
  if (!itemType) return false
  return direction === 'indent'
    ? editor.can().sinkListItem(itemType)
    : editor.can().liftListItem(itemType)
}

export function changeListIndent(
  editor: Editor | null,
  direction: ListIndentDirection
): boolean {
  if (!canChangeListIndent(editor, direction) || !editor) return false
  const itemType = innermostListItemType(editor.state)
  if (!itemType) return false
  const chain = editor.chain().focus()
  return direction === 'indent'
    ? chain.sinkListItem(itemType).run()
    : chain.liftListItem(itemType).run()
}

export function useListIndent({
  editor: providedEditor,
  direction,
}: {
  editor?: Editor | null
  direction: ListIndentDirection
}) {
  const { editor } = useTiptapEditor(providedEditor)
  const [canChange, setCanChange] = useState(false)

  useEffect(() => {
    if (!editor) return
    const update = () => setCanChange(canChangeListIndent(editor, direction))
    update()
    editor.on('selectionUpdate', update)
    editor.on('transaction', update)
    return () => {
      editor.off('selectionUpdate', update)
      editor.off('transaction', update)
    }
  }, [editor, direction])

  const handleChange = useCallback(
    () => changeListIndent(editor, direction),
    [editor, direction]
  )

  return {
    canChange,
    handleChange,
    label: LABELS[direction],
    shortcutKeys: LIST_INDENT_SHORTCUT_KEYS[direction],
  }
}
