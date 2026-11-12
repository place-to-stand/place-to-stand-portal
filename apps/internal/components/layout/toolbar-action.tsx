/**
 * The page toolbar's action buttons on phones: one size down (Button `xs`:
 * 28px, text-xs) so tabs, count and action share one row. Put it on the
 * element that wraps the toolbar's buttons; it reaches every button inside, including ones a popover
 * trigger wraps and the project board's status menu.
 */
export const TOOLBAR_ACTIONS_CLASS =
  'max-sm:[&_button]:h-7! max-sm:[&_button]:gap-1.5! max-sm:[&_button]:px-2! max-sm:[&_button]:text-xs!'

type ToolbarActionLabelProps = {
  /** "Create company": the verb first, then what it acts on. */
  label: string
}

/**
 * A toolbar button's label that keeps only its verb on phones ("Create",
 * "Log", "Edit") and the whole label from `sm` up. Give the button
 * `aria-label={label}` so its name stays whole on phones too.
 */
export function ToolbarActionLabel({ label }: ToolbarActionLabelProps) {
  const space = label.indexOf(' ')
  if (space === -1) return label
  return (
    <span>
      {label.slice(0, space)}
      <span className='hidden sm:inline'>{label.slice(space)}</span>
    </span>
  )
}
