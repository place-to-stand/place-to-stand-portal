'use client'

import type { UseFormReturn } from 'react-hook-form'
import { AlertTriangle, ChevronDown, FileText } from 'lucide-react'

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
import { Separator } from '@/components/ui/separator'
import { DEFAULT_RISKS, FULL_TERMS_AND_CONDITIONS } from '@/lib/proposals/constants'

import type { ProposalFormValues } from '../proposal-builder'

type RisksSectionProps = {
  form: UseFormReturn<ProposalFormValues>
}

export function RisksSection({ form }: RisksSectionProps) {
  return (
    <Collapsible defaultOpen>
      <div className="rounded-lg border">
        <CollapsibleTrigger className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Risks & Terms</span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=closed]_&]:rotate-[-90deg]" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-4 border-t p-4">
            {/* Include Default Risks Toggle */}
            <FormField
              control={form.control}
              name="includeDefaultRisks"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start gap-3 rounded-lg border p-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-0.5">
                    <FormLabel className="cursor-pointer text-sm">
                      Include Default Risks
                    </FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Standard risk disclosures ({DEFAULT_RISKS.length} items)
                    </p>
                  </div>
                </FormItem>
              )}
            />

            {/* Default Risks Preview */}
            {form.watch('includeDefaultRisks') && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Included Risks:
                </p>
                <ul className="space-y-1.5">
                  {DEFAULT_RISKS.map((risk, index) => (
                    <li
                      key={index}
                      className="text-xs text-muted-foreground"
                    >
                      <span className="font-medium text-foreground">
                        {risk.title}:
                      </span>{' '}
                      {risk.description.slice(0, 100)}
                      {risk.description.length > 100 && '...'}
                    </li>
                  ))}
                </ul>
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
