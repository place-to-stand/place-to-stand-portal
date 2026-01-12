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
  MoreHorizontal,
  Plus,
  Search,
  Upload,
  Star,
  Clock,
  Sparkles,
  FolderPlus,
  FileUp,
  ChevronRight,
  Grid,
  List,
  Link2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const mockFiles = [
  { id: 'f1', name: 'TechStart-Proposal-v2.pdf', type: 'pdf', size: '2.4 MB', modified: '2 hours ago', starred: true, linkedTo: 'TechStart Web App', aiGenerated: true },
  { id: 'f2', name: 'Project-Requirements.docx', type: 'doc', size: '156 KB', modified: 'Yesterday', starred: false, linkedTo: 'TechStart Portal', aiGenerated: false },
  { id: 'f3', name: 'Invoice-2025-001.pdf', type: 'pdf', size: '89 KB', modified: 'Jan 10', starred: false, linkedTo: 'TechStart Inc', aiGenerated: false },
  { id: 'f4', name: 'Meeting-Notes-Jan8.md', type: 'doc', size: '12 KB', modified: 'Jan 8', starred: false, linkedTo: null, aiGenerated: true },
  { id: 'f5', name: 'Architecture-Diagram.png', type: 'image', size: '1.2 MB', modified: 'Jan 6', starred: true, linkedTo: null, aiGenerated: false },
  { id: 'f6', name: 'Q4-Report.xlsx', type: 'sheet', size: '456 KB', modified: 'Jan 2', starred: false, linkedTo: 'Acme Corp', aiGenerated: false },
]

const quickAccess = [
  { id: '1', name: 'Starred', icon: Star, count: 2, color: 'text-amber-500' },
  { id: '2', name: 'Recent', icon: Clock, count: 8, color: 'text-blue-500' },
  { id: '3', name: 'AI Generated', icon: Sparkles, count: 4, color: 'text-violet-500' },
  { id: '4', name: 'Shared', icon: Link2, count: 12, color: 'text-green-500' },
]

const folders = [
  { id: 'f1', name: 'Clients', count: 24 },
  { id: 'f2', name: 'Templates', count: 8 },
  { id: 'f3', name: 'Internal', count: 15 },
  { id: 'f4', name: 'Archive', count: 42 },
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

export default function DocumentHubCardsPage() {
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Documents</h1>
            <p className="text-muted-foreground">Manage your files and folders</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline"><Sparkles className="h-4 w-4 mr-2" />Generate</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />New</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem><FileUp className="h-4 w-4 mr-2" />Upload file</DropdownMenuItem>
                <DropdownMenuItem><FolderPlus className="h-4 w-4 mr-2" />New folder</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Quick Access */}
        <div>
          <h2 className="font-semibold mb-3">Quick Access</h2>
          <div className="grid grid-cols-4 gap-4">
            {quickAccess.map(item => (
              <Card key={item.id} className="cursor-pointer hover:shadow-md transition-all">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-muted ${item.color}`}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">{item.count} files</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Folders */}
        <div>
          <h2 className="font-semibold mb-3">Folders</h2>
          <div className="grid grid-cols-4 gap-4">
            {folders.map(folder => (
              <Card key={folder.id} className="cursor-pointer hover:shadow-md transition-all">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Folder className="h-10 w-10 text-amber-500" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{folder.name}</p>
                      <p className="text-sm text-muted-foreground">{folder.count} items</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Recent Files */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Recent Files</h2>
            <Button variant="ghost" size="sm">View all</Button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {mockFiles.map(file => (
              <Card key={file.id} className="cursor-pointer hover:shadow-md transition-all group">
                <CardContent className="p-4">
                  {/* File Preview */}
                  <div className="flex items-center justify-center h-32 bg-muted rounded-lg mb-3 relative">
                    <FileIcon type={file.type} className="h-16 w-16" />
                    {file.starred && (
                      <Star className="absolute top-2 right-2 h-4 w-4 fill-amber-400 text-amber-400" />
                    )}
                    {file.aiGenerated && (
                      <Badge className="absolute bottom-2 left-2 gap-1 bg-violet-500">
                        <Sparkles className="h-3 w-3" />AI
                      </Badge>
                    )}
                  </div>

                  {/* File Info */}
                  <div className="mb-2">
                    <p className="font-medium truncate">{file.name}</p>
                    <p className="text-sm text-muted-foreground">{file.size} · {file.modified}</p>
                  </div>

                  {/* Linked Badge */}
                  {file.linkedTo && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Link2 className="h-3 w-3" />
                      {file.linkedTo}
                    </Badge>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="outline" size="sm" className="flex-1">
                      <ExternalLink className="h-3 w-3 mr-1" />Open
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8">
                      <Download className="h-3 w-3" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
