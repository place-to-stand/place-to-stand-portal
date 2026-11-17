import { base } from './base.mjs'
import { toOxlint } from './to-oxlint.mjs'

export default toOxlint([
  ...base(),
  // The rules quote the classes and copy they ban.
  {
    files: ['rules/**'],
    rules: { 'pts/class-names': 'off', 'pts/copy': 'off' },
  },
  {
    // Command-line tools: printing is their output.
    files: ['bin/**', 'scripts/**'],
    rules: { 'no-console': 'off' },
  },
])
