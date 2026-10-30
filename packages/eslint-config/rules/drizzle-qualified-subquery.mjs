/**
 * Flags an outer-table column interpolated into a correlated subquery:
 *
 *   sql`(select ${contacts.id} from ${contacts} where ${contacts.userId} = ${users.id})`
 *
 * Drizzle renders a column without its table name inside a single-table
 * select, so `${users.id}` comes out as plain "id" and binds to the INNER
 * table (contacts.id). The query still runs and silently returns the wrong
 * rows. This happened three times, twice in money code: the project owner's
 * contact id (always null), and `billingTypeAsOfSql` /
 * `commissionColumnAsOfSql` (monthly close, by period).
 *
 * A column is "outer" when its table is not itself interpolated as a table
 * (`from ${t}` / `join ${t}`) in the same template. Columns of the inner
 * table are fine: unqualified, they bind to the inner table, as intended.
 */

const SCHEMA_SOURCE = /(^|\/)schema(\.ts)?$|^@pts\/db(\/schema)?$/

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Write outer-table columns in a correlated sql`` subquery table-qualified',
    },
    schema: [],
    messages: {
      outer:
        '`${{{name}}}` is an outer-table column inside a correlated subquery. Drizzle renders it without its table name, so it binds to the inner table and the query silently returns the wrong rows. Use the client-state SQL functions (@pts/db/client-state) or write it qualified: sql.raw(\'"{{table}}"."{{column}}"\').',
    },
  },
  create(context) {
    /** Identifiers imported from a schema module. */
    const schemaImports = new Set()

    function isSqlTag(tag) {
      return tag.type === 'Identifier' && tag.name === 'sql'
    }

    return {
      ImportDeclaration(node) {
        if (!SCHEMA_SOURCE.test(String(node.source.value))) return
        for (const spec of node.specifiers) {
          if (
            spec.type === 'ImportSpecifier' ||
            spec.type === 'ImportNamespaceSpecifier'
          ) {
            schemaImports.add(spec.local.name)
          }
        }
      },
      TaggedTemplateExpression(node) {
        if (!isSqlTag(node.tag)) return
        const { quasis, expressions } = node.quasi
        const text = quasis.map(q => q.value.cooked ?? q.value.raw).join(' ')
        if (!/\bselect\b/i.test(text)) return

        const innerTables = new Set(
          expressions.filter(e => e.type === 'Identifier').map(e => e.name)
        )

        for (const expr of expressions) {
          if (expr.type !== 'MemberExpression' || expr.computed) continue
          // `schema.table.column` (namespace import) or `table.column`.
          let tableNode = expr.object
          if (
            tableNode.type === 'MemberExpression' &&
            !tableNode.computed &&
            tableNode.object.type === 'Identifier' &&
            schemaImports.has(tableNode.object.name)
          ) {
            if (innerTables.has(tableNode.property.name)) continue
          } else if (tableNode.type === 'Identifier') {
            if (!schemaImports.has(tableNode.name)) continue
            if (innerTables.has(tableNode.name)) continue
          } else {
            continue
          }
          const tableName =
            tableNode.type === 'Identifier'
              ? tableNode.name
              : tableNode.property.name
          const column = expr.property.name
          context.report({
            node: expr,
            messageId: 'outer',
            data: {
              name: context.sourceCode.getText(expr),
              table: toSnake(tableName),
              column: toSnake(column),
            },
          })
        }
      },
    }
  },
}

function toSnake(name) {
  return name.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`)
}
