# Handoff: Lead Intelligence Demo

**Date:** January 18, 2025
**Goal:** Build a working demo of lead intelligence features for CTO meeting tomorrow
**Branch:** `wireframes-and-plans`

---

## Local Development Environment

### Database Status
Local Supabase is running with full schema applied.

**Connection:**
```
Host: 127.0.0.1
Port: 54322
User: postgres
Password: postgres
Database: postgres
URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

**Supabase Studio:** http://127.0.0.1:54323

### Commands

```bash
# Start local Supabase (if not running)
npx supabase start

# Stop local Supabase
npx supabase stop

# Check status
npx supabase status

# Run migrations against LOCAL database
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" npm run db:migrate

# Generate new migration from schema changes
npm run db:generate -- --name descriptive_name

# Query local database
docker exec supabase_db_place-to-stand-portal psql -U postgres -d postgres -c "YOUR SQL HERE"
```

---

## Current Schema State

### `leads` table (15 columns currently)
```
id, contact_name, status, source_type, assignee_id, contact_email,
contact_phone, notes, created_at, updated_at, deleted_at, rank,
source_detail, company_name, company_website
```

### `suggestions` table (18 columns currently)
```
id, message_id, thread_id, type, status, project_id, confidence,
reasoning, ai_model_version, prompt_tokens, completion_tokens,
suggested_content, reviewed_by, reviewed_at, created_task_id,
error_message, created_at, updated_at, deleted_at
```

### Existing Enums
```sql
-- suggestion_type
'TASK', 'PR', 'REPLY'

-- suggestion_status
'DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'MODIFIED', 'FAILED'

-- lead_status
'NEW_OPPORTUNITIES', 'ACTIVE', 'PROPOSAL_SENT', 'ON_ICE',
'CLOSED_WON', 'CLOSED_LOST', 'CLOSED_UNQUALIFIED'
```

---

## PRD: Lead Intelligence Demo (One Day Build)

### Feature Overview
Add AI-powered lead scoring and suggestions to the lead kanban board.

### User Stories
1. As a user, I see hot/warm/cold badges on lead cards so I can prioritize outreach
2. As a user, I can manually set a lead's priority tier
3. As a user, I see AI-suggested next actions when viewing a lead
4. As a user, I can approve/dismiss suggestions

---

## Implementation Steps

### Step 1: Schema Migration (~30 min)

**Add to `lib/db/schema.ts` in the `leads` table definition:**
```typescript
// AI Scoring
overallScore: numeric('overall_score', { precision: 3, scale: 2 }),
priorityTier: text('priority_tier'), // 'hot' | 'warm' | 'cold'
signals: jsonb('signals').default([]),
lastScoredAt: timestamp('last_scored_at', { withTimezone: true, mode: 'string' }),

// Activity Tracking
lastContactAt: timestamp('last_contact_at', { withTimezone: true, mode: 'string' }),
awaitingReply: boolean('awaiting_reply').default(false),
```

**Add to `lib/db/schema.ts` in the `suggestions` table definition:**
```typescript
leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
```

**Add index for suggestions.lead_id:**
```typescript
index('idx_suggestions_lead')
  .using('btree', table.leadId.asc().nullsLast())
  .where(sql`(deleted_at IS NULL AND lead_id IS NOT NULL)`),
```

**Generate and apply migration:**
```bash
npm run db:generate -- --name lead_intelligence
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" npm run db:migrate
```

---

### Step 2: Update Types (~15 min)

**Add to `lib/leads/types.ts`:**
```typescript
export type PriorityTier = 'hot' | 'warm' | 'cold'

export interface LeadRecord {
  // ... existing fields ...
  overallScore: string | null
  priorityTier: PriorityTier | null
  signals: unknown[]
  lastScoredAt: string | null
  lastContactAt: string | null
  awaitingReply: boolean
}
```

**Update lead queries in `lib/queries/leads.ts` to include new fields.**

---

### Step 3: Priority Badge Component (~30 min)

**Create `app/(dashboard)/leads/_components/priority-badge.tsx`:**
```typescript
import { Badge } from '@/components/ui/badge'
import { Flame, Thermometer, Snowflake } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PriorityTier } from '@/lib/leads/types'

const config = {
  hot: { icon: Flame, label: 'Hot', className: 'bg-red-500/10 text-red-500 border-red-500/20' },
  warm: { icon: Thermometer, label: 'Warm', className: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  cold: { icon: Snowflake, label: 'Cold', className: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
}

export function PriorityBadge({ tier }: { tier: PriorityTier }) {
  const { icon: Icon, label, className } = config[tier]
  return (
    <Badge variant="outline" className={cn('gap-1', className)}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  )
}
```

---

### Step 4: Add Badge to Lead Card (~20 min)

**Edit `app/(dashboard)/leads/_components/lead-card.tsx`:**

Add import:
```typescript
import { PriorityBadge } from './priority-badge'
```

In `LeadCardContent`, add badge after the source badge (around line 154):
```typescript
{lead.priorityTier && (
  <PriorityBadge tier={lead.priorityTier} />
)}
```

---

### Step 5: Priority Selector in Lead Sheet (~45 min)

**Edit `app/(dashboard)/leads/_components/lead-sheet.tsx`:**

Add to form schema:
```typescript
priorityTier: z.enum(['hot', 'warm', 'cold']).optional().nullable(),
```

Add form field (after status field):
```tsx
<FormField
  control={form.control}
  name="priorityTier"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Priority</FormLabel>
      <Select
        value={field.value ?? undefined}
        onValueChange={field.onChange}
      >
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder="Set priority" />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          <SelectItem value="hot">🔥 Hot</SelectItem>
          <SelectItem value="warm">🌡️ Warm</SelectItem>
          <SelectItem value="cold">❄️ Cold</SelectItem>
        </SelectContent>
      </Select>
      <FormDescription>
        AI will calculate this automatically in the future.
      </FormDescription>
    </FormItem>
  )}
/>
```

Update `saveLead` action to include `priorityTier`.

---

### Step 6: Lead Suggestions Panel (~2 hours)

**Create `app/(dashboard)/leads/_components/lead-suggestions-panel.tsx`:**

This component should:
1. Fetch suggestions where `leadId` matches the current lead
2. Display each suggestion with confidence score and reasoning
3. Show approve/dismiss buttons
4. Use the existing suggestion status workflow

Reference the inbox suggestions panel pattern:
- `app/(dashboard)/my/inbox/_components/thread-suggestions-panel.tsx`

**Create query function `lib/queries/suggestions.ts`:**
```typescript
export async function fetchSuggestionsForLead(leadId: string) {
  return db
    .select()
    .from(suggestions)
    .where(
      and(
        eq(suggestions.leadId, leadId),
        isNull(suggestions.deletedAt),
        inArray(suggestions.status, ['PENDING', 'DRAFT'])
      )
    )
    .orderBy(desc(suggestions.confidence))
}
```

---

### Step 7: Seed Demo Data (~30 min)

**Create seed script or run SQL directly:**

```sql
-- Add priority tiers to existing leads
UPDATE leads SET priority_tier = 'hot' WHERE status = 'ACTIVE' AND deleted_at IS NULL LIMIT 2;
UPDATE leads SET priority_tier = 'warm' WHERE status = 'NEW_OPPORTUNITIES' AND deleted_at IS NULL LIMIT 3;
UPDATE leads SET priority_tier = 'cold' WHERE status = 'ON_ICE' AND deleted_at IS NULL;

-- Create sample suggestions for leads
INSERT INTO suggestions (lead_id, type, status, confidence, reasoning, suggested_content)
SELECT
  id as lead_id,
  'REPLY' as type,
  'PENDING' as status,
  0.85 as confidence,
  'No response in 5 days. Recommend follow-up.' as reasoning,
  '{"action": "send_email", "subject": "Following up on our conversation"}'::jsonb as suggested_content
FROM leads
WHERE priority_tier = 'hot' AND deleted_at IS NULL
LIMIT 2;
```

---

### Step 8: Polish (~1 hour)

1. Add loading states for suggestions panel
2. Add empty state when no suggestions
3. Test drag-and-drop still works with badges
4. Verify mobile responsiveness
5. Add "Why this priority?" tooltip showing signals (future AI-generated)

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `lib/db/schema.ts` | Drizzle schema - add new columns here |
| `lib/db/relations.ts` | Drizzle relations - add leadId relation |
| `app/(dashboard)/leads/_components/lead-card.tsx` | Kanban card - add priority badge |
| `app/(dashboard)/leads/_components/lead-sheet.tsx` | Lead detail form - add priority selector |
| `app/(dashboard)/leads/actions.ts` | Server actions for saving leads |
| `lib/queries/leads.ts` | Lead database queries |
| `lib/leads/types.ts` | TypeScript types for leads |
| `docs/design-system.md` | Color and component standards |

---

## Design System Reference

| Element | Standard |
|---------|----------|
| Lead color | Amber (`amber-500`) |
| Hot priority | Red (`red-500`) |
| Warm priority | Amber (`amber-500`) |
| Cold priority | Blue (`blue-500`) |
| Badge pattern | `variant="outline"` with colored background/text |
| Card pattern | 4px left border in identity color |

---

## Testing Checklist

- [ ] Priority badges display on lead cards
- [ ] Priority selector works in lead sheet
- [ ] Saving priority persists to database
- [ ] Suggestions panel loads for leads
- [ ] Approve/dismiss suggestions works
- [ ] Drag-and-drop kanban still functions
- [ ] Mobile view looks correct
- [ ] `npm run build` passes
- [ ] `npm run type-check` passes

---

## Planning Documents

Full context available in:
- `docs/plans/agentic-crm/EXECUTIVE-SUMMARY.md` - CTO meeting overview
- `docs/plans/agentic-crm/04-schema-extensions.md` - Full schema plan
- `docs/plans/agentic-crm/05-implementation-roadmap.md` - Multi-phase roadmap
- `docs/plans/agentic-crm/06-development-standards.md` - Code standards

---

## Notes for Next Agent

1. **Local database is already running** - just verify with `npx supabase status`
2. **Production is untouched** - all work is local only
3. **Branch is `wireframes-and-plans`** - commit frequently
4. **CTO meeting is tomorrow** - focus on visual demo, not perfection
5. **Start with Step 1 (migration)** - everything else depends on schema changes

---

*Generated: January 18, 2025*
