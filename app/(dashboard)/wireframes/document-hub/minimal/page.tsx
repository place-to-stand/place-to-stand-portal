'use client'

import { useState } from 'react'
import {
  FileText,
  Folder,
  File,
  Image,
  FileSpreadsheet,
  Download,
  ExternalLink,
  Plus,
  Search,
  Star,
  Sparkles,
  ArrowLeft,
  MoreHorizontal,
  Share2,
  Link2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

const mockFiles = [
  { id: 'f1', name: 'TechStart-Proposal-v2.pdf', type: 'pdf', size: '2.4 MB', modified: '2h ago', starred: true, linkedTo: 'TechStart Web App', aiGenerated: true },
  { id: 'f2', name: 'Project-Requirements.docx', type: 'doc', size: '156 KB', modified: 'Yesterday', starred: false, linkedTo: 'TechStart Portal', aiGenerated: false },
  { id: 'f3', name: 'Invoice-2025-001.pdf', type: 'pdf', size: '89 KB', modified: 'Jan 10', starred: false, linkedTo: null, aiGenerated: false },
  { id: 'f4', name: 'Meeting-Notes.md', type: 'doc', size: '12 KB', modified: 'Jan 8', starred: false, linkedTo: null, aiGenerated: true },
]

const quickActions = [
  { id: '1', name: 'Starred', icon: Star, color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' },
  { id: '2', name: 'AI Gen', icon: Sparkles, color: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600' },
  { id: '3', name: 'Folders', icon: Folder, color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' },
]

function FileIcon({ type, className }: { type: string, className?: string }) {
  switch (type) {
    case 'pdf': return <FileText className={`text-red-500 ${className}`} />
    case 'doc': return <FileText className={`text-blue-500 ${className}`} />
    case 'sheet': return <FileSpreadsheet className={`text-green-500 ${className}`} />
    case 'image': return <Image className={`text-purple-500 ${className}`} />
    default: return <File className={`text-muted-foreground ${className}`} />
  }
}

export default function DocumentHubMinimalPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const file = mockFiles.find(f => f.id === selectedId)

  if (file) {
    return (
      <div className="h-[calc(100vh-4rem)] bg-muted/30">
        <div className="max-w-lg mx-auto h-full flex flex-col bg-white dark:bg-neutral-900">
          {/* Header */}
          <div className="p-4 flex items-center gap-3 border-b">
            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setSelectedId(null)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <span className="font-semibold flex-1">File Details</span>
            <Button variant="ghost" size="icon" className="rounded-full">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </div>

          <ScrollArea className="flex-1">
            {/* File Preview */}
            <div className="p-8 flex flex-col items-center text-center border-b">
              <div className="w-24 h-24 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <FileIcon type={file.type} className="h-12 w-12" />
              </div>
              <h1 className="text-xl font-bold mb-1">{file.name}</h1>
              <p className="text-muted-foreground mb-3">{file.size} · {file.modified}</p>
              <div className="flex items-center gap-2">
                {file.starred && (
                  <Badge variant="secondary" className="gap-1">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />Starred
                  </Badge>
                )}
                {file.aiGenerated && (
                  <Badge className="gap-1 bg-violet-500">
                    <Sparkles className="h-3 w-3" />AI Generated
                  </Badge>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex justify-center gap-8 p-6 border-b">
              <button className="flex flex-col items-center gap-2">
                <div className="p-4 rounded-2xl bg-primary text-primary-foreground">
                  <ExternalLink className="h-6 w-6" />
                </div>
                <span className="text-xs">Open</span>
              </button>
              <button className="flex flex-col items-center gap-2">
                <div className="p-4 rounded-2xl bg-muted">
                  <Download className="h-6 w-6" />
                </div>
                <span className="text-xs">Download</span>
              </button>
              <button className="flex flex-col items-center gap-2">
                <div className="p-4 rounded-2xl bg-muted">
                  <Share2 className="h-6 w-6" />
                </div>
                <span className="text-xs">Share</span>
              </button>
            </div>

            {/* Linked To */}
            {file.linkedTo && (
              <div className="px-6 py-4">
                <h3 className="font-semibold mb-3">Linked To</h3>
                <div className="p-4 rounded-2xl bg-muted/50 flex items-center gap-3">
                  <Link2 className="h-5 w-5 text-muted-foreground" />
                  <span>{file.linkedTo}</span>
                </div>
              </div>
            )}

            {/* Details */}
            <div className="px-6 py-4">
              <h3 className="font-semibold mb-3">Details</h3>
              <div className="space-y-3">
                <div className="flex justify-between p-3 rounded-xl bg-muted/50">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium">{file.type.toUpperCase()}</span>
                </div>
                <div className="flex justify-between p-3 rounded-xl bg-muted/50">
                  <span className="text-muted-foreground">Size</span>
                  <span>{file.size}</span>
                </div>
                <div className="flex justify-between p-3 rounded-xl bg-muted/50">
                  <span className="text-muted-foreground">Modified</span>
                  <span>{file.modified}</span>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-4rem)] bg-muted/30">
      <div className="max-w-lg mx-auto h-full flex flex-col bg-white dark:bg-neutral-900">
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b">
          <h1 className="text-xl font-bold">Documents</h1>
          <Button size="icon" variant="ghost" className="rounded-full">
            <Plus className="h-5 w-5" />
          </Button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-full bg-muted/50 border-0"
            />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="px-4 py-3 flex gap-3 border-b">
          {quickActions.map(action => (
            <button key={action.id} className={cn('flex-1 p-3 rounded-2xl flex flex-col items-center gap-1', action.color)}>
              <action.icon className="h-5 w-5" />
              <span className="text-xs font-medium">{action.name}</span>
            </button>
          ))}
        </div>

        {/* File List */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground mb-3">Recent Files</h2>
            {mockFiles.map(f => (
              <button
                key={f.id}
                className="w-full p-4 rounded-2xl bg-muted/50 text-left hover:bg-muted transition-colors flex items-center gap-3"
                onClick={() => setSelectedId(f.id)}
              >
                <div className="p-2 rounded-xl bg-background">
                  <FileIcon type={f.type} className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{f.name}</span>
                    {f.starred && <Star className="h-3 w-3 fill-amber-400 text-amber-400 flex-shrink-0" />}
                  </div>
                  <div className="text-sm text-muted-foreground">{f.size} · {f.modified}</div>
                </div>
                {f.aiGenerated && <Sparkles className="h-4 w-4 text-violet-500 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
