import type { EditorState } from '@tiptap/pm/state'

export type ListIndentDirection = 'indent' | 'outdent'

const LIST_ITEM_TYPES = ['listItem', 'taskItem'] as const
type ListItemType = (typeof LIST_ITEM_TYPES)[number]

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
