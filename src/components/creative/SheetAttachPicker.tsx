'use client'

import { useEffect, useState } from 'react'
import { Image as ImageIcon, Video as VideoIcon, Loader2, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { listGalleryTopics, listGallerySheets, listGalleryAssets, getCreativePackage } from '@/lib/api'
import type { GalleryTopicSummary, GallerySheetSummary } from '@/lib/api'

interface PickableAsset {
  key: string
  assetType: 'image' | 'video'
  assetUrl: string
  headline?: string
  targetLanguage?: string
}

export interface SheetAttachSelection {
  sheetId: string
  sheetName: string
  /** Gallery-asset ids the operator unchecked — everything else in the sheet ships. */
  excludeAssetIds: string[]
  totalCount: number
  selectedCount: number
}

/**
 * Browse Topic -> Sheet and attach the WHOLE sheet as ads in one action —
 * the running-campaign counterpart to campaigns/new's GalleryPicker, minus
 * its multi-sheet pool machinery (sheetOrder / cross-visit accumulation /
 * poolSheets / assignSheetToAdSet). That machinery exists there because one
 * not-yet-launched campaign can span several ad sets, each claiming a
 * different sheet from one shared pool. Here there's always exactly one
 * ad set in play (the one being created, or the one being added to), so
 * there's only ever one sheet to pick — every asset in it ships as its own
 * ad by default, uncheck any you don't want. Carousel cards are filtered
 * out (same as GalleryPicker) — a card is a slide inside one multi-card ad,
 * not a standalone ad, and the backend skips them too if any slip through.
 */
export function SheetAttachPicker({
  tenantId,
  onChange,
}: {
  tenantId: string
  onChange: (selection: SheetAttachSelection | null) => void
}) {
  const [topics, setTopics] = useState<GalleryTopicSummary[]>([])
  const [topicsLoading, setTopicsLoading] = useState(true)
  const [selectedTopicId, setSelectedTopicId] = useState('')
  const [sheets, setSheets] = useState<GallerySheetSummary[]>([])
  const [sheetsLoading, setSheetsLoading] = useState(false)
  const [selectedSheetId, setSelectedSheetId] = useState('')
  const [selectedSheetName, setSelectedSheetName] = useState('')
  const [assets, setAssets] = useState<PickableAsset[]>([])
  const [assetsLoading, setAssetsLoading] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    listGalleryTopics(tenantId)
      .then((list) => {
        if (cancelled) return
        setTopics(list)
        if (list[0]) setSelectedTopicId(list[0]._id)
      })
      .finally(() => {
        if (!cancelled) setTopicsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tenantId])

  useEffect(() => {
    if (!selectedTopicId) {
      setSheets([])
      return
    }
    let cancelled = false
    setSheetsLoading(true)
    listGallerySheets(tenantId, selectedTopicId)
      .then((list) => {
        if (cancelled) return
        setSheets(list)
        setSelectedSheetId(list[0]?._id ?? '')
        setSelectedSheetName(list[0]?.name ?? '')
      })
      .finally(() => {
        if (!cancelled) setSheetsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tenantId, selectedTopicId])

  useEffect(() => {
    if (!selectedSheetId) {
      setAssets([])
      setSelectedKeys(new Set())
      return
    }
    let cancelled = false
    setAssetsLoading(true)
    listGalleryAssets(tenantId, selectedSheetId)
      .then(async (rawAssets) => {
        if (cancelled) return
        // Carousel cards are slides inside one multi-card ad, not standalone
        // ads — same exclusion GalleryPicker (campaigns/new) already applies,
        // and the backend skips them too if any slip through.
        const pickable = rawAssets.filter((a) => a.assetType !== 'carousel_card')
        const uniquePackageIds = [...new Set(pickable.map((a) => a.sourcePackageId))]
        const packages = await Promise.all(
          uniquePackageIds.map((id) => getCreativePackage(tenantId, id).catch(() => null)),
        )
        if (cancelled) return
        const packageById = new Map(packages.filter(Boolean).map((p) => [p!._id, p!]))
        const resolved: PickableAsset[] = pickable.map((a) => {
          const pkg = packageById.get(a.sourcePackageId)
          const variant = pkg?.copyVariants?.[a.variantIndex] ?? pkg?.copyVariants?.[pkg?.selectedCopyIndex ?? 0]
          return {
            key: a._id,
            assetType: a.assetType as 'image' | 'video',
            assetUrl: a.assetUrl,
            headline: variant?.headline,
            targetLanguage: pkg?.targetLanguage,
          }
        })
        setAssets(resolved)
        // Every asset in a freshly-opened sheet starts selected — "use all
        // the ads in this sheet" with zero clicks; uncheck to exclude one.
        setSelectedKeys(new Set(resolved.map((a) => a.key)))
      })
      .finally(() => {
        if (!cancelled) setAssetsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tenantId, selectedSheetId])

  useEffect(() => {
    if (!selectedSheetId || assets.length === 0) {
      onChange(null)
      return
    }
    onChange({
      sheetId: selectedSheetId,
      sheetName: selectedSheetName,
      excludeAssetIds: assets.filter((a) => !selectedKeys.has(a.key)).map((a) => a.key),
      totalCount: assets.length,
      selectedCount: selectedKeys.size,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSheetId, selectedSheetName, assets, selectedKeys])

  function toggleAsset(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (topicsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={18} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    )
  }

  if (topics.length === 0) {
    return (
      <div className="rounded-xl px-4 py-6 text-center" style={{ background: 'var(--surface-warm)', border: '1px dashed var(--hairline)' }}>
        <p className="text-[13px]" style={{ color: 'var(--ink-3)' }}>No Gallery topics yet.</p>
        <Link
          href={`/dashboard/${tenantId}/gallery`}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold mt-2"
          style={{ color: 'var(--accent-strong)' }}
        >
          Organize creatives in the Gallery →
        </Link>
      </div>
    )
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
        <div className="flex items-center justify-center py-4">
          <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent)' }} />
        </div>
      ) : sheets.length > 0 && (
        <div className="flex gap-1 mb-3 flex-wrap items-center" style={{ borderBottom: '1px solid var(--hairline-light)' }}>
          {sheets.map((sheet) => {
            const active = selectedSheetId === sheet._id
            return (
              <button
                key={sheet._id}
                type="button"
                onClick={() => {
                  setSelectedSheetId(sheet._id)
                  setSelectedSheetName(sheet.name)
                }}
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
        <div className="flex items-center justify-center py-8">
          <Loader2 size={18} className="animate-spin" style={{ color: 'var(--accent)' }} />
        </div>
      ) : sheets.length === 0 ? (
        <p className="text-xs py-6 text-center" style={{ color: 'var(--ink-3)' }}>No sheets in this topic yet.</p>
      ) : assets.length === 0 ? (
        <p className="text-xs py-6 text-center" style={{ color: 'var(--ink-3)' }}>No assets in this sheet yet.</p>
      ) : (
        <>
          <p className="text-[11.5px] font-medium mb-2" style={{ color: 'var(--ink-3)' }}>
            {selectedKeys.size} of {assets.length} selected — every asset in this sheet ships as its own ad by default, uncheck any you don&rsquo;t want.
          </p>
          <div className="grid grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
            {assets.map((asset) => {
              const isSelected = selectedKeys.has(asset.key)
              return (
                <button
                  key={asset.key}
                  type="button"
                  onClick={() => toggleAsset(asset.key)}
                  className="text-left rounded-xl overflow-hidden transition-all"
                  style={isSelected ? { border: '2px solid var(--accent)' } : { border: '2px solid var(--hairline-light)', opacity: 0.6 }}
                >
                  <div className="relative" style={{ aspectRatio: '4/5', background: 'var(--surface-warm)' }}>
                    {asset.assetType === 'video' ? (
                      <video src={asset.assetUrl} className="w-full h-full object-cover" muted />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={asset.assetUrl} alt={asset.headline ?? ''} className="w-full h-full object-cover" />
                    )}
                    <span
                      className="flex items-center justify-center rounded-md"
                      style={{
                        position: 'absolute', top: 4, left: 4, width: 18, height: 18,
                        background: isSelected ? 'var(--accent)' : 'rgba(255,255,255,0.85)',
                        border: isSelected ? 'none' : '1px solid var(--border)',
                      }}
                    >
                      {isSelected && <CheckCircle2 size={12} color="#fff" />}
                    </span>
                    <span className="chip chip-neutral" style={{ position: 'absolute', top: 4, right: 4, padding: '1px 4px' }}>
                      {asset.assetType === 'video' ? <VideoIcon size={9} /> : <ImageIcon size={9} />}
                    </span>
                  </div>
                  <p className="text-[10px] font-medium truncate px-1.5 py-1" style={{ color: 'var(--ink)' }}>
                    {asset.headline || 'Untitled'}
                  </p>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
