'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { Switch } from '@placetostand/ui/switch'
import { Textarea } from '@placetostand/ui/textarea'
import {
  FORM_FIELD_WIDE_CLASS,
  FORM_SECTIONS_CLASS,
  FormSection,
} from '@/components/forms/form-section'
import { PageForm } from '@/components/layout/page-form'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { useToast } from '@/components/ui/use-toast'
import {
  feedbackSettingsOrigins,
  feedbackSettingsSchema,
  type FeedbackSettingsValues,
} from '@/lib/feedback/settings-form'

import { saveProjectFeedbackSettings } from '../../../../feedback/actions'

/**
 * A project's feedback settings: whether its widget takes reports, and from
 * which websites. The widget's key is the project id, shown here to copy into
 * the website's setup.
 */
export function ProjectFeedbackSettings({
  projectId,
  enabled,
  origins,
  productionDomains,
}: {
  projectId: string
  enabled: boolean
  origins: string[]
  /** From the linked Vercel project: always allowed, not editable here. */
  productionDomains: string[]
}) {
  const router = useRouter()
  const { toast } = useToast()
  const form = useForm<FeedbackSettingsValues>({
    resolver: zodResolver(feedbackSettingsSchema),
    defaultValues: { enabled, origins: origins.join('\n') },
  })
  const isPending = form.formState.isSubmitting

  const onSave = async (values: FeedbackSettingsValues) => {
    const result = await saveProjectFeedbackSettings({
      projectId,
      settings: values,
    })
    if (!result.ok) {
      if (result.fieldErrors?.origins) {
        form.setError('origins', { message: result.fieldErrors.origins })
      }
      toast({
        variant: 'destructive',
        title: 'Unable to save the feedback settings',
        description: result.error,
      })
      return false
    }
    // Show the list as saved: cleaned up, one per line.
    form.reset({
      enabled: values.enabled,
      origins: feedbackSettingsOrigins(values.origins).join('\n'),
    })
    router.refresh()
    return true
  }

  return (
    <PageForm form={form} onSave={onSave} historyKey={`feedback-${projectId}`}>
      <div className={`${FORM_SECTIONS_CLASS} max-w-3xl`}>
        <FormSection
          title='Feedback widget'
          description='Lets people send bugs, requests and questions from this project’s websites. Reports land in Feedback, never straight on the board.'
        >
          <FormField
            control={form.control}
            name='enabled'
            render={({ field }) => (
              <FormItem className={FORM_FIELD_WIDE_CLASS}>
                <div className='flex items-center gap-3'>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormLabel>Take feedback</FormLabel>
                </div>
              </FormItem>
            )}
          />
          <FormItem className={FORM_FIELD_WIDE_CLASS}>
            <FormLabel>Widget key</FormLabel>
            <code className='bg-muted w-fit rounded-md px-2 py-1 text-sm select-all'>
              {projectId}
            </code>
            <FormDescription>
              The project’s id. It goes in the website’s widget setup. It is not
              a secret: the website list below is what keeps others out.
            </FormDescription>
          </FormItem>
          <FormField
            control={form.control}
            name='origins'
            render={({ field }) => (
              <FormItem className={FORM_FIELD_WIDE_CLASS}>
                <FormLabel optional>Websites</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={4}
                    placeholder='https://shop.example.com'
                    disabled={isPending}
                  />
                </FormControl>
                <FormDescription>
                  One per line. Reports from any other website are refused.
                  {productionDomains.length > 0
                    ? ` Always allowed, from the linked Vercel project: ${productionDomains.join(', ')}.`
                    : null}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormSection>
      </div>
    </PageForm>
  )
}
