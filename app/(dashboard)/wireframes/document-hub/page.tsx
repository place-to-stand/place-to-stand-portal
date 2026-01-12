'use client'

import { useState } from 'react'
import {
  FileText,
  Folder,
  FolderOpen,
  File,
  Image,
  FileSpreadsheet,
  Presentation,
  Download,
  ExternalLink,
  MoreHorizontal,
  Plus,
  Search,
  Grid,
  List,
  Upload,
  Star,
  StarOff,
  Clock,
  Eye,
  Edit,
  Trash2,
  Share2,
  Link2,
  Copy,
  ChevronRight,
  ChevronDown,
  Building2,
  Users,
  Sparkles,
  RefreshCw,
  FolderPlus,
  FileUp,
  Filter,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AppShellHeader } from '@/components/layout/app-shell'

// Mock folder structure
const mockFolders = [
  {
    id: '1',
    name: 'Clients',
    type: 'folder' as const,
    children: [
      {
        id: '1-1',
        name: 'TechStart Inc',
        type: 'folder' as const,
        linkedTo: { type: 'client', id: '1' },
        children: [
          { id: '1-1-1', name: 'Proposals', type: 'folder' as const, children: [] },
          { id: '1-1-2', name: 'Contracts', type: 'folder' as const, children: [] },
          { id: '1-1-3', name: 'Deliverables', type: 'folder' as const, children: [] },
        ],
      },
      {
        id: '1-2',
        name: 'Acme Corp',
        type: 'folder' as const,
        linkedTo: { type: 'client', id: '2' },
        children: [],
      },
    ],
  },
  {
    id: '2',
    name: 'Templates',
    type: 'folder' as const,
    children: [],
  },
  {
    id: '3',
    name: 'Internal',
    type: 'folder' as const,
    children: [],
  },
]

const mockFiles = [
  {
    id: 'f1',
    name: 'TechStart-Proposal-v2.pdf',
    type: 'pdf',
    size: '2.4 MB',
    modified: '2 hours ago',
    modifiedBy: 'Damon Bodine',
    starred: true,
    linkedTo: { type: 'lead', name: 'TechStart Web App', id: '1' },
    views: 5,
    aiGenerated: true,
    driveLink: 'https://docs.google.com/document/d/xxx',
  },
  {
    id: 'f2',
    name: 'Project-Requirements.docx',
    type: 'doc',
    size: '156 KB',
    modified: 'Yesterday',
    modifiedBy: 'Damon Bodine',
    starred: false,
    linkedTo: { type: 'project', name: 'TechStart Portal', id: '1' },
    views: 12,
    aiGenerated: false,
    driveLink: 'https://docs.google.com/document/d/yyy',
  },
  {
    id: 'f3',
    name: 'Invoice-2025-001.pdf',
    type: 'pdf',
    size: '89 KB',
    modified: 'Jan 10, 2025',
    modifiedBy: 'System',
    starred: false,
    linkedTo: { type: 'client', name: 'TechStart Inc', id: '1' },
    views: 2,
    aiGenerated: false,
    driveLink: null,
  },
  {
    id: 'f4',
    name: 'Meeting-Notes-Jan8.md',
    type: 'doc',
    size: '12 KB',
    modified: 'Jan 8, 2025',
    modifiedBy: 'Damon Bodine',
    starred: false,
    linkedTo: null,
    views: 1,
    aiGenerated: true,
    driveLink: 'https://docs.google.com/document/d/zzz',
  },
]

const mockTemplates = [
  { id: 't1', name: 'Standard Proposal', description: 'Web development proposal template', type: 'proposal' },
  { id: 't2', name: 'Project Requirements Doc', description: 'PRD template with sections', type: 'prd' },
  { id: 't3', name: 'Statement of Work', description: 'SOW contract template', type: 'sow' },
  { id: 't4', name: 'Meeting Summary', description: 'AI-generated meeting notes', type: 'notes' },
]

// File icon helper
function FileIcon({ type, className }: { type: string, className?: string }) {
  switch (type) {
    case 'pdf':
      return <FileText className={`text-red-500 ${className}`} />
    case 'doc':
      return <FileText className={`text-blue-500 ${className}`} />
    case 'sheet':
      return <FileSpreadsheet className={`text-green-500 ${className}`} />
    case 'slides':
      return <Presentation className={`text-amber-500 ${className}`} />
    case 'image':
      return <Image className={`text-purple-500 ${className}`} />
    default:
      return <File className={`text-muted-foreground ${className}`} />
  }
}

// Folder tree item
function FolderTreeItem({ folder, level = 0, expanded, onToggle }: {
  folder: typeof mockFolders[0],
  level?: number,
  expanded: Set<string>,
  onToggle: (id: string) => void
}) {
  const isExpanded = expanded.has(folder.id)
  const hasChildren = folder.children && folder.children.length > 0

  return (
    <div>
      <button
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted text-sm ${level > 0 ? 'ml-4' : ''}`}
        onClick={() => onToggle(folder.id)}
      >
        {hasChildren ? (
          isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
        ) : (
          <span className="w-4" />
        )}
        {isExpanded ? (
          <FolderOpen className="h-4 w-4 text-amber-500" />
        ) : (
          <Folder className="h-4 w-4 text-amber-500" />
        )}
        <span className="flex-1 text-left truncate">{folder.name}</span>
        {(folder as any).linkedTo && (
          <Badge variant="outline" className="text-[10px] h-4">
            {(folder as any).linkedTo.type}
          </Badge>
        )}
      </button>
      {isExpanded && hasChildren && (
        <div>
          {folder.children!.map(child => (
            <FolderTreeItem
              key={child.id}
              folder={child as any}
              level={level + 1}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Generate document dialog
function GenerateDocDialog({ open, onClose }: { open: boolean, onClose: () => void }) {
  const [generating, setGenerating] = useState(false)
  const [template, setTemplate] = useState('')

  const handleGenerate = () => {
    setGenerating(true)
    setTimeout(() => {
      setGenerating(false)
      onClose()
    }, 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            Generate Document
          </DialogTitle>
          <DialogDescription>
            AI will generate a document based on your context
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium">Template</label>
            <Select value={template} onValueChange={setTemplate}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a template..." />
              </SelectTrigger>
              <SelectContent>
                {mockTemplates.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    <div>
                      <p>{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.description}</p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Link to</label>
            <Select>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select lead, client, or project..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lead-1">Lead: TechStart Web App</SelectItem>
                <SelectItem value="client-1">Client: TechStart Inc</SelectItem>
                <SelectItem value="project-1">Project: TechStart Portal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Additional Context</label>
            <Input
              placeholder="e.g., Include 10% early payment discount..."
              className="mt-1"
            />
          </div>

          <div className="p-3 rounded-md bg-violet-500/10 border border-violet-500/20">
            <p className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-500" />
              AI will use context from linked entity including emails, meetings, and notes.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleGenerate} disabled={generating || !template}>
            {generating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// File detail sheet
function FileDetailSheet({ file, open, onClose }: {
  file: typeof mockFiles[0] | null,
  open: boolean,
  onClose: () => void
}) {
  if (!file) return null

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[400px] sm:max-w-[400px]">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <FileIcon type={file.type} className="h-8 w-8" />
            <div>
              <SheetTitle className="text-left">{file.name}</SheetTitle>
              <SheetDescription>{file.size}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Actions */}
          <div className="flex gap-2">
            {file.driveLink && (
              <Button variant="outline" size="sm" asChild>
                <a href={file.driveLink} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Open in Drive
                </a>
              </Button>
            )}
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-1" />
              Download
            </Button>
            <Button variant="outline" size="sm">
              <Share2 className="h-4 w-4 mr-1" />
              Share
            </Button>
          </div>

          {file.aiGenerated && (
            <div className="flex items-center gap-2 p-2 rounded-md bg-violet-500/10 border border-violet-500/20 text-sm">
              <Sparkles className="h-4 w-4 text-violet-500" />
              AI-generated document
            </div>
          )}

          <Separator />

          {/* Details */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Modified</span>
              <span>{file.modified}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Modified by</span>
              <span>{file.modifiedBy}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Views</span>
              <span>{file.views}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Type</span>
              <Badge variant="secondary">{file.type.toUpperCase()}</Badge>
            </div>
          </div>

          {file.linkedTo && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-2">Linked to</p>
                <div className="flex items-center gap-2 p-2 rounded-md bg-muted">
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{file.linkedTo.type}: {file.linkedTo.name}</span>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Activity */}
          <div>
            <p className="text-sm font-medium mb-2">Recent Activity</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <span>Viewed by Sarah Chen</span>
                <span className="text-muted-foreground ml-auto">1h ago</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Edit className="h-4 w-4 text-muted-foreground" />
                <span>Edited by you</span>
                <span className="text-muted-foreground ml-auto">2h ago</span>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// Main document hub page
export default function DocumentHubWireframePage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [selectedFile, setSelectedFile] = useState<typeof mockFiles[0] | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['1', '1-1']))
  const [showGenerate, setShowGenerate] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const toggleFolder = (id: string) => {
    const next = new Set(expandedFolders)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setExpandedFolders(next)
  }

  return (
    <TooltipProvider>
      <>
        <AppShellHeader>
          <div className="flex items-center justify-between w-full">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
              <p className="text-muted-foreground text-sm">
                {mockFiles.length} files · Connected to Google Drive
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync Drive
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowGenerate(true)}>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    New
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <FileUp className="h-4 w-4 mr-2" />
                    Upload file
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <FolderPlus className="h-4 w-4 mr-2" />
                    New folder
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowGenerate(true)}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate with AI
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </AppShellHeader>

        <div className="flex h-[calc(100vh-8rem)]">
          {/* Folder tree sidebar */}
          <div className="w-64 border-r p-4 overflow-y-auto">
            <h2 className="text-sm font-medium mb-3">Folders</h2>
            <div className="space-y-1">
              {mockFolders.map(folder => (
                <FolderTreeItem
                  key={folder.id}
                  folder={folder}
                  expanded={expandedFolders}
                  onToggle={toggleFolder}
                />
              ))}
            </div>

            <Separator className="my-4" />

            <h2 className="text-sm font-medium mb-3">Quick Access</h2>
            <div className="space-y-1">
              <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted text-sm">
                <Star className="h-4 w-4 text-amber-500" />
                Starred
              </button>
              <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Recent
              </button>
              <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted text-sm">
                <Sparkles className="h-4 w-4 text-violet-500" />
                AI Generated
              </button>
            </div>

            <Separator className="my-4" />

            <h2 className="text-sm font-medium mb-3">Storage</h2>
            <div className="space-y-2">
              <Progress value={35} className="h-2" />
              <p className="text-xs text-muted-foreground">5.2 GB of 15 GB used</p>
            </div>
          </div>

          {/* File list */}
          <div className="flex-1 flex flex-col">
            {/* Toolbar */}
            <div className="flex items-center gap-2 p-4 border-b">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setViewMode('list')}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>List view</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setViewMode('grid')}
                    >
                      <Grid className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Grid view</TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Breadcrumb */}
            <div className="px-4 py-2 border-b bg-muted/30">
              <div className="flex items-center gap-1 text-sm">
                <button className="hover:underline">My Drive</button>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <button className="hover:underline">Clients</button>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">TechStart Inc</span>
              </div>
            </div>

            {/* File content */}
            <ScrollArea className="flex-1">
              {viewMode === 'list' ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40%]">Name</TableHead>
                      <TableHead>Linked To</TableHead>
                      <TableHead>Modified</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockFiles.map(file => (
                      <TableRow
                        key={file.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedFile(file)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <FileIcon type={file.type} className="h-5 w-5" />
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{file.name}</span>
                              {file.starred && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
                              {file.aiGenerated && <Sparkles className="h-3 w-3 text-violet-500" />}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {file.linkedTo ? (
                            <Badge variant="outline" className="gap-1">
                              <Link2 className="h-3 w-3" />
                              {file.linkedTo.name}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{file.modified}</TableCell>
                        <TableCell className="text-muted-foreground">{file.size}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Download className="h-4 w-4 mr-2" />
                                Download
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Share2 className="h-4 w-4 mr-2" />
                                Share
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Link2 className="h-4 w-4 mr-2" />
                                Link to...
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-4 grid grid-cols-4 gap-4">
                  {mockFiles.map(file => (
                    <Card
                      key={file.id}
                      className="cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => setSelectedFile(file)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-center h-24 bg-muted rounded-md mb-3">
                          <FileIcon type={file.type} className="h-12 w-12" />
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate flex-1">{file.name}</p>
                          {file.starred && <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground">{file.modified}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <FileDetailSheet file={selectedFile} open={!!selectedFile} onClose={() => setSelectedFile(null)} />
        <GenerateDocDialog open={showGenerate} onClose={() => setShowGenerate(false)} />
      </>
    </TooltipProvider>
  )
}
