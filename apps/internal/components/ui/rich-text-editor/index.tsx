'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { EditorContent, EditorContext } from '@tiptap/react'

import { cn } from '@/lib/utils'

// --- UI Primitives ---
import { Spacer } from '@/components/tiptap-ui-primitive/spacer'
import {
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator,
} from '@/components/tiptap-ui-primitive/toolbar'

// --- Tiptap UI ---
import { HeadingDropdownMenu } from '@/components/tiptap-ui/heading-dropdown-menu'
import { ListDropdownMenu } from '@/components/tiptap-ui/list-dropdown-menu'
import { BlockquoteButton } from '@/components/tiptap-ui/blockquote-button'
import { CodeBlockButton } from '@/components/tiptap-ui/code-block-button'
import {
  ColorHighlightPopover,
  ColorHighlightPopoverContent,
  ColorHighlightPopoverButton,
} from '@/components/tiptap-ui/color-highlight-popover'
import {
  LinkPopover,
  LinkContent,
  LinkButton,
} from '@/components/tiptap-ui/link-popover'
import { LinkFloatingMenu } from '@/components/tiptap-ui/link-floating-menu'
import { MarkButton } from '@/components/tiptap-ui/mark-button'
import { TextAlignButton } from '@/components/tiptap-ui/text-align-button'

// --- Icons ---
import { ArrowLeftIcon } from '@/components/tiptap-icons/arrow-left-icon'
import { BanIcon } from '@/components/tiptap-icons/ban-icon'
import { HighlighterIcon } from '@/components/tiptap-icons/highlighter-icon'
import { LinkIcon } from '@/components/tiptap-icons/link-icon'

// --- Hooks ---
import { useIsMobile } from '@pts/ui/hooks/use-mobile'
import { useTiptapEditor } from '@/hooks/use-tiptap-editor'

// --- UI Primitives ---
import { Button } from '@/components/tiptap-ui-primitive/button'

import { ensureEditorStyles } from './editor-styles'
import { useRichTextEditor } from './use-rich-text-editor'

export type RichTextEditorProps = {
  id?: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  disabled?: boolean
  className?: string
  contentMinHeightClassName?: string
  /**
   * Static chrome rendered on the page around the editable area — under the
   * toolbar, so it reads as part of the document rather than the controls.
   * Used by the update composer to show the email's wordmark and footer.
   */
  contentHeader?: ReactNode
  contentFooter?: ReactNode
  /** Pass false inside a sheet whose form history owns Cmd+Z. */
  undoRedo?: boolean
}

const ClearFormattingButton = () => {
  const { editor } = useTiptapEditor()

  const handleClearFormatting = () => {
    if (!editor || !editor.isEditable) return

    editor.chain().focus().clearNodes().unsetAllMarks().run()
  }

  const canClear = editor?.isEditable && editor.can().clearNodes()

  return (
    <Button
      type='button'
      data-style='ghost'
      disabled={!canClear}
      data-disabled={!canClear}
      role='button'
      tabIndex={-1}
      aria-label='Clear formatting'
      tooltip='Clear formatting'
      onClick={handleClearFormatting}
    >
      <BanIcon className='tiptap-button-icon' />
    </Button>
  )
}

const MainToolbarContent = ({
  onHighlighterClick,
  onLinkClick,
  isMobile,
}: {
  onHighlighterClick: () => void
  onLinkClick: () => void
  isMobile: boolean
}) => {
  return (
    <>
      {/* No leading spacer: the row overflows the sheet's width as it is, and
          the toolbar's own padding already sets the left inset. */}
      <ToolbarGroup>
        <HeadingDropdownMenu levels={[1, 2, 3, 4]} />
        <ListDropdownMenu types={['bulletList', 'orderedList', 'taskList']} />
        <BlockquoteButton />
        <CodeBlockButton />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <MarkButton type='bold' />
        <MarkButton type='italic' />
        <MarkButton type='strike' />
        <MarkButton type='code' />
        <MarkButton type='underline' />
        {!isMobile ? (
          <ColorHighlightPopover />
        ) : (
          <ColorHighlightPopoverButton onClick={onHighlighterClick} />
        )}
        {!isMobile ? (
          <LinkPopover autoOpenOnLinkActive={false} />
        ) : (
          <LinkButton onClick={onLinkClick} />
        )}
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <MarkButton type='superscript' />
        <MarkButton type='subscript' />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <TextAlignButton align='left' />
        <TextAlignButton align='center' />
        <TextAlignButton align='right' />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <ClearFormattingButton />
      </ToolbarGroup>

      <Spacer />
    </>
  )
}

const MobileToolbarContent = ({
  type,
  onBack,
}: {
  type: 'highlighter' | 'link'
  onBack: () => void
}) => (
  <>
    <ToolbarGroup>
      <Button data-style='ghost' onClick={onBack}>
        <ArrowLeftIcon className='tiptap-button-icon' />
        {type === 'highlighter' ? (
          <HighlighterIcon className='tiptap-button-icon' />
        ) : (
          <LinkIcon className='tiptap-button-icon' />
        )}
      </Button>
    </ToolbarGroup>

    <ToolbarSeparator />

    {type === 'highlighter' ? (
      <ColorHighlightPopoverContent />
    ) : (
      <LinkContent />
    )}
  </>
)

export function RichTextEditor({
  id,
  value,
  onChange,
  onBlur,
  placeholder,
  disabled = false,
  className,
  contentMinHeightClassName = '[&_.ProseMirror]:min-h-[160px]',
  contentHeader,
  contentFooter,
  undoRedo,
}: RichTextEditorProps) {
  useEffect(() => {
    ensureEditorStyles()
  }, [])

  const isMobile = useIsMobile()
  const [mobileView, setMobileView] = useState<'main' | 'highlighter' | 'link'>(
    'main'
  )

  const { editor } = useRichTextEditor({
    value,
    onChange,
    onBlur,
    placeholder,
    disabled,
    undoRedo,
  })

  // Reset mobile view when switching to desktop, using the
  // adjust-state-during-render pattern instead of a resync effect.
  const [prevIsMobile, setPrevIsMobile] = useState(isMobile)
  if (prevIsMobile !== isMobile) {
    setPrevIsMobile(isMobile)
    if (!isMobile && mobileView !== 'main') {
      setMobileView('main')
    }
  }

  // `contain-inline-size` keeps the editor's width from depending on its
  // content. Without it, a parent that sizes to min-content (a grid row such
  // as FormItem, once DisabledFieldTooltip wraps the editor while a form
  // saves) widens to the longest unbroken word or URL and the text runs past
  // the field's right edge. `min-w-0` does the same for flex parents.
  const wrapperClasses = useMemo(
    () =>
      cn(
        'rich-text-editor group flex w-full min-w-0 flex-shrink-0 flex-col overflow-hidden contain-inline-size rounded-md border bg-background shadow-xs transition select-text',
        !disabled &&
          'focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50',
        disabled && 'opacity-60',
        className
      ),
    [className, disabled]
  )

  const contentClasses = useMemo(
    () =>
      cn(
        'w-full flex-1 text-sm',
        contentMinHeightClassName,
        '[&_.ProseMirror]:px-3 [&_.ProseMirror]:py-2',
        '[&_.ProseMirror]:leading-relaxed [&_.ProseMirror]:text-foreground [&_.ProseMirror]:bg-transparent',
        '[&_.ProseMirror]:outline-none [&_.ProseMirror]:focus:outline-none',
        '[&_.ProseMirror]:select-text',
        '[&_.ProseMirror_p]:my-2',
        '[&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-4',
        '[&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-4',
        '[&_.ProseMirror li]:my-1',
        disabled && '[&_.ProseMirror]:cursor-not-allowed'
      ),
    [contentMinHeightClassName, disabled]
  )

  if (!editor) {
    return null
  }

  return (
    <div
      id={id}
      data-disabled={disabled}
      data-rich-text-editor
      className={wrapperClasses}
      style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
    >
      <EditorContext.Provider value={{ editor }}>
        {/* The toolbar stays at the top of its editor on every width. The
            TipTap template pins it to the screen bottom on phones, which
            suits a full-page editor but detached it from these embedded
            ones (sheet fields, the notes card) and left it over the page. */}
        <Toolbar>
          {mobileView === 'main' ? (
            <MainToolbarContent
              onHighlighterClick={() => setMobileView('highlighter')}
              onLinkClick={() => setMobileView('link')}
              isMobile={isMobile}
            />
          ) : (
            <MobileToolbarContent
              type={mobileView === 'highlighter' ? 'highlighter' : 'link'}
              onBack={() => setMobileView('main')}
            />
          )}
        </Toolbar>

        {contentHeader}
        <EditorContent editor={editor} className={contentClasses} />
        {contentFooter}

        {/* Link floating menu - appears on hover or when cursor is in a link */}
        <LinkFloatingMenu editor={editor} />
      </EditorContext.Provider>
    </div>
  )
}
