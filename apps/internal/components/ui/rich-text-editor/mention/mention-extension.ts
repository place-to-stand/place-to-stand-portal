import type { Editor } from '@tiptap/core'
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
type MentionStorage = { optionsUrl: string | undefined }

const mentionStorage = (editor: Editor) =>
  (editor.storage as unknown as Record<string, MentionStorage>).mention

/** Points the editor's @ list at a new URL (or none), without a new editor. */
export function setMentionOptionsUrl(editor: Editor, url: string | undefined) {
  const storage = mentionStorage(editor)
  if (storage) storage.optionsUrl = url
}

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
 * @mentions. `setMentionOptionsUrl` names who can be mentioned now (the same people
 * the record's assignee picker offers, so only people who can open it); it
 * is read on each @, so moving a task to another project needs no new
 * editor. Without a URL, mentions already in the text still show and typing
 * @ does nothing.
 *
 * Stored as `<span data-type="mention" data-id="<user id>"
 * data-label="Name">@Name</span>`, which both cleaners keep and the save
 * reads to notify the people newly mentioned.
 */
export function buildMentionExtension() {
  let getOptionsUrl: () => string | undefined = () => undefined
  // Each list loads once per editor; a failed one tries again on the next @.
  const results = new Map<string, Loaded>()
  const pending = new Map<string, Promise<Loaded>>()
  const load = (url: string): Promise<Loaded> => {
    const done = results.get(url)
    if (done) return Promise.resolve(done)
    let request = pending.get(url)
    if (!request) {
      request = getJson<AssigneeOption[]>(url)
        .then(people => ({ people, error: false }))
        .catch(() => ({ people: null, error: true }))
        .then(result => {
          results.set(url, result)
          pending.delete(url)
          return result
        })
      pending.set(url, request)
    }
    return request
  }
  const loaded = (url: string | undefined): Loaded =>
    (url && results.get(url)) || { people: null, error: false }

  return Mention.extend({
    onCreate() {
      const storage = mentionStorage(this.editor)
      getOptionsUrl = () => storage.optionsUrl
    },
    addStorage() {
      return { optionsUrl: undefined } satisfies MentionStorage
    },
  }).configure({
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
      allow: () => Boolean(getOptionsUrl()),
      // Never waits: the list opens at once ("Loading people…") and fills in
      // when the people arrive.
      items: ({ query }) =>
        filterMentionOptions(loaded(getOptionsUrl()).people ?? [], query),
      render: () => {
        let renderer: ReactRenderer<
          MentionListHandle,
          MentionListProps
        > | null = null
        let popup: HTMLDivElement | null = null
        let host: HTMLElement = document.body
        let latest: SuggestionProps<AssigneeOption> | null = null
        // Escape hides the list; keys then go back to the editor.
        let dismissed = false

        const reposition = () => {
          // After React has drawn the list, so its size is the real one.
          requestAnimationFrame(() => {
            if (popup && latest) {
              place(popup, host, latest.clientRect?.() ?? null)
            }
          })
        }

        const show = (props: SuggestionProps<AssigneeOption>) => {
          latest = props
          const state = loaded(getOptionsUrl())
          renderer?.updateProps({
            items: state.people
              ? filterMentionOptions(state.people, props.query)
              : [],
            loading: !state.people && !state.error,
            error: state.error,
            command: (person: AssigneeOption) =>
              props.command({ id: person.id, label: person.name }),
          })
          reposition()
        }

        const fetchThenShow = () => {
          const url = getOptionsUrl()
          if (!url || results.has(url)) return
          void load(url).then(() => {
            if (latest) show(latest)
          })
        }

        return {
          onStart: props => {
            dismissed = false
            latest = props
            const url = getOptionsUrl()
            // A list that failed last time gets another try.
            if (url && results.get(url)?.error) results.delete(url)
            host = hostFor(props.editor.view.dom)
            renderer = new ReactRenderer(MentionList, {
              props: {
                items: [],
                loading: true,
                error: false,
                command: () => {},
              },
              editor: props.editor,
            })
            popup = document.createElement('div')
            popup.style.position = 'fixed'
            popup.style.zIndex = '1000'
            popup.append(renderer.element)
            host.append(popup)
            window.addEventListener('resize', reposition)
            window.addEventListener('scroll', reposition, true)
            show(props)
            fetchThenShow()
          },
          onUpdate: props => {
            show(props)
          },
          onKeyDown: ({ event }) => {
            if (dismissed) return false
            if (event.key === 'Escape') {
              // Only the list closes, not the sheet or form around it.
              event.stopPropagation()
              dismissed = true
              popup?.remove()
              popup = null
              return true
            }
            return renderer?.ref?.onKeyDown(event) ?? false
          },
          onExit: () => {
            window.removeEventListener('resize', reposition)
            window.removeEventListener('scroll', reposition, true)
            popup?.remove()
            popup = null
            latest = null
            renderer?.destroy()
            renderer = null
          },
        }
      },
    },
  })
}
