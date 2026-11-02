/**
 * Classes for rich text rendered read-only from stored HTML (task comments,
 * lead updates), so it reads like the editor it was written in.
 *
 * `min-w-0` and `wrap-anywhere` keep a long unbroken word or URL inside the
 * box instead of widening it past its parent; code blocks scroll instead.
 */
export const RICH_TEXT_HTML_CLASSES =
  'min-w-0 wrap-anywhere text-foreground [&_a]:text-primary [&_code]:bg-muted [&_pre]:bg-muted space-y-2 text-sm leading-relaxed [&_a]:underline [&_a]:underline-offset-4 [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:wrap-normal [&_pre]:rounded [&_pre]:p-3 [&_ul]:list-disc [&_ul]:pl-5'
