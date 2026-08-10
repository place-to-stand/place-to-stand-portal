# 02 — Monthly Close: temporal billing-type resolution

Replace every `clients.billing_type` read in the monthly close with "billing type **as of the report period**" resolved from `client_billing_terms`. After this section, changing a client's billing terms never alters an already-rendered historical month. This is the section that makes the first client's net_30 → prepaid switch safe.

## Resolution helper

In `apps/internal/lib/queries/clients/billing-terms.ts`:

```ts
import { sql } from 'drizzle-orm'
import { clientBillingTerms, clients } from '@pts/db/schema'

/**
 * Billing type for a client as of a report period, resolved the same way
 * getPartnerRatesForPeriod resolves rates: newest effective_from <= period
 * start wins (D4). Correlated subquery against the outer `clients` table.
 */
export function billingTypeAsOfSql(periodStart: string) {
  return sql<'prepaid' | 'net_30' | null>`(
    SELECT ${clientBillingTerms.billingType}
    FROM ${clientBillingTerms}
    WHERE ${clientBillingTerms.clientId} = ${clients.id}
      AND ${clientBillingTerms.effectiveFrom} <= ${periodStart}
      AND ${clientBillingTerms.deletedAt} IS NULL
    ORDER BY ${clientBillingTerms.effectiveFrom} DESC
    LIMIT 1
  )`
}
```

Resolution is by **period start** (`startDate`, always the 1st — [apps/internal/app/(dashboard)/reports/monthly-close/page.tsx](<../../../apps/internal/app/(dashboard)/reports/monthly-close/page.tsx>) builds it with `startOfMonth`). Combined with the month-start CHECK on `effective_from`, a term can never change mid-period, so a single resolution per client per report is exact — no per-row (per time log) resolution needed.

## Filter-site changes

In [apps/internal/lib/queries/reports/monthly-close.ts](../../../apps/internal/lib/queries/reports/monthly-close.ts), replace all **eight** occurrences of `eq(clients.billingType, '…')` with the resolved comparison:

| Function | Sites | Change |
|----------|-------|--------|
| `fetchOriginationCommissions` | 4 (prepaid×user, prepaid×contact, net_30×user, net_30×contact) | `eq(clients.billingType, 'prepaid')` → `sql\`${billingTypeAsOfSql(startDate)} = 'prepaid'\`` (and `'net_30'` respectively) |
| `fetchCloserCommissions` | 2 (prepaid, net_30) | same |
| `fetchPrepaidBilling` | 1 | same |
| `fetchNet30Billing` | 1 | same |

The hardcoded `clientBillingType: 'prepaid' | 'net_30'` literals stamped onto `OriginationQueryRow` / `CloserQueryRow` in the row-mapping loops remain correct — each sub-query's population is *defined* by its resolved type.

**Prepaid attribution switches to `billing_month` (F7, defined in section 01):** the four hour-block-sourced queries (`fetchPrepaidBilling`, both prepaid origination sub-queries, the prepaid closer sub-query) currently range on `DATE(hour_blocks.created_at AT TIME ZONE 'UTC')` — they change to `hourBlocks.billingMonth >= startDate AND <= endDate` (equivalently `billingMonth = startDate`, since both are month-start dates). `fetchReportDateBounds` likewise switches its hour-block bound from `MIN(created_at)` to `MIN(billing_month)`. Backfill sets `billing_month` = creation month, so pre-migration output is unchanged.

`fetchEmployeePayroll` and `fetchBillableWorkHours` don't read billing type — unchanged.

## Semantics worth spelling out

- **A client switching net_30 → prepaid effective Sept 1**: August (and all earlier months) resolves `net_30` → billed from time logs, exactly as today. September onward resolves `prepaid` → billed from hour blocks purchased. Origination/closer commissions follow the same basis switch automatically, since they share the resolution.
- **NULL resolution** (no terms row ≤ period start): the comparison is false in both branches → client excluded from that month. Post-backfill this only happens for months predating a client's first term, where the client has no billable data anyway. This matches `IS NULL`-safe SQL semantics with no extra handling.
- **`clients.billing_type` becomes report-dead**: after this section, the monthly close never reads the cache column. Grep-verify: `apps/internal/lib/queries/reports/` and `apps/internal/lib/data/reports/` contain no `clients.billingType` references.

## Data-layer / UI impact

None functionally — [apps/internal/lib/data/reports/monthly-close.ts](../../../apps/internal/lib/data/reports/monthly-close.ts) and the section components consume the same row shapes. The `billingType` shown per client detail row in origination/closer sheets now reflects the period-resolved type, which is the correct display for a historical month.

## Performance

Correlated subquery per client row against `idx_client_billing_terms_resolution` `(client_id, effective_from DESC) WHERE deleted_at IS NULL` — an index-only top-1 probe. Client cardinality here is tiny (grouped per-client aggregates); no measurable cost.

## Acceptance criteria

- [ ] With only backfill rows present, every historical month renders **byte-identical** report data to pre-change output (spot-check 2–3 months against production values before/after deploy)
- [ ] Insert a terms row for a test client (`prepaid`, effective first of next month): current and past months still show the client under Net 30; next month shows them under Prepaid
- [ ] Origination and closer sections move the client between billing bases on the same boundary
- [ ] A block created before the boundary (with `billing_month` = the boundary month) appears in the boundary month's Prepaid billing, not the creation month's
- [ ] No remaining `clients.billingType` reads under `apps/internal/lib/queries/reports/` or `apps/internal/lib/data/reports/`
- [ ] `npm run build`, `npm run lint`, `npm run type-check` pass from repo root
