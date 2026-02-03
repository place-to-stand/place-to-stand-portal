'use client'

import { useState, useCallback, Dispatch, SetStateAction } from 'react'
import type { ThreadSummary } from '@/lib/types/messages'

type Client = {
  id: string
  name: string
  slug: string | null
}

type Project = {
  id: string
  name: string
  slug: string | null
  clientSlug: string | null
}

type Lead = {
  id: string
  contactName: string
}

interface UseThreadLinkingOptions {
  selectedThread: ThreadSummary | null
  setSelectedThread: Dispatch<SetStateAction<ThreadSummary | null>>
  setThreads: Dispatch<SetStateAction<ThreadSummary[]>>
  clients: Client[]
  projects: Project[]
  leads?: Lead[]
  onLinkComplete?: (threadId: string) => void
  onClientLinked?: () => void
  onProjectLinked?: () => void
  onLeadLinked?: () => void
  toast: (options: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void
}

interface UseThreadLinkingReturn {
  isLinking: boolean
  isLinkingProject: boolean
  isLinkingLead: boolean
  handleLinkClient: (clientId: string) => Promise<void>
  handleUnlinkClient: () => Promise<void>
  handleLinkProject: (projectId: string) => Promise<void>
  handleUnlinkProject: () => Promise<void>
  handleLinkLead: (leadId: string) => Promise<void>
  handleUnlinkLead: () => Promise<void>
}

export function useThreadLinking({
  selectedThread,
  setSelectedThread,
  setThreads,
  clients,
  projects,
  leads = [],
  onLinkComplete,
  onClientLinked,
  onProjectLinked,
  onLeadLinked,
  toast,
}: UseThreadLinkingOptions): UseThreadLinkingReturn {
  const [isLinking, setIsLinking] = useState(false)
  const [isLinkingProject, setIsLinkingProject] = useState(false)
  const [isLinkingLead, setIsLinkingLead] = useState(false)

  const handleLinkClient = useCallback(
    async (clientId: string) => {
      if (!selectedThread) return

      setIsLinking(true)
      try {
        const res = await fetch(`/api/threads/${selectedThread.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId }),
        })

        if (res.ok) {
          const client = clients.find(c => c.id === clientId)

          // Update local state
          const updatedThread: ThreadSummary = {
            ...selectedThread,
            client: client
              ? { id: client.id, name: client.name, slug: client.slug }
              : null,
          }
          setSelectedThread(updatedThread)
          setThreads(prev =>
            prev.map(t => (t.id === selectedThread.id ? updatedThread : t))
          )
          onClientLinked?.()

          toast({ title: 'Thread linked to client' })

          // Auto-trigger analysis if both client and project are now linked
          if (updatedThread.project && onLinkComplete) {
            onLinkComplete(selectedThread.id)
          }
        } else {
          throw new Error('Failed to link')
        }
      } catch {
        toast({
          title: 'Error',
          description: 'Failed to link thread.',
          variant: 'destructive',
        })
      } finally {
        setIsLinking(false)
      }
    },
    [selectedThread, clients, setSelectedThread, setThreads, onLinkComplete, onClientLinked, toast]
  )

  const handleUnlinkClient = useCallback(async () => {
    if (!selectedThread) return

    setIsLinking(true)
    try {
      const res = await fetch(`/api/threads/${selectedThread.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: null }),
      })

      if (res.ok) {
        const updatedThread: ThreadSummary = {
          ...selectedThread,
          client: null,
        }
        setSelectedThread(updatedThread)
        setThreads(prev =>
          prev.map(t => (t.id === selectedThread.id ? updatedThread : t))
        )

        toast({ title: 'Client unlinked' })
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to unlink.',
        variant: 'destructive',
      })
    } finally {
      setIsLinking(false)
    }
  }, [selectedThread, setSelectedThread, setThreads, toast])

  const handleLinkProject = useCallback(
    async (projectId: string) => {
      if (!selectedThread) return

      setIsLinkingProject(true)
      try {
        const res = await fetch(`/api/threads/${selectedThread.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId }),
        })

        if (res.ok) {
          const project = projects.find(p => p.id === projectId)

          // Update local state
          const updatedThread: ThreadSummary = {
            ...selectedThread,
            project: project
              ? {
                  id: project.id,
                  name: project.name,
                  slug: project.slug,
                  clientSlug: project.clientSlug,
                }
              : null,
          }
          setSelectedThread(updatedThread)
          setThreads(prev =>
            prev.map(t => (t.id === selectedThread.id ? updatedThread : t))
          )
          onProjectLinked?.()

          toast({ title: 'Thread linked to project' })

          // Auto-trigger analysis if both client and project are now linked
          if (updatedThread.client && onLinkComplete) {
            onLinkComplete(selectedThread.id)
          }
        } else {
          throw new Error('Failed to link')
        }
      } catch {
        toast({
          title: 'Error',
          description: 'Failed to link thread to project.',
          variant: 'destructive',
        })
      } finally {
        setIsLinkingProject(false)
      }
    },
    [selectedThread, projects, setSelectedThread, setThreads, onLinkComplete, onProjectLinked, toast]
  )

  const handleUnlinkProject = useCallback(async () => {
    if (!selectedThread) return

    setIsLinkingProject(true)
    try {
      const res = await fetch(`/api/threads/${selectedThread.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: null }),
      })

      if (res.ok) {
        const updatedThread: ThreadSummary = {
          ...selectedThread,
          project: null,
        }
        setSelectedThread(updatedThread)
        setThreads(prev =>
          prev.map(t => (t.id === selectedThread.id ? updatedThread : t))
        )

        toast({ title: 'Project unlinked' })
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to unlink project.',
        variant: 'destructive',
      })
    } finally {
      setIsLinkingProject(false)
    }
  }, [selectedThread, setSelectedThread, setThreads, toast])

  const handleLinkLead = useCallback(
    async (leadId: string) => {
      if (!selectedThread) return

      setIsLinkingLead(true)
      try {
        const res = await fetch(`/api/threads/${selectedThread.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadId }),
        })

        if (res.ok) {
          const lead = leads.find(l => l.id === leadId)

          // Update local state
          const updatedThread: ThreadSummary = {
            ...selectedThread,
            lead: lead
              ? { id: lead.id, contactName: lead.contactName }
              : null,
          }
          setSelectedThread(updatedThread)
          setThreads(prev =>
            prev.map(t => (t.id === selectedThread.id ? updatedThread : t))
          )
          onLeadLinked?.()

          toast({ title: 'Thread linked to lead' })
        } else {
          throw new Error('Failed to link')
        }
      } catch {
        toast({
          title: 'Error',
          description: 'Failed to link thread to lead.',
          variant: 'destructive',
        })
      } finally {
        setIsLinkingLead(false)
      }
    },
    [selectedThread, leads, setSelectedThread, setThreads, onLeadLinked, toast]
  )

  const handleUnlinkLead = useCallback(async () => {
    if (!selectedThread) return

    setIsLinkingLead(true)
    try {
      const res = await fetch(`/api/threads/${selectedThread.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: null }),
      })

      if (res.ok) {
        const updatedThread: ThreadSummary = {
          ...selectedThread,
          lead: null,
        }
        setSelectedThread(updatedThread)
        setThreads(prev =>
          prev.map(t => (t.id === selectedThread.id ? updatedThread : t))
        )

        toast({ title: 'Lead unlinked' })
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to unlink lead.',
        variant: 'destructive',
      })
    } finally {
      setIsLinkingLead(false)
    }
  }, [selectedThread, setSelectedThread, setThreads, toast])

  return {
    isLinking,
    isLinkingProject,
    isLinkingLead,
    handleLinkClient,
    handleUnlinkClient,
    handleLinkProject,
    handleUnlinkProject,
    handleLinkLead,
    handleUnlinkLead,
  }
}
