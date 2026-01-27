"use client"

import { cn } from "@/lib/utils"

type MetricCardProps = {
  value: number
  label: string
  variant?: "default" | "warning"
}

export function MetricCard({ value, label, variant = "default" }: MetricCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border p-3",
        variant === "warning" && value > 0
          ? "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400"
          : "bg-muted/50"
      )}
    >
      <span
        className={cn(
          "text-2xl font-bold tabular-nums",
          variant === "warning" && value > 0
            ? "text-amber-700 dark:text-amber-400"
            : "text-foreground"
        )}
      >
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

export function MetricCardSkeleton() {
  return (
    <div className="bg-muted/50 flex flex-col items-center justify-center rounded-lg border p-3">
      <div className="bg-muted h-7 w-8 animate-pulse rounded" />
      <div className="bg-muted mt-1 h-3 w-12 animate-pulse rounded" />
    </div>
  )
}
