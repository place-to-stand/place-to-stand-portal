import { ruleTester } from './tester.mjs'

import rule from '../rules/drizzle-qualified-subquery.mjs'

const tester = ruleTester()

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
      // A person's contact id looked up from the outer users row.
      code:
        imports +
        'sql`(select ${contacts.id} from ${contacts} where ${contacts.userId} = ${users.id} and ${contacts.deletedAt} is null limit 1)`',
      errors: [{ messageId: 'outer' }],
    },
    {
      // A billing term looked up for the outer company (billingTypeAsOfSql's shape).
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
      // A computed inner column (commissionColumnAsOfSql's shape).
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
