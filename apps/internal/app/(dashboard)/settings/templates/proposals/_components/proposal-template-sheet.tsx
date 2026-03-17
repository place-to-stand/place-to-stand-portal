'use client'

import { useCallback, useEffect, useMemo, useTransition } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray, useForm } from 'react-hook-form'
import { z } from 'zod'
import { Archive, ChevronDown, GripVertical, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import type { ProposalTemplateRecord } from '@/lib/queries/proposal-templates'

import { saveProposalTemplate, deleteProposalTemplateAction } from '../_actions'

const sectionSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
})

const formSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  isDefault: z.boolean(),
  sections: z.array(sectionSchema).min(1, 'At least one section is required'),
})

type TemplateFormValues = z.infer<typeof formSchema>

type ProposalTemplateSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: ProposalTemplateRecord | null
  onSuccess: () => void
}

export function ProposalTemplateSheet({
  open,
  onOpenChange,
  template,
  onSuccess,
}: ProposalTemplateSheetProps) {
  const isEditing = Boolean(template)
  const [isSaving, startSaveTransition] = useTransition()
  const [isArchiving, startArchiveTransition] = useTransition()
  const { toast } = useToast()

  const defaultValues = useMemo<TemplateFormValues>(
    () => ({
      name: template?.name ?? '',
      isDefault: template?.isDefault ?? false,
      sections: template?.content.length
        ? template.content.map(s => ({ title: s.title, content: s.content }))
        : [{ title: '', content: '' }],
    }),
    [template]
  )

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'sections',
  })

  useEffect(() => {
    form.reset(defaultValues)
  }, [defaultValues, form])

  const handleSubmit = useCallback(
    (values: TemplateFormValues) => {
      startSaveTransition(async () => {
        const result = await saveProposalTemplate({
          id: template?.id,
          name: values.name,
          type: 'TERMS_AND_CONDITIONS',
          content: values.sections,
          isDefault: values.isDefault,
        })

        if (!result.success) {
          toast({
            variant: 'destructive',
            title: 'Unable to save template',
            description: result.error ?? 'Please try again.',
          })
          return
        }

        toast({
          title: isEditing ? 'Template updated' : 'Template created',
          description: isEditing
            ? 'Your changes have been saved.'
            : 'Your new proposal template is ready to use.',
        })

        form.reset()
        onOpenChange(false)
        onSuccess()
      })
    },
    [form, isEditing, onOpenChange, onSuccess, template?.id, toast]
  )

  const handleArchive = useCallback(() => {
    if (!template) return

    startArchiveTransition(async () => {
      const result = await deleteProposalTemplateAction({ templateId: template.id })

      if (!result.success) {
        toast({
          variant: 'destructive',
          title: 'Unable to archive template',
          description: result.error ?? 'Please try again.',
        })
        return
      }

      toast({
        title: 'Template archived',
        description: `"${template.name}" has been archived.`,
      })

      onOpenChange(false)
      onSuccess()
    })
  }, [template, onOpenChange, onSuccess, toast])

  const handleAddSection = useCallback(() => {
    append({ title: '', content: '' })
  }, [append])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-6 overflow-y-auto pb-32 sm:max-w-[700px]">
        <SheetHeader className="px-6 pt-6">
          <SheetTitle>{isEditing ? 'Edit template' : 'New template'}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? 'Update your proposal template.'
              : 'Create a reusable terms and conditions template for proposals.'}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            className="flex flex-1 flex-col gap-6 px-6 pb-32"
            onSubmit={form.handleSubmit(handleSubmit)}
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Template Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Standard Terms & Conditions" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isDefault"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Default template</FormLabel>
                    <FormDescription>
                      Automatically use this template for new proposals
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <FormLabel>Sections</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddSection}
                  className="h-7 text-xs"
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Add Section
                </Button>
              </div>

              <div className="space-y-2">
                {fields.map((field, index) => (
                  <SectionCard
                    key={field.id}
                    index={index}
                    form={form}
                    onRemove={() => remove(index)}
                    canRemove={fields.length > 1}
                  />
                ))}
              </div>

              {form.formState.errors.sections?.message && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.sections.message}
                </p>
              )}
            </div>

            <div className="border-border/40 bg-muted/95 supports-backdrop-filter:bg-muted/90 fixed right-0 bottom-0 z-50 w-full border-t shadow-lg backdrop-blur sm:max-w-[700px]">
              <div className="flex w-full items-center justify-between gap-3 px-6 py-4">
                <div className="flex items-center gap-2">
                  <Button type="submit" disabled={isSaving || isArchiving}>
                    {isSaving
                      ? 'Saving...'
                      : isEditing
                        ? 'Save'
                        : 'Create'}
                  </Button>
                </div>
                {isEditing && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    onClick={handleArchive}
                    disabled={isArchiving || isSaving}
                    aria-label="Archive template"
                    title="Archive template"
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}

type SectionCardProps = {
  index: number
  form: ReturnType<typeof useForm<TemplateFormValues>>
  onRemove: () => void
  canRemove: boolean
}

function SectionCard({ index, form, onRemove, canRemove }: SectionCardProps) {
  const title = form.watch(`sections.${index}.title`)

  return (
    <Collapsible defaultOpen={!title}>
      <div className="rounded-lg border bg-card">
        <CollapsibleTrigger className="flex w-full items-center gap-2 p-3 text-left hover:bg-muted/50">
          <GripVertical className="h-4 w-4 text-muted-foreground/50" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium truncate block">
              {title || `Section ${index + 1}`}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=closed]_&]:rotate-[-90deg]" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t p-3 space-y-3">
            <FormField
              control={form.control}
              name={`sections.${index}.title`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Section Title</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="e.g., Scope & Agreement"
                      className="h-8 text-sm"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`sections.${index}.content`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Content</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Enter the terms content..."
                      className="min-h-[120px] text-sm resize-y"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {canRemove && (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onRemove}
                  className="h-7 text-xs text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  Remove Section
                </Button>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
