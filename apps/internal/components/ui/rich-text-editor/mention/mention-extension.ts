import Mention from '@tiptap/extension-mention'
import { ReactRenderer } from '@tiptap/react'
import type { SuggestionProps } from '@tiptap/suggestion'

import type { AssigneeOption } from '@/lib/assignees/types'
import { getJson } from '@/lib/http/get-json'
import { MENTION_TYPE } from '@/lib/rich-text/allowlist'
import { filterMentionOptions } from '@/lib/tiptap/mention-utils'

import {
  MentionList,
  type MentionListHandle,
  type MentionListProps,
} from './mention-list'

type Loaded = { people: AssigneeOption[] | null; error: boolean }

/**
 * Where the list goes: inside the open sheet or dialog when there is one
 * (its outside is inert), else the page. The editor itself clips overflow.
 */
function hostFor(element: Element) {
  return element.closest<HTMLElement>('[role="dialog"]') ?? document.body
}

/** Places the list under the `@`, inside its host, flipping above near the bottom. */
function place(popup: HTMLElement, host: HTMLElement, rect: DOMRect | null) {
  if (!rect) return
  // A transformed host (a sheet) is the box `position: fixed` measures from.
  const transformed =
    host !== document.body && getComputedStyle(host).transform !== 'none'
  const origin = transformed
    ? host.getBoundingClientRect()
    : { left: 0, top: 0 }
  const height = popup.offsetHeight
  const below = rect.bottom + 4
  const top =
    below + height > window.innerHeight - 8 ? rect.top - height - 4 : below
  const left = Math.min(rect.left, window.innerWidth - popup.offsetWidth - 8)
  popup.style.left = `${Math.max(8, left) - origin.left}px`
  popup.style.top = `${Math.max(8, top) - origin.top}px`
}

/**
 * @mentions. `optionsUrl` lists who can be mentioned (the same people the
 * record's assignee picker offers, so only people who can open it). Without
 * one, mentions already in the text still show; typing @ does nothing.
 *
 * Stored as `<span data-type="mention" data-id="<user id>"
 * data-label="Name">@Name</span>`, which both cleaners keep and the save
 * reads to notify the people newly mentioned.
 */
export function buildMentionExtension(optionsUrl: string | undefined) {
  // Loaded once per editor, on the first @.
  let request: Promise<Loaded> | null = null
  const load = () => {
    request ??= getJson<AssigneeOption[]>(optionsUrl ?? '')
      .then(people => ({ people, error: false }))
      .catch(() => {
        request = null // Try again on the next @.
        return { people: null, error: true }
      })
    return request
  }

  return Mention.configure({
    deleteTriggerWithBackspace: true,
    renderText: ({ node }) => `@${node.attrs.label ?? ''}`,
    renderHTML: ({ node }) => [
      'span',
      {
        'data-type': MENTION_TYPE,
        'data-id': node.attrs.id,
        'data-label': node.attrs.label,
        class: 'mention',
      },
      `@${node.attrs.label ?? ''}`,
    ],
    suggestion: {
      char: '@',
      allowSpaces: false,
      allow: () => Boolean(optionsUrl),
      items: async ({ query }) => {
        const { people } = await load()
        return filterMentionOptions(people ?? [], query)
      },
      render: () => {
        let renderer: ReactRenderer<
          MentionListHandle,
          MentionListProps
        > | null = null
        let popup: HTMLDivElement | null = null
        let host: HTMLElement = document.body
        let loaded: Loaded = { people: null, error: false }
        // Escape hides the list; keys then go back to the editor.
        let dismissed = false

        const propsFor = (
          props: SuggestionProps<AssigneeOption>
        ): MentionListProps => ({
          items: props.items,
          loading: !loaded.people && !loaded.error,
          error: loaded.error,
          command: person =>
            props.command({ id: person.id, label: person.name }),
        })

        return {
          onStart: props => {
            dismissed = false
            host = hostFor(props.editor.view.dom)
            renderer = new ReactRenderer(MentionList, {
              props: propsFor(props),
              editor: props.editor,
            })
            popup = document.createElement('div')
            popup.style.position = 'fixed'
            popup.style.zIndex = '1000'
            popup.append(renderer.element)
            host.append(popup)
            place(popup, host, props.clientRect?.() ?? null)
            void load().then(result => {
              loaded = result
              renderer?.updateProps(propsFor(props))
            })
          },
          onUpdate: props => {
            renderer?.updateProps(propsFor(props))
            if (popup) place(popup, host, props.clientRect?.() ?? null)
          },
          onKeyDown: ({ event }) => {
            if (dismissed) return false
            if (event.key === 'Escape') {
              dismissed = true
              popup?.remove()
              popup = null
              return true
            }
            return renderer?.ref?.onKeyDown(event) ?? false
          },
          onExit: () => {
            popup?.remove()
            popup = null
            renderer?.destroy()
            renderer = null
          },
        }
      },
    },
  })
}
