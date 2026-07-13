'use client'

import { useState, useEffect, use, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Loader2, AlertCircle, CheckCircle2, Plus, Trash2,
  Target, Zap, Info, Image as ImageIcon, Video as VideoIcon, X,
} from 'lucide-react'
import { getCompany, getMetaAudiences, searchMetaInterests, createManualCampaign, listCreativePackages } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { CampaignFieldGuide } from '@/components/campaign/CampaignFieldGuide'
import type {
  Company, MetaAudienceOption, MetaInterestOption, ManualAdSetInput, ManualCopyVariant, CreativePackage,
} from '@/types'

const CTA_OPTIONS = ['LEARN_MORE', 'SHOP_NOW', 'SIGN_UP', 'ORDER_NOW', 'CONTACT_US', 'SUBSCRIBE', 'GET_OFFER', 'BOOK_TRAVEL', 'DOWNLOAD']
const OBJECTIVE_OPTIONS = ['OUTCOME_SALES', 'OUTCOME_LEADS', 'OUTCOME_ENGAGEMENT', 'OUTCOME_AWARENESS', 'OUTCOME_TRAFFIC']
const OPTIMIZATION_OPTIONS = ['OFFSITE_CONVERSIONS', 'LINK_CLICKS', 'LANDING_PAGE_VIEWS', 'REACH', 'IMPRESSIONS']

function emptyAdSet(name = ''): ManualAdSetInput {
  return { name, budgetPercent: 100, audienceType: 'custom', ageMin: 18, ageMax: 65, gender: 'all', geoLocations: ['IN'], optimizationGoal: 'OFFSITE_CONVERSIONS', creativeFormat: 'image' }
}
function emptyCopy(): ManualCopyVariant {
  return { primaryText: '', headline: '', cta: 'LEARN_MORE' }
}

export default function CreateCampaignPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = use(params)
  const router = useRouter()

  const [company, setCompany] = useState<Company | null>(null)
  const [audiences, setAudiences] = useState<MetaAudienceOption[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [productName, setProductName] = useState('')
  const [campaignType, setCampaignType] = useState<'advantage_plus' | 'custom'>('custom')
  const [budget, setBudget] = useState(1000)
  const [objective, setObjective] = useState('OUTCOME_SALES')
  const [adSets, setAdSets] = useState<ManualAdSetInput[]>([emptyAdSet('Ad set 1')])
  const [copyVariants, setCopyVariants] = useState<ManualCopyVariant[]>([emptyCopy()])
  const [images, setImages] = useState<Array<{ variantIndex: number; imageUrl: string }>>([{ variantIndex: 0, imageUrl: '' }])
  const [videoUrl, setVideoUrl] = useState('')
  const [videoThumbnailUrl, setVideoThumbnailUrl] = useState('')

  // Creative source — paste URLs by hand (default, unchanged behavior) or
  // pick an already-produced creative from the library instead.
  const [creativeSource, setCreativeSource] = useState<'paste' | 'library'>('paste')
  const [libraryPackages, setLibraryPackages] = useState<CreativePackage[]>([])
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [selectedPackageId, setSelectedPackageId] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([getCompany(tenantId), getMetaAudiences(tenantId)])
      .then(([c, a]) => {
        if (cancelled) return
        setCompany(c)
        setAudiences(a)
        const active = c.products?.find(p => p.active !== false) ?? c.products?.[0]
        if (active) setProductName(active.name)
      })
      .catch(() => { if (!cancelled) setError('Failed to load account data') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [tenantId])

  const productAudiences = useMemo(
    () => audiences.filter(a => !productName || a.productName === productName),
    [audiences, productName],
  )

  useEffect(() => {
    if (creativeSource !== 'library') return
    let cancelled = false
    async function load() {
      setLibraryLoading(true)
      try {
        const list = await listCreativePackages(tenantId, { productName: productName || undefined, status: 'completed' })
        if (!cancelled) setLibraryPackages(list)
      } catch {
        if (!cancelled) setLibraryPackages([])
      } finally {
        if (!cancelled) setLibraryLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [creativeSource, productName, tenantId])

  const totalPct = adSets.reduce((s, a) => s + (a.budgetPercent || 0), 0)
  const pctValid = campaignType === 'advantage_plus' || adSets.length === 1 || Math.abs(totalPct - 100) < 1
  const weeklyProjection = budget * 7
  const overCampaignCap = !!company?.maxBudgetPerCampaign && budget > company.maxBudgetPerCampaign
  const overWeeklyCap = !!company?.weeklyBudgetCap && weeklyProjection > company.weeklyBudgetCap

  function updateAdSet(i: number, patch: Partial<ManualAdSetInput>) {
    setAdSets(prev => prev.map((a, idx) => idx === i ? { ...a, ...patch } : a))
  }
  function addAdSet() {
    setAdSets(prev => {
      const next = [...prev, emptyAdSet(`Ad set ${prev.length + 1}`)]
      const evenPct = Math.floor(100 / next.length)
      return next.map((a, i) => ({ ...a, budgetPercent: i === next.length - 1 ? 100 - evenPct * (next.length - 1) : evenPct }))
    })
  }
  function removeAdSet(i: number) {
    setAdSets(prev => {
      const next = prev.filter((_, idx) => idx !== i)
      if (next.length === 1) next[0].budgetPercent = 100
      return next
    })
  }

  function addCopyVariant() {
    setCopyVariants(prev => [...prev, emptyCopy()])
    setImages(prev => [...prev, { variantIndex: copyVariants.length, imageUrl: '' }])
  }
  function removeCopyVariant(i: number) {
    setCopyVariants(prev => prev.filter((_, idx) => idx !== i))
    setImages(prev => prev.filter(img => img.variantIndex !== i).map(img => ({ ...img, variantIndex: img.variantIndex > i ? img.variantIndex - 1 : img.variantIndex })))
  }
  function updateCopy(i: number, patch: Partial<ManualCopyVariant>) {
    setCopyVariants(prev => prev.map((c, idx) => idx === i ? { ...c, ...patch } : c))
  }
  function updateImage(variantIndex: number, imageUrl: string) {
    setImages(prev => {
      const exists = prev.find(img => img.variantIndex === variantIndex)
      if (exists) return prev.map(img => img.variantIndex === variantIndex ? { ...img, imageUrl } : img)
      return [...prev, { variantIndex, imageUrl }]
    })
  }

  async function handleSubmit() {
    setError('')
    setSubmitting(true)
    try {
      const dto = {
        name: name.trim(),
        productName: productName || undefined,
        campaignType,
        budget,
        objective,
        adSets: campaignType === 'advantage_plus' ? [adSets[0]] : adSets,
        ...(creativeSource === 'library'
          ? { creativePackageId: selectedPackageId }
          : {
              creative: {
                copyVariants,
                images: images.filter(img => img.imageUrl.trim()).length ? images.filter(img => img.imageUrl.trim()) : undefined,
                video: videoUrl.trim() ? { variantIndex: 0, videoUrl: videoUrl.trim(), videoThumbnailUrl: videoThumbnailUrl.trim() || undefined } : null,
              },
            }),
      }
      const res = await createManualCampaign(tenantId, dto)
      router.push(`/dashboard/${tenantId}/campaigns/${res.campaignId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create campaign')
      setSubmitting(false)
    }
  }

  const librarySelectionValid = creativeSource === 'paste' || !!selectedPackageId

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} /></div>

  return (
    <div className="px-8 py-8 max-w-5xl mx-auto stagger pb-20">
      <Link href={`/dashboard/${tenantId}/campaigns`} className="inline-flex items-center gap-1.5 text-sm font-medium mb-5" style={{ color: 'var(--ink-3)' }}>
        <ArrowLeft size={14} /> Campaigns
      </Link>
      <p className="micro-label mb-2">New campaign</p>
      <h1 className="page-title mb-1">Create Campaign</h1>
      <p className="page-subtitle mb-6">Launch directly to Meta with targeting you control — skips the AI review team entirely.</p>

      <div className="mb-6">
        <CampaignFieldGuide />
      </div>

      {error && (
        <div className="rounded-xl px-4 py-3 mb-6 flex items-start gap-2.5 text-sm" style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad-border)', color: 'var(--bad)' }}>
          <AlertCircle size={15} className="mt-0.5 shrink-0" /><span>{error}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-6 min-w-0">

          {/* ── Basics ── */}
          <section className="card p-6">
            <p className="micro-label mb-4">Campaign basics</p>
            <div className="grid md:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--ink-2)' }}>Campaign name</span>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Nadi Report — Maharashtra Male 25-45" className="input" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--ink-2)' }}>Product</span>
                <select value={productName} onChange={e => setProductName(e.target.value)} className="input">
                  {(company?.products ?? []).map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--ink-2)' }}>Daily budget (₹)</span>
                <input type="number" min={1} value={budget} onChange={e => setBudget(Number(e.target.value) || 0)} className="input" />
                {overCampaignCap && <p className="text-[11px] mt-1 font-semibold" style={{ color: 'var(--bad)' }}>Exceeds per-campaign cap of {formatCurrency(company!.maxBudgetPerCampaign!)}</p>}
              </label>
              <label className="block">
                <span className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--ink-2)' }}>Objective</span>
                <select value={objective} onChange={e => setObjective(e.target.value)} className="input">
                  {OBJECTIVE_OPTIONS.map(o => <option key={o} value={o}>{o.replace('OUTCOME_', '')}</option>)}
                </select>
              </label>
            </div>
          </section>

          {/* ── Campaign type ── */}
          <section className="card p-6">
            <p className="micro-label mb-4">Campaign type</p>
            <div className="grid md:grid-cols-2 gap-3">
              <TypeCard
                active={campaignType === 'advantage_plus'}
                onClick={() => setCampaignType('advantage_plus')}
                icon={<Zap size={16} />}
                title="Advantage+"
                subtitle="Meta finds your audience automatically"
                body="Fastest way to test a new offer or creative. Meta's algorithm decides who sees your ads — you set budget and objective, nothing else. You give up precise control over age, gender, geography, and interests; the trade-off is usually faster initial delivery and lower manual effort. Best for: new creative tests, broad awareness, when you don't yet have a proven audience."
              />
              <TypeCard
                active={campaignType === 'custom'}
                onClick={() => setCampaignType('custom')}
                icon={<Target size={16} />}
                title="Custom Targeting"
                subtitle="You specify exactly who sees this"
                body="You control age, gender, geography, and audience source (a saved custom/lookalike audience, or interest-based prospecting) per ad set, and can split budget across several ad sets to test them against each other. Requires more setup and enough audience size to deliver, but keeps spend concentrated on the segments you already know convert. Best for: retargeting known buyers, scaling a proven segment, protecting margin."
              />
            </div>
          </section>

          {/* ── Ad sets ── */}
          <section className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="micro-label mb-0">{campaignType === 'advantage_plus' ? 'Ad set' : `Ad sets (${adSets.length})`}</p>
              {campaignType === 'custom' && (
                <button onClick={addAdSet} className="btn btn-ghost text-xs"><Plus size={11} /> Add ad set</button>
              )}
            </div>
            {!pctValid && (
              <p className="text-[11px] font-semibold mb-3 px-3 py-2 rounded-lg" style={{ background: 'var(--bad-bg)', color: 'var(--bad)' }}>
                Budget percentages must sum to 100 (currently {totalPct})
              </p>
            )}
            <div className="space-y-4">
              {(campaignType === 'advantage_plus' ? adSets.slice(0, 1) : adSets).map((a, i) => (
                <AdSetCard
                  key={i}
                  index={i}
                  adSet={a}
                  showBudgetSplit={campaignType === 'custom' && adSets.length > 1}
                  showTargeting={campaignType === 'custom'}
                  showRemove={campaignType === 'custom' && adSets.length > 1}
                  audiences={productAudiences}
                  tenantId={tenantId}
                  onChange={patch => updateAdSet(i, patch)}
                  onRemove={() => removeAdSet(i)}
                />
              ))}
            </div>
          </section>

          {/* ── Creative ── */}
          <section className="card p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <p className="micro-label mb-0">Creative</p>
              <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: 'var(--surface-warm)', border: '1px solid var(--hairline-light)' }}>
                <button
                  onClick={() => setCreativeSource('paste')}
                  className="text-[11.5px] font-semibold px-2.5 py-1 rounded-md"
                  style={creativeSource === 'paste' ? { background: 'var(--paper)', color: 'var(--ink)', boxShadow: 'var(--shadow-raised)' } : { color: 'var(--ink-3)' }}
                >
                  Paste URLs manually
                </button>
                <button
                  onClick={() => setCreativeSource('library')}
                  className="text-[11.5px] font-semibold px-2.5 py-1 rounded-md"
                  style={creativeSource === 'library' ? { background: 'var(--paper)', color: 'var(--ink)', boxShadow: 'var(--shadow-raised)' } : { color: 'var(--ink-3)' }}
                >
                  Pick from library
                </button>
              </div>
            </div>

            {creativeSource === 'library' ? (
              <LibraryPicker
                tenantId={tenantId}
                loading={libraryLoading}
                packages={libraryPackages}
                selectedId={selectedPackageId}
                onSelect={setSelectedPackageId}
              />
            ) : (
            <>
            <div className="flex items-center justify-end mb-4">
              <button onClick={addCopyVariant} className="btn btn-ghost text-xs"><Plus size={11} /> Add variant</button>
            </div>
            <div className="space-y-4">
              {copyVariants.map((c, i) => (
                <div key={i} className="rounded-xl p-4" style={{ background: 'var(--surface-warm)', border: '1px solid var(--hairline-light)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--ink-3)' }}>Variant {i + 1}</span>
                    {copyVariants.length > 1 && <button onClick={() => removeCopyVariant(i)} style={{ color: 'var(--bad)' }}><Trash2 size={13} /></button>}
                  </div>
                  <div className="grid md:grid-cols-2 gap-3 mb-3">
                    <label className="block">
                      <span className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--ink-3)' }}>Headline</span>
                      <input value={c.headline} onChange={e => updateCopy(i, { headline: e.target.value })} className="input" placeholder="Discover your destiny" />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--ink-3)' }}>CTA</span>
                      <select value={c.cta} onChange={e => updateCopy(i, { cta: e.target.value })} className="input">
                        {CTA_OPTIONS.map(o => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
                      </select>
                    </label>
                  </div>
                  <label className="block mb-3">
                    <span className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--ink-3)' }}>Primary text</span>
                    <textarea value={c.primaryText} onChange={e => updateCopy(i, { primaryText: e.target.value })} rows={2} className="input resize-none" placeholder="The ad copy body text…" />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-semibold flex items-center gap-1 mb-1" style={{ color: 'var(--ink-3)' }}><ImageIcon size={11} /> Image URL</span>
                    <input value={images.find(img => img.variantIndex === i)?.imageUrl ?? ''} onChange={e => updateImage(i, e.target.value)} className="input" placeholder="https://…" />
                  </label>
                </div>
              ))}
              <div className="rounded-xl p-4" style={{ background: 'var(--surface-warm)', border: '1px dashed var(--hairline)' }}>
                <span className="text-[11px] font-semibold flex items-center gap-1 mb-2" style={{ color: 'var(--ink-3)' }}><VideoIcon size={11} /> Video (optional — used for variant 1 if set)</span>
                <div className="grid md:grid-cols-2 gap-3">
                  <input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} className="input" placeholder="Video URL" />
                  <input value={videoThumbnailUrl} onChange={e => setVideoThumbnailUrl(e.target.value)} className="input" placeholder="Thumbnail URL (optional)" />
                </div>
              </div>
            </div>
            </>
            )}
          </section>

          <button
            onClick={handleSubmit}
            disabled={submitting || !name.trim() || !pctValid || !librarySelectionValid}
            className="btn btn-primary w-full justify-center py-3"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {submitting ? 'Creating…' : 'Create Campaign — sends to Approval'}
          </button>
          <p className="text-[11px] text-center" style={{ color: 'var(--ink-4)' }}>
            Nothing launches on Meta yet. This creates a pending campaign you&rsquo;ll review and approve on the next screen — same as AI-generated campaigns.
          </p>
        </div>

        {/* ── Expectations sidebar ── */}
        <aside className="space-y-4">
          <div className="card p-5 sticky top-6">
            <p className="micro-label mb-3">What to expect</p>
            <div className="space-y-3 text-[13px]" style={{ color: 'var(--ink-2)' }}>
              <div className="flex justify-between">
                <span style={{ color: 'var(--ink-3)' }}>Daily budget</span>
                <strong>{formatCurrency(budget)}</strong>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--ink-3)' }}>Projected weekly spend</span>
                <strong style={{ color: overWeeklyCap ? 'var(--bad)' : 'var(--ink)' }}>{formatCurrency(weeklyProjection)}</strong>
              </div>
              {company?.weeklyBudgetCap != null && (
                <div className="flex justify-between">
                  <span style={{ color: 'var(--ink-3)' }}>Weekly cap</span>
                  <span>{formatCurrency(company.weeklyBudgetCap)}</span>
                </div>
              )}
              {overWeeklyCap && (
                <p className="text-[11px] font-semibold px-2.5 py-2 rounded-lg" style={{ background: 'var(--bad-bg)', color: 'var(--bad)' }}>
                  This may exceed your weekly budget cap — the server will reject it at submit if combined with existing active spend.
                </p>
              )}
            </div>
            <div className="mt-4 pt-4 space-y-2.5" style={{ borderTop: '1px solid var(--hairline-light)' }}>
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--accent)' }}>
                {campaignType === 'advantage_plus' ? 'Advantage+ impact' : 'Custom targeting impact'}
              </p>
              {campaignType === 'advantage_plus' ? (
                <ul className="text-[12px] leading-relaxed space-y-1.5" style={{ color: 'var(--ink-3)' }}>
                  <li>• No age/gender/geo/interest control — Meta decides delivery.</li>
                  <li>• Typically fastest to exit the learning phase (more traffic to learn from).</li>
                  <li>• Can&rsquo;t isolate which segment is profitable after the fact.</li>
                  <li>• Good default when you have no retargeting audience yet.</li>
                </ul>
              ) : (
                <ul className="text-[12px] leading-relaxed space-y-1.5" style={{ color: 'var(--ink-3)' }}>
                  <li>• Full control over who sees each ad set.</li>
                  <li>• Multiple ad sets let you A/B audiences with a shared creative set.</li>
                  <li>• Small audiences (&lt;~1000 people) may under-deliver or stay stuck in learning.</li>
                  <li>• Retarget/custom ad sets need a real Meta audience — picked below, not typed in.</li>
                </ul>
              )}
            </div>
            <div className="mt-4 pt-4 flex items-start gap-2" style={{ borderTop: '1px solid var(--hairline-light)' }}>
              <Info size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--info)' }} />
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--ink-3)' }}>
                Creative images/video are uploaded to Meta at launch time from the URLs you provide — they must be publicly reachable.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function TypeCard({ active, onClick, icon, title, subtitle, body }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; subtitle: string; body: string }) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-xl p-4 transition-all"
      style={active ? { background: 'var(--accent-bg)', border: '2px solid var(--accent)' } : { background: 'var(--surface-warm)', border: '2px solid var(--hairline-light)' }}
    >
      <div className="flex items-center gap-2 mb-1.5" style={{ color: active ? 'var(--accent)' : 'var(--ink-2)' }}>
        {icon}<span className="text-sm font-bold">{title}</span>
      </div>
      <p className="text-[11px] font-semibold mb-2" style={{ color: 'var(--ink-3)' }}>{subtitle}</p>
      <p className="text-[12px] leading-relaxed" style={{ color: 'var(--ink-3)' }}>{body}</p>
    </button>
  )
}

function AdSetCard({
  index, adSet, showBudgetSplit, showTargeting, showRemove, audiences, tenantId, onChange, onRemove,
}: {
  index: number
  adSet: ManualAdSetInput
  showBudgetSplit: boolean
  showTargeting: boolean
  showRemove: boolean
  audiences: MetaAudienceOption[]
  tenantId: string
  onChange: (patch: Partial<ManualAdSetInput>) => void
  onRemove: () => void
}) {
  const needsAudience = ['lookalike', 'retarget', 'custom'].includes(adSet.audienceType)
  const needsInterests = adSet.audienceType === 'interest'

  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--surface-warm)', border: '1px solid var(--hairline-light)' }}>
      <div className="flex items-center justify-between mb-3">
        <input
          value={adSet.name}
          onChange={e => onChange({ name: e.target.value })}
          className="text-sm font-bold bg-transparent border-none outline-none"
          style={{ color: 'var(--ink)' }}
          placeholder={`Ad set ${index + 1}`}
        />
        {showRemove && <button onClick={onRemove} style={{ color: 'var(--bad)' }}><Trash2 size={13} /></button>}
      </div>

      {showBudgetSplit && (
        <label className="block mb-3">
          <span className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--ink-3)' }}>Budget share (%)</span>
          <input type="number" min={1} max={100} value={adSet.budgetPercent} onChange={e => onChange({ budgetPercent: Number(e.target.value) || 0 })} className="input" style={{ maxWidth: 120 }} />
        </label>
      )}

      {showTargeting && (
        <>
          <label className="block mb-3">
            <span className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--ink-3)' }}>Audience source</span>
            <select value={adSet.audienceType} onChange={e => onChange({ audienceType: e.target.value as ManualAdSetInput['audienceType'], metaAudienceId: undefined, interests: undefined })} className="input">
              <option value="custom">Custom audience</option>
              <option value="retarget">Retarget (custom audience)</option>
              <option value="lookalike">Lookalike audience</option>
              <option value="interest">Interest-based (prospecting)</option>
            </select>
          </label>

          {needsAudience && (
            <label className="block mb-3">
              <span className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--ink-3)' }}>Meta audience</span>
              <select value={adSet.metaAudienceId ?? ''} onChange={e => onChange({ metaAudienceId: e.target.value })} className="input">
                <option value="">Select an audience…</option>
                {audiences.map(a => (
                  <option key={a.id} value={a.id}>{a.name} {a.type === 'lookalike' && a.lookalikePercent ? `(${a.lookalikePercent}%)` : ''}</option>
                ))}
              </select>
              {audiences.length === 0 && <p className="text-[11px] mt-1" style={{ color: 'var(--ink-4)' }}>No saved audiences found for this product.</p>}
            </label>
          )}

          {needsInterests && (
            <InterestPicker tenantId={tenantId} selected={adSet.interests ?? []} onChange={interests => onChange({ interests })} />
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <label className="block">
              <span className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--ink-3)' }}>Age min</span>
              <input type="number" min={18} max={65} value={adSet.ageMin ?? 18} onChange={e => onChange({ ageMin: Number(e.target.value) })} className="input" />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--ink-3)' }}>Age max</span>
              <input type="number" min={18} max={65} value={adSet.ageMax ?? 65} onChange={e => onChange({ ageMax: Number(e.target.value) })} className="input" />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--ink-3)' }}>Gender</span>
              <select value={adSet.gender ?? 'all'} onChange={e => onChange({ gender: e.target.value as 'all' | 'male' | 'female' })} className="input">
                <option value="all">All</option><option value="male">Male</option><option value="female">Female</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--ink-3)' }}>Geo (ISO codes)</span>
              <input value={(adSet.geoLocations ?? []).join(', ')} onChange={e => onChange({ geoLocations: e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) })} className="input" placeholder="IN" />
            </label>
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--ink-3)' }}>Optimization goal</span>
          <select value={adSet.optimizationGoal ?? 'OFFSITE_CONVERSIONS'} onChange={e => onChange({ optimizationGoal: e.target.value })} className="input">
            {OPTIMIZATION_OPTIONS.map(o => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--ink-3)' }}>Creative format</span>
          <select value={adSet.creativeFormat ?? 'image'} onChange={e => onChange({ creativeFormat: e.target.value as ManualAdSetInput['creativeFormat'] })} className="input">
            <option value="image">Image (all variants)</option>
            <option value="video">Video (variant 1 only)</option>
            <option value="both">Both</option>
            <option value="mixed">Mixed (splits into video + image ad sets)</option>
          </select>
        </label>
      </div>
    </div>
  )
}

function InterestPicker({ tenantId, selected, onChange }: { tenantId: string; selected: Array<{ id: string; name: string }>; onChange: (interests: Array<{ id: string; name: string }>) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MetaInterestOption[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runSearch = useCallback((q: string) => {
    if (q.trim().length < 2) { setResults([]); return }
    setSearching(true)
    searchMetaInterests(tenantId, q)
      .then(setResults)
      .catch(() => setResults([]))
      .finally(() => setSearching(false))
  }, [tenantId])

  function handleQueryChange(v: string) {
    setQuery(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(v), 350)
  }

  function addInterest(opt: MetaInterestOption) {
    if (selected.some(s => s.id === opt.id)) return
    onChange([...selected, { id: opt.id, name: opt.name }])
    setQuery('')
    setResults([])
  }
  function removeInterest(id: string) {
    onChange(selected.filter(s => s.id !== id))
  }

  return (
    <div className="mb-3">
      <span className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--ink-3)' }}>Interests (real Meta targeting, searched live)</span>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {selected.map(s => (
          <span key={s.id} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
            {s.name}<button onClick={() => removeInterest(s.id)}><X size={10} /></button>
          </span>
        ))}
      </div>
      <div className="relative">
        <input value={query} onChange={e => handleQueryChange(e.target.value)} className="input" placeholder="Search interests, e.g. astrology…" />
        {searching && <Loader2 size={13} className="animate-spin absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ink-4)' }} />}
        {results.length > 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-lg overflow-hidden max-h-56 overflow-y-auto" style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', boxShadow: 'var(--shadow-raised)' }}>
            {results.map(r => (
              <button key={r.id} onClick={() => addInterest(r)} className="w-full text-left px-3 py-2 text-[12px] flex items-center justify-between hover:opacity-80" style={{ color: 'var(--ink)' }}>
                <span>{r.name}</span>
                <span className="text-[10px]" style={{ color: 'var(--ink-4)' }}>{(r.audienceSize / 1e6).toFixed(1)}M</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function LibraryPicker({
  tenantId, loading, packages, selectedId, onSelect,
}: {
  tenantId: string
  loading: boolean
  packages: CreativePackage[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 size={18} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    )
  }

  if (packages.length === 0) {
    return (
      <div className="rounded-xl px-4 py-8 text-center" style={{ background: 'var(--surface-warm)', border: '1px dashed var(--hairline)' }}>
        <p className="text-[13px]" style={{ color: 'var(--ink-3)' }}>No ready-to-use creative for this product yet.</p>
        <Link
          href={`/dashboard/${tenantId}/creatives`}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold mt-2"
          style={{ color: 'var(--accent-strong)' }}
        >
          Generate one in the Creative library →
        </Link>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {packages.map(pkg => {
        const selected = pkg.copyVariants?.[pkg.selectedCopyIndex ?? 0]
        const isCarousel = (pkg.carouselCards?.length ?? 0) > 0
        const thumb = pkg.images?.[pkg.selectedCopyIndex ?? 0]?.imageUrl
          || pkg.carouselCards?.[0]?.imageUrl
          || pkg.video?.videoThumbnailUrl
        const isActive = selectedId === pkg._id
        return (
          <button
            key={pkg._id}
            onClick={() => !isCarousel && onSelect(pkg._id ?? '')}
            disabled={isCarousel}
            title={isCarousel ? "Carousel creatives can't be attached to a campaign yet" : undefined}
            className="text-left rounded-xl overflow-hidden transition-all"
            style={{
              ...(isActive ? { border: '2px solid var(--accent)' } : { border: '2px solid var(--hairline-light)' }),
              ...(isCarousel ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
            }}
          >
            <div className="relative" style={{ aspectRatio: '4/5', background: 'var(--surface-warm)' }}>
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb} alt={selected?.headline ?? ''} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  {pkg.video?.videoUrl ? <VideoIcon size={18} style={{ color: 'var(--ink-4)' }} /> : <ImageIcon size={18} style={{ color: 'var(--ink-4)' }} />}
                </div>
              )}
              {isCarousel && (
                <span className="chip chip-neutral" style={{ position: 'absolute', top: 6, left: 6, fontSize: '10px', padding: '2px 6px' }}>
                  Carousel — can&rsquo;t attach yet
                </span>
              )}
              {isActive && (
                <div style={{ position: 'absolute', top: 6, right: 6, background: 'var(--accent)', borderRadius: '999px', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle2 size={14} color="#fff" />
                </div>
              )}
            </div>
            <div className="px-2 py-1.5">
              <p className="text-[11.5px] font-semibold truncate" style={{ color: 'var(--ink)' }}>{selected?.headline || 'Untitled'}</p>
              {pkg.targetLanguage && <p className="text-[10.5px]" style={{ color: 'var(--ink-4)' }}>{pkg.targetLanguage}</p>}
            </div>
          </button>
        )
      })}
    </div>
  )
}
