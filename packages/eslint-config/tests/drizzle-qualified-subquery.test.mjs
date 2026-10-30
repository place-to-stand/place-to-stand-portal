import { describe, it } from 'node:test'

import { RuleTester } from 'eslint'
import tseslint from 'typescript-eslint'

import rule from '../rules/drizzle-qualified-subquery.mjs'

RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({
  languageOptions: { parser: tseslint.parser, ecmaVersion: 'latest', sourceType: 'module' },
})

const imports = `import { sql } from 'drizzle-orm'
import { billingTerms, commissionTerms, companies, contacts, users } from '@/lib/db/schema'
`

tester.run('drizzle-qualified-subquery', rule, {
  valid: [
    // The inner table's own columns bind correctly unqualified.
    imports +
      'sql`(select ${contacts.id} from ${contacts} where ${contacts.deletedAt} is null)`',
    // The fix: the outer column written table-qualified.
    imports +
      'sql`(select ${billingTerms.billingType} from ${billingTerms} where ${billingTerms.companyId} = ${sql.raw(\'"companies"."id"\')})`',
    // Not a subquery: a column in a plain fragment is fine.
    imports + 'sql`${companies.name} ilike ${"%a%"}`',
    // Not a schema import.
    imports + 'const t = { id: 1 }\nsql`(select 1 from x where y = ${t.id})`',
  ],
  invalid: [
    {
      // Historical case 1: the project owner's contact id (always null).
      code:
        imports +
        'sql`(select ${contacts.id} from ${contacts} where ${contacts.userId} = ${users.id} and ${contacts.deletedAt} is null limit 1)`',
      errors: [{ messageId: 'outer' }],
    },
    {
      // Historical case 2: billingTypeAsOfSql.
      code:
        imports +
        `sql\`(
          SELECT \${billingTerms.billingType}
          FROM \${billingTerms}
          WHERE \${billingTerms.companyId} = \${companies.id}
          ORDER BY \${billingTerms.effectiveFrom} DESC LIMIT 1
        )\``,
      errors: [{ messageId: 'outer' }],
    },
    {
      // Historical case 3: commissionColumnAsOfSql (computed inner column).
      code:
        imports +
        'function f(column) { return sql`(SELECT ${commissionTerms[column]} FROM ${commissionTerms} WHERE ${commissionTerms.companyId} = ${companies.id} LIMIT 1)` }',
      errors: [{ messageId: 'outer' }],
    },
    {
      // A typed sql<…> tag and a raw-text inner table.
      code:
        imports +
        'sql<number>`(select count(*) from tasks t where t.project_id = ${companies.id})`',
      errors: [{ messageId: 'outer' }],
    },
  ],
})
