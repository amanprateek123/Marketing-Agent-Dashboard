'use client'

import { useState, useEffect, use, useMemo } from 'react'
import Link from 'next/link'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  Megaphone,
  Bot,
  User,
  Search,
  TrendingUp,
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
  searchParams: Promise<{ filter?: string; accountId?: string }>
}

type SortKey = 'topic' | 'status' | 'budget' | 'spend' | 'roas' | 'ctr' | 'conversions' | 'launchedAt'
type SortDir = 'asc' | 'desc'

const STATUS_FILTERS = [
  { key: 'all',              label: 'All' },
  { key: 'active',           label: 'Active' },
  { key: 'pending_approval', label: 'Pending' },
  { key: 'paused',           label: 'Paused' },
  { key: 'completed',        label: 'Completed' },
  { key: 'failed',           label: 'Failed' },
]

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
        <Bot size={9} /> Agent
      </span>
    )
  }
  if (source === 'human') {
    return (
      <span className="chip chip-neutral">
        <User size={9} /> Manual create
      </span>
    )
  }
  return (
    <span className="chip chip-neutral" title="Created directly in Meta Ads Manager — synced here for visibility only, not managed by this tool">
      <ExternalLink size={9} /> From Meta
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

        {/* Source */}
        <td className="whitespace-nowrap">
          <SourceBadge source={campaign.source} />
        </td>

        {/* Budget */}
        <td className="num whitespace-nowrap mono text-[12px]">
          {campaign.budget ? formatCurrency(campaign.budget) : <span style={{ color: 'var(--ink-4)' }}>—</span>}
        </td>

        {/* Spend */}
        <td className="num whitespace-nowrap mono text-[12px]">
          {campaign.spend ? formatCurrency(campaign.spend) : <span style={{ color: 'var(--ink-4)' }}>—</span>}
        </td>

        {/* ROAS */}
        <td className="num whitespace-nowrap">
          {campaign.roas != null ? (
            <span className="mono text-[12px] font-semibold" style={{
              color: campaign.roas >= 2 ? 'var(--good)' : campaign.roas >= 1 ? 'var(--warn)' : 'var(--bad)'
            }}>
              {campaign.roas.toFixed(2)}x
            </span>
          ) : <span style={{ color: 'var(--ink-4)' }}>—</span>}
        </td>

        {/* CTR */}
        <td className="num whitespace-nowrap mono text-[12px]">
          {campaign.ctr != null ? `${campaign.ctr.toFixed(2)}%` : <span style={{ color: 'var(--ink-4)' }}>—</span>}
        </td>

        {/* Conversions */}
        <td className="num whitespace-nowrap mono text-[12px] font-semibold" style={{ color: 'var(--ink)' }}>
          {campaign.conversions != null ? campaign.conversions : <span style={{ color: 'var(--ink-4)' }}>—</span>}
        </td>

        {/* Launched */}
        <td className="num whitespace-nowrap text-[11px] mono" style={{ color: 'var(--ink-3)' }}>
          {formatDate(campaign.launchedAt)}
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
  const { filter: initFilter, accountId: initAccountId } = use(searchParams)

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

  // Derived stats
  const totalSpend       = campaigns.reduce((s, c) => s + (c.spend || 0), 0)
  const activeCampaigns  = campaigns.filter((c) => c.status === 'active').length
  const pendingCampaigns = campaigns.filter((c) => c.status === 'pending_approval').length
  const roasArr          = campaigns.filter((c) => c.roas && c.roas > 0).map((c) => c.roas!)
  const avgRoas          = roasArr.length ? roasArr.reduce((a, b) => a + b, 0) / roasArr.length : 0

  const countByStatus = useMemo(() => {
    const m: Record<string, number> = { all: campaigns.length }
    campaigns.forEach((c) => { m[c.status] = (m[c.status] || 0) + 1 })
    return m
  }, [campaigns])

  // Ad accounts actually present in this tenant's campaigns — always
  // selectable even if the Meta name lookup above never resolved.
  const accountOptions = useMemo(() => {
    const ids = new Set<string>()
    campaigns.forEach((c) => { if (c.metaAccountId) ids.add(c.metaAccountId) })
    return Array.from(ids).map((id) => ({ id, label: accountNames[id] ?? id }))
  }, [campaigns, accountNames])

  const filtered = useMemo(() => {
    let list = campaigns
    if (statusFilter !== 'all') list = list.filter((c) => c.status === statusFilter)
    if (accountFilter !== 'all') list = list.filter((c) => c.metaAccountId === accountFilter)
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
        case 'budget':      va = a.budget || 0; vb = b.budget || 0; break
        case 'spend':       va = a.spend || 0; vb = b.spend || 0; break
        case 'roas':        va = a.roas || 0; vb = b.roas || 0; break
        case 'ctr':         va = a.ctr || 0; vb = b.ctr || 0; break
        case 'conversions': va = a.conversions || 0; vb = b.conversions || 0; break
        case 'launchedAt':  va = a.launchedAt || ''; vb = b.launchedAt || ''; break
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [campaigns, statusFilter, accountFilter, search, sortKey, sortDir])

  const numericCols: { key: SortKey; label: React.ReactNode }[] = [
    { key: 'budget',      label: 'Budget'   },
    { key: 'spend',       label: 'Spend'    },
    { key: 'roas',        label: <Term help={GLOSSARY.roas}>ROAS</Term> },
    { key: 'ctr',         label: <Term help={GLOSSARY.ctr}>CTR</Term> },
    { key: 'conversions', label: <Term help={GLOSSARY.conv}>Conv.</Term> },
    { key: 'launchedAt',  label: 'Launched' },
  ]

  return (
    <div className="px-8 py-8 max-w-[1600px] mx-auto stagger">

      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
        <div className="min-w-0">
          <p className="micro-label mb-2 mono">{tenantId}</p>
          <h1 className="page-title">Campaigns</h1>
          <p className="page-subtitle">Every campaign across the account — live, pending, and archived.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap pb-1">
          <Link href={`/dashboard/${tenantId}/campaigns/new`} className="btn btn-primary">
            <Plus size={12} /> Create Campaign
          </Link>
          <button
            onClick={handleRunAudit}
            disabled={auditState === 'loading'}
            className={
              auditState === 'success' ? 'btn chip-good border'
              : auditState === 'error' ? 'btn btn-danger'
              : 'btn btn-primary'
            }
          >
            {auditState === 'loading' ? <Loader2 size={12} className="animate-spin" /> : <Activity size={12} />}
            {auditState === 'loading' ? 'Auditing…' : auditState === 'success' ? 'Done!' : auditState === 'error' ? 'Failed' : 'Run Audit Now'}
          </button>
          <button
            onClick={handleSyncFromMeta}
            disabled={syncing}
            className="btn btn-ghost"
            title="Pull fresh campaign/adset/ad data from Meta (not just reload from the database)"
          >
            <RefreshCw size={12} className={syncing ? 'animate-spin' : undefined} />
            {syncing ? 'Syncing…' : 'Refresh from Meta'}
          </button>
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard icon={Megaphone}  label="Total"    value={campaigns.length}                              iconColor="var(--ink-2)" iconBg="var(--muted)" />
        <StatCard icon={Activity}   label="Active"   value={activeCampaigns}                               iconColor="var(--good)" iconBg="var(--good-bg)" accent="var(--good)" />
        <StatCard icon={DollarSign} label="Spend"    value={formatCurrency(totalSpend)}                   iconColor="var(--accent)" iconBg="var(--accent-bg)" accent="var(--accent)" />
        <StatCard icon={TrendingUp} label={<Term help={GLOSSARY.roas}>Avg ROAS</Term>} value={avgRoas > 0 ? `${avgRoas.toFixed(2)}x` : '—'} iconColor="var(--warn)" iconBg="var(--warn-bg)" accent="var(--warn)" />
      </div>

      {/* ── Error ────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl p-4 mb-4 flex items-center gap-3 text-sm" style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad-border)', color: 'var(--bad)' }}>
          <AlertCircle size={14} className="shrink-0" /> {error}
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
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={
                    active
                      ? { background: 'var(--ink)', color: 'var(--paper)' }
                      : { background: 'transparent', color: 'var(--ink-2)' }
                  }
                >
                  {f.label}
                  {count > 0 && (
                    <span
                      className="text-[10px] min-w-4.5 text-center px-1 py-0.5 rounded-full leading-none font-semibold mono"
                      style={
                        active
                          ? { background: 'rgba(255,255,255,0.22)', color: 'var(--paper)' }
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
            {/* Ad account filter */}
            {accountOptions.length > 0 && (
              <select
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
          <div className="flex items-center justify-center py-20 gap-2.5" style={{ color: 'var(--ink-3)' }}>
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Loading campaigns…</span>
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
              !search && statusFilter === 'all' ? 'Trigger a pipeline run to create your first campaign'
              : statusFilter === 'pending_approval' ? 'All campaigns have been reviewed'
              : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  {/* Campaign */}
                  <th style={{ width: '35%' }}>
                    <button
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
                      onClick={() => toggleSort('status')}
                      className="inline-flex items-center gap-1.5 uppercase tracking-[0.09em]"
                      style={{ color: sortKey === 'status' ? 'var(--accent)' : undefined }}
                    >
                      Status <SortIcon col="status" sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  </th>

                  {/* Source */}
                  <th>Source</th>

                  {/* Numeric sortable cols */}
                  {numericCols.map((col) => (
                    <th key={col.key} className="num">
                      <button
                        onClick={() => toggleSort(col.key)}
                        className="inline-flex items-center gap-1 uppercase tracking-[0.09em] ml-auto"
                        style={{ color: sortKey === col.key ? 'var(--accent)' : undefined }}
                      >
                        <SortIcon col={col.key} sortKey={sortKey} sortDir={sortDir} />
                        {col.label}
                      </button>
                    </th>
                  ))}

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
