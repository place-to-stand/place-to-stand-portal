/**
 * `pts/use-id-not-fixed-id` (docs/design-system/components/sheet.md). Kept
 * apart from `pts/sheets` because the older hits are grandfathered under
 * this id in apps/internal/eslint-suppressions.json.
 */
import { attrValue } from './utils.mjs'
import { fixedString } from './sheets.mjs'

const SHEET_MD = 'docs/design-system/components/sheet.md'

const FIXED_ID_ATTRIBUTES = new Set([
  'id',
  'form',
  'htmlFor',
  'aria-describedby',
  'aria-labelledby',
  'aria-controls',
])
const ID_LOOKUPS = new Set(['getElementById'])
const SELECTOR_LOOKUPS = new Set(['querySelector', 'querySelectorAll'])

/**
 * PR #365: two sheets of one kind shared a form id, and one sheet's Save
 * submitted the other's form. Element ids (and `form=` links to them) come
 * from `useId`, so every instance of a component gets its own.
 */
export const useIdNotFixedId = {
  meta: {
    type: 'problem',
    docs: { description: 'Element ids come from useId, never a fixed string' },
    schema: [],
    messages: {
      attribute: `${SHEET_MD}: a component can render twice (two sheets of one kind), so a fixed {{name}}="{{value}}" collides. Use \`const id = useId()\` and derive ids from it.`,
      lookup: `${SHEET_MD}: a fixed id lookup ({{value}}) finds the first of several open copies. Keep the id from \`useId\` and look that up, or use a ref.`,
    },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        const name = node.name?.name
        if (!FIXED_ID_ATTRIBUTES.has(name)) return
        const value = fixedString(attrValue(node))
        if (!value) return
        context.report({
          node,
          messageId: 'attribute',
          data: { name, value },
        })
      },
      CallExpression(node) {
        const callee = node.callee
        if (
          callee.type !== 'MemberExpression' ||
          callee.property.type !== 'Identifier'
        ) {
          return
        }
        const method = callee.property.name
        const value = fixedString(node.arguments[0])
        if (!value) return
        if (
          ID_LOOKUPS.has(method) ||
          (SELECTOR_LOOKUPS.has(method) && /#[\w-]/.test(value))
        ) {
          context.report({ node, messageId: 'lookup', data: { value } })
        }
      },
    }
  },
}
