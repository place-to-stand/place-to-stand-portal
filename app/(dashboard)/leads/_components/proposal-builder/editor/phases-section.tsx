'use client'

import { useCallback } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { useFieldArray } from 'react-hook-form'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Layers,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  GripVertical,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

import type { ProposalFormValues } from '../proposal-builder'

type PhasesSectionProps = {
  form: UseFormReturn<ProposalFormValues>
}

type PhaseField = {
  id: string
  index: number
  title: string
  purpose: string
  deliverables: string[]
  isOpen?: boolean
}

type SortableDeliverableItemProps = {
  id: string
  value: string
  canRemove: boolean
  onChange: (value: string) => void
  onRemove: () => void
}

function SortableDeliverableItem({
  id,
  value,
  canRemove,
  onChange,
  onRemove,
}: SortableDeliverableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('flex items-center gap-2', isDragging && 'opacity-50')}
    >
      <button
        type="button"
        className="cursor-grab touch-none active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </button>
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Deliverable item"
        className="h-8 flex-1 text-sm"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground hover:text-destructive"
        onClick={onRemove}
        disabled={!canRemove}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  )
}

type SortablePhaseItemProps = {
  id: string
  phase: PhaseField
  phaseIndex: number
  form: UseFormReturn<ProposalFormValues>
  fieldsCount: number
  onToggle: () => void
  onRemove: () => void
  onAddDeliverable: () => void
  onRemoveDeliverable: (deliverableIndex: number) => void
  onUpdateDeliverable: (deliverableIndex: number, value: string) => void
  onReorderDeliverables: (oldIndex: number, newIndex: number) => void
}

function SortablePhaseItem({
  id,
  phase,
  phaseIndex,
  form,
  fieldsCount,
  onToggle,
  onRemove,
  onAddDeliverable,
  onRemoveDeliverable,
  onUpdateDeliverable,
  onReorderDeliverables,
}: SortablePhaseItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <Collapsible
      open={phase.isOpen !== false}
      onOpenChange={onToggle}
    >
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          'rounded-lg border bg-muted/30',
          isDragging && 'opacity-50 ring-2 ring-primary'
        )}
      >
        <CollapsibleTrigger asChild>
          <div className="flex cursor-pointer items-center gap-2 p-3 hover:bg-muted/50">
            <button
              type="button"
              className="cursor-grab touch-none active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </button>
            {phase.isOpen !== false ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <span className="flex-1 text-sm font-medium">
              Phase {phaseIndex + 1}:{' '}
              {form.watch(`phases.${phaseIndex}.title`) || '(untitled)'}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={e => {
                e.stopPropagation()
                onRemove()
              }}
              disabled={fieldsCount <= 1}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-3 border-t p-3">
            {/* Phase Title */}
            <div className="space-y-1.5">
              <Label
                htmlFor={`phase-${phaseIndex}-title`}
                className="text-xs"
              >
                Phase Title
              </Label>
              <Input
                id={`phase-${phaseIndex}-title`}
                placeholder="e.g., Discovery & Scoping"
                className="h-8 text-sm"
                {...form.register(`phases.${phaseIndex}.title`)}
              />
            </div>

            {/* Phase Purpose */}
            <div className="space-y-1.5">
              <Label
                htmlFor={`phase-${phaseIndex}-purpose`}
                className="text-xs"
              >
                Purpose
              </Label>
              <Textarea
                id={`phase-${phaseIndex}-purpose`}
                placeholder="Describe the purpose of this phase..."
                className="min-h-[60px] text-sm"
                {...form.register(`phases.${phaseIndex}.purpose`)}
              />
            </div>

            {/* Deliverables */}
            <div className="space-y-1.5">
              <Label className="text-xs">Deliverables</Label>
              <div className="space-y-2">
                <DndContext
                  sensors={useSensors(
                    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
                    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
                  )}
                  collisionDetection={closestCenter}
                  onDragEnd={(event) => {
                    const { active, over } = event
                    if (over && active.id !== over.id) {
                      const oldIdx = phase.deliverables.findIndex((_, i) => `del-${phaseIndex}-${i}` === active.id)
                      const newIdx = phase.deliverables.findIndex((_, i) => `del-${phaseIndex}-${i}` === over.id)
                      if (oldIdx !== -1 && newIdx !== -1) {
                        onReorderDeliverables(oldIdx, newIdx)
                      }
                    }
                  }}
                >
                  <SortableContext
                    items={phase.deliverables.map((_, i) => `del-${phaseIndex}-${i}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    {phase.deliverables.map((deliverable, deliverableIndex) => (
                      <SortableDeliverableItem
                        key={`del-${phaseIndex}-${deliverableIndex}`}
                        id={`del-${phaseIndex}-${deliverableIndex}`}
                        value={deliverable}
                        canRemove={phase.deliverables.length > 1}
                        onChange={value => onUpdateDeliverable(deliverableIndex, value)}
                        onRemove={() => onRemoveDeliverable(deliverableIndex)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={onAddDeliverable}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Add Deliverable
                </Button>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

export function PhasesSection({ form }: PhasesSectionProps) {
  const { fields, append, remove, update, move } = useFieldArray({
    control: form.control,
    name: 'phases',
  })

  // DnD sensors for drag detection
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (over && active.id !== over.id) {
        const oldIndex = fields.findIndex(f => f.id === active.id)
        const newIndex = fields.findIndex(f => f.id === over.id)
        if (oldIndex !== -1 && newIndex !== -1) {
          move(oldIndex, newIndex)
        }
      }
    },
    [fields, move]
  )

  const handleAddPhase = useCallback(() => {
    append({
      index: fields.length + 1,
      title: '',
      purpose: '',
      deliverables: [''],
      isOpen: true,
    })
  }, [append, fields.length])

  const handleTogglePhase = useCallback(
    (index: number) => {
      const phase = fields[index]
      if (phase) {
        update(index, { ...phase, isOpen: !phase.isOpen })
      }
    },
    [fields, update]
  )

  const handleAddDeliverable = useCallback(
    (phaseIndex: number) => {
      const phase = fields[phaseIndex]
      if (phase) {
        update(phaseIndex, {
          ...phase,
          deliverables: [...phase.deliverables, ''],
        })
      }
    },
    [fields, update]
  )

  const handleRemoveDeliverable = useCallback(
    (phaseIndex: number, deliverableIndex: number) => {
      const phase = fields[phaseIndex]
      if (phase && phase.deliverables.length > 1) {
        update(phaseIndex, {
          ...phase,
          deliverables: phase.deliverables.filter(
            (_, i) => i !== deliverableIndex
          ),
        })
      }
    },
    [fields, update]
  )

  const handleUpdateDeliverable = useCallback(
    (phaseIndex: number, deliverableIndex: number, value: string) => {
      const phase = fields[phaseIndex]
      if (phase) {
        const newDeliverables = [...phase.deliverables]
        newDeliverables[deliverableIndex] = value
        update(phaseIndex, { ...phase, deliverables: newDeliverables })
      }
    },
    [fields, update]
  )

  const handleReorderDeliverables = useCallback(
    (phaseIndex: number, oldIndex: number, newIndex: number) => {
      const phase = fields[phaseIndex]
      if (phase) {
        const newDeliverables = [...phase.deliverables]
        const [moved] = newDeliverables.splice(oldIndex, 1)
        newDeliverables.splice(newIndex, 0, moved)
        update(phaseIndex, { ...phase, deliverables: newDeliverables })
      }
    },
    [fields, update]
  )

  return (
    <Collapsible defaultOpen>
      <div className="rounded-lg border">
        <CollapsibleTrigger className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Phases</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {fields.length}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=closed]_&]:rotate-[-90deg]" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-3 border-t p-4">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={fields.map(f => f.id)}
                strategy={verticalListSortingStrategy}
              >
                {fields.map((phase, phaseIndex) => (
                  <SortablePhaseItem
                    key={phase.id}
                    id={phase.id}
                    phase={phase}
                    phaseIndex={phaseIndex}
                    form={form}
                    fieldsCount={fields.length}
                    onToggle={() => handleTogglePhase(phaseIndex)}
                    onRemove={() => remove(phaseIndex)}
                    onAddDeliverable={() => handleAddDeliverable(phaseIndex)}
                    onRemoveDeliverable={(deliverableIndex) =>
                      handleRemoveDeliverable(phaseIndex, deliverableIndex)
                    }
                    onUpdateDeliverable={(deliverableIndex, value) =>
                      handleUpdateDeliverable(phaseIndex, deliverableIndex, value)
                    }
                    onReorderDeliverables={(oldIndex, newIndex) =>
                      handleReorderDeliverables(phaseIndex, oldIndex, newIndex)
                    }
                  />
                ))}
              </SortableContext>
            </DndContext>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleAddPhase}
            >
              <Plus className="mr-1 h-4 w-4" />
              Add Phase
            </Button>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
