import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// The theme's own type roles (theme.css: --text-overline, --text-micro) are
// font sizes; without this, tailwind-merge reads them as text colours and drops
// one of `text-micro text-muted-foreground`.
const twMerge = extendTailwindMerge({
  extend: { classGroups: { 'font-size': [{ text: ['overline', 'micro'] }] } },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
