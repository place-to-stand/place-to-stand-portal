/**
 * `pts/sheets`: sheet links, sheet URLs and the sheet stack, one rule
 * (CLAUDE.md "Sheet deep links"; docs/design-system/components/sheet.md and
 * table.md). Several sheets can be open at once, two of one kind included.
 *
 *   url-builders    never hand-roll a sheet URL (`?task=`, params.set('task'));
 *                   links come from lib/sheets/hrefs.ts, opening and closing
 *                   from useSheetParams. On when `entities` is set.
 *   param-in-stack  never read a sheet param by hand (searchParams.get('task'),
 *                   params.company, destructuring): useSheetParams in the
 *                   browser, pageSheetParam on the server (PR #365). On when
 *                   `entities` is set.
 *   link-in-place   a linked record opens its sheet over the page (SheetLink),
 *                   never an href that leaves for the record's list
 *   layer-z         no z-index on SheetContent / SheetOverlay: sheetLayerZ in
 *                   components/ui/sheet.tsx layers them by stack position
 *
 * Options: `entities` (the sheet params, read from lib/sheets/entities.ts by
 * the app config), `exceptions` (the files where one check is off) and
 * `root`, the directory the exception globs are relative to.
 */
import {
  EXCEPTIONS_SCHEMA,
  attrValue,
  checkIsOn,
  jsxName,
  staticStrings,
} from './utils.mjs'

const SHEET_MD = 'docs/design-system/components/sheet.md'

/** A string fixed at write time: 'x', {'x'}, {`x`} with no `${}`. */
export function fixedString(node) {
  if (!node) return null
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value
  }
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? null
  }
  return null
}

/** Sheet href builders: an href from one of these leaves the page. */
const SHEET_HREF_BUILDER =
  /^(contactSheetHref|companySheetHref|leadHref|invoiceHref|hourBlockHref|submissionHref|leadTaskHref)$/

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

const SHEET_LAYERS = new Set([
  'SheetContent',
  'SheetOverlay',
  'SheetPrimitive.Popup',
  'SheetPrimitive.Backdrop',
])

/** What on a sheet layer element sets a z-index, or null. */
function zIndexOn(attr) {
  if (attr.name.name === 'className') {
    for (const { value } of staticStrings(attrValue(attr))) {
      const match = /(?:^|[\s:!])(-?z-[\w[\]()-]+)/.exec(value)
      if (match) return match[1]
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
    if (zIndex) return 'style.zIndex'
  }
  return null
}

export const sheets = {
  meta: {
    type: 'problem',
    docs: { description: 'Sheet links, URLs and layers go through lib/sheets' },
    schema: [
      {
        type: 'object',
        properties: {
          entities: { type: 'array', items: { type: 'string' } },
          exceptions: EXCEPTIONS_SCHEMA,
          root: { type: 'string' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      write:
        'CLAUDE.md "Sheet deep links": never hand-roll a sheet URL (`?{{entity}}=`). Link with a builder in lib/sheets/hrefs.ts, or open and close sheets with useSheetParams.',
      read: 'CLAUDE.md "Sheet deep links": `{{entity}}` is a sheet param, and the URL can hold several sheets. Read it with useSheetParams (browser) or pageSheetParam (server, bottom sheet only). A list filter that shares the name can disable this line, saying so.',
      leaves: `docs/design-system/components/table.md: "A linked record opens its sheet over the page you're on". Use SheetLink (components/ui/sheet-link.tsx), or \`sheet\` on MetaLink or a hover-card row, not an href from {{name}}, which leaves the page.`,
      z: `${SHEET_MD}: sheets layer by stack position (sheetLayerZ in components/ui/sheet.tsx). Drop {{what}}, or the wrong sheet ends up on top.`,
    },
  },
  create(context) {
    const on = checkIsOn(context)
    const entities = new Set(context.options[0]?.entities ?? [])
    const write = entities.size > 0 && on('url-builders')
    const read = entities.size > 0 && on('param-in-stack')
    const inUrl = write
      ? new RegExp(
          `[?&](${[...entities].map(e => e.replace(/-/g, '\\-')).join('|')})=$`
        )
      : null
    const inPlace = on('link-in-place')
    const layers = on('layer-z')

    const report = (node, messageId, data) =>
      context.report({ node, messageId, data })
    const leaves = (node, expression) => {
      if (
        expression?.type === 'CallExpression' &&
        expression.callee.type === 'Identifier' &&
        SHEET_HREF_BUILDER.test(expression.callee.name)
      ) {
        report(node, 'leaves', { name: expression.callee.name })
      }
    }

    return {
      // `/invoices/archive?invoice=${id}`
      TemplateElement(node) {
        const match = inUrl?.exec(node.value.raw)
        if (match && !node.tail) report(node, 'write', { entity: match[1] })
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
        if (!value || !entities.has(value)) return
        // params.set('task', id), params.delete('task')
        if (write && ['set', 'append', 'delete'].includes(method))
          report(node, 'write', { entity: value })
        // searchParams.get('task'), url.searchParams.has('company')
        if (
          read &&
          ['get', 'getAll', 'has'].includes(method) &&
          isParamObject(callee.object)
        ) {
          report(node, 'read', { entity: value })
        }
      },
      // params.task, searchParams['hour-block']
      MemberExpression(node) {
        if (!read || !isParamObject(node.object)) return
        const key = node.computed
          ? fixedString(node.property)
          : node.property.type === 'Identifier'
            ? node.property.name
            : null
        if (key && entities.has(key)) report(node, 'read', { entity: key })
      },
      // const { task } = await searchParams
      VariableDeclarator(node) {
        if (!read || node.id.type !== 'ObjectPattern' || !node.init) return
        if (!isParamObject(node.init)) return
        for (const property of node.id.properties) {
          if (property.type !== 'Property') continue
          const key =
            property.key.type === 'Identifier'
              ? property.key.name
              : fixedString(property.key)
          if (key && entities.has(key))
            report(property, 'read', { entity: key })
        }
      },
      // <Link href={companySheetHref(id)}>
      JSXAttribute(node) {
        if (inPlace && node.name?.name === 'href')
          leaves(node, node.value?.expression)
      },
      // <SheetContent className='z-50'>
      JSXOpeningElement(node) {
        if (!layers || !SHEET_LAYERS.has(jsxName(node.name))) return
        for (const attr of node.attributes) {
          if (attr.type !== 'JSXAttribute') continue
          const what = zIndexOn(attr)
          if (what) report(attr, 'z', { what })
        }
      },
      // A hover-card row in a component: { href: leadHref(id) }. Plain .ts
      // modules (a notification's stored link) aren't rendered links.
      Property(node) {
        if (!inPlace || !context.filename.endsWith('.tsx')) return
        if (node.key?.name === 'href') leaves(node, node.value)
      },
    }
  },
}
