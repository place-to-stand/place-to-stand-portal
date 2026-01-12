'use client'

import { useState } from 'react'
import {
  FileText,
  Folder,
  File,
  Image,
  FileSpreadsheet,
  Download,
  MoreHorizontal,
  Plus,
  Search,
  Star,
  Clock,
  Sparkles,
  Link2,
  Filter,
  SortAsc,
  ChevronRight,
  Checkbox,
  Trash2,
  Share2,
  FolderPlus,
  FileUp,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const mockFiles = [
  { id: 'f1', name: 'TechStart-Proposal-v2.pdf', type: 'pdf', size: '2.4 MB', modified: '2 hours ago', modifiedBy: 'You', starred: true, linkedTo: 'TechStart Web App', aiGenerated: true },
  { id: 'f2', name: 'Project-Requirements.docx', type: 'doc', size: '156 KB', modified: 'Yesterday', modifiedBy: 'You', starred: false, linkedTo: 'TechStart Portal', aiGenerated: false },
  { id: 'f3', name: 'Invoice-2025-001.pdf', type: 'pdf', size: '89 KB', modified: 'Jan 10', modifiedBy: 'System', starred: false, linkedTo: 'TechStart Inc', aiGenerated: false },
  { id: 'f4', name: 'Meeting-Notes-Jan8.md', type: 'doc', size: '12 KB', modified: 'Jan 8', modifiedBy: 'You', starred: false, linkedTo: null, aiGenerated: true },
  { id: 'f5', name: 'Architecture-Diagram.png', type: 'image', size: '1.2 MB', modified: 'Jan 6', modifiedBy: 'Sarah', starred: true, linkedTo: null, aiGenerated: false },
  { id: 'f6', name: 'Q4-Report.xlsx', type: 'sheet', size: '456 KB', modified: 'Jan 2', modifiedBy: 'You', starred: false, linkedTo: 'Acme Corp', aiGenerated: false },
]

const breadcrumb = ['My Drive', 'Clients', 'TechStart Inc']

function FileIcon({ type, className }: { type: string, className?: string }) {
  switch (type) {
    case 'pdf': return <FileText className={`text-red-500 ${className}`} />
    case 'doc': return <FileText className={`text-blue-500 ${className}`} />
    case 'sheet': return <FileSpreadsheet className={`text-green-500 ${className}`} />
    case 'image': return <Image className={`text-purple-500 ${className}`} />
    default: return <File className={`text-muted-foreground ${className}`} />
  }
}

export default function DocumentHubCompactPage() {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  const toggleSelect = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelected(next)
  }

  const toggleAll = () => {
    if (selected.size === mockFiles.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(mockFiles.map(f => f.id)))
    }
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Toolbar */}
      <div className="border-b px-4 py-2 flex items-center gap-3 bg-background">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8"
          />
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-8">
            <Filter className="h-4 w-4 mr-1" />Filter
          </Button>
          <Button variant="ghost" size="sm" className="h-8">
            <SortAsc className="h-4 w-4 mr-1" />Sort
          </Button>
        </div>

        <div className="flex items-center gap-1 ml-auto">
          {selected.size > 0 && (
            <>
              <span className="text-sm text-muted-foreground mr-2">{selected.size} selected</span>
              <Button variant="ghost" size="sm" className="h-8"><Share2 className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" className="h-8"><Download className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" className="h-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
              <div className="w-px h-4 bg-border mx-2" />
            </>
          )}
          <Button variant="outline" size="sm" className="h-8">
            <Sparkles className="h-4 w-4 mr-1" />Generate
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="h-8">
                <Plus className="h-4 w-4 mr-1" />New
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem><FileUp className="h-4 w-4 mr-2" />Upload</DropdownMenuItem>
              <DropdownMenuItem><FolderPlus className="h-4 w-4 mr-2" />Folder</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Quick Filters */}
      <div className="border-b px-4 py-2 flex items-center gap-2 bg-muted/30">
        <Button variant="secondary" size="sm" className="h-7 text-xs">All</Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs"><Star className="h-3 w-3 mr-1" />Starred</Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs"><Clock className="h-3 w-3 mr-1" />Recent</Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs"><Sparkles className="h-3 w-3 mr-1" />AI Generated</Button>
        <div className="flex-1" />
        <div className="text-xs text-muted-foreground">{mockFiles.length} items</div>
      </div>

      {/* Breadcrumb */}
      <div className="px-4 py-1 border-b flex items-center gap-1 text-sm">
        {breadcrumb.map((item, idx) => (
          <div key={idx} className="flex items-center gap-1">
            {idx > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            <button className={cn(
              'hover:underline',
              idx === breadcrumb.length - 1 && 'font-medium'
            )}>{item}</button>
          </div>
        ))}
      </div>

      {/* File Table */}
      <ScrollArea className="flex-1">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10">
                <button
                  onClick={toggleAll}
                  className={cn(
                    'w-4 h-4 border rounded flex items-center justify-center',
                    selected.size === mockFiles.length && 'bg-primary border-primary'
                  )}
                >
                  {selected.size === mockFiles.length && (
                    <svg className="w-3 h-3 text-primary-foreground" viewBox="0 0 12 12" fill="none">
                      <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              </TableHead>
              <TableHead className="w-6"></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Linked To</TableHead>
              <TableHead>Modified</TableHead>
              <TableHead>Modified By</TableHead>
              <TableHead>Size</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockFiles.map(file => (
              <TableRow
                key={file.id}
                className={cn(
                  'cursor-pointer',
                  selected.has(file.id) && 'bg-muted/50'
                )}
              >
                <TableCell>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSelect(file.id) }}
                    className={cn(
                      'w-4 h-4 border rounded flex items-center justify-center',
                      selected.has(file.id) && 'bg-primary border-primary'
                    )}
                  >
                    {selected.has(file.id) && (
                      <svg className="w-3 h-3 text-primary-foreground" viewBox="0 0 12 12" fill="none">
                        <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                </TableCell>
                <TableCell>
                  {file.starred && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <FileIcon type={file.type} className="h-4 w-4" />
                    <span className="font-medium text-sm">{file.name}</span>
                    {file.aiGenerated && <Sparkles className="h-3 w-3 text-violet-500" />}
                  </div>
                </TableCell>
                <TableCell>
                  {file.linkedTo ? (
                    <Badge variant="outline" className="text-xs gap-1 font-normal">
                      <Link2 className="h-3 w-3" />
                      {file.linkedTo}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{file.modified}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{file.modifiedBy}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{file.size}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>Open</DropdownMenuItem>
                      <DropdownMenuItem>Download</DropdownMenuItem>
                      <DropdownMenuItem>Share</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  )
}
