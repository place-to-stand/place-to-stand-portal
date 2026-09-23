import type { ChatCardPayload } from '@/lib/notifications/catalog'

/**
 * The subset of Google Chat's `cardsV2` schema our builders emit. Read
 * defensively: the builders return plain objects, and a widget this preview
 * does not know is skipped rather than guessed at.
 */
type ChatButton = { text?: string }
type ChatWidget = {
  decoratedText?: { topLabel?: string; text?: string; button?: ChatButton }
  buttonList?: { buttons?: ChatButton[] }
}
type ChatCard = {
  header?: { title?: string; subtitle?: string }
  sections?: { widgets?: ChatWidget[] }[]
}

function readCard(payload: ChatCardPayload): ChatCard | null {
  const cards = (payload as { cardsV2?: { card?: ChatCard }[] }).cardsV2
  return cards?.[0]?.card ?? null
}

/**
 * A Google Chat card drawn from the exact payload the notifier posts, in
 * Chat's light theme in either app theme (like the email paper). Buttons are
 * shown but inert: the sample links are placeholders.
 */
export function ChatCardPreview({ payload }: { payload: ChatCardPayload }) {
  const card = readCard(payload)
  if (!card) return null

  return (
    <div className='rounded-xl border border-[#dadce0] bg-white font-sans text-[#1f1f1f] shadow-[0_1px_2px_rgba(60,64,67,0.3)]'>
      {card.header ? (
        <div className='flex flex-col gap-0.5 px-4 pt-4 pb-3'>
          <span className='text-base font-medium'>{card.header.title}</span>
          {card.header.subtitle ? (
            <span className='text-[13px] leading-snug text-[#5f6368]'>
              {card.header.subtitle}
            </span>
          ) : null}
        </div>
      ) : null}
      {card.sections?.map((section, sectionIndex) => (
        <div
          key={sectionIndex}
          className='flex flex-col gap-3 border-t border-[#dadce0] px-4 py-3'
        >
          {section.widgets?.map((widget, widgetIndex) => (
            <ChatWidgetView key={widgetIndex} widget={widget} />
          ))}
        </div>
      ))}
    </div>
  )
}

function ChatWidgetView({ widget }: { widget: ChatWidget }) {
  if (widget.decoratedText) {
    const { topLabel, text, button } = widget.decoratedText
    return (
      <div className='flex items-center justify-between gap-3'>
        <div className='flex min-w-0 flex-col'>
          {topLabel ? (
            <span className='text-xs text-[#5f6368]'>{topLabel}</span>
          ) : null}
          <span className='text-sm break-words'>{text}</span>
        </div>
        {button?.text ? <ChatButtonView label={button.text} /> : null}
      </div>
    )
  }
  if (widget.buttonList?.buttons?.length) {
    return (
      <div className='flex flex-wrap gap-2'>
        {widget.buttonList.buttons.map((button, index) =>
          button.text ? (
            <ChatButtonView key={index} label={button.text} />
          ) : null
        )}
      </div>
    )
  }
  return null
}

function ChatButtonView({ label }: { label: string }) {
  return (
    <span className='shrink-0 rounded-full bg-[#0b57d0] px-4 py-2 text-sm font-medium text-white'>
      {label}
    </span>
  )
}
