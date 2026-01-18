# Agentic CRM: Development Standards

This document establishes the code, design, and architectural standards that **must** be followed when implementing agentic CRM features. These standards ensure consistency with the existing codebase and the CTO's established patterns.

---

## Table of Contents

1. [Code Standards](#code-standards)
2. [Design Standards](#design-standards)
3. [Component Patterns](#component-patterns)
4. [Data Layer Patterns](#data-layer-patterns)
5. [API Patterns](#api-patterns)
6. [State Management Patterns](#state-management-patterns)
7. [File Organization](#file-organization)
8. [Testing Standards](#testing-standards)

---

## Code Standards

### TypeScript

- **Strict mode required** - No `any` types unless absolutely necessary
- **Zod schemas** for runtime validation of external data (API responses, form inputs)
- **Shared types** in `lib/types/` for domain models
- **Server-only imports** marked with `'server-only'` to prevent client-side execution

### File Size Limits

- **300 lines max** per file - Split by responsibility when approaching this limit
- **Extract hooks** when component logic exceeds ~100 lines
- **Extract utilities** for pure functions used in 3+ places

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

- [ ] File sizes under 300 lines
- [ ] No `any` types
- [ ] Hooks extracted for complex logic
- [ ] Button variants match patterns (default/outline/ghost)
- [ ] Object colors match identity system
- [ ] Permission checks in place
- [ ] Error handling with proper HTTP status codes
- [ ] Loading and empty states implemented
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
