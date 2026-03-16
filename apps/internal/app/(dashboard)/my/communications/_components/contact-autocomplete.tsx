'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { X, User, Building, Mail } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type ContactResult = {
  email: string
  name: string | null
  source: 'contact' | 'lead' | 'thread'
}

interface ContactAutocompleteProps {
  value: string[]
  onChange: (emails: string[]) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function ContactAutocomplete({
  value,
  onChange,
  placeholder = 'Add recipients...',
  disabled = false,
  className,
}: ContactAutocompleteProps) {
  const [inputValue, setInputValue] = useState('')
  const [suggestions, setSuggestions] = useState<ContactResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const searchContacts = useCallback(
    async (query: string) => {
      // Clear any pending search
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      if (query.length < 2) {
        setSuggestions([])
        setShowSuggestions(false)
        return
      }

      // Debounce the search
      debounceRef.current = setTimeout(async () => {
        setIsLoading(true)
        try {
          const res = await fetch(
            `/api/contacts/search?q=${encodeURIComponent(query)}&limit=8`
          )
          if (res.ok) {
            const data = await res.json()
            // Filter out already selected emails
            const filtered = (data.results || []).filter(
              (r: ContactResult) =>
                !value.some(v => v.toLowerCase() === r.email.toLowerCase())
            )
            setSuggestions(filtered)
            setShowSuggestions(filtered.length > 0)
            setHighlightedIndex(-1)
          }
        } catch (err) {
          console.error('Contact search failed:', err)
        } finally {
          setIsLoading(false)
        }
      }, 300)
    },
    [value]
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setInputValue(val)
    searchContacts(val)
  }

  const addEmail = useCallback(
    (email: string) => {
      const trimmed = email.trim().toLowerCase()
      if (trimmed && trimmed.includes('@') && !value.includes(trimmed)) {
        onChange([...value, trimmed])
      }
      setInputValue('')
      setSuggestions([])
      setShowSuggestions(false)
      inputRef.current?.focus()
    },
    [value, onChange]
  )

  const removeEmail = useCallback(
    (email: string) => {
      onChange(value.filter(v => v !== email))
    },
    [value, onChange]
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        addEmail(suggestions[highlightedIndex].email)
      } else if (inputValue.trim()) {
        addEmail(inputValue)
      }
    } else if (e.key === 'Tab' && inputValue.trim()) {
      e.preventDefault()
      if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        addEmail(suggestions[highlightedIndex].email)
      } else {
        addEmail(inputValue)
      }
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      removeEmail(value[value.length - 1])
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex(prev =>
        prev < suggestions.length - 1 ? prev + 1 : prev
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : -1))
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    } else if (e.key === ',' || e.key === ';') {
      e.preventDefault()
      if (inputValue.trim()) {
        addEmail(inputValue)
      }
    }
  }

  const handleSuggestionClick = (result: ContactResult) => {
    addEmail(result.email)
  }

  const getSourceIcon = (source: ContactResult['source']) => {
    switch (source) {
      case 'contact':
        return <User className='h-3 w-3' />
      case 'lead':
        return <Building className='h-3 w-3' />
      case 'thread':
        return <Mail className='h-3 w-3' />
    }
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div
        className={cn(
          'border-input bg-background ring-offset-background flex min-h-10 flex-wrap items-center gap-1 rounded-md border px-3 py-2',
          'focus-within:ring-ring focus-within:ring-2 focus-within:ring-offset-2',
          disabled && 'cursor-not-allowed opacity-50'
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {/* Selected emails as badges */}
        {value.map(email => (
          <Badge
            key={email}
            variant='secondary'
            className='gap-1 py-0.5 pr-1 text-xs'
          >
            {email}
            <button
              type='button'
              onClick={e => {
                e.stopPropagation()
                removeEmail(email)
              }}
              className='hover:bg-muted ml-1 rounded-full p-0.5'
              disabled={disabled}
            >
              <X className='h-3 w-3' />
            </button>
          </Badge>
        ))}

        {/* Input field */}
        <input
          ref={inputRef}
          type='text'
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setShowSuggestions(true)
          }}
          placeholder={value.length === 0 ? placeholder : ''}
          disabled={disabled}
          className='placeholder:text-muted-foreground min-w-[120px] flex-1 bg-transparent text-sm outline-none'
        />
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className='bg-popover text-popover-foreground absolute top-full z-50 mt-1 w-full rounded-md border shadow-md'>
          <ul className='max-h-60 overflow-auto p-1'>
            {suggestions.map((result, index) => (
              <li
                key={result.email}
                onClick={() => handleSuggestionClick(result)}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
                  highlightedIndex === index
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <span className='text-muted-foreground'>
                  {getSourceIcon(result.source)}
                </span>
                <div className='min-w-0 flex-1'>
                  {result.name && (
                    <div className='truncate font-medium'>{result.name}</div>
                  )}
                  <div
                    className={cn(
                      'truncate',
                      result.name ? 'text-muted-foreground text-xs' : ''
                    )}
                  >
                    {result.email}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className='text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 text-xs'>
          Searching...
        </div>
      )}
    </div>
  )
}
