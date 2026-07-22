'use client'

import { useState, useEffect, use, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Loader2, RefreshCw, Wand2, Sparkles, CheckCircle2, Image as ImageIcon, Video as VideoIcon, Volume2,
} from 'lucide-react'
import { getCreativePackage, updateCreativePackage, regenerateCreativeImage, rewriteCreativeImagePrompt, editCreativeImage, regenerateCreativeVideo, rewriteCreativeVideoPrompt, rehostCreativeMedia, planHiggsfieldScenes, generateHiggsfieldScenes, regenerateHiggsfieldScene, mergeHiggsfieldScenes, addHiggsfieldVoiceover } from '@/lib/api'
import type { CreativeAspectRatio, CreativeImageResolution, CreativeVideoResolution } from '@/lib/api'
import type { CreativePackage } from '@/types'

interface PageProps {
  params: Promise<{ tenantId: string; packageId: string }>
}

type BusyState = null | 'loading' | 'polling'

const ASPECT_RATIO_OPTIONS: { value: CreativeAspectRatio; label: string }[] = [
  { value: '9:16', label: '9:16' },
  { value: '16:9', label: '16:9' },
  { value: '1:1', label: '1:1' },
  { value: '4:5', label: '4:5' },
]
const IMAGE_RESOLUTION_OPTIONS: { value: CreativeImageResolution; label: string }[] = [
  { value: '1K', label: 'Standard (1K)' },
  { value: '2K', label: 'High (2K)' },
  { value: '4K', label: 'Ultra (4K)' },
]
const VIDEO_RESOLUTION_OPTIONS: { value: CreativeVideoResolution; label: string }[] = [
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

export default function CreativeDetailPage({ params }: PageProps) {
  const { tenantId, packageId } = use(params)

  const [pkg, setPkg] = useState<CreativePackage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const [imageBusy, setImageBusy] = useState<Record<number, BusyState>>({})
  const [videoBusy, setVideoBusy] = useState<BusyState>(null)
  const [imageUrlDrafts, setImageUrlDrafts] = useState<Record<number, string>>({})
  const [videoUrlDraft, setVideoUrlDraft] = useState('')
  const [videoImportUrl, setVideoImportUrl] = useState('')
  const [videoImportBusy, setVideoImportBusy] = useState(false)
  const [savingSelected, setSavingSelected] = useState(false)
  const [editDrafts, setEditDrafts] = useState<Record<number, string>>({})
  const [imageAspectDrafts, setImageAspectDrafts] = useState<Record<number, CreativeAspectRatio>>({})
  const [imageResolutionDrafts, setImageResolutionDrafts] = useState<Record<number, CreativeImageResolution>>({})
  const [videoAspectDraft, setVideoAspectDraft] = useState<CreativeAspectRatio | null>(null)
  const [videoResolutionDraft, setVideoResolutionDraft] = useState<CreativeVideoResolution | null>(null)

  // Higgsfield scene-chunk video build — plan (LLM, free) -> generate per-scene
  // (paid) -> review/regenerate individual scenes -> merge (ffmpeg) into the
  // final video. Only seedance_2_0/seedance_2_0_mini have a verified working
  // minimum scene duration (4s) — see HiggsfieldService.VERIFIED_SCENE_MODEL_FLOORS.
  const [sceneJobType, setSceneJobType] = useState<'seedance_2_0' | 'seedance_2_0_mini'>('seedance_2_0_mini')
  const [sceneTopic, setSceneTopic] = useState('')
  const [sceneTotalDuration, setSceneTotalDuration] = useState(12)
  const [scenePlanLoading, setScenePlanLoading] = useState(false)
  const [sceneGenerating, setSceneGenerating] = useState(false)
  const [sceneMerging, setSceneMerging] = useState(false)
  const [sceneRegenerating, setSceneRegenerating] = useState<number | null>(null)
  const [sceneDrafts, setSceneDrafts] = useState<Record<number, string>>({})

  // Voiceover — Cartesia-narrated Hindi/English audio muxed onto a COPY of
  // the current video.videoUrl (never overwrites it). Leave scriptDraft blank
  // to let the backend write the Devanagari narration script itself.
  const [voiceoverBusy, setVoiceoverBusy] = useState(false)
  const [voiceoverScriptDraft, setVoiceoverScriptDraft] = useState('')
  const [voiceoverKeepBg, setVoiceoverKeepBg] = useState(true)

  const load = useCallback(async () => {
    try {
      const p = await getCreativePackage(tenantId, packageId)
      setPkg(p)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load creative')
    } finally {
      setLoading(false)
    }
  }, [tenantId, packageId])

  useEffect(() => { load() }, [load])

  const flash = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }, [])

  // Draft picks win once the user touches a dropdown; otherwise fall back to
  // whatever this image/video was actually generated with, else a sane default.
  function getImageAspect(i: number): CreativeAspectRatio {
    return imageAspectDrafts[i] ?? (pkg?.images?.find(im => im.variantIndex === i)?.aspectRatio as CreativeAspectRatio) ?? '9:16'
  }
  function getImageResolution(i: number): CreativeImageResolution {
    return imageResolutionDrafts[i] ?? (pkg?.images?.find(im => im.variantIndex === i)?.resolution as CreativeImageResolution) ?? '1K'
  }
  function getVideoAspect(): CreativeAspectRatio {
    return videoAspectDraft ?? (pkg?.video?.aspectRatio as CreativeAspectRatio) ?? '9:16'
  }
  function getVideoResolution(): CreativeVideoResolution {
    return videoResolutionDraft ?? (pkg?.video?.resolution as CreativeVideoResolution) ?? '1080p'
  }

  // Poll until `check(pkg)` is true, or we give up after ~3 minutes — same
  // 10s-interval pattern used elsewhere in this app for creative production.
  function pollUntil(check: (p: CreativePackage) => boolean, onDone: () => void) {
    let attempts = 0
    const poll = setInterval(async () => {
      attempts++
      try {
        const p = await getCreativePackage(tenantId, packageId)
        if (check(p)) {
          clearInterval(poll)
          setPkg(p)
          onDone()
          return
        }
      } catch {
        // keep polling
      }
      if (attempts >= 18) {
        clearInterval(poll)
        onDone()
        load()
      }
    }, 10000)
  }

  async function handleRegenImage(variantIndex: number) {
    setImageBusy(b => ({ ...b, [variantIndex]: 'loading' }))
    try {
      await regenerateCreativeImage(tenantId, packageId, variantIndex, { aspectRatio: getImageAspect(variantIndex), resolution: getImageResolution(variantIndex) })
      setImageBusy(b => ({ ...b, [variantIndex]: 'polling' }))
      const before = pkg?.images?.find(i => i.variantIndex === variantIndex)?.imageUrl
      pollUntil(
        p => p.images?.find(i => i.variantIndex === variantIndex)?.imageUrl !== before,
        () => setImageBusy(b => ({ ...b, [variantIndex]: null })),
      )
    } catch {
      setImageBusy(b => ({ ...b, [variantIndex]: null }))
      flash('Failed to start regeneration')
    }
  }

  async function handleRewriteImage(variantIndex: number) {
    setImageBusy(b => ({ ...b, [variantIndex]: 'loading' }))
    try {
      await rewriteCreativeImagePrompt(tenantId, packageId, variantIndex, { aspectRatio: getImageAspect(variantIndex), resolution: getImageResolution(variantIndex) })
      setImageBusy(b => ({ ...b, [variantIndex]: 'polling' }))
      const before = pkg?.images?.find(i => i.variantIndex === variantIndex)?.imageUrl
      pollUntil(
        p => p.images?.find(i => i.variantIndex === variantIndex)?.imageUrl !== before,
        () => setImageBusy(b => ({ ...b, [variantIndex]: null })),
      )
    } catch {
      setImageBusy(b => ({ ...b, [variantIndex]: null }))
      flash('Failed to start regeneration')
    }
  }

  async function handleEditImage(variantIndex: number) {
    const instruction = editDrafts[variantIndex]?.trim()
    if (!instruction) return
    setImageBusy(b => ({ ...b, [variantIndex]: 'loading' }))
    try {
      await editCreativeImage(tenantId, packageId, instruction, variantIndex, { aspectRatio: getImageAspect(variantIndex), resolution: getImageResolution(variantIndex) })
      setImageBusy(b => ({ ...b, [variantIndex]: 'polling' }))
      const before = pkg?.images?.find(i => i.variantIndex === variantIndex)?.imageUrl
      pollUntil(
        p => p.images?.find(i => i.variantIndex === variantIndex)?.imageUrl !== before,
        () => setImageBusy(b => ({ ...b, [variantIndex]: null })),
      )
      setEditDrafts(d => ({ ...d, [variantIndex]: '' }))
    } catch {
      setImageBusy(b => ({ ...b, [variantIndex]: null }))
      flash('Failed to start edit')
    }
  }

  async function handleRegenVideo() {
    setVideoBusy('loading')
    try {
      await regenerateCreativeVideo(tenantId, packageId, { aspectRatio: getVideoAspect(), resolution: getVideoResolution() })
      setVideoBusy('polling')
      const before = pkg?.video?.videoUrl
      pollUntil(p => p.video?.videoUrl !== before, () => setVideoBusy(null))
    } catch {
      setVideoBusy(null)
      flash('Failed to start regeneration')
    }
  }

  async function handleRewriteVideo() {
    setVideoBusy('loading')
    try {
      await rewriteCreativeVideoPrompt(tenantId, packageId, { aspectRatio: getVideoAspect(), resolution: getVideoResolution() })
      setVideoBusy('polling')
      const before = pkg?.video?.videoUrl
      pollUntil(p => p.video?.videoUrl !== before, () => setVideoBusy(null))
    } catch {
      setVideoBusy(null)
      flash('Failed to start regeneration')
    }
  }

  // Free — an LLM call, not a Higgsfield generation. Writes/overwrites the scene plan for review before any spend.
  async function handlePlanScenes() {
    if (!sceneTopic.trim()) return
    setScenePlanLoading(true)
    try {
      await planHiggsfieldScenes(tenantId, packageId, {
        topic: sceneTopic.trim(), jobType: sceneJobType, totalDurationSeconds: sceneTotalDuration,
      })
      setSceneDrafts({})
      await load()
    } catch {
      flash('Failed to plan scenes')
    } finally {
      setScenePlanLoading(false)
    }
  }

  async function handleGenerateScenes() {
    setSceneGenerating(true)
    try {
      await generateHiggsfieldScenes(tenantId, packageId)
      pollUntil(p => (p.videoScenes ?? []).every(s => s.status !== 'pending'), () => setSceneGenerating(false))
    } catch {
      setSceneGenerating(false)
      flash('Failed to start scene generation')
    }
  }

  async function handleRegenerateScene(sceneIndex: number) {
    setSceneRegenerating(sceneIndex)
    try {
      await regenerateHiggsfieldScene(tenantId, packageId, sceneIndex, sceneDrafts[sceneIndex])
      pollUntil(
        p => p.videoScenes?.find(s => s.sceneIndex === sceneIndex)?.status !== 'pending',
        () => setSceneRegenerating(null),
      )
    } catch {
      setSceneRegenerating(null)
      flash('Failed to regenerate scene')
    }
  }

  async function handleMergeScenes() {
    setSceneMerging(true)
    try {
      const before = pkg?.video?.videoUrl
      await mergeHiggsfieldScenes(tenantId, packageId)
      pollUntil(p => !!p.video?.videoUrl && p.video.videoUrl !== before, () => setSceneMerging(false))
    } catch {
      setSceneMerging(false)
      flash('Failed to start merge')
    }
  }

  async function handleAddVoiceover() {
    setVoiceoverBusy(true)
    try {
      const before = pkg?.videoWithVoiceoverUrl
      const res = await addHiggsfieldVoiceover(tenantId, packageId, voiceoverScriptDraft.trim() || undefined, voiceoverKeepBg)
      setVoiceoverScriptDraft(res.script)
      pollUntil(p => !!p.videoWithVoiceoverUrl && p.videoWithVoiceoverUrl !== before, () => setVoiceoverBusy(false))
    } catch {
      setVoiceoverBusy(false)
      flash('Failed to start voiceover generation')
    }
  }

  async function handleSaveImageUrl(variantIndex: number) {
    const url = imageUrlDrafts[variantIndex]?.trim()
    if (!url) return
    try {
      await updateCreativePackage(tenantId, packageId, { variantIndex, imageUrl: url })
      flash('Image URL updated')
      setImageUrlDrafts(d => ({ ...d, [variantIndex]: '' }))
      load()
    } catch {
      flash('Failed to update image URL')
    }
  }

  async function handleSaveVideoUrl() {
    const url = videoUrlDraft.trim()
    if (!url) return
    try {
      await updateCreativePackage(tenantId, packageId, { videoUrl: url })
      flash('Video URL updated')
      setVideoUrlDraft('')
      load()
    } catch {
      flash('Failed to update video URL')
    }
  }

  async function handleImportVideo() {
    const url = videoImportUrl.trim()
    if (!url) return
    setVideoImportBusy(true)
    try {
      const { url: s3Url } = await rehostCreativeMedia(tenantId, url, 'video')
      await updateCreativePackage(tenantId, packageId, { videoUrl: s3Url })
      flash('Video imported and re-hosted')
      setVideoImportUrl('')
      await load()
    } catch {
      flash('Failed to import video — check the URL is publicly reachable')
    } finally {
      setVideoImportBusy(false)
    }
  }

  async function handleSetPrimary(variantIndex: number) {
    setSavingSelected(true)
    try {
      await updateCreativePackage(tenantId, packageId, { selectedCopyIndex: variantIndex })
      flash('Primary variant updated')
      await load()
    } catch {
      flash('Failed to update primary variant')
    } finally {
      setSavingSelected(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    )
  }

  if (error || !pkg) {
    return (
      <div className="px-8 py-8 max-w-3xl mx-auto">
        <p style={{ color: 'var(--bad)' }}>{error || 'Creative not found'}</p>
        <Link href={`/dashboard/${tenantId}/creatives`} className="text-sm font-medium mt-2 inline-block" style={{ color: 'var(--accent-strong)' }}>
          ← Back to Creatives
        </Link>
      </div>
    )
  }

  const isCarousel = (pkg.carouselCards?.length ?? 0) > 0

  return (
    <div className="px-8 py-8 max-w-4xl mx-auto stagger pb-20">
      <Link href={`/dashboard/${tenantId}/creatives`} className="inline-flex items-center gap-1.5 text-sm font-medium mb-5" style={{ color: 'var(--ink-3)' }}>
        <ArrowLeft size={14} /> Creatives
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <p className="micro-label mb-2">{pkg.productName || 'Creative'}{pkg.targetLanguage ? ` · ${pkg.targetLanguage}` : ''}{isCarousel ? ' · Carousel' : ''}</p>
          <h1 className="page-title">Edit creative</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className={`chip ${STATUS_STYLE[pkg.status ?? ''] ?? 'chip-neutral'}`}>{STATUS_LABEL[pkg.status ?? ''] ?? pkg.status}</span>
          <button onClick={() => load()} className="btn btn-ghost"><RefreshCw size={14} /> Refresh</button>
        </div>
      </div>

      {toast && (
        <div className="rounded-xl px-4 py-2.5 mb-5 text-[13px]" style={{ background: 'var(--good-bg)', color: 'var(--good)', border: '1px solid var(--good-border)' }}>
          {toast}
        </div>
      )}

      {isCarousel ? (
        <section className="card p-6 mb-6">
          <p className="micro-label mb-4">Carousel cards ({pkg.carouselCards?.length})</p>
          <p className="text-[12px] mb-4" style={{ color: 'var(--ink-3)' }}>
            Editing individual carousel cards isn&rsquo;t supported yet — regenerate the whole creative from the library page to get a new set.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {pkg.carouselCards?.map(card => (
              <div key={card.slotIndex} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--hairline-light)' }}>
                <div className="relative" style={{ aspectRatio: '4/5', background: 'var(--surface-warm)' }}>
                  {card.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={card.imageUrl} alt={card.headline} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><ImageIcon size={18} style={{ color: 'var(--ink-4)' }} /></div>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-[11.5px] font-semibold truncate" style={{ color: 'var(--ink)' }}>{card.headline}</p>
                  {card.description && <p className="text-[10.5px] truncate" style={{ color: 'var(--ink-3)' }}>{card.description}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <>
          {/* ── Copy variants + images ── */}
          <section className="card p-6 mb-6">
            <p className="micro-label mb-4">Copy variants ({pkg.copyVariants?.length ?? 0})</p>
            <div className="space-y-5">
              {(pkg.copyVariants ?? []).map((variant, i) => {
                const isPrimary = (pkg.selectedCopyIndex ?? 0) === i
                const img = pkg.images?.find(im => im.variantIndex === i)
                const busy = imageBusy[i] ?? null
                return (
                  <div key={i} className="rounded-xl p-4" style={{ background: 'var(--surface-warm)', border: isPrimary ? '2px solid var(--accent)' : '1px solid var(--hairline-light)' }}>
                    <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="chip chip-neutral">{variant.hookStyle || `Variant ${i + 1}`}</span>
                        {isPrimary && <span className="chip chip-good">Primary</span>}
                      </div>
                      {!isPrimary && (
                        <button onClick={() => handleSetPrimary(i)} disabled={savingSelected} className="btn btn-ghost" style={{ fontSize: '11.5px', padding: '4px 10px' }}>
                          <CheckCircle2 size={12} /> Set as primary
                        </button>
                      )}
                    </div>

                    <div className="grid md:grid-cols-[1fr_180px] gap-4">
                      <div>
                        <p className="text-[13px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>{variant.headline}</p>
                        <p className="text-[12.5px] leading-relaxed mb-2 whitespace-pre-wrap" style={{ color: 'var(--ink-2)' }}>{variant.primaryText}</p>
                        <p className="text-[11px]" style={{ color: 'var(--ink-3)' }}>CTA: {variant.cta}</p>
                      </div>

                      <div>
                        <div className="relative rounded-lg overflow-hidden mb-2" style={{ aspectRatio: '4/5', background: 'var(--paper)' }}>
                          {img?.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={img.imageUrl} alt={variant.headline} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"><ImageIcon size={18} style={{ color: 'var(--ink-4)' }} /></div>
                          )}
                          {(busy === 'loading' || busy === 'polling') && (
                            <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
                              <Loader2 size={18} className="animate-spin" color="#fff" />
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 mb-2">
                          <select
                            value={getImageAspect(i)}
                            onChange={e => setImageAspectDrafts(d => ({ ...d, [i]: e.target.value as CreativeAspectRatio }))}
                            disabled={!!busy}
                            className="input"
                            style={{ fontSize: '11px', padding: '4px 6px', flex: 1 }}
                          >
                            {ASPECT_RATIO_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                          <select
                            value={getImageResolution(i)}
                            onChange={e => setImageResolutionDrafts(d => ({ ...d, [i]: e.target.value as CreativeImageResolution }))}
                            disabled={!!busy}
                            className="input"
                            style={{ fontSize: '11px', padding: '4px 6px', flex: 1 }}
                          >
                            {IMAGE_RESOLUTION_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                        </div>
                        <div className="flex gap-1.5 mb-2">
                          <button onClick={() => handleRegenImage(i)} disabled={!!busy} className="btn btn-ghost flex-1" style={{ fontSize: '11px', padding: '5px 8px' }}>
                            <RefreshCw size={11} /> Retry
                          </button>
                          <button onClick={() => handleRewriteImage(i)} disabled={!!busy} className="btn btn-ghost flex-1" style={{ fontSize: '11px', padding: '5px 8px' }}>
                            <Wand2 size={11} /> Rewrite
                          </button>
                        </div>
                        <div className="flex gap-1 mb-2">
                          <input
                            value={editDrafts[i] ?? ''}
                            onChange={e => setEditDrafts(d => ({ ...d, [i]: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') handleEditImage(i) }}
                            disabled={!!busy}
                            className="input"
                            style={{ fontSize: '11px', padding: '4px 8px' }}
                            placeholder="Tweak this image (e.g. change heading to..., make background blue)"
                          />
                          <button onClick={() => handleEditImage(i)} disabled={!!busy || !editDrafts[i]?.trim()} className="btn btn-ghost" style={{ fontSize: '11px', padding: '4px 8px' }}>
                            <Wand2 size={11} /> Edit
                          </button>
                        </div>
                        {!!img?.editInstructions?.length && (
                          <p className="text-[10.5px] mb-2" style={{ color: 'var(--ink-3)' }} title={img.editInstructions.join(' → ')}>
                            Last edit: {img.editInstructions[img.editInstructions.length - 1]}
                          </p>
                        )}
                        <div className="flex gap-1">
                          <input
                            value={imageUrlDrafts[i] ?? ''}
                            onChange={e => setImageUrlDrafts(d => ({ ...d, [i]: e.target.value }))}
                            className="input"
                            style={{ fontSize: '11px', padding: '4px 8px' }}
                            placeholder="Paste image URL"
                          />
                          <button onClick={() => handleSaveImageUrl(i)} className="btn btn-ghost" style={{ fontSize: '11px', padding: '4px 8px' }}>Save</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* ── Video ── */}
          <section className="card p-6">
            <p className="micro-label mb-4">Video</p>
            {!pkg.video?.videoPrompt && !pkg.video?.videoUrl && (
              <p className="text-[13px] mb-4" style={{ color: 'var(--ink-3)' }}>No AI-generated video for this creative yet (image-only or meme format) — but you can still import an externally-made video below.</p>
            )}
            <div className="grid md:grid-cols-[240px_1fr] gap-4">
              <div>
                <div className="relative rounded-lg overflow-hidden mb-2" style={{ aspectRatio: '9/16', background: 'var(--surface-warm)' }}>
                  {pkg.video?.videoUrl ? (
                    <video src={pkg.video.videoUrl} poster={pkg.video.videoThumbnailUrl} controls className="w-full h-full object-cover" />
                  ) : pkg.video?.videoThumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pkg.video.videoThumbnailUrl} alt="Video thumbnail" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><VideoIcon size={18} style={{ color: 'var(--ink-4)' }} /></div>
                  )}
                  {(videoBusy === 'loading' || videoBusy === 'polling') && (
                    <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
                      <Loader2 size={18} className="animate-spin" color="#fff" />
                    </div>
                  )}
                </div>
                <div className="flex gap-1 mb-1.5">
                  <select
                    value={getVideoAspect()}
                    onChange={e => setVideoAspectDraft(e.target.value as CreativeAspectRatio)}
                    disabled={!!videoBusy}
                    className="input"
                    style={{ fontSize: '11px', padding: '4px 6px', flex: 1 }}
                  >
                    {ASPECT_RATIO_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  <select
                    value={getVideoResolution()}
                    onChange={e => setVideoResolutionDraft(e.target.value as CreativeVideoResolution)}
                    disabled={!!videoBusy}
                    className="input"
                    style={{ fontSize: '11px', padding: '4px 6px', flex: 1 }}
                  >
                    {VIDEO_RESOLUTION_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={handleRegenVideo} disabled={!!videoBusy || !pkg.video?.videoPrompt} className="btn btn-ghost flex-1" style={{ fontSize: '11px', padding: '5px 8px' }}>
                    <RefreshCw size={11} /> Retry
                  </button>
                  <button onClick={handleRewriteVideo} disabled={!!videoBusy} className="btn btn-ghost flex-1" style={{ fontSize: '11px', padding: '5px 8px' }}>
                    <Wand2 size={11} /> Rewrite
                  </button>
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--ink-3)' }}>Video prompt</p>
                <p className="text-[12px] leading-relaxed mb-3" style={{ color: 'var(--ink-2)' }}>{pkg.video?.videoPrompt || '—'}</p>

                <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--ink-3)' }}>Import from external URL (e.g. Higgsfield)</p>
                <p className="text-[10.5px] mb-1.5" style={{ color: 'var(--ink-4)' }}>Downloads the file and re-hosts it permanently on our own S3, then saves it as this creative&rsquo;s video.</p>
                <div className="flex gap-1.5 mb-3">
                  <input
                    value={videoImportUrl}
                    onChange={e => setVideoImportUrl(e.target.value)}
                    disabled={videoImportBusy}
                    className="input"
                    style={{ fontSize: '12px' }}
                    placeholder="https://... (publicly reachable video URL)"
                  />
                  <button onClick={handleImportVideo} disabled={videoImportBusy || !videoImportUrl.trim()} className="btn btn-primary" style={{ fontSize: '12px' }}>
                    {videoImportBusy ? <Loader2 size={12} className="animate-spin" /> : null}
                    {videoImportBusy ? 'Importing…' : 'Import'}
                  </button>
                </div>

                <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--ink-3)' }}>Manual override</p>
                <p className="text-[10.5px] mb-1.5" style={{ color: 'var(--ink-4)' }}>Already have a permanent URL? Set it directly, no re-hosting.</p>
                <div className="flex gap-1.5">
                  <input
                    value={videoUrlDraft}
                    onChange={e => setVideoUrlDraft(e.target.value)}
                    className="input"
                    style={{ fontSize: '12px' }}
                    placeholder="Paste video URL"
                  />
                  <button onClick={handleSaveVideoUrl} className="btn btn-ghost" style={{ fontSize: '12px' }}>Save</button>
                </div>
              </div>
            </div>
          </section>

          {/* ── Generate via Higgsfield — scene by scene ── */}
          <section className="card p-6">
            <p className="micro-label mb-1">Generate via Higgsfield — scene by scene</p>
            <p className="text-[10.5px] mb-4" style={{ color: 'var(--ink-4)' }}>
              Plans the video as short independent scenes (cheapest viable chunk size per scene — no on-screen text, since that doesn&rsquo;t survive short renders), lets you review and regenerate individual scenes, then merges only the approved ones into one final video — instead of paying for one long generation and hoping it&rsquo;s right.
            </p>

            <div className="grid md:grid-cols-3 gap-3 mb-3">
              <label className="block">
                <span className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--ink-3)' }}>Model</span>
                <select
                  value={sceneJobType}
                  onChange={e => setSceneJobType(e.target.value as typeof sceneJobType)}
                  disabled={scenePlanLoading}
                  className="input"
                  style={{ fontSize: '12px' }}
                >
                  <option value="seedance_2_0_mini">Seedance 2.0 Mini (cheapest)</option>
                  <option value="seedance_2_0">Seedance 2.0</option>
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--ink-3)' }}>Total duration (seconds)</span>
                <input
                  type="number"
                  min={4}
                  value={sceneTotalDuration}
                  onChange={e => setSceneTotalDuration(Number(e.target.value))}
                  disabled={scenePlanLoading}
                  className="input"
                  style={{ fontSize: '12px' }}
                />
              </label>
            </div>

            <div className="flex gap-1.5 mb-4">
              <input
                value={sceneTopic}
                onChange={e => setSceneTopic(e.target.value)}
                disabled={scenePlanLoading}
                className="input"
                style={{ fontSize: '12px' }}
                placeholder="Topic — e.g. a mother tying a sacred thread on her son's wrist at sunrise"
              />
              <button
                onClick={handlePlanScenes}
                disabled={scenePlanLoading || !sceneTopic.trim()}
                className="btn btn-primary"
                style={{ fontSize: '12px' }}
              >
                {scenePlanLoading ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                {scenePlanLoading ? 'Planning…' : 'Plan scenes'}
              </button>
            </div>

            {(pkg.videoScenes ?? []).length > 0 && (
              <>
                <div className="grid sm:grid-cols-2 gap-3 mb-4">
                  {(pkg.videoScenes ?? []).map(scene => {
                    const busy = sceneGenerating || sceneRegenerating !== null
                    const statusStyle = scene.status === 'completed'
                      ? { background: 'var(--green-bg, var(--surface-warm))', color: 'var(--green, var(--ink-2))' }
                      : scene.status === 'failed'
                        ? { background: 'var(--bad-bg, var(--surface-warm))', color: 'var(--bad)' }
                        : { background: 'var(--warn-bg)', color: 'var(--warn)' }
                    return (
                      <div key={scene.sceneIndex} className="p-3 rounded-lg" style={{ border: '1px solid var(--border)' }}>
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-[11px] font-semibold" style={{ color: 'var(--ink-3)' }}>Scene {scene.sceneIndex + 1} · {scene.durationSeconds}s</p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold" style={statusStyle}>{scene.status}</span>
                        </div>
                        {scene.videoUrl ? (
                          <video src={scene.videoUrl} controls className="w-full rounded-lg mb-2" style={{ aspectRatio: '9/16', maxHeight: 240, background: 'var(--surface-warm)' }} />
                        ) : (
                          <div className="w-full rounded-lg mb-2 flex items-center justify-center" style={{ aspectRatio: '9/16', maxHeight: 240, background: 'var(--surface-warm)' }}>
                            {scene.status === 'pending' && busy
                              ? <Loader2 size={16} className="animate-spin" style={{ color: 'var(--ink-4)' }} />
                              : <VideoIcon size={16} style={{ color: 'var(--ink-4)' }} />}
                          </div>
                        )}
                        <textarea
                          value={sceneDrafts[scene.sceneIndex] ?? scene.prompt}
                          onChange={e => setSceneDrafts(d => ({ ...d, [scene.sceneIndex]: e.target.value }))}
                          disabled={busy}
                          className="input mb-2"
                          style={{ fontSize: '11px', minHeight: 60 }}
                        />
                        {scene.error && <p className="text-[10px] mb-2" style={{ color: 'var(--bad)' }}>{scene.error}</p>}
                        <button
                          onClick={() => handleRegenerateScene(scene.sceneIndex)}
                          disabled={busy}
                          className="btn btn-ghost w-full"
                          style={{ fontSize: '11px' }}
                        >
                          <RefreshCw size={11} className={sceneRegenerating === scene.sceneIndex ? 'animate-spin' : ''} />
                          {sceneRegenerating === scene.sceneIndex ? 'Regenerating…' : 'Regenerate this scene'}
                        </button>
                      </div>
                    )
                  })}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleGenerateScenes}
                    disabled={sceneGenerating || sceneRegenerating !== null}
                    className="btn btn-primary"
                    style={{ fontSize: '12px' }}
                  >
                    {sceneGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    {sceneGenerating ? 'Generating scenes…' : 'Generate all scenes'}
                  </button>
                  <button
                    onClick={handleMergeScenes}
                    disabled={sceneMerging || (pkg.videoScenes ?? []).some(s => s.status !== 'completed')}
                    className="btn btn-ghost"
                    style={{ fontSize: '12px' }}
                  >
                    {sceneMerging ? <Loader2 size={12} className="animate-spin" /> : null}
                    {sceneMerging ? 'Merging…' : 'Merge into final video'}
                  </button>
                </div>
              </>
            )}
          </section>

          {pkg.video?.videoUrl && (
            <section className="card p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Volume2 size={14} style={{ color: 'var(--ink-3)' }} />
                <h3 className="text-[13px] font-semibold">Add voiceover (Cartesia — Hindi/English)</h3>
              </div>
              <p className="text-[11px] mb-3" style={{ color: 'var(--ink-4)' }}>
                Narrates a COPY of the current video — the original video.videoUrl is never overwritten. Leave the script blank to let the backend write a Devanagari narration script sized to the video's length automatically.
              </p>
              <textarea
                value={voiceoverScriptDraft}
                onChange={e => setVoiceoverScriptDraft(e.target.value)}
                disabled={voiceoverBusy}
                className="input mb-3"
                style={{ fontSize: '12px', minHeight: 90 }}
                placeholder="Leave blank to auto-generate a Devanagari Hindi/English script sized to this video…"
              />
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={handleAddVoiceover}
                  disabled={voiceoverBusy}
                  className="btn btn-primary"
                  style={{ fontSize: '12px' }}
                >
                  {voiceoverBusy ? <Loader2 size={12} className="animate-spin" /> : <Volume2 size={12} />}
                  {voiceoverBusy ? 'Adding voiceover…' : 'Add voiceover'}
                </button>
                <label className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--ink-3)' }}>
                  <input
                    type="checkbox"
                    checked={voiceoverKeepBg}
                    onChange={e => setVoiceoverKeepBg(e.target.checked)}
                    disabled={voiceoverBusy}
                  />
                  Keep video&apos;s background audio (ducked under narration)
                </label>
              </div>
              {pkg.videoWithVoiceoverUrl && (
                <video
                  src={pkg.videoWithVoiceoverUrl}
                  controls
                  className="w-full rounded-lg mt-3"
                  style={{ aspectRatio: '9/16', maxHeight: 320, background: 'var(--surface-warm)' }}
                />
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}
