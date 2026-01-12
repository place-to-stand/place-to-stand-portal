'use client'

import { useState } from 'react'
import {
  Sparkles,
  Mail,
  Calendar,
  FileText,
  Target,
  CheckCircle2,
  XCircle,
  Eye,
  Zap,
  Search,
  Settings,
  Undo2,
  Shield,
  Clock,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const categories = [
  { id: 'email', name: 'Email', icon: Mail, actions: [
    { id: '1', name: 'Follow-up Emails', level: 'draft', enabled: true, rate: 82 },
    { id: '2', name: 'Email Replies', level: 'suggest', enabled: true, rate: 91 },
  ]},
  { id: 'calendar', name: 'Calendar', icon: Calendar, actions: [
    { id: '3', name: 'Meeting Prep', level: 'auto', enabled: true, rate: 100 },
    { id: '4', name: 'Post-Meeting Notes', level: 'draft', enabled: true, rate: 78 },
  ]},
  { id: 'crm', name: 'CRM', icon: Target, actions: [
    { id: '5', name: 'Lead Scoring', level: 'auto', enabled: true, rate: 100 },
    { id: '6', name: 'Lead Stage Changes', level: 'suggest', enabled: true, rate: 64 },
  ]},
  { id: 'documents', name: 'Documents', icon: FileText, actions: [
    { id: '7', name: 'Proposal Generation', level: 'draft', enabled: true, rate: 75 },
  ]},
]

export default function AutonomySettingsSplitPage() {
  const [selectedCategory, setSelectedCategory] = useState('email')
  const [globalEnabled, setGlobalEnabled] = useState(true)
  const [rateLimit, setRateLimit] = useState([10])

  const category = categories.find(c => c.id === selectedCategory)

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar - Categories */}
      <div className="w-64 border-r flex flex-col bg-muted/20">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">AI Actions</h2>
            <Switch checked={globalEnabled} onCheckedChange={setGlobalEnabled} />
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." className="pl-8 h-8" />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors',
                  selectedCategory === cat.id ? 'bg-muted' : 'hover:bg-muted/50'
                )}
              >
                <cat.icon className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-medium text-sm">{cat.name}</p>
                  <p className="text-xs text-muted-foreground">{cat.actions.length} actions</p>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {cat.actions.filter(a => a.enabled).length}
                </Badge>
              </button>
            ))}
          </div>

          <Separator className="my-2" />

          <div className="p-2">
            <button className="w-full flex items-center gap-3 p-3 rounded-lg text-left hover:bg-muted/50">
              <Clock className="h-4 w-4 text-amber-500" />
              <div className="flex-1">
                <p className="font-medium text-sm">Pending</p>
                <p className="text-xs text-muted-foreground">2 items</p>
              </div>
            </button>
            <button className="w-full flex items-center gap-3 p-3 rounded-lg text-left hover:bg-muted/50">
              <Shield className="h-4 w-4 text-violet-500" />
              <div className="flex-1">
                <p className="font-medium text-sm">Safety</p>
                <p className="text-xs text-muted-foreground">Controls</p>
              </div>
            </button>
          </div>
        </ScrollArea>

        {/* Trust Score */}
        <div className="p-4 border-t">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Trust Score</span>
            <span className="text-sm font-semibold text-green-600">87%</span>
          </div>
          <Progress value={87} className="h-1.5" />
        </div>
      </div>

      {/* Main Content - Category Actions */}
      {category && (
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b flex items-center justify-between bg-background">
            <div className="flex items-center gap-3">
              <category.icon className="h-5 w-5" />
              <div>
                <h1 className="font-semibold">{category.name} Actions</h1>
                <p className="text-sm text-muted-foreground">{category.actions.length} actions configured</p>
              </div>
            </div>
          </div>

          <ScrollArea className="flex-1 p-6">
            <div className="max-w-2xl space-y-4">
              {category.actions.map(action => (
                <Card key={action.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium">{action.name}</h3>
                          {action.level === 'auto' && (
                            <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 text-xs">
                              <Zap className="h-3 w-3 mr-1" />Auto
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">Configure how this action behaves</p>
                      </div>
                      <Switch checked={action.enabled} />
                    </div>

                    {action.enabled && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <Label className="text-sm min-w-24">Autonomy:</Label>
                          <Select defaultValue={action.level}>
                            <SelectTrigger className="w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="suggest">
                                <span className="flex items-center gap-2"><Eye className="h-4 w-4 text-blue-500" />Suggest Only</span>
                              </SelectItem>
                              <SelectItem value="draft">
                                <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-amber-500" />Draft & Review</span>
                              </SelectItem>
                              <SelectItem value="auto">
                                <span className="flex items-center gap-2"><Zap className="h-4 w-4 text-green-500" />Auto-Execute</span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center gap-4">
                          <Label className="text-sm min-w-24">Acceptance:</Label>
                          <Progress value={action.rate} className="flex-1 h-2" />
                          <span className={cn(
                            'text-sm font-medium',
                            action.rate > 80 ? 'text-green-600' : action.rate > 60 ? 'text-amber-600' : 'text-red-600'
                          )}>{action.rate}%</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Right Panel - Rate Limits */}
      <div className="w-72 border-l flex flex-col bg-muted/10">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Rate Limits</h2>
        </div>
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm">Max actions/hour</Label>
                <span className="font-medium">{rateLimit[0]}</span>
              </div>
              <Slider value={rateLimit} onValueChange={setRateLimit} max={50} step={5} />
            </div>

            <Separator />

            <div className="space-y-3">
              <Label className="text-sm">Per-action limits</Label>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Emails/hour</span>
                  <span>5</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Lead updates/hour</span>
                  <span>20</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Documents/day</span>
                  <span>10</span>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <Label className="text-sm">Safety Controls</Label>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">New contact approval</span>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Weekend pause</span>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">High-value protection</span>
                  <Switch defaultChecked />
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
