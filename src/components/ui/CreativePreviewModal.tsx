'use client'

import { useEffect, useId, useRef } from 'react'
import Link from 'next/link'
import { X, Image as ImageIcon, Video as VideoIcon, ExternalLink, Loader2 } from 'lucide-react'

interface CreativePreviewModalProps {
  open: boolean
  onClose: () => void
  mediaUrl: string
  mediaType: 'image' | 'video'
  headline?: string
  primaryText?: string
  cta?: string
  /** Small line above the headline — e.g. "Nadi Report · hindi" or "Variant 2 · image". */
  meta?: string
  /** Link target for "View full details" — omit to hide the link entirely. */
  tenantId?: string
  packageId?: string
  loading?: boolean
}

/**
 * Read-only quick-look lightbox for a single creative asset (image or
 * video) — bigger media + whatever copy is available, with a link out to
 * the full package page for actual editing. Deliberately does not
 * duplicate edit/reject/move actions from the package detail page — this
 * is a "look closer without leaving the grid" popup, not a second place to
 * manage the creative.
 */
export function CreativePreviewModal({
  open,
  onClose,
  mediaUrl,
  mediaType,
  headline,
  primaryText,
  cta,
  meta,
  tenantId,
  packageId,
  loading = false,
}: CreativePreviewModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  const titleId = useId()

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 80)
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], video[controls], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      )
      const first = focusable[0]
      const last = focusable.at(-1)
      if (!first || !last) return

      if (!dialogRef.current?.contains(document.activeElement)) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && document.activeElement === first) {
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
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" data-portal>
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(28,25,23,0.5)', backdropFilter: 'blur(8px)', animation: 'backdropIn 0.15s ease' }}
        onClick={() => onCloseRef.current()}
        aria-hidden="true"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-2xl mx-4 overflow-hidden animate-scale-in"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--hairline)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-overlay)',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <h2 id={titleId} className="sr-only">
          {headline ? `Creative preview: ${headline}` : `${mediaType === 'video' ? 'Video' : 'Image'} creative preview`}
        </h2>
        <button
          ref={closeRef}
          type="button"
          onClick={() => onCloseRef.current()}
          aria-label="Close creative preview"
          className="absolute top-3 right-3 p-1.5 rounded-lg z-10"
          style={{ background: 'rgba(255,255,255,0.85)', color: 'var(--ink-2)' }}
        >
          <X size={16} />
        </button>

        <div className="overflow-y-auto">
          <div className="relative flex items-center justify-center" style={{ background: 'var(--surface-warm)', maxHeight: '60vh' }}>
            {loading ? (
              <div className="flex items-center justify-center" style={{ aspectRatio: '4/5', width: '100%' }}>
                <Loader2 size={24} className="animate-spin" style={{ color: 'var(--ink-4)' }} />
              </div>
            ) : mediaType === 'video' ? (
              <video src={mediaUrl} controls autoPlay className="w-full" style={{ maxHeight: '60vh', objectFit: 'contain' }} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl} alt={headline ?? 'Creative preview'} className="w-full" style={{ maxHeight: '60vh', objectFit: 'contain' }} />
            )}
          </div>

          <div className="p-6">
            {meta && (
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--ink-3)' }}>
                {mediaType === 'video' ? <VideoIcon size={11} /> : <ImageIcon size={11} />}
                {meta}
              </p>
            )}
            {headline && (
              <p className="text-[16px] font-semibold mb-2" style={{ color: 'var(--ink)' }}>{headline}</p>
            )}
            {primaryText && (
              <p className="text-[13px] leading-relaxed whitespace-pre-wrap mb-2" style={{ color: 'var(--ink-2)' }}>{primaryText}</p>
            )}
            {cta && (
              <p className="text-[12px] mb-4" style={{ color: 'var(--ink-3)' }}>CTA: {cta}</p>
            )}
            {tenantId && packageId && (
              <Link
                href={`/dashboard/${tenantId}/creatives/${packageId}`}
                className="text-[13px] font-medium inline-flex items-center gap-1"
                style={{ color: 'var(--accent-strong)' }}
              >
                View full details <ExternalLink size={12} />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
