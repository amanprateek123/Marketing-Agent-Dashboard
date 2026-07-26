'use client'

import { useState, useEffect, use, useCallback } from 'react'
import Link from 'next/link'
import {
  Sparkles, Loader2, Image as ImageIcon, Video as VideoIcon, ChevronDown, RefreshCw, LayoutGrid, Zap, Upload, RotateCcw, Plus, Trash2, CheckCircle2, XCircle,
} from 'lucide-react'
import { getCompany, listCreativePackages, generateProductCreative, getCreativeLanguages, getCreativeFormats, getHookStyles, getHiggsfieldModels, getHiggsfieldModel, uploadCreativeBulk, getRejectedAssets, restoreAsset } from '@/lib/api'
import type { Company, CreativePackage } from '@/types'
import type { CreativeFormatOption, HookStyleGroups, HiggsfieldModelSummary, RejectedAssetItem, UploadCreativeResult } from '@/lib/api'
import { creativePackageStatus } from '@/lib/utils'

// Which hookStyle group applies to a given format id — matches format-specs.ts's group assignments.
function hookStyleGroupForFormat(format: string): keyof HookStyleGroups {
  if (format === 'meme') return 'meme'
  if (format === 'screenshot') return 'screenshot'
  if (format === 'poll_quiz') return 'poll'
  return 'dr'
}

// One row in the bulk-upload form — becomes one UploadCreativeItem on submit.
interface UploadRow {
  assetType: 'image' | 'video'
  sourceUrl: string
  headline: string
  primaryText: string
  cta: string
}
function emptyUploadRow(): UploadRow {
  return { assetType: 'image', sourceUrl: '', headline: '', primaryText: '', cta: '' }
}

interface PageProps {
  params: Promise<{ tenantId: string }>
}

const GROUP_ORDER = ['image', 'carousel', 'native', 'video'] as const
const GROUP_META: Record<string, { label: string; icon: typeof ImageIcon }> = {
  image: { label: 'Image', icon: ImageIcon },
  carousel: { label: 'Carousel', icon: LayoutGrid },
  native: { label: 'Special formats', icon: Zap },
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

// Human-friendly label + one-line explanation per hookStyle — the backend's own
// descriptions are prompt-engineering instructions (BANNED phrases, sensory cues),
// not end-user copy, so this is a separate display-only map.
const HOOK_STYLE_INFO: Record<string, { label: string; blurb: string }> = {
  pain_point: { label: 'Pain point', blurb: 'Opens with the exact problem your audience feels right now' },
  bold_claim: { label: 'Bold claim', blurb: 'Leads with a specific, provable promise' },
  price_shock: { label: 'Price-led', blurb: 'Leads with the price itself as the hook' },
  social_proof: { label: 'Social proof', blurb: 'Opens with a real customer result' },
  curiosity_gap: { label: 'Curiosity', blurb: 'Teases something the viewer needs to know' },
  before_after: { label: 'Before / after', blurb: 'Shows a transformation over time' },
  urgency: { label: 'Urgency', blurb: 'Leads with a real deadline or limited slots' },
  meme_relatable: { label: 'Relatable meme', blurb: 'A shared moment your audience has lived' },
  meme_punchline: { label: 'Punchline meme', blurb: 'Setup, then a joke that turns into the offer' },
  meme_self_aware: { label: 'Self-aware meme', blurb: "The ad admits it's an ad, then earns the tap" },
  chat_advice_ask: { label: 'Advice chat', blurb: 'Fake chat thread asking a friend for advice' },
  chat_price_objection: { label: 'Price-objection chat', blurb: 'A chat that resolves the price objection' },
  review_screenshot: { label: 'Review card', blurb: 'A star-rating review screenshot' },
  dm_testimonial: { label: 'DM testimonial', blurb: 'A customer DM screenshot' },
  poll_would_you_rather: { label: 'Would you rather', blurb: 'A binary-choice poll' },
  poll_which_are_you: { label: 'Which are you', blurb: 'An identity-split poll' },
}

const VIDEO_ASPECT_RATIOS = ASPECT_RATIOS

// Heygen only accepts 720p/1080p/4k — '480p' is Higgsfield-only (its cheapest
// tier on several models). Never render the 480p option while Heygen is selected.
const VIDEO_RESOLUTIONS: { value: '480p' | '720p' | '1080p' | '4k'; label: string }[] = [
  { value: '480p', label: '480p (Higgsfield only — cheapest)' },
  { value: '720p', label: '720p' },
  { value: '1080p', label: '1080p' },
  { value: '4k', label: '4K' },
]

// Cheapest-first — used to auto-pick the lowest resolution a given Higgsfield model actually supports.
const RESOLUTION_ORDER = ['480p', '720p', '1080p', '4k'] as const

export default function CreativesPage({ params }: PageProps) {
  const { tenantId } = use(params)

  const [company, setCompany] = useState<Company | null>(null)
  const [packages, setPackages] = useState<CreativePackage[]>([])
  const [loading, setLoading] = useState(true)
  const [languages, setLanguages] = useState<string[]>([])
  const [formats, setFormats] = useState<CreativeFormatOption[]>([])
  const [hookStyles, setHookStyles] = useState<HookStyleGroups | null>(null)

  // Library filters
  const [filterProduct, setFilterProduct] = useState('')
  const [filterLanguage, setFilterLanguage] = useState('')

  // Generate form
  const [showForm, setShowForm] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [product, setProduct] = useState('')
  const [language, setLanguage] = useState('')
  // Image and video creatives need different inputs (image quality vs video
  // duration/model settings) — this picks which set of formats/fields the
  // rest of the form shows, before the user ever sees a format list.
  const [creativeType, setCreativeType] = useState<'image' | 'video'>('image')
  const [format, setFormat] = useState('image')
  const [selectedHookStyles, setSelectedHookStyles] = useState<string[]>([])
  const [carouselPattern, setCarouselPattern] = useState('auto')
  const [topic, setTopic] = useState('')
  const [angle, setAngle] = useState('')
  const [hook, setHook] = useState('')
  const [audience, setAudience] = useState('')
  const [aspectRatio, setAspectRatio] = useState<'' | '9:16' | '16:9' | '1:1' | '4:5'>('')
  const [imageResolution, setImageResolution] = useState<'1K' | '2K' | '4K'>('1K')
  const [videoAspectRatio, setVideoAspectRatio] = useState<'9:16' | '16:9' | '1:1' | '4:5'>('9:16')
  const [videoResolution, setVideoResolution] = useState<'480p' | '720p' | '1080p' | '4k'>('1080p')
  const [videoProvider, setVideoProvider] = useState<'heygen' | 'higgsfield'>('heygen')
  const [higgsfieldModels, setHiggsfieldModels] = useState<HiggsfieldModelSummary[]>([])
  const [higgsfieldJobType, setHiggsfieldJobType] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [pendingBriefId, setPendingBriefId] = useState<string | null>(null)

  // Active / Rejected tabs — Rejected is a separate, additive view (rejected
  // assets aren't removed from anywhere else), lazy-loaded on first visit.
  const [activeTab, setActiveTab] = useState<'active' | 'rejected'>('active')
  const [rejectedAssets, setRejectedAssets] = useState<RejectedAssetItem[]>([])
  const [rejectedLoading, setRejectedLoading] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  // Upload already-made creatives — registers each as a real library +
  // Gallery entry (unlike pasting a URL into a one-off manual campaign).
  // Bulk: one product + one topic shared across the batch (they're filed
  // together), each row is its own creative (type/URL/copy) — one bad URL
  // doesn't block the rest, per-row results show after submit.
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [uploadProduct, setUploadProduct] = useState('')
  const [uploadTopic, setUploadTopic] = useState('')
  const [uploadRows, setUploadRows] = useState<UploadRow[]>([emptyUploadRow()])
  const [uploading, setUploading] = useState(false)
  const [uploadResults, setUploadResults] = useState<UploadCreativeResult[] | null>(null)

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
        const [c, langs, fmts, hooks, hfModels] = await Promise.all([
          getCompany(tenantId),
          getCreativeLanguages().catch(() => []),
          getCreativeFormats().catch(() => []),
          getHookStyles().catch(() => null),
          getHiggsfieldModels().catch(() => []),
        ])
        if (cancelled) return
        setHiggsfieldModels(hfModels)
        if (hfModels[0]) setHiggsfieldJobType(hfModels[0].job_type)
        setCompany(c)
        setLanguages(langs)
        setFormats(fmts)
        setHookStyles(hooks)
        const active = c.products?.find(p => p.active !== false) ?? c.products?.[0]
        if (active) { setProduct(active.name); setUploadProduct(active.name) }
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

  // Auto-pick the cheapest resolution the selected engine/model actually
  // supports, instead of always defaulting to 1080p — this is the whole
  // point of exposing 480p at all (least-cost testing). Heygen never gets
  // 480p (unsupported), so switching back to it falls to 720p if needed.
  useEffect(() => {
    if (videoProvider !== 'higgsfield' || !higgsfieldJobType) {
      setVideoResolution(r => (r === '480p' ? '720p' : r))
      return
    }
    let cancelled = false
    getHiggsfieldModel(higgsfieldJobType).then(spec => {
      if (cancelled) return
      const resParam = spec.params.find(p => p.name === 'resolution')
      const cheapest = RESOLUTION_ORDER.find(r => resParam?.enum?.includes(r))
      if (cheapest) setVideoResolution(cheapest)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [videoProvider, higgsfieldJobType])

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

  // Toggling a hookStyle adds/removes it from the ordered plan — order matters
  // (variant i is locked to selectedHookStyles[i]), and the plan's length
  // becomes the variant count, replacing the format default.
  // Video only ever produces ONE video regardless of variant count (the
  // pipeline generates a single video for whichever variant the Creative Team
  // picks as strongest) — so for video creatives this is single-select, not
  // multi-select, to avoid implying "pick 3 angles = 3 videos".
  function toggleHookStyle(value: string) {
    if (creativeType === 'video') {
      setSelectedHookStyles(prev => prev[0] === value ? [] : [value])
      return
    }
    setSelectedHookStyles(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value])
  }

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
        ...(!selectedFormatSkipsVideo ? {
          videoAspectRatio, videoResolution, videoProvider,
          ...(videoProvider === 'higgsfield' ? { higgsfieldJobType } : {}),
        } : {}),
        hookStyles: selectedHookStyles.length ? selectedHookStyles : undefined,
      })
      setPendingBriefId(res.briefId)
      setShowForm(false)
      setTopic('')
      setAngle('')
      setHook('')
      setAudience('')
      setSelectedHookStyles([])
      await loadPackages()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start generation')
    } finally {
      setSubmitting(false)
    }
  }

  const loadRejectedAssets = useCallback(async () => {
    setRejectedLoading(true)
    try {
      const list = await getRejectedAssets(tenantId)
      setRejectedAssets(list)
    } catch {
      // non-fatal — keep showing whatever we already have
    } finally {
      setRejectedLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    if (activeTab === 'rejected') loadRejectedAssets()
  }, [activeTab, loadRejectedAssets])

  async function handleRestoreRejected(asset: RejectedAssetItem) {
    const key = `${asset.packageId}-${asset.assetType}-${asset.variantIndex}`
    setRestoringId(key)
    try {
      await restoreAsset(tenantId, asset.packageId, asset.assetType, asset.variantIndex)
      await loadRejectedAssets()
    } catch {
      setError('Failed to restore')
    } finally {
      setRestoringId(null)
    }
  }

  function addUploadRow() {
    setUploadRows(rows => [...rows, emptyUploadRow()])
  }

  function removeUploadRow(index: number) {
    setUploadRows(rows => rows.filter((_, i) => i !== index))
  }

  function updateUploadRow(index: number, patch: Partial<UploadRow>) {
    setUploadRows(rows => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  async function handleUploadCreative() {
    if (!uploadProduct) { setError('Pick a product'); return }
    const incomplete = uploadRows.some(r => !r.sourceUrl.trim() || !r.headline.trim() || !r.primaryText.trim() || !r.cta.trim())
    if (incomplete) {
      setError('Every row needs a source URL, headline, primary text, and CTA')
      return
    }
    setError('')
    setUploading(true)
    setUploadResults(null)
    try {
      const results = await uploadCreativeBulk(
        tenantId,
        uploadRows.map(r => ({
          productName: uploadProduct,
          topic: uploadTopic || undefined,
          assetType: r.assetType,
          sourceUrl: r.sourceUrl.trim(),
          copy: { headline: r.headline.trim(), primaryText: r.primaryText.trim(), cta: r.cta.trim() },
        })),
      )
      setUploadResults(results)
      if (results.every(r => r.status === 'completed')) {
        setShowUploadForm(false)
        setUploadRows([emptyUploadRow()])
        setUploadTopic('')
        setUploadResults(null)
      }
      await loadPackages()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to upload creatives')
    } finally {
      setUploading(false)
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
  // The Active tab is the usable library, so a package whose every asset has
  // been rejected doesn't belong in it — there's nothing left to launch or
  // edit, and its assets are listed (and restorable) on the Rejected tab right
  // next to it, so nothing becomes unreachable.
  //
  // Deliberately does NOT hide 'No assets' — a package that completed while
  // producing nothing has no rejected assets, so it appears on the Rejected
  // tab either. Hiding it here would make a generation failure invisible
  // everywhere rather than surfacing it for a retry.
  const visiblePackages = packages.filter(pkg => creativePackageStatus(pkg).label !== 'All rejected')
  const hiddenRejectedCount = packages.length - visiblePackages.length
  const selectedFormatSkipsVideo = formats.find(f => f.value === format)?.skipVideo ?? false
  // Image formats (skipVideo=true) vs video formats (skipVideo=false) — same
  // split the pipeline already uses internally, just surfaced as the type toggle.
  const formatsForType = formats.filter(f => (creativeType === 'image') === f.skipVideo)

  function selectCreativeType(type: 'image' | 'video') {
    setCreativeType(type)
    setSelectedHookStyles([])
    const firstMatch = formats.find(f => (type === 'image') === f.skipVideo)
    if (firstMatch) setFormat(firstMatch.value)
  }

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
          <button onClick={() => setShowUploadForm(s => !s)} className="btn btn-ghost">
            <Upload size={14} /> Upload existing creatives
          </button>
          <button onClick={() => setShowForm(s => !s)} className="btn btn-primary">
            <Sparkles size={14} /> Generate new creative
          </button>
        </div>
      </div>

      {showUploadForm && (
        <div className="card p-6 mb-6">
          <p className="micro-label mb-1">Upload existing creatives</p>
          <p className="text-[12px] mb-5" style={{ color: 'var(--ink-4)' }}>
            Already have images or videos made elsewhere? Add a row per asset and submit them together — each gets rehosted permanently on our own storage, registered as a real library entry, and auto-organized into the same Gallery topic, just like generated ones. One bad URL won't block the rest.
          </p>
          <div className="grid md:grid-cols-2 gap-3 mb-4">
            <label className="block">
              <span className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--ink-3)' }}>Product (applies to all rows)</span>
              <select value={uploadProduct} onChange={e => setUploadProduct(e.target.value)} className="input" disabled={uploading}>
                <option value="">Select a product</option>
                {products.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--ink-3)' }}>Gallery topic (optional — applies to all rows)</span>
              <input value={uploadTopic} onChange={e => setUploadTopic(e.target.value)} className="input" placeholder="Defaults to the product name" disabled={uploading} />
            </label>
          </div>

          <div className="space-y-4 mb-4">
            {uploadRows.map((row, i) => {
              const result = uploadResults?.[i]
              return (
                <div key={i} className="rounded-xl p-4" style={{ background: 'var(--surface-warm)', border: '1px solid var(--hairline-light)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-semibold" style={{ color: 'var(--ink-3)' }}>Row {i + 1}</span>
                    <div className="flex items-center gap-2">
                      {result && (
                        result.status === 'completed'
                          ? <span className="chip chip-good"><CheckCircle2 size={11} /> Uploaded</span>
                          : <span className="chip chip-bad" title={result.error}><XCircle size={11} /> Failed</span>
                      )}
                      {uploadRows.length > 1 && (
                        <button onClick={() => removeUploadRow(i)} disabled={uploading} className="p-1 rounded-md" style={{ color: 'var(--bad)' }}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                  {result?.status === 'failed' && (
                    <p className="text-[11px] mb-2" style={{ color: 'var(--bad)' }}>{result.error}</p>
                  )}
                  <div className="grid md:grid-cols-[120px_1fr] gap-3 mb-3">
                    <label className="block">
                      <span className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--ink-3)' }}>Type</span>
                      <select value={row.assetType} onChange={e => updateUploadRow(i, { assetType: e.target.value as 'image' | 'video' })} className="input" disabled={uploading}>
                        <option value="image">Image</option>
                        <option value="video">Video</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--ink-3)' }}>Source URL</span>
                      <input value={row.sourceUrl} onChange={e => updateUploadRow(i, { sourceUrl: e.target.value })} className="input" placeholder="https://..." disabled={uploading} />
                    </label>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3 mb-3">
                    <label className="block">
                      <span className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--ink-3)' }}>Headline</span>
                      <input value={row.headline} onChange={e => updateUploadRow(i, { headline: e.target.value })} className="input" disabled={uploading} />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--ink-3)' }}>CTA</span>
                      <input value={row.cta} onChange={e => updateUploadRow(i, { cta: e.target.value })} className="input" placeholder="e.g. Get My Report" disabled={uploading} />
                    </label>
                  </div>
                  <label className="block">
                    <span className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--ink-3)' }}>Primary text</span>
                    <textarea value={row.primaryText} onChange={e => updateUploadRow(i, { primaryText: e.target.value })} className="input" style={{ minHeight: 60 }} disabled={uploading} />
                  </label>
                </div>
              )
            })}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={addUploadRow} disabled={uploading} className="btn btn-ghost">
              <Plus size={14} /> Add another
            </button>
            <button onClick={handleUploadCreative} disabled={uploading} className="btn btn-primary">
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploading ? 'Uploading…' : `Upload ${uploadRows.length > 1 ? `all ${uploadRows.length}` : 'creative'}`}
            </button>
          </div>
        </div>
      )}

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
          <p className="micro-label mb-1">Generate new creative</p>
          <p className="text-[12px] mb-5" style={{ color: 'var(--ink-4)' }}>A few quick choices, then generate.</p>
          {error && <p className="text-[12.5px] mb-3 px-3 py-2 rounded-lg" style={{ background: 'var(--bad-bg, transparent)', color: 'var(--bad)' }}>{error}</p>}

          {/* ── 1. Image or video ── */}
          <div className="mb-5">
            <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--accent-strong)' }}>1. What are you making?</p>
            <p className="text-[12px] mb-2" style={{ color: 'var(--ink-3)' }}>Image and video creatives need different inputs, so pick one to start.</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => selectCreativeType('image')}
                className="flex items-center gap-2 justify-center px-4 py-3 rounded-lg border font-semibold text-[13px] transition-colors"
                style={{
                  borderColor: creativeType === 'image' ? 'var(--accent-strong)' : 'var(--hairline)',
                  background: creativeType === 'image' ? 'var(--accent-bg)' : 'var(--surface)',
                  color: creativeType === 'image' ? 'var(--accent-strong)' : 'var(--ink)',
                }}
              >
                <ImageIcon size={15} /> Image
              </button>
              <button
                type="button"
                onClick={() => selectCreativeType('video')}
                className="flex items-center gap-2 justify-center px-4 py-3 rounded-lg border font-semibold text-[13px] transition-colors"
                style={{
                  borderColor: creativeType === 'video' ? 'var(--accent-strong)' : 'var(--hairline)',
                  background: creativeType === 'video' ? 'var(--accent-bg)' : 'var(--surface)',
                  color: creativeType === 'video' ? 'var(--accent-strong)' : 'var(--ink)',
                }}
              >
                <VideoIcon size={15} /> Video
              </button>
            </div>
          </div>

          {/* ── 2. Product & language ── */}
          <div className="mb-5 pt-5" style={{ borderTop: '1px solid var(--hairline)' }}>
            <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--accent-strong)' }}>2. Product</p>
            <div className="grid md:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--ink-2)' }}>Which product is this for?</span>
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
          </div>

          {/* ── 3. Format ── */}
          <div className="mb-5 pt-5" style={{ borderTop: '1px solid var(--hairline)' }}>
            <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--accent-strong)' }}>3. Format</p>
            <div className="space-y-3">
              {GROUP_ORDER.filter(g => formatsForType.some(f => f.group === g)).map(group => {
                const { label, icon: GroupIcon } = GROUP_META[group]
                const items = formatsForType.filter(f => f.group === group)
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
                            onClick={() => { setFormat(opt.value); setSelectedHookStyles([]) }}
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
            {format === 'carousel' && (
              <p className="text-[11.5px] mt-3 px-3 py-2 rounded-lg" style={{ background: 'var(--warn-bg)', color: 'var(--warn)' }}>
                Carousels can be generated here, but can&rsquo;t be attached to a campaign yet — that&rsquo;s coming in a future update.
              </p>
            )}
          </div>

          {/* ── 4. Angles to test ── */}
          <div className="mb-5 pt-5" style={{ borderTop: '1px solid var(--hairline)' }}>
            <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--accent-strong)' }}>4. Angles to test</p>
            <p className="text-[12px] mb-3" style={{ color: 'var(--ink-3)' }}>
              {creativeType === 'video'
                ? <>Pick <b>one</b> angle for the video below — a creative only ever produces a single video, so this just decides its style. Leave unpicked to let the AI choose.</>
                : <>Pick 1 or more angles below — <b>each one becomes a separate ad version</b>. Pick several to A/B test, or leave all unpicked to let the AI choose a good spread for you.</>}
            </p>
            <div className="grid sm:grid-cols-2 gap-2 mb-3">
              {(hookStyles?.[hookStyleGroupForFormat(format)] ?? []).map(h => {
                const info = HOOK_STYLE_INFO[h.value] ?? { label: h.value.replace(/_/g, ' '), blurb: '' }
                const order = selectedHookStyles.indexOf(h.value)
                const active = order >= 0
                return (
                  <button
                    key={h.value}
                    type="button"
                    onClick={() => toggleHookStyle(h.value)}
                    className="flex items-start gap-2.5 text-left px-3 py-2.5 rounded-lg border transition-colors"
                    style={{
                      borderColor: active ? 'var(--accent-strong)' : 'var(--hairline)',
                      background: active ? 'var(--accent-bg)' : 'var(--surface)',
                    }}
                  >
                    <span
                      className="flex items-center justify-center shrink-0 rounded-full text-[10.5px] font-bold"
                      style={{
                        width: 20, height: 20, marginTop: 1,
                        background: active ? 'var(--accent-strong)' : 'var(--surface-warm)',
                        color: active ? 'var(--surface)' : 'var(--ink-4)',
                        border: active ? 'none' : '1px solid var(--hairline)',
                      }}
                    >
                      {active ? order + 1 : ''}
                    </span>
                    <span>
                      <span className="block text-[13px] font-semibold" style={{ color: active ? 'var(--accent-strong)' : 'var(--ink)' }}>{info.label}</span>
                      <span className="block text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--ink-4)' }}>{info.blurb}</span>
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="text-[12.5px] font-semibold px-3 py-2 rounded-lg inline-block" style={{ background: 'var(--accent-bg)', color: 'var(--accent-strong)' }}>
              {creativeType === 'video'
                ? (selectedHookStyles.length === 0
                    ? '→ Will create 1 video, style chosen automatically.'
                    : `→ Will create 1 video in the "${HOOK_STYLE_INFO[selectedHookStyles[0]]?.label ?? selectedHookStyles[0]}" style.`)
                : (selectedHookStyles.length === 0
                    ? '→ Will create the format’s default number of ad versions, each a different angle chosen automatically.'
                    : `→ Will create exactly ${selectedHookStyles.length} ad version${selectedHookStyles.length > 1 ? 's' : ''}: ${selectedHookStyles.map(h => HOOK_STYLE_INFO[h]?.label ?? h).join(', ')}.`)}
            </p>
          </div>

          {/* ── 5. Quality (type-specific) ── */}
          <div className="mb-5 pt-5" style={{ borderTop: '1px solid var(--hairline)' }}>
            <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--accent-strong)' }}>
              5. {creativeType === 'video' ? 'Video settings' : 'Image settings'}
            </p>
            {creativeType === 'video' ? (
              <div className="space-y-4">
                <div>
                  <span className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--ink-2)' }}>Video engine</span>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setVideoProvider('heygen')}
                      className="px-3 py-2 rounded-lg border text-[13px] font-semibold transition-colors"
                      style={{
                        borderColor: videoProvider === 'heygen' ? 'var(--accent-strong)' : 'var(--hairline)',
                        background: videoProvider === 'heygen' ? 'var(--accent-bg)' : 'var(--surface)',
                        color: videoProvider === 'heygen' ? 'var(--accent-strong)' : 'var(--ink)',
                      }}
                    >
                      Heygen
                    </button>
                    <button
                      type="button"
                      onClick={() => setVideoProvider('higgsfield')}
                      disabled={higgsfieldModels.length === 0}
                      className="px-3 py-2 rounded-lg border text-[13px] font-semibold transition-colors disabled:opacity-40"
                      style={{
                        borderColor: videoProvider === 'higgsfield' ? 'var(--accent-strong)' : 'var(--hairline)',
                        background: videoProvider === 'higgsfield' ? 'var(--accent-bg)' : 'var(--surface)',
                        color: videoProvider === 'higgsfield' ? 'var(--accent-strong)' : 'var(--ink)',
                      }}
                    >
                      Higgsfield
                    </button>
                  </div>
                  <p className="text-[11px]" style={{ color: 'var(--ink-4)' }}>
                    {videoProvider === 'heygen'
                      ? 'Text-overlay conversion ad style — the default, well-tested path.'
                      : 'Cinematic b-roll via Seedance/Kling/Veo/etc. — no text overlays baked in, real cost per generation shown at the package level after creation.'}
                  </p>
                  {videoProvider === 'higgsfield' && (
                    <label className="block mt-2">
                      <span className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--ink-2)' }}>Model</span>
                      <select value={higgsfieldJobType} onChange={e => setHiggsfieldJobType(e.target.value)} className="input">
                        {higgsfieldModels.map(m => <option key={m.job_type} value={m.job_type}>{m.display_name}</option>)}
                      </select>
                    </label>
                  )}
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--ink-2)' }}>Video aspect ratio</span>
                    <select value={videoAspectRatio} onChange={e => setVideoAspectRatio(e.target.value as typeof videoAspectRatio)} className="input">
                      {VIDEO_ASPECT_RATIOS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--ink-2)' }}>Video resolution</span>
                    <select value={videoResolution} onChange={e => setVideoResolution(e.target.value as typeof videoResolution)} className="input">
                      {VIDEO_RESOLUTIONS.filter(r => videoProvider === 'higgsfield' || r.value !== '480p').map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </label>
                </div>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
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
              </div>
            )}
          </div>

          {/* ── 6. Advanced ── */}
          <div className="mb-5 pt-5" style={{ borderTop: '1px solid var(--hairline)' }}>
            <button
              onClick={() => setShowAdvanced(s => !s)}
              className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide"
              style={{ color: 'var(--accent-strong)' }}
            >
              <ChevronDown size={12} style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
              6. Advanced — custom brief {showAdvanced ? '(hide)' : '(optional, defaults are fine)'}
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-4">
                {creativeType === 'video' && (
                  <div className="grid md:grid-cols-2 gap-4">
                    <label className="block">
                      <span className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--ink-2)' }}>Image aspect ratio <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>(this format also generates per-variant images)</span></span>
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
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-4">
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
              </div>
            )}
          </div>

          {/* ── Summary + Generate ── */}
          <div className="flex items-center justify-between flex-wrap gap-3 pt-5" style={{ borderTop: '1px solid var(--hairline)' }}>
            <p className="text-[12.5px]" style={{ color: 'var(--ink-3)' }}>
              {product
                ? creativeType === 'video'
                  ? <>Ready: <b>1 video</b> ({videoProvider === 'higgsfield' ? higgsfieldModels.find(m => m.job_type === higgsfieldJobType)?.display_name ?? 'Higgsfield' : 'Heygen'}) for <b>{product}</b>{language ? <> in <b>{language}</b></> : ''}.</>
                  : <>Ready: <b>{selectedHookStyles.length || 'a few'}</b> {formats.find(f => f.value === format)?.label.toLowerCase() ?? format} ad{selectedHookStyles.length === 1 ? '' : 's'} for <b>{product}</b>{language ? <> in <b>{language}</b></> : ''}.</>
                : 'Pick a product above to get started.'}
            </p>
            <button onClick={handleGenerate} disabled={submitting || !product} className="btn btn-primary">
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {submitting ? 'Starting…' : 'Generate'}
            </button>
          </div>
        </div>
      )}

      {/* Tab bar — underline style, matching runs/page.tsx's convention */}
      <div className="flex items-center gap-1 border-b mb-6" style={{ borderColor: 'var(--hairline)' }}>
        {([{ key: 'active' as const, label: 'Active' }, { key: 'rejected' as const, label: 'Rejected' }]).map(tab => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="relative px-4 py-3 text-[13px] font-medium transition-colors"
              style={{ color: isActive ? 'var(--ink)' : 'var(--ink-3)' }}
            >
              {tab.label}
              {tab.key === 'rejected' && rejectedAssets.length > 0 && (
                <span className="ml-1.5 text-[10px] font-semibold mono tabular-nums" style={{ color: isActive ? 'var(--accent)' : 'var(--ink-4)' }}>
                  {rejectedAssets.length}
                </span>
              )}
              {isActive && (
                <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full" style={{ background: 'var(--accent)' }} />
              )}
            </button>
          )
        })}
      </div>

      {activeTab === 'active' ? (
        <>
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
            {/* A breadcrumb, not a listing — the creative itself stays out of
                this tab, but a silent drop in count reads as data loss. */}
            {hiddenRejectedCount > 0 && (
              <button
                onClick={() => setActiveTab('rejected')}
                className="text-[11.5px]"
                style={{ color: 'var(--ink-4)' }}
                title="Every asset on these creatives was rejected. Restore one from the Rejected tab to bring it back here."
              >
                {hiddenRejectedCount} fully-rejected hidden
              </button>
            )}
          </div>

          {visiblePackages.length === 0 ? (
            <div className="card px-6 py-14 text-center">
              <p style={{ color: 'var(--ink-3)' }}>
                {packages.length === 0 ? 'No creative yet.' : 'No usable creative here.'}
              </p>
              <p className="text-[13px] mt-1.5" style={{ color: 'var(--ink-4)' }}>
                {packages.length === 0
                  ? <>Click <b>Generate new creative</b> above to make your first one.</>
                  : <>Every creative here has been rejected — see the <b>Rejected</b> tab to restore one.</>}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {visiblePackages.map(pkg => {
                const selected = pkg.copyVariants?.[pkg.selectedCopyIndex ?? 0]
                const isCarousel = (pkg.carouselCards?.length ?? 0) > 0
                // Match on variantIndex and skip rejected/derived entries
                // rather than indexing images[] positionally: a variant can
                // hold several entries (pre-made sizes, or canvas-extended
                // placement sizes appended by the resizer), so position stopped
                // tracking variant long ago — and a derived size would show the
                // blur-margined version as the library thumbnail.
                const variantImages = (pkg.images ?? []).filter(
                  im => im.variantIndex === (pkg.selectedCopyIndex ?? 0) && im.imageUrl && !im.rejected,
                )
                const thumb = (variantImages.find(im => !im.extendedFrom) ?? variantImages[0])?.imageUrl
                  || (pkg.images ?? []).find(im => im.imageUrl && !im.rejected && !im.extendedFrom)?.imageUrl
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
                        {(() => {
                          // Derived from usable assets, not `status` alone —
                          // see creativePackageStatus for why they differ.
                          const s = creativePackageStatus(pkg)
                          return <span className={`chip ${s.chip}`}>{s.label}</span>
                        })()}
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
        </>
      ) : (
        <>
          {rejectedLoading ? (
            <div className="flex items-center justify-center py-14">
              <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent)' }} />
            </div>
          ) : rejectedAssets.length === 0 ? (
            <div className="card px-6 py-14 text-center">
              <p style={{ color: 'var(--ink-3)' }}>Nothing rejected.</p>
              <p className="text-[13px] mt-1.5" style={{ color: 'var(--ink-4)' }}>
                Reject an image or video from its package page, or from the Gallery, and it'll show up here — fully reversible.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {rejectedAssets.map(asset => {
                const key = `${asset.packageId}-${asset.assetType}-${asset.variantIndex}`
                return (
                  <div key={key} className="card overflow-hidden">
                    <div className="relative" style={{ aspectRatio: '4/5', background: 'var(--surface-warm)' }}>
                      {asset.assetType === 'video' ? (
                        <video src={asset.assetUrl} className="w-full h-full object-cover" muted />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={asset.assetUrl} alt="Rejected creative" className="w-full h-full object-cover" />
                      )}
                      <span className="chip chip-bad" style={{ position: 'absolute', top: 8, right: 8 }}>
                        {asset.assetType === 'video' ? <VideoIcon size={11} /> : <ImageIcon size={11} />}
                      </span>
                    </div>
                    <div className="p-3">
                      <p className="text-[11.5px] mt-0.5 mb-2" style={{ color: 'var(--ink-3)' }}>{asset.productName || '—'}</p>
                      <Link
                        href={`/dashboard/${tenantId}/creatives/${asset.packageId}`}
                        className="text-[11.5px] font-medium block mb-2"
                        style={{ color: 'var(--accent-strong)' }}
                      >
                        View source package →
                      </Link>
                      <button
                        onClick={() => handleRestoreRejected(asset)}
                        disabled={restoringId === key}
                        className="btn btn-primary w-full"
                        style={{ fontSize: '11px' }}
                      >
                        {restoringId === key ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                        Restore
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
