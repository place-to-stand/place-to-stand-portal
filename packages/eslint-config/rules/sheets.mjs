/**
 * Sheet stack rules (CLAUDE.md "Sheet deep links",
 * docs/design-system/components/sheet.md). Several sheets can be open at
 * once, two of the same kind included, so a sheet may not assume it is the
 * only one on the page.
 */
import { attrValue, jsxName, staticStrings } from './utils.mjs'

const SHEET_MD = 'docs/design-system/components/sheet.md'

/** A string fixed at write time: 'x', {'x'}, {`x`} with no `${}`. */
function fixedString(node) {
  if (!node) return null
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value
  }
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? null
  }
  return null
}

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

const PARAM_OBJECTS = /^(?:searchParams|resolvedSearchParams|params|query)$/

function isParamObject(node) {
  if (node.type === 'AwaitExpression') return isParamObject(node.argument)
  if (node.type === 'Identifier') return PARAM_OBJECTS.test(node.name)
  return (
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.property.type === 'Identifier' &&
    node.property.name === 'searchParams'
  )
}

/**
 * PR #365: a page that read "its" entity's param by hand claimed a sheet
 * that was not at the bottom of the stack. Read sheets through the stack:
 * `useSheetParams` in the browser, `pageSheetParam` on the server.
 * Options: `{ entities: [...] }`, the sheet params.
 */
export const sheetParamThroughStack = {
  meta: {
    type: 'problem',
    docs: { description: 'Sheet params are read through the stack helpers' },
    schema: [
      {
        type: 'object',
        properties: { entities: { type: 'array', items: { type: 'string' } } },
        additionalProperties: false,
      },
    ],
    messages: {
      read: `CLAUDE.md "Sheet deep links": \`{{entity}}\` is a sheet param, and the URL can hold several sheets. Read it with useSheetParams (browser) or pageSheetParam (server, bottom sheet only). A list filter that shares the name can disable this line, saying so.`,
    },
  },
  create(context) {
    const entities = new Set(context.options[0]?.entities ?? [])
    if (!entities.size) return {}
    const report = (node, entity) =>
      context.report({ node, messageId: 'read', data: { entity } })
    return {
      // searchParams.get('task'), url.searchParams.has('company')
      CallExpression(node) {
        const callee = node.callee
        if (
          callee.type !== 'MemberExpression' ||
          callee.property.type !== 'Identifier' ||
          !['get', 'getAll', 'has'].includes(callee.property.name)
        ) {
          return
        }
        const value = fixedString(node.arguments[0])
        if (value && entities.has(value) && isParamObject(callee.object)) {
          report(node, value)
        }
      },
      // params.task, searchParams['hour-block']
      MemberExpression(node) {
        if (!isParamObject(node.object)) return
        const key = node.computed
          ? fixedString(node.property)
          : node.property.type === 'Identifier'
            ? node.property.name
            : null
        if (key && entities.has(key)) report(node, key)
      },
      // const { task } = await searchParams
      VariableDeclarator(node) {
        if (node.id.type !== 'ObjectPattern' || !node.init) return
        if (!isParamObject(node.init)) return
        for (const property of node.id.properties) {
          if (property.type !== 'Property') continue
          const key =
            property.key.type === 'Identifier'
              ? property.key.name
              : fixedString(property.key)
          if (key && entities.has(key)) report(property, key)
        }
      },
    }
  },
}

const SHEET_LAYERS = new Set([
  'SheetContent',
  'SheetOverlay',
  'SheetPrimitive.Popup',
  'SheetPrimitive.Backdrop',
])

/**
 * PR #365: sheets layer by stack position (`sheetLayerZ`, set inside
 * components/ui/sheet.tsx). A z-index on one sheet puts it over the sheets
 * opened after it.
 */
export const sheetLayerZ = {
  meta: {
    type: 'problem',
    docs: { description: 'Sheets take their z-index from the stack' },
    schema: [],
    messages: {
      z: `${SHEET_MD}: sheets layer by stack position (sheetLayerZ in components/ui/sheet.tsx). Drop {{what}}, or the wrong sheet ends up on top.`,
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (!SHEET_LAYERS.has(jsxName(node.name))) return
        for (const attr of node.attributes) {
          if (attr.type !== 'JSXAttribute') continue
          if (attr.name.name === 'className') {
            for (const { value } of staticStrings(attrValue(attr))) {
              const match = /(?:^|[\s:!])(-?z-[\w[\]()-]+)/.exec(value)
              if (match) {
                context.report({
                  node: attr,
                  messageId: 'z',
                  data: { what: match[1] },
                })
              }
            }
          }
          if (attr.name.name === 'style') {
            const style = attrValue(attr)
            const zIndex =
              style?.type === 'ObjectExpression' &&
              style.properties.some(
                property =>
                  property.type === 'Property' &&
                  ((property.key.type === 'Identifier' &&
                    property.key.name === 'zIndex') ||
                    fixedString(property.key) === 'zIndex')
              )
            if (zIndex) {
              context.report({
                node: attr,
                messageId: 'z',
                data: { what: 'style.zIndex' },
              })
            }
          }
        }
      },
    }
  },
}
