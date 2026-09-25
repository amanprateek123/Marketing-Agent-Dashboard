'use client'

import { useEffect } from 'react'
import { Image as ImageIcon, X } from 'lucide-react'
import type { CustomBriefChoice } from '@/types'

/**
 * Asks what the pipeline should DO with a just-attached reference image.
 *
 * Slack asks this the same way — an upload posts a message with three buttons — but it can afford a
 * second turn. This form cannot, so the question has to be answered before the run is submitted or
 * the API rejects it. Popping it the moment a file is chosen keeps that as one continuous gesture
 * rather than a rule the operator discovers when Generate stays disabled.
 *
 * There is deliberately no "Cancel and keep the file" path: an attached image with no direction is
 * not a state the pipeline accepts, so dismissing clears the attachment instead of leaving the form
 * in something that cannot be submitted.
 *
 * Follows ui/ConfirmModal's conventions (z-[60], blurred backdrop, accent strip, Escape to close)
 * so it reads as part of the same product.
 */
export function ImageDirectionModal({
  open,
  fileNames,
  directions,
  selected,
  onChoose,
  onDismiss,
}: {
  open: boolean
  fileNames: string[]
  /** From GET /v1/options -> image_directions, so the pipeline owns the wording and the values. */
  directions: CustomBriefChoice[]
  selected: string
  onChoose: (value: string) => void
  /** Called when the operator backs out — the caller drops the attachment. */
  onDismiss: () => void
}) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onDismiss() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onDismiss])

  if (!open) return null

  const label = fileNames.length === 1
    ? fileNames[0]
    : `${fileNames.length} images`

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(28,25,23,0.4)', backdropFilter: 'blur(8px)', animation: 'backdropIn 0.15s ease' }}
        onClick={onDismiss}
      />

      <div
        className="relative w-full max-w-lg mx-4 overflow-hidden animate-scale-in"
        role="dialog"
        aria-modal="true"
        aria-label="What should we do with this image?"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--hairline)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-overlay)',
        }}
      >
        <div style={{ height: 2, background: 'var(--accent)' }} />

        <div className="p-6">
          <button
            onClick={onDismiss}
            className="absolute top-4 right-4 p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--ink-3)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--muted)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            aria-label="Remove the image"
          >
            <X size={16} />
          </button>

          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
            style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)' }}
          >
            <ImageIcon size={20} style={{ color: 'var(--accent)' }} />
          </div>

          <h3 className="font-display text-lg mb-1" style={{ color: 'var(--ink)' }}>
            What should we do with this image?
          </h3>
          <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--ink-2)' }}>
            <span className="text-[12.5px] font-medium break-all">{label}</span> — pick one so we know
            whether to place it, learn from it, or copy its look.
          </p>

          <div className="space-y-2">
            {directions.map(d => {
              const active = selected === d.value
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => onChoose(d.value)}
                  className="w-full text-left px-4 py-3 rounded-lg border transition-colors"
                  style={{
                    borderColor: active ? 'var(--accent-strong)' : 'var(--hairline)',
                    background: active ? 'var(--accent-bg)' : 'var(--surface)',
                  }}
                >
                  <span
                    className="block text-[13.5px] font-semibold"
                    style={{ color: active ? 'var(--accent-strong)' : 'var(--ink)' }}
                  >
                    {d.label}
                  </span>
                  {d.hint && (
                    <span className="block text-[11.5px] mt-0.5 leading-snug" style={{ color: 'var(--ink-4)' }}>
                      {d.hint}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <p className="text-[11.5px] mt-4" style={{ color: 'var(--ink-4)' }}>
            Closing this removes the image — we can&apos;t use it without knowing what it&apos;s for.
          </p>
        </div>
      </div>
    </div>
  )
}
