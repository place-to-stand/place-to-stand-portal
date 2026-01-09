---
applyTo: "lib/db/**/*,lib/queries/**/*,drizzle/**/*"
---

# Database & Drizzle Review Guidelines

## Schema Design

- UUIDs for primary keys (project standard)
- All core entities must have `deletedAt` timestamp for soft deletes
- Include `createdAt` and `updatedAt` on all tables
- Nullable columns that should have defaults are a concern
- PostgreSQL enums preferred for fixed status values

## Soft Delete Consistency

- Active record queries MUST filter `WHERE deletedAt IS NULL`
- Never hard delete records (preserve historical data)
- Archive/restore via setting/clearing `deletedAt`

## Indexing Strategy

- Foreign keys should have indexes
- Frequently filtered columns need indexes
- Consider partial indexes for soft-delete patterns: `WHERE deleted_at IS NULL`
- Flag over-indexing on write-heavy tables

## Query Patterns

- Flag N+1 queries: fetching related data in loops
- Use eager loading via Drizzle relations where beneficial
- Sequential fetches that can be parallel should use `Promise.all()`
- Unbounded queries (missing LIMIT) are a performance concern
- Large result sets need pagination

## Authorization

- RLS is DISABLED - all access control in application code
- Queries must use `ensureClientAccess()` or permission checks
- Verify ownership before data mutations
- Never expose data without authorization verification

## Migration Safety

- Flag migrations that could lock tables for extended periods
- Backwards-incompatible changes need migration plan
- Schema changes affecting data need data migration consideration
- Review generated SQL before approval

## Relations

- Verify `lib/db/relations.ts` matches schema foreign keys
- Check ON DELETE/ON UPDATE cascade behavior
- Many-to-many relationships need proper join tables
