/**
 * Type treatments shared by the invoice document (paper) and the side panel
 * (dark ground). The page pins its own colours rather than reading the theme,
 * so every value is a brand (dark ground) or email (paper) colour.
 */

export const HEADLINE_FONT = 'font-display'

/** Mono field label on the white document. */
export const PAPER_LABEL =
  'text-email-muted font-mono text-[11px] tracking-[0.1em] uppercase'

/** Mono field label on the dark panel. */
export const DARK_LABEL =
  'text-brand-text-muted font-mono text-[11px] tracking-[0.1em] uppercase'

/** The marketing site's section callout: tiny accent caps with a » terminal. */
export const SECTION_LABEL =
  "text-email-accent-ink font-mono text-[10px] tracking-[0.2em] uppercase after:ml-1.5 after:text-xs after:tracking-normal after:opacity-70 after:content-['»']"

export const PANEL_TITLE =
  'font-display text-brand-text text-xl leading-tight font-bold tracking-[-0.02em]'
