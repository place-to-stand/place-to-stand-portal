/**
 * Pre-commit eslint for staged files, run inside each file's workspace.
 *
 * ESLint reads `eslint-suppressions.json` (the files grandfathered over
 * max-lines) from the directory it runs in, with paths relative to it, so
 * running once from the repo root would ignore every workspace's list.
 *
 *   node scripts/lint-staged-eslint.mjs <file>...
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

const root = resolve(dirname(new URL(import.meta.url).pathname), '..')

/** apps/<name> or packages/<name> holding the file. */
const workspaceOf = file => {
  const [scope, name] = relative(root, resolve(file)).split('/')
  return scope === 'apps' || scope === 'packages' ? join(scope, name) : null
}

const byWorkspace = new Map()
for (const file of process.argv.slice(2)) {
  const workspace = workspaceOf(file)
  if (!workspace || !existsSync(join(root, workspace, 'package.json'))) continue
  const files = byWorkspace.get(workspace) ?? []
  files.push(relative(join(root, workspace), resolve(file)))
  byWorkspace.set(workspace, files)
}

let failed = false
for (const [workspace, files] of byWorkspace) {
  const result = spawnSync(
    'npx',
    ['eslint', '--fix', '--no-warn-ignored', '--max-warnings=0', ...files],
    { cwd: join(root, workspace), stdio: 'inherit' }
  )
  if (result.status !== 0) failed = true
}

process.exit(failed ? 1 : 0)
