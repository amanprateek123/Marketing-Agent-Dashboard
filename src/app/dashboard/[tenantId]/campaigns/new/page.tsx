'use client'

import { useState, useEffect, use, useCallback, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Loader2, AlertCircle, CheckCircle2, Plus, Trash2,
  Target, Zap, Info, Image as ImageIcon, Video as VideoIcon, X,
  ChevronUp, ChevronDown,
} from 'lucide-react'
import { getCompany, getCampaign, getCreativePackage, getMetaAccounts, getMetaAccountAudiences, getMetaLocales, searchMetaInterests, createManualCampaign, updateManualCampaignConfig, listCreativePackages } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { CampaignFieldGuide } from '@/components/campaign/CampaignFieldGuide'
import type {
  Company, MetaAdAccount, MetaCustomAudience, MetaInterestOption, ManualAdSetInput, ManualCopyVariant, CreativePackage, AdSetConfig,
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
  const searchParams = useSearchParams()
  // Editing a still-pending campaign in place reuses this exact form —
  // same fields, same validation — instead of a separate bespoke editor.
  // Presence of ?edit=<campaignId> switches prefill + submit target only.
  const editCampaignId = searchParams.get('edit') || ''
  const isEditMode = !!editCampaignId

  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [editLoading, setEditLoading] = useState(isEditMode)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Ad account this campaign is being built for — audiences below are
  // account-scoped Meta objects, so the audience list depends on this.
  const [accountOptions, setAccountOptions] = useState<MetaAdAccount[]>([])
  const [accountId, setAccountId] = useState('')
  const [accountAudiences, setAccountAudiences] = useState<MetaCustomAudience[]>([])
  const [audiencesLoading, setAudiencesLoading] = useState(false)
  const [audiencesError, setAudiencesError] = useState('')
  // Verified Meta locale IDs — never hardcoded in this form, always read
  // live from the same table meta-ads.service.ts uses at launch, so the
  // picker can't silently drift from what actually gets sent to Meta.
  const [metaLocales, setMetaLocales] = useState<{ name: string; id: number }[]>([])

  const [name, setName] = useState('')
  const [productName, setProductName] = useState('')
  const [campaignType, setCampaignType] = useState<'advantage_plus' | 'custom'>('custom')
  const [budget, setBudget] = useState(1000)
  const [objective, setObjective] = useState('OUTCOME_SALES')
  const [adSets, setAdSets] = useState<ManualAdSetInput[]>([emptyAdSet('Ad set 1')])
  const [copyVariants, setCopyVariants] = useState<ManualCopyVariant[]>([emptyCopy()])
  // One entry per (variantIndex, aspectRatio) pair. The untagged (aspectRatio
  // undefined) entry is the "primary" image — unchanged from before. Extra,
  // aspectRatio-tagged entries let a human creative team's pre-made sizes
  // ship as Meta placement-customized assets instead of one auto-cropped image.
  const [images, setImages] = useState<Array<{ variantIndex: number; imageUrl: string; aspectRatio?: '9:16' | '1:1' | '4:5' | '16:9' }>>([{ variantIndex: 0, imageUrl: '' }])
  const [videoUrl, setVideoUrl] = useState('')
  const [videoThumbnailUrl, setVideoThumbnailUrl] = useState('')
  // Additional pre-made sizes of the SAME video (the primary videoUrl/videoThumbnailUrl
  // above stay the untagged default) — set alongside videoUrl to ship via Meta
  // placement asset customization instead of one auto-cropped video.
  const [extraVideos, setExtraVideos] = useState<Array<{ aspectRatio: '9:16' | '1:1' | '4:5' | '16:9'; videoUrl: string; videoThumbnailUrl: string }>>([])

  // Creative source — paste URLs by hand (default, unchanged behavior) or
  // pick an already-produced creative from the library instead.
  const [creativeSource, setCreativeSource] = useState<'paste' | 'library'>('paste')
  const [libraryPackages, setLibraryPackages] = useState<CreativePackage[]>([])
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [selectedPackageId, setSelectedPackageId] = useState('')

  useEffect(() => {
    let cancelled = false

    // getMetaAccounts hits Meta's live API and can transiently fail (rate
    // limits, etc.) — kept independent of getCompany so a Meta hiccup
    // doesn't block the tenant's own product list / basic form usability.
    // getMetaLocales is pure backend data (no live Meta call) and must
    // never be coupled to either — it was previously bundled into one
    // Promise.all where an unrelated Meta failure silently emptied the
    // language picker even though locale data had nothing to do with it.
    getCompany(tenantId)
      .then(c => {
        if (cancelled) return
        setCompany(c)
        const active = c.products?.find(p => p.active !== false) ?? c.products?.[0]
        if (active) setProductName(active.name)
        const ids = c.meta?.accountIds?.length ? c.meta.accountIds : c.meta?.accountId ? [c.meta.accountId] : []
        if (ids.length) setAccountId(ids[0].startsWith('act_') ? ids[0] : `act_${ids[0]}`)
      })
      .catch(() => { if (!cancelled) setError('Failed to load account data') })
      .finally(() => { if (!cancelled) setLoading(false) })

    getMetaAccounts(tenantId, true)
      .then(accts => { if (!cancelled) setAccountOptions(accts.accounts) })
      .catch(() => {})

    getMetaLocales(tenantId)
      .then(locales => { if (!cancelled) setMetaLocales(locales) })
      .catch(() => {})

    return () => { cancelled = true }
  }, [tenantId])

  // Prefill from the existing campaign when editing — runs once the base
  // company data above is already in flight; doesn't block it.
  useEffect(() => {
    if (!editCampaignId) return
    let cancelled = false
    getCampaign(tenantId, editCampaignId)
      .then(c => {
        if (cancelled) return
        if (c.status !== 'pending_approval' || c.metaCampaignId) {
          setError('This campaign has already launched to Meta and can no longer be edited here.')
          return
        }
        setName(c.name ?? '')
        setBudget(c.budget ?? 1000)
        setObjective(c.objective || 'OUTCOME_SALES')
        if (c.metaAccountId) setAccountId(c.metaAccountId.startsWith('act_') ? c.metaAccountId : `act_${c.metaAccountId}`)
        const cfgAdSets = c.campaignConfig?.adSets ?? []
        const wasAdvantagePlus = cfgAdSets.length === 1 && cfgAdSets[0].audienceType === 'advantage_plus'
        setCampaignType(wasAdvantagePlus ? 'advantage_plus' : 'custom')
        if (cfgAdSets.length) {
          setAdSets(cfgAdSets.map((a: AdSetConfig): ManualAdSetInput => ({
            name: a.name,
            budgetPercent: a.budgetPercent,
            audienceType: a.audienceType as ManualAdSetInput['audienceType'],
            metaAudienceId: a.metaAudienceId,
            excludeAudienceIds: a.excludeAudienceIds,
            ageMin: a.ageMin,
            ageMax: a.ageMax,
            gender: a.gender as ManualAdSetInput['gender'],
            geoLocations: a.geoLocations,
            locales: a.locales,
            interests: (a.interests ?? []).map(id => ({ id, name: id })),
            optimizationGoal: a.optimizationGoal,
            creativeFormat: a.creativeFormat === 'carousel' ? 'both' : a.creativeFormat,
            ads: a.ads,
          })))
        }
        // Read-only display for the per-ad-set "which creative" picker below
        // (that picker edits `ads` — which variant index each ad set ships —
        // not the copy text itself, so real variant labels are still needed).
        if (c.creativePackageId) {
          getCreativePackage(tenantId, c.creativePackageId)
            .then(pkg => {
              if (cancelled || !pkg.copyVariants?.length) return
              setCopyVariants(pkg.copyVariants.map(v => ({
                primaryText: v.primaryText,
                headline: v.headline ?? '',
                cta: v.cta ?? '',
                hookStyle: v.hookStyle,
              })))
            })
            .catch(() => {})
        }
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load campaign for editing') })
      .finally(() => { if (!cancelled) setEditLoading(false) })
    return () => { cancelled = true }
  }, [tenantId, editCampaignId])

  // Audiences are account-scoped Meta objects — re-fetch live whenever the
  // selected ad account changes, instead of relying on a saved snapshot.
  useEffect(() => {
    if (!accountId) return
    let cancelled = false
    setAudiencesLoading(true)
    setAudiencesError('')
    getMetaAccountAudiences(tenantId, accountId)
      .then(a => { if (!cancelled) setAccountAudiences(a) })
      .catch(e => { if (!cancelled) { setAccountAudiences([]); setAudiencesError(e instanceof Error ? e.message : 'Failed to load audiences') } })
      .finally(() => { if (!cancelled) setAudiencesLoading(false) })
    return () => { cancelled = true }
  }, [tenantId, accountId])

  const configuredAccountIds = useMemo(() => {
    const ids = company?.meta?.accountIds?.length ? company.meta.accountIds : company?.meta?.accountId ? [company.meta.accountId] : []
    return ids.map(id => id.startsWith('act_') ? id : `act_${id}`)
  }, [company])

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

  // When ad sets carry different creative subsets, every variant must be
  // covered by at least one ad set — otherwise it's silently never shown.
  // Backend re-validates this too; this is just an earlier, clearer warning.
  const uncoveredVariants = useMemo(() => {
    if (campaignType !== 'custom' || copyVariants.length <= 1) return []
    const covered = new Set<number>()
    for (const a of adSets) {
      if (!a.ads?.length) return [] // an ad set with no explicit selection covers everything
      for (const vi of a.ads) covered.add(vi)
    }
    return copyVariants.map((_, i) => i).filter(i => !covered.has(i))
  }, [adSets, copyVariants, campaignType])
  const creativeCoverageValid = uncoveredVariants.length === 0

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
  function updateImage(variantIndex: number, imageUrl: string, aspectRatio?: '9:16' | '1:1' | '4:5' | '16:9') {
    setImages(prev => {
      const exists = prev.find(img => img.variantIndex === variantIndex && img.aspectRatio === aspectRatio)
      if (exists) return prev.map(img => img === exists ? { ...img, imageUrl } : img)
      return [...prev, { variantIndex, imageUrl, aspectRatio }]
    })
  }
  function addImageSize(variantIndex: number, aspectRatio: '9:16' | '1:1' | '4:5' | '16:9') {
    setImages(prev => prev.some(img => img.variantIndex === variantIndex && img.aspectRatio === aspectRatio)
      ? prev
      : [...prev, { variantIndex, imageUrl: '', aspectRatio }])
  }
  function removeImageSize(variantIndex: number, aspectRatio: '9:16' | '1:1' | '4:5' | '16:9') {
    setImages(prev => prev.filter(img => !(img.variantIndex === variantIndex && img.aspectRatio === aspectRatio)))
  }

  async function handleSubmit() {
    setError('')
    setSubmitting(true)
    try {
      if (isEditMode) {
        await updateManualCampaignConfig(tenantId, editCampaignId, {
          name: name.trim(),
          accountId: accountId || undefined,
          campaignType,
          budget,
          objective,
          adSets: campaignType === 'advantage_plus' ? [adSets[0]] : adSets,
        })
        router.push(`/dashboard/${tenantId}/campaigns/${editCampaignId}`)
        return
      }
      const dto = {
        name: name.trim(),
        productName: productName || undefined,
        accountId: accountId || undefined,
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
                ...(extraVideos.some(v => v.videoUrl.trim())
                  ? {
                      videos: [
                        ...(videoUrl.trim() ? [{ variantIndex: 0, videoUrl: videoUrl.trim(), videoThumbnailUrl: videoThumbnailUrl.trim() || undefined }] : []),
                        ...extraVideos.filter(v => v.videoUrl.trim()).map(v => ({ variantIndex: 0, videoUrl: v.videoUrl.trim(), videoThumbnailUrl: v.videoThumbnailUrl.trim() || undefined, aspectRatio: v.aspectRatio })),
                      ],
                    }
                  : { video: videoUrl.trim() ? { variantIndex: 0, videoUrl: videoUrl.trim(), videoThumbnailUrl: videoThumbnailUrl.trim() || undefined } : null }),
              },
            }),
      }
      const res = await createManualCampaign(tenantId, dto)
      router.push(`/dashboard/${tenantId}/campaigns/${res.campaignId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to ${isEditMode ? 'save' : 'create'} campaign`)
      setSubmitting(false)
    }
  }

  const librarySelectionValid = isEditMode || creativeSource === 'paste' || !!selectedPackageId

  if (loading || editLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} /></div>

  return (
    <div className="px-8 py-8 max-w-5xl mx-auto stagger pb-20">
      <Link href={isEditMode ? `/dashboard/${tenantId}/campaigns/${editCampaignId}` : `/dashboard/${tenantId}/campaigns`} className="inline-flex items-center gap-1.5 text-sm font-medium mb-5" style={{ color: 'var(--ink-3)' }}>
        <ArrowLeft size={14} /> {isEditMode ? 'Back to campaign' : 'Campaigns'}
      </Link>
      <p className="micro-label mb-2">{isEditMode ? 'Editing pending campaign' : 'New campaign'}</p>
      <h1 className="page-title mb-1">{isEditMode ? 'Edit Campaign' : 'Create Campaign'}</h1>
      <p className="page-subtitle mb-6">
        {isEditMode
          ? 'Changes save directly to this pending campaign — no need to delete and recreate it. Still requires Approve & Launch to go live.'
          : 'Launch directly to Meta with targeting you control — skips the AI review team entirely.'}
      </p>

      {!isEditMode && (
        <div className="mb-6">
          <CampaignFieldGuide />
        </div>
      )}

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
              {!isEditMode && (
                <label className="block">
                  <span className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--ink-2)' }}>Product</span>
                  <select value={productName} onChange={e => setProductName(e.target.value)} className="input">
                    {(company?.products ?? []).map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                  </select>
                </label>
              )}
              <label className="block">
                <span className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--ink-2)' }}>Ad account</span>
                <select value={accountId} onChange={e => setAccountId(e.target.value)} className="input">
                  {configuredAccountIds.map(id => {
                    const bare = id.replace(/^act_/, '')
                    const found = accountOptions.find(a => a.id === id)
                    return <option key={id} value={id}>{found ? `${found.name} (act_${bare})` : `act_${bare}`}</option>
                  })}
                </select>
                <p className="text-[11px] mt-1" style={{ color: 'var(--ink-4)' }}>Determines which account&apos;s audiences show below — audiences are account-specific in Meta.</p>
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
            {!creativeCoverageValid && (
              <p className="text-[11px] font-semibold mb-3 px-3 py-2 rounded-lg" style={{ background: 'var(--bad-bg)', color: 'var(--bad)' }}>
                {uncoveredVariants.length === 1 ? 'This creative variant isn’t' : 'These creative variants aren’t'} assigned to any ad set, so {uncoveredVariants.length === 1 ? 'it' : 'they'} would never be shown: {uncoveredVariants.map(i => copyVariants[i]?.headline || `Variant ${i + 1}`).join(', ')}
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
                  audiences={accountAudiences}
                  audiencesLoading={audiencesLoading}
                  audiencesError={audiencesError}
                  tenantId={tenantId}
                  copyVariants={copyVariants}
                  showCreativeSplit={campaignType === 'custom' && adSets.length > 1}
                  metaLocales={metaLocales}
                  onChange={patch => updateAdSet(i, patch)}
                  onRemove={() => removeAdSet(i)}
                />
              ))}
            </div>
          </section>

          {/* ── Creative ── */}
          {isEditMode ? (
            <div className="rounded-xl px-4 py-3 flex items-start gap-2.5 text-sm" style={{ background: 'var(--info-bg)', border: '1px solid var(--info-border)', color: 'var(--info)' }}>
              <Info size={15} className="mt-0.5 shrink-0" />
              <span>Creative (copy, image, video) isn&rsquo;t edited here — use the copy variant cards on the campaign page instead.</span>
            </div>
          ) : (
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
                  <ImageSizeInputs
                    variantIndex={i}
                    images={images}
                    onUpdate={(url, aspectRatio) => updateImage(i, url, aspectRatio)}
                    onAdd={aspectRatio => addImageSize(i, aspectRatio)}
                    onRemove={aspectRatio => removeImageSize(i, aspectRatio)}
                  />
                </div>
              ))}
              <div className="rounded-xl p-4" style={{ background: 'var(--surface-warm)', border: '1px dashed var(--hairline)' }}>
                <span className="text-[11px] font-semibold flex items-center gap-1 mb-2" style={{ color: 'var(--ink-3)' }}>
                  <VideoIcon size={11} /> Video (optional — used for variant 1 if set){extraVideos.length > 0 ? ' — primary / default size' : ''}
                </span>
                <div className="grid md:grid-cols-2 gap-3">
                  <input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} className="input" placeholder="Video URL" />
                  <input value={videoThumbnailUrl} onChange={e => setVideoThumbnailUrl(e.target.value)} className="input" placeholder="Thumbnail URL (optional)" />
                </div>
                {extraVideos.map((v, vi) => (
                  <div key={v.aspectRatio} className="mt-3 pt-3" style={{ borderTop: '1px solid var(--hairline)' }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-semibold" style={{ color: 'var(--ink-3)' }}>{ASPECT_RATIO_LABELS[v.aspectRatio]}</span>
                      <button type="button" onClick={() => setExtraVideos(prev => prev.filter((_, idx) => idx !== vi))} style={{ color: 'var(--bad)' }}><X size={11} /></button>
                    </div>
                    <div className="grid md:grid-cols-2 gap-3">
                      <input value={v.videoUrl} onChange={e => setExtraVideos(prev => prev.map((x, idx) => idx === vi ? { ...x, videoUrl: e.target.value } : x))} className="input" placeholder="Video URL" />
                      <input value={v.videoThumbnailUrl} onChange={e => setExtraVideos(prev => prev.map((x, idx) => idx === vi ? { ...x, videoThumbnailUrl: e.target.value } : x))} className="input" placeholder="Thumbnail URL (optional)" />
                    </div>
                  </div>
                ))}
                {(Object.keys(ASPECT_RATIO_LABELS) as ImageAspectRatio[]).filter(ar => !extraVideos.some(v => v.aspectRatio === ar)).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(Object.keys(ASPECT_RATIO_LABELS) as ImageAspectRatio[]).filter(ar => !extraVideos.some(v => v.aspectRatio === ar)).map(ar => (
                      <button
                        key={ar}
                        type="button"
                        onClick={() => setExtraVideos(prev => [...prev, { aspectRatio: ar, videoUrl: '', videoThumbnailUrl: '' }])}
                        className="text-[11px] font-semibold px-2 py-1 rounded-lg inline-flex items-center gap-1"
                        style={{ background: 'var(--surface)', border: '1px dashed var(--hairline)', color: 'var(--ink-3)' }}
                      >
                        <Plus size={10} /> {ASPECT_RATIO_LABELS[ar]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            </>
            )}
          </section>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting || !name.trim() || !pctValid || !librarySelectionValid || !creativeCoverageValid}
            className="btn btn-primary w-full justify-center py-3"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {submitting ? (isEditMode ? 'Saving…' : 'Creating…') : isEditMode ? 'Save changes' : 'Create Campaign — sends to Approval'}
          </button>
          <p className="text-[11px] text-center" style={{ color: 'var(--ink-4)' }}>
            {isEditMode
              ? 'Updates this pending campaign in place. Still requires Approve & Launch on the campaign page to go live on Meta.'
              : 'Nothing launches on Meta yet. This creates a pending campaign you’ll review and approve on the next screen — same as AI-generated campaigns.'}
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

type ImageAspectRatio = '9:16' | '1:1' | '4:5' | '16:9'
const ASPECT_RATIO_LABELS: Record<ImageAspectRatio, string> = {
  '9:16': 'Vertical 9:16 — Stories/Reels',
  '4:5': 'Portrait 4:5 — Feed',
  '1:1': 'Square 1:1 — Feed',
  '16:9': 'Landscape 16:9',
}

/**
 * One primary (untagged) image URL per variant, same as before, plus
 * optional extra sizes tagged by aspect ratio. When a variant has 2+ sizes,
 * launch() routes each to the placement it was composed for via Meta's
 * asset_feed_spec instead of auto-cropping the primary image — see
 * MetaAdsService.buildImageAssetFeedSpec.
 */
function ImageSizeInputs({
  variantIndex, images, onUpdate, onAdd, onRemove,
}: {
  variantIndex: number
  images: Array<{ variantIndex: number; imageUrl: string; aspectRatio?: ImageAspectRatio }>
  onUpdate: (imageUrl: string, aspectRatio?: ImageAspectRatio) => void
  onAdd: (aspectRatio: ImageAspectRatio) => void
  onRemove: (aspectRatio: ImageAspectRatio) => void
}) {
  const primary = images.find(img => img.variantIndex === variantIndex && !img.aspectRatio)
  const extras = images.filter(img => img.variantIndex === variantIndex && img.aspectRatio)
  const available = (Object.keys(ASPECT_RATIO_LABELS) as ImageAspectRatio[]).filter(
    ar => !extras.some(e => e.aspectRatio === ar),
  )

  return (
    <div>
      <label className="block">
        <span className="text-[11px] font-semibold flex items-center gap-1 mb-1" style={{ color: 'var(--ink-3)' }}>
          <ImageIcon size={11} /> Image URL{extras.length > 0 ? ' — primary / default size' : ''}
        </span>
        <input value={primary?.imageUrl ?? ''} onChange={e => onUpdate(e.target.value)} className="input" placeholder="https://…" />
      </label>
      {extras.map(img => (
        <label key={img.aspectRatio} className="block mt-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold" style={{ color: 'var(--ink-3)' }}>{ASPECT_RATIO_LABELS[img.aspectRatio!]}</span>
            <button type="button" onClick={() => onRemove(img.aspectRatio!)} style={{ color: 'var(--bad)' }}><X size={11} /></button>
          </div>
          <input value={img.imageUrl} onChange={e => onUpdate(e.target.value, img.aspectRatio)} className="input" placeholder="https://…" />
        </label>
      ))}
      {available.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {available.map(ar => (
            <button
              key={ar}
              type="button"
              onClick={() => onAdd(ar)}
              className="text-[11px] font-semibold px-2 py-1 rounded-lg inline-flex items-center gap-1"
              style={{ background: 'var(--surface)', border: '1px dashed var(--hairline)', color: 'var(--ink-3)' }}
            >
              <Plus size={10} /> {ASPECT_RATIO_LABELS[ar]}
            </button>
          ))}
        </div>
      )}
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
  index, adSet, showBudgetSplit, showTargeting, showRemove, audiences, audiencesLoading, audiencesError, tenantId, copyVariants, showCreativeSplit, metaLocales, onChange, onRemove,
}: {
  index: number
  adSet: ManualAdSetInput
  showBudgetSplit: boolean
  showTargeting: boolean
  showRemove: boolean
  audiences: MetaCustomAudience[]
  audiencesLoading: boolean
  audiencesError: string
  tenantId: string
  copyVariants: ManualCopyVariant[]
  showCreativeSplit: boolean
  metaLocales: { name: string; id: number }[]
  onChange: (patch: Partial<ManualAdSetInput>) => void
  onRemove: () => void
}) {
  const needsAudience = ['lookalike', 'retarget', 'custom'].includes(adSet.audienceType)
  const needsInterests = adSet.audienceType === 'interest'
  // geoLocations defaults to ['IN'] on every fresh ad set (emptyAdSet()) —
  // that's not a sign of deliberate customization, so it's excluded here.
  // Without this exclusion, every new ad set opened "expanded" by default,
  // defeating the point of collapsing this section.
  const isCustomGeo = (adSet.geoLocations?.length ?? 0) > 0
    && !(adSet.geoLocations!.length === 1 && adSet.geoLocations![0] === 'IN')
  const [showAdvanced, setShowAdvanced] = useState(
    !!(adSet.gender && adSet.gender !== 'all') || isCustomGeo || (adSet.locales?.length ?? 0) > 0
    || adSet.ageMin !== undefined && adSet.ageMin !== 18 || adSet.ageMax !== undefined && adSet.ageMax !== 65,
  )

  function toggleLocale(id: number) {
    const current = adSet.locales ?? []
    const next = current.includes(id) ? current.filter(v => v !== id) : [...current, id]
    onChange({ locales: next })
  }

  function toggleCreative(vi: number) {
    const current = adSet.ads?.length ? adSet.ads : copyVariants.map((_, i) => i)
    const next = current.includes(vi) ? current.filter(v => v !== vi) : [...current, vi].sort((a, b) => a - b)
    onChange({ ads: next })
  }

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
              <AudiencePicker
                audiences={audiences}
                audiencesLoading={audiencesLoading}
                audiencesError={audiencesError}
                selectedId={adSet.metaAudienceId ?? ''}
                onSelect={id => onChange({ metaAudienceId: id })}
              />
            </label>
          )}

          {needsInterests && (
            <InterestPicker tenantId={tenantId} selected={adSet.interests ?? []} onChange={interests => onChange({ interests })} />
          )}

          <button
            type="button"
            onClick={() => setShowAdvanced(s => !s)}
            className="text-[11px] font-semibold mb-3 flex items-center gap-1"
            style={{ color: 'var(--accent)' }}
          >
            {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            Advanced targeting (age, gender, geo, language)
          </button>

          {showAdvanced && (
            <div className="mb-3 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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

              <div>
                <span className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--ink-3)' }}>
                  Language <span className="font-normal normal-case" style={{ color: 'var(--ink-4)' }}>(leave empty for no language filter — verified IDs only, see below)</span>
                </span>
                {metaLocales.length === 0 ? (
                  <p className="text-[11px]" style={{ color: 'var(--ink-4)' }}>No verified languages configured yet — add one to META_LOCALE_IDS in audience-targeting-resolver.ts (never guess an ID; Meta silently targets the wrong language).</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {metaLocales.map(l => {
                      const active = (adSet.locales ?? []).includes(l.id)
                      return (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => toggleLocale(l.id)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
                          style={active ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--surface)', color: 'var(--ink-3)', border: '1px solid var(--hairline)' }}
                        >
                          {l.name}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
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

      {showCreativeSplit && copyVariants.length > 1 && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--hairline-light)' }}>
          <span className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--ink-3)' }}>
            Creatives for this ad set <span className="font-normal normal-case" style={{ color: 'var(--ink-4)' }}>(leave all checked to include every variant)</span>
          </span>
          <div className="flex flex-wrap gap-1.5">
            {copyVariants.map((v, vi) => {
              const active = !adSet.ads?.length || adSet.ads.includes(vi)
              return (
                <button
                  key={vi}
                  type="button"
                  onClick={() => toggleCreative(vi)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all max-w-[180px] truncate"
                  style={active ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--surface)', color: 'var(--ink-3)', border: '1px solid var(--hairline)' }}
                  title={v.headline || v.primaryText}
                >
                  {v.headline || v.primaryText || `Variant ${vi + 1}`}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Client-side searchable combobox over an already-loaded audience list —
 * accounts here commonly carry 100-200+ saved audiences, and a plain
 * <select> with that many options is unusable. No live API call needed
 * (unlike InterestPicker below): the full list is already in memory, so
 * filtering is instant.
 */
function AudiencePicker({
  audiences, audiencesLoading, audiencesError, selectedId, onSelect,
}: {
  audiences: MetaCustomAudience[]
  audiencesLoading: boolean
  audiencesError: string
  selectedId: string
  onSelect: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = audiences.find(a => a.id === selectedId)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = q ? audiences.filter(a => a.name.toLowerCase().includes(q)) : audiences
    return base.slice(0, 40)
  }, [audiences, query])

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  function pick(a: MetaCustomAudience) {
    onSelect(a.id)
    setQuery('')
    setOpen(false)
  }

  return (
    <div className="relative" ref={containerRef}>
      {selected && !open ? (
        <button type="button" onClick={() => !audiencesLoading && setOpen(true)} disabled={audiencesLoading} className="input text-left flex items-center justify-between gap-2">
          <span className="truncate">{selected.name} <span style={{ color: 'var(--ink-4)' }}>({selected.type}{selected.approxSizeLower != null ? `, ~${selected.approxSizeLower.toLocaleString()}` : ''})</span></span>
          <ChevronDown size={13} className="shrink-0" style={{ color: 'var(--ink-4)' }} />
        </button>
      ) : (
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          className="input"
          placeholder={audiencesLoading ? 'Loading audiences…' : `Search ${audiences.length} audiences…`}
          disabled={audiencesLoading}
        />
      )}
      {open && !audiencesLoading && (
        <div className="absolute z-20 mt-1 w-full rounded-lg overflow-hidden max-h-64 overflow-y-auto" style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', boxShadow: 'var(--shadow-raised)' }}>
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-[12px]" style={{ color: 'var(--ink-4)' }}>No matches</p>
          ) : filtered.map(a => (
            <button
              key={a.id}
              type="button"
              onClick={() => pick(a)}
              className="w-full text-left px-3 py-2 text-[12px] flex items-center justify-between gap-2 hover:opacity-80"
              style={a.id === selectedId ? { background: 'var(--accent-bg)', color: 'var(--accent)' } : { color: 'var(--ink)' }}
            >
              <span className="truncate">{a.name}</span>
              <span className="text-[10px] shrink-0" style={{ color: 'var(--ink-4)' }}>{a.type}{a.approxSizeLower != null ? ` · ~${a.approxSizeLower.toLocaleString()}` : ''}</span>
            </button>
          ))}
          {filtered.length === 40 && (
            <p className="px-3 py-1.5 text-[10px]" style={{ color: 'var(--ink-4)', borderTop: '1px solid var(--hairline-light)' }}>Showing first 40 — keep typing to narrow down</p>
          )}
        </div>
      )}
      {audiencesError && <p className="text-[11px] mt-1" style={{ color: 'var(--bad)' }}>{audiencesError}</p>}
      {!audiencesLoading && !audiencesError && audiences.length === 0 && <p className="text-[11px] mt-1" style={{ color: 'var(--ink-4)' }}>No audiences found in this ad account.</p>}
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
