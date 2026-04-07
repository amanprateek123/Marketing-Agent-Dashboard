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
  BarChart3,
  Activity,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import type { Campaign, CampaignAdSet, CampaignAd } from '@/types'

const API_BASE = 'http://localhost:8082/api/v1'

interface PageProps {
  params: Promise<{ tenantId: string }>
}

type SortKey = 'topic' | 'status' | 'budget' | 'spend' | 'roas' | 'ctr' | 'conversions' | 'launchedAt'
type SortDir = 'asc' | 'desc'

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'pending_approval', label: 'Pending' },
  { key: 'paused', label: 'Paused' },
  { key: 'completed', label: 'Completed' },
  { key: 'failed', label: 'Failed' },
]

function SourceBadge({ source }: { source?: 'agent' | 'manual' }) {
  if (!source) return null
  return source === 'agent' ? (
    <span
      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
      style={{ background: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe' }}
    >
      <Bot size={9} /> Agent
    </span>
  ) : (
    <span
      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
      style={{ background: '#f4f4f5', color: '#52525b', border: '1px solid #e4e4e7' }}
    >
      <User size={9} /> Manual
    </span>
  )
}

// ── Inline ad row (within adset expansion) ───────────────────────────────────
function InlineAdRow({ ad }: { ad: CampaignAd }) {
  return (
    <tr style={{ borderBottom: '1px solid #f4f4f5' }}>
      <td className="px-4 py-2 pl-8">
        <div>
          <p className="text-xs font-medium" style={{ color: '#18181b' }}>{ad.name || '—'}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {ad.hookStyle && (
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#f4f4f5', color: '#71717a' }}>
                {ad.hookStyle}
              </span>
            )}
            {ad.format && (
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                {ad.format}
              </span>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-2 text-xs tabular-nums" style={{ color: '#71717a' }}>
        {ad.spend ? formatCurrency(ad.spend) : '—'}
      </td>
      <td className="px-4 py-2 text-xs tabular-nums" style={{ color: '#71717a' }}>
        {ad.impressions?.toLocaleString() ?? '—'}
      </td>
      <td className="px-4 py-2 text-xs tabular-nums" style={{ color: '#71717a' }}>
        {ad.ctr != null ? `${ad.ctr.toFixed(2)}%` : '—'}
      </td>
      <td className="px-4 py-2 text-xs tabular-nums" style={{ color: '#71717a' }}>
        {ad.cpc ? formatCurrency(ad.cpc) : '—'}
      </td>
      <td className="px-4 py-2 text-xs tabular-nums" style={{ color: '#71717a' }}>—</td>
      <td className="px-4 py-2 text-xs tabular-nums" style={{ color: '#71717a' }}>—</td>
      <td className="px-4 py-2" />
    </tr>
  )
}

// ── Inline adset row (within campaign expansion) ──────────────────────────────
function InlineAdSetRow({ adSet }: { adSet: CampaignAdSet }) {
  const [adsOpen, setAdsOpen] = useState(false)
  const ads = adSet.ads || []

  return (
    <>
      <tr
        className="transition-colors"
        style={{ background: '#f0f9ff', borderBottom: '1px solid #e0f2fe' }}
      >
        <td className="px-4 py-2.5 pl-10">
          <div className="flex items-center gap-2">
            {ads.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setAdsOpen((o) => !o) }}
                className="shrink-0"
              >
                <ChevronRight
                  size={12}
                  className={cn('transition-transform', adsOpen && 'rotate-90')}
                  style={{ color: '#0284c7' }}
                />
              </button>
            )}
            <div>
              <p className="text-xs font-medium" style={{ color: '#0369a1' }}>{adSet.name || '—'}</p>
              {adSet.audienceType && (
                <p className="text-xs mt-0.5 capitalize" style={{ color: '#7dd3fc' }}>{adSet.audienceType}</p>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-2.5 text-xs tabular-nums" style={{ color: '#0369a1' }}>
          {adSet.spend ? formatCurrency(adSet.spend) : '—'}
        </td>
        <td className="px-4 py-2.5 text-xs tabular-nums" style={{ color: '#0369a1' }}>
          {adSet.impressions?.toLocaleString() ?? '—'}
        </td>
        <td className="px-4 py-2.5 text-xs tabular-nums" style={{ color: '#0369a1' }}>
          {adSet.ctr != null ? `${adSet.ctr.toFixed(2)}%` : '—'}
        </td>
        <td className="px-4 py-2.5 text-xs tabular-nums" style={{ color: '#0369a1' }}>
          {adSet.cpa ? formatCurrency(adSet.cpa) : '—'}
        </td>
        <td className="px-4 py-2.5 text-xs tabular-nums" style={{ color: '#0369a1' }}>
          {adSet.frequency?.toFixed(2) || '—'}
        </td>
        <td className="px-4 py-2.5 text-xs tabular-nums" style={{ color: '#0369a1' }}>
          {adSet.conversions ?? '—'}
        </td>
        <td className="px-4 py-2.5">
          {adSet.status && <StatusBadge status={adSet.status} />}
        </td>
      </tr>
      {adsOpen && ads.map((ad, i) => (
        <InlineAdRow key={ad.id || i} ad={ad} />
      ))}
    </>
  )
}

// ── Campaign row with expand/collapse for adsets ──────────────────────────────
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
        className="group transition-colors hover:bg-sky-50/40"
        style={{ borderBottom: open ? 'none' : '1px solid #f4f4f5' }}
      >
        {/* Expand chevron + name */}
        <td className="px-5 py-3.5">
          <div className="flex items-start gap-2">
            <button
              onClick={() => setOpen((o) => !o)}
              className="mt-0.5 shrink-0 rounded p-0.5 transition-colors hover:bg-sky-100"
              title={open ? 'Collapse' : 'Expand ad sets'}
            >
              <ChevronRight
                size={13}
                className={cn('transition-transform', open && 'rotate-90')}
                style={{ color: adSets.length > 0 ? '#0284c7' : '#d4d4d8' }}
              />
            </button>
            <div className="min-w-0">
              {isPending && (
                <span className="w-1.5 h-1.5 rounded-full inline-block mr-1.5 mb-0.5 align-middle" style={{ background: '#f59e0b' }} />
              )}
              <Link
                href={`/dashboard/${tenantId}/campaigns/${campaign._id}`}
                onClick={(e) => e.stopPropagation()}
                className="text-sm font-medium leading-snug hover:underline"
                style={{ color: '#18181b' }}
              >
                {campaign.name || campaign.topic || 'Untitled Campaign'}
              </Link>
              {campaign.name && campaign.topic && (
                <p className="text-xs mt-0.5 truncate" style={{ color: '#a1a1aa' }}>{campaign.topic}</p>
              )}
              {adSets.length > 0 && (
                <p className="text-xs mt-0.5" style={{ color: '#0284c7' }}>
                  {adSets.length} ad set{adSets.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-3.5"><StatusBadge status={campaign.status} /></td>
        <td className="px-4 py-3.5"><SourceBadge source={campaign.source} /></td>
        <td className="px-4 py-3.5 text-right text-sm tabular-nums" style={{ color: '#52525b' }}>
          {campaign.budget ? formatCurrency(campaign.budget) : <span style={{ color: '#d4d4d8' }}>—</span>}
        </td>
        <td className="px-4 py-3.5 text-right text-sm tabular-nums" style={{ color: '#52525b' }}>
          {campaign.spend ? formatCurrency(campaign.spend) : <span style={{ color: '#d4d4d8' }}>—</span>}
        </td>
        <td className="px-4 py-3.5 text-right text-sm tabular-nums">
          {campaign.roas != null ? (
            <span className="font-semibold" style={{
              color: campaign.roas >= 2 ? '#15803d' : campaign.roas >= 1 ? '#b45309' : '#b91c1c'
            }}>
              {campaign.roas.toFixed(2)}x
            </span>
          ) : <span style={{ color: '#d4d4d8' }}>—</span>}
        </td>
        <td className="px-4 py-3.5 text-right text-sm tabular-nums" style={{ color: '#52525b' }}>
          {campaign.ctr != null ? `${campaign.ctr.toFixed(2)}%` : <span style={{ color: '#d4d4d8' }}>—</span>}
        </td>
        <td className="px-4 py-3.5 text-right text-sm tabular-nums font-medium" style={{ color: '#18181b' }}>
          {campaign.conversions ?? <span style={{ color: '#d4d4d8' }}>—</span>}
        </td>
        <td className="px-4 py-3.5 text-right text-sm whitespace-nowrap" style={{ color: '#a1a1aa' }}>
          {formatDate(campaign.launchedAt)}
        </td>
        <td className="px-4 py-3.5 text-right">
          <ChevronRight size={15} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#0284c7' }} />
        </td>
      </tr>

      {/* Ad sets expansion */}
      {open && (
        <tr style={{ borderBottom: '1px solid #e0f2fe' }}>
          <td colSpan={10} className="px-0 py-0">
            {adSets.length === 0 ? (
              <div className="px-10 py-3 text-xs" style={{ background: '#f0f9ff', color: '#7dd3fc' }}>
                No ad sets on this campaign yet.
              </div>
            ) : (
              <table className="w-full" style={{ background: '#f0f9ff' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #bae6fd' }}>
                    {['Ad Set / Audience', 'Spend', 'Impressions', 'CTR', 'CPA', 'Freq.', 'Conv.', 'Status'].map((h, i) => (
                      <th
                        key={h}
                        className={`px-4 py-2 ${i === 0 ? 'pl-10 text-left' : 'text-left'} text-xs font-semibold uppercase tracking-wider`}
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

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ArrowUpDown size={11} style={{ color: '#d4d4d8' }} />
  return sortDir === 'asc'
    ? <ArrowUp size={11} style={{ color: '#0284c7' }} />
    : <ArrowDown size={11} style={{ color: '#0284c7' }} />
}

function StatCard({
  icon: Icon,
  label,
  value,
  iconColor,
  iconBg,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  iconColor: string
  iconBg: string
}) {
  return (
    <div
      className="rounded-xl p-4 flex items-center gap-3"
      style={{ background: '#ffffff', border: '1px solid #e4e4e7', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
    >
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: iconBg }}>
        <Icon size={16} style={{ color: iconColor }} />
      </div>
      <div>
        <p className="text-xs" style={{ color: '#71717a' }}>{label}</p>
        <p className="text-lg font-bold leading-tight" style={{ color: '#18181b' }}>{value}</p>
      </div>
    </div>
  )
}

export default function CampaignsPage({ params }: PageProps) {
  const { tenantId } = use(params)

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortKey, setSortKey] = useState<SortKey>('launchedAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/campaigns/${tenantId}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setCampaigns(await res.json())
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load campaigns')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [tenantId])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('desc') }
  }

  // Stats
  const totalSpend = campaigns.reduce((s, c) => s + (c.spend || 0), 0)
  const activeCampaigns = campaigns.filter((c) => c.status === 'active').length
  const pendingCampaigns = campaigns.filter((c) => c.status === 'pending_approval').length
  const roasArr = campaigns.filter((c) => c.roas && c.roas > 0).map((c) => c.roas!)
  const avgRoas = roasArr.length ? roasArr.reduce((a, b) => a + b, 0) / roasArr.length : 0

  // Status filter counts
  const countByStatus = useMemo(() => {
    const m: Record<string, number> = { all: campaigns.length }
    campaigns.forEach((c) => { m[c.status] = (m[c.status] || 0) + 1 })
    return m
  }, [campaigns])

  // Filtered + sorted
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
        case 'topic':      va = a.name || a.topic || ''; vb = b.name || b.topic || ''; break
        case 'status':     va = a.status; vb = b.status; break
        case 'budget':     va = a.budget || 0; vb = b.budget || 0; break
        case 'spend':      va = a.spend || 0; vb = b.spend || 0; break
        case 'roas':       va = a.roas || 0; vb = b.roas || 0; break
        case 'ctr':        va = a.ctr || 0; vb = b.ctr || 0; break
        case 'conversions': va = a.conversions || 0; vb = b.conversions || 0; break
        case 'launchedAt': va = a.launchedAt || ''; vb = b.launchedAt || ''; break
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [campaigns, statusFilter, search, sortKey, sortDir])

  const cols: { key: SortKey; label: string; align: 'left' | 'right' }[] = [
    { key: 'budget',      label: 'Budget',    align: 'right' },
    { key: 'spend',       label: 'Spend',     align: 'right' },
    { key: 'roas',        label: 'ROAS',      align: 'right' },
    { key: 'ctr',         label: 'CTR',       align: 'right' },
    { key: 'conversions', label: 'Conv.',     align: 'right' },
    { key: 'launchedAt',  label: 'Launched',  align: 'right' },
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: '#18181b' }}>
            Campaigns
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#71717a' }}>
            All campaigns for {tenantId}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard icon={Megaphone}   label="Total"    value={campaigns.length}  iconColor="#52525b" iconBg="#f4f4f5" />
        <StatCard icon={Activity}    label="Active"   value={activeCampaigns}   iconColor="#15803d" iconBg="#dcfce7" />
        <StatCard icon={DollarSign}  label="Spend"    value={formatCurrency(totalSpend)} iconColor="#0284c7" iconBg="#e0f2fe" />
        <StatCard icon={TrendingUp}  label="Avg ROAS" value={avgRoas > 0 ? `${avgRoas.toFixed(2)}x` : '—'} iconColor="#b45309" iconBg="#fef3c7" />
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl p-4 mb-5 text-sm" style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#b91c1c' }}>
          {error}
        </div>
      )}

      {/* Filters bar */}
      <div
        className="rounded-xl mb-0 overflow-hidden"
        style={{ background: '#ffffff', border: '1px solid #e4e4e7', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
      >
        {/* Top bar: status tabs + search */}
        <div
          className="flex items-center justify-between gap-4 px-4 py-3 flex-wrap"
          style={{ borderBottom: '1px solid #f0f0f1' }}
        >
          {/* Status tabs */}
          <div className="flex items-center gap-1 flex-wrap">
            {STATUS_FILTERS.map((f) => {
              const count = countByStatus[f.key] ?? 0
              const active = statusFilter === f.key
              return (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={
                    active
                      ? { background: '#0284c7', color: '#ffffff' }
                      : { background: 'transparent', color: '#71717a' }
                  }
                >
                  {f.label}
                  {count > 0 && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full leading-none"
                      style={
                        active
                          ? { background: 'rgba(255,255,255,0.25)', color: '#fff' }
                          : { background: '#f4f4f5', color: '#a1a1aa' }
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
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#a1a1aa' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search campaigns..."
              className="pl-8 pr-4 py-1.5 rounded-lg text-sm w-56"
              style={{ background: '#f4f4f5', border: '1px solid #e4e4e7', color: '#18181b' }}
            />
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2" style={{ color: '#a1a1aa' }}>
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Loading campaigns...</span>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title={search || statusFilter !== 'all' ? 'No campaigns match your filters' : 'No campaigns yet'}
            subtitle={!search && statusFilter === 'all' ? 'Trigger a pipeline run to create your first campaign' : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: '#fafafa', borderBottom: '1px solid #f0f0f1' }}>
                  {/* Campaign name */}
                  <th className="px-5 py-3 text-left">
                    <button
                      onClick={() => toggleSort('topic')}
                      className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider"
                      style={{ color: sortKey === 'topic' ? '#0284c7' : '#a1a1aa' }}
                    >
                      Campaign <SortIcon col="topic" sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  </th>
                  {/* Status */}
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => toggleSort('status')}
                      className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider"
                      style={{ color: sortKey === 'status' ? '#0284c7' : '#a1a1aa' }}
                    >
                      Status <SortIcon col="status" sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  </th>
                  {/* Source — not sortable */}
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#a1a1aa' }}>
                    Source
                  </th>
                  {/* Sortable numeric cols */}
                  {cols.map((col) => (
                    <th key={col.key} className="px-4 py-3 text-right">
                      <button
                        onClick={() => toggleSort(col.key)}
                        className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider ml-auto"
                        style={{ color: sortKey === col.key ? '#0284c7' : '#a1a1aa' }}
                      >
                        <SortIcon col={col.key} sortKey={sortKey} sortDir={sortDir} />
                        {col.label}
                      </button>
                    </th>
                  ))}
                  <th className="px-4 py-3 w-8" />
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
        {!loading && filtered.length > 0 && (
          <div
            className="px-5 py-3 flex items-center justify-between"
            style={{ borderTop: '1px solid #f0f0f1' }}
          >
            <p className="text-xs" style={{ color: '#a1a1aa' }}>
              {filtered.length === campaigns.length
                ? `${campaigns.length} campaign${campaigns.length !== 1 ? 's' : ''}`
                : `${filtered.length} of ${campaigns.length} campaigns`}
            </p>
            {pendingCampaigns > 0 && (
              <button
                onClick={() => setStatusFilter('pending_approval')}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full transition-all"
                style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}
              >
                <BarChart3 size={11} />
                {pendingCampaigns} pending approval
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
