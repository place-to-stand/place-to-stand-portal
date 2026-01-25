'use client'

import type { UseFormReturn } from 'react-hook-form'
import { Target, ChevronDown } from 'lucide-react'

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
import { Textarea } from '@/components/ui/textarea'

import type { ProposalFormValues } from '../proposal-builder'

type OverviewSectionProps = {
  form: UseFormReturn<ProposalFormValues>
}

export function OverviewSection({ form }: OverviewSectionProps) {
  return (
    <Collapsible defaultOpen>
      <div className="rounded-lg border">
        <CollapsibleTrigger className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Project Scope</span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=closed]_&]:rotate-[-90deg]" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-4 border-t p-4">
            {/* Project Overview */}
            <FormField
              control={form.control}
              name="projectOverviewText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Overview *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the client's needs and project goals..."
                      className="min-h-[120px] resize-y"
                      {...field}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    A paragraph describing what the client needs and what this
                    project will accomplish.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Initial Commitment */}
            <FormField
              control={form.control}
              name="initialCommitmentDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Initial Commitment *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., 10-hour minimum retainer"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Estimated Scoping Hours */}
            <FormField
              control={form.control}
              name="estimatedScopingHours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estimated Scoping Hours *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 8-12 hours" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
