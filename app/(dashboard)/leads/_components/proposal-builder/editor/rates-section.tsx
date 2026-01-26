'use client'

import type { UseFormReturn } from 'react-hook-form'
import { format } from 'date-fns'
import { DollarSign, ChevronDown } from 'lucide-react'

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
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

import type { ProposalFormValues } from '../proposal-builder'

type RatesSectionProps = {
  form: UseFormReturn<ProposalFormValues>
}

export function RatesSection({ form }: RatesSectionProps) {
  return (
    <Collapsible defaultOpen>
      <div className="rounded-lg border">
        <CollapsibleTrigger className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Rates & Terms</span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=closed]_&]:rotate-[-90deg]" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-4 border-t p-4">
            {/* Hourly Rate & Kickoff Days */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="hourlyRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      Hourly Rate
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        {...field}
                        onChange={e =>
                          field.onChange(parseFloat(e.target.value) || 0)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="kickoffDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kickoff Days</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        {...field}
                        onChange={e =>
                          field.onChange(parseInt(e.target.value) || 1)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Valid Until & Estimated Value */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="proposalValidUntil"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valid Until</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        min={format(new Date(), 'yyyy-MM-dd')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="estimatedValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      Estimated Value
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="100"
                        placeholder="Optional"
                        {...field}
                        value={field.value ?? ''}
                        onChange={e =>
                          field.onChange(
                            e.target.value
                              ? parseFloat(e.target.value)
                              : undefined
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
