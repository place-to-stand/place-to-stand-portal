---
applyTo: "**/*.{tsx,jsx}"
---

# React Component Review Guidelines

## Server vs Client Components

- Default to Server Components unless client interactivity is required
- Only add `'use client'` when using: hooks, browser APIs, event handlers, or state
- Server Actions belong in `_actions/` directories with `'use server'` directive

## Accessibility (WCAG 2.1 AA)

- Semantic HTML: proper heading hierarchy (h1 -> h2 -> h3), semantic elements (nav, main, article)
- Buttons for actions, links for navigation - never use div/span for clickable elements
- All interactive elements must be keyboard accessible
- Visible focus indicators required (flag `outline-none` without replacement)
- Icon-only buttons need aria-label
- Form inputs need associated labels (htmlFor/id)
- Error messages linked to fields via aria-describedby

## Performance Patterns

- Flag unnecessary re-renders from missing dependency array items
- Large components should consider `next/dynamic` for code splitting
- Long lists need virtualization (TanStack Virtual)
- Images need `loading="lazy"` and proper sizing
- Check for Suspense boundaries around async components

## Common Bugs to Flag

- Missing `key` prop in lists
- Conditional hook calls (violates Rules of Hooks)
- Stale closures in useEffect/useCallback
- Memory leaks: intervals or subscriptions without cleanup in useEffect
- State updates on unmounted components
- Array mutations instead of immutable updates

## shadcn/Radix Components

- Use Radix primitives correctly - they handle accessibility
- Custom overrides should not break built-in accessibility
- Tooltips must be keyboard accessible
- Dialogs need proper focus management

## Form Patterns

- Use React Hook Form + Zod validation
- Show field-level errors, not just form-level
- Disabled buttons need tooltip explaining why
- Required fields indicated with aria-required
