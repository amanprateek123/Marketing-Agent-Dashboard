'use client'

import { useEffect } from 'react'
import { X, AlertCircle, Video } from 'lucide-react'
import type { CampaignAd } from '@/types'

interface AdMediaModalProps {
  tenantId: string
  ad: CampaignAd | null
  onClose: () => void
}

/**
 * Click-to-view lightbox for an ad's creative — shows the synced
 * thumbnail_url at full size for both image and video ads. Video ads only
 * ever carry a poster-frame thumbnail (Meta rejects direct playable-file
 * access for ad-uploaded videos with a permission error), so this
 * deliberately doesn't attempt playback — just a clear, large view of the
 * thumbnail with a "Video ad" label.
 */
export function AdMediaModal({ ad, onClose }: AdMediaModalProps) {
  useEffect(() => {
    if (!ad) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [ad, onClose])

  if (!ad) return null

  const isVideo = !!ad.creativeVideoId

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(20,18,15,0.7)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
      />

      <div
        className="relative w-full max-w-2xl overflow-hidden animate-scale-in"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--hairline)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-overlay)',
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-lg"
          style={{ color: '#fff', background: 'rgba(0,0,0,0.45)' }}
        >
          <X size={16} />
        </button>

        {isVideo && (
          <div
            className="absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-md"
            style={{ color: '#fff', background: 'rgba(0,0,0,0.45)' }}
          >
            <Video size={11} /> Video ad — thumbnail only
          </div>
        )}

        <div className="flex items-center justify-center" style={{ background: '#000', minHeight: 280 }}>
          {ad.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ad.thumbnailUrl}
              alt={ad.name || 'Ad creative'}
              className="w-full"
              style={{ maxHeight: '70vh', objectFit: 'contain', display: 'block' }}
            />
          ) : (
            <div className="flex flex-col items-center gap-3 py-16" style={{ color: 'rgba(255,255,255,0.7)' }}>
              <AlertCircle size={20} />
              <span className="text-xs">No creative image available for this ad.</span>
            </div>
          )}
        </div>

        <div className="p-4">
          <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{ad.name || 'Untitled ad'}</p>
          {(ad.creativeTitle || ad.creativeBody) && (
            <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--ink-2)' }}>
              {ad.creativeTitle && <span className="font-semibold">{ad.creativeTitle}. </span>}
              {ad.creativeBody}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
