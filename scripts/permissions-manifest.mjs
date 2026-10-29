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
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const appDir = join(root, 'apps/internal/app')
const outFile = join(root, 'apps/internal/lib/auth/permissions-manifest.json')

/** Guard call → what it enforces. First match in a function body wins. */
const GUARDS = [
  { re: /\/\/\s*permission:\s*([a-z_.]+)/, kind: 'capability', fromMatch: 1 },
  { re: /\b(?:assertCan|requireCapability)\([^,)]*?,?\s*'([a-z_.]+)'/, kind: 'capability', fromMatch: 1 },
  { re: /\broleCan\([^,]+,\s*'([a-z_.]+)'\)/, kind: 'capability', fromMatch: 1 },
  { re: /\bwithCliAuth\b/, kind: 'capability', capability: 'integrations.cli' },
  { re: /\b(?:verifyIntakeToken|CRON_SECRET)\b/, kind: 'token' },
  { re: /\b(?:requireRole\(\s*'ADMIN'|assertAdmin\(|requireUser\(\)|getCurrentAdmin\(|ensure(?:Project|Task|TimeLog)Access\()/, kind: 'admin' },
  { re: /\b(?:requireCrmUser|assertCrmAccess|getCurrentCrmUser)\(/, kind: 'capability', capability: 'leads.manage' },
  { re: /\b(?:requireStaffUser|getCurrentStaff)\(/, kind: 'capability', capability: 'portal.sign_in' },
]

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
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
  const re = /export\s+(?:const\s+(\w+)\s*=|(?:default\s+)?(?:async\s+)?function\s*(\w*))/g
  const marks = []
  let match
  while ((match = re.exec(source))) {
    marks.push({ name: match[1] ?? match[2] ?? 'default', index: match.index })
  }
  return marks.map((mark, i) => ({
    name: mark.name || 'default',
    body: source.slice(mark.index, marks[i + 1]?.index ?? source.length),
  }))
}

function guardFor(body, fileText) {
  for (const text of [body, fileText]) {
    for (const guard of GUARDS) {
      const match = text.match(guard.re)
      if (match) {
        if (guard.fromMatch && match[guard.fromMatch] === 'public') {
          return { kind: 'public', capability: null, inferredFromFile: false }
        }
        return {
          kind: guard.kind,
          capability:
            guard.capability ?? (guard.fromMatch ? match[guard.fromMatch] : null),
          inferredFromFile: text === fileText && text !== body,
        }
      }
    }
  }
  return { kind: 'delegated', capability: null, inferredFromFile: false }
}

const entries = []
for (const file of walk(appDir).sort()) {
  const source = readFileSync(file, 'utf8')
  const rel = relative(root, file).split(sep).join('/')
  const base = file.split(sep).pop()

  if (base === 'route.ts') {
    for (const fn of exportedFunctions(source)) {
      if (!HTTP_METHODS.includes(fn.name)) continue
      entries.push({ type: 'route', name: `${fn.name} ${toRoute(file).replace(/^\/api/, '/api')}`, file: rel, ...guardFor(fn.body, source) })
    }
  } else if (base === 'page.tsx') {
    const fn = exportedFunctions(source).find(f => /^default$|Page$/.test(f.name)) ?? { body: source }
    entries.push({ type: 'page', name: toRoute(file) || '/', file: rel, ...guardFor(fn.body, source) })
  } else if (/^\s*['"]use server['"]/.test(source)) {
    for (const fn of exportedFunctions(source)) {
      entries.push({ type: 'action', name: fn.name, file: rel, ...guardFor(fn.body, source) })
    }
  }
}

// Pages inherit their layout's guard (Settings is admin-only by layout).
for (const entry of entries) {
  if (entry.type !== 'page' || entry.kind !== 'delegated') continue
  let dir = join(root, entry.file, '..')
  while (dir.startsWith(appDir)) {
    try {
      const layout = readFileSync(join(dir, 'layout.tsx'), 'utf8')
      const guard = guardFor(layout, layout)
      if (guard.kind !== 'delegated') {
        Object.assign(entry, guard, { inferredFromFile: true })
        break
      }
    } catch {}
    dir = join(dir, '..')
  }
}

const manifest = JSON.stringify(
  entries.map(({ inferredFromFile, ...entry }) => entry),
  null,
  2
) + '\n'

if (process.argv.includes('--check')) {
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
  const counts = entries.reduce((acc, e) => ((acc[e.kind] = (acc[e.kind] ?? 0) + 1), acc), {})
  console.log(`wrote ${entries.length} endpoints`, counts)
}
