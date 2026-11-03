/**
 * Rules that guard a written "never" (docs/design-system/README.md, CLAUDE.md)
 * which used to rest on review alone.
 */
import { README, staticStrings } from './utils.mjs'

const HUES =
  'red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone'
const COLOUR_UTILITIES =
  'bg|text|border(?:-[trblxyse])?|ring|fill|stroke|from|to|via|shadow|outline|divide|decoration|caret|accent|placeholder'
// `bg-amber-500`, `dark:text-red-300/80`, `border-[#65a30d]/60`
const RAW_PALETTE = new RegExp(
  `(?:^|[\\s:])(?:${COLOUR_UTILITIES})-(?:${HUES})-\\d{2,3}\\b`
)
const RAW_HEX = new RegExp(
  `(?:^|[\\s:])(?:${COLOUR_UTILITIES})-\\[#[0-9a-fA-F]{3,8}\\]`
)

/** README → Color: tokens only, never a raw palette shade or hex value. */
export const noRawColour = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Colours come from tokens, not raw palette shades or hex',
    },
    schema: [],
    messages: {
      raw: `README → Color (${README}): "never a raw red, green, emerald or amber shade", "never with raw grays", "never their hex values". Use a token: text-destructive, text-warning, bg-muted, border-brand-lime, … The listed exceptions turn this rule off by file in the eslint config.`,
    },
  },
  create(context) {
    function check(node, value) {
      if (RAW_PALETTE.test(value) || RAW_HEX.test(value)) {
        context.report({ node, messageId: 'raw' })
      }
    }
    return {
      Literal(node) {
        if (typeof node.value === 'string') check(node, node.value)
      },
      TemplateElement(node) {
        check(node, node.value.raw)
      },
    }
  },
}

const PANEL_TOKENS = [/(^|\s)rounded-xl(\s|$)/, /(^|\s)shadow-sm(\s|$)/]

/**
 * README → Borders: a page panel is `PagePanel` (or `pagePanelClass`) from
 * components/layout/page-panel.tsx, never a hand-written copy of its classes.
 */
export const onePagePanel = {
  meta: {
    type: 'problem',
    docs: { description: 'Page panels come from PagePanel' },
    schema: [],
    messages: {
      copy: 'This copies the page panel (rounded-xl + shadow-sm). Use <PagePanel> or pagePanelClass from @/components/layout/page-panel.',
    },
  },
  create(context) {
    function check(node, value) {
      if (PANEL_TOKENS.every(token => token.test(value))) {
        context.report({ node, messageId: 'copy' })
      }
    }
    return {
      Literal(node) {
        if (typeof node.value === 'string') check(node, node.value)
      },
      TemplateElement(node) {
        check(node, node.value.raw)
      },
    }
  },
}

/**
 * CLAUDE.md, "Sheet deep links": never hand-roll sheet URL writes; links come
 * from the builders in lib/sheets/hrefs.ts. Options: `{ entities: [...] }`,
 * the sheet params (read from lib/sheets/entities.ts by the app config).
 */
export const sheetUrlThroughBuilders = {
  meta: {
    type: 'problem',
    docs: { description: 'Sheet links come from lib/sheets/hrefs.ts' },
    schema: [
      {
        type: 'object',
        properties: { entities: { type: 'array', items: { type: 'string' } } },
        additionalProperties: false,
      },
    ],
    messages: {
      write:
        'CLAUDE.md "Sheet deep links": never hand-roll a sheet URL (`?{{entity}}=`). Link with a builder in lib/sheets/hrefs.ts, or open and close sheets with useSheetParams.',
    },
  },
  create(context) {
    const entities = context.options[0]?.entities ?? []
    if (!entities.length) return {}
    const names = entities.map(e => e.replace(/[-]/g, '\\-')).join('|')
    const inUrl = new RegExp(`[?&](${names})=$`)
    return {
      // `/invoices/archive?invoice=${id}`
      TemplateElement(node) {
        const match = inUrl.exec(node.value.raw)
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
    }
  },
}

/**
 * CLAUDE.md, "Soft deletes": never hard delete records. Options:
 * `{ allow: [...] }`, the drizzle table names (and raw SQL tables) whose rows
 * are not records: join rows, caches, rate-limit buckets, retention.
 */
export const noHardDelete = {
  meta: {
    type: 'problem',
    docs: { description: 'Archive with deletedAt; never hard delete a record' },
    schema: [
      {
        type: 'object',
        properties: { allow: { type: 'array', items: { type: 'string' } } },
        additionalProperties: false,
      },
    ],
    messages: {
      delete:
        'CLAUDE.md "Soft deletes": never hard delete a record. Set deletedAt (archive) instead. A table whose rows are not records (join rows, caches) goes on the allow list in the eslint config.',
    },
  },
  create(context) {
    const allow = new Set(context.options[0]?.allow ?? [])
    return {
      // db.delete(tasks), tx.delete(schema.tasks)
      CallExpression(node) {
        const callee = node.callee
        if (
          callee.type !== 'MemberExpression' ||
          callee.property.type !== 'Identifier' ||
          callee.property.name !== 'delete' ||
          node.arguments.length !== 1
        ) {
          return
        }
        const arg = node.arguments[0]
        const name =
          arg.type === 'Identifier'
            ? arg.name
            : arg.type === 'MemberExpression' &&
                arg.property.type === 'Identifier'
              ? arg.property.name
              : null
        // A Map/Set/URLSearchParams .delete(key) takes a string or a value we
        // can't name; only a bare table identifier looks like drizzle.
        if (!name || allow.has(name)) return
        if (!/^[a-z][A-Za-z]*$/.test(name)) return
        const object = callee.object
        const objectName =
          object.type === 'Identifier'
            ? object.name
            : object.type === 'MemberExpression' &&
                object.property.type === 'Identifier'
              ? object.property.name
              : ''
        if (!/^(db|tx|trx|database)$/.test(objectName)) return
        context.report({ node, messageId: 'delete' })
      },
      // sql`DELETE FROM tasks …`
      TaggedTemplateExpression(node) {
        if (node.tag.type !== 'Identifier' || node.tag.name !== 'sql') return
        for (const { value } of staticStrings(node.quasi)) {
          const match = /\bdelete\s+from\s+([\w."]+)/i.exec(value)
          if (!match) continue
          const table = match[1].replace(/"/g, '')
          const bare = table.split('.').pop()
          if (allow.has(table) || allow.has(bare) || table.startsWith('auth.'))
            continue
          context.report({ node, messageId: 'delete' })
        }
      },
    }
  },
}

/** input.md: "Mark optional fields with `<FormLabel optional>`". */
export const optionalLabel = {
  meta: {
    type: 'problem',
    docs: { description: 'Optional fields use FormLabel optional' },
    schema: [],
    messages: {
      optional:
        'docs/design-system/components/input.md: "Mark optional fields with `<FormLabel optional>`" (or `<OptionalMarker />` beside a plain Label). Don\'t write "(optional)" by hand.',
    },
  },
  create(context) {
    function check(node, value) {
      if (/\(optional\)/i.test(value))
        context.report({ node, messageId: 'optional' })
    }
    return {
      JSXText(node) {
        check(node, node.value)
      },
      'JSXExpressionContainer > Literal'(node) {
        if (typeof node.value === 'string') check(node, node.value)
      },
      'JSXAttribute > Literal'(node) {
        if (
          node.parent.name?.name === 'label' &&
          typeof node.value === 'string'
        ) {
          check(node, node.value)
        }
      },
    }
  },
}

/**
 * Env vars are read through the app's zod schema (lib/env*.ts), which
 * validates them and treats an empty string as unset. Build-time and
 * platform values stay direct: NODE_ENV, NEXT_PUBLIC_* (inlined into the
 * browser bundle) and VERCEL_*.
 */
export const envThroughSchema = {
  meta: {
    type: 'problem',
    docs: { description: 'Read server env vars through the env schema' },
    schema: [],
    messages: {
      env: 'Read {{name}} through the env schema (serverEnv in lib/env.server.ts), which validates it and treats an empty string as unset. Add it to the schema if it is missing.',
    },
  },
  create(context) {
    return {
      MemberExpression(node) {
        const object = node.object
        if (
          object.type !== 'MemberExpression' ||
          object.object.type !== 'Identifier' ||
          object.object.name !== 'process' ||
          object.property.type !== 'Identifier' ||
          object.property.name !== 'env'
        ) {
          return
        }
        const name =
          node.property.type === 'Identifier' && !node.computed
            ? node.property.name
            : node.property.type === 'Literal'
              ? String(node.property.value)
              : '(computed)'
        if (/^(NODE_ENV|NEXT_PUBLIC_\w+|VERCEL\w*|CI)$/.test(name)) return
        context.report({ node, messageId: 'env', data: { name } })
      },
    }
  },
}
