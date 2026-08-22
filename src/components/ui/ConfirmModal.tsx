'use client'

import { useEffect, useId, useRef } from 'react'
import { Loader2, X, Sparkles } from 'lucide-react'

interface ConfirmModalProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'danger'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    const focusTimer = window.setTimeout(() => confirmRef.current?.focus(), 80)

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
        return
      }
      if (e.key !== 'Tab') return

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]',
        ) ?? [],
      )
      const first = focusable[0]
      const last = focusable.at(-1)
      if (!first || !last) return

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handler)
    return () => {
      window.clearTimeout(focusTimer)
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handler)
      previouslyFocused?.focus()
    }
  }, [open, onCancel])

  if (!open) return null

  const isDanger = variant === 'danger'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" data-portal>
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(28,25,23,0.4)', backdropFilter: 'blur(8px)', animation: 'backdropIn 0.15s ease' }}
        onClick={onCancel}
      />

      {/* Modal */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md mx-4 overflow-hidden animate-scale-in"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--hairline)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-overlay)',
        }}
      >
        {/* Accent strip */}
        <div style={{
          height: 2,
          background: isDanger ? 'var(--bad)' : 'var(--accent)',
        }} />

        <div className="p-6">
          {/* Close */}
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close confirmation"
            className="absolute top-4 right-4 p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--ink-3)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--muted)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            <X size={16} />
          </button>

          {/* Icon */}
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
            style={{
              background: isDanger ? 'var(--bad-bg)' : 'var(--accent-bg)',
              border: `1px solid ${isDanger ? 'var(--bad-border)' : 'var(--accent-border)'}`,
            }}
          >
            <Sparkles size={20} style={{ color: isDanger ? 'var(--bad)' : 'var(--accent)' }} />
          </div>

          <h3 id={titleId} className="section-title text-lg mb-1" style={{ color: 'var(--ink)' }}>
            {title}
          </h3>
          {description && (
            <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-2)' }}>
              {description}
            </p>
          )}

          <div className="flex items-center justify-end gap-2.5 mt-6">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="btn btn-ghost"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              ref={confirmRef}
              onClick={onConfirm}
              disabled={loading}
              className={isDanger ? 'btn' : 'btn btn-accent'}
              style={isDanger ? { background: 'var(--bad)', color: '#fff' } : undefined}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  Processing...
                </span>
              ) : (
                confirmLabel
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
