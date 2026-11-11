import { base } from './base.mjs'

export default [
  ...base(),
  // The rules quote the classes and copy they ban.
  {
    files: ['rules/**'],
    rules: { 'pts/class-names': 'off', 'pts/copy': 'off' },
  },
]
