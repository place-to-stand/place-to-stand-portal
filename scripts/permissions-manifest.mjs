#!/usr/bin/env node
/**
 * Builds the endpoint half of the permissions registry.
 *
 * `apps/internal/lib/auth/capabilities.ts` says what each role may do. This
 * script finds where that is enforced: every API route handler, server action
 * and page in `apps/internal/app`, and the guard each one calls. The result is
 * `apps/internal/lib/auth/permissions-manifest.json`, which Settings → Roles &
 * permissions renders, so the screen can't drift from the code.
 *
 *   node scripts/permissions-manifest.mjs          # write the manifest
 *   node scripts/permissions-manifest.mjs --check  # fail if it is stale
 *
 * `npm run lint` runs the check. An endpoint whose guard isn't recognised
 * shows on the screen as "Guarded in code it calls"; add a recognised guard
 * (or a `// permission: <capability>` comment) to make it explicit.
 *
 * Server actions must be explicit: `--check` fails on any export of a
 * 'use server' file (anywhere in apps/internal, and in apps/client) whose
 * guard isn't recognised, unless a `// permission: <capability>` comment
 * sits on it. A server action is a public POST endpoint; "guarded in code
 * it calls" is too easy to get wrong there.
 *
 * Only code counts: comments are stripped before guards are matched, except
 * a `// permission:` line on an export or heading its file, and every
 * capability named (in code or a declaration) must exist in capabilities.ts.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const appDir = join(root, 'apps/internal/app')
const outFile = join(root, 'apps/internal/lib/auth/permissions-manifest.json')
const internalDir = join(root, 'apps/internal')
const clientDir = join(root, 'apps/client')
const SKIP_DIRS = new Set(['node_modules', '.next', 'scripts'])

/** Guards the client portal's server actions call (not in the manifest). */
const CLIENT_GUARDS = [/\/\/\s*permission:\s*[a-z_.]+/, /\brequireClientUser\(/]

/** A file whose first statement is the 'use server' directive. */
const USE_SERVER = /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*['"]use server['"]/

/**
 * Guard call → what it enforces. The earliest guard call in a function body
 * wins, so the guard that runs first is the one shown. Comments are stripped
 * before matching, so a comment that names a guard never counts.
 */
const GUARDS = [
  {
    re: /\b(?:requirePage|authorizeRoute)\(\s*(?:isBoard\s*\?\s*)?['"]([a-z_.]+)['"]/,
    kind: 'capability',
    fromMatch: 1,
  },
  {
    re: /\bassertCan\([^,()]+,\s*['"]([a-z_.]+)['"]\)/,
    kind: 'capability',
    fromMatch: 1,
  },
  {
    // A branch more often than a gate: counts only when nothing stronger runs.
    re: /\broleCan\([^,()]+,\s*['"]([a-z_.]+)['"]\)/,
    kind: 'capability',
    fromMatch: 1,
    strength: 1,
  },
  { re: /\bwithCliAuth\b/, kind: 'capability', capability: 'integrations.cli' },
  { re: /\b(?:verifyIntakeToken|CRON_SECRET)\b/, kind: 'token' },
  {
    re: /\brequireCrmUser\(/,
    kind: 'capability',
    capability: 'portal.sign_in',
  },
  {
    // Signed in, nothing more; a roleCan after it is the real check.
    re: /\bgetCurrentStaff\(/,
    kind: 'capability',
    capability: 'portal.sign_in',
    strength: 0,
  },
  {
    re: /\b(?:assertCrmAccess)\(/,
    kind: 'capability',
    capability: 'leads.manage',
  },
  {
    re: /\b(?:assertAdmin\(|requireUser\(\)|getCurrentAdmin\(|ensure(?:Project|Task|TimeLog)Access\()/,
    kind: 'admin',
  },
]

/**
 * An explicit declaration on an export, for code whose guard runs in what it
 * calls: `// permission: <capability> — <why>` (or `public`) on its own line.
 * The capability must exist in capabilities.ts.
 */
const PERMISSION_COMMENT = /^[ \t]*\/\/\s*permission:\s*([a-z_.]+)/m

/** The same declaration heading a file: applies to every export in it. */
const FILE_PERMISSION_COMMENT =
  /^(?:\s*(?:['"]use server['"];?|\/\/(?!\s*permission:)[^\n]*))*\s*\/\/\s*permission:\s*([a-z_.]+)/

const KNOWN_CAPABILITIES = new Set(
  [
    ...readFileSync(
      join(root, 'apps/internal/lib/auth/capabilities.ts'),
      'utf8'
    ).matchAll(/^\s+'([a-z_]+\.[a-z_]+)':\s*\{/gm),
  ].map(match => match[1])
)

/** Source with comments blanked (strings and template text are kept). */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, match => match.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.(ts|tsx)$/.test(name)) out.push(full)
  }
  return out
}

/** `app/(dashboard)/clients/[clientSlug]/page.tsx` → `/clients/[clientSlug]`. */
function toRoute(file) {
  const parts = relative(appDir, file).split(sep).slice(0, -1)
  const path = parts.filter(part => !/^\(.*\)$/.test(part)).join('/')
  return `/${path}`
}

/** Exported functions and the text up to the next export, as bodies. */
function exportedFunctions(source) {
  const re =
    /export\s+(?:const\s+(\w+)\s*=|(?:default\s+)?(?:async\s+)?function\s*(\w*))/g
  const marks = []
  let match
  while ((match = re.exec(source))) {
    let index = match.index
    const before = source.slice(0, index).match(/(?:^[ \t]*\/\/[^\n]*\n)+$/m)
    if (before) index -= before[0].length
    marks.push({ name: match[1] ?? match[2] ?? 'default', index })
  }
  return marks.map((mark, i) => ({
    name: mark.name || 'default',
    body: source.slice(mark.index, marks[i + 1]?.index ?? source.length),
  }))
}

const badDeclarations = []

/** Top-level function and const declarations of a file, by name. */
function localHelpers(source) {
  const code = stripComments(source)
  const re =
    /^(?:export\s+)?(?:(?:async\s+)?function\s+(\w+)|const\s+(\w+)\s*=\s*(?:cache\()?(?:async\s*)?(?:\(|function))/gm
  const marks = []
  let match
  while ((match = re.exec(code))) {
    marks.push({ name: match[1] ?? match[2], index: match.index })
  }
  const helpers = new Map()
  marks.forEach((mark, i) => {
    helpers.set(
      mark.name,
      code.slice(mark.index, marks[i + 1]?.index ?? code.length)
    )
  })
  return helpers
}

/** Every guard call in `code`, following same-file helpers it calls. */
function guardCalls(code, helpers, depth = 0) {
  const calls = []
  for (const guard of GUARDS) {
    const re = new RegExp(guard.re.source, 'g')
    let match
    while ((match = re.exec(code)))
      calls.push({ index: match.index, guard, match })
  }
  if (depth < 3) {
    for (const [name, helperBody] of helpers) {
      if (helperBody === code) continue
      const call = new RegExp(`\\b${name}\\(`).exec(code)
      if (!call) continue
      for (const inner of guardCalls(helperBody, helpers, depth + 1)) {
        calls.push({ ...inner, index: call.index })
      }
    }
  }
  return calls
}

const capabilityOf = ({ guard, match }) =>
  guard.capability ?? (guard.fromMatch ? match[guard.fromMatch] : null)

/**
 * The guard to show: the earliest gate (requirePage, authorizeRoute,
 * assertCan, …). With no gate, the earliest roleCan, else getCurrentStaff.
 */
function firstGuard(code, helpers) {
  const calls = guardCalls(code, helpers).sort((a, b) => a.index - b.index)
  const strength = call => call.guard.strength ?? 2
  for (const level of [2, 1, 0]) {
    const call = calls.find(c => strength(c) === level)
    if (call) return call
  }
  return undefined
}

/**
 * What guards one export. In order: a `// permission:` line on the export,
 * the earliest gate in its body (or in a same-file helper it calls), a
 * `// permission:` line heading the file, then a bare roleCan check.
 */
function guardFor(body, file, source) {
  const declared = body.match(PERMISSION_COMMENT)
  if (declared) return declaredGuard(declared[1], file)

  const helpers = localHelpers(source)
  const found = firstGuard(stripComments(body), helpers)
  const header = source.match(FILE_PERMISSION_COMMENT)
  // A file's declaration beats a bare roleCan branch, not a real gate.
  if (header && (!found || (found.guard.strength ?? 2) < 2)) {
    return declaredGuard(header[1], file)
  }
  if (!found) return { kind: 'delegated', capability: null }

  const capability = capabilityOf(found)
  if (capability && !KNOWN_CAPABILITIES.has(capability)) {
    badDeclarations.push(`${file}: ${capability}`)
  }
  return { kind: found.guard.kind, capability }
}

function declaredGuard(capability, file) {
  if (capability === 'public') return { kind: 'public', capability: null }
  if (!KNOWN_CAPABILITIES.has(capability)) {
    badDeclarations.push(`${file}: permission: ${capability}`)
  }
  return { kind: 'capability', capability }
}

const entries = []
for (const file of walk(appDir).sort()) {
  const source = readFileSync(file, 'utf8')
  const rel = relative(root, file).split(sep).join('/')
  const base = file.split(sep).pop()

  if (base === 'route.ts') {
    for (const fn of exportedFunctions(source)) {
      if (!HTTP_METHODS.includes(fn.name)) continue
      entries.push({
        type: 'route',
        name: `${fn.name} ${toRoute(file).replace(/^\/api/, '/api')}`,
        file: rel,
        ...guardFor(fn.body, rel, source),
      })
    }
  } else if (base === 'page.tsx') {
    const fn = exportedFunctions(source).find(f =>
      /^default$|Page$/.test(f.name)
    ) ?? { body: source }
    entries.push({
      type: 'page',
      name: toRoute(file) || '/',
      file: rel,
      ...guardFor(fn.body, rel, source),
    })
  } else if (USE_SERVER.test(source)) {
    for (const fn of exportedFunctions(source)) {
      entries.push({
        type: 'action',
        name: fn.name,
        file: rel,
        ...guardFor(fn.body, rel, source),
      })
    }
  }
}

for (const file of walk(internalDir).sort()) {
  if (file.startsWith(appDir)) continue
  const source = readFileSync(file, 'utf8')
  if (!USE_SERVER.test(source)) continue
  const rel = relative(root, file).split(sep).join('/')
  for (const fn of exportedFunctions(source)) {
    entries.push({
      type: 'action',
      name: fn.name,
      file: rel,
      ...guardFor(fn.body, rel, source),
    })
  }
}

// Pages inherit their layout's guard (Settings is admin-only by layout).
for (const entry of entries) {
  if (entry.type !== 'page' || entry.kind !== 'delegated') continue
  let dir = join(root, entry.file, '..')
  while (dir.startsWith(appDir)) {
    try {
      const layout = readFileSync(join(dir, 'layout.tsx'), 'utf8')
      const guard = guardFor(layout, relative(root, dir), layout)
      if (guard.kind !== 'delegated') {
        Object.assign(entry, guard)
        break
      }
    } catch {}
    dir = join(dir, '..')
  }
}

const manifest = JSON.stringify(entries, null, 2) + '\n'

const unguarded = entries
  .filter(entry => entry.type === 'action' && entry.kind === 'delegated')
  .map(entry => `${entry.file}: ${entry.name}`)
for (const file of walk(clientDir).sort()) {
  const source = readFileSync(file, 'utf8')
  if (!USE_SERVER.test(source)) continue
  const rel = relative(root, file).split(sep).join('/')
  for (const fn of exportedFunctions(source)) {
    if (!CLIENT_GUARDS.some(re => re.test(fn.body)))
      unguarded.push(`${rel}: ${fn.name}`)
  }
}

if (badDeclarations.length) {
  console.error(
    'Guards that name a capability capabilities.ts does not define:'
  )
  for (const line of badDeclarations) console.error(`  - ${line}`)
  process.exit(1)
}

if (process.argv.includes('--check')) {
  if (unguarded.length) {
    console.error(
      "Server actions without a recognised guard (they'd show as \"Guarded in code it calls\"). Call a guard this script knows (requirePage('<capability>'), authorizeRoute('<capability>'), assertCan(user, '<capability>'), assertAdmin(user), … in apps/internal; requireClientUser in apps/client), or put `// permission: <capability> — <why>` on the export (`public` for a deliberately open one):"
    )
    for (const line of unguarded) console.error(`  - ${line}`)
    process.exit(1)
  }
  let current = ''
  try {
    current = readFileSync(outFile, 'utf8')
  } catch {}
  if (current !== manifest) {
    console.error(
      'permissions-manifest.json is out of date. Run: npm run permissions-manifest'
    )
    process.exit(1)
  }
  console.log(`permissions manifest up to date (${entries.length} endpoints)`)
} else {
  writeFileSync(outFile, manifest)
  const counts = entries.reduce(
    (acc, e) => ((acc[e.kind] = (acc[e.kind] ?? 0) + 1), acc),
    {}
  )
  console.log(`wrote ${entries.length} endpoints`, counts)
}
