/**
 * The page toolbar's tab strip. 32px, the height of the page's buttons, so
 * the toolbar is no taller than its tallest control, with a 4px inset that
 * PageShell matches after the action button. Tabs hug the left edge at every
 * width and scroll sideways once they outgrow the screen, instead of
 * stretching or clipping. Shared with the project board's own tab strip and
 * the phone tab menu (`ToolbarTabsMenu`).
 */
export const TOOLBAR_TABS_LIST_CLASS =
  'bg-muted/40 h-8 w-fit max-w-full [scrollbar-width:none] justify-start gap-2 overflow-x-auto rounded-lg px-1 py-0.5'
export const TOOLBAR_TAB_CLASS = 'h-full flex-none px-3 py-0 text-sm'
