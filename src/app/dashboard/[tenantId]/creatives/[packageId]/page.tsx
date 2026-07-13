'use client'

import { useState, useEffect, use, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Loader2, RefreshCw, Wand2, CheckCircle2, Image as ImageIcon, Video as VideoIcon,
} from 'lucide-react'
import { getCreativePackage, updateCreativePackage, regenerateCreativeImage, rewriteCreativeImagePrompt, editCreativeImage, regenerateCreativeVideo, rewriteCreativeVideoPrompt } from '@/lib/api'
import type { CreativePackage } from '@/types'

interface PageProps {
  params: Promise<{ tenantId: string; packageId: string }>
}

type BusyState = null | 'loading' | 'polling'

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
  const [savingSelected, setSavingSelected] = useState(false)
  const [editDrafts, setEditDrafts] = useState<Record<number, string>>({})

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
      await regenerateCreativeImage(tenantId, packageId, variantIndex)
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
      await rewriteCreativeImagePrompt(tenantId, packageId, variantIndex)
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
      await editCreativeImage(tenantId, packageId, instruction, variantIndex)
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
      await regenerateCreativeVideo(tenantId, packageId)
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
      await rewriteCreativeVideoPrompt(tenantId, packageId)
      setVideoBusy('polling')
      const before = pkg?.video?.videoUrl
      pollUntil(p => p.video?.videoUrl !== before, () => setVideoBusy(null))
    } catch {
      setVideoBusy(null)
      flash('Failed to start regeneration')
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
            {!pkg.video?.videoPrompt && !pkg.video?.videoUrl ? (
              <p className="text-[13px]" style={{ color: 'var(--ink-3)' }}>No video for this creative (image-only or meme format).</p>
            ) : (
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
                  <div className="flex gap-1.5">
                    <button onClick={handleRegenVideo} disabled={!!videoBusy} className="btn btn-ghost flex-1" style={{ fontSize: '11px', padding: '5px 8px' }}>
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
                  <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--ink-3)' }}>Manual override</p>
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
            )}
          </section>
        </>
      )}
    </div>
  )
}
