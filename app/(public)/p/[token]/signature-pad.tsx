'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import SignaturePadLib from 'signature_pad'
import { Eraser, PenLine, Type, Undo2 } from 'lucide-react'

import { Button } from '@/components/ui/button'

type SignaturePadProps = {
  onChange: (dataUrl: string | null) => void
  /** Name to render as typed signature preview */
  typedName?: string
}

type Mode = 'draw' | 'type'

const FONT_FAMILIES = [
  { label: 'Script', value: "'Dancing Script', cursive" },
  { label: 'Elegant', value: "'Great Vibes', cursive" },
  { label: 'Casual', value: "'Caveat', cursive" },
]

const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&family=Dancing+Script:wght@400;700&family=Great+Vibes&display=swap'

export function SignaturePad({ onChange, typedName = '' }: SignaturePadProps) {
  const [mode, setMode] = useState<Mode>('type')
  const [selectedFont, setSelectedFont] = useState(0)

  // Ensure Google Fonts are loaded
  useEffect(() => {
    if (document.querySelector(`link[href="${GOOGLE_FONTS_URL}"]`)) return
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = GOOGLE_FONTS_URL
    document.head.appendChild(link)
  }, [])

  const handleDrawChange = useCallback(
    (dataUrl: string | null) => {
      if (mode === 'draw') onChange(dataUrl)
    },
    [mode, onChange]
  )

  const handleModeChange = useCallback(
    (next: Mode) => {
      setMode(next)
      // Clear the output when switching modes so stale data doesn't persist
      onChange(null)
    },
    [onChange]
  )

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <div className="flex gap-1 rounded-md bg-muted/60 p-1">
        <button
          type="button"
          onClick={() => handleModeChange('type')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === 'type'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Type className="h-3.5 w-3.5" />
          Type
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('draw')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === 'draw'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <PenLine className="h-3.5 w-3.5" />
          Draw
        </button>
      </div>

      {mode === 'type' ? (
        <TypedSignature
          name={typedName}
          fontFamily={FONT_FAMILIES[selectedFont].value}
          selectedFont={selectedFont}
          onFontChange={setSelectedFont}
          onChange={onChange}
        />
      ) : (
        <DrawnSignature onChange={handleDrawChange} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Typed signature
// ---------------------------------------------------------------------------

type TypedSignatureProps = {
  name: string
  fontFamily: string
  selectedFont: number
  onFontChange: (index: number) => void
  onChange: (dataUrl: string | null) => void
}

function TypedSignature({
  name,
  fontFamily,
  selectedFont,
  onFontChange,
  onChange,
}: TypedSignatureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Render typed name onto a hidden canvas and emit the data URL
  useEffect(() => {
    const trimmed = name.trim()
    if (!trimmed) {
      onChange(null)
      return
    }

    // Small delay to let font load on first render
    const timer = setTimeout(() => {
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const ratio = Math.max(window.devicePixelRatio ?? 1, 1)
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      canvas.width = w * ratio
      canvas.height = h * ratio
      ctx.scale(ratio, ratio)

      // White background
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)

      // Render text
      const fontSize = Math.min(48, Math.max(24, w / (trimmed.length * 0.6)))
      ctx.font = `${fontSize}px ${fontFamily}`
      ctx.fillStyle = '#000000'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(trimmed, w / 2, h / 2)

      onChange(canvas.toDataURL('image/png'))
    }, 100)

    return () => clearTimeout(timer)
  }, [name, fontFamily, onChange])

  return (
    <div className="space-y-3">
      {/* Preview */}
      <div className="relative flex h-40 items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/30 bg-white">
        {name.trim() ? (
          <span
            className="select-none text-4xl text-black sm:text-5xl"
            style={{ fontFamily }}
          >
            {name.trim()}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground/50">
            Type your name above to preview
          </span>
        )}
        {/* Hidden canvas for PNG export */}
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        />
      </div>

      {/* Font picker */}
      <div className="flex gap-2">
        {FONT_FAMILIES.map((font, i) => (
          <button
            key={font.label}
            type="button"
            onClick={() => onFontChange(i)}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              selectedFont === i
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border text-muted-foreground hover:border-primary/50'
            }`}
            style={{ fontFamily: font.value }}
          >
            {font.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Drawn signature (existing canvas pad)
// ---------------------------------------------------------------------------

type DrawnSignatureProps = {
  onChange: (dataUrl: string | null) => void
}

function DrawnSignature({ onChange }: DrawnSignatureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePadLib | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const pad = new SignaturePadLib(canvas, {
      backgroundColor: 'rgb(255, 255, 255)',
      penColor: 'rgb(0, 0, 0)',
    })

    pad.addEventListener('endStroke', () => {
      onChange(pad.isEmpty() ? null : pad.toDataURL('image/png'))
    })

    padRef.current = pad

    function resize() {
      const el = canvasRef.current
      if (!el) return
      const ratio = Math.max(window.devicePixelRatio ?? 1, 1)
      const data = pad.toData()
      el.width = el.offsetWidth * ratio
      el.height = el.offsetHeight * ratio
      el.getContext('2d')?.scale(ratio, ratio)
      pad.clear()
      if (data.length > 0) {
        pad.fromData(data)
      }
      onChange(pad.isEmpty() ? null : pad.toDataURL('image/png'))
    }

    resize()
    window.addEventListener('resize', resize)

    return () => {
      window.removeEventListener('resize', resize)
      pad.off()
    }
  }, [onChange])

  const handleClear = useCallback(() => {
    padRef.current?.clear()
    onChange(null)
  }, [onChange])

  const handleUndo = useCallback(() => {
    const pad = padRef.current
    if (!pad) return
    const data = pad.toData()
    if (data.length > 0) {
      data.pop()
      pad.fromData(data)
      onChange(pad.isEmpty() ? null : pad.toDataURL('image/png'))
    }
  }, [onChange])

  return (
    <div className="space-y-2">
      <div className="relative rounded-md border-2 border-dashed border-muted-foreground/30 bg-white">
        <canvas
          ref={canvasRef}
          className="h-40 w-full cursor-crosshair rounded-md"
        />
        <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-muted-foreground/50">
          Sign above
        </span>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleUndo}
          className="gap-1.5 text-xs"
        >
          <Undo2 className="h-3.5 w-3.5" />
          Undo
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="gap-1.5 text-xs"
        >
          <Eraser className="h-3.5 w-3.5" />
          Clear
        </Button>
      </div>
    </div>
  )
}
