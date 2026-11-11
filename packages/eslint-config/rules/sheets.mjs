/**
 * `pts/sheets`: sheet links and sheet URLs, one rule (CLAUDE.md, "Sheet deep
 * links"; docs/design-system/components/table.md).
 *
 *   url-builders   never hand-roll a sheet URL (`?task=`, params.set('task'));
 *                  links come from lib/sheets/hrefs.ts, opening and closing
 *                  from useSheetParams. On when `entities` is set.
 *   link-in-place  a linked record opens its sheet over the page (SheetLink),
 *                  never an href that leaves for the record's list
 *
 * Options: `entities` (the sheet params, read from lib/sheets/entities.ts by
 * the app config) and `exceptions`, the files where one check is off.
 */
import { EXCEPTIONS_SCHEMA, checkIsOn } from './utils.mjs'

/** Sheet href builders: an href from one of these leaves the page. */
const SHEET_HREF_BUILDER =
  /^(contactSheetHref|companySheetHref|leadHref|invoiceHref|hourBlockHref|submissionHref|leadTaskHref)$/

export const sheets = {
  meta: {
    type: 'problem',
    docs: { description: 'Sheet links and URLs go through lib/sheets' },
    schema: [
      {
        type: 'object',
        properties: {
          entities: { type: 'array', items: { type: 'string' } },
          exceptions: EXCEPTIONS_SCHEMA,
        },
        additionalProperties: false,
      },
    ],
    messages: {
      write:
        'CLAUDE.md "Sheet deep links": never hand-roll a sheet URL (`?{{entity}}=`). Link with a builder in lib/sheets/hrefs.ts, or open and close sheets with useSheetParams.',
      leaves: `docs/design-system/components/table.md: "A linked record opens its sheet over the page you're on". Use SheetLink (components/ui/sheet-link.tsx), or \`sheet\` on MetaLink or a hover-card row, not an href from {{name}}, which leaves the page.`,
    },
  },
  create(context) {
    const on = checkIsOn(context)
    const entities = on('url-builders')
      ? (context.options[0]?.entities ?? [])
      : []
    const inUrl = entities.length
      ? new RegExp(
          `[?&](${entities.map(e => e.replace(/-/g, '\\-')).join('|')})=$`
        )
      : null
    const inPlace = on('link-in-place')

    const leaves = (node, expression) => {
      if (
        expression?.type === 'CallExpression' &&
        expression.callee.type === 'Identifier' &&
        SHEET_HREF_BUILDER.test(expression.callee.name)
      ) {
        context.report({
          node,
          messageId: 'leaves',
          data: { name: expression.callee.name },
        })
      }
    }

    return {
      // `/invoices/archive?invoice=${id}`
      TemplateElement(node) {
        const match = inUrl?.exec(node.value.raw)
        if (match && !node.tail) {
          context.report({
            node,
            messageId: 'write',
            data: { entity: match[1] },
          })
        }
      },
      // params.set('task', id), params.delete('task')
      CallExpression(node) {
        if (!inUrl) return
        const callee = node.callee
        if (
          callee.type !== 'MemberExpression' ||
          callee.property.type !== 'Identifier' ||
          !['set', 'append', 'delete'].includes(callee.property.name)
        ) {
          return
        }
        const [first] = node.arguments
        if (first?.type === 'Literal' && entities.includes(first.value)) {
          context.report({
            node,
            messageId: 'write',
            data: { entity: first.value },
          })
        }
      },
      // <Link href={companySheetHref(id)}>
      JSXAttribute(node) {
        if (inPlace && node.name?.name === 'href')
          leaves(node, node.value?.expression)
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
