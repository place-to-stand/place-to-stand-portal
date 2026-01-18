# Agentic CRM: Development Standards

This document establishes the code, design, and architectural standards that **must** be followed when implementing agentic CRM features. These standards ensure consistency with the existing codebase and the CTO's established patterns.

---

## Table of Contents

1. [Code Standards](#code-standards)
2. [Security Standards](#security-standards)
3. [Performance Standards](#performance-standards)
4. [Database Standards](#database-standards)
5. [Accessibility Standards](#accessibility-standards)
6. [Observability Standards](#observability-standards)
7. [Design Standards](#design-standards)
8. [Component Patterns](#component-patterns)
9. [Data Layer Patterns](#data-layer-patterns)
10. [API Patterns](#api-patterns)
11. [State Management Patterns](#state-management-patterns)
12. [File Organization](#file-organization)
13. [Testing Standards](#testing-standards)

---

## Code Standards

### TypeScript

- **Strict mode required** - No `any` types unless absolutely necessary
- **Zod schemas** for runtime validation of external data (API responses, form inputs)
- **Shared types** in `lib/types/` for domain models
- **Server-only imports** marked with `'server-only'` to prevent client-side execution

### Size Limits

- **300 lines max** per file - Split by responsibility when approaching this limit
- **50 lines max** per function - Complex functions should be decomposed
- **Extract hooks** when component logic exceeds ~100 lines
- **Extract utilities** for pure functions used in 3+ places
- **Single responsibility** - Each function/component does one thing well

### Import Organization

```typescript
// 1. React/Next.js
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// 2. External libraries
import { format } from 'date-fns'
import { z } from 'zod'

// 3. Internal UI components
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

// 4. Internal utilities/hooks
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'

// 5. Local components/types
import { LeadCard } from './lead-card'
import type { Lead } from './types'
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `LeadScoreCard` |
| Hooks | camelCase with `use` prefix | `useLeadSuggestions` |
| Utilities | camelCase | `formatLeadScore` |
| Types/Interfaces | PascalCase | `LeadSignal` |
| Constants | SCREAMING_SNAKE_CASE | `LEAD_STATUS_COLORS` |
| Files | kebab-case | `lead-score-card.tsx` |

---

## Security Standards

### OWASP Top 10 Prevention

| Vulnerability | Prevention |
|---------------|------------|
| Injection (SQL, XSS) | Parameterized queries (Drizzle), Zod validation, React's automatic escaping |
| Broken Auth | Supabase Auth, `requireUser()` guards, session validation |
| Sensitive Data Exposure | Never log secrets, use env vars, encrypt tokens at rest |
| Broken Access Control | Permission helpers on every data access |
| Security Misconfiguration | Strict CSP headers, secure cookies, HTTPS only |

### Authentication Verification

**Every protected endpoint must:**

```typescript
// API Route
const user = await getCurrentUser()
if (!user) {
  return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
}

// Server Component / Server Action
const user = await requireUser()  // Throws if not authenticated
```

### Authorization Patterns

```typescript
// Always verify access before data operations
await ensureClientAccess(user.id, clientId)
await ensureProjectAccess(user.id, projectId)
await assertAdmin(user)  // For admin-only operations

// Never trust client-provided IDs without verification
const lead = await fetchLeadById(leadId)
if (lead.ownerId !== user.id && !isAdmin(user)) {
  throw new ForbiddenError()
}
```

### Input Validation

**Validate all external input with Zod:**

```typescript
const LeadCreateSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  phone: z.string().optional(),
  // Prevent injection in structured fields
  metadata: z.record(z.string().max(1000)).optional(),
})

// In API route
const result = LeadCreateSchema.safeParse(body)
if (!result.success) {
  return NextResponse.json({ ok: false, error: 'Validation failed' }, { status: 400 })
}
```

### Secrets Management

- **Never** hardcode secrets - use environment variables
- **Never** log sensitive data (tokens, passwords, PII)
- **Never** expose secrets in client bundles - use `NEXT_PUBLIC_` only for public values
- Encrypt OAuth tokens at rest using `OAUTH_TOKEN_ENCRYPTION_KEY`

### Rate Limiting

For AI-powered features and external APIs:

```typescript
// Apply rate limiting to expensive operations
const RATE_LIMIT = {
  AI_SCORING: { requests: 10, window: '1m' },
  EMAIL_SEND: { requests: 50, window: '1h' },
  SYNC_OPERATION: { requests: 5, window: '1m' },
}
```

---

## Performance Standards

### Server vs Client Components

```
┌─────────────────────────────────────────────────────────┐
│ Default: Server Component (RSC)                          │
│   ✓ Direct database access                               │
│   ✓ Async/await at component level                      │
│   ✓ Zero client bundle impact                           │
│   ✓ Automatic code splitting                            │
├─────────────────────────────────────────────────────────┤
│ 'use client' ONLY when you need:                        │
│   • useState, useEffect, useCallback                    │
│   • Event handlers (onClick, onChange)                  │
│   • Browser APIs (localStorage, window)                 │
│   • React Query hooks                                   │
│   • Real-time subscriptions                             │
└─────────────────────────────────────────────────────────┘
```

### Data Fetching Patterns

**Parallel Loading (Preferred):**

```typescript
// Good - parallel fetching
const [lead, emails, meetings] = await Promise.all([
  fetchLeadById(id),
  fetchLeadEmails(id),
  fetchLeadMeetings(id),
])

// Bad - sequential waterfall
const lead = await fetchLeadById(id)
const emails = await fetchLeadEmails(id)
const meetings = await fetchLeadMeetings(id)
```

**N+1 Query Prevention:**

```typescript
// Bad - N+1 queries
const leads = await fetchLeads()
for (const lead of leads) {
  lead.emails = await fetchLeadEmails(lead.id)  // N queries!
}

// Good - batch fetch with relations
const leads = await db.query.leads.findMany({
  with: {
    emails: true,  // Single query with JOIN
  },
})
```

### React Performance Patterns

**Memoization (use sparingly):**

```typescript
// Only memoize expensive computations
const sortedLeads = useMemo(
  () => leads.sort((a, b) => b.score - a.score),
  [leads]
)

// Only memoize callbacks passed to optimized children
const handleClick = useCallback(
  (id: string) => setSelectedId(id),
  []
)
```

**Suspense Boundaries:**

```typescript
// Wrap async components in Suspense
<Suspense fallback={<LeadListSkeleton />}>
  <LeadList />
</Suspense>

// Multiple boundaries for independent loading
<div className='grid grid-cols-2 gap-4'>
  <Suspense fallback={<ScoreSkeleton />}>
    <LeadScore leadId={id} />
  </Suspense>
  <Suspense fallback={<TimelineSkeleton />}>
    <LeadTimeline leadId={id} />
  </Suspense>
</div>
```

**Virtualization for Long Lists:**

```typescript
import { useVirtualizer } from '@tanstack/react-virtual'

// For lists > 50 items
const virtualizer = useVirtualizer({
  count: leads.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 72,  // Estimated row height
})
```

### Bundle Size

- **Dynamic imports** for heavy components (charts, editors, etc.)
- **Tree-shakeable imports** - import specific functions, not entire libraries
- **Analyze regularly** - `npm run build` shows bundle sizes

```typescript
// Good - tree-shakeable
import { format, parseISO } from 'date-fns'

// Bad - imports entire library
import * as dateFns from 'date-fns'
```

---

## Database Standards

### ⚠️ CRITICAL: No Row Level Security (RLS)

**This project does NOT use PostgreSQL Row Level Security.**

All access control is handled in the application layer via:
- Permission helpers in `lib/auth/permissions.ts`
- Query functions in `lib/queries/` that enforce scoping
- Data layer in `lib/data/` that assembles and filters results

**NEVER:**
- Add `ENABLE ROW LEVEL SECURITY` to any table
- Create `CREATE POLICY` statements in migrations
- Use `pgPolicy()` in Drizzle schema definitions
- Import `pgPolicy` from `drizzle-orm/pg-core`
- Create helper functions like `is_admin()` for RLS

**Why:**
- Application-layer access control is easier to test and debug
- RLS policies create hidden complexity and hard-to-trace permission issues
- Supabase RLS requires `auth.uid()` which couples DB to auth provider
- All data access already flows through permission-checked functions

### Soft Delete Pattern

All core entities use soft deletes:

```typescript
// Schema definition
deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),

// Query active records
const activeLeads = await db.query.leads.findMany({
  where: isNull(leads.deletedAt),
})

// Soft delete
await db.update(leads)
  .set({ deletedAt: new Date().toISOString() })
  .where(eq(leads.id, leadId))

// Hard delete - NEVER do this on core entities
// await db.delete(leads).where(eq(leads.id, leadId))  // ❌
```

### Indexing Strategy

```typescript
// Always index foreign keys
index('idx_lead_emails_lead_id').on(table.leadId),

// Partial indexes for soft delete queries
index('idx_leads_active')
  .using('btree', table.createdAt.desc())
  .where(sql`(deleted_at IS NULL)`),

// Composite indexes for common query patterns
index('idx_leads_status_score')
  .on(table.status, table.score),
```

### Migration Workflow

```bash
# 1. Update schema in lib/db/schema.ts
# 2. Generate migration
npm run db:generate -- --name descriptive_name

# 3. Review generated SQL in drizzle/migrations/
# 4. Test locally first
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run db:migrate

# 5. Verify in Supabase Studio or psql
# 6. Apply to production
```

### Column Audit

For agentic features, track column usage:

| Column State | Action |
|--------------|--------|
| Unused (no reads/writes) | Remove after confirming |
| Write-only (written, never read) | Likely dead code - investigate |
| Read-only (read, never written) | May be populated elsewhere - verify |

---

## Accessibility Standards

### WCAG 2.1 AA Compliance

This project targets **WCAG 2.1 Level AA** compliance.

### Keyboard Navigation

**All interactive elements must be keyboard accessible:**

```tsx
// Good - native button is keyboard accessible
<Button onClick={handleAction}>Action</Button>

// Good - custom interactive element with keyboard support
<div
  role="button"
  tabIndex={0}
  onClick={handleAction}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleAction()
    }
  }}
>
  Action
</div>

// Bad - div without keyboard support
<div onClick={handleAction}>Action</div>  // ❌
```

### Focus Management

```tsx
// Trap focus in modals/sheets
<Sheet>
  <SheetContent>
    {/* Focus automatically trapped by Radix */}
  </SheetContent>
</Sheet>

// Return focus after modal closes
const triggerRef = useRef<HTMLButtonElement>(null)
const handleClose = () => {
  setOpen(false)
  triggerRef.current?.focus()
}
```

### ARIA Labels

```tsx
// Icon-only buttons MUST have labels
<Button variant='ghost' size='icon-sm' aria-label='Close panel'>
  <X className='h-4 w-4' />
</Button>

// Loading states
<Button disabled aria-busy={isLoading}>
  {isLoading ? <Spinner /> : 'Submit'}
</Button>

// Live regions for dynamic content
<div aria-live='polite' aria-atomic='true'>
  {statusMessage}
</div>
```

### Form Accessibility

```tsx
// Labels linked to inputs
<div className='space-y-2'>
  <Label htmlFor='lead-name'>Lead Name</Label>
  <Input
    id='lead-name'
    aria-describedby='lead-name-error'
    aria-invalid={!!errors.name}
  />
  {errors.name && (
    <p id='lead-name-error' className='text-destructive text-sm'>
      {errors.name.message}
    </p>
  )}
</div>

// Required field indication
<Label htmlFor='email'>
  Email <span aria-hidden='true'>*</span>
  <span className='sr-only'>(required)</span>
</Label>
```

### Color Contrast

- **Text**: Minimum 4.5:1 contrast ratio (normal text)
- **Large text**: Minimum 3:1 contrast ratio (18px+ or 14px bold)
- **UI components**: Minimum 3:1 contrast ratio
- **Never convey information by color alone** - use icons, text, patterns

---

## Observability Standards

### Structured Logging

```typescript
// Good - structured, contextual logging
console.error('Lead scoring failed', {
  leadId,
  userId: user.id,
  error: error.message,
  stack: error.stack,
})

// Bad - unstructured logging
console.log('Error: ' + error)  // ❌
```

### Activity Event Logging

**All significant actions must be logged:**

```typescript
import { logLeadScored, logEmailSent } from '@/lib/activity/events'

// After mutations
await updateLeadScore(leadId, score)
await logLeadScored(leadId, userId, { previousScore, newScore })

await sendEmail(emailData)
await logEmailSent(emailId, userId, { recipientCount, hasAttachments })
```

### PostHog Analytics

```typescript
// Client-side tracking
import { usePostHog } from 'posthog-js/react'

const posthog = usePostHog()
posthog.capture('lead_scored', {
  lead_id: leadId,
  score: newScore,
  scoring_method: 'ai_automatic',
})

// Server-side tracking
import { trackServerEvent } from '@/lib/posthog/server'

await trackServerEvent(userId, 'ai_suggestion_generated', {
  suggestion_type: 'follow_up_email',
  confidence: 0.85,
})
```

### Feature Flag Conventions

```typescript
// Feature flags in constants
export const AGENTIC_FLAGS = {
  LEAD_INTELLIGENCE: 'agentic_lead_intelligence',
  ACTION_SUGGESTIONS: 'agentic_action_suggestions',
  EMAIL_DRAFTS: 'agentic_email_drafts',
} as const

// Usage with validation
const isEnabled = posthog.isFeatureEnabled(AGENTIC_FLAGS.LEAD_INTELLIGENCE)
if (isEnabled) {
  // Feature code
}
```

### Error Tracking

```typescript
// Capture errors with context
try {
  await processLeadScoring(leadId)
} catch (error) {
  // Log locally
  console.error('Lead scoring failed', { leadId, error })

  // Track in PostHog (or Sentry if configured)
  posthog.capture('$exception', {
    $exception_message: error.message,
    $exception_type: error.name,
    lead_id: leadId,
  })

  throw error  // Re-throw for proper error handling
}
```

---

## Design Standards

### Object Identity Colors

Each object type has an assigned color for visual recognition:

| Object Type | Color | Tailwind Class |
|-------------|-------|----------------|
| Task | Violet | `violet-500` |
| Lead | Amber | `amber-500` |
| Project | Emerald | `emerald-500` |
| Client | Blue | `blue-500` |
| Contact | Cyan | `cyan-500` |
| Suggestion | Fuchsia | `fuchsia-500` |
| **Email/Thread** | Slate | `slate-500` |
| **AI Action** | Rose | `rose-500` |
| **Meeting** | Orange | `orange-500` |

### Card Styling Pattern

All entity cards follow this pattern:

```tsx
className={cn(
  'border-l-4 border-y border-r shadow-sm transition-all',
  'border-l-amber-500',                    // Identity color
  'hover:border-r-amber-500/50',           // Hover borders
  'hover:border-y-amber-500/50',
  'hover:bg-amber-500/5',                  // Subtle hover background
  'hover:shadow-md'
)}
```

### Button Variants

| Variant | Use Case | Appearance (Dark Mode) |
|---------|----------|------------------------|
| `default` (no variant) | Primary actions: Add, Create, Send, Compose | White background, dark text |
| `outline` | Secondary actions: Sync, Cancel, Close, Filter | Dark background with border |
| `ghost` | Navigation, Remove buttons, inline actions | Transparent |
| `destructive` | Delete, Remove permanently | Red background |

**Examples:**
```tsx
// Primary action - use default (no variant)
<Button onClick={handleSend}>
  <Send className='h-4 w-4' />
  Send Email
</Button>

// Secondary action - use outline
<Button variant='outline' onClick={handleCancel}>
  Cancel
</Button>

// Navigation/Remove - use ghost
<Button variant='ghost' size='icon-sm' onClick={handleRemove}>
  <X className='h-4 w-4' />
</Button>
```

### Button Sizes

| Size | Use Case |
|------|----------|
| `default` | Standard buttons |
| `sm` | Compact contexts, toolbars |
| `xs` | Toggle filters, chips, badges |
| `icon` | Icon-only buttons (standard) |
| `icon-sm` | Icon-only buttons in toolbars |

### Spacing & Layout

- **Built-in gap** - Buttons have `gap-2` built in; don't add `mr-2` to icons
- **Consistent padding** - Use `p-4` or `p-6` for card/section content
- **Section spacing** - Use `space-y-4` or `space-y-6` between sections

---

## Component Patterns

### Server vs Client Components

```
Default: Server Component (RSC)
  ↓
Add 'use client' ONLY when you need:
  - useState, useEffect, useCallback
  - Event handlers (onClick, onChange)
  - Browser APIs
  - React Query hooks
```

### Hook Extraction Pattern

When a component has complex state logic, extract to a custom hook:

```tsx
// hooks/use-lead-scoring.ts
export function useLeadScoring(leadId: string) {
  const [score, setScore] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const recalculateScore = useCallback(async () => {
    // ...
  }, [leadId])

  return { score, isLoading, recalculateScore }
}

// lead-score-panel.tsx
export function LeadScorePanel({ leadId }: { leadId: string }) {
  const { score, isLoading, recalculateScore } = useLeadScoring(leadId)
  // Render logic only
}
```

### Panel/Sheet Pattern (for entity details)

Follow the established inbox pattern for detail views:

```tsx
<Sheet open={!!selectedLead} onOpenChange={open => !open && handleClose()}>
  <SheetContent className='flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl'>
    {/* Header - fixed */}
    <div className='bg-muted/50 flex-shrink-0 border-b px-6 py-4'>
      <SheetTitle>...</SheetTitle>
    </div>

    {/* Content - scrollable */}
    <div className='flex min-h-0 flex-1'>
      {/* Main content */}
      <div className='flex-1 overflow-y-auto p-6'>...</div>

      {/* Sidebar (optional) */}
      <div className='bg-muted/20 w-80 flex-shrink-0 overflow-y-auto p-6'>...</div>
    </div>
  </SheetContent>
</Sheet>
```

### AI Suggestion Component Pattern

For AI-generated suggestions, use a consistent pattern:

```tsx
<Card className='border-l-4 border-l-fuchsia-500'>
  <CardHeader className='pb-2'>
    <div className='flex items-center gap-2'>
      <Sparkles className='h-4 w-4 text-fuchsia-500' />
      <CardTitle className='text-sm'>AI Suggestion</CardTitle>
      <Badge variant='secondary' className='ml-auto'>
        {Math.round(suggestion.confidence * 100)}% confident
      </Badge>
    </div>
  </CardHeader>
  <CardContent>
    {/* Suggestion content */}
  </CardContent>
  <CardFooter className='gap-2'>
    <Button size='sm' onClick={handleAccept}>Accept</Button>
    <Button variant='ghost' size='sm' onClick={handleDismiss}>Dismiss</Button>
  </CardFooter>
</Card>
```

---

## Data Layer Patterns

### Two-Layer Architecture

```
lib/queries/    → Low-level Drizzle queries (single-table operations)
lib/data/       → Business logic assembly (combines queries, enforces permissions)
```

### Query Function Pattern

```typescript
// lib/queries/leads.ts
export async function fetchLeadById(id: string) {
  return db.query.leads.findFirst({
    where: eq(leads.id, id),
  })
}

// lib/data/leads.ts
export async function getLeadWithRelations(id: string, userId: string) {
  const user = await requireUser()

  // Permission check
  await ensureLeadAccess(userId, id)

  // Parallel data loading
  const [lead, signals, emails, suggestions] = await Promise.all([
    fetchLeadById(id),
    fetchLeadSignals(id),
    fetchLeadEmails(id),
    fetchLeadSuggestions(id),
  ])

  return { lead, signals, emails, suggestions }
}
```

### Permission Helpers

Always use permission helpers before data access:

```typescript
import { requireUser, isAdmin, ensureClientAccess } from '@/lib/auth/permissions'

// In data layer functions
const user = await requireUser()  // Throws if not authenticated

if (!isAdmin(user)) {
  await ensureClientAccess(user.id, clientId)  // Throws ForbiddenError
}
```

---

## API Patterns

### Route Handler Structure

```typescript
// app/api/leads/[leadId]/score/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { ensureLeadAccess } from '@/lib/auth/permissions'
import { z } from 'zod'

const ScoreSchema = z.object({
  score: z.number().min(0).max(100),
  signals: z.array(z.string()),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { leadId } = await params
    await ensureLeadAccess(user.id, leadId)

    const body = await req.json()
    const validated = ScoreSchema.parse(body)

    // Business logic...

    return NextResponse.json({ ok: true, data: result })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: 'Validation failed' }, { status: 400 })
    }
    console.error('Score update failed:', error)
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 })
  }
}
```

### Response Format

Always use consistent response shapes:

```typescript
// Success
{ ok: true, data: T }

// Error
{ ok: false, error: string }
```

---

## State Management Patterns

### Server State (React Query)

Use for data that lives on the server:

```typescript
const { data: leads, isLoading, refetch } = useQuery({
  queryKey: ['leads', filter],
  queryFn: () => fetchLeads(filter),
})

const mutation = useMutation({
  mutationFn: updateLead,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['leads'] })
    toast({ title: 'Lead updated' })
  },
})
```

### Local State

Use `useState` for UI-only state:

```typescript
const [isExpanded, setIsExpanded] = useState(false)
const [searchInput, setSearchInput] = useState('')
```

### URL State

Use URL params for shareable/bookmarkable state:

```typescript
const searchParams = useSearchParams()
const router = useRouter()

const handleFilterChange = (filter: string) => {
  const params = new URLSearchParams(searchParams.toString())
  params.set('filter', filter)
  router.push(`/leads?${params.toString()}`)
}
```

---

## File Organization

### Feature Folder Structure

```
app/(dashboard)/leads/
├── page.tsx                    # Server component, data fetching
├── _components/
│   ├── leads-panel.tsx         # Main client component
│   ├── lead-card.tsx           # Individual lead card
│   ├── lead-detail-sheet.tsx   # Detail view
│   ├── lead-score-panel.tsx    # Score display
│   ├── lead-suggestions.tsx    # AI suggestions
│   └── hooks/
│       ├── use-lead-scoring.ts
│       └── use-lead-suggestions.ts
├── _actions/
│   └── lead-actions.ts         # Server actions
└── [leadId]/
    └── page.tsx                # Individual lead page
```

### Shared Code Locations

```
lib/
├── types/
│   └── leads.ts               # Lead-related types
├── queries/
│   └── leads.ts               # Low-level queries
├── data/
│   └── leads.ts               # Business logic layer
└── ai/
    └── lead-scoring.ts        # AI integration
```

---

## Testing Standards

### Component Tests

```typescript
import { render, screen } from '@testing-library/react'
import { LeadCard } from './lead-card'

describe('LeadCard', () => {
  it('displays lead name and score', () => {
    render(<LeadCard lead={mockLead} />)
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    expect(screen.getByText('85%')).toBeInTheDocument()
  })
})
```

### API Route Tests

```typescript
import { POST } from './route'
import { NextRequest } from 'next/server'

describe('POST /api/leads/[leadId]/score', () => {
  it('requires authentication', async () => {
    const req = new NextRequest('http://localhost/api/leads/123/score', {
      method: 'POST',
      body: JSON.stringify({ score: 85 }),
    })
    const res = await POST(req, { params: Promise.resolve({ leadId: '123' }) })
    expect(res.status).toBe(401)
  })
})
```

---

## Checklist Before PR

### Code Quality
- [ ] File sizes under 300 lines
- [ ] Function sizes under 50 lines
- [ ] No `any` types
- [ ] Hooks extracted for complex logic
- [ ] Zod validation on all external inputs

### Security
- [ ] Permission checks on all data access
- [ ] No hardcoded secrets
- [ ] Input validation with Zod schemas
- [ ] No sensitive data in logs

### Performance
- [ ] Parallel data fetching where possible
- [ ] No N+1 query patterns
- [ ] Suspense boundaries for async components
- [ ] Virtualization for lists > 50 items

### Design
- [ ] Button variants match patterns (default/outline/ghost)
- [ ] Object colors match identity system
- [ ] Loading and empty states implemented

### Accessibility
- [ ] All interactive elements keyboard accessible
- [ ] Icon-only buttons have aria-labels
- [ ] Form inputs linked to labels
- [ ] Error messages accessible

### Database
- [ ] NO RLS policies (application-layer access control only)
- [ ] Soft deletes, never hard deletes
- [ ] Indexes on foreign keys and filtered columns
- [ ] Migration tested locally first

### Observability
- [ ] Activity events logged for significant actions
- [ ] Errors captured with context
- [ ] Feature flags used for new features

### Build Verification
- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] `npm run type-check` passes

---

## References

- [CLAUDE.md](/CLAUDE.md) - Main codebase documentation
- [AGENTS.md](/AGENTS.md) - Technical specifications
- [Design System](/docs/design-system.md) - Object identity colors

---

*Last updated: January 2026*
