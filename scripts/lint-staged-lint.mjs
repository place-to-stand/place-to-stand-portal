/**
 * Pre-commit lint for staged files, run inside each file's workspace.
 *
 * pts-lint reads the workspace's oxlint.config.mjs and
 * `lint-suppressions.json` (the problems grandfathered in) from the
 * directory it runs in, with paths relative to it, so running once from the
 * repo root would ignore every workspace's config and list.
 *
 *   node scripts/lint-staged-lint.mjs <file>...
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
  const result = spawnSync('npx', ['pts-lint', '--fix', ...files], {
    cwd: join(root, workspace),
    stdio: 'inherit',
  })
  if (result.status !== 0) failed = true
}

process.exit(failed ? 1 : 0)
