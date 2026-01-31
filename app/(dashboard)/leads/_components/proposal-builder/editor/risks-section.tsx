'use client'

import { useCallback } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { useFieldArray } from 'react-hook-form'
import {
  AlertTriangle,
  ChevronDown,
  FileText,
  Plus,
  Trash2,
  RotateCcw,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { DEFAULT_RISKS, FULL_TERMS_AND_CONDITIONS } from '@/lib/proposals/constants'

import type { ProposalFormValues } from '../proposal-builder'

type RisksSectionProps = {
  form: UseFormReturn<ProposalFormValues>
}

export function RisksSection({ form }: RisksSectionProps) {
  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: 'risks',
  })

  const handleAddRisk = useCallback(() => {
    append({ title: '', description: '' })
  }, [append])

  const handleLoadDefaults = useCallback(() => {
    replace(DEFAULT_RISKS.map(r => ({ title: r.title, description: r.description })))
  }, [replace])

  return (
    <Collapsible defaultOpen>
      <div className="rounded-lg border">
        <CollapsibleTrigger className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Risks & Terms</span>
            {fields.length > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {fields.length}
              </span>
            )}
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=closed]_&]:rotate-[-90deg]" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-4 border-t p-4">
            {/* Risks Header with Actions */}
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Potential Risks</p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleLoadDefaults}
                  className="h-7 text-xs"
                >
                  <RotateCcw className="mr-1 h-3 w-3" />
                  Load Defaults
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddRisk}
                  className="h-7 text-xs"
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Add Risk
                </Button>
              </div>
            </div>

            {/* Risks List */}
            {fields.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-center">
                <AlertTriangle className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">No risks added</p>
                <p className="text-xs text-muted-foreground">
                  Click &ldquo;Load Defaults&rdquo; to use standard risks or &ldquo;Add Risk&rdquo; to create custom ones
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="rounded-lg border bg-muted/30 p-3 space-y-2"
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 space-y-2">
                        <Input
                          placeholder="Risk title"
                          className="h-8 text-sm font-medium"
                          {...form.register(`risks.${index}.title`)}
                        />
                        <Textarea
                          placeholder="Risk description..."
                          className="min-h-[60px] text-sm resize-y"
                          {...form.register(`risks.${index}.description`)}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Separator />

            {/* Include Full Terms Toggle */}
            <FormField
              control={form.control}
              name="includeFullTerms"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start gap-3 rounded-lg border p-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-0.5">
                    <FormLabel className="cursor-pointer text-sm flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" />
                      Include Full Terms & Conditions
                    </FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Complete legal terms ({FULL_TERMS_AND_CONDITIONS.length} sections)
                    </p>
                  </div>
                </FormItem>
              )}
            />

            {/* Full Terms Preview */}
            {form.watch('includeFullTerms') && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Included Sections:
                </p>
                <ul className="space-y-1">
                  {FULL_TERMS_AND_CONDITIONS.map((section, index) => (
                    <li
                      key={index}
                      className="text-xs text-muted-foreground"
                    >
                      • {section.title}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
