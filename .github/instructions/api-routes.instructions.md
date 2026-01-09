---
applyTo: "app/api/**/*"
---

# API Route Review Guidelines

## Authentication & Authorization

- All protected endpoints MUST call `getCurrentUser()` or `requireUser()`
- Admin-only endpoints MUST use `assertAdmin()` or `requireRole('ADMIN')`
- Client-scoped data MUST verify access via `ensureClientAccess()`
- RLS is DISABLED - never assume database-level protection

## Request Handling

- Validate all input using Zod schemas
- Sanitize user input before database operations
- Check for SQL injection in dynamic query construction
- Verify HTTP method matches intended operation

## Response Format

- Return standardized format: `{ ok: boolean, data?: T, error?: string }`
- Never expose sensitive data (passwords, tokens, internal IDs when unnecessary)
- Use appropriate HTTP status codes
- Error messages should not leak implementation details

## Security Checks

- Flag missing rate limiting on sensitive endpoints (login, password reset)
- Flag missing CORS configuration where needed
- Verify file upload restrictions (type, size)
- Check for command injection in any shell operations

## Error Handling

- Wrap external calls in try/catch
- Use project error classes: `UnauthorizedError` (401), `ForbiddenError` (403), `NotFoundError` (404)
- Log errors with context but redact sensitive data
- Return user-friendly error messages

## Performance

- Flag N+1 patterns in data fetching
- Large responses should be paginated
- Consider caching headers for read-heavy endpoints
- Avoid blocking operations without timeouts
