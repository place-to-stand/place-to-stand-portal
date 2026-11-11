/**
 * `pts/*`: the repo's own lint rules. Each one quotes the rule it enforces
 * (a house rule in docs/design-system/README.md, or a past bug) and says what
 * to write instead. Checks of one kind share a rule (`class-names`, `copy`,
 * `sheets`); what eslint's built-in rules can say lives in the configs
 * (base.mjs, next.mjs), and what a type can say lives in the component.
 */
import { noRoleLiteral } from './rules/auth.mjs'
import { classNames } from './rules/class-names.mjs'
import { copy } from './rules/copy.mjs'
import drizzleQualifiedSubquery from './rules/drizzle-qualified-subquery.mjs'
import { envThroughSchema, noHardDelete } from './rules/guards.mjs'
import {
  archiveConfirm,
  filterSelect,
  saveNotGatedOnDirty,
} from './rules/house-rules.mjs'
import { clientBoundary } from './rules/layering.mjs'
import { sheets } from './rules/sheets.mjs'
import { shortcutRegistry } from './rules/shortcuts.mjs'
import { figureCellAligned, fixedTableColumns } from './rules/table-columns.mjs'

export const pts = {
  meta: { name: 'pts' },
  rules: {
    'class-names': classNames,
    copy,
    sheets,
    'drizzle-qualified-subquery': drizzleQualifiedSubquery,
    'no-hard-delete': noHardDelete,
    'env-through-schema': envThroughSchema,
    'no-role-literal': noRoleLiteral,
    'client-boundary': clientBoundary,
    'shortcut-registry': shortcutRegistry,
    'save-not-gated-on-dirty': saveNotGatedOnDirty,
    'archive-confirm': archiveConfirm,
    'filter-select': filterSelect,
    'figure-cell-aligned': figureCellAligned,
    'fixed-table-columns': fixedTableColumns,
  },
}
