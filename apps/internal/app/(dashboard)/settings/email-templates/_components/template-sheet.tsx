'use client'

import { useCallback, useEffect, useMemo, useTransition } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Info } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useToast } from '@/components/ui/use-toast'
import {
  EMAIL_TEMPLATE_CATEGORIES,
  EMAIL_TEMPLATE_CATEGORY_LABELS,
  TEMPLATE_VARIABLES,
  type EmailTemplateRecord,
} from '@/lib/email/templates'

import { saveTemplate } from '../_actions'

const formSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  category: z.enum(EMAIL_TEMPLATE_CATEGORIES),
  subject: z.string().trim().min(1, 'Subject is required').max(200),
  bodyHtml: z.string().min(1, 'Body is required'),
  isDefault: z.boolean(),
})

type TemplateFormValues = z.infer<typeof formSchema>

type TemplateSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: EmailTemplateRecord | null
  onSuccess: () => void
}

export function TemplateSheet({
  open,
  onOpenChange,
  template,
  onSuccess,
}: TemplateSheetProps) {
  const isEditing = Boolean(template)
  const [isSaving, startSaveTransition] = useTransition()
  const { toast } = useToast()

  const defaultValues = useMemo<TemplateFormValues>(
    () => ({
      name: template?.name ?? '',
      category: template?.category ?? 'FOLLOW_UP',
      subject: template?.subject ?? '',
      bodyHtml: template?.bodyHtml ?? '',
      isDefault: template?.isDefault ?? false,
    }),
    [template]
  )

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  })

  useEffect(() => {
    form.reset(defaultValues)
  }, [defaultValues, form])

  const handleSubmit = useCallback(
    (values: TemplateFormValues) => {
      startSaveTransition(async () => {
        const result = await saveTemplate({
          id: template?.id,
          ...values,
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
            : 'Your new email template is ready to use.',
        })

        form.reset()
        onOpenChange(false)
        onSuccess()
      })
    },
    [form, isEditing, onOpenChange, onSuccess, template?.id, toast]
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-6 overflow-y-auto sm:max-w-[600px]">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Edit template' : 'New template'}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? 'Update your email template.'
              : 'Create a reusable email template for lead outreach.'}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            className="flex flex-1 flex-col gap-6"
            onSubmit={form.handleSubmit(handleSubmit)}
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Template Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Initial Follow-up" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {EMAIL_TEMPLATE_CATEGORIES.map(cat => (
                          <SelectItem key={cat} value={cat}>
                            {EMAIL_TEMPLATE_CATEGORY_LABELS[cat]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isDefault"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-8">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Default template</FormLabel>
                      <FormDescription>
                        Auto-select for this category
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject Line</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Following up on our conversation, {{first_name}}"
                    />
                  </FormControl>
                  <FormDescription>
                    Use {'{{variables}}'} for personalization
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bodyHtml"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <FormLabel>Email Body</FormLabel>
                    <VariablesTooltip />
                  </div>
                  <FormControl>
                    <RichTextEditor
                      id="template-body"
                      value={field.value}
                      onChange={field.onChange}
                      contentMinHeightClassName="[&_.ProseMirror]:min-h-[200px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="mt-auto flex justify-end gap-2 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving
                  ? isEditing
                    ? 'Saving...'
                    : 'Creating...'
                  : isEditing
                    ? 'Save changes'
                    : 'Create template'}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}

function VariablesTooltip() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-5 w-5 text-muted-foreground"
        >
          <Info className="h-3.5 w-3.5" />
          <span className="sr-only">Available variables</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-[280px]">
        <p className="mb-2 font-medium">Available variables:</p>
        <ul className="space-y-1 text-xs">
          {Object.entries(TEMPLATE_VARIABLES).map(([key, info]) => (
            <li key={key}>
              <code className="rounded bg-muted px-1">{`{{${key}}}`}</code>
              <span className="text-muted-foreground"> - {info.description}</span>
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  )
}
