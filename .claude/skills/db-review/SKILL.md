---
name: db-review
description: Review database schema normalization, indexing strategy, query patterns, and migration safety for PostgreSQL/Drizzle. Use when adding tables, modifying schema, reviewing migrations, or optimizing database performance.
---

# Database Review

Analyze database schema design, normalization, and query patterns for PostgreSQL/Drizzle.

## Scope

Review schema files and queries for:

### 1. Normalization Analysis
- First Normal Form (1NF): Atomic values, no repeating groups
- Second Normal Form (2NF): No partial dependencies on composite keys
- Third Normal Form (3NF): No transitive dependencies
- Identify intentional denormalization and validate reasoning

### 2. Schema Design
- Appropriate data types (varchar lengths, numeric precision)
- Proper use of PostgreSQL enums vs. lookup tables
- UUID vs. serial for primary keys (project uses UUIDs)
- Nullable columns that should have defaults
- Missing NOT NULL constraints
- Proper foreign key relationships

### 3. Indexing Strategy
- Missing indexes on foreign keys
- Missing indexes on frequently filtered columns
- Missing composite indexes for common query patterns
- Over-indexing (indexes that slow writes without read benefit)
- Missing partial indexes for soft-delete patterns (`WHERE deleted_at IS NULL`)

### 4. Soft Delete Consistency
- All core tables should have `deletedAt` timestamp (per CLAUDE.md)
- Queries consistently filter `WHERE deletedAt IS NULL`
- Cascade behavior on soft deletes

### 5. Relationship Patterns
- Verify relations in `lib/db/relations.ts` match schema
- Many-to-many join table design
- Proper ON DELETE/ON UPDATE behaviors
- Missing relationships that should exist

### 6. Query Patterns
- N+1 queries in `lib/queries/`
- Missing eager loading opportunities
- Inefficient joins
- Unbounded queries (missing LIMIT)

### 7. Migration Safety
- Migrations that could lock tables
- Backwards-incompatible changes
- Missing data migrations for schema changes

## Output Format

For each finding:
```
[TYPE: NORMALIZATION|INDEXING|DESIGN|QUERY|MIGRATION]
Location: table/file reference
Issue: Brief description
Current State: What exists now
Recommendation: How to improve
Migration Required: Yes/No
```

## Actions

1. Read `lib/db/schema.ts` and `lib/db/relations.ts`
2. Analyze recent migrations in `drizzle/migrations/`
3. Review query patterns in `lib/queries/`
4. Check for missing indexes using common query patterns
5. Validate soft-delete consistency

## Post-Review

Generate:
- Schema diagram recommendations
- Index creation SQL statements
- Migration plan for improvements
- Risk assessment for proposed changes
