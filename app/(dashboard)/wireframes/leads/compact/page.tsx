'use client'

import { useState } from 'react'
import {
  Search,
  Plus,
  Filter,
  ChevronDown,
  Mail,
  Phone,
  MoreHorizontal,
  ArrowUpDown,
  Sparkles,
  ExternalLink,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const mockLeads = [
  { id: '1', name: 'Sarah Mitchell', company: 'GrowthLabs', email: 'sarah@growthlabs.io', phone: '+1 555-0123', status: 'hot', score: 92, value: 45000, source: 'Website', created: 'Jan 10' },
  { id: '2', name: 'James Wilson', company: 'TechVentures', email: 'james@techventures.com', phone: '+1 555-0124', status: 'warm', score: 75, value: 28000, source: 'Referral', created: 'Jan 8' },
  { id: '3', name: 'Emily Chen', company: 'DataFlow Inc', email: 'emily@dataflow.io', phone: '+1 555-0125', status: 'warm', score: 68, value: 35000, source: 'LinkedIn', created: 'Jan 5' },
  { id: '4', name: 'Michael Brown', company: 'CloudNine', email: 'michael@cloudnine.co', phone: '+1 555-0126', status: 'cold', score: 45, value: 15000, source: 'Cold Email', created: 'Jan 3' },
  { id: '5', name: 'Lisa Park', company: 'Innovate Co', email: 'lisa@innovate.co', phone: '+1 555-0127', status: 'hot', score: 88, value: 52000, source: 'Website', created: 'Jan 2' },
  { id: '6', name: 'David Kim', company: 'StartupXYZ', email: 'david@startupxyz.com', phone: '+1 555-0128', status: 'warm', score: 71, value: 22000, source: 'Referral', created: 'Dec 28' },
]

const statusConfig = {
  hot: { label: 'Hot', color: 'bg-red-500' },
  warm: { label: 'Warm', color: 'bg-orange-500' },
  cold: { label: 'Cold', color: 'bg-blue-500' },
}

export default function LeadsCompactPage() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<'score' | 'value' | 'created'>('score')

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const selectAll = () => {
    if (selectedIds.size === mockLeads.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(mockLeads.map(l => l.id)))
    }
  }

  const sortedLeads = [...mockLeads].sort((a, b) => {
    if (sortBy === 'score') return b.score - a.score
    if (sortBy === 'value') return b.value - a.value
    return 0
  })

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Toolbar */}
      <div className="border-b px-4 py-2 flex items-center gap-3 bg-background">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search leads..." className="h-8 pl-8 text-sm" />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              Status <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>All</DropdownMenuItem>
            <DropdownMenuItem>Hot</DropdownMenuItem>
            <DropdownMenuItem>Warm</DropdownMenuItem>
            <DropdownMenuItem>Cold</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <ArrowUpDown className="h-3 w-3 mr-1" />
              Sort: {sortBy}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setSortBy('score')}>By Score</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortBy('value')}>By Value</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortBy('created')}>By Date</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 ml-2 pl-2 border-l">
            <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
            <Button variant="outline" size="sm" className="h-8">Bulk Email</Button>
            <Button variant="outline" size="sm" className="h-8">Export</Button>
          </div>
        )}

        <Button size="sm" className="ml-auto h-8">
          <Plus className="h-4 w-4 mr-1" />
          Add Lead
        </Button>
      </div>

      {/* Table */}
      <ScrollArea className="flex-1">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10">
                <Checkbox checked={selectedIds.size === mockLeads.length} onCheckedChange={selectAll} />
              </TableHead>
              <TableHead>Lead</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead className="w-20">Status</TableHead>
              <TableHead className="w-32">
                <div className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Score
                </div>
              </TableHead>
              <TableHead className="text-right w-24">Value</TableHead>
              <TableHead className="w-24">Source</TableHead>
              <TableHead className="w-20">Created</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedLeads.map(lead => (
              <TableRow key={lead.id} className="cursor-pointer">
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(lead.id)}
                    onCheckedChange={() => toggleSelect(lead.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{lead.name}</div>
                    <div className="text-xs text-muted-foreground">{lead.company}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Mail className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Phone className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <span className={cn('h-2 w-2 rounded-full', statusConfig[lead.status as keyof typeof statusConfig].color)} />
                    <span className="text-xs capitalize">{lead.status}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={lead.score} className="w-12 h-1.5" />
                    <span className={cn(
                      'text-xs font-medium w-8',
                      lead.score >= 80 ? 'text-green-600' : lead.score >= 50 ? 'text-yellow-600' : 'text-red-600'
                    )}>
                      {lead.score}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">
                  ${(lead.value / 1000).toFixed(0)}K
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{lead.source}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {lead.created}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>View Details</DropdownMenuItem>
                      <DropdownMenuItem>Edit</DropdownMenuItem>
                      <DropdownMenuItem>Convert to Client</DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t px-4 py-2 flex items-center justify-between text-sm text-muted-foreground bg-muted/30">
        <span>{mockLeads.length} leads • ${(mockLeads.reduce((a, l) => a + l.value, 0) / 1000).toFixed(0)}K pipeline</span>
        <span>Page 1 of 1</span>
      </div>
    </div>
  )
}
