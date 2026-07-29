'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Check, AlertCircle, Plus } from 'lucide-react'
import { getCreativePackage, updateCreativePackage } from '@/lib/api'
import type { CreativePackage } from '@/types'

const ASPECT_RATIOS = ['9:16', '4:5', '1:1', '16:9'] as const
type Ratio = typeof ASPECT_RATIOS[number]

const RATIO_LABEL: Record<Ratio, string> = {
  '9:16': 'Vertical 9:16 — Stories/Reels',
  '4:5': 'Portrait 4:5 — Feed',
  '1:1': 'Square 1:1 — Feed',
  '16:9': 'Landscape 16:9',
}

/**
 * Which size actually reaches Meta for a given variant.
 *
 * Mirrors MetaAdsService.pickPrimaryImageSize exactly. Only ONE image ships per
 * ad — Placement Asset Customization (asset_feed_spec) is disabled because Meta
 * rejected asset_customization_rules — so every other size uploaded is
 * discarded. Ad sets default to Stories/Reels-only placements, which are 9:16
 * surfaces, hence vertical wins there and 4:5 is the Feed-style default.
 *
 * Duplicated deliberately rather than imported: this is a UI hint about server
 * behaviour, and showing a stale/incorrect "ships" badge is worse than none.
 * If pickPrimaryImageSize changes, change this with it.
 */
function primaryRatio(available: string[], verticalPlacements: boolean): string | undefined {
  if (verticalPlacements) {
    const v = ['9:16', '4:5'].find(r => available.includes(r))
    if (v) return v
  }
  return ['4:5', '1:1', '16:9', '9:16'].find(r => available.includes(r)) ?? available[0]
}

/**
 * Edit an existing campaign's creative in place.
 *
 * Edit mode used to hide creative entirely behind "use the copy variant cards
 * on the campaign page instead", which meant a pending campaign blocked by one
 * bad headline could not be fixed from the screen you were already on.
 *
 * Writes go straight through PATCH /creative/:tenantId/packages/:id, one field
 * at a time — the same endpoint the campaign page uses. Copy saves on blur;
 * image URLs save on blur per (variant, aspectRatio) pair, which is how the
 * backend keys them, so adding a second size never overwrites the first.
 */
export function CreativeEditor({
  tenantId,
  packageId,
  verticalPlacements = true,
}: {
  tenantId: string
  packageId: string
  /** Ad sets ship Stories/Reels-only by default — drives the "ships" badge. */
  verticalPlacements?: boolean
}) {
  const [pkg, setPkg] = useState<CreativePackage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingKey, setSavingKey] = useState('')
  const [savedKey, setSavedKey] = useState('')
  const [addingFor, setAddingFor] = useState<number | null>(null)

  const reload = useCallback(async () => {
    try {
      setPkg(await getCreativePackage(tenantId, packageId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load creative')
    } finally {
      setLoading(false)
    }
  }, [tenantId, packageId])

  useEffect(() => { reload() }, [reload])

  async function save(key: string, body: Parameters<typeof updateCreativePackage>[2]) {
    setSavingKey(key)
    setError('')
    try {
      await updateCreativePackage(tenantId, packageId, body)
      setSavedKey(key)
      setTimeout(() => setSavedKey(k => (k === key ? '' : k)), 2000)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingKey('')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 size={18} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    )
  }
  if (!pkg) {
    return <p className="text-[13px]" style={{ color: 'var(--bad)' }}>{error || 'Creative package not found.'}</p>
  }

  const variants = pkg.copyVariants ?? []
  const imagesByVariant: Record<number, { aspectRatio?: string; imageUrl: string }[]> = {}
  for (const im of pkg.images ?? []) {
    // variantIndex is optional on the shared CreativeImage type; older packages
    // predate it. Treat an untagged image as belonging to variant 0, which is
    // what the backend does when a PATCH omits variantIndex.
    const vi = im.variantIndex ?? 0
    ;(imagesByVariant[vi] ??= []).push({ aspectRatio: im.aspectRatio, imageUrl: im.imageUrl ?? '' })
  }

  return (
    <div>
      {error && (
        <div className="rounded-lg px-3 py-2 mb-3 flex items-start gap-2 text-[12px]" style={{ background: 'var(--bad-bg)', color: 'var(--bad)' }}>
          <AlertCircle size={13} className="mt-0.5 shrink-0" />{error}
        </div>
      )}

      <p className="text-[11px] mb-4" style={{ color: 'var(--ink-4)' }}>
        Changes save as you leave each field, and apply to every campaign using this creative package.
        Only the size marked <strong>ships</strong> reaches Meta — one image per ad, chosen to match the
        ad set&rsquo;s placements.
      </p>

      <div className="space-y-4">
        {variants.map((v, i) => {
          const imgs = imagesByVariant[i] ?? []
          const available = imgs.map(im => im.aspectRatio).filter(Boolean) as string[]
          const ships = primaryRatio(available, verticalPlacements)
          const missing = ASPECT_RATIOS.filter(r => !available.includes(r))

          return (
            <div key={i} className="rounded-xl p-4" style={{ background: 'var(--surface-warm)', border: '1px solid var(--hairline-light)' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--ink-3)' }}>Variant {i + 1}</span>
                {savedKey.startsWith(`v${i}`) && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: 'var(--good, var(--accent))' }}>
                    <Check size={11} /> Saved
                  </span>
                )}
              </div>

              <label className="block mb-2">
                <span className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--ink-3)' }}>Headline</span>
                <input
                  defaultValue={v.headline ?? ''}
                  onBlur={e => { if (e.target.value !== (v.headline ?? '')) save(`v${i}-headline`, { variantIndex: i, copy: { headline: e.target.value } }) }}
                  className="input"
                />
              </label>

              <label className="block mb-2">
                <span className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--ink-3)' }}>Primary text</span>
                <textarea
                  defaultValue={v.primaryText ?? ''}
                  onBlur={e => { if (e.target.value !== (v.primaryText ?? '')) save(`v${i}-primary`, { variantIndex: i, copy: { primaryText: e.target.value } }) }}
                  className="input"
                  rows={4}
                />
              </label>

              <label className="block mb-3">
                <span className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--ink-3)' }}>CTA</span>
                <input
                  defaultValue={v.cta ?? ''}
                  onBlur={e => { if (e.target.value !== (v.cta ?? '')) save(`v${i}-cta`, { variantIndex: i, copy: { cta: e.target.value } }) }}
                  className="input"
                />
              </label>

              <div style={{ borderTop: '1px solid var(--hairline-light)', paddingTop: 10 }}>
                <span className="text-[11px] font-semibold block mb-2" style={{ color: 'var(--ink-3)' }}>
                  Image sizes <span className="font-normal normal-case" style={{ color: 'var(--ink-4)' }}>({available.length || 'none'} uploaded)</span>
                </span>

                {imgs.length === 0 && (
                  <p className="text-[11px] mb-2" style={{ color: 'var(--ink-4)' }}>No images on this variant yet.</p>
                )}

                {imgs.map((im, k) => {
                  const r = im.aspectRatio ?? 'untagged'
                  const isPrimary = r === ships
                  return (
                    <div key={`${r}-${k}`} className="mb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-semibold" style={{ color: 'var(--ink-4)' }}>
                          {ASPECT_RATIOS.includes(r as Ratio) ? RATIO_LABEL[r as Ratio] : r}
                        </span>
                        {isPrimary ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--accent)', color: '#fff' }}>SHIPS</span>
                        ) : (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--surface)', color: 'var(--ink-4)', border: '1px solid var(--hairline)' }}>uploaded, not used</span>
                        )}
                        {savingKey === `v${i}-img-${r}` && <Loader2 size={10} className="animate-spin" style={{ color: 'var(--ink-4)' }} />}
                      </div>
                      <input
                        defaultValue={im.imageUrl}
                        onBlur={e => { if (e.target.value !== im.imageUrl) save(`v${i}-img-${r}`, { variantIndex: i, imageUrl: e.target.value, aspectRatio: im.aspectRatio as Ratio | undefined }) }}
                        className="input"
                        placeholder="https://…"
                      />
                    </div>
                  )
                })}

                {missing.length > 0 && (
                  <div className="mt-2">
                    {addingFor === i ? (
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {missing.map(r => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => {
                              const url = window.prompt(`Public image URL for ${RATIO_LABEL[r]}`)
                              if (url && url.trim()) save(`v${i}-img-${r}`, { variantIndex: i, imageUrl: url.trim(), aspectRatio: r })
                              setAddingFor(null)
                            }}
                            className="px-2 py-1 rounded-lg text-[11px] font-medium"
                            style={{ background: 'var(--surface)', color: 'var(--ink-3)', border: '1px solid var(--hairline)' }}
                          >
                            {r}
                          </button>
                        ))}
                        <button type="button" onClick={() => setAddingFor(null)} className="text-[11px]" style={{ color: 'var(--ink-4)' }}>cancel</button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAddingFor(i)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold"
                        style={{ color: 'var(--accent)' }}
                      >
                        <Plus size={11} /> Add a size
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
