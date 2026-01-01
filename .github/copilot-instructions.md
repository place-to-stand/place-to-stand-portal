# Copilot Code Review Instructions

## Project Overview

Next.js 16 (App Router) application with Supabase (PostgreSQL + Auth + Storage), Drizzle ORM, and shadcn/ui components. TypeScript strict mode enforced.

## Critical Security Requirements

### Authentication & Authorization

- All protected routes MUST use `requireUser()` or `requireRole()` guards
- Data queries MUST call `ensureClientAccess()` before fetching client-scoped data
- RLS is DISABLED - all access control must be enforced in application code
- Never expose sensitive data (passwords, tokens, PII) in API responses

### OWASP Top 10 Checks

- Flag SQL injection risks in query construction
- Flag XSS risks from unsanitized user input or raw HTML rendering
- Flag IDOR vulnerabilities (missing ownership checks before data access)
- Flag hardcoded secrets or credentials
- Flag missing input validation on API endpoints

## Code Quality Standards

### TypeScript

- Avoid `any` type - use proper typing or `unknown` with type guards
- Use Zod schemas for runtime validation at system boundaries
- Prefer `const` over `let`; avoid `var`
- Use strict equality (`===`) not loose equality (`==`)

### React/Next.js Patterns

- Prefer Server Components; use `'use client'` only when necessary
- Server Actions must be in files marked with `'use server'`
- Missing `key` props in lists is an error
- Hooks must not be called conditionally (Rules of Hooks)
- Check for stale closures in `useEffect`/`useCallback` dependency arrays
- Flag potential memory leaks (uncleared intervals, subscriptions without cleanup)

### Error Handling

- API routes must return `{ ok: boolean, data?: T, error?: string }` format
- Async operations need try/catch with proper error handling
- Missing error states for data fetching is a bug
- Use project error classes: `UnauthorizedError`, `ForbiddenError`, `NotFoundError`

### Data Fetching

- Flag N+1 query patterns in Drizzle queries
- Sequential fetches that could be parallel should use `Promise.all()`
- Use React `cache()` for request deduplication in Server Components
- Large result sets need pagination (missing LIMIT is a concern)

## Architecture Conventions

### File Organization

- Features grouped by domain in `/app` and `/components`
- Shared utilities in `/lib`
- Queries in `lib/queries/`, data assembly in `lib/data/`
- Server Actions in `_actions/` directories

### Database

- All core entities use soft deletes via `deletedAt` timestamp
- Active record queries must filter `WHERE deletedAt IS NULL`
- UUIDs for primary keys
- Foreign keys should have indexes

### Forms

- Use React Hook Form + Zod for form handling
- Surface field-level errors, not just form-level
- Disabled buttons need tooltip explanations

## Review Priorities

1. **CRITICAL**: Security vulnerabilities, auth bypasses, data exposure
2. **HIGH**: Logic errors, missing error handling, type safety violations
3. **MEDIUM**: Performance issues, accessibility gaps, code style
4. **LOW**: Minor improvements, documentation suggestions
