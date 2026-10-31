/**
 * The style guide's table of contents: one entry per section, in page order.
 * The left index and the scroll-spy both read it, and every DesignSection
 * takes its `id` from here, so the index can't point at a missing anchor.
 */
export const DESIGN_SECTION_GROUPS = [
  {
    title: 'Foundations',
    sections: [
      { id: 'colour', label: 'Colour tokens' },
      { id: 'entities', label: 'Entities' },
      { id: 'type', label: 'Type' },
      { id: 'space', label: 'Spacing and size' },
      { id: 'radius', label: 'Radius and shadow' },
      { id: 'icons', label: 'Icons' },
    ],
  },
  {
    title: 'Components',
    sections: [
      { id: 'buttons', label: 'Buttons' },
      { id: 'badges', label: 'Badges' },
      { id: 'inputs', label: 'Inputs' },
      { id: 'pickers', label: 'Select and pickers' },
      { id: 'toggles', label: 'Switch, checkbox, segmented' },
      { id: 'dates', label: 'Dates and numbers' },
      { id: 'rich-text', label: 'Rich text' },
      { id: 'avatars', label: 'Avatars' },
      { id: 'record-rows', label: 'Record rows' },
      { id: 'access', label: 'Person access' },
      { id: 'tables', label: 'Tables and toolbar' },
      { id: 'empty-loading', label: 'Empty and loading' },
      { id: 'feedback', label: 'Alerts, toasts and errors' },
      { id: 'overlays', label: 'Tooltips and menus' },
      { id: 'dialogs', label: 'Dialogs' },
      { id: 'sheets', label: 'Sheets' },
      { id: 'tabs', label: 'Tabs' },
      { id: 'page-shell', label: 'Page shell' },
    ],
  },
  {
    title: 'Patterns',
    sections: [
      { id: 'house-rules', label: 'House rules' },
      { id: 'copy', label: 'Copy' },
    ],
  },
] as const

export type DesignSectionId =
  (typeof DESIGN_SECTION_GROUPS)[number]['sections'][number]['id']
