'use client'

import { useState, useEffect } from 'react'
import { Image as ImageIcon, Video as VideoIcon, Loader2 } from 'lucide-react'
import { listGalleryTopics, listGallerySheets, listGalleryAssets, getCreativePackage } from '@/lib/api'
import type { GalleryTopicSummary, GallerySheetSummary } from '@/lib/api'

export interface PickedCreative {
  assetType: 'image' | 'video'
  assetUrl: string
  primaryText?: string
  headline?: string
  cta?: string
}

interface PickableAsset extends PickedCreative {
  key: string
  targetLanguage?: string
}

/**
 * Same topic → sheet → asset browse flow as campaign creation's Gallery
 * picker (campaigns/new/page.tsx's GalleryPicker) — not a flat searchable
 * list across the whole library. Single-select: clicking an asset picks it
 * immediately, since this feeds one new ad's copy+media rather than
 * building a multi-sheet pool for several ad sets at once (which is what
 * GalleryPicker's checkbox-and-pool machinery is for).
 */
export function ExistingCreativePicker({ tenantId, onPick }: { tenantId: string; onPick: (asset: PickedCreative) => void }) {
  const [topics, setTopics] = useState<GalleryTopicSummary[]>([])
  const [topicsLoading, setTopicsLoading] = useState(true)
  const [selectedTopicId, setSelectedTopicId] = useState('')
  const [sheets, setSheets] = useState<GallerySheetSummary[]>([])
  const [sheetsLoading, setSheetsLoading] = useState(false)
  const [selectedSheetId, setSelectedSheetId] = useState('')
  const [assets, setAssets] = useState<PickableAsset[]>([])
  const [assetsLoading, setAssetsLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    listGalleryTopics(tenantId).then((list) => {
      if (cancelled) return
      setTopics(list)
      if (list[0]) setSelectedTopicId(list[0]._id)
    }).finally(() => { if (!cancelled) setTopicsLoading(false) })
    return () => { cancelled = true }
  }, [tenantId])

  useEffect(() => {
    let cancelled = false
    async function loadSheets() {
      if (!selectedTopicId) {
        if (!cancelled) {
          setSheets([])
          setSelectedSheetId('')
        }
        return
      }
      setSheetsLoading(true)
      try {
        const list = await listGallerySheets(tenantId, selectedTopicId)
        if (cancelled) return
        setSheets(list)
        setSelectedSheetId(list[0]?._id ?? '')
      } finally {
        if (!cancelled) setSheetsLoading(false)
      }
    }
    void loadSheets()
    return () => { cancelled = true }
  }, [tenantId, selectedTopicId])

  useEffect(() => {
    let cancelled = false
    async function loadAssets() {
      if (!selectedSheetId) {
        if (!cancelled) setAssets([])
        return
      }
      setAssetsLoading(true)
      try {
        const rawAssets = await listGalleryAssets(tenantId, selectedSheetId)
        if (cancelled) return
        const pickable = rawAssets.filter((a) => a.assetType !== 'carousel_card')
        const uniquePackageIds = [...new Set(pickable.map((a) => a.sourcePackageId))]
        const packages = await Promise.all(uniquePackageIds.map((id) => getCreativePackage(tenantId, id).catch(() => null)))
        if (cancelled) return
        const packageById = new Map(packages.filter(Boolean).map((p) => [p!._id, p!]))
        const resolved: PickableAsset[] = pickable.map((a) => {
          const pkg = packageById.get(a.sourcePackageId)
          const variant = pkg?.copyVariants?.[a.variantIndex] ?? pkg?.copyVariants?.[pkg?.selectedCopyIndex ?? 0]
          return {
            key: a._id,
            assetType: a.assetType as 'image' | 'video',
            assetUrl: a.assetUrl,
            primaryText: variant?.primaryText,
            headline: variant?.headline,
            cta: variant?.cta,
            targetLanguage: pkg?.targetLanguage,
          }
        })
        setAssets(resolved)
      } finally {
        if (!cancelled) setAssetsLoading(false)
      }
    }
    void loadAssets()
    return () => { cancelled = true }
  }, [tenantId, selectedSheetId])

  if (topicsLoading) {
    return <div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin" style={{ color: 'var(--accent)' }} /></div>
  }

  if (topics.length === 0) {
    return <p className="text-xs py-6 text-center" style={{ color: 'var(--ink-3)' }}>No Gallery topics yet — organize creatives in the Gallery first.</p>
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2.5">
        {topics.map((topic) => {
          const active = selectedTopicId === topic._id
          return (
            <button
              key={topic._id}
              type="button"
              onClick={() => setSelectedTopicId(topic._id)}
              className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg"
              style={active ? { background: 'var(--accent-bg)', color: 'var(--accent-strong)', border: '1px solid var(--accent-border)' } : { color: 'var(--ink-3)', border: '1px solid var(--hairline-light)' }}
            >
              {topic.name}
            </button>
          )
        })}
      </div>

      {sheetsLoading ? (
        <div className="flex items-center justify-center py-4"><Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent)' }} /></div>
      ) : sheets.length > 0 && (
        <div className="flex gap-1 mb-3 flex-wrap items-center" style={{ borderBottom: '1px solid var(--hairline-light)' }}>
          {sheets.map((sheet) => {
            const active = selectedSheetId === sheet._id
            return (
              <button
                key={sheet._id}
                type="button"
                onClick={() => setSelectedSheetId(sheet._id)}
                className="px-2.5 py-1.5 text-[11.5px] font-semibold -mb-px"
                style={active ? { color: 'var(--accent-strong)', borderBottom: '2px solid var(--accent-strong)' } : { color: 'var(--ink-3)', borderBottom: '2px solid transparent' }}
              >
                {sheet.name}
              </button>
            )
          })}
        </div>
      )}

      {assetsLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin" style={{ color: 'var(--accent)' }} /></div>
      ) : sheets.length === 0 ? (
        <p className="text-xs py-6 text-center" style={{ color: 'var(--ink-3)' }}>No sheets in this topic yet.</p>
      ) : assets.length === 0 ? (
        <p className="text-xs py-6 text-center" style={{ color: 'var(--ink-3)' }}>No assets in this sheet yet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
          {assets.map((asset) => (
            <button
              key={asset.key}
              type="button"
              onClick={() => onPick(asset)}
              className="card overflow-hidden text-left transition-opacity hover:opacity-80"
            >
              <div className="relative w-full" style={{ aspectRatio: '4/5', background: 'var(--surface-warm)' }}>
                {asset.assetType === 'video' ? (
                  <video src={asset.assetUrl} className="w-full h-full object-cover" muted />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={asset.assetUrl} alt={asset.headline ?? 'Creative'} className="w-full h-full object-cover" />
                )}
                <span className="chip chip-neutral" style={{ position: 'absolute', top: 4, right: 4, padding: '1px 4px' }}>
                  {asset.assetType === 'video' ? <VideoIcon size={9} /> : <ImageIcon size={9} />}
                </span>
              </div>
              <p className="text-[10px] font-medium truncate px-1.5 py-1" style={{ color: 'var(--ink)' }}>
                {asset.headline || 'Untitled'}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
