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
  ArrowLeft,
  ChevronRight,
  Shield,
  Clock,
  Brain,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

const categories = [
  { id: 'email', name: 'Email Actions', icon: Mail, enabled: 2, total: 2, trustScore: 91 },
  { id: 'calendar', name: 'Calendar Actions', icon: Calendar, enabled: 2, total: 2, trustScore: 100 },
  { id: 'crm', name: 'CRM Actions', icon: Target, enabled: 2, total: 2, trustScore: 82 },
  { id: 'documents', name: 'Document Actions', icon: FileText, enabled: 1, total: 1, trustScore: 75 },
]

const pendingItems = [
  { id: '1', title: 'Follow-up to Sarah Chen', time: '10m ago' },
  { id: '2', title: 'Introduction to David Kim', time: '1h ago' },
]

export default function AutonomySettingsMinimalPage() {
  const [globalEnabled, setGlobalEnabled] = useState(true)
  const [view, setView] = useState<'main' | 'category' | 'pending'>('main')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const category = categories.find(c => c.id === selectedCategory)

  if (view === 'pending') {
    return (
      <div className="h-[calc(100vh-4rem)] bg-muted/30">
        <div className="max-w-lg mx-auto h-full flex flex-col bg-white dark:bg-neutral-900">
          <div className="p-4 flex items-center gap-3 border-b">
            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setView('main')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <span className="font-semibold flex-1">Pending Approvals</span>
            <Badge>{pendingItems.length}</Badge>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-3">
              {pendingItems.map(item => (
                <div key={item.id} className="p-4 rounded-2xl bg-muted/50">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/30">
                      <Mail className="h-5 w-5 text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{item.title}</p>
                      <p className="text-sm text-muted-foreground">{item.time}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 rounded-xl">
                      <XCircle className="h-4 w-4 mr-2" />Reject
                    </Button>
                    <Button className="flex-1 rounded-xl">
                      <CheckCircle2 className="h-4 w-4 mr-2" />Approve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    )
  }

  if (view === 'category' && category) {
    return (
      <div className="h-[calc(100vh-4rem)] bg-muted/30">
        <div className="max-w-lg mx-auto h-full flex flex-col bg-white dark:bg-neutral-900">
          <div className="p-4 flex items-center gap-3 border-b">
            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => { setView('main'); setSelectedCategory(null) }}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <category.icon className="h-5 w-5" />
            <span className="font-semibold flex-1">{category.name}</span>
          </div>

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {/* Trust Score */}
              <div className="p-4 rounded-2xl bg-green-50 dark:bg-green-950/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Trust Score</span>
                  <span className="text-xl font-bold text-green-600">{category.trustScore}%</span>
                </div>
                <Progress value={category.trustScore} className="h-2" />
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <h3 className="font-semibold">Actions</h3>
                <div className="p-4 rounded-2xl bg-muted/50 flex items-center justify-between">
                  <div>
                    <p className="font-medium">Follow-up Emails</p>
                    <Badge variant="outline" className="text-xs mt-1"><FileText className="h-3 w-3 mr-1" />Draft</Badge>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="p-4 rounded-2xl bg-muted/50 flex items-center justify-between">
                  <div>
                    <p className="font-medium">Email Replies</p>
                    <Badge variant="outline" className="text-xs mt-1"><Eye className="h-3 w-3 mr-1" />Suggest</Badge>
                  </div>
                  <Switch defaultChecked />
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
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold">AI Autonomy</h1>
            <div className="flex items-center gap-2">
              <Switch checked={globalEnabled} onCheckedChange={setGlobalEnabled} />
              <Badge variant={globalEnabled ? 'default' : 'secondary'}>
                {globalEnabled ? 'ON' : 'OFF'}
              </Badge>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1">
          {/* Trust Score */}
          <div className="p-4">
            <div className="p-6 rounded-2xl bg-gradient-to-r from-violet-500/10 to-purple-500/10 text-center">
              <Brain className="h-10 w-10 text-violet-500 mx-auto mb-3" />
              <p className="text-3xl font-bold text-violet-600 mb-1">87%</p>
              <p className="text-sm text-muted-foreground">Trust Score</p>
              <p className="text-xs text-muted-foreground mt-2">243 actions · 211 approved</p>
            </div>
          </div>

          {/* Pending */}
          {pendingItems.length > 0 && (
            <div className="px-4 pb-4">
              <button
                className="w-full p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 flex items-center gap-3"
                onClick={() => setView('pending')}
              >
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/30">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium">{pendingItems.length} Pending Approvals</p>
                  <p className="text-sm text-muted-foreground">Review AI-drafted content</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
          )}

          {/* Categories */}
          <div className="px-4 pb-4">
            <h2 className="font-semibold mb-3">Action Categories</h2>
            <div className="space-y-2">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  className="w-full p-4 rounded-2xl bg-muted/50 flex items-center gap-3 text-left hover:bg-muted transition-colors"
                  onClick={() => { setSelectedCategory(cat.id); setView('category') }}
                >
                  <div className="p-2 rounded-xl bg-background">
                    <cat.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{cat.name}</p>
                    <p className="text-sm text-muted-foreground">{cat.enabled}/{cat.total} enabled</p>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      'text-sm font-medium',
                      cat.trustScore > 80 ? 'text-green-600' : cat.trustScore > 60 ? 'text-amber-600' : 'text-red-600'
                    )}>{cat.trustScore}%</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>

          {/* Safety */}
          <div className="px-4 pb-4">
            <button className="w-full p-4 rounded-2xl bg-violet-50 dark:bg-violet-950/30 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-900/30">
                <Shield className="h-5 w-5 text-violet-600" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium">Safety Controls</p>
                <p className="text-sm text-muted-foreground">Limits and safeguards</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
