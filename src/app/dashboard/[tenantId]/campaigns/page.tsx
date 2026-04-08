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
  ThumbsUp,
  XCircle,
  AlertCircle,
  Target,
  Users,
  MapPin,
  Zap,
  RefreshCw,
} from 'lucide-react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { DebateLog } from '@/components/ui/DebateLog'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import type { Campaign, CampaignAdSet, CampaignAd, AdSetConfig } from '@/types'

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
      style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }}
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
          <p className="text-xs font-medium" style={{ color: '#0f172a' }}>{ad.name || '—'}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {ad.hookStyle && (
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#f1f5f9', color: '#64748b' }}>
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
      <td className="px-4 py-2 text-xs tabular-nums" style={{ color: '#64748b' }}>
        {ad.spend ? formatCurrency(ad.spend) : '—'}
      </td>
      <td className="px-4 py-2 text-xs tabular-nums" style={{ color: '#64748b' }}>
        {ad.impressions?.toLocaleString() ?? '—'}
      </td>
      <td className="px-4 py-2 text-xs tabular-nums" style={{ color: '#64748b' }}>
        {ad.ctr != null ? `${ad.ctr.toFixed(2)}%` : '—'}
      </td>
      <td className="px-4 py-2 text-xs tabular-nums" style={{ color: '#64748b' }}>
        {ad.cpc ? formatCurrency(ad.cpc) : '—'}
      </td>
      <td className="px-4 py-2 text-xs tabular-nums" style={{ color: '#64748b' }}>—</td>
      <td className="px-4 py-2 text-xs tabular-nums" style={{ color: '#64748b' }}>—</td>
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
                  style={{ color: '#0ea5e9' }}
                />
              </button>
            )}
            <div>
              <p className="text-xs font-medium" style={{ color: '#0284c7' }}>{adSet.name || '—'}</p>
              {adSet.audienceType && (
                <p className="text-xs mt-0.5 capitalize" style={{ color: '#7dd3fc' }}>{adSet.audienceType}</p>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-2.5 text-xs tabular-nums" style={{ color: '#0284c7' }}>
          {adSet.spend ? formatCurrency(adSet.spend) : '—'}
        </td>
        <td className="px-4 py-2.5 text-xs tabular-nums" style={{ color: '#0284c7' }}>
          {adSet.impressions?.toLocaleString() ?? '—'}
        </td>
        <td className="px-4 py-2.5 text-xs tabular-nums" style={{ color: '#0284c7' }}>
          {adSet.ctr != null ? `${adSet.ctr.toFixed(2)}%` : '—'}
        </td>
        <td className="px-4 py-2.5 text-xs tabular-nums" style={{ color: '#0284c7' }}>
          {adSet.cpa ? formatCurrency(adSet.cpa) : '—'}
        </td>
        <td className="px-4 py-2.5 text-xs tabular-nums" style={{ color: '#0284c7' }}>
          {adSet.frequency?.toFixed(2) || '—'}
        </td>
        <td className="px-4 py-2.5 text-xs tabular-nums" style={{ color: '#0284c7' }}>
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

// ── Pending campaign full-detail panel ───────────────────────────────────────
function PendingCampaignPanel({
  campaign,
  tenantId,
  onApproved,
}: {
  campaign: Campaign
  tenantId: string
  onApproved: () => void
}) {
  const [approveState, setApproveState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectState, setRejectState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const cfg = campaign.campaignConfig
  const adSets: AdSetConfig[] = cfg?.adSets || []

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function handleApprove() {
    setApproveState('loading')
    try {
      const res = await fetch(`${API_BASE}/campaigns/${tenantId}/${campaign._id}/approve`, { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setApproveState('success')
      showToast('Campaign approved and launching!', 'success')
      setTimeout(onApproved, 1500)
    } catch (err) {
      setApproveState('error')
      showToast(err instanceof Error ? err.message : 'Approval failed', 'error')
      setTimeout(() => setApproveState('idle'), 3000)
    }
  }

  async function handleReject() {
    setRejectState('loading')
    try {
      const res = await fetch(`${API_BASE}/campaigns/${tenantId}/${campaign._id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setRejectState('success')
      showToast('Campaign rejected.', 'success')
      setRejectOpen(false)
      setRejectReason('')
      setTimeout(onApproved, 1500)
    } catch (err) {
      setRejectState('error')
      showToast(err instanceof Error ? err.message : 'Rejection failed', 'error')
      setTimeout(() => setRejectState('idle'), 3000)
    }
  }

  return (
    <tr>
      <td colSpan={11} className="px-0 py-0">
        {toast && (
          <div
            className="mx-5 mt-4 px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2"
            style={toast.type === 'success'
              ? { background: '#dcfce7', border: '1px solid #bbf7d0', color: '#15803d' }
              : { background: '#fee2e2', border: '1px solid #fecaca', color: '#b91c1c' }
            }
          >
            <AlertCircle size={14} /> {toast.msg}
          </div>
        )}

        <div className="px-5 py-5" style={{ background: '#fffbeb', borderTop: '2px solid #fbbf24', borderBottom: '1px solid #fde68a' }}>

          {/* Approval action bar */}
          <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
            <div>
              <p className="text-sm font-bold" style={{ color: '#92400e' }}>Campaign awaiting your approval</p>
              <p className="text-xs mt-0.5" style={{ color: '#b45309' }}>Review all details below before launching</p>
            </div>
            <div className="flex items-center gap-2">
              {!rejectOpen && (
                <button
                  onClick={() => setRejectOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                  style={{ background: '#fee2e2', color: '#b91c1c', border: '1.5px solid #fecaca' }}
                >
                  <XCircle size={14} /> Reject
                </button>
              )}
              <button
                onClick={handleApprove}
                disabled={approveState !== 'idle'}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-60"
                style={{
                  background: approveState === 'success' ? '#dcfce7' : approveState !== 'idle' ? '#d1fae5' : '#15803d',
                  color: approveState !== 'idle' ? '#15803d' : '#ffffff',
                  border: '1.5px solid #15803d',
                  boxShadow: approveState === 'idle' ? '0 2px 8px rgba(21,128,61,0.25)' : 'none',
                }}
              >
                {approveState === 'loading' ? <Loader2 size={14} className="animate-spin" /> : <ThumbsUp size={14} />}
                {approveState === 'loading' ? 'Approving…' : approveState === 'success' ? 'Approved!' : 'Approve & Launch'}
              </button>
            </div>
          </div>

          {/* Reject reason form */}
          {rejectOpen && (
            <div className="rounded-xl p-4 mb-5 flex flex-col gap-3" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
              <p className="text-sm font-semibold" style={{ color: '#b91c1c' }}>Reason for rejection</p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Describe why this campaign is being rejected…"
                rows={2}
                className="w-full rounded-lg px-3 py-2 text-sm resize-none"
                style={{ background: '#ffffff', border: '1px solid #fecaca', color: '#0f172a', outline: 'none' }}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleReject}
                  disabled={rejectState === 'loading' || !rejectReason.trim()}
                  className="px-4 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50"
                  style={{ background: '#dc2626', color: '#ffffff', border: 'none' }}
                >
                  {rejectState === 'loading' ? 'Rejecting…' : 'Confirm Reject'}
                </button>
                <button onClick={() => { setRejectOpen(false); setRejectReason('') }} className="text-sm" style={{ color: '#94a3b8' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Campaign overview grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              { icon: DollarSign, label: 'Budget', value: cfg?.budget ? formatCurrency(cfg.budget) : campaign.budget ? formatCurrency(campaign.budget) : '—', color: '#0ea5e9', bg: '#e0f2fe' },
              { icon: Target, label: 'Objective', value: cfg?.objective || campaign.objective || '—', color: '#8b5cf6', bg: '#ede9fe' },
              { icon: Zap, label: 'Conversion Event', value: cfg?.conversionEvent || '—', color: '#f59e0b', bg: '#fef3c7' },
              { icon: Activity, label: 'Conv. Value', value: cfg?.conversionValue ? formatCurrency(cfg.conversionValue) : '—', color: '#16a34a', bg: '#dcfce7' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl p-3" style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: item.bg }}>
                    <item.icon size={12} style={{ color: item.color }} />
                  </div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>{item.label}</p>
                </div>
                <p className="text-sm font-semibold truncate" style={{ color: '#0f172a' }}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Budget adjustment notice */}
          {campaign.reviewAdjustments?.budgetAdjusted && (
            <div className="rounded-xl p-3 mb-5 flex items-center gap-3" style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
              <AlertCircle size={14} style={{ color: '#f97316' }} />
              <p className="text-xs" style={{ color: '#c2410c' }}>
                Budget adjusted by AI reviewer: <span className="line-through">{formatCurrency(campaign.reviewAdjustments.originalBudget)}</span>
                {' → '}
                <span className="font-bold">{formatCurrency(campaign.reviewAdjustments.recommendedBudget)}</span>
              </p>
            </div>
          )}

          {/* Ad Sets */}
          {adSets.length > 0 && (
            <div className="mb-5">
              <p className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: '#64748b' }}>
                <Users size={12} /> Planned Ad Sets ({adSets.length})
              </p>
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e2e8f0' }}>
                <table className="w-full">
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      {['Ad Set', 'Audience Type', 'Budget %', 'Age Range', 'Geo', 'Optimization', 'Meta Audience ID'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {adSets.map((adSet, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors" style={{ borderBottom: idx < adSets.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold" style={{ color: '#0f172a' }}>{adSet.name}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize" style={{
                            background: adSet.audienceType === 'lookalike' ? '#e0f2fe' : adSet.audienceType === 'retarget' ? '#fef3c7' : adSet.audienceType === 'advantage_plus' ? '#ede9fe' : '#f1f5f9',
                            color: adSet.audienceType === 'lookalike' ? '#0284c7' : adSet.audienceType === 'retarget' ? '#b45309' : adSet.audienceType === 'advantage_plus' ? '#7c3aed' : '#64748b',
                          }}>
                            {adSet.audienceType?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#e2e8f0', maxWidth: 60 }}>
                              <div style={{ width: `${adSet.budgetPercent}%`, height: '100%', background: '#0ea5e9' }} />
                            </div>
                            <span className="text-xs font-bold" style={{ color: '#0f172a' }}>{adSet.budgetPercent}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#475569' }}>
                          {adSet.ageMin || adSet.ageMax ? `${adSet.ageMin ?? '?'}–${adSet.ageMax ?? '?'}` : <span style={{ color: '#cbd5e1' }}>—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {adSet.geoLocations && adSet.geoLocations.length > 0 ? (
                            <div className="flex items-center gap-1 flex-wrap">
                              <MapPin size={10} style={{ color: '#94a3b8' }} />
                              <span className="text-xs" style={{ color: '#475569' }}>{adSet.geoLocations.join(', ')}</span>
                            </div>
                          ) : <span className="text-xs" style={{ color: '#cbd5e1' }}>—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#475569' }}>
                          {adSet.optimizationGoal || <span style={{ color: '#cbd5e1' }}>—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <code className="text-xs font-mono" style={{ color: '#94a3b8' }}>
                            {adSet.metaAudienceId || <span style={{ color: '#cbd5e1' }}>—</span>}
                          </code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Scale & Pause rules */}
          {(cfg?.scaleRules || cfg?.pauseRules) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
              {cfg?.scaleRules && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#64748b' }}>Scale Rules</p>
                  <pre className="text-xs rounded-xl px-4 py-3 whitespace-pre-wrap leading-relaxed" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' }}>{cfg.scaleRules}</pre>
                </div>
              )}
              {cfg?.pauseRules && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#64748b' }}>Pause Rules</p>
                  <pre className="text-xs rounded-xl px-4 py-3 whitespace-pre-wrap leading-relaxed" style={{ background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412' }}>{cfg.pauseRules}</pre>
                </div>
              )}
            </div>
          )}

          {/* Review debate log */}
          {campaign.reviewDebateLog && campaign.reviewDebateLog.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#64748b' }}>AI Review Debate</p>
              <DebateLog rounds={campaign.reviewDebateLog} />
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Campaign row with expand/collapse for adsets ──────────────────────────────
function CampaignRow({
  campaign,
  tenantId,
  isPending,
  onRefresh,
}: {
  campaign: Campaign
  tenantId: string
  isPending: boolean
  onRefresh: () => void
}) {
  const [open, setOpen] = useState(isPending)
  const adSets = campaign.metaAdSets || []

  return (
    <>
      <tr
        className="group transition-colors hover:bg-slate-50/70"
        style={{ borderBottom: open ? 'none' : '1px solid #f1f5f9' }}
      >
        {/* Expand chevron + name */}
        <td className="px-5 py-3.5">
          <div className="flex items-start gap-2">
            <button
              onClick={() => setOpen((o) => !o)}
              className="mt-0.5 shrink-0 rounded p-0.5 transition-colors hover:bg-sky-100"
              title={open ? 'Collapse' : isPending ? 'Review campaign' : 'Expand ad sets'}
            >
              <ChevronDown
                size={13}
                className={cn('transition-transform', !open && '-rotate-90')}
                style={{ color: isPending ? '#f59e0b' : adSets.length > 0 ? '#0ea5e9' : '#cbd5e1' }}
              />
            </button>
            <div className="min-w-0">
              {isPending && (
                <span className="relative flex h-2 w-2 mr-1.5 inline-block align-middle mb-0.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#f59e0b' }} />
                  <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: '#f59e0b' }} />
                </span>
              )}
              <Link
                href={`/dashboard/${tenantId}/campaigns/${campaign._id}`}
                onClick={(e) => e.stopPropagation()}
                className="text-sm font-medium leading-snug hover:underline"
                style={{ color: '#0f172a' }}
              >
                {campaign.name || campaign.topic || 'Untitled Campaign'}
              </Link>
              {campaign.name && campaign.topic && (
                <p className="text-xs mt-0.5 truncate" style={{ color: '#94a3b8' }}>{campaign.topic}</p>
              )}
              {isPending ? (
                <p className="text-xs mt-0.5 font-medium" style={{ color: '#f59e0b' }}>
                  Needs your approval — click to review
                </p>
              ) : adSets.length > 0 && (
                <p className="text-xs mt-0.5" style={{ color: '#0ea5e9' }}>
                  {adSets.length} ad set{adSets.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-3.5"><StatusBadge status={campaign.status} /></td>
        <td className="px-4 py-3.5"><SourceBadge source={campaign.source} /></td>
        <td className="px-4 py-3.5 text-right text-sm tabular-nums" style={{ color: '#475569' }}>
          {campaign.budget ? formatCurrency(campaign.budget) : <span style={{ color: '#cbd5e1' }}>—</span>}
        </td>
        <td className="px-4 py-3.5 text-right text-sm tabular-nums" style={{ color: '#475569' }}>
          {campaign.spend ? formatCurrency(campaign.spend) : <span style={{ color: '#cbd5e1' }}>—</span>}
        </td>
        <td className="px-4 py-3.5 text-right text-sm tabular-nums">
          {campaign.roas != null ? (
            <span className="font-semibold" style={{
              color: campaign.roas >= 2 ? '#15803d' : campaign.roas >= 1 ? '#b45309' : '#b91c1c'
            }}>
              {campaign.roas.toFixed(2)}x
            </span>
          ) : <span style={{ color: '#cbd5e1' }}>—</span>}
        </td>
        <td className="px-4 py-3.5 text-right text-sm tabular-nums" style={{ color: '#475569' }}>
          {campaign.ctr != null ? `${campaign.ctr.toFixed(2)}%` : <span style={{ color: '#cbd5e1' }}>—</span>}
        </td>
        <td className="px-4 py-3.5 text-right text-sm tabular-nums font-medium" style={{ color: '#0f172a' }}>
          {campaign.conversions ?? <span style={{ color: '#cbd5e1' }}>—</span>}
        </td>
        <td className="px-4 py-3.5 text-right text-sm whitespace-nowrap" style={{ color: '#94a3b8' }}>
          {formatDate(campaign.launchedAt)}
        </td>
        <td className="px-4 py-3.5 text-right">
          {isPending ? (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#fef3c7', color: '#b45309' }}>Review</span>
          ) : (
            <ChevronRight size={15} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#0ea5e9' }} />
          )}
        </td>
      </tr>

      {/* Expansion: pending = full review panel, others = live ad sets */}
      {open && isPending && (
        <PendingCampaignPanel campaign={campaign} tenantId={tenantId} onApproved={onRefresh} />
      )}
      {open && !isPending && (
        <tr style={{ borderBottom: '1px solid #e0f2fe' }}>
          <td colSpan={11} className="px-0 py-0">
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
  if (col !== sortKey) return <ArrowUpDown size={11} style={{ color: '#cbd5e1' }} />
  return sortDir === 'asc'
    ? <ArrowUp size={11} style={{ color: '#0ea5e9' }} />
    : <ArrowDown size={11} style={{ color: '#0ea5e9' }} />
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
      style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(15,23,42,0.05)' }}
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: iconBg }}>
        <Icon size={16} style={{ color: iconColor }} />
      </div>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: '#94a3b8' }}>{label}</p>
        <p className="text-[18px] font-bold leading-tight tabular-nums" style={{ color: '#0f172a' }}>{value}</p>
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
    <div className="p-7 max-w-7xl mx-auto animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#e0f2fe', border: '1px solid #bae6fd' }}>
            <Megaphone size={18} style={{ color: '#0ea5e9' }} />
          </div>
          <div>
            <h1 className="text-[20px] font-bold tracking-tight" style={{ color: '#0f172a' }}>Campaigns</h1>
            <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>All campaigns · {tenantId}</p>
          </div>
        </div>
        <button
          onClick={fetchCampaigns}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all hover:border-sky-400 hover:text-sky-600"
          style={{ background: '#ffffff', border: '1px solid #e2e8f0', color: '#475569' }}
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {/* Pending campaigns alert */}
      {pendingCampaigns > 0 && (
        <div
          className="rounded-xl p-4 mb-5 flex items-center justify-between gap-4 flex-wrap"
          style={{ background: '#fffbeb', border: '2px solid #fbbf24' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#fef3c7' }}>
              <AlertCircle size={15} style={{ color: '#f59e0b' }} />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: '#92400e' }}>
                {pendingCampaigns} campaign{pendingCampaigns !== 1 ? 's' : ''} need{pendingCampaigns === 1 ? 's' : ''} your approval
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#b45309' }}>
                Expand each pending campaign below to review ad sets, budget, and rules before launching
              </p>
            </div>
          </div>
          <button
            onClick={() => setStatusFilter('pending_approval')}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all shrink-0"
            style={{ background: '#f59e0b', color: '#ffffff', border: 'none' }}
          >
            Show pending only
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Megaphone}   label="Total"    value={campaigns.length}  iconColor="#64748b" iconBg="#f1f5f9" />
        <StatCard icon={Activity}    label="Active"   value={activeCampaigns}   iconColor="#15803d" iconBg="#dcfce7" />
        <StatCard icon={DollarSign}  label="Spend"    value={formatCurrency(totalSpend)} iconColor="#0ea5e9" iconBg="#e0f2fe" />
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
        style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(15,23,42,0.05)' }}
      >
        {/* Top bar: status tabs + search */}
        <div
          className="flex items-center justify-between gap-4 px-4 py-3 flex-wrap"
          style={{ borderBottom: '1px solid #f1f5f9' }}
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
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={
                    active
                      ? {
                          background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                          color: '#ffffff',
                          boxShadow: '0 1px 4px rgba(2,132,199,0.3)',
                        }
                      : { background: 'transparent', color: '#64748b' }
                  }
                >
                  {f.label}
                  {count > 0 && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full leading-none font-semibold"
                      style={
                        active
                          ? { background: 'rgba(255,255,255,0.22)', color: '#fff' }
                          : { background: '#f1f2f4', color: '#94a3b8' }
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
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94a3b8' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search campaigns…"
              className="pl-8 pr-4 py-1.5 rounded-lg text-xs w-52"
              style={{ background: '#f6f6f7', border: '1px solid #e2e8f0', color: '#0f172a' }}
            />
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2" style={{ color: '#94a3b8' }}>
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
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                  {/* Campaign name */}
                  <th className="px-5 py-3 text-left">
                    <button
                      onClick={() => toggleSort('topic')}
                      className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider"
                      style={{ color: sortKey === 'topic' ? '#0284c7' : '#b4b4bc' }}
                    >
                      Campaign <SortIcon col="topic" sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  </th>
                  {/* Status */}
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => toggleSort('status')}
                      className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider"
                      style={{ color: sortKey === 'status' ? '#0284c7' : '#b4b4bc' }}
                    >
                      Status <SortIcon col="status" sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  </th>
                  {/* Source — not sortable */}
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>
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
                    onRefresh={fetchCampaigns}
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
            style={{ borderTop: '1px solid #f1f5f9' }}
          >
            <p className="text-xs" style={{ color: '#94a3b8' }}>
              {filtered.length === campaigns.length
                ? `${campaigns.length} campaign${campaigns.length !== 1 ? 's' : ''}`
                : `${filtered.length} of ${campaigns.length} campaigns`}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
