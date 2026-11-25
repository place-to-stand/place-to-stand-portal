#!/usr/bin/env node
/**
 * Publishes every package we share outside this repo (`@placetostand/*`)
 * whose version isn't on npm yet. The release workflow
 * (.github/workflows/release.yml) runs it after the "Release packages" pull
 * request merges. Publishing needs GitHub Actions (packages carry npm
 * provenance), so by hand only the dry run works:
 *
 *   node scripts/publish-packages.mjs            publish what's new (CI only)
 *   node scripts/publish-packages.mjs --dry-run  build and pack, publish nothing
 *
 * Each package builds into its dist/ folder (scripts/build-package.mjs) and
 * publishes from there, so the source package.json, which points the apps at
 * src/, never reaches npm.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** The packages we publish. Everything else in packages/ stays private. */
export const PUBLISHED = ['packages/ui']

const dryRun = process.argv.includes('--dry-run')

function run(command, args, cwd) {
  return execFileSync(command, args, { cwd, encoding: 'utf8', stdio: 'pipe' })
}

/** True when npm already has this exact version. */
function isPublished(name, version) {
  try {
    run('npm', ['view', `${name}@${version}`, 'version'], ROOT)
    return true
  } catch (error) {
    // npm exits 1 with E404 for a package or version it doesn't have; any
    // other failure (network, auth) must stop the release, not publish twice.
    if (/E404|404 Not Found/.test(String(error.stderr))) return false
    throw error
  }
}

let published = 0
for (const path of PUBLISHED) {
  const dir = join(ROOT, path)
  const { name, version } = JSON.parse(
    readFileSync(join(dir, 'package.json'), 'utf8')
  )
  if (!dryRun && isPublished(name, version)) {
    console.log(`${name}@${version} is already on npm`)
    continue
  }
  execFileSync(process.execPath, [join(ROOT, 'scripts/build-package.mjs')], {
    cwd: dir,
    stdio: 'inherit',
  })
  const dist = join(dir, 'dist')
  if (dryRun) {
    execFileSync('npm', ['pack', '--dry-run'], { cwd: dist, stdio: 'inherit' })
    continue
  }
  execFileSync('npm', ['publish'], { cwd: dist, stdio: 'inherit' })
  // The Changesets action reads these lines to report what it published.
  console.log(`New tag: ${name}@${version}`)
  published++
}
console.log(dryRun ? 'Dry run: nothing published.' : `Published ${published}.`)
