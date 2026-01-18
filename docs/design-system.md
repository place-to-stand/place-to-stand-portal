# Design System: Object Identity

This document outlines the color system used to distinguish different object types within the Place to Stand Portal and provides guidelines for extending this system.

## Color Coding

Each primary object type is assigned a distinct color from the Tailwind CSS palette. This color is used to provide immediate visual recognition across the application, particularly in card views and lists.

| Object Type | Color Name | Tailwind Class Prefix | Hex (500) |
| :--- | :--- | :--- | :--- |
| **Task** | Violet | `violet` | `#8b5cf6` |
| **Lead** | Amber | `amber` | `#f59e0b` |
| **Project** | Emerald | `emerald` | `#10b981` |
| **Client** | Blue | `blue` | `#3b82f6` |
| **Contact** | Cyan | `cyan` | `#06b6d4` |
| **Suggestion** | Fuchsia | `fuchsia` | `#d946ef` |

## Visual Application

The color identity is primarily applied to **Cards** using the following pattern:

1.  **Left Border:** A thick (4px) left border in the object's primary color (`-500` shade).
2.  **Hover State:**
    *   **Right/Top/Bottom Borders:** A semi-transparent version of the color (`/50`) appears on hover.
    *   **Background:** A very subtle tint (`/5`) of the color appears on hover.
3.  **Icons:** In some contexts (like headers or lists), the object's icon may be colored with the `-500` shade.

### Standard Class Pattern

Apply these utility classes to the main container (e.g., `Card` or `div`):

```tsx
className={cn(
  // Base layout and border
  'border-l-4 border-y border-r shadow-sm transition-all',

  // 1. Identity Color (Left Border)
  'border-l-[COLOR]-500',

  // 2. Hover States
  'hover:border-r-[COLOR]-500/50',
  'hover:border-y-[COLOR]-500/50',
  'hover:bg-[COLOR]-500/5',
  'hover:shadow-md'
)}
```

## Extension Guide

When adding a new object type (e.g., "Invoice", "Ticket", "Note"), follow these steps to maintain consistency:

### 1. Choose a Distinct Color
Select a color from the Tailwind palette that is visually distinct from the existing set.
*   *Avoid:* Violet, Amber, Emerald, Blue, Cyan, Fuchsia.
*   *Suggested:*
    *   **Rose** (`rose-500`) for urgent items like Tickets or Alerts.
    *   **Orange** (`orange-500`) for financial items like Invoices (distinct enough from Amber).
    *   **Slate** (`slate-500`) for neutral or archived items.
    *   **Pink** (`pink-500`) for social or communication items.

### 2. Apply the Pattern
Use the standard class pattern with your chosen color.

**Example: Creating an `InvoiceCard` (using Orange)**

```tsx
import { cn } from '@/lib/utils'

export function InvoiceCard({ invoice }) {
  return (
    <div
      className={cn(
        'group bg-card rounded-lg p-4 text-left shadow-sm transition',
        // Base borders
        'border-y border-r border-l-4',

        // Identity: Orange
        'border-l-orange-500',

        // Hover States
        'hover:border-r-orange-500/50',
        'hover:border-y-orange-500/50',
        'hover:bg-orange-500/5',
        'hover:shadow-md'
      )}
    >
      <h3 className="font-semibold">Invoice #{invoice.id}</h3>
      {/* ... content ... */}
    </div>
  )
}
```

### 3. Consistent Link Hover
Ensure any links inside the card match the standard interaction style:
```tsx
<Link
  href={...}
  className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition"
>
  View Details
</Link>
```

---

## Button Standards

### Variant Usage

Buttons follow a consistent variant pattern throughout the application:

| Variant | Use Case | Dark Mode Appearance |
|---------|----------|----------------------|
| `default` (no variant) | Primary actions: Add, Create, Send, Compose, Download | White background, dark text |
| `outline` | Secondary actions: Sync, Cancel, Close, Attach, Filter | Dark background with border |
| `ghost` | Navigation, Remove/X buttons, inline toolbar actions | Transparent |
| `destructive` | Delete, Remove permanently, dangerous actions | Red background |

### Examples

```tsx
// Primary action - use default (omit variant prop)
<Button onClick={handleCreate}>
  <Plus className='h-4 w-4' />
  Add project
</Button>

// Secondary action - use outline
<Button variant='outline' onClick={handleSync}>
  <RefreshCw className='h-4 w-4' />
  Sync
</Button>

// Navigation/Remove - use ghost
<Button variant='ghost' size='icon-sm' onClick={handleClose}>
  <X className='h-4 w-4' />
</Button>

// Destructive - use destructive
<Button variant='destructive' onClick={handleDelete}>
  <Trash2 className='h-4 w-4' />
  Delete
</Button>
```

### Size Usage

| Size | Use Case |
|------|----------|
| `default` | Standard buttons in forms and dialogs |
| `sm` | Compact contexts, toolbar buttons |
| `xs` | Toggle filters, chips, inline badges |
| `icon` | Icon-only buttons (9x9 = 36px) |
| `icon-sm` | Icon-only toolbar buttons (8x8 = 32px) |
| `icon-lg` | Large icon buttons (10x10 = 40px) |

### Icon Spacing

The Button component has built-in `gap-2` for icon spacing. **Do not add `mr-2` or `ml-2` to icons inside buttons.**

```tsx
// Correct - gap-2 handles spacing
<Button>
  <Plus className='h-4 w-4' />
  Add task
</Button>

// Incorrect - don't add margins
<Button>
  <Plus className='mr-2 h-4 w-4' />  {/* Don't do this */}
  Add task
</Button>
```
