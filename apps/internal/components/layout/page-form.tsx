'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react'
import type { FieldValues, UseFormReturn } from 'react-hook-form'
import { Check } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@pts/ui/tooltip'

import { ShortcutKeys } from '@/components/keyboard/shortcut-keys'
import { FormFooterBar } from '@/components/sheets/sheet-form-footer'
import { Form } from '@/components/ui/form'
import { useToast } from '@/components/ui/use-toast'
import { useConfirmLeavingPage } from '@/lib/hooks/use-confirm-leaving-page'
import { useSheetFormControls } from '@/lib/hooks/use-sheet-form-controls'
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'
import { ariaKeyShortcuts } from '@/lib/keyboard/format'
import { SHORTCUTS } from '@/lib/keyboard/shortcuts'
import { cn } from '@/lib/utils'

/** How long Save reads "Saved" after a save, as in a kept-open sheet. */
const SAVED_FOR_MS = 2000

type PageFormProps<TIn extends FieldValues, TOut> = {
  form: UseFormReturn<TIn, unknown, TOut>
  /**
   * Saves the values. Resolve true once saved (the caller resets the form to
   * them; no success toast, Save reads "Saved"); on failure show the "Unable to save …" toast, set field errors,
   * and resolve false.
   */
  onSave: (values: TOut) => Promise<boolean>
  /** Names the undo history ("business"), so two forms never share one. */
  historyKey: string
  /** Changes held outside react-hook-form (an image picked but not saved). */
  externalDirty?: boolean
  /** That outside state, so undo, redo and Discard step through it too. */
  getExternalState?: () => unknown
  applyExternalState?: (state: unknown) => void
  /** Discard: put the outside state back to what was saved. */
  onDiscard?: () => void
  className?: string
  children: ReactNode
}

/**
 * A form that is part of a page (Settings → Business, Billing's profit
 * share): it owns the unsaved-changes warning (reload, tab close, in-app
 * links, Back and Forward, the Ctrl K palette), ⌘S, undo and redo (the
 * sheets' history), and the sheet footer (`FormFooterBar`) as a save bar,
 * fixed across the page column, that slides up on the first edit. Sheets and
 * dialogs keep their own footers.
 */
export function PageForm<TIn extends FieldValues, TOut>({
  form,
  onSave,
  historyKey,
  externalDirty = false,
  getExternalState,
  applyExternalState,
  onDiscard,
  className,
  children,
}: PageFormProps<TIn, TOut>) {
  // Awaited inside handleSubmit, so react-hook-form's isSubmitting is the
  // one pending flag: fields read it too (form.formState.isSubmitting).
  const { toast } = useToast()
  const isPending = form.formState.isSubmitting
  const [savedCount, setSavedCount] = useState(0)
  const [justSaved, setJustSaved] = useState(false)
  const isDirty = form.formState.isDirty || externalDirty

  // The history hook is typed for a form whose output is its input; it only
  // reads and writes the field values, which are TIn here too.
  const historyForm = form as unknown as UseFormReturn<TIn>

  const submit = useCallback(() => {
    // ⌘S with a dialog open over the page (a product's) belongs to that
    // dialog, not to the page behind it.
    const active = document.activeElement
    if (
      active?.closest('[role="dialog"], [role="alertdialog"]') &&
      !active.closest('[data-slot="sheet-content"]')
    ) {
      return
    }
    void form.handleSubmit(
      async values => {
        if (await onSave(values)) {
          setJustSaved(true)
          setSavedCount(count => count + 1)
        }
      },
      // A value no field shows (a table row) must not fail silently.
      () =>
        toast({
          variant: 'destructive',
          title: 'Unable to save changes',
          description: 'Check the highlighted fields.',
        })
    )()
  }, [form, onSave, toast])

  const controls = useSheetFormControls<TIn>({
    form: historyForm,
    isActive: true,
    canSave: !isPending,
    onSave: submit,
    historyKey,
    getExternalState,
    applyExternalState,
  })
  const { rebaseline } = controls

  // A save starts the undo history again from what was saved.
  useEffect(() => {
    if (savedCount > 0) rebaseline()
  }, [rebaseline, savedCount])

  useEffect(() => {
    if (!justSaved) return
    const timer = setTimeout(() => setJustSaved(false), SAVED_FOR_MS)
    return () => clearTimeout(timer)
  }, [justSaved, savedCount])

  // Slides up on the first edit; stays while dirty, saving, showing "Saved",
  // or while there is something to redo (undoing back to the saved values
  // keeps it up), then slides away.
  const showBar = isDirty || isPending || justSaved || controls.canRedo
  const barRef = useRef<HTMLDivElement>(null)
  const columnStyle = usePageColumn(barRef)
  useReserveBelowPage(barRef, showBar)

  const { dialog, requestConfirmation } = useUnsavedChangesWarning({ isDirty })
  useConfirmLeavingPage(isDirty, requestConfirmation)

  const discard = () => {
    form.reset()
    onDiscard?.()
    rebaseline()
  }

  const saveLabel = isPending ? (
    'Saving...'
  ) : justSaved && !isDirty ? (
    <>
      <Check aria-hidden />
      Saved
    </>
  ) : (
    'Save'
  )

  return (
    <Form {...form}>
      <form
        onSubmit={event => {
          event.preventDefault()
          submit()
        }}
        className={cn('flex flex-col', className)}
      >
        {children}
        <div
          ref={barRef}
          style={columnStyle}
          // inert while hidden: off-screen buttons stay out of the tab order.
          inert={!showBar}
          className={cn(
            'fixed bottom-0 z-30 pb-[env(safe-area-inset-bottom)] transition-[translate,opacity] duration-200 ease-out motion-reduce:transition-none',
            showBar
              ? 'translate-y-0 opacity-100'
              : 'pointer-events-none translate-y-full opacity-0'
          )}
        >
          <FormFooterBar
            undo={controls.undo}
            redo={controls.redo}
            canUndo={controls.canUndo}
            canRedo={controls.canRedo}
            // Lines up with the page column: Undo under the panel's left
            // edge, Save under its right.
            innerClassName='px-3 sm:px-4'
          >
            <span className='sr-only' aria-live='polite'>
              {justSaved ? 'Saved' : ''}
            </span>
            {/* Only with something to discard: undone back to the saved
                values (the bar kept up for Redo) or just saved, it goes. */}
            {isDirty ? (
              <Button
                type='button'
                variant='secondary'
                size='xs'
                disabled={isPending}
                onClick={discard}
              >
                Discard
              </Button>
            ) : null}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type='submit'
                  size='xs'
                  disabled={isPending}
                  aria-keyshortcuts={ariaKeyShortcuts(SHORTCUTS.save)}
                >
                  {saveLabel}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Save
                <span className='ml-2'>
                  <ShortcutKeys shortcut={SHORTCUTS.save} />
                </span>
              </TooltipContent>
            </Tooltip>
          </FormFooterBar>
        </div>
      </form>
      {dialog}
    </Form>
  )
}

/**
 * Where the page column is: the bar spans `<main>` (the sidebar's right edge
 * to the window's), following it as the sidebar collapses or the window
 * resizes.
 */
function usePageColumn(ref: RefObject<HTMLElement | null>): CSSProperties {
  const [box, setBox] = useState<{ left: number; width: number } | null>(null)
  useLayoutEffect(() => {
    const main = ref.current?.closest('main')
    if (!main) return
    const measure = () => {
      const rect = main.getBoundingClientRect()
      setBox({ left: rect.left, width: rect.width })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(main)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [ref])
  return box ? { left: box.left, width: box.width } : { left: 0, right: 0 }
}

/**
 * While the bar shows, the page column (`<main>`) gets the bar's height
 * added below its own padding, so the whole panel, its bottom edge and
 * corners included, scrolls up above the bar.
 */
function useReserveBelowPage(
  ref: RefObject<HTMLElement | null>,
  active: boolean
) {
  useLayoutEffect(() => {
    const bar = ref.current
    const main = bar?.closest('main')
    if (!bar || !main || !active) return
    const before = main.style.paddingBottom
    const base = parseFloat(getComputedStyle(main).paddingBottom) || 0
    main.style.paddingBottom = `${base + bar.offsetHeight}px`
    return () => {
      main.style.paddingBottom = before
    }
  }, [ref, active])
}
