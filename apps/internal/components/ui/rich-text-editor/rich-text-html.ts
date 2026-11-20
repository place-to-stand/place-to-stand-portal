/**
 * Classes for rich text rendered read-only from stored HTML (task comments,
 * lead updates), so it reads like the editor it was written in.
 *
 * `min-w-0` and `wrap-anywhere` keep a long unbroken word or URL inside the
 * box instead of widening it past its parent; code blocks scroll instead.
 * Nested lists change marker by level (disc, circle, square; 1, a, i) and
 * sit tight under their parent item, and an item's text keeps no paragraph
 * margin, as in the editor (list-node.css, editor-styles.ts). Checklists
 * show their ticks as read-only boxes; highlights carry their own colour.
 * Headings and quotes use the editor's sizes and bar (heading-node.css,
 * blockquote-node.css). An @mention shows as the name, bold on a soft chip.
 */
export const RICH_TEXT_HTML_CLASSES =
  'min-w-0 wrap-anywhere text-foreground [&_a]:text-primary [&_code]:bg-muted [&_pre]:bg-muted space-y-2 text-sm leading-relaxed [&_a]:underline [&_a]:underline-offset-4 [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:wrap-normal [&_pre]:rounded [&_pre]:p-3 [&_ul]:list-disc [&_ul]:pl-5 [&_li>p]:my-0 [&_li_ol]:my-0 [&_li_ul]:my-0 [&_ol_ol]:list-[lower-alpha] [&_ol_ol_ol]:list-[lower-roman] [&_ul_ul]:list-[circle] [&_ul_ul_ul]:list-[square] [&_ul[data-type=taskList]]:list-none [&_ul[data-type=taskList]]:pl-1 [&_li[data-type=taskItem]]:flex [&_li[data-type=taskItem]]:items-start [&_li[data-type=taskItem]]:gap-2 [&_li[data-type=taskItem]>div]:min-w-0 [&_li[data-type=taskItem]>div]:flex-1 [&_li[data-type=taskItem]_input]:pointer-events-none [&_li[data-type=taskItem]_input]:accent-primary [&_li[data-type=taskItem]_input]:mt-[0.3em] [&_li[data-type=taskItem]_p]:my-0 [&_li[data-type=taskItem]>label]:shrink-0 [&_li[data-checked=true]>div>p]:line-through [&_li[data-checked=true]>div>p]:opacity-50 [&_mark]:rounded-sm [&_mark]:px-0.5 [&_:is(h1,h2,h3,h4)]:mt-3 [&_:is(h1,h2,h3,h4)]:mb-1 [&_:is(h1,h2,h3,h4)]:leading-tight [&_:is(h1,h2,h3,h4):first-child]:mt-0 [&_h1]:text-[1.5em] [&_h1]:font-bold [&_h2]:text-[1.25em] [&_h2]:font-bold [&_h3]:text-[1.125em] [&_h3]:font-semibold [&_h4]:font-semibold [&_blockquote]:border-foreground [&_blockquote]:border-l-4 [&_blockquote]:py-1.5 [&_blockquote]:pl-4 [&_blockquote_p]:my-0 [&_hr]:border-border [&_hr]:my-3 [&_span[data-type=mention]]:bg-muted [&_span[data-type=mention]]:rounded [&_span[data-type=mention]]:px-0.5 [&_span[data-type=mention]]:font-semibold [&_span[data-type=mention]]:whitespace-nowrap'
