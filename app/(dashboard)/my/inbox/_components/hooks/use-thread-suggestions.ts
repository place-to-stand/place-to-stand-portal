'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ThreadSummary } from '@/lib/types/messages'

type Suggestion = {
  clientId: string
  clientName: string
  confidence: number
  matchedContacts: string[]
  reasoning?: string
  matchType?: 'EXACT_EMAIL' | 'DOMAIN' | 'CONTENT' | 'CONTEXTUAL'
}

type ProjectSuggestion = {
  projectId: string
  projectName: string
  confidence: number
  reasoning?: string
  matchType?: 'NAME' | 'CONTENT' | 'CONTEXTUAL'
}

interface UseThreadSuggestionsOptions {
  selectedThread: ThreadSummary | null
}

interface UseThreadSuggestionsReturn {
  suggestions: Suggestion[]
  suggestionsLoading: boolean
  projectSuggestions: ProjectSuggestion[]
  projectSuggestionsLoading: boolean
  clearSuggestions: () => void
  clearProjectSuggestions: () => void
}

export function useThreadSuggestions({
  selectedThread,
}: UseThreadSuggestionsOptions): UseThreadSuggestionsReturn {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [projectSuggestions, setProjectSuggestions] = useState<ProjectSuggestion[]>([])
  const [projectSuggestionsLoading, setProjectSuggestionsLoading] = useState(false)

  // Load AI suggestions when thread changes and has no client
  useEffect(() => {
    if (!selectedThread || selectedThread.client) {
      setSuggestions([])
      return
    }

    setSuggestionsLoading(true)
    fetch(`/api/threads/${selectedThread.id}/suggestions`)
      .then(r => {
        if (!r.ok) throw new Error(`Suggestions fetch failed: ${r.status}`)
        return r.json()
      })
      .then(data => setSuggestions(data.suggestions || []))
      .catch(err => {
        console.error('Failed to load client suggestions:', err)
        setSuggestions([])
      })
      .finally(() => setSuggestionsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThread?.id, selectedThread?.client])

  // Load project suggestions when thread changes and has no project
  useEffect(() => {
    if (!selectedThread || selectedThread.project) {
      setProjectSuggestions([])
      return
    }

    setProjectSuggestionsLoading(true)
    fetch(`/api/threads/${selectedThread.id}/project-suggestions`)
      .then(r => {
        if (!r.ok) throw new Error(`Project suggestions fetch failed: ${r.status}`)
        return r.json()
      })
      .then(data => setProjectSuggestions(data.suggestions || []))
      .catch(err => {
        console.error('Failed to load project suggestions:', err)
        setProjectSuggestions([])
      })
      .finally(() => setProjectSuggestionsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThread?.id, selectedThread?.project])

  const clearSuggestions = useCallback(() => {
    setSuggestions([])
  }, [])

  const clearProjectSuggestions = useCallback(() => {
    setProjectSuggestions([])
  }, [])

  return {
    suggestions,
    suggestionsLoading,
    projectSuggestions,
    projectSuggestionsLoading,
    clearSuggestions,
    clearProjectSuggestions,
  }
}

export type { Suggestion, ProjectSuggestion }
