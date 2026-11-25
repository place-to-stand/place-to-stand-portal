# @placetostand/ui

React components and a Tailwind CSS theme from
[Place To Stand Agency](https://placetostandagency.com): buttons, dialogs,
menus, selects, tables, a date picker, tooltips and more, built on
[Base UI](https://base-ui.com). They are the components behind our own client
portals, published so the products we build for clients can share them.

MIT licensed. Your project owns what it builds with them.

## Install

```sh
npm install @placetostand/ui
```

You need React 19 and Tailwind CSS 4.

## Set up the theme

In your global stylesheet, after Tailwind:

```css
@import 'tailwindcss';
/* Let Tailwind see the classes the components use. Adjust the path to your
   node_modules from this file. */
@source '../node_modules/@placetostand/ui';
@import '@placetostand/ui/styles/theme.css';
```

Dark mode follows a `dark` class on `<html>`.

## Use your own brand

Every component reads its colors, radius and fonts from CSS variables. Redefine
any of them after the import:

```css
:root {
  --primary: oklch(0.55 0.2 30);
  --primary-foreground: oklch(0.985 0 0);
  --radius: 0.5rem;
}

.dark {
  --primary: oklch(0.7 0.17 30);
}
```

The full list is at the top of `styles/theme.css`: `--background`,
`--foreground`, `--card`, `--popover`, `--primary`, `--secondary`, `--muted`,
`--accent`, `--destructive`, `--success`, `--warning`, `--border`, `--input`,
`--ring`, `--radius`, the `--chart-*` and `--sidebar-*` colors, and the fonts
(`--font-geist-sans`, `--font-geist-mono`, `--font-space-grotesk`, with system
fallbacks).

## Use a component

Each component has its own import path:

```tsx
import { Button } from '@placetostand/ui/button'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@placetostand/ui/dialog'

export function Example() {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant='outline'>Open</Button>} />
      <DialogContent>
        <DialogTitle>Hello</DialogTitle>
      </DialogContent>
    </Dialog>
  )
}
```

Also included: `formatCurrency`, `formatHours` and `formatPercent`
(`@placetostand/ui/numbers`), time-zone-stable date formatting
(`@placetostand/ui/dates`) and `cn` for joining class names
(`@placetostand/ui/cn`).

## Versions

We follow semantic versioning. A major version means something may break, and
its changelog entry says how to upgrade. See `CHANGELOG.md`.
