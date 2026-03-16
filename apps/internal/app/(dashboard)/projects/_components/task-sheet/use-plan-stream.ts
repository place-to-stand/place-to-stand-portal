'use client'

import { useCallback, useRef, useState } from 'react'

export type ContentType = 'unknown' | 'questions' | 'plan'

const QUESTIONS_HEADING = '## Clarifying Questions'

export function detectContentType(content: string): ContentType {
  if (!content.trim()) return 'unknown'
  const trimmed = content.trimStart()
  if (trimmed.startsWith(QUESTIONS_HEADING)) return 'questions'
  // Once we have enough content and it's not questions, it's a plan
  if (trimmed.length > 50) return 'plan'
  return 'unknown'
}

type StreamState = {
  content: string
  contentType: ContentType
  isGenerating: boolean
  toolCalls: string[]
  error: string | null
}

type GenerateParams = {
  threadId: string
  repoLinkId: string
  taskTitle: string
  taskDescription: string | null
  model: string
  currentVersion: number
  feedback?: string
}

export function usePlanStream() {
  const [state, setState] = useState<StreamState>({
    content: '',
    contentType: 'unknown',
    isGenerating: false,
    toolCalls: [],
    error: null,
  })

  const abortRef = useRef<AbortController | null>(null)

  const generate = useCallback(async (params: GenerateParams) => {
    // Cancel any existing generation
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setState({
      content: '',
      contentType: 'unknown',
      isGenerating: true,
      toolCalls: [],
      error: null,
    })

    try {
      const response = await fetch('/api/planning/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorText = await response.text()
        setState(prev => ({ ...prev, isGenerating: false, error: errorText }))
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        setState(prev => ({ ...prev, isGenerating: false, error: 'No response body' }))
        return
      }

      const decoder = new TextDecoder()
      let fullContent = ''
      let sseBuffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        sseBuffer += decoder.decode(value, { stream: true })

        // Parse SSE events: each is "data: {...}\n\n"
        const events = sseBuffer.split('\n\n')
        // Keep the last incomplete chunk in the buffer
        sseBuffer = events.pop() ?? ''

        for (const event of events) {
          const trimmed = event.trim()
          if (!trimmed) continue

          // Extract the data payload after "data: "
          if (!trimmed.startsWith('data: ')) continue
          const payload = trimmed.slice(6)

          // [DONE] signals end of stream
          if (payload === '[DONE]') continue

          let part: { type: string; [key: string]: unknown }
          try {
            part = JSON.parse(payload)
          } catch {
            // Ignore malformed chunks
            continue
          }

          switch (part.type) {
            case 'text-delta': {
              const delta = part.delta as string
              fullContent += delta
              const ct = detectContentType(fullContent)
              setState(prev => ({
                ...prev,
                content: fullContent,
                contentType: ct,
              }))
              break
            }

            case 'tool-input-start': {
              const toolName = part.toolName as string
              const label =
                toolName === 'read_file'
                  ? 'Reading file...'
                  : 'Listing directory...'
              setState(prev => ({
                ...prev,
                toolCalls: [...prev.toolCalls, label],
              }))
              break
            }

            case 'tool-input-available': {
              // Update the last tool call label with the resolved input
              const name = part.toolName as string
              const input = part.input as Record<string, string> | undefined
              const path = input?.path
              if (path) {
                const label =
                  name === 'read_file'
                    ? `Reading ${path}...`
                    : `Listing ${path}...`
                setState(prev => {
                  const calls = [...prev.toolCalls]
                  // Replace the last generic label for this tool
                  const lastIdx = calls.length - 1
                  if (lastIdx >= 0) calls[lastIdx] = label
                  return { ...prev, toolCalls: calls }
                })
              }
              break
            }

            case 'error': {
              const errorText = part.errorText as string
              setState(prev => ({
                ...prev,
                error: errorText ?? 'Stream error',
              }))
              break
            }

            case 'finish': {
              // Stream is done — finishReason available if needed
              break
            }

            // reasoning-start, reasoning-delta, reasoning-end, start-step, finish-step,
            // tool-output-available, text-start, text-end, start, abort — handled silently
            default:
              break
          }
        }
      }

      setState(prev => ({ ...prev, isGenerating: false }))
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        // User cancelled — not an error
        setState(prev => ({ ...prev, isGenerating: false }))
        return
      }
      setState(prev => ({
        ...prev,
        isGenerating: false,
        error: error instanceof Error ? error.message : 'Generation failed',
      }))
    }
  }, [])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    setState(prev => ({ ...prev, isGenerating: false }))
  }, [])

  return {
    content: state.content,
    contentType: state.contentType,
    isGenerating: state.isGenerating,
    toolCalls: state.toolCalls,
    error: state.error,
    generate,
    cancel,
  }
}
