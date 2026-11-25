#!/usr/bin/env node
/**
 * Builds a package we publish to npm (`@placetostand/*`) into its dist/
 * folder, ready for `npm publish dist`. Run from the package's folder
 * (its `build` script does):
 *
 *   node ../../scripts/build-package.mjs
 *
 * Inside this monorepo the apps import each package's source straight from
 * src/ (its package.json `exports`). A published package needs JavaScript and
 * type files instead, so this:
 *
 *   1. compiles src/ with tsconfig.build.json (TypeScript 6's tsc, which can
 *      emit; TypeScript 7 only type-checks here),
 *   2. adds `.js` to relative imports, so plain Node ESM resolves them too,
 *   3. copies CSS, the README and the repo's LICENSE,
 *   4. writes dist/package.json: the same name, version and dependencies, with
 *      every `exports` entry pointed at the built file.
 */
import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Fields copied as they are from the source package.json. */
const KEPT_FIELDS = [
  'name',
  'version',
  'description',
  'license',
  'author',
  'homepage',
  'repository',
  'keywords',
  'type',
  'dependencies',
  'peerDependencies',
  'peerDependenciesMeta',
]

function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

/** `from './cn'` → `from './cn.js'`, and the same for `import('./x')`. */
export function addJsExtensions(code) {
  return code.replace(
    /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(\.{1,2}\/[^'"]+?)\2/g,
    (match, lead, quote, path) =>
      /\.(m?js|json|css)$/.test(path)
        ? match
        : `${lead}${quote}${path}.js${quote}`
  )
}

/** `./src/button.tsx` → `{ types: './button.d.ts', default: './button.js' }`. */
export function distExport(target) {
  if (!target.startsWith('./src/')) {
    throw new Error(`export target outside src/: ${target}`)
  }
  const path = target.slice('./src/'.length)
  if (path.endsWith('.css')) return `./${path}`
  const base = path.replace(/\.(tsx?|mts)$/, '')
  return { types: `./${base}.d.ts`, default: `./${base}.js` }
}

export function distManifest(source) {
  const manifest = {}
  for (const field of KEPT_FIELDS) {
    if (source[field] !== undefined) manifest[field] = source[field]
  }
  manifest.exports = Object.fromEntries(
    Object.entries(source.exports).map(([key, target]) => [
      key,
      distExport(target),
    ])
  )
  // Lets tools and bundlers read the package's own version.
  manifest.exports['./package.json'] = './package.json'
  // Only CSS has effects on import; everything else can be tree-shaken.
  manifest.sideEffects = ['*.css']
  manifest.publishConfig = { access: 'public', provenance: true }
  for (const [name, range] of Object.entries(manifest.dependencies ?? {})) {
    if (range === '*' || range.startsWith('workspace:')) {
      throw new Error(
        `${source.name} depends on ${name}@${range}: a published package needs a real version range`
      )
    }
  }
  return manifest
}

function build(dir) {
  const source = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  if (source.private) {
    throw new Error(`${source.name} is private; only public packages are built`)
  }
  const dist = join(dir, 'dist')
  rmSync(dist, { recursive: true, force: true })

  const tsc = createRequire(join(ROOT, 'package.json')).resolve(
    'typescript/bin/tsc'
  )
  execFileSync(process.execPath, [tsc, '-p', 'tsconfig.build.json'], {
    cwd: dir,
    stdio: 'inherit',
  })

  for (const file of walk(dist)) {
    if (/\.(js|d\.ts)$/.test(file)) {
      writeFileSync(file, addJsExtensions(readFileSync(file, 'utf8')))
    }
  }
  for (const file of walk(join(dir, 'src'))) {
    if (!file.endsWith('.css')) continue
    const target = join(dist, relative(join(dir, 'src'), file))
    mkdirSync(dirname(target), { recursive: true })
    copyFileSync(file, target)
  }
  for (const [from, to] of [
    [join(dir, 'README.md'), 'README.md'],
    [join(dir, 'CHANGELOG.md'), 'CHANGELOG.md'],
    [join(ROOT, 'LICENSE'), 'LICENSE'],
  ]) {
    if (existsSync(from)) copyFileSync(from, join(dist, to))
  }

  const manifest = distManifest(source)
  for (const [key, target] of Object.entries(manifest.exports)) {
    if (key === './package.json') continue // written below
    const file = typeof target === 'string' ? target : target.default
    if (!existsSync(join(dist, file))) {
      throw new Error(
        `export ${key} points at ${file}, which the build didn't produce`
      )
    }
  }
  writeFileSync(
    join(dist, 'package.json'),
    `${JSON.stringify(manifest, null, 2)}\n`
  )
  console.log(
    `Built ${source.name}@${source.version} into ${relative(ROOT, dist)}`
  )
}

if (process.argv[1] === fileURLToPath(import.meta.url)) build(process.cwd())
