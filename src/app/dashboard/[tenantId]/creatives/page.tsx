'use client'

import { useState, useEffect, use, useCallback } from 'react'
import Link from 'next/link'
import {
  Sparkles, Loader2, Image as ImageIcon, Video as VideoIcon, ChevronDown, RefreshCw, LayoutGrid, Zap, Upload, RotateCcw,
  ArrowRight, CheckCircle2, Clock3, FolderOpen,
} from 'lucide-react'
import { getCompany, listCreativePackages, generateProductCreative, getCreativeLanguages, getCreativeFormats, getHookStyles, getHiggsfieldModels, getHiggsfieldModel, getRejectedAssets, restoreAsset, getCustomBriefOptions, startCustomBriefRun, uploadCustomBriefImages } from '@/lib/api'
import { CustomBriefProgress } from '@/components/creative/CustomBriefProgress'
import { ImageDirectionModal } from '@/components/creative/ImageDirectionModal'
import type { CustomBriefOptions, CustomBriefMethod, CustomBriefTrack, CustomBriefImageRef } from '@/types'
import type { Company, CreativeImage, CreativePackage } from '@/types'
import type { CreativeFormatOption, HookStyleGroups, HiggsfieldModelSummary, RejectedAssetItem } from '@/lib/api'
import { CreativeUploadForm } from '@/components/creative/CreativeUploadForm'
import { creativePackageStatus } from '@/lib/utils'

// Which hookStyle group applies to a given format id — matches format-specs.ts's group assignments.
function hookStyleGroupForFormat(format: string): keyof HookStyleGroups {
  if (format === 'meme') return 'meme'
  if (format === 'screenshot') return 'screenshot'
  if (format === 'poll_quiz') return 'poll'
  return 'dr'
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

function usableAssetCount(pkg: CreativePackage): number {
  const images = (pkg.images ?? []).filter((image) => image.imageUrl && !image.rejected && !image.extendedFrom && !image.uploadedSizeOf).length
  const videos = (pkg.videos ?? []).filter((video) => video.videoUrl && !video.rejected).length
  const primaryVideo = pkg.video?.videoUrl && !pkg.video.rejected ? 1 : 0
  const cards = (pkg.carouselCards ?? []).filter((card) => card.imageUrl).length
  return images + videos + primaryVideo + cards
}

export default function CreativesPage({ params }: PageProps) {
  const { tenantId } = use(params)

  const [company, setCompany] = useState<Company | null>(null)
  const [packages, setPackages] = useState<CreativePackage[]>([])
  const [packagesError, setPackagesError] = useState('')
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
  // The form itself is shared with the Gallery's own "Upload new" tab
  // (CreativeUploadForm), so file-picking, drag-and-drop and multi-size rows
  // behave identically wherever an upload starts.
  const [showUploadForm, setShowUploadForm] = useState(false)

  // ── Custom brief: route this form through the external creative pipeline ──
  // Purely additive. `engine` stays 'standard' unless the operator flips it, so
  // every existing path behaves exactly as before.
  const [engine, setEngine] = useState<'standard' | 'pipeline'>('standard')
  const [cbOptions, setCbOptions] = useState<CustomBriefOptions | null>(null)
  const [cbOptionsError, setCbOptionsError] = useState('')
  const [cbMethod, setCbMethod] = useState<CustomBriefMethod>('create')
  const [cbTrack, setCbTrack] = useState<CustomBriefTrack>('polished')
  // WHICH product the creative is for. Deliberately starts empty with no default: the pipeline
  // used to receive no product at all and fall back to its manifest default, so every brief here
  // became a Nadi Report. Pre-selecting the first option would just move that guess into the form.
  const [cbOffering, setCbOffering] = useState('')
  const [cbCount, setCbCount] = useState('')
  const [cbPrompt, setCbPrompt] = useState('')
  const [cbRunId, setCbRunId] = useState<number | null>(null)
  // Slack-side selections. All multi-select, all optional: this path is prompt-driven, so anything
  // left unpicked means "the pipeline decides", which is its normal behaviour.
  const [cbFormats, setCbFormats] = useState<string[]>([])
  const [cbAngles, setCbAngles] = useState<string[]>([])
  const [cbLanguages, setCbLanguages] = useState<string[]>([])
  // Free write-in, for a language that isn't on the served list.
  const [cbLanguageWriteIn, setCbLanguageWriteIn] = useState('')
  // Reference image. `cbImageDirection` is REQUIRED once a file is attached — Slack asks it with a
  // button afterwards, but this form has no follow-up turn, so it is asked up front.
  const [cbFiles, setCbFiles] = useState<File[]>([])
  const [cbImageDirection, setCbImageDirection] = useState('')
  const [cbDirectionOpen, setCbDirectionOpen] = useState(false)
  const [cbUploading, setCbUploading] = useState(false)

  const toggleIn = (list: string[], value: string) =>
    list.includes(value) ? list.filter(v => v !== value) : [...list, value]

  /**
   * A Slack-pipeline run outlives the page.
   *
   * `cbRunId` was React state only, so a refresh (or navigating away and back) orphaned an in-flight
   * run: the pipeline kept working, the operator just lost the only view of it and had no way back.
   * The run id is persisted per tenant and restored on mount, then cleared once the run settles.
   * localStorage rather than the URL because the value is per-browser bookkeeping, not something
   * worth putting in a shareable link — and `slack_runs` remains the source of truth either way.
   */
  const runKey = `cb_active_run_${tenantId}`

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const saved = window.localStorage.getItem(runKey)
      if (saved && /^\d+$/.test(saved)) setCbRunId(Number(saved))
    } catch {
      // Private/locked-down browsers can block storage. The live run still
      // works for this page session; only cross-refresh restoration is lost.
    }
  }, [runKey])

  const rememberRun = useCallback((id: number | null) => {
    setCbRunId(id)
    if (typeof window === 'undefined') return
    try {
      if (id === null) window.localStorage.removeItem(runKey)
      else window.localStorage.setItem(runKey, String(id))
    } catch {
      // Persistence is best-effort and must never make a successful run look
      // like it failed.
    }
  }, [runKey])

  /** Everything the operator typed or ticked, merged into what the API expects. */
  const cbSelectedLanguages = [
    ...cbLanguages,
    ...cbLanguageWriteIn.split(',').map(s => s.trim()).filter(Boolean),
  ]
  // What the count field produces for the selected method — creatives fan out into one run each,
  // research runs once and adds that many ideas to the board. Served by the pipeline so the two
  // sides can't drift.
  const cbCountNoun =
    (cbOptions?.methods.find(m => m.value === cbMethod) as { count_noun?: string } | undefined)
      ?.count_noun ?? (cbMethod === 'research' ? 'idea' : 'creative')

  const loadPackages = useCallback(async () => {
    try {
      const list = await listCreativePackages(tenantId, {
        productName: filterProduct || undefined,
        targetLanguage: filterLanguage || undefined,
      })
      setPackages(list)
      setPackagesError('')
    } catch (e) {
      // Keep whatever is already on screen — a transient failure should not blank the library.
      // But SAY so: silently swallowing this made "the load failed" and "there is nothing here"
      // look identical, which is how a working library appeared to lose its creatives.
      setPackagesError(e instanceof Error ? e.message : 'Could not refresh the library')
    }
  }, [tenantId, filterProduct, filterLanguage])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        // Every one of these is independently optional, so every one needs its own
        // catch. `getCompany` used to be the odd one out, and because Promise.all
        // rejects on the FIRST rejection, a tenant with no Company record (404)
        // skipped every setter below it — leaving the Format and Angles pickers
        // silently empty even though /creative/formats and /creative/hook-styles
        // had both answered 200. The lists are not the problem; the abort was.
        const [c, langs, fmts, hooks, hfModels] = await Promise.all([
          getCompany(tenantId).catch(() => null),
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
        const active = c?.products?.find(p => p.active !== false) ?? c?.products?.[0]
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

  // Options are fetched from the pipeline (via the bridge) rather than hardcoded,
  // so its formats/angles/languages stay in sync without a deploy here. Loaded
  // lazily — nobody pays for it unless they flip the engine.
  useEffect(() => {
    if (engine !== 'pipeline' || cbOptions) return
    let cancelled = false
    getCustomBriefOptions(tenantId)
      .then(opts => { if (!cancelled) { setCbOptions(opts); setCbOptionsError('') } })
      .catch(e => {
        if (!cancelled) {
          setCbOptionsError(e instanceof Error ? e.message : 'Pipeline unavailable')
        }
      })
    return () => { cancelled = true }
  }, [engine, cbOptions, tenantId])

  async function handleCustomBriefGenerate() {
    if (!cbPrompt.trim()) { setError('Describe what you want in the brief box'); return }
    // The product decides which research pack the copy is written from, the folder the creative is
    // filed in and the name it carries here. The pipeline requires it for an astro create and
    // answers with a 400 listing the allowed values; catch it here rather than round-tripping.
    if (cbMethod === 'create' && !cbOffering) {
      setError('Choose which product this creative is for')
      return
    }
    // The pipeline rejects an image with no direction (there is no follow-up turn to ask in), so
    // catch it here rather than round-tripping for a 400.
    if (cbFiles.length > 0 && !cbImageDirection) {
      setError('Choose what the pipeline should do with your image')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      // Upload first: the run body stays plain JSON, which is what the bridge proxies.
      let imageRefs: CustomBriefImageRef[] | undefined
      if (cbFiles.length > 0) {
        setCbUploading(true)
        try {
          imageRefs = (await uploadCustomBriefImages(tenantId, cbFiles)).refs
        } finally {
          setCbUploading(false)
        }
      }
      const res = await startCustomBriefRun(tenantId, {
        method: cbMethod,
        prompt: cbPrompt.trim(),
        // Sent as typed. Empty means "use the pipeline's default" (5) — the
        // pipeline owns that rule so there is one source of truth, not two.
        count: cbCount.trim() || undefined,
        track: cbTrack,
        domain: 'astro',
        // The product. Sent for 'create' only; a research run discovers the subject rather than
        // being told it, and the pipeline infers it there only when unambiguous.
        offering: cbMethod === 'create' ? cbOffering : undefined,
        // Several languages SPLIT the run round-robin rather than multiplying it.
        languages: cbSelectedLanguages.length ? cbSelectedLanguages : undefined,
        formats: cbFormats.length ? cbFormats : undefined,
        angles: cbAngles.length ? cbAngles : undefined,
        image_refs: imageRefs,
        image_direction: imageRefs ? cbImageDirection : undefined,
      })
      rememberRun(res.run_id)
      setShowForm(false)
      setCbPrompt('')
      setCbFiles([])
      setCbImageDirection('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start the pipeline run')
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

  if (loading) {
    return (
      <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8 max-w-[1600px] mx-auto" role="status" aria-label="Loading Creative Studio">
        <div className="skeleton h-9 w-64 mb-3" />
        <div className="skeleton h-5 w-full max-w-xl mb-8" />
        <div className="grid sm:grid-cols-3 gap-3 mb-8">
          <div className="skeleton h-24" />
          <div className="skeleton h-24" />
          <div className="skeleton h-24" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((item) => <div key={item} className="skeleton aspect-[4/5]" />)}
        </div>
        <span className="sr-only">Loading creative library…</span>
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
  const readyPackages = visiblePackages.filter((pkg) => creativePackageStatus(pkg).label === 'Ready').length
  const pendingPackages = packages.filter((pkg) => pkg.status === 'pending').length
  const pendingBriefNotListed = pendingBriefId && !packages.some((pkg) => pkg.briefId === pendingBriefId) ? 1 : 0
  const producingPackages = pendingPackages + pendingBriefNotListed + (cbRunId !== null ? 1 : 0)
  const reusableAssets = visiblePackages.reduce((sum, pkg) => sum + usableAssetCount(pkg), 0)
  const coveredProducts = new Set(visiblePackages.map((pkg) => pkg.productName).filter(Boolean)).size
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
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8 max-w-[1600px] mx-auto stagger">
      <div className="flex items-start justify-between gap-5 mb-6 flex-wrap">
        <div className="max-w-2xl">
          <p className="micro-label mb-2">Creative Studio</p>
          <h1 className="page-title">Create once. Reuse everywhere.</h1>
          <p className="page-subtitle">
            Generate, upload and organize campaign-ready creative in one reusable system.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={() => loadPackages()} className="btn btn-ghost" aria-label="Refresh creative library">
            <RefreshCw size={14} /> Refresh
          </button>
          <Link href={`/dashboard/${tenantId}/gallery`} className="btn btn-ghost">
            <FolderOpen size={14} /> Open Gallery
          </Link>
          <button type="button" onClick={() => setShowUploadForm(s => !s)} className="btn btn-ghost" aria-expanded={showUploadForm}>
            <Upload size={14} /> Upload creative
          </button>
          <button type="button" onClick={() => setShowForm(s => !s)} className="btn btn-primary" aria-expanded={showForm}>
            <Sparkles size={14} /> Generate with AI
          </button>
        </div>
      </div>

      <div className="card p-5 mb-5" style={{ background: 'linear-gradient(120deg, var(--accent-bg), var(--surface) 55%)' }}>
        <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
          <div>
            <p className="micro-label mb-1">Reusable creative workflow</p>
            <h2 className="section-title">From an idea to a campaign-ready asset</h2>
          </div>
          <Link href={`/dashboard/${tenantId}/gallery`} className="inline-flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: 'var(--accent-strong)' }}>
            Organize the library <ArrowRight size={14} />
          </Link>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          {[
            { step: '01', title: 'Create', copy: 'Generate with AI or upload approved work.', icon: Sparkles },
            { step: '02', title: 'Organize', copy: 'Group assets by product, topic and campaign.', icon: LayoutGrid },
            { step: '03', title: 'Reuse', copy: 'Attach reusable creative to future launches.', icon: CheckCircle2 },
          ].map(({ step, title, copy, icon: Icon }) => (
            <div key={step} className="rounded-xl p-4 flex items-start gap-3" style={{ background: 'rgba(255,255,255,0.82)', border: '1px solid var(--hairline)' }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--accent-bg)', color: 'var(--accent-strong)' }}>
                <Icon size={16} />
              </div>
              <div>
                <p className="text-[11px] font-semibold mb-0.5" style={{ color: 'var(--ink-3)' }}>{step}</p>
                <p className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>{title}</p>
                <p className="text-[12px] mt-1 leading-relaxed" style={{ color: 'var(--ink-3)' }}>{copy}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Ready packages', value: readyPackages, icon: CheckCircle2, color: 'var(--good)', background: 'var(--good-bg)' },
          { label: 'Reusable assets', value: reusableAssets, icon: ImageIcon, color: 'var(--accent)', background: 'var(--accent-bg)' },
          { label: 'Products covered', value: coveredProducts, icon: LayoutGrid, color: 'var(--info)', background: 'var(--info-bg)' },
          { label: 'In production', value: producingPackages, icon: Clock3, color: producingPackages > 0 ? 'var(--warn)' : 'var(--ink-3)', background: producingPackages > 0 ? 'var(--warn-bg)' : 'var(--muted)' },
        ].map(({ label, value, icon: Icon, color, background }) => (
          <div key={label} className="card p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ color, background }}><Icon size={16} /></div>
            <div className="min-w-0">
              <p className="micro-label truncate">{label}</p>
              <p className="display-num text-[22px] mt-1" style={{ color: 'var(--ink)' }}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {showUploadForm && (
        <div className="card p-5 sm:p-6 mb-6">
          <p className="micro-label mb-1">Add existing work</p>
          <h2 className="section-title">Upload campaign-ready creative</h2>
          <p className="text-[13px] mt-1 mb-5 max-w-3xl" style={{ color: 'var(--ink-3)' }}>
            Add files or links in one batch. Meridian stores each usable asset in the library and organizes it in Gallery without allowing one failed item to block the rest.
          </p>
          <CreativeUploadForm
            tenantId={tenantId}
            products={products}
            defaultProduct={products.find(p => p.active !== false)?.name}
            onUploaded={() => { loadPackages() }}
          />
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

      {error && !showForm && (
        <div className="rounded-xl px-4 py-3 mb-5 flex items-center justify-between gap-3 text-[13px]" style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad-border)', color: 'var(--bad)' }} role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} className="text-[12px] font-semibold underline">Dismiss</button>
        </div>
      )}

      {showForm && (
        <div className="card p-5 sm:p-6 mb-6">
          <p className="micro-label mb-1">AI production brief</p>
          <h2 className="section-title">Generate campaign-ready creative</h2>
          <p className="text-[13px] mt-1 mb-5" style={{ color: 'var(--ink-3)' }}>Set the essentials, then let the creative system produce reusable assets.</p>
          {error && <p className="text-[12.5px] mb-3 px-3 py-2 rounded-lg" style={{ background: 'var(--bad-bg, transparent)', color: 'var(--bad)' }}>{error}</p>}

          {/* ── Engine — which system makes this creative ──
              Additive: 'standard' is the default and leaves every existing
              path untouched. 'pipeline' hands the same form over to the
              external creative pipeline instead. */}
          <div className="mb-5">
            <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--accent-strong)' }}>Production path</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEngine('standard')}
                className="text-left px-4 py-3 rounded-lg border transition-colors"
                style={{
                  borderColor: engine === 'standard' ? 'var(--accent-strong)' : 'var(--hairline)',
                  background: engine === 'standard' ? 'var(--accent-bg)' : 'var(--surface)',
                }}
              >
                <span className="block text-[13px] font-semibold" style={{ color: engine === 'standard' ? 'var(--accent-strong)' : 'var(--ink)' }}>Meridian generator</span>
                <span className="block text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--ink-3)' }}>Guided production for images, video and carousels.</span>
              </button>
              <button
                type="button"
                onClick={() => { setEngine('pipeline'); selectCreativeType('image') }}
                className="text-left px-4 py-3 rounded-lg border transition-colors"
                style={{
                  borderColor: engine === 'pipeline' ? 'var(--accent-strong)' : 'var(--hairline)',
                  background: engine === 'pipeline' ? 'var(--accent-bg)' : 'var(--surface)',
                }}
              >
                <span className="block text-[13px] font-semibold" style={{ color: engine === 'pipeline' ? 'var(--accent-strong)' : 'var(--ink)' }}>Autonomous creative team</span>
                <span className="block text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--ink-3)' }}>Describe the outcome in one sentence; the pipeline handles image production.</span>
              </button>
            </div>
          </div>

          {engine === 'pipeline' && (
            <div className="mb-5 pt-5" style={{ borderTop: '1px solid var(--hairline)' }}>
              {cbOptionsError && (
                <p className="text-[12px] mb-3 px-3 py-2 rounded-lg" style={{ background: 'var(--warn-bg)', color: 'var(--warn)' }}>
                  The autonomous creative pipeline is unavailable ({cbOptionsError}). You can retry shortly or use the Meridian generator.
                </p>
              )}

              {/* Method — create and research are two different jobs. */}
              <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--accent-strong)' }}>What do you want?</p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {(cbOptions?.methods ?? [
                  { value: 'create', label: 'Create', hint: 'Author briefs and generate creatives.' },
                  { value: 'research', label: 'Research', hint: 'Build the research + idea board creatives draw from.' },
                ]).map(m => {
                  const active = cbMethod === m.value
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setCbMethod(m.value as CustomBriefMethod)}
                      className="text-left px-4 py-3 rounded-lg border transition-colors"
                      style={{
                        borderColor: active ? 'var(--accent-strong)' : 'var(--hairline)',
                        background: active ? 'var(--accent-bg)' : 'var(--surface)',
                      }}
                    >
                      <span className="block text-[13px] font-semibold" style={{ color: active ? 'var(--accent-strong)' : 'var(--ink)' }}>{m.label}</span>
                      <span className="block text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--ink-4)' }}>{m.hint}</span>
                    </button>
                  )
                })}
              </div>

              {/* Style — replaces the pipeline's own classifier with an explicit choice. */}
              <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--accent-strong)' }}>Style</p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {(cbOptions?.tracks ?? [
                  { value: 'polished', label: 'Polished', hint: 'A designed ad — the default.' },
                  { value: 'raw', label: 'Raw', hint: 'An organic-looking post or meme.' },
                ]).map(t => {
                  const active = cbTrack === t.value
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setCbTrack(t.value as CustomBriefTrack)}
                      className="text-left px-4 py-3 rounded-lg border transition-colors"
                      style={{
                        borderColor: active ? 'var(--accent-strong)' : 'var(--hairline)',
                        background: active ? 'var(--accent-bg)' : 'var(--surface)',
                      }}
                    >
                      <span className="block text-[13px] font-semibold" style={{ color: active ? 'var(--accent-strong)' : 'var(--ink)' }}>{t.label}</span>
                      <span className="block text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--ink-4)' }}>{t.hint}</span>
                    </button>
                  )
                })}
              </div>

              {/* Product — mandatory for a create, and never defaulted.

                  Until this existed the form sent no product at all: the backend DTO did not
                  declare the field (ValidationPipe whitelist stripped it) and the pipeline's own
                  request model did not either, so it fell back to its manifest default. Every
                  brief here was written from the Nadi research pack, filed in the Nadi folder and
                  labelled "Nadi Report" regardless of what was asked for.

                  No pre-selected option on purpose — a default is what caused the bug. */}
              {cbMethod === 'create' && (
                <div className="mb-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--accent-strong)' }}>
                    Product <span style={{ color: 'var(--ink-4)' }}>· required</span>
                  </p>
                  <select
                    value={cbOffering}
                    onChange={e => setCbOffering(e.target.value)}
                    className="input"
                    aria-label="Which product is this creative for?"
                    aria-required="true"
                  >
                    <option value="">Choose a product…</option>
                    {(cbOptions?.offerings ?? []).map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <span className="block text-[11px] mt-1.5 leading-snug" style={{ color: 'var(--ink-4)' }}>
                    {cbOptions && (cbOptions.offerings ?? []).length === 0
                      ? 'No products are configured in the pipeline — creatives cannot be started until one is.'
                      : 'Decides the research the copy is written from, the folder it is filed in, and the name it carries here.'}
                  </span>
                </div>
              )}

              {/* Brief + count. */}
              <div className="grid md:grid-cols-[1fr_160px] gap-4">
                <label className="block">
                  <span className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--ink-2)' }}>
                    {cbMethod === 'research' ? 'What should we research?' : 'Describe the creative'}
                  </span>
                  <textarea
                    value={cbPrompt}
                    onChange={e => setCbPrompt(e.target.value)}
                    rows={3}
                    className="input"
                    placeholder={cbMethod === 'research'
                      ? 'e.g. Nadi report — what people search for before buying'
                      : 'e.g. a Nadi report ad that opens on the fear of a wrong marriage match'}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--ink-2)' }}>
                    How many {cbCountNoun}s?
                  </span>
                  <input
                    value={cbCount}
                    onChange={e => setCbCount(e.target.value)}
                    inputMode="numeric"
                    className="input"
                    placeholder={String(cbOptions?.count.default ?? 5)}
                  />
                  <span className="block text-[11px] mt-1.5 leading-snug" style={{ color: 'var(--ink-4)' }}>
                    Leave blank for {cbOptions?.count.default ?? 5}.
                    {cbMethod === 'research' && ' Research runs once — this is how many ideas it adds to the board.'}
                  </span>
                </label>
              </div>

              <p className="text-[12px] mt-3" style={{ color: 'var(--ink-3)' }}>
                Everything below is optional — leave it all unpicked and the pipeline decides for
                you from the prompt alone.
              </p>

              {/* Languages. Several SPLIT the run round-robin rather than multiplying it. */}
              <p className="text-[11px] font-bold uppercase tracking-wide mt-5 mb-2" style={{ color: 'var(--accent-strong)' }}>Languages</p>
              <div className="flex flex-wrap gap-2 mb-2">
                {(cbOptions?.languages ?? []).map(lang => {
                  const active = cbLanguages.includes(lang)
                  return (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setCbLanguages(l => toggleIn(l, lang))}
                      className="px-3 py-1.5 rounded-full border text-[12.5px] transition-colors"
                      style={{
                        borderColor: active ? 'var(--accent-strong)' : 'var(--hairline)',
                        background: active ? 'var(--accent-bg)' : 'var(--surface)',
                        color: active ? 'var(--accent-strong)' : 'var(--ink-2)',
                      }}
                    >
                      {lang}
                    </button>
                  )
                })}
              </div>
              <input
                value={cbLanguageWriteIn}
                onChange={e => setCbLanguageWriteIn(e.target.value)}
                className="input"
                placeholder="Or write them in, comma-separated — e.g. Bhojpuri, Konkani"
              />
              <p className="text-[11px] mt-1.5 leading-snug" style={{ color: 'var(--ink-4)' }}>
                {cbSelectedLanguages.length > 1
                  ? <>Your {cbCount.trim() || cbOptions?.count.default || 5} {cbCountNoun}s will be
                      <b> split across</b> {cbSelectedLanguages.length} languages — not multiplied by them.</>
                  : 'Pick several and the run is split across them, round-robin.'}
              </p>

              {/* Special formats — multi-select, folded into the brief as instructions. */}
              <p className="text-[11px] font-bold uppercase tracking-wide mt-5 mb-2" style={{ color: 'var(--accent-strong)' }}>Special formats</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {(cbOptions?.formats ?? []).filter(f => f.value !== 'image').map(f => {
                  const active = cbFormats.includes(f.value)
                  return (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setCbFormats(l => toggleIn(l, f.value))}
                      className="text-left px-3 py-2.5 rounded-lg border transition-colors"
                      style={{
                        borderColor: active ? 'var(--accent-strong)' : 'var(--hairline)',
                        background: active ? 'var(--accent-bg)' : 'var(--surface)',
                      }}
                    >
                      <span className="block text-[13px] font-semibold" style={{ color: active ? 'var(--accent-strong)' : 'var(--ink)' }}>{f.label}</span>
                      <span className="block text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--ink-4)' }}>{f.hint}</span>
                    </button>
                  )
                })}
              </div>

              {/* Angles — multi-select. */}
              <p className="text-[11px] font-bold uppercase tracking-wide mt-5 mb-2" style={{ color: 'var(--accent-strong)' }}>Angles</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {(cbOptions?.angles ?? []).map(a => {
                  const active = cbAngles.includes(a.value)
                  return (
                    <button
                      key={a.value}
                      type="button"
                      onClick={() => setCbAngles(l => toggleIn(l, a.value))}
                      className="text-left px-3 py-2.5 rounded-lg border transition-colors"
                      style={{
                        borderColor: active ? 'var(--accent-strong)' : 'var(--hairline)',
                        background: active ? 'var(--accent-bg)' : 'var(--surface)',
                      }}
                    >
                      <span className="block text-[13px] font-semibold" style={{ color: active ? 'var(--accent-strong)' : 'var(--ink)' }}>{a.label}</span>
                      <span className="block text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--ink-4)' }}>{a.hint}</span>
                    </button>
                  )
                })}
              </div>

              {/* Reference image. The direction is asked in a popup the moment a file is chosen —
                  Slack asks it with buttons on a follow-up message, but this form has no second
                  turn, so it has to be answered before submit. */}
              <p className="text-[11px] font-bold uppercase tracking-wide mt-5 mb-2" style={{ color: 'var(--accent-strong)' }}>Reference image</p>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={e => {
                  const picked = Array.from(e.target.files ?? [])
                  setCbFiles(picked)
                  setCbImageDirection('')
                  setCbDirectionOpen(picked.length > 0)
                }}
                className="text-[12.5px]"
                style={{ color: 'var(--ink-2)' }}
              />
              {cbFiles.length > 0 && (
                <p className="text-[12px] mt-2" style={{ color: 'var(--ink-2)' }}>
                  {cbFiles.length === 1 ? cbFiles[0].name : `${cbFiles.length} images attached`}
                  {cbImageDirection ? (
                    <>
                      {' · '}
                      <b>{cbOptions?.image_directions?.find(d => d.value === cbImageDirection)?.label ?? cbImageDirection}</b>
                      {' · '}
                      <button
                        type="button"
                        onClick={() => setCbDirectionOpen(true)}
                        className="underline"
                        style={{ color: 'var(--accent-strong)' }}
                      >
                        change
                      </button>
                    </>
                  ) : (
                    <>
                      {' — '}
                      <button
                        type="button"
                        onClick={() => setCbDirectionOpen(true)}
                        className="underline"
                        style={{ color: 'var(--accent-strong)' }}
                      >
                        choose what to do with it
                      </button>
                    </>
                  )}
                </p>
              )}
            </div>
          )}

          {/* ── 1. Image or video ──
              Hidden for the pipeline engine, which produces images only. */}
          <div className="mb-5" hidden={engine === 'pipeline'}>
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
          <div className="mb-5 pt-5" hidden={engine === 'pipeline'} style={{ borderTop: '1px solid var(--hairline)' }}>
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
          <div className="mb-5 pt-5" hidden={engine === 'pipeline'} style={{ borderTop: '1px solid var(--hairline)' }}>
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
          <div className="mb-5 pt-5" hidden={engine === 'pipeline'} style={{ borderTop: '1px solid var(--hairline)' }}>
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
          <div className="mb-5 pt-5" hidden={engine === 'pipeline'} style={{ borderTop: '1px solid var(--hairline)' }}>
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
          <div className="mb-5 pt-5" hidden={engine === 'pipeline'} style={{ borderTop: '1px solid var(--hairline)' }}>
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
            {engine === 'pipeline' ? (
              <>
                <p className="text-[12.5px]" style={{ color: 'var(--ink-3)' }}>
                  {cbPrompt.trim()
                    ? <>Ready: <b>{cbCount.trim() || cbOptions?.count.default || 5}</b> {cbMethod === 'research' ? cbCountNoun : `${cbTrack} ${cbCountNoun}`}{(cbCount.trim() || '5') === '1' ? '' : 's'} from your brief{cbSelectedLanguages.length ? <> across <b>{cbSelectedLanguages.join(', ')}</b></> : ''}.</>
                    : 'Describe what you want above to get started.'}
                </p>
                <button
                  onClick={handleCustomBriefGenerate}
                  disabled={submitting || !cbPrompt.trim() || (cbMethod === 'create' && !cbOffering) || (cbFiles.length > 0 && !cbImageDirection)}
                  className="btn btn-primary"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {cbUploading ? 'Uploading…' : submitting ? 'Starting…' : cbMethod === 'research' ? 'Run research' : 'Generate'}
                </button>
              </>
            ) : (
            <>
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
            </>
            )}
          </div>
        </div>
      )}

      {/* Live progress for a Custom-brief run. Finished creatives arrive in the
          library below on their own — the pipeline pushes them in as ordinary
          creative packages — so this just reloads the list when the run settles. */}
      {cbRunId !== null && (
        <CustomBriefProgress
          tenantId={tenantId}
          runId={cbRunId}
          statusPhases={cbOptions?.status_phases}
          onFinished={() => { void loadPackages() }}
          onDismiss={() => rememberRun(null)}
        />
      )}

      {/* Pops the moment a reference image is chosen. Dismissing drops the attachment, because an
          image with no direction is not a state the pipeline accepts. */}
      <ImageDirectionModal
        open={cbDirectionOpen && cbFiles.length > 0}
        fileNames={cbFiles.map(f => f.name)}
        directions={cbOptions?.image_directions ?? []}
        selected={cbImageDirection}
        onChoose={value => { setCbImageDirection(value); setCbDirectionOpen(false) }}
        onDismiss={() => {
          setCbDirectionOpen(false)
          if (!cbImageDirection) setCbFiles([])
        }}
      />

      <div className="flex items-end justify-between gap-4 mt-8 mb-4 flex-wrap">
        <div>
          <p className="micro-label mb-1">Asset library</p>
          <h2 className="section-title">Ready to review and reuse</h2>
          <p className="text-[13px] mt-1" style={{ color: 'var(--ink-3)' }}>Every package keeps its copy, formats and production state together.</p>
        </div>
        <Link href={`/dashboard/${tenantId}/gallery`} className="inline-flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: 'var(--accent-strong)' }}>
          Browse by topic <ArrowRight size={14} />
        </Link>
      </div>

      {/* A load failure, said out loud. Without this, a failed refresh looks exactly like an empty
          library — which is how a perfectly intact set of creatives appeared to vanish. */}
      {packagesError && (
        <div
          className="card px-4 py-3 mb-4 flex items-center justify-between gap-3"
          style={{ borderColor: 'var(--warn-border, var(--hairline))' }}
        >
          <p className="text-[12.5px]" style={{ color: 'var(--warn, var(--ink-2))' }}>
            Couldn&rsquo;t refresh the library ({packagesError}). You&rsquo;re seeing the last
            version that loaded — nothing has been deleted.
          </p>
          <button type="button" onClick={() => { void loadPackages() }} className="btn btn-ghost">
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      {/* Tab bar — underline style, matching runs/page.tsx's convention */}
      <div className="flex items-center gap-1 border-b mb-6" style={{ borderColor: 'var(--hairline)' }}>
        {([{ key: 'active' as const, label: 'Library' }, { key: 'rejected' as const, label: 'Rejected' }]).map(tab => {
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
            <label className="min-w-[200px]">
              <span className="sr-only">Filter by product</span>
              <select value={filterProduct} onChange={e => setFilterProduct(e.target.value)} className="input">
                <option value="">All products</option>
                {products.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
            </label>
            <label className="min-w-[180px]">
              <span className="sr-only">Filter by language</span>
              <select value={filterLanguage} onChange={e => setFilterLanguage(e.target.value)} className="input">
                <option value="">All languages</option>
                {languages.map(l => <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>)}
              </select>
            </label>
            {/* A breadcrumb, not a listing — the creative itself stays out of
                this tab, but a silent drop in count reads as data loss. */}
            {hiddenRejectedCount > 0 && (
              <button
                onClick={() => setActiveTab('rejected')}
                className="text-[11.5px]"
                style={{ color: 'var(--ink-4)' }}
                title="Every asset on these creatives was rejected. Restore one from the Rejected tab to bring it back here."
              >
                {hiddenRejectedCount} discarded package{hiddenRejectedCount === 1 ? '' : 's'} hidden
              </button>
            )}
          </div>

          {visiblePackages.length === 0 ? (
            <div className="card px-6 py-14 text-center">
              <p style={{ color: 'var(--ink-3)' }}>
                {packages.length === 0 ? 'Your reusable library is ready for its first asset.' : 'No usable creative matches these filters.'}
              </p>
              <p className="text-[13px] mt-1.5" style={{ color: 'var(--ink-4)' }}>
                {packages.length === 0
                  ? <>Generate with AI or upload approved work to begin.</>
                  : <>Clear the filters or restore an asset from <b>Rejected</b>.</>}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {visiblePackages.map(pkg => {
                const selected = pkg.copyVariants?.[pkg.selectedCopyIndex ?? 0]
                const isCarousel = (pkg.carouselCards?.length ?? 0) > 0
                // Match on variantIndex and skip rejected entries and alternate
                // sizes rather than indexing images[] positionally: a variant
                // can hold several entries (uploaded sizes, or canvas-extended
                // placement sizes appended by the resizer), so position stopped
                // tracking variant long ago — and an alternate size would show
                // an off-ratio (or blur-margined) cut as the library thumbnail.
                const variantImages = (pkg.images ?? []).filter(
                  im => im.variantIndex === (pkg.selectedCopyIndex ?? 0) && im.imageUrl && !im.rejected,
                )
                const isAlternateSize = (im: CreativeImage) => !!im.extendedFrom || !!im.uploadedSizeOf
                const thumb = (variantImages.find(im => !isAlternateSize(im)) ?? variantImages[0])?.imageUrl
                  || (pkg.images ?? []).find(im => im.imageUrl && !im.rejected && !isAlternateSize(im))?.imageUrl
                  || pkg.carouselCards?.[0]?.imageUrl
                  || pkg.video?.videoThumbnailUrl
                const isVideo = !!pkg.video?.videoUrl
                const assetCount = usableAssetCount(pkg)
                return (
                  <Link
                    key={pkg._id}
                    href={`/dashboard/${tenantId}/creatives/${pkg._id}`}
                    className="card overflow-hidden block group"
                    aria-label={`Open ${selected?.headline ?? pkg.productName ?? 'creative package'}`}
                  >
                    <div className="relative" style={{ aspectRatio: '4/5', background: 'var(--surface-warm)' }}>
                      {/* object-contain, not -cover: the Slack pipeline's base deliverable is
                          1200x1200 (1:1), so cover would centre-crop a square into this 4:5 box
                          and eat the headline at both edges. Contain letterboxes against
                          --surface-warm instead, keeping one card shape for every source ratio
                          while still showing the whole creative. */}
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt={selected?.headline ?? pkg.productName ?? 'Creative'} className="w-full h-full object-contain" />
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
                    <div className="p-4">
                      <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--ink)' }}>
                        {selected?.headline || pkg.productName || 'Untitled'}
                      </p>
                      <p className="text-[11.5px] mt-0.5 truncate" style={{ color: 'var(--ink-3)' }}>
                        {pkg.productName || '—'}{pkg.targetLanguage ? ` · ${pkg.targetLanguage}` : ''}
                      </p>
                      <div className="flex items-center justify-between gap-3 mt-3 pt-3" style={{ borderTop: '1px solid var(--hairline-light)' }}>
                        <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
                          {assetCount} reusable asset{assetCount === 1 ? '' : 's'}
                        </span>
                        <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" style={{ color: 'var(--accent)' }} />
                      </div>
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
                Reject an image or video from its package page, or from the Gallery, and it will show up here — fully reversible.
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
