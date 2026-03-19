import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'

export default function ProjectNotFound() {
  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Back to projects
      </Link>
      <div className="rounded-lg border border-border p-8 text-center">
        <h2 className="text-lg font-semibold text-foreground">
          Project not found
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This project doesn&apos;t exist or you don&apos;t have access to it.
        </p>
      </div>
    </div>
  )
}
