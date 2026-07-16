'use client'

import { useState, useEffect, use, useCallback } from 'react'
import Link from 'next/link'
import {
  Sparkles, Loader2, Image as ImageIcon, Video as VideoIcon, ChevronDown, RefreshCw, LayoutGrid, Zap,
} from 'lucide-react'
import { getCompany, listCreativePackages, generateProductCreative, getCreativeLanguages, getCreativeFormats } from '@/lib/api'
import type { Company, CreativePackage } from '@/types'
import type { CreativeFormatOption } from '@/lib/api'

interface PageProps {
  params: Promise<{ tenantId: string }>
}

const GROUP_ORDER = ['image', 'carousel', 'native', 'video'] as const
const GROUP_META: Record<string, { label: string; icon: typeof ImageIcon }> = {
  image: { label: 'Image', icon: ImageIcon },
  carousel: { label: 'Carousel', icon: LayoutGrid },
  native: { label: 'High-engagement native styles', icon: Zap },
  video: { label: 'Video', icon: VideoIcon },
}

const CAROUSEL_PATTERNS: { value: string; label: string }[] = [
  { value: 'auto', label: 'Story (auto)' },
  { value: 'catalog_grid', label: 'Product grid' },
  { value: 'differentiator_stack', label: 'Listicle / feature breakdown' },
]

const ASPECT_RATIOS: { value: '9:16' | '16:9' | '1:1' | '4:5'; label: string }[] = [
  { value: '9:16', label: '9:16 (Stories/Reels)' },
  { value: '16:9', label: '16:9 (Landscape)' },
  { value: '1:1', label: '1:1 (Square)' },
  { value: '4:5', label: '4:5 (Portrait)' },
]

const IMAGE_RESOLUTIONS: { value: '1K' | '2K' | '4K'; label: string }[] = [
  { value: '1K', label: 'Standard (1K)' },
  { value: '2K', label: 'High (2K)' },
  { value: '4K', label: 'Ultra (4K)' },
]

const VIDEO_ASPECT_RATIOS = ASPECT_RATIOS

const VIDEO_RESOLUTIONS: { value: '720p' | '1080p' | '4k'; label: string }[] = [
  { value: '720p', label: '720p' },
  { value: '1080p', label: '1080p' },
  { value: '4k', label: '4K' },
]

const STATUS_LABEL: Record<string, string> = {
  pending: 'Producing…',
  completed: 'Ready',
  failed: 'Failed',
}
const STATUS_STYLE: Record<string, string> = {
  pending: 'chip-warn',
  completed: 'chip-good',
  failed: 'chip-bad',
}

export default function CreativesPage({ params }: PageProps) {
  const { tenantId } = use(params)

  const [company, setCompany] = useState<Company | null>(null)
  const [packages, setPackages] = useState<CreativePackage[]>([])
  const [loading, setLoading] = useState(true)
  const [languages, setLanguages] = useState<string[]>([])
  const [formats, setFormats] = useState<CreativeFormatOption[]>([])

  // Library filters
  const [filterProduct, setFilterProduct] = useState('')
  const [filterLanguage, setFilterLanguage] = useState('')

  // Generate form
  const [showForm, setShowForm] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [product, setProduct] = useState('')
  const [language, setLanguage] = useState('')
  const [format, setFormat] = useState('image')
  const [carouselPattern, setCarouselPattern] = useState('auto')
  const [topic, setTopic] = useState('')
  const [angle, setAngle] = useState('')
  const [hook, setHook] = useState('')
  const [audience, setAudience] = useState('')
  const [aspectRatio, setAspectRatio] = useState<'' | '9:16' | '16:9' | '1:1' | '4:5'>('')
  const [imageResolution, setImageResolution] = useState<'1K' | '2K' | '4K'>('1K')
  const [videoAspectRatio, setVideoAspectRatio] = useState<'9:16' | '16:9' | '1:1' | '4:5'>('9:16')
  const [videoResolution, setVideoResolution] = useState<'720p' | '1080p' | '4k'>('1080p')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [pendingBriefId, setPendingBriefId] = useState<string | null>(null)

  const loadPackages = useCallback(async () => {
    try {
      const list = await listCreativePackages(tenantId, {
        productName: filterProduct || undefined,
        targetLanguage: filterLanguage || undefined,
      })
      setPackages(list)
    } catch {
      // non-fatal — keep showing whatever we already have
    }
  }, [tenantId, filterProduct, filterLanguage])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [c, langs, fmts] = await Promise.all([
          getCompany(tenantId),
          getCreativeLanguages().catch(() => []),
          getCreativeFormats().catch(() => []),
        ])
        if (cancelled) return
        setCompany(c)
        setLanguages(langs)
        setFormats(fmts)
        const active = c.products?.find(p => p.active !== false) ?? c.products?.[0]
        if (active) setProduct(active.name)
      } catch {
        // handled by the empty state below
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [tenantId])

  useEffect(() => { loadPackages() }, [loadPackages])

  // Poll while a generation is in flight — same 10s-interval, ~3min-cap
  // pattern already used elsewhere in this codebase for creative production
  // status (runs/[runId]/page.tsx's pollImageVariant/pollVideoReady).
  useEffect(() => {
    if (!pendingBriefId) return
    let attempts = 0
    const poll = setInterval(async () => {
      attempts++
      try {
        const list = await listCreativePackages(tenantId, { briefId: pendingBriefId })
        const pkg = list[0]
        if (pkg && pkg.status !== 'pending') {
          clearInterval(poll)
          setPendingBriefId(null)
          loadPackages()
        }
      } catch {
        // keep polling
      }
      if (attempts >= 18) {
        clearInterval(poll)
        setPendingBriefId(null)
        loadPackages()
      }
    }, 10000)
    return () => clearInterval(poll)
  }, [pendingBriefId, tenantId, loadPackages])

  async function handleGenerate() {
    if (!product) { setError('Pick a product'); return }
    setError('')
    setSubmitting(true)
    try {
      const res = await generateProductCreative(tenantId, {
        product,
        targetLanguage: language || undefined,
        format,
        ...(format === 'carousel' ? { carouselPattern: carouselPattern as 'auto' | 'catalog_grid' | 'differentiator_stack' } : {}),
        topic: topic || undefined,
        angle: angle || undefined,
        hook: hook || undefined,
        audience: audience || undefined,
        aspectRatio: aspectRatio || undefined,
        imageResolution,
        ...(!selectedFormatSkipsVideo ? { videoAspectRatio, videoResolution } : {}),
      })
      setPendingBriefId(res.briefId)
      setShowForm(false)
      setTopic('')
      setAngle('')
      setHook('')
      setAudience('')
      await loadPackages()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start generation')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    )
  }

  const products = company?.products ?? []
  const selectedFormatSkipsVideo = formats.find(f => f.value === format)?.skipVideo ?? false

  return (
    <div className="px-8 py-8 max-w-[1600px] mx-auto stagger">
      <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
        <div>
          <p className="micro-label mb-2">Creative library</p>
          <h1 className="page-title">Your ad creative</h1>
          <p className="page-subtitle">
            Generate ad copy, images, and video for a product — then attach them when you launch a campaign, instead of pasting URLs by hand.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => loadPackages()} className="btn btn-ghost">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => setShowForm(s => !s)} className="btn btn-primary">
            <Sparkles size={14} /> Generate new creative
          </button>
        </div>
      </div>

      {pendingBriefId && (
        <div
          className="rounded-xl px-4 py-3 mb-5 flex items-center gap-3"
          style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)' }}
        >
          <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent-strong)' }} />
          <p className="text-[13px]" style={{ color: 'var(--ink-2)' }}>
            Producing your creative — this usually takes 1-3 minutes. This page updates automatically.
          </p>
        </div>
      )}

      {showForm && (
        <div className="card p-6 mb-6">
          <p className="micro-label mb-4">Generate new creative</p>
          {error && <p className="text-[12.5px] mb-3" style={{ color: 'var(--bad)' }}>{error}</p>}
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <label className="block">
              <span className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--ink-2)' }}>Product</span>
              <select value={product} onChange={e => setProduct(e.target.value)} className="input">
                <option value="">Select a product…</option>
                {products.map(p => (
                  <option key={p.name} value={p.name}>
                    {p.name}{p.price ? ` — ${p.currency ?? '₹'}${p.price}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--ink-2)' }}>Language</span>
              <select value={language} onChange={e => setLanguage(e.target.value)} className="input">
                <option value="">Auto (from product settings)</option>
                {languages.map(l => <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>)}
              </select>
            </label>
          </div>

          <div className="block mb-4">
            <span className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--ink-2)' }}>Creative category</span>
            <div className="space-y-3">
              {GROUP_ORDER.filter(g => formats.some(f => f.group === g)).map(group => {
                const { label, icon: GroupIcon } = GROUP_META[group]
                const items = formats.filter(f => f.group === group)
                return (
                  <div key={group}>
                    <p className="flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--ink-4)' }}>
                      <GroupIcon size={11} /> {label}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {items.map(opt => {
                        const active = format === opt.value
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setFormat(opt.value)}
                            className="text-left px-3 py-2.5 rounded-lg border transition-colors"
                            style={{
                              borderColor: active ? 'var(--accent-strong)' : 'var(--hairline)',
                              background: active ? 'var(--accent-bg)' : 'var(--surface)',
                            }}
                          >
                            <span className="block text-[13px] font-semibold" style={{ color: active ? 'var(--accent-strong)' : 'var(--ink)' }}>
                              {opt.label}
                            </span>
                            <span className="block text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--ink-4)' }}>{opt.hint}</span>
                          </button>
                        )
                      })}
                    </div>
                    {group === 'carousel' && format === 'carousel' && (
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {CAROUSEL_PATTERNS.map(p => {
                          const active = carouselPattern === p.value
                          return (
                            <button
                              key={p.value}
                              type="button"
                              onClick={() => setCarouselPattern(p.value)}
                              className="chip"
                              style={{
                                background: active ? 'var(--accent-bg)' : 'var(--surface-warm)',
                                color: active ? 'var(--accent-strong)' : 'var(--ink-3)',
                                border: `1px solid ${active ? 'var(--accent-border)' : 'var(--hairline)'}`,
                                cursor: 'pointer',
                              }}
                            >
                              {p.label}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {format !== 'image' && format !== 'video' && (
            <p className="text-[11.5px] mb-4 px-3 py-2 rounded-lg" style={{ background: 'var(--warn-bg)', color: 'var(--warn)' }}>
              {format === 'carousel'
                ? "Carousel creatives can be generated here, but can't be attached to a campaign yet — that's coming in a future update. "
                : ''}
              This format&rsquo;s copy structure is always correct, even if the multi-agent Creative Team times out and falls back to the single-agent writer. The distinct visual/video treatment only applies when the full Creative Team completes — a fallback run still uses generic image styling.
            </p>
          )}

          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <label className="block">
              <span className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--ink-2)' }}>Image aspect ratio</span>
              <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value as typeof aspectRatio)} className="input">
                <option value="">Use format default</option>
                {ASPECT_RATIOS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--ink-2)' }}>Image quality</span>
              <select value={imageResolution} onChange={e => setImageResolution(e.target.value as typeof imageResolution)} className="input">
                {IMAGE_RESOLUTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </label>
            {!selectedFormatSkipsVideo && (
              <>
                <label className="block">
                  <span className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--ink-2)' }}>Video aspect ratio</span>
                  <select value={videoAspectRatio} onChange={e => setVideoAspectRatio(e.target.value as typeof videoAspectRatio)} className="input">
                    {VIDEO_ASPECT_RATIOS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--ink-2)' }}>Video resolution</span>
                  <select value={videoResolution} onChange={e => setVideoResolution(e.target.value as typeof videoResolution)} className="input">
                    {VIDEO_RESOLUTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </label>
              </>
            )}
          </div>

          <button
            onClick={() => setShowAdvanced(s => !s)}
            className="inline-flex items-center gap-1 text-[12px] font-semibold mb-3"
            style={{ color: 'var(--accent-strong)' }}
          >
            <ChevronDown size={12} style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
            {showAdvanced ? 'Hide' : 'Show'} advanced options
          </button>

          {showAdvanced && (
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <label className="block">
                <span className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--ink-3)' }}>Topic (optional)</span>
                <input value={topic} onChange={e => setTopic(e.target.value)} className="input" placeholder="Defaults to a generic product creative" />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--ink-3)' }}>Angle (optional)</span>
                <input value={angle} onChange={e => setAngle(e.target.value)} className="input" placeholder="Defaults to a direct-response angle" />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--ink-3)' }}>Hook (optional)</span>
                <input value={hook} onChange={e => setHook(e.target.value)} className="input" placeholder="Defaults to the product's top differentiator" />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--ink-3)' }}>Audience (optional)</span>
                <input value={audience} onChange={e => setAudience(e.target.value)} className="input" placeholder="Defaults to the product's first audience segment" />
              </label>
            </div>
          )}

          <button onClick={handleGenerate} disabled={submitting || !product} className="btn btn-primary">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {submitting ? 'Starting…' : 'Generate'}
          </button>
        </div>
      )}

      {/* Library filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select value={filterProduct} onChange={e => setFilterProduct(e.target.value)} className="input" style={{ maxWidth: 220 }}>
          <option value="">All products</option>
          {products.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
        </select>
        <select value={filterLanguage} onChange={e => setFilterLanguage(e.target.value)} className="input" style={{ maxWidth: 180 }}>
          <option value="">All languages</option>
          {languages.map(l => <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>)}
        </select>
      </div>

      {packages.length === 0 ? (
        <div className="card px-6 py-14 text-center">
          <p style={{ color: 'var(--ink-3)' }}>No creative yet.</p>
          <p className="text-[13px] mt-1.5" style={{ color: 'var(--ink-4)' }}>
            Click <b>Generate new creative</b> above to make your first one.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {packages.map(pkg => {
            const selected = pkg.copyVariants?.[pkg.selectedCopyIndex ?? 0]
            const isCarousel = (pkg.carouselCards?.length ?? 0) > 0
            const thumb = pkg.images?.[pkg.selectedCopyIndex ?? 0]?.imageUrl
              || pkg.carouselCards?.[0]?.imageUrl
              || pkg.video?.videoThumbnailUrl
            const isVideo = !!pkg.video?.videoUrl
            return (
              <Link key={pkg._id} href={`/dashboard/${tenantId}/creatives/${pkg._id}`} className="card overflow-hidden block">
                <div className="relative" style={{ aspectRatio: '4/5', background: 'var(--surface-warm)' }}>
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt={selected?.headline ?? pkg.productName ?? 'Creative'} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {isVideo ? <VideoIcon size={22} style={{ color: 'var(--ink-4)' }} /> : <ImageIcon size={22} style={{ color: 'var(--ink-4)' }} />}
                    </div>
                  )}
                  <div className="flex gap-1" style={{ position: 'absolute', top: 8, right: 8 }}>
                    {isCarousel && <span className="chip chip-neutral">Carousel</span>}
                    <span className={`chip ${STATUS_STYLE[pkg.status ?? ''] ?? 'chip-neutral'}`}>
                      {STATUS_LABEL[pkg.status ?? ''] ?? pkg.status}
                    </span>
                  </div>
                </div>
                <div className="p-3">
                  <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--ink)' }}>
                    {selected?.headline || pkg.productName || 'Untitled'}
                  </p>
                  <p className="text-[11.5px] mt-0.5 truncate" style={{ color: 'var(--ink-3)' }}>
                    {pkg.productName || '—'}{pkg.targetLanguage ? ` · ${pkg.targetLanguage}` : ''}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
