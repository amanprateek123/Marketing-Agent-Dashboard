'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Image as ImageIcon, Video as VideoIcon, Check, Loader2, Search, Upload as UploadIcon, LayoutGrid } from 'lucide-react'
import { listCreativePackages, addExistingCreativesToSheet } from '@/lib/api'
import type { CreativePackage } from '@/types'
import { CreativeUploadForm } from './CreativeUploadForm'

interface PickableAsset {
  key: string
  packageId: string
  assetType: 'image' | 'video' | 'carousel_card'
  variantIndex: number
  assetUrl: string
  headline?: string
  productName?: string
}

function flattenPackage(pkg: CreativePackage): PickableAsset[] {
  const items: PickableAsset[] = []
  for (const img of pkg.images ?? []) {
    if (!img.imageUrl) continue
    const variant = pkg.copyVariants?.[img.variantIndex ?? 0]
    items.push({
      key: `${pkg._id}-image-${img.variantIndex}`,
      packageId: pkg._id!,
      assetType: 'image',
      variantIndex: img.variantIndex ?? 0,
      assetUrl: img.imageUrl,
      headline: variant?.headline,
      productName: pkg.productName,
    })
  }
  if (pkg.video?.videoUrl) {
    const variant = pkg.copyVariants?.[pkg.selectedCopyIndex ?? 0]
    items.push({
      key: `${pkg._id}-video-0`,
      packageId: pkg._id!,
      assetType: 'video',
      variantIndex: 0,
      assetUrl: pkg.video.videoUrl,
      headline: variant?.headline,
      productName: pkg.productName,
    })
  }
  for (const card of pkg.carouselCards ?? []) {
    if (!card.imageUrl) continue
    items.push({
      key: `${pkg._id}-carousel_card-${card.slotIndex}`,
      packageId: pkg._id!,
      assetType: 'carousel_card',
      variantIndex: card.slotIndex,
      assetUrl: card.imageUrl,
      headline: card.headline,
      productName: pkg.productName,
    })
  }
  return items
}

interface AddCreativeSheetProps {
  open: boolean
  onClose: () => void
  tenantId: string
  products: { name: string }[]
  targetSheetId: string
  targetSheetName: string
  targetTopicName?: string
  onAdded: () => void
}

/**
 * Bottom sheet for filing creatives into a Gallery sheet — the two ways to
 * add something: pick from everything already in the Creatives library
 * (default), or upload a brand new one (paste URL, same form used
 * elsewhere). Picking works even for packages that predate the Gallery
 * feature or never got auto-populated (no existing GalleryAsset pointer) —
 * the backend creates one on the fly.
 */
export function AddCreativeSheet({
  open, onClose, tenantId, products, targetSheetId, targetSheetName, targetTopicName, onAdded,
}: AddCreativeSheetProps) {
  const [mode, setMode] = useState<'existing' | 'upload'>('existing')
  const [packages, setPackages] = useState<CreativePackage[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setMode('existing')
    setSelected(new Set())
    setSearch('')
    setError('')
    setLoading(true)
    listCreativePackages(tenantId)
      .then(setPackages)
      .catch(() => setError("We couldn't load your creatives. Try again."))
      .finally(() => setLoading(false))
  }, [open, tenantId])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  const allAssets = useMemo(() => packages.flatMap(flattenPackage), [packages])
  const filteredAssets = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allAssets
    return allAssets.filter(a =>
      a.headline?.toLowerCase().includes(q) || a.productName?.toLowerCase().includes(q),
    )
  }, [allAssets, search])

  function toggleSelect(key: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleAddSelected() {
    if (selected.size === 0) return
    setAdding(true)
    setError('')
    try {
      const items = allAssets
        .filter(a => selected.has(a.key))
        .map(a => ({ packageId: a.packageId, assetType: a.assetType, variantIndex: a.variantIndex }))
      await addExistingCreativesToSheet(tenantId, targetSheetId, items)
      setSelected(new Set())
      onAdded()
      onClose()
    } catch {
      setError("We couldn't add the creatives you picked. Try again.")
    } finally {
      setAdding(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(28,25,23,0.5)', backdropFilter: 'blur(8px)', animation: 'backdropIn 0.15s ease' }}
        onClick={onClose}
      />

      <div
        className="relative w-full mx-auto animate-sheet-slide-up flex flex-col"
        style={{
          maxWidth: 900,
          maxHeight: '88vh',
          background: 'var(--surface)',
          border: '1px solid var(--hairline)',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          boxShadow: 'var(--shadow-overlay)',
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div style={{ width: 40, height: 4, borderRadius: 999, background: 'var(--hairline)' }} />
        </div>

        <div className="flex items-start justify-between px-6 pt-2 pb-4 shrink-0">
          <div>
            <p className="micro-label mb-1">
              Add to &quot;{targetSheetName}&quot;{targetTopicName ? ` · ${targetTopicName}` : ''}
            </p>
            <h2 className="text-[18px] font-semibold" style={{ color: 'var(--ink)' }}>Add creative</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: 'var(--ink-3)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Mode toggle */}
        <div className="flex items-center gap-1 px-6 mb-4 shrink-0">
          <button
            onClick={() => setMode('existing')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold"
            style={mode === 'existing' ? { background: 'var(--accent-bg)', color: 'var(--accent-strong)' } : { color: 'var(--ink-3)' }}
          >
            <LayoutGrid size={13} /> Existing creatives
          </button>
          <button
            onClick={() => setMode('upload')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold"
            style={mode === 'upload' ? { background: 'var(--accent-bg)', color: 'var(--accent-strong)' } : { color: 'var(--ink-3)' }}
          >
            <UploadIcon size={13} /> Upload new
          </button>
        </div>

        {error && <p className="text-[13px] px-6 mb-3 shrink-0" style={{ color: 'var(--bad)' }}>{error}</p>}

        <div className="overflow-y-auto px-6 flex-1">
          {mode === 'upload' ? (
            <div className="pb-6">
              <CreativeUploadForm
                tenantId={tenantId}
                products={products}
                fixedTopic={targetTopicName}
                fixedSheetId={targetSheetId}
                onUploaded={() => { onAdded() }}
              />
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={22} className="animate-spin" style={{ color: 'var(--accent)' }} />
            </div>
          ) : (
            <>
              <div className="relative mb-4">
                <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--ink-4)' }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by headline or product…"
                  className="input"
                  style={{ paddingLeft: 30 }}
                />
              </div>

              {filteredAssets.length === 0 ? (
                <div className="card px-6 py-14 text-center mb-6">
                  <p style={{ color: 'var(--ink-3)' }}>No creatives found.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pb-6">
                  {filteredAssets.map(asset => {
                    const isSelected = selected.has(asset.key)
                    return (
                      <button
                        key={asset.key}
                        onClick={() => toggleSelect(asset.key)}
                        className="card overflow-hidden text-left"
                        style={isSelected ? { border: '2px solid var(--accent-strong)' } : undefined}
                      >
                        <div className="relative w-full" style={{ aspectRatio: '4/5', background: 'var(--surface-warm)' }}>
                          {asset.assetType === 'video' ? (
                            <video src={asset.assetUrl} className="w-full h-full object-cover" muted />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={asset.assetUrl} alt={asset.headline ?? 'Creative'} className="w-full h-full object-cover" />
                          )}
                          <span
                            className="flex items-center justify-center rounded-md"
                            style={{
                              position: 'absolute', top: 6, left: 6, width: 20, height: 20,
                              background: isSelected ? 'var(--accent-strong)' : 'rgba(255,255,255,0.85)',
                              border: isSelected ? 'none' : '1px solid var(--border)',
                            }}
                          >
                            {isSelected && <Check size={12} color="#fff" />}
                          </span>
                          <span className="chip chip-neutral" style={{ position: 'absolute', top: 6, right: 6 }}>
                            {asset.assetType === 'video' ? <VideoIcon size={10} /> : <ImageIcon size={10} />}
                          </span>
                        </div>
                        <div className="p-2">
                          <p className="text-[11px] font-medium truncate" style={{ color: 'var(--ink)' }}>
                            {asset.headline || asset.productName || 'Untitled'}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {mode === 'existing' && (
          <div className="flex items-center justify-between gap-3 px-6 py-4 shrink-0" style={{ borderTop: '1px solid var(--hairline-light)' }}>
            <span className="text-[13px] font-medium" style={{ color: 'var(--ink-2)' }}>
              {selected.size} selected
            </span>
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="btn btn-ghost">Cancel</button>
              <button onClick={handleAddSelected} disabled={adding || selected.size === 0} className="btn btn-primary">
                {adding ? <Loader2 size={14} className="animate-spin" /> : null}
                {adding ? 'Adding…' : `Add ${selected.size || ''}`.trim()}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
