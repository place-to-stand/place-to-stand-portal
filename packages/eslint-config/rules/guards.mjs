/**
 * Rules that guard a written "never" (docs/design-system/README.md, CLAUDE.md)
 * which used to rest on review alone: soft deletes and the env schema.
 */
import { staticStrings } from './utils.mjs'

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
