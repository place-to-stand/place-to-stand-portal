import { Extension } from '@tiptap/core'
import type { EditorState } from '@tiptap/pm/state'

export type ListIndentDirection = 'indent' | 'outdent'

const LIST_ITEM_TYPES = ['listItem', 'taskItem'] as const
export type ListItemType = (typeof LIST_ITEM_TYPES)[number]

/**
 * The list item type the cursor is in, the innermost one when lists nest
 * (a checklist inside a bullet answers `taskItem`). Null outside a list.
 */
export function innermostListItemType(state: EditorState): ListItemType | null {
  const { $from } = state.selection
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const name = $from.node(depth).type.name
    if ((LIST_ITEM_TYPES as readonly string[]).includes(name)) {
      return name as ListItemType
    }
  }
  return null
}

/**
 * Tab inside a list stays in the editor. The list items' own Tab nests the
 * item when it can; where it can't (the first item of a list has nothing to
 * nest under), the browser used to take Tab and move focus to the next
 * field, so a slip of the key left the editor. Outside a list Tab still moves
 * focus as usual. Lower priority than the list items, so theirs runs first.
 */
export const KeepTabInLists = Extension.create({
  name: 'keepTabInLists',
  priority: 50,
  addKeyboardShortcuts() {
    return {
      Tab: () => innermostListItemType(this.editor.state) !== null,
    }
  },
})
