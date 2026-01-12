'use client'

import { useState } from 'react'
import {
  FileText,
  Folder,
  FolderOpen,
  File,
  Image,
  FileSpreadsheet,
  Download,
  ExternalLink,
  MoreHorizontal,
  Plus,
  Search,
  Star,
  Clock,
  Sparkles,
  Link2,
  ChevronRight,
  ChevronDown,
  Share2,
  Edit,
  Eye,
  Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const mockFolders = [
  { id: '1', name: 'Clients', children: [
    { id: '1-1', name: 'TechStart Inc', children: [] },
    { id: '1-2', name: 'Acme Corp', children: [] },
  ]},
  { id: '2', name: 'Templates', children: [] },
  { id: '3', name: 'Internal', children: [] },
]

const mockFiles = [
  { id: 'f1', name: 'TechStart-Proposal-v2.pdf', type: 'pdf', size: '2.4 MB', modified: '2 hours ago', modifiedBy: 'You', starred: true, linkedTo: 'TechStart Web App', aiGenerated: true, views: 5 },
  { id: 'f2', name: 'Project-Requirements.docx', type: 'doc', size: '156 KB', modified: 'Yesterday', modifiedBy: 'You', starred: false, linkedTo: 'TechStart Portal', aiGenerated: false, views: 12 },
  { id: 'f3', name: 'Invoice-2025-001.pdf', type: 'pdf', size: '89 KB', modified: 'Jan 10', modifiedBy: 'System', starred: false, linkedTo: 'TechStart Inc', aiGenerated: false, views: 2 },
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

function FolderTree({ folders, expanded, onToggle, level = 0 }: {
  folders: typeof mockFolders,
  expanded: Set<string>,
  onToggle: (id: string) => void,
  level?: number
}) {
  return (
    <div className={cn(level > 0 && 'ml-4')}>
      {folders.map(folder => {
        const isExpanded = expanded.has(folder.id)
        const hasChildren = folder.children && folder.children.length > 0
        return (
          <div key={folder.id}>
            <button
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-sm"
              onClick={() => onToggle(folder.id)}
            >
              {hasChildren ? (
                isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
              ) : <span className="w-4" />}
              {isExpanded ? <FolderOpen className="h-4 w-4 text-amber-500" /> : <Folder className="h-4 w-4 text-amber-500" />}
              <span className="truncate">{folder.name}</span>
            </button>
            {isExpanded && hasChildren && (
              <FolderTree folders={folder.children as typeof mockFolders} expanded={expanded} onToggle={onToggle} level={level + 1} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function DocumentHubSplitPage() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['1']))
  const [selectedId, setSelectedId] = useState('f1')
  const file = mockFiles.find(f => f.id === selectedId)

  const toggleFolder = (id: string) => {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpanded(next)
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar - Folders */}
      <div className="w-64 border-r flex flex-col bg-muted/20">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." className="pl-8 h-8" />
          </div>
        </div>

        <ScrollArea className="flex-1 p-2">
          <div className="mb-4">
            <h3 className="text-xs font-medium text-muted-foreground px-2 mb-2">Folders</h3>
            <FolderTree folders={mockFolders} expanded={expanded} onToggle={toggleFolder} />
          </div>

          <Separator className="my-3" />

          <div>
            <h3 className="text-xs font-medium text-muted-foreground px-2 mb-2">Quick Access</h3>
            <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-sm">
              <Star className="h-4 w-4 text-amber-500" />Starred
            </button>
            <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-sm">
              <Clock className="h-4 w-4 text-blue-500" />Recent
            </button>
            <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-sm">
              <Sparkles className="h-4 w-4 text-violet-500" />AI Generated
            </button>
          </div>
        </ScrollArea>
      </div>

      {/* File List */}
      <div className="w-80 border-r flex flex-col">
        <div className="p-3 border-b flex items-center justify-between">
          <h2 className="font-semibold text-sm">TechStart Inc</h2>
          <Button size="sm" variant="ghost"><Plus className="h-4 w-4" /></Button>
        </div>

        <ScrollArea className="flex-1">
          {mockFiles.map(f => (
            <button
              key={f.id}
              className={cn(
                'w-full p-3 text-left border-b hover:bg-muted/50 transition-colors',
                selectedId === f.id && 'bg-muted border-l-2 border-l-primary'
              )}
              onClick={() => setSelectedId(f.id)}
            >
              <div className="flex items-start gap-3">
                <FileIcon type={f.type} className="h-5 w-5 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{f.name}</span>
                    {f.starred && <Star className="h-3 w-3 fill-amber-400 text-amber-400 flex-shrink-0" />}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{f.modified} · {f.size}</div>
                  {f.linkedTo && (
                    <Badge variant="outline" className="text-[10px] mt-1 gap-1">
                      <Link2 className="h-2.5 w-2.5" />{f.linkedTo}
                    </Badge>
                  )}
                </div>
                {f.aiGenerated && <Sparkles className="h-4 w-4 text-violet-500 flex-shrink-0" />}
              </div>
            </button>
          ))}
        </ScrollArea>
      </div>

      {/* File Detail */}
      {file && (
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b flex items-center justify-between bg-background">
            <div className="flex items-center gap-3">
              <FileIcon type={file.type} className="h-8 w-8" />
              <div>
                <h1 className="font-semibold">{file.name}</h1>
                <p className="text-sm text-muted-foreground">{file.size}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm"><ExternalLink className="h-4 w-4 mr-1" />Open</Button>
              <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />Download</Button>
              <Button variant="outline" size="sm"><Share2 className="h-4 w-4 mr-1" />Share</Button>
              <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
            </div>
          </div>

          <ScrollArea className="flex-1 p-6">
            <div className="max-w-2xl space-y-6">
              {file.aiGenerated && (
                <div className="p-3 rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-violet-500" />
                  <span className="text-sm">This document was generated by AI</span>
                </div>
              )}

              {/* Preview Placeholder */}
              <Card>
                <CardContent className="p-6 flex items-center justify-center h-64 bg-muted/50">
                  <FileIcon type={file.type} className="h-24 w-24 opacity-50" />
                </CardContent>
              </Card>

              {/* Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <Badge variant="secondary">{file.type.toUpperCase()}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Size</span>
                    <span>{file.size}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Modified</span>
                    <span>{file.modified}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Modified by</span>
                    <span>{file.modifiedBy}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Views</span>
                    <span>{file.views}</span>
                  </div>
                  {file.linkedTo && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Linked to</span>
                      <Badge variant="outline" className="gap-1"><Link2 className="h-3 w-3" />{file.linkedTo}</Badge>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Activity */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Activity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    <span>Viewed by Sarah Chen</span>
                    <span className="text-muted-foreground ml-auto">1h ago</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Edit className="h-4 w-4 text-muted-foreground" />
                    <span>Edited by you</span>
                    <span className="text-muted-foreground ml-auto">2h ago</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  )
}
