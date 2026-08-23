'use client'

import { useState, useEffect, use, useMemo } from 'react'
import Link from 'next/link'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  Megaphone,
  Bot,
  User,
  Search,
  DollarSign,
  Activity,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  ChevronDown,
  Loader2,
  AlertCircle,
  RefreshCw,
  Plus,
  Image as ImageIcon,
  Play,
  Pause,
  ExternalLink,
  ShieldCheck,
  Clock3,
  Database,
} from 'lucide-react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { AdMediaModal } from '@/components/campaign/AdMediaModal'
import { Term, GLOSSARY } from '@/components/plain/Term'
import { formatCurrency, formatDate, formatRelativeTime, cn } from '@/lib/utils'
import type { Campaign, CampaignAdSet, CampaignAd } from '@/types'
import { getIntelligenceDecisions, syncCampaigns, getMetaAccounts } from '@/lib/api'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8082/api/v1'

/** Per-campaign counts of open shadow_review decisions, split by target scope. */
interface CampaignProposalCounts {
  campaign: number
  adset: number
  total: number
}

interface PageProps {
  params: Promise<{ tenantId: string }>
  searchParams: Promise<{ filter?: string; accountId?: string; source?: string }>
}

type SortKey = 'topic' | 'status' | 'objective' | 'budget' | 'spend' | 'result' | 'efficiency' | 'launchedAt'
type SortDir = 'asc' | 'desc'

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'pending_approval', label: 'Awaiting approval' },
  { key: 'needs_attention', label: 'Needs attention' },
  { key: 'paused', label: 'Paused' },
  { key: 'completed', label: 'Completed' },
]

// 'dashboard' = source 'agent' or 'human' — anything built and managed through
// this tool, regardless of who clicked launch. 'manual' = synced in from a
// campaign created directly in Meta Ads Manager, read-only, never tool-managed.
type SourceFilter = 'all' | 'dashboard' | 'manual'
const SOURCE_FILTERS: { key: SourceFilter; label: string }[] = [
  { key: 'all', label: 'All sources' },
  { key: 'dashboard', label: 'Dashboard built' },
  { key: 'manual', label: 'Meta synced' },
]

type ObjectiveGroup = 'sales' | 'awareness' | 'traffic' | 'leads' | 'app' | 'engagement' | 'unknown'

interface CampaignOutcome {
  group: ObjectiveGroup
  objectiveLabel: string
  resultLabel: string
  resultValue: string
  resultSort: number
  efficiencyLabel: string
  efficiencyValue: string
  efficiencySort: number
}

function hasCampaignScopedRecordedReturn(campaign: Campaign): boolean {
  const recordedBasis = campaign.revenueBasis === 'meta_action_value' ||
    campaign.revenueBasis === 'no_attributed_revenue'
  const scopedSource = campaign.revenueAttributionSource != null &&
    campaign.revenueAttributionSource !== 'unknown' &&
    campaign.revenueAttributionSource !== 'unresolved' &&
    campaign.revenueAttributionSource !== 'account_fallback'
  return recordedBasis && scopedSource
}

type CampaignRuntimeMetrics = Campaign & {
  reach?: number
  cpm?: number
  frequency?: number
}

function optimizationGoalFor(campaign: Campaign): string {
  const goals = (campaign.metaAdSets ?? campaign.adSets ?? [])
    .map((adSet) => adSet.optimizationGoal)
    .filter((goal): goal is string => Boolean(goal))
  const uniqueGoals = [...new Set(goals)]
  return uniqueGoals.length > 1 ? 'MIXED' : uniqueGoals.length === 1 ? uniqueGoals[0].toUpperCase() : ''
}

function objectiveGroupFor(campaign: Campaign): ObjectiveGroup {
  const objective = `${campaign.objective ?? campaign.campaignConfig?.objective ?? ''}`.toLowerCase()
  if (!objective) return 'unknown'
  if (/awareness|reach|impression|recall|thruplay|video.view/.test(objective)) return 'awareness'
  if (/traffic|link.click|landing.page/.test(objective)) return 'traffic'
  if (/lead|message/.test(objective)) return 'leads'
  if (/app|install/.test(objective)) return 'app'
  if (/engagement/.test(objective)) return 'engagement'
  if (/sale|purchase|conversion|catalog/.test(objective)) return 'sales'
  return 'unknown'
}

function objectiveLabelFor(campaign: Campaign, group: ObjectiveGroup): string {
  const explicit = campaign.objective ?? campaign.campaignConfig?.objective
  if (!explicit) {
    return ({ sales: 'Sales', awareness: 'Awareness', traffic: 'Traffic', leads: 'Leads', app: 'App growth', engagement: 'Engagement', unknown: 'Not recorded' })[group]
  }
  const normalized = explicit
    .replace(/^OUTCOME_/i, '')
    .replace(/_/g, ' ')
    .toLowerCase()
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function campaignOutcome(campaign: Campaign): CampaignOutcome {
  const group = objectiveGroupFor(campaign)
  const runtimeMetrics = campaign as CampaignRuntimeMetrics
  const optimizationGoal = optimizationGoalFor(campaign)
  const spend = campaign.spend ?? 0
  const impressions = campaign.impressions ?? 0
  const reach = runtimeMetrics.reach ?? 0
  const clicks = campaign.clicks ?? 0
  const conversions = campaign.conversions ?? 0
  const campaignAdSets = campaign.metaAdSets ?? campaign.adSets ?? []
  const hasLandingPageViews = campaignAdSets.some((adSet) => adSet.landingPageView != null)
  const landingPageViews = hasLandingPageViews
    ? campaignAdSets.reduce((sum, adSet) => sum + (adSet.landingPageView ?? 0), 0)
    : undefined
  const ads = (campaign.metaAdSets ?? campaign.adSets ?? []).flatMap((adSet) => adSet.ads ?? [])
  const hasThruplays = ads.some((ad) => ad.thruplay != null)
  const thruplays = hasThruplays ? ads.reduce((sum, ad) => sum + (ad.thruplay ?? 0), 0) : undefined
  const hasThreeSecondViews = ads.some((ad) => ad.video3s != null)
  const threeSecondViews = hasThreeSecondViews ? ads.reduce((sum, ad) => sum + (ad.video3s ?? 0), 0) : undefined
  const costPerResult = conversions > 0 ? spend / conversions : 0
  const cpm = runtimeMetrics.cpm ?? (impressions > 0 ? (spend / impressions) * 1000 : 0)
  const cpc = campaign.cpc ?? (clicks > 0 ? spend / clicks : 0)

  if (optimizationGoal === 'MIXED') {
    return {
      group,
      objectiveLabel: objectiveLabelFor(campaign, group),
      resultLabel: 'Mixed optimization goals',
      resultValue: 'See ad sets',
      resultSort: 0,
      efficiencyLabel: 'Goal-specific efficiency',
      efficiencyValue: 'See ad sets',
      efficiencySort: 0,
    }
  }

  if (optimizationGoal === 'REACH' || optimizationGoal === 'IMPRESSIONS' || optimizationGoal === 'AD_RECALL_LIFT') {
    const useReach = optimizationGoal === 'REACH'
    const deliveryResult = useReach ? runtimeMetrics.reach : impressions
    return {
      group,
      objectiveLabel: objectiveLabelFor(campaign, group),
      resultLabel: useReach ? 'Reach' : 'Impressions',
      resultValue: deliveryResult == null ? 'Unavailable' : deliveryResult.toLocaleString(),
      resultSort: deliveryResult ?? 0,
      efficiencyLabel: 'CPM',
      efficiencyValue: cpm > 0 ? formatCurrency(cpm) : '—',
      efficiencySort: cpm,
    }
  }

  if (optimizationGoal === 'LANDING_PAGE_VIEWS' || optimizationGoal === 'LINK_CLICKS') {
    const useLandingViews = optimizationGoal === 'LANDING_PAGE_VIEWS'
    const trafficResult = useLandingViews ? landingPageViews : clicks
    const trafficCost = trafficResult != null && trafficResult > 0 ? spend / trafficResult : useLandingViews ? 0 : cpc
    return {
      group,
      objectiveLabel: objectiveLabelFor(campaign, group),
      resultLabel: useLandingViews ? 'Landing-page views' : 'Clicks',
      resultValue: trafficResult == null ? 'Unavailable' : trafficResult.toLocaleString(),
      resultSort: trafficResult ?? 0,
      efficiencyLabel: useLandingViews ? 'Cost / LPV' : 'CPC',
      efficiencyValue: trafficCost > 0 ? formatCurrency(trafficCost) : '—',
      efficiencySort: trafficCost,
    }
  }

  if (optimizationGoal === 'THRUPLAY' || optimizationGoal === 'TWO_SECOND_CONTINUOUS_VIDEO_VIEWS') {
    const hasExactThruplays = optimizationGoal === 'THRUPLAY'
    const videoResult = hasExactThruplays ? thruplays : threeSecondViews
    const videoCost = videoResult != null && videoResult > 0 ? spend / videoResult : 0
    return {
      group,
      objectiveLabel: objectiveLabelFor(campaign, group),
      resultLabel: hasExactThruplays ? 'ThruPlays' : '3-sec views (proxy)',
      resultValue: videoResult == null ? 'Unavailable' : videoResult.toLocaleString(),
      resultSort: videoResult ?? 0,
      efficiencyLabel: hasExactThruplays ? 'Cost / ThruPlay' : 'Cost / 3-sec view',
      efficiencyValue: videoResult == null ? 'Unavailable' : videoCost > 0 ? formatCurrency(videoCost) : '—',
      efficiencySort: videoCost,
    }
  }

  if (group === 'awareness') {
    const awarenessResult = reach > 0 ? reach : impressions
    const awarenessLabel = reach > 0 ? 'Reach' : 'Impressions'
    return {
      group,
      objectiveLabel: objectiveLabelFor(campaign, group),
      resultLabel: awarenessLabel,
      resultValue: awarenessResult > 0 ? awarenessResult.toLocaleString() : '—',
      resultSort: awarenessResult,
      efficiencyLabel: 'CPM',
      efficiencyValue: cpm > 0 ? formatCurrency(cpm) : '—',
      efficiencySort: cpm,
    }
  }
  if (group === 'traffic' && !['OFFSITE_CONVERSIONS', 'APP_INSTALLS'].includes(optimizationGoal)) {
    const trafficResult = landingPageViews ?? clicks
    const trafficLabel = landingPageViews != null ? 'Landing-page views' : 'Clicks (delivery proxy)'
    const trafficCost = trafficResult != null && trafficResult > 0 ? spend / trafficResult : cpc
    return {
      group,
      objectiveLabel: objectiveLabelFor(campaign, group),
      resultLabel: trafficLabel,
      resultValue: trafficResult > 0 ? trafficResult.toLocaleString() : '—',
      resultSort: trafficResult,
      efficiencyLabel: landingPageViews != null ? 'Cost / LPV' : 'CPC',
      efficiencyValue: trafficCost > 0 ? formatCurrency(trafficCost) : '—',
      efficiencySort: trafficCost,
    }
  }

  const resultLabel = group === 'leads'
    ? 'Leads'
    : group === 'app'
      ? 'App results'
      : group === 'sales'
        ? 'Attributed sales results'
        : group === 'engagement'
          ? 'Engagement results'
          : 'Results'
  const efficiencyLabel = group === 'leads'
    ? 'Cost / lead'
    : group === 'sales'
      ? 'Raw ROAS'
      : group === 'engagement'
        ? 'Cost / engagement'
        : 'Cost / result'
  const roas = campaign.roas ?? 0
  const returnResolved = hasCampaignScopedRecordedReturn(campaign)
  const configuredEstimate = campaign.revenueBasis === 'configured_conversion_value'
  return {
    group,
    objectiveLabel: objectiveLabelFor(campaign, group),
    resultLabel,
    resultValue: conversions.toLocaleString(),
    resultSort: conversions,
    efficiencyLabel: group === 'sales' && configuredEstimate
      ? 'Configured estimate · not raw proof'
      : efficiencyLabel,
    efficiencyValue: group === 'sales'
      ? (returnResolved ? `${roas.toFixed(2)}x` : configuredEstimate ? 'Withheld' : 'Unavailable')
      : (costPerResult > 0 ? formatCurrency(costPerResult) : '—'),
    efficiencySort: group === 'sales' ? (returnResolved ? roas : 0) : costPerResult,
  }
}

function campaignNeedsAttention(campaign: Campaign, proposals?: CampaignProposalCounts): boolean {
  const pendingActions = (campaign.pendingActions ?? []).some((action) => action.status === 'pending')
  return campaign.status === 'failed' || pendingActions || (proposals?.total ?? 0) > 0
}

// ── Source badge ──────────────────────────────────────────────────────────────
// 'agent' = fully autonomous pipeline launch. 'human' = someone built this
// using this dashboard's own Create Campaign form — still tool-managed
// (budget caps, auto-pause apply), just not AI-authored. 'manual' = synced in
// because it was created directly in Meta Ads Manager — outside the tool
// entirely, read-only, never safety-rail-managed. All three must render
// distinctly or "manual create" and "synced from Meta" look identical.
function SourceBadge({ source }: { source?: 'agent' | 'human' | 'manual' }) {
  if (!source) return <span style={{ color: 'var(--ink-4)' }}>—</span>
  if (source === 'agent') {
    return (
      <span className="chip chip-accent">
        <Bot size={11} /> AI built
      </span>
    )
  }
  if (source === 'human') {
    return (
      <span className="chip chip-neutral">
        <User size={11} /> Dashboard built
      </span>
    )
  }
  return (
    <span className="chip chip-neutral" title="Created directly in Meta Ads Manager — synced here for visibility only, not managed by this tool">
      <ExternalLink size={11} /> Meta synced
    </span>
  )
}

// ── Ad thumbnail ─────────────────────────────────────────────────────────────
// Meta's creative thumbnail_url — poster frame for video ads, the actual
// image for image ads. Synced already; this is purely a display addition.
function AdThumbnail({ thumbnailUrl, isVideo }: { thumbnailUrl?: string; isVideo?: boolean }) {
  const [errored, setErrored] = useState(false)
  const showImage = !!thumbnailUrl && !errored
  return (
    <div
      className="relative shrink-0 rounded-lg overflow-hidden"
      style={{ width: 32, height: 32, background: 'var(--surface-warm)', border: '1px solid var(--hairline-light)' }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnailUrl}
          alt=""
          className="w-full h-full"
          style={{ objectFit: 'cover' }}
          onError={() => setErrored(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <ImageIcon size={12} style={{ color: 'var(--ink-4)' }} />
        </div>
      )}
      {isVideo && (
        <div
          className="absolute bottom-0 right-0 flex items-center justify-center rounded-tl-md"
          style={{ width: 14, height: 14, background: 'rgba(0,0,0,0.65)' }}
        >
          <Play size={7} fill="#fff" style={{ color: '#fff' }} />
        </div>
      )}
    </div>
  )
}

// ── Inline ad row ─────────────────────────────────────────────────────────────
function InlineAdRow({ ad, onViewAd }: { ad: CampaignAd; onViewAd?: (ad: CampaignAd) => void }) {
  const hasMedia = !!(ad.thumbnailUrl || ad.creativeVideoId)
  return (
    <tr style={{ borderBottom: '1px solid var(--hairline-light)' }}>
      <td className="px-4 py-2 pl-14">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => hasMedia && onViewAd?.(ad)}
            disabled={!hasMedia}
            className={hasMedia ? 'cursor-pointer' : 'cursor-default'}
            title={hasMedia ? (ad.creativeVideoId ? 'Play video' : 'View image') : undefined}
          >
            <AdThumbnail thumbnailUrl={ad.thumbnailUrl} isVideo={!!ad.creativeVideoId || ad.format === 'video'} />
          </button>
          <div className="min-w-0">
            <p className="text-xs font-medium truncate" style={{ color: 'var(--ink)', maxWidth: 200 }}>{ad.name || '—'}</p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {ad.hookStyle && (
                <span className="chip chip-neutral">{ad.hookStyle}</span>
              )}
              {ad.format && (
                <span className="chip chip-accent">{ad.format}</span>
              )}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-2 text-xs mono tabular-nums whitespace-nowrap" style={{ color: 'var(--ink-2)' }}>
        {ad.spend ? formatCurrency(ad.spend) : '—'}
      </td>
      <td className="px-4 py-2 text-xs mono tabular-nums" style={{ color: 'var(--ink-2)' }}>
        {ad.impressions?.toLocaleString() ?? '—'}
      </td>
      <td className="px-4 py-2 text-xs mono tabular-nums" style={{ color: 'var(--ink-2)' }}>
        {ad.ctr != null ? `${ad.ctr.toFixed(2)}%` : '—'}
      </td>
      <td className="px-4 py-2 text-xs mono tabular-nums whitespace-nowrap" style={{ color: 'var(--ink-2)' }}>
        {ad.cpa ? formatCurrency(ad.cpa) : '—'}
      </td>
      <td className="px-4 py-2 text-xs mono tabular-nums" style={{ color: 'var(--ink-2)' }}>
        {ad.frequency?.toFixed(2) || '—'}
      </td>
      <td className="px-4 py-2 text-xs mono tabular-nums" style={{ color: 'var(--ink-2)' }}>
        {ad.conversions ?? '—'}
      </td>
      <td className="px-4 py-2" />
    </tr>
  )
}

// ── Inline adset row ──────────────────────────────────────────────────────────
function InlineAdSetRow({
  adSet,
  tenantId,
  proposalsCount,
  onViewAd,
}: {
  adSet: CampaignAdSet
  tenantId: string
  proposalsCount?: number
  onViewAd?: (ad: CampaignAd) => void
}) {
  const [adsOpen, setAdsOpen] = useState(false)
  const ads = adSet.ads || []

  return (
    <>
      <tr style={{ background: 'var(--accent-bg)', borderBottom: '1px solid var(--accent-border)' }}>
        <td className="px-4 py-2.5 pl-12">
          <div className="flex items-center gap-2">
            {ads.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setAdsOpen((o) => !o) }}
                className="shrink-0 w-4 h-4 flex items-center justify-center rounded hover:bg-[var(--accent-border)] transition-colors"
              >
                <ChevronRight
                  size={11}
                  className={cn('transition-transform', adsOpen && 'rotate-90')}
                  style={{ color: 'var(--accent)' }}
                />
              </button>
            )}
            <div className="min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: 'var(--accent-strong)', maxWidth: 200 }}>{adSet.name || '—'}</p>
              {adSet.audienceType && (
                <p className="text-[11px] capitalize mt-0.5" style={{ color: 'var(--ink-3)' }}>{adSet.audienceType.replace(/_/g, ' ')}</p>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-2.5 text-xs mono tabular-nums whitespace-nowrap" style={{ color: 'var(--accent-strong)' }}>
          {adSet.spend ? formatCurrency(adSet.spend) : '—'}
        </td>
        <td className="px-4 py-2.5 text-xs mono tabular-nums" style={{ color: 'var(--accent-strong)' }}>
          {adSet.impressions?.toLocaleString() ?? '—'}
        </td>
        <td className="px-4 py-2.5 text-xs mono tabular-nums" style={{ color: 'var(--accent-strong)' }}>
          {adSet.ctr != null ? `${adSet.ctr.toFixed(2)}%` : '—'}
        </td>
        <td className="px-4 py-2.5 text-xs mono tabular-nums whitespace-nowrap" style={{ color: 'var(--accent-strong)' }}>
          {adSet.cpa ? formatCurrency(adSet.cpa) : '—'}
        </td>
        <td className="px-4 py-2.5 text-xs mono tabular-nums" style={{ color: 'var(--accent-strong)' }}>
          {adSet.frequency?.toFixed(2) || '—'}
        </td>
        <td className="px-4 py-2.5 text-xs mono tabular-nums" style={{ color: 'var(--accent-strong)' }}>
          {adSet.conversions ?? '—'}
        </td>
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-2">
            {adSet.status && <StatusBadge status={adSet.status} />}
            {proposalsCount && proposalsCount > 0 && adSet.id && (
              <Link
                href={`/dashboard/${tenantId}/proposed-actions?targetId=${adSet.id}`}
                onClick={(e) => e.stopPropagation()}
                className="chip chip-accent transition-opacity hover:opacity-80"
                title={`${proposalsCount} proposal${proposalsCount === 1 ? '' : 's'} from the agent for this ad group`}
              >
                {proposalsCount} proposal{proposalsCount === 1 ? '' : 's'}
              </Link>
            )}
          </div>
        </td>
      </tr>
      {adsOpen && ads.map((ad, i) => <InlineAdRow key={ad.id || i} ad={ad} onViewAd={onViewAd} />)}
    </>
  )
}

// ── Campaign row ──────────────────────────────────────────────────────────────
function CampaignRow({
  campaign,
  tenantId,
  isPending,
  proposals,
  adsetProposals,
  onViewAd,
}: {
  campaign: Campaign
  tenantId: string
  isPending: boolean
  proposals?: CampaignProposalCounts
  adsetProposals?: Record<string, number>
  onViewAd?: (ad: CampaignAd) => void
}) {
  const [open, setOpen] = useState(false)
  const adSets = campaign.metaAdSets || []
  const outcome = campaignOutcome(campaign)
  const returnResolved = hasCampaignScopedRecordedReturn(campaign)
  const optimizationGoal = optimizationGoalFor(campaign)
  const optimizationLabel = optimizationGoal
    ? optimizationGoal.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
    : ''

  return (
    <>
      <tr className="group">
        {/* Campaign name */}
        <td style={{ maxWidth: 0, width: '35%' }}>
          <div className="flex items-start gap-2 min-w-0">
            {/* Expand toggle (non-pending only) */}
            {!isPending ? (
              <button
                onClick={() => setOpen((o) => !o)}
                className="mt-0.5 shrink-0 w-5 h-5 rounded flex items-center justify-center hover:bg-[var(--accent-bg)] transition-colors"
                title={open ? 'Collapse' : 'Expand ad sets'}
              >
                <ChevronDown
                  size={12}
                  className={cn('transition-transform', !open && '-rotate-90')}
                  style={{ color: adSets.length > 0 ? 'var(--accent)' : 'var(--ink-4)' }}
                />
              </button>
            ) : (
              /* Pending pulse dot */
              <span className="mt-1.5 shrink-0 relative inline-flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--warn)' }} />
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: 'var(--warn)' }} />
              </span>
            )}

            <div className="min-w-0 flex-1">
              <Link
                href={`/dashboard/${tenantId}/campaigns/${campaign._id}`}
                onClick={(e) => e.stopPropagation()}
                className="text-[13px] font-semibold transition-opacity hover:opacity-70 block truncate"
                style={{ color: 'var(--ink)' }}
                title={campaign.name || campaign.topic || 'Untitled Campaign'}
              >
                {campaign.name || campaign.topic || 'Untitled Campaign'}
              </Link>
              {campaign.name && campaign.topic && (
                <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--ink-3)' }} title={campaign.topic}>
                  {campaign.topic}
                </p>
              )}
              {campaign.productName && (
                <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--ink-3)' }}>
                  {campaign.productName}
                </p>
              )}
              {isPending && (
                <p className="text-[11px] mt-0.5 font-medium" style={{ color: 'var(--warn)' }}>
                  Awaiting approval
                </p>
              )}
              {!isPending && adSets.length > 0 && (
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--accent)' }}>
                  {adSets.length} ad set{adSets.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
        </td>

        {/* Status */}
        <td className="whitespace-nowrap">
          <StatusBadge status={campaign.status} />
          {campaign.status === 'paused' && campaign.pausedAt && (
            <p className="text-[10px] mt-1" style={{ color: 'var(--ink-4)' }} title={campaign.pauseReason}>
              <Pause size={9} className="inline mr-0.5" />{formatRelativeTime(campaign.pausedAt)}
            </p>
          )}
        </td>

        {/* Objective */}
        <td className="whitespace-nowrap">
          <span className="chip chip-info">{outcome.objectiveLabel}</span>
          {optimizationLabel && (
            <p className="text-[10px] mt-1" style={{ color: 'var(--ink-3)' }}>Optimizes for {optimizationLabel}</p>
          )}
        </td>

        {/* Budget */}
        <td className="num whitespace-nowrap mono text-[12px]">
          {campaign.budget ? formatCurrency(campaign.budget) : <span style={{ color: 'var(--ink-4)' }}>—</span>}
        </td>

        {/* Spend */}
        <td className="num whitespace-nowrap mono text-[12px]">
          {campaign.spend ? formatCurrency(campaign.spend) : <span style={{ color: 'var(--ink-4)' }}>—</span>}
        </td>

        {/* Objective-specific result */}
        <td className="num whitespace-nowrap">
          <p className="mono text-[12px] font-semibold" style={{ color: 'var(--ink)' }}>{outcome.resultValue}</p>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--ink-3)' }}>{outcome.resultLabel}</p>
        </td>

        {/* Objective-specific efficiency */}
        <td className="num whitespace-nowrap">
          <p
            className="mono text-[12px] font-semibold"
            style={{
              color: outcome.group === 'sales' && campaign.roas != null && returnResolved
                ? campaign.roas >= 1 ? 'var(--good)' : 'var(--bad)'
                : 'var(--ink)',
            }}
          >
            {outcome.efficiencyValue}
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--ink-3)' }}>{outcome.efficiencyLabel}</p>
        </td>

        {/* Source */}
        <td className="whitespace-nowrap">
          <SourceBadge source={campaign.source} />
        </td>

        {/* Launched */}
        <td className="num whitespace-nowrap text-[11px] mono" style={{ color: 'var(--ink-3)' }}>
          {formatDate(campaign.launchedAt)}
          <span className="block mt-1 text-[10px]">
            {campaign.dataAsOf ? `Metrics ${formatRelativeTime(campaign.dataAsOf)}` : 'Metrics freshness unknown'}
          </span>
        </td>

        {/* Action */}
        <td className="num whitespace-nowrap">
          <div className="flex items-center justify-end gap-2">
            {/* Agent proposals — link to the campaign-scope filter on the
                 proposed-actions page. Only render when there's at least one
                 open shadow_review decision for this campaign. */}
            {!isPending && proposals && proposals.campaign > 0 && (
              <Link
                href={`/dashboard/${tenantId}/proposed-actions?campaignId=${campaign._id}&scope=campaign`}
                onClick={(e) => e.stopPropagation()}
                className="chip chip-accent transition-opacity hover:opacity-80"
                title={`${proposals.campaign} campaign-level proposal${proposals.campaign === 1 ? '' : 's'} from the agent`}
              >
                {proposals.campaign} campaign proposal{proposals.campaign === 1 ? '' : 's'}
              </Link>
            )}
            {!isPending && (() => {
              const GROWTH_TYPES = ['scale_adset', 'replace_creative', 'add_creative', 'add_adset']
              const approvalNeeded = (campaign.pendingActions || []).filter(
                a => a.status === 'pending' && GROWTH_TYPES.includes(a.type)
              ).length
              if (approvalNeeded > 0) return (
                <Link
                  href={`/dashboard/${tenantId}/campaigns/${campaign._id}`}
                  onClick={e => e.stopPropagation()}
                  className="chip chip-warn transition-opacity hover:opacity-80"
                >
                  <AlertCircle size={10} /> {approvalNeeded} awaiting approval
                </Link>
              )
              return null
            })()}
            {isPending ? (
              <Link
                href={`/dashboard/${tenantId}/campaigns/${campaign._id}`}
                className="chip chip-warn transition-opacity hover:opacity-80"
                onClick={e => e.stopPropagation()}
              >
                Review <ChevronRight size={10} />
              </Link>
            ) : (
              <ChevronRight
                size={14}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: 'var(--accent)' }}
              />
            )}
          </div>
        </td>
      </tr>

      {/* Live ad sets expansion */}
      {open && !isPending && (
        <tr style={{ borderBottom: '1px solid var(--accent-border)' }}>
          <td colSpan={10} className="px-0 py-0" style={{ padding: 0 }}>
            {adSets.length === 0 ? (
              <div className="px-12 py-3 text-xs" style={{ background: 'var(--accent-bg)', color: 'var(--ink-3)' }}>
                No ad sets on this campaign yet.
              </div>
            ) : (
              <table className="w-full" style={{ background: 'var(--accent-bg)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--accent-border)' }}>
                    {[
                      { key: 'Ad Set / Audience', node: 'Ad Set / Audience' as React.ReactNode },
                      { key: 'Spend', node: 'Spend' },
                      { key: 'Impressions', node: 'Impressions' },
                      { key: 'CTR', node: <Term help={GLOSSARY.ctr}>CTR</Term> },
                      { key: 'CPA', node: <Term help={GLOSSARY.cpa}>CPA</Term> },
                      { key: 'Freq.', node: <Term help={GLOSSARY.freq}>Freq.</Term> },
                      { key: 'Conv.', node: <Term help={GLOSSARY.conv}>Conv.</Term> },
                      { key: 'Status', node: 'Status' },
                    ].map((h, i) => (
                      <th
                        key={h.key}
                        className={`px-4 py-2 micro-label ${i === 0 ? 'pl-12 text-left' : 'text-left'}`}
                        style={{ color: 'var(--accent)' }}
                      >
                        {h.node}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {adSets.map((adSet, i) => (
                    <InlineAdSetRow
                      key={adSet.id || i}
                      adSet={adSet}
                      tenantId={tenantId}
                      proposalsCount={adSet.id ? adsetProposals?.[adSet.id] : 0}
                      onViewAd={onViewAd}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

// ── Sort icon ─────────────────────────────────────────────────────────────────
function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ArrowUpDown size={10} style={{ color: 'var(--ink-4)' }} />
  return sortDir === 'asc'
    ? <ArrowUp size={10} style={{ color: 'var(--accent)' }} />
    : <ArrowDown size={10} style={{ color: 'var(--accent)' }} />
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  iconColor,
  iconBg,
  accent,
}: {
  icon: React.ElementType
  label: React.ReactNode
  value: string | number
  iconColor: string
  iconBg: string
  accent?: string
}) {
  return (
    <div className="card overflow-hidden">
      {accent && <div style={{ height: 2, background: accent }} />}
      <div className="px-5 py-4 flex items-center gap-3.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: iconBg }}>
          <Icon size={15} style={{ color: iconColor }} />
        </div>
        <div className="min-w-0">
          <p className="micro-label mb-1 truncate">{label}</p>
          <p className="display-num text-[22px] truncate" style={{ color: 'var(--ink)' }}>{value}</p>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CampaignsPage({ params, searchParams }: PageProps) {
  const { tenantId }       = use(params)
  const { filter: initFilter, accountId: initAccountId, source: initSource } = use(searchParams)

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [auditState, setAuditState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [auditResult, setAuditResult] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [viewAd, setViewAd] = useState<CampaignAd | null>(null)

  // Open shadow_review decisions, indexed for per-row lookup.
  const [proposalsByCampaign, setProposalsByCampaign] = useState<Record<string, CampaignProposalCounts>>({})
  const [proposalsByAdset, setProposalsByAdset] = useState<Record<string, number>>({})

  // Ad account id → display name, best-effort (only populated if a Meta
  // access token is on file) — falls back to showing the raw account id.
  const [accountNames, setAccountNames] = useState<Record<string, string>>({})

  const [search, setSearch]         = useState('')
  const [statusFilter, setStatusFilter] = useState(initFilter ?? 'active')
  const [accountFilter, setAccountFilter] = useState(initAccountId ?? 'all')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>((initSource as SourceFilter) ?? 'all')
  const [sortKey, setSortKey]       = useState<SortKey>('launchedAt')
  const [sortDir, setSortDir]       = useState<SortDir>('desc')

  async function fetchCampaigns() {
    try {
      const res = await fetch(`${API_BASE}/campaigns/${tenantId}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setCampaigns(await res.json())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaigns')
    } finally {
      setLoading(false)
    }
  }

  // Pulls fresh data from Meta (not just Mongo) for every active campaign,
  // then polls the list so numbers update live as the sync lands. The sync
  // endpoint is fire-and-forget (returns as soon as it's queued, not when
  // it's done), so we don't know exactly when it finishes — poll on a fixed
  // cadence for a bounded window instead of waiting on a single response.
  async function handleSyncFromMeta() {
    setSyncing(true)
    setSyncError(null)
    try {
      await syncCampaigns(tenantId)
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Failed to start sync')
      setSyncing(false)
      return
    }
    const POLL_MS = 5000
    const MAX_POLLS = 12 // ~60s
    let n = 0
    const poll = async () => {
      n++
      await fetchCampaigns()
      if (n >= MAX_POLLS) { setSyncing(false); return }
      setTimeout(poll, POLL_MS)
    }
    setTimeout(poll, POLL_MS)
  }

  // Pulls open shadow_review decisions and groups them by campaign + adset
  // so each row can show a "See proposals" chip without a per-row fetch.
  async function fetchProposalCounts() {
    try {
      const list = await getIntelligenceDecisions(tenantId, { status: 'shadow_review', limit: 500 })
      const byCampaign: Record<string, CampaignProposalCounts> = {}
      const byAdset: Record<string, number> = {}
      for (const d of list.decisions) {
        if (!d.campaignId) continue
        const b = (byCampaign[d.campaignId] ??= { campaign: 0, adset: 0, total: 0 })
        b.total += 1
        if (d.targetType === 'campaign') b.campaign += 1
        else if (d.targetType === 'adset') b.adset += 1
        if (d.targetType === 'adset' && d.targetId) {
          byAdset[d.targetId] = (byAdset[d.targetId] || 0) + 1
        }
      }
      setProposalsByCampaign(byCampaign)
      setProposalsByAdset(byAdset)
    } catch {
      // Non-fatal — campaigns list still renders, just without the chips.
    }
  }

  // Best-effort — the account-name lookup calls Meta live and needs an access
  // token on file, so a failure here just means the filter falls back to
  // showing raw account ids instead of names. Never blocks the campaign list.
  async function fetchAccountNames() {
    try {
      const res = await getMetaAccounts(tenantId, true)
      const names: Record<string, string> = {}
      for (const acc of res.accounts) names[acc.id] = acc.name || acc.id
      setAccountNames(names)
    } catch {
      // no-op — filter dropdown falls back to raw ids
    }
  }

  useEffect(() => {
    fetchCampaigns()
    fetchProposalCounts()
    fetchAccountNames()
  }, [tenantId]) // eslint-disable-line

  async function handleRunAudit() {
    setAuditState('loading')
    setAuditResult(null)
    try {
      const res = await fetch(`${API_BASE}/campaigns/${tenantId}/audit`, { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setAuditState('success')
      const parts: string[] = []
      if (data.campaignsAudited != null) parts.push(`${data.campaignsAudited} audited`)
      if (data.paused != null) parts.push(`${data.paused} paused`)
      if (data.actionsCreated != null) parts.push(`${data.actionsCreated} actions created`)
      setAuditResult(parts.length > 0 ? parts.join(', ') : 'Audit complete')
      fetchCampaigns()
      setTimeout(() => { setAuditState('idle'); setAuditResult(null) }, 6000)
    } catch (err) {
      setAuditState('error')
      setAuditResult(err instanceof Error ? err.message : 'Audit failed')
      setTimeout(() => { setAuditState('idle'); setAuditResult(null) }, 5000)
    }
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('desc') }
  }

  // Derived portfolio status. Spend is deliberately scoped to campaigns built
  // in Meridian; Meta-synced campaigns remain visible below but are read-only.
  const managedSpend = campaigns
    .filter((campaign) => campaign.source === 'agent' || campaign.source === 'human')
    .reduce((sum, campaign) => sum + (campaign.spend || 0), 0)
  const activeCampaigns = campaigns.filter((c) => c.status === 'active').length
  const pendingCampaigns = campaigns.filter((c) => c.status === 'pending_approval').length
  const attentionCampaigns = campaigns.filter((campaign) =>
    campaignNeedsAttention(campaign, proposalsByCampaign[campaign._id]),
  ).length
  const activeCampaignRows = campaigns.filter((campaign) => campaign.status === 'active')
  const latestMetricsAt = activeCampaignRows
    .map((campaign) => campaign.dataAsOf)
    .filter((date): date is string => Boolean(date))
    .sort()
    .at(-1)
  const activeWithoutFreshness = activeCampaignRows.filter((campaign) => !campaign.dataAsOf).length
  const latestAudit = campaigns
    .map((campaign) => campaign.lastAuditedAt)
    .filter((date): date is string => Boolean(date))
    .sort()
    .at(-1)

  const countByStatus = useMemo(() => {
    const m: Record<string, number> = { all: campaigns.length }
    campaigns.forEach((c) => { m[c.status] = (m[c.status] || 0) + 1 })
    m.needs_attention = campaigns.filter((campaign) =>
      campaignNeedsAttention(campaign, proposalsByCampaign[campaign._id]),
    ).length
    return m
  }, [campaigns, proposalsByCampaign])

  // Ad accounts actually present in this tenant's campaigns — always
  // selectable even if the Meta name lookup above never resolved.
  const accountOptions = useMemo(() => {
    const ids = new Set<string>()
    campaigns.forEach((c) => { if (c.metaAccountId) ids.add(c.metaAccountId) })
    return Array.from(ids).map((id) => ({ id, label: accountNames[id] ?? id }))
  }, [campaigns, accountNames])

  const filtered = useMemo(() => {
    let list = campaigns
    if (statusFilter === 'needs_attention') {
      list = list.filter((campaign) => campaignNeedsAttention(campaign, proposalsByCampaign[campaign._id]))
    } else if (statusFilter !== 'all') {
      list = list.filter((c) => c.status === statusFilter)
    }
    if (accountFilter !== 'all') list = list.filter((c) => c.metaAccountId === accountFilter)
    if (sourceFilter === 'dashboard') list = list.filter((c) => c.source === 'agent' || c.source === 'human')
    else if (sourceFilter === 'manual') list = list.filter((c) => c.source === 'manual')
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.topic?.toLowerCase().includes(q) ||
          c.metaCampaignId?.toLowerCase().includes(q)
      )
    }
    return [...list].sort((a, b) => {
      let va: number | string = 0, vb: number | string = 0
      switch (sortKey) {
        case 'topic':       va = a.name || a.topic || ''; vb = b.name || b.topic || ''; break
        case 'status':      va = a.status; vb = b.status; break
        case 'objective':   va = campaignOutcome(a).objectiveLabel; vb = campaignOutcome(b).objectiveLabel; break
        case 'budget':      va = a.budget || 0; vb = b.budget || 0; break
        case 'spend':       va = a.spend || 0; vb = b.spend || 0; break
        case 'result':      va = campaignOutcome(a).resultSort; vb = campaignOutcome(b).resultSort; break
        case 'efficiency':  va = campaignOutcome(a).efficiencySort; vb = campaignOutcome(b).efficiencySort; break
        case 'launchedAt':  va = a.launchedAt || ''; vb = b.launchedAt || ''; break
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [campaigns, statusFilter, accountFilter, sourceFilter, search, sortKey, sortDir, proposalsByCampaign])

  const numericCols: { key: SortKey; label: React.ReactNode }[] = [
    { key: 'budget', label: 'Daily budget' },
    { key: 'spend', label: 'Spend' },
    { key: 'result', label: 'Primary result' },
    { key: 'efficiency', label: 'Efficiency' },
  ]

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8 max-w-[1600px] mx-auto stagger">

      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-5 mb-6 flex-wrap">
        <div className="min-w-0 max-w-2xl">
          <p className="micro-label mb-2">Campaign operations</p>
          <h1 className="page-title">Live growth portfolio</h1>
          <p className="page-subtitle">Launch, review and safely operate every campaign from one objective-aware workspace.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/dashboard/${tenantId}/campaign-copilot`} className="btn btn-primary">
            <Bot size={14} /> Build with AI
          </Link>
          <Link href={`/dashboard/${tenantId}/campaigns/new`} className="btn btn-ghost">
            <Plus size={14} /> Create manually
          </Link>
          <button
            type="button"
            onClick={handleRunAudit}
            disabled={auditState === 'loading'}
            className={
              auditState === 'success' ? 'btn chip-good border'
              : auditState === 'error' ? 'btn btn-danger'
              : 'btn btn-ghost'
            }
          >
            {auditState === 'loading' ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
            {auditState === 'loading' ? 'Checking…' : auditState === 'success' ? 'Audit complete' : auditState === 'error' ? 'Audit failed' : 'Run safety audit'}
          </button>
          <button
            type="button"
            onClick={handleSyncFromMeta}
            disabled={syncing}
            className="btn btn-ghost"
            title="Pull fresh campaign/adset/ad data from Meta (not just reload from the database)"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : undefined} />
            {syncing ? 'Syncing…' : 'Sync Meta'}
          </button>
        </div>
      </div>

      <div className="card px-4 py-3 mb-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2.5 text-[13px]" style={{ color: 'var(--ink-2)' }}>
          <ShieldCheck size={16} style={{ color: 'var(--good)' }} className="shrink-0" />
          <span><strong style={{ color: 'var(--ink)' }}>Controlled operations.</strong> Meridian-built campaigns use approval and budget safeguards; Meta-synced campaigns stay read-only.</span>
        </div>
        <div className="flex items-center gap-4 flex-wrap text-[12px]" style={{ color: 'var(--ink-3)' }}>
          <span className="inline-flex items-center gap-1.5">
            <Database size={13} /> {activeWithoutFreshness > 0
              ? `${activeWithoutFreshness}/${activeCampaignRows.length} active campaigns lack a metrics timestamp`
              : latestMetricsAt
                ? `Latest active metrics ${formatRelativeTime(latestMetricsAt)}`
                : 'No active metrics timestamp'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock3 size={13} /> Safety audit {latestAudit ? formatRelativeTime(latestAudit) : 'not run yet'}
          </span>
        </div>
      </div>

      {/* Syncing-from-Meta banner — stays up for the whole poll window, not just the initial request */}
      {syncing && (
        <div
          className="rounded-xl px-4 py-3 mb-5 flex items-center gap-3 text-sm"
          style={{ background: 'var(--info-bg)', border: '1px solid var(--info-border)', color: 'var(--info)' }}
        >
          <Loader2 size={14} className="animate-spin" />
          Syncing latest data from Meta — this list will update automatically over the next ~60s.
        </div>
      )}
      {syncError && !syncing && (
        <div
          className="rounded-xl px-4 py-3 mb-5 flex items-center gap-3 text-sm"
          style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad-border)', color: 'var(--bad)' }}
        >
          <AlertCircle size={14} />
          {syncError}
        </div>
      )}

      {/* Audit result banner */}
      {auditResult && auditState !== 'idle' && (
        <div
          className="rounded-xl px-4 py-3 mb-5 flex items-center gap-3 text-sm"
          style={auditState === 'error'
            ? { background: 'var(--bad-bg)', border: '1px solid var(--bad-border)', color: 'var(--bad)' }
            : { background: 'var(--good-bg)', border: '1px solid var(--good-border)', color: 'var(--good)' }
          }
        >
          {auditState === 'error' ? <AlertCircle size={14} /> : <Activity size={14} />}
          {auditResult}
        </div>
      )}

      {/* ── Pending approval alert ───────────────────────────────── */}
      {pendingCampaigns > 0 && statusFilter !== 'pending_approval' && (
        <div
          className="card p-4 mb-5 flex items-center justify-between gap-4 flex-wrap"
          style={{ background: 'var(--warn-bg)', borderColor: 'var(--warn-border)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <AlertCircle size={16} style={{ color: 'var(--warn)' }} className="shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold" style={{ color: 'var(--warn)' }}>
                {pendingCampaigns} campaign{pendingCampaigns !== 1 ? 's' : ''} need{pendingCampaigns === 1 ? 's' : ''} your approval
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--ink-2)' }}>
                Click a pending campaign to review the creative package and launch on Meta.
              </p>
            </div>
          </div>
          <button
            onClick={() => setStatusFilter('pending_approval')}
            className="btn btn-primary shrink-0"
          >
            Show pending <ChevronRight size={11} />
          </button>
        </div>
      )}

      {/* ── Stats row ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <StatCard icon={Activity} label="Active now" value={activeCampaigns} iconColor="var(--good)" iconBg="var(--good-bg)" accent="var(--good)" />
        <StatCard icon={AlertCircle} label="Awaiting approval" value={pendingCampaigns} iconColor="var(--warn)" iconBg="var(--warn-bg)" accent="var(--warn)" />
        <StatCard icon={ShieldCheck} label="Needs attention" value={attentionCampaigns} iconColor={attentionCampaigns > 0 ? 'var(--bad)' : 'var(--good)'} iconBg={attentionCampaigns > 0 ? 'var(--bad-bg)' : 'var(--good-bg)'} accent={attentionCampaigns > 0 ? 'var(--bad)' : 'var(--good)'} />
        <StatCard icon={DollarSign} label="Meridian-managed spend" value={formatCurrency(managedSpend)} iconColor="var(--accent)" iconBg="var(--accent-bg)" accent="var(--accent)" />
      </div>

      {/* ── Error ────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl p-4 mb-4 flex items-center justify-between gap-3 text-sm" style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad-border)', color: 'var(--bad)' }}>
          <span className="inline-flex items-center gap-2"><AlertCircle size={14} className="shrink-0" /> Campaign data could not be refreshed ({error}).</span>
          <button type="button" onClick={() => { setLoading(true); void fetchCampaigns() }} className="btn btn-ghost shrink-0">
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      {/* ── Table card ───────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        {/* Filter bar */}
        <div
          className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap"
          style={{ borderBottom: '1px solid var(--hairline-light)' }}
        >
          {/* Status tabs */}
          <div className="flex items-center gap-0.5 flex-wrap">
            {STATUS_FILTERS.map((f) => {
              const count = countByStatus[f.key] ?? 0
              const active = statusFilter === f.key
              return (
                <button
                  type="button"
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  aria-pressed={active}
                  className="inline-flex min-h-10 items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                  style={
                    active
                      ? { background: 'var(--accent-bg)', color: 'var(--accent-strong)', boxShadow: 'inset 0 0 0 1px var(--accent-border)' }
                      : { background: 'transparent', color: 'var(--ink-2)' }
                  }
                >
                  {f.label}
                  {count > 0 && (
                    <span
                      className="text-[10px] min-w-4.5 text-center px-1 py-0.5 rounded-full leading-none font-semibold mono"
                      style={
                        active
                          ? { background: 'var(--surface)', color: 'var(--accent-strong)' }
                          : { background: 'var(--muted)', color: 'var(--ink-3)' }
                      }
                    >
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Source filter — dashboard-built (agent + human) vs. Meta-synced clutter */}
            <select
              aria-label="Filter by source"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
              className="input text-xs"
              style={{ width: 160 }}
              title="Dashboard built = launched through this tool (AI or human). Meta synced = created directly in Meta Ads Manager, read-only."
            >
              {SOURCE_FILTERS.map((f) => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>

            {/* Ad account filter */}
            {accountOptions.length > 0 && (
              <select
                aria-label="Filter by ad account"
                value={accountFilter}
                onChange={(e) => setAccountFilter(e.target.value)}
                className="input text-xs"
                style={{ width: 180 }}
              >
                <option value="all">All ad accounts</option>
                {accountOptions.map((a) => (
                  <option key={a.id} value={a.id}>{a.label}</option>
                ))}
              </select>
            )}

            {/* Search */}
            <div className="relative">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ink-3)' }} />
              <input
                aria-label="Search campaigns"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search campaigns…"
                className="input pl-8 text-xs"
                style={{ width: 200 }}
              />
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-5 space-y-3" role="status" aria-label="Loading campaign portfolio">
            <div className="skeleton h-10 w-full" />
            <div className="skeleton h-14 w-full" />
            <div className="skeleton h-14 w-full" />
            <div className="skeleton h-14 w-full" />
            <span className="sr-only">Loading campaigns…</span>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={statusFilter === 'pending_approval' ? AlertCircle : Megaphone}
            title={
              search ? 'No campaigns match your search'
              : statusFilter !== 'all' ? `No ${STATUS_FILTERS.find(f => f.key === statusFilter)?.label.toLowerCase()} campaigns`
              : 'No campaigns yet'
            }
            subtitle={
              !search && statusFilter === 'all' ? 'Build your first campaign with AI or create one manually.'
              : statusFilter === 'pending_approval' ? 'All campaigns have been reviewed'
              : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table min-w-[1120px]">
              <thead>
                <tr>
                  {/* Campaign */}
                  <th style={{ width: '35%' }}>
                    <button
                      type="button"
                      onClick={() => toggleSort('topic')}
                      className="inline-flex items-center gap-1.5 uppercase tracking-[0.09em]"
                      style={{ color: sortKey === 'topic' ? 'var(--accent)' : undefined }}
                    >
                      Campaign <SortIcon col="topic" sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  </th>

                  {/* Status */}
                  <th>
                    <button
                      type="button"
                      onClick={() => toggleSort('status')}
                      className="inline-flex items-center gap-1.5 uppercase tracking-[0.09em]"
                      style={{ color: sortKey === 'status' ? 'var(--accent)' : undefined }}
                    >
                      Status <SortIcon col="status" sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  </th>

                  {/* Objective */}
                  <th>
                    <button
                      type="button"
                      onClick={() => toggleSort('objective')}
                      className="inline-flex items-center gap-1.5 uppercase tracking-[0.09em]"
                      style={{ color: sortKey === 'objective' ? 'var(--accent)' : undefined }}
                    >
                      Objective <SortIcon col="objective" sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  </th>

                  {/* Numeric sortable cols */}
                  {numericCols.map((col) => (
                    <th key={col.key} className="num">
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className="inline-flex items-center gap-1 uppercase tracking-[0.09em] ml-auto"
                        style={{ color: sortKey === col.key ? 'var(--accent)' : undefined }}
                      >
                        <SortIcon col={col.key} sortKey={sortKey} sortDir={sortDir} />
                        {col.label}
                      </button>
                    </th>
                  ))}

                  <th>Source</th>

                  <th className="num">
                    <button
                      type="button"
                      onClick={() => toggleSort('launchedAt')}
                      className="inline-flex items-center gap-1 uppercase tracking-[0.09em] ml-auto"
                      style={{ color: sortKey === 'launchedAt' ? 'var(--accent)' : undefined }}
                    >
                      <SortIcon col="launchedAt" sortKey={sortKey} sortDir={sortDir} />
                      Launched
                    </button>
                  </th>

                  <th className="w-10" />
                </tr>
              </thead>

              <tbody>
                {filtered.map((campaign, idx) => (
                  <CampaignRow
                    key={campaign._id || idx}
                    campaign={campaign}
                    tenantId={tenantId}
                    isPending={campaign.status === 'pending_approval'}
                    proposals={campaign._id ? proposalsByCampaign[campaign._id] : undefined}
                    adsetProposals={proposalsByAdset}
                    onViewAd={setViewAd}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <AdMediaModal tenantId={tenantId} ad={viewAd} onClose={() => setViewAd(null)} />

        {/* Footer */}
        {!loading && (
          <div
            className="px-5 py-3 flex items-center justify-between gap-4"
            style={{ borderTop: '1px solid var(--hairline-light)' }}
          >
            <p className="text-xs" style={{ color: 'var(--ink-3)' }}>
              {filtered.length === campaigns.length
                ? `${campaigns.length} campaign${campaigns.length !== 1 ? 's' : ''}`
                : `${filtered.length} of ${campaigns.length} campaigns`}
              {statusFilter !== 'all' && (
                <button
                  onClick={() => setStatusFilter('all')}
                  className="ml-2 underline hover:no-underline"
                  style={{ color: 'var(--accent)' }}
                >
                  Clear filter
                </button>
              )}
            </p>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="text-xs hover:underline"
                style={{ color: 'var(--ink-3)' }}
              >
                Clear search
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
