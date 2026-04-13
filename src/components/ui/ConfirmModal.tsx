'use client'

import { useEffect, useRef } from 'react'
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

  useEffect(() => {
    if (open) {
      setTimeout(() => confirmRef.current?.focus(), 100)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onCancel])

  if (!open) return null

  const isDanger = variant === 'danger'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(15,23,42,0.50)', backdropFilter: 'blur(8px)', animation: 'backdropIn 0.15s ease' }}
        onClick={onCancel}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-md mx-4 rounded-2xl overflow-hidden animate-scale-in"
        style={{
          background: '#ffffff',
          boxShadow: '0 24px 80px rgba(15,23,42,0.18), 0 4px 16px rgba(15,23,42,0.08)',
        }}
      >
        {/* Accent strip */}
        <div style={{
          height: 3,
          background: isDanger
            ? 'linear-gradient(90deg, #dc2626, #f87171)'
            : 'linear-gradient(90deg, #4f46e5, #6366f1)',
        }} />

        <div className="p-6">
          {/* Close */}
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 p-1.5 rounded-lg transition-colors hover:bg-slate-100"
            style={{ color: '#9ca3af' }}
          >
            <X size={16} />
          </button>

          {/* Icon */}
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
            style={{
              background: isDanger ? '#fee2e2' : 'linear-gradient(135deg, #e0e7ff, #e0e7ff)',
              border: `1px solid ${isDanger ? '#fecaca' : '#c7d2fe'}`,
            }}
          >
            <Sparkles size={20} style={{ color: isDanger ? '#dc2626' : '#4f46e5' }} />
          </div>

          <h3 className="text-lg font-bold mb-1" style={{ color: '#111827' }}>
            {title}
          </h3>
          {description && (
            <p className="text-sm leading-relaxed" style={{ color: '#4b5563' }}>
              {description}
            </p>
          )}

          <div className="flex items-center justify-end gap-2.5 mt-6">
            <button
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:bg-slate-50 disabled:opacity-50"
              style={{ color: '#4b5563', border: '1px solid #e5e7eb' }}
            >
              {cancelLabel}
            </button>
            <button
              ref={confirmRef}
              onClick={onConfirm}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-60"
              style={{
                background: isDanger ? '#dc2626' : 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                color: '#ffffff',
                boxShadow: `0 4px 16px ${isDanger ? 'rgba(220,38,38,0.25)' : 'rgba(14,165,233,0.25)'}`,
              }}
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
