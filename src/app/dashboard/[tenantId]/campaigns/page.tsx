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
} from 'lucide-react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import type { Campaign, CampaignAdSet, CampaignAd } from '@/types'

const API_BASE = 'http://localhost:8082/api/v1'

interface PageProps {
  params: Promise<{ tenantId: string }>
  searchParams: Promise<{ filter?: string }>
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
function SourceBadge({ source }: { source?: 'agent' | 'manual' }) {
  if (!source) return <span style={{ color: '#d1d5db' }}>—</span>
  return source === 'agent' ? (
    <span
      className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap"
      style={{ background: '#e0e7ff', color: '#1d4ed8', border: '1px solid #c7d2fe' }}
    >
      <Bot size={9} /> Agent
    </span>
  ) : (
    <span
      className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap"
      style={{ background: '#f3f4f6', color: '#4b5563', border: '1px solid #e5e7eb' }}
    >
      <User size={9} /> Manual
    </span>
  )
}

// ── Inline ad row ─────────────────────────────────────────────────────────────
function InlineAdRow({ ad }: { ad: CampaignAd }) {
  return (
    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
      <td className="px-4 py-2 pl-14">
        <div>
          <p className="text-xs font-medium truncate" style={{ color: '#111827', maxWidth: 200 }}>{ad.name || '—'}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {ad.hookStyle && (
              <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: '#f3f4f6', color: '#4b5563' }}>
                {ad.hookStyle}
              </span>
            )}
            {ad.format && (
              <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: '#e0e7ff', color: '#1d4ed8' }}>
                {ad.format}
              </span>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-2 text-xs tabular-nums whitespace-nowrap" style={{ color: '#4b5563' }}>
        {ad.spend ? formatCurrency(ad.spend) : '—'}
      </td>
      <td className="px-4 py-2 text-xs tabular-nums" style={{ color: '#4b5563' }}>
        {ad.impressions?.toLocaleString() ?? '—'}
      </td>
      <td className="px-4 py-2 text-xs tabular-nums" style={{ color: '#4b5563' }}>
        {ad.ctr != null ? `${ad.ctr.toFixed(2)}%` : '—'}
      </td>
      <td className="px-4 py-2 text-xs tabular-nums whitespace-nowrap" style={{ color: '#4b5563' }}>
        {ad.cpc ? formatCurrency(ad.cpc) : '—'}
      </td>
      <td className="px-4 py-2 text-xs" style={{ color: '#9ca3af' }}>—</td>
      <td className="px-4 py-2 text-xs" style={{ color: '#9ca3af' }}>—</td>
      <td className="px-4 py-2" />
    </tr>
  )
}

// ── Inline adset row ──────────────────────────────────────────────────────────
function InlineAdSetRow({ adSet }: { adSet: CampaignAdSet }) {
  const [adsOpen, setAdsOpen] = useState(false)
  const ads = adSet.ads || []

  return (
    <>
      <tr style={{ background: '#eef2ff', borderBottom: '1px solid #e0e7ff' }}>
        <td className="px-4 py-2.5 pl-12">
          <div className="flex items-center gap-2">
            {ads.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setAdsOpen((o) => !o) }}
                className="shrink-0 w-4 h-4 flex items-center justify-center rounded hover:bg-sky-100 transition-colors"
              >
                <ChevronRight
                  size={11}
                  className={cn('transition-transform', adsOpen && 'rotate-90')}
                  style={{ color: '#4f46e5' }}
                />
              </button>
            )}
            <div className="min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: '#4338ca', maxWidth: 200 }}>{adSet.name || '—'}</p>
              {adSet.audienceType && (
                <p className="text-[11px] capitalize mt-0.5" style={{ color: '#7dd3fc' }}>{adSet.audienceType.replace(/_/g, ' ')}</p>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-2.5 text-xs tabular-nums whitespace-nowrap" style={{ color: '#4338ca' }}>
          {adSet.spend ? formatCurrency(adSet.spend) : '—'}
        </td>
        <td className="px-4 py-2.5 text-xs tabular-nums" style={{ color: '#4338ca' }}>
          {adSet.impressions?.toLocaleString() ?? '—'}
        </td>
        <td className="px-4 py-2.5 text-xs tabular-nums" style={{ color: '#4338ca' }}>
          {adSet.ctr != null ? `${adSet.ctr.toFixed(2)}%` : '—'}
        </td>
        <td className="px-4 py-2.5 text-xs tabular-nums whitespace-nowrap" style={{ color: '#4338ca' }}>
          {adSet.cpa ? formatCurrency(adSet.cpa) : '—'}
        </td>
        <td className="px-4 py-2.5 text-xs tabular-nums" style={{ color: '#4338ca' }}>
          {adSet.frequency?.toFixed(2) || '—'}
        </td>
        <td className="px-4 py-2.5 text-xs tabular-nums" style={{ color: '#4338ca' }}>
          {adSet.conversions ?? '—'}
        </td>
        <td className="px-4 py-2.5">
          {adSet.status && <StatusBadge status={adSet.status} />}
        </td>
      </tr>
      {adsOpen && ads.map((ad, i) => <InlineAdRow key={ad.id || i} ad={ad} />)}
    </>
  )
}

// ── Campaign row ──────────────────────────────────────────────────────────────
function CampaignRow({
  campaign,
  tenantId,
  isPending,
}: {
  campaign: Campaign
  tenantId: string
  isPending: boolean
}) {
  const [open, setOpen] = useState(false)
  const adSets = campaign.metaAdSets || []

  return (
    <>
      <tr
        className="group transition-colors hover:bg-slate-50/80"
        style={{ borderBottom: open ? 'none' : '1px solid #f3f4f6' }}
      >
        {/* Campaign name */}
        <td className="px-5 py-3.5" style={{ maxWidth: 0, width: '35%' }}>
          <div className="flex items-start gap-2 min-w-0">
            {/* Expand toggle (non-pending only) */}
            {!isPending ? (
              <button
                onClick={() => setOpen((o) => !o)}
                className="mt-0.5 shrink-0 w-5 h-5 rounded flex items-center justify-center hover:bg-sky-100 transition-colors"
                title={open ? 'Collapse' : 'Expand ad sets'}
              >
                <ChevronDown
                  size={12}
                  className={cn('transition-transform', !open && '-rotate-90')}
                  style={{ color: adSets.length > 0 ? '#4f46e5' : '#e5e7eb' }}
                />
              </button>
            ) : (
              /* Pending pulse dot */
              <span className="mt-1.5 shrink-0 relative inline-flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#f59e0b' }} />
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: '#f59e0b' }} />
              </span>
            )}

            <div className="min-w-0 flex-1">
              <Link
                href={`/dashboard/${tenantId}/campaigns/${campaign._id}`}
                onClick={(e) => e.stopPropagation()}
                className="text-sm font-medium hover:text-sky-600 transition-colors block truncate"
                style={{ color: '#111827' }}
                title={campaign.name || campaign.topic || 'Untitled Campaign'}
              >
                {campaign.name || campaign.topic || 'Untitled Campaign'}
              </Link>
              {campaign.name && campaign.topic && (
                <p className="text-[11px] truncate mt-0.5" style={{ color: '#9ca3af' }} title={campaign.topic}>
                  {campaign.topic}
                </p>
              )}
              {isPending && (
                <p className="text-[11px] mt-0.5 font-medium" style={{ color: '#d97706' }}>
                  Awaiting approval
                </p>
              )}
              {!isPending && adSets.length > 0 && (
                <p className="text-[11px] mt-0.5" style={{ color: '#4f46e5' }}>
                  {adSets.length} ad set{adSets.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
        </td>

        {/* Status */}
        <td className="px-4 py-3.5 whitespace-nowrap">
          <StatusBadge status={campaign.status} />
        </td>

        {/* Source */}
        <td className="px-4 py-3.5 whitespace-nowrap">
          <SourceBadge source={campaign.source} />
        </td>

        {/* Budget */}
        <td className="px-4 py-3.5 text-right text-sm tabular-nums whitespace-nowrap" style={{ color: '#4b5563' }}>
          {campaign.budget ? formatCurrency(campaign.budget) : <span style={{ color: '#e5e7eb' }}>—</span>}
        </td>

        {/* Spend */}
        <td className="px-4 py-3.5 text-right text-sm tabular-nums whitespace-nowrap" style={{ color: '#4b5563' }}>
          {campaign.spend ? formatCurrency(campaign.spend) : <span style={{ color: '#e5e7eb' }}>—</span>}
        </td>

        {/* ROAS */}
        <td className="px-4 py-3.5 text-right whitespace-nowrap">
          {campaign.roas != null ? (
            <span className="text-sm font-semibold tabular-nums" style={{
              color: campaign.roas >= 2 ? '#16a34a' : campaign.roas >= 1 ? '#d97706' : '#dc2626'
            }}>
              {campaign.roas.toFixed(2)}x
            </span>
          ) : <span style={{ color: '#e5e7eb' }}>—</span>}
        </td>

        {/* CTR */}
        <td className="px-4 py-3.5 text-right text-sm tabular-nums whitespace-nowrap" style={{ color: '#4b5563' }}>
          {campaign.ctr != null ? `${campaign.ctr.toFixed(2)}%` : <span style={{ color: '#e5e7eb' }}>—</span>}
        </td>

        {/* Conversions */}
        <td className="px-4 py-3.5 text-right text-sm tabular-nums font-medium whitespace-nowrap" style={{ color: '#111827' }}>
          {campaign.conversions != null ? campaign.conversions : <span style={{ color: '#e5e7eb' }}>—</span>}
        </td>

        {/* Launched */}
        <td className="px-4 py-3.5 text-right text-xs tabular-nums whitespace-nowrap" style={{ color: '#9ca3af' }}>
          {formatDate(campaign.launchedAt)}
        </td>

        {/* Action */}
        <td className="px-4 py-3.5 text-right whitespace-nowrap">
          {isPending ? (
            <Link
              href={`/dashboard/${tenantId}/campaigns/${campaign._id}`}
              className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full transition-colors whitespace-nowrap"
              style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}
              onClick={e => e.stopPropagation()}
            >
              Review <ChevronRight size={10} />
            </Link>
          ) : (
            <ChevronRight
              size={14}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: '#4f46e5' }}
            />
          )}
        </td>
      </tr>

      {/* Live ad sets expansion */}
      {open && !isPending && (
        <tr style={{ borderBottom: '1px solid #c7d2fe' }}>
          <td colSpan={10} className="px-0 py-0">
            {adSets.length === 0 ? (
              <div className="px-12 py-3 text-xs" style={{ background: '#eef2ff', color: '#9ca3af' }}>
                No ad sets on this campaign yet.
              </div>
            ) : (
              <table className="w-full" style={{ background: '#eef2ff' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #c7d2fe' }}>
                    {['Ad Set / Audience', 'Spend', 'Impressions', 'CTR', 'CPA', 'Freq.', 'Conv.', 'Status'].map((h, i) => (
                      <th
                        key={h}
                        className={`px-4 py-2 text-[10px] font-semibold uppercase tracking-wider ${i === 0 ? 'pl-12 text-left' : 'text-left'}`}
                        style={{ color: '#7dd3fc' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {adSets.map((adSet, i) => (
                    <InlineAdSetRow key={adSet.id || i} adSet={adSet} />
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
  if (col !== sortKey) return <ArrowUpDown size={10} style={{ color: '#d1d5db' }} />
  return sortDir === 'asc'
    ? <ArrowUp size={10} style={{ color: '#4f46e5' }} />
    : <ArrowDown size={10} style={{ color: '#4f46e5' }} />
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
  label: string
  value: string | number
  iconColor: string
  iconBg: string
  accent?: string
}) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(15,23,42,0.03)' }}
    >
      {accent && <div className="h-0.75" style={{ background: accent }} />}
      <div className="p-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: iconBg }}>
          <Icon size={15} style={{ color: iconColor }} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide truncate" style={{ color: '#9ca3af' }}>{label}</p>
          <p className="text-lg font-bold leading-tight tabular-nums truncate" style={{ color: '#111827' }}>{value}</p>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CampaignsPage({ params, searchParams }: PageProps) {
  const { tenantId }       = use(params)
  const { filter: initFilter } = use(searchParams)

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  const [search, setSearch]         = useState('')
  const [statusFilter, setStatusFilter] = useState(initFilter ?? 'all')
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

  useEffect(() => { fetchCampaigns() }, [tenantId]) // eslint-disable-line

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

  const filtered = useMemo(() => {
    let list = campaigns
    if (statusFilter !== 'all') list = list.filter((c) => c.status === statusFilter)
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
  }, [campaigns, statusFilter, search, sortKey, sortDir])

  const numericCols: { key: SortKey; label: string }[] = [
    { key: 'budget',      label: 'Budget'   },
    { key: 'spend',       label: 'Spend'    },
    { key: 'roas',        label: 'ROAS'     },
    { key: 'ctr',         label: 'CTR'      },
    { key: 'conversions', label: 'Conv.'    },
    { key: 'launchedAt',  label: 'Launched' },
  ]

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto animate-fade-up" style={{ background: '#f8f9fb', minHeight: '100vh' }}>

      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-2xl flex items-center justify-center"
            style={{ background: '#e0e7ff', border: '1px solid #c7d2fe' }}
          >
            <Megaphone size={16} style={{ color: '#4f46e5' }} />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight" style={{ color: '#111827' }}>Campaigns</h1>
            <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{tenantId}</p>
          </div>
        </div>
        <button
          onClick={fetchCampaigns}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:border-sky-300 hover:text-sky-600"
          style={{ background: '#ffffff', border: '1px solid #e5e7eb', color: '#4b5563' }}
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* ── Pending approval alert ───────────────────────────────── */}
      {pendingCampaigns > 0 && statusFilter !== 'pending_approval' && (
        <div
          className="rounded-xl p-4 mb-5 flex items-center justify-between gap-4 flex-wrap"
          style={{ background: '#fffbeb', border: '2px solid #fbbf24' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#fef3c7' }}>
              <AlertCircle size={14} style={{ color: '#f59e0b' }} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold" style={{ color: '#92400e' }}>
                {pendingCampaigns} campaign{pendingCampaigns !== 1 ? 's' : ''} need{pendingCampaigns === 1 ? 's' : ''} your approval
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#b45309' }}>
                Click a pending campaign to review the creative package and launch on Meta.
              </p>
            </div>
          </div>
          <button
            onClick={() => setStatusFilter('pending_approval')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg shrink-0 transition-opacity hover:opacity-90"
            style={{ background: '#f59e0b', color: '#ffffff' }}
          >
            Show pending <ChevronRight size={11} />
          </button>
        </div>
      )}

      {/* ── Stats row ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard icon={Megaphone}  label="Total"    value={campaigns.length}                              iconColor="#4b5563" iconBg="#f3f4f6" />
        <StatCard icon={Activity}   label="Active"   value={activeCampaigns}                               iconColor="#16a34a" iconBg="#dcfce7" accent="#22c55e" />
        <StatCard icon={DollarSign} label="Spend"    value={formatCurrency(totalSpend)}                   iconColor="#4f46e5" iconBg="#e0e7ff" accent="#4f46e5" />
        <StatCard icon={TrendingUp} label="Avg ROAS" value={avgRoas > 0 ? `${avgRoas.toFixed(2)}x` : '—'} iconColor="#d97706" iconBg="#fef3c7" accent="#f59e0b" />
      </div>

      {/* ── Error ────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl p-4 mb-4 flex items-center gap-3 text-sm" style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#b91c1c' }}>
          <AlertCircle size={14} className="shrink-0" /> {error}
        </div>
      )}

      {/* ── Table card ───────────────────────────────────────────── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(15,23,42,0.03)' }}
      >
        {/* Filter bar */}
        <div
          className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap"
          style={{ borderBottom: '1px solid #f3f4f6' }}
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
                      ? { background: 'linear-gradient(135deg,#4f46e5,#4338ca)', color: '#ffffff', boxShadow: '0 1px 4px rgba(2,132,199,0.25)' }
                      : { background: 'transparent', color: '#4b5563' }
                  }
                >
                  {f.label}
                  {count > 0 && (
                    <span
                      className="text-[10px] min-w-4.5 text-center px-1 py-0.5 rounded-full leading-none font-semibold"
                      style={
                        active
                          ? { background: 'rgba(255,255,255,0.25)', color: '#fff' }
                          : { background: '#f1f2f4', color: '#9ca3af' }
                      }
                    >
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9ca3af' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search campaigns…"
              className="pl-8 pr-3 py-1.5 rounded-lg text-xs"
              style={{ background: '#f6f7f9', border: '1px solid #e5e7eb', color: '#111827', width: 200, outline: 'none' }}
            />
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2.5" style={{ color: '#9ca3af' }}>
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
            <table className="w-full">
              <thead>
                <tr style={{ background: '#fafafa', borderBottom: '1px solid #f3f4f6' }}>
                  {/* Campaign */}
                  <th className="px-5 py-3 text-left" style={{ width: '35%' }}>
                    <button
                      onClick={() => toggleSort('topic')}
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider"
                      style={{ color: sortKey === 'topic' ? '#4338ca' : '#9ca3af' }}
                    >
                      Campaign <SortIcon col="topic" sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  </th>

                  {/* Status */}
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => toggleSort('status')}
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider"
                      style={{ color: sortKey === 'status' ? '#4338ca' : '#9ca3af' }}
                    >
                      Status <SortIcon col="status" sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  </th>

                  {/* Source */}
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#9ca3af' }}>
                    Source
                  </th>

                  {/* Numeric sortable cols */}
                  {numericCols.map((col) => (
                    <th key={col.key} className="px-4 py-3 text-right">
                      <button
                        onClick={() => toggleSort(col.key)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider ml-auto"
                        style={{ color: sortKey === col.key ? '#4338ca' : '#9ca3af' }}
                      >
                        <SortIcon col={col.key} sortKey={sortKey} sortDir={sortDir} />
                        {col.label}
                      </button>
                    </th>
                  ))}

                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>

              <tbody>
                {filtered.map((campaign, idx) => (
                  <CampaignRow
                    key={campaign._id || idx}
                    campaign={campaign}
                    tenantId={tenantId}
                    isPending={campaign.status === 'pending_approval'}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        {!loading && (
          <div
            className="px-5 py-3 flex items-center justify-between gap-4"
            style={{ borderTop: '1px solid #f3f4f6' }}
          >
            <p className="text-xs" style={{ color: '#9ca3af' }}>
              {filtered.length === campaigns.length
                ? `${campaigns.length} campaign${campaigns.length !== 1 ? 's' : ''}`
                : `${filtered.length} of ${campaigns.length} campaigns`}
              {statusFilter !== 'all' && (
                <button
                  onClick={() => setStatusFilter('all')}
                  className="ml-2 underline hover:no-underline"
                  style={{ color: '#4f46e5' }}
                >
                  Clear filter
                </button>
              )}
            </p>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="text-xs hover:underline"
                style={{ color: '#9ca3af' }}
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
