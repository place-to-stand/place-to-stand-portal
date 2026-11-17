#!/usr/bin/env node
/**
 * TypeScript 7's compiler, for type-checking:
 *
 *   tsc7 --noEmit
 *
 * TypeScript 7 is installed as `typescript-7` beside TypeScript 6, because
 * Next.js and typescript-eslint still load TypeScript 6's JavaScript API
 * from `typescript`, which TypeScript 7 no longer ships. Both packages name
 * their binary `tsc`, so `npx tsc` may run either: use this instead.
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const root = dirname(require.resolve('typescript-7/package.json'))
const { bin } = require('typescript-7/package.json')
const result = spawnSync(
  process.execPath,
  [join(root, bin.tsc), ...process.argv.slice(2)],
  {
    stdio: 'inherit',
  }
)
process.exit(result.status ?? 1)
