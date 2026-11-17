import { base } from '@pts/lint-config/base'
import { toOxlint } from '@pts/lint-config/to-oxlint'

// A command-line tool: printing is its output.
export default toOxlint(base({ allowConsole: true }))
