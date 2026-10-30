/**
 * Layering and server boundaries (CLAUDE.md, "Data Layer Architecture").
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import { hasDirective } from './utils.mjs'

const EXTENSIONS = ['', '.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.tsx']
const serverOnlyCache = new Map()

/** Resolve an app import (`@/x` or relative) to a file, or null. */
function resolveImport(source, filename, appDir) {
  let base
  if (source.startsWith('@/')) base = join(appDir, source.slice(2))
  else if (source.startsWith('.')) base = resolve(dirname(filename), source)
  else return null
  for (const ext of EXTENSIONS) {
    const candidate = base + ext
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

function isServerOnly(file) {
  if (!serverOnlyCache.has(file)) {
    const text = readFileSync(file, 'utf8')
    serverOnlyCache.set(file, /^\s*import\s+['"]server-only['"]/m.test(text))
  }
  return serverOnlyCache.get(file)
}

/** A runtime import: not `import type`, and not every specifier type-only. */
function isRuntimeImport(node) {
  if (node.importKind === 'type' || node.exportKind === 'type') return false
  const specs = node.specifiers ?? []
  if (specs.length && specs.every(s => s.importKind === 'type')) return false
  return true
}

const CLIENT_BANNED = [
  { re: /^@\/lib\/queries(\/|$)/, why: 'lib/queries runs database queries' },
  { re: /^@\/lib\/db(\/|$)/, why: 'lib/db is the database client' },
  { re: /^@pts\/db(\/|$)/, why: '@pts/db is the database layer' },
]

/** 'use client' files stay on the client side of the boundary. */
export const clientBoundary = {
  meta: {
    type: 'problem',
    docs: { description: "A 'use client' file imports no server-only code" },
    schema: [
      {
        type: 'object',
        properties: { appDir: { type: 'string' } },
        additionalProperties: false,
      },
    ],
    messages: {
      banned:
        "Server boundary (CLAUDE.md, \"Server-only imports\"): a 'use client' file can't import {{source}} ({{why}}); it would ship server code to the browser or fail the build. Fetch it in a server component or a server action and pass the data down. A type-only import (`import type`) is fine.",
      serverOnly:
        "Server boundary (CLAUDE.md, \"Server-only imports\"): {{source}} starts with import 'server-only', so a 'use client' file can't import it. Fetch in a server component or a server action and pass the data down, or move the pure part into a module without 'server-only'.",
    },
  },
  create(context) {
    const appDir = context.options[0]?.appDir
    let isClient = false
    function check(node) {
      if (!isClient || !node.source || !isRuntimeImport(node)) return
      const source = String(node.source.value)
      const banned = CLIENT_BANNED.find(b => b.re.test(source))
      if (banned) {
        context.report({
          node,
          messageId: 'banned',
          data: { source, why: banned.why },
        })
        return
      }
      if (!appDir) return
      const file = resolveImport(source, context.filename, appDir)
      if (file && isServerOnly(file)) {
        context.report({ node, messageId: 'serverOnly', data: { source } })
      }
    }
    return {
      Program(node) {
        isClient = hasDirective(node, 'use client')
      },
      ImportDeclaration: check,
      ExportNamedDeclaration: check,
      ExportAllDeclaration: check,
    }
  },
}

const QUERY_BANNED = [
  {
    re: /^@\/lib\/activity\/(logger|events)(\/|$)/,
    what: 'activity logging',
    instead: 'log in the server action or lib/<domain> service after the write',
  },
  {
    re: /^@\/lib\/auth\/(permissions|capabilities|roles|session)$/,
    what: 'permission checks',
    instead:
      'check permissions in the data layer (lib/data) or the server action that calls the query',
  },
]

/** lib/queries is the low-level database layer: no business logic. */
export const queryLayerPurity = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'lib/queries does no logging and no permission checks',
    },
    schema: [],
    messages: {
      banned:
        'Layering (CLAUDE.md, "Data Layer Architecture"): lib/queries is "direct Drizzle queries, minimal business logic"; {{what}} ({{source}}) belongs a layer up: {{instead}}. A type-only import is fine.',
    },
  },
  create(context) {
    function check(node) {
      if (!node.source || !isRuntimeImport(node)) return
      const source = String(node.source.value)
      const banned = QUERY_BANNED.find(b => b.re.test(source))
      if (banned) {
        context.report({
          node,
          messageId: 'banned',
          data: { source, what: banned.what, instead: banned.instead },
        })
      }
    }
    return {
      ImportDeclaration: check,
      ExportNamedDeclaration: check,
      ExportAllDeclaration: check,
    }
  },
}
