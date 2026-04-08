'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Loader2,
  ThumbsUp,
  Pause,
  Play,
  CheckCircle,
  XCircle,
  ChevronRight,
  AlertCircle,
  Megaphone,
  Bot,
  User,
  MousePointerClick,
  Eye,
  TrendingUp,
  DollarSign,
  BarChart3,
  RefreshCw,
  Target,
} from 'lucide-react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { DebateLog } from '@/components/ui/DebateLog'
import { formatCurrency, formatDateTime, formatDate, cn } from '@/lib/utils'
import type { Campaign, CampaignAdSet, CampaignAd, PendingAction } from '@/types'

const API_BASE = 'http://localhost:8082/api/v1'

interface PageProps {
  params: Promise<{ tenantId: string; campaignId: string }>
}

function AdRow({ ad }: { ad: CampaignAd }) {
  return (
    <tr className="transition-colors hover:bg-zinc-50" style={{ borderBottom: '1px solid #f4f4f5' }}>
      <td className="px-4 py-2.5">
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
      <td className="px-4 py-2.5">
        {ad.status && ad.status.trim() ? (
          <StatusBadge status={ad.status} />
        ) : (
          <span className="text-xs" style={{ color: '#d4d4d8' }}>—</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-right text-xs" style={{ color: '#71717a' }}>
        {ad.spend ? formatCurrency(ad.spend) : '—'}
      </td>
      <td className="px-4 py-2.5 text-right text-xs" style={{ color: '#71717a' }}>
        {ad.ctr != null ? `${ad.ctr.toFixed(2)}%` : '—'}
      </td>
      <td className="px-4 py-2.5 text-right text-xs" style={{ color: '#71717a' }}>
        {ad.cpc ? formatCurrency(ad.cpc) : '—'}
      </td>
      <td className="px-4 py-2.5 text-right text-xs" style={{ color: '#71717a' }}>
        {ad.impressions ?? '—'}
      </td>
    </tr>
  )
}

function AdSetRow({ adSet }: { adSet: CampaignAdSet }) {
  const [expanded, setExpanded] = useState(false)
  const ads = adSet.ads || []

  return (
    <>
      <tr
        className="transition-colors hover:bg-zinc-50 cursor-pointer"
        style={{ borderBottom: '1px solid #f4f4f5' }}
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-2">
            <ChevronRight
              size={13}
              className={cn('transition-transform', expanded && 'rotate-90')}
              style={{ color: '#d4d4d8' }}
            />
            <div>
              <p className="text-sm font-medium" style={{ color: '#18181b' }}>
                {adSet.name || '—'}
              </p>
              {adSet.audienceType && (
                <p className="text-xs mt-0.5" style={{ color: '#a1a1aa' }}>
                  {adSet.audienceType}
                </p>
              )}
            </div>
          </div>
        </td>
        <td className="px-5 py-3.5">
          {adSet.status && adSet.status.trim() ? (
            <StatusBadge status={adSet.status} />
          ) : (
            <span className="text-xs" style={{ color: '#d4d4d8' }}>—</span>
          )}
        </td>
        <td className="px-5 py-3.5 text-right text-sm tabular-nums" style={{ color: '#52525b' }}>
          {adSet.spend ? formatCurrency(adSet.spend) : '—'}
        </td>
        <td className="px-5 py-3.5 text-right text-sm tabular-nums" style={{ color: '#52525b' }}>
          {adSet.impressions ? adSet.impressions.toLocaleString() : '—'}
        </td>
        <td className="px-5 py-3.5 text-right text-sm tabular-nums" style={{ color: '#52525b' }}>
          {adSet.clicks ? adSet.clicks.toLocaleString() : '—'}
        </td>
        <td className="px-5 py-3.5 text-right text-sm tabular-nums" style={{ color: '#52525b' }}>
          {adSet.ctr != null ? `${adSet.ctr.toFixed(2)}%` : '—'}
        </td>
        <td className="px-5 py-3.5 text-right text-sm tabular-nums" style={{ color: '#52525b' }}>
          {adSet.cpa ? formatCurrency(adSet.cpa) : '—'}
        </td>
        <td className="px-5 py-3.5 text-right text-sm tabular-nums" style={{ color: '#52525b' }}>
          {adSet.frequency?.toFixed(2) || '—'}
        </td>
        <td className="px-5 py-3.5 text-right text-sm tabular-nums" style={{ color: '#52525b' }}>
          {adSet.conversions ?? '—'}
        </td>
      </tr>
      {expanded && ads.length > 0 && (
        <tr style={{ background: '#f9fafb' }}>
          <td colSpan={9} className="px-8 py-3">
            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #e4e4e7' }}>
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid #f0f0f1', background: '#fafafa' }}>
                    {['Ad / Hook / Format', 'Status', 'Spend', 'CTR', 'CPC', 'Impr.'].map((h, i) => (
                      <th
                        key={h}
                        className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider ${i < 2 ? 'text-left' : 'text-right'}`}
                        style={{ color: '#a1a1aa' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ads.map((ad, i) => (
                    <AdRow key={ad.id || i} ad={ad} />
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function PendingActionCard({
  action,
  tenantId,
  campaignId,
  onRefresh,
}: {
  action: PendingAction
  tenantId: string
  campaignId: string
  onRefresh: () => void
}) {
  const [approveState, setApproveState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [overrideState, setOverrideState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  async function handleApprove() {
    setApproveState('loading')
    try {
      const res = await fetch(
        `${API_BASE}/campaigns/${tenantId}/${campaignId}/actions/${action.actionId}/approve`,
        { method: 'POST' }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setApproveState('success')
      setTimeout(() => {
        setApproveState('idle')
        onRefresh()
      }, 2000)
    } catch {
      setApproveState('error')
      setTimeout(() => setApproveState('idle'), 3000)
    }
  }

  async function handleOverride() {
    setOverrideState('loading')
    try {
      const res = await fetch(
        `${API_BASE}/campaigns/${tenantId}/${campaignId}/actions/${action.actionId}/override`,
        { method: 'POST' }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setOverrideState('success')
      setTimeout(() => {
        setOverrideState('idle')
        onRefresh()
      }, 2000)
    } catch {
      setOverrideState('error')
      setTimeout(() => setOverrideState('idle'), 3000)
    }
  }

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{ background: '#fafafa', border: '1px solid #e4e4e7' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}
            >
              {action.type}
            </span>
            {action.targetName && (
              <span className="text-xs" style={{ color: '#71717a' }}>
                {action.targetName}
              </span>
            )}
          </div>
          {action.reason && (
            <p className="text-sm leading-relaxed" style={{ color: '#52525b' }}>
              {action.reason}
            </p>
          )}
        </div>
        <StatusBadge status={action.status} />
      </div>

      {action.metrics && Object.keys(action.metrics).length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {Object.entries(action.metrics).map(([key, val]) => (
            <div
              key={key}
              className="rounded-lg px-2.5 py-1.5"
              style={{ background: '#f4f4f5', border: '1px solid #e4e4e7' }}
            >
              <p className="text-xs" style={{ color: '#a1a1aa' }}>{key}</p>
              <p className="text-xs font-semibold" style={{ color: '#52525b' }}>
                {typeof val === 'number' ? val.toFixed(2) : String(val)}
              </p>
            </div>
          ))}
        </div>
      )}

      {action.executeAt && (
        <p className="text-xs" style={{ color: '#a1a1aa' }}>
          Execute at:{' '}
          <span style={{ color: '#52525b' }}>{formatDateTime(action.executeAt)}</span>
        </p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleApprove}
          disabled={approveState !== 'idle'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={
            approveState === 'success'
              ? { background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }
              : approveState === 'error'
              ? { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' }
              : { background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }
          }
        >
          {approveState === 'loading' ? (
            <Loader2 size={11} className="animate-spin" />
          ) : approveState === 'success' ? (
            <CheckCircle size={11} />
          ) : approveState === 'error' ? (
            <XCircle size={11} />
          ) : (
            <ThumbsUp size={11} />
          )}
          {approveState === 'loading'
            ? 'Approving...'
            : approveState === 'success'
            ? 'Approved!'
            : approveState === 'error'
            ? 'Failed'
            : 'Approve Action'}
        </button>
        <button
          onClick={handleOverride}
          disabled={overrideState !== 'idle'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{ background: '#f4f4f5', border: '1px solid #e4e4e7', color: '#71717a' }}
        >
          {overrideState === 'loading' ? <Loader2 size={11} className="animate-spin" /> : null}
          {overrideState === 'loading'
            ? 'Overriding...'
            : overrideState === 'success'
            ? 'Done!'
            : 'Override'}
        </button>
      </div>
    </div>
  )
}

export default function CampaignDetailPage({ params }: PageProps) {
  const resolvedParams = use(params)
  const { tenantId, campaignId } = resolvedParams

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [approveState, setApproveState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [pauseState, setPauseState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectState, setRejectState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function fetchCampaign() {
    try {
      const res = await fetch(`${API_BASE}/campaigns/${tenantId}/${campaignId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: Campaign = await res.json()
      setCampaign(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaign')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCampaign()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, campaignId])

  async function handlePause() {
    setPauseState('loading')
    try {
      const res = await fetch(`${API_BASE}/campaigns/${tenantId}/${campaignId}/pause`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setPauseState('success')
      showToast('Campaign paused.', 'success')
      fetchCampaign()
    } catch (err) {
      setPauseState('error')
      showToast(err instanceof Error ? err.message : 'Pause failed', 'error')
      setTimeout(() => setPauseState('idle'), 3000)
    }
  }

  async function handleResume() {
    try {
      const res = await fetch(`${API_BASE}/campaigns/${tenantId}/${campaignId}/resume`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      showToast('Campaign resumed.', 'success')
      fetchCampaign()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Resume failed', 'error')
    }
  }

  async function handleApprove() {
    setApproveState('loading')
    try {
      const res = await fetch(`${API_BASE}/campaigns/${tenantId}/${campaignId}/approve`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setApproveState('success')
      showToast('Campaign approved and launching!', 'success')
      fetchCampaign()
    } catch (err) {
      setApproveState('error')
      showToast(err instanceof Error ? err.message : 'Approval failed', 'error')
      setTimeout(() => setApproveState('idle'), 3000)
    }
  }

  async function handleReject() {
    setRejectState('loading')
    try {
      const res = await fetch(`${API_BASE}/campaigns/${tenantId}/${campaignId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setRejectState('success')
      showToast('Campaign rejected.', 'success')
      setRejectOpen(false)
      setRejectReason('')
      fetchCampaign()
    } catch (err) {
      setRejectState('error')
      showToast(err instanceof Error ? err.message : 'Rejection failed', 'error')
      setTimeout(() => setRejectState('idle'), 3000)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#f4f4f5' }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin" style={{ color: '#0284c7' }} />
          <p className="text-sm" style={{ color: '#71717a' }}>Loading campaign...</p>
        </div>
      </div>
    )
  }

  if (error || !campaign) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Link
          href={`/dashboard/${tenantId}/campaigns`}
          className="inline-flex items-center gap-2 text-sm transition-colors mb-6"
          style={{ color: '#71717a' }}
        >
          <ArrowLeft size={14} /> Back to Campaigns
        </Link>
        <div
          className="rounded-xl p-5"
          style={{ background: '#fee2e2', border: '1px solid #fecaca' }}
        >
          <div className="flex items-center gap-3">
            <AlertCircle size={18} style={{ color: '#b91c1c' }} />
            <p className="text-sm" style={{ color: '#b91c1c' }}>
              {error || 'Campaign not found'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Live ad sets (populated after Meta launch); fall back to planned config for pending campaigns
  const liveAdSets = campaign.adSets || []
  const plannedAdSets = campaign.campaignConfig?.adSets || []
  const showPlanned = liveAdSets.length === 0 && plannedAdSets.length > 0
  const pendingActions = campaign.pendingActions || []
  const reviewDebateLog = campaign.reviewDebateLog || []

  const sectionStyle = {
    background: '#ffffff',
    border: '1px solid #e4e4e7',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg"
          style={
            toast.type === 'success'
              ? { background: '#dcfce7', border: '1px solid #bbf7d0', color: '#15803d' }
              : { background: '#fee2e2', border: '1px solid #fecaca', color: '#b91c1c' }
          }
        >
          {toast.message}
        </div>
      )}

      {/* Back */}
      <div className="mb-5">
        <Link
          href={`/dashboard/${tenantId}/campaigns`}
          className="inline-flex items-center gap-1.5 text-sm transition-colors"
          style={{ color: '#71717a' }}
        >
          <ArrowLeft size={14} /> Back to Campaigns
        </Link>
      </div>

      {/* Header */}
      <div className="rounded-xl p-5 mb-5" style={sectionStyle}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <div
                className="p-2 rounded-xl"
                style={{ background: '#e0f2fe', border: '1px solid #bae6fd' }}
              >
                <Megaphone size={16} style={{ color: '#0284c7' }} />
              </div>
              <div>
                <h1 className="text-xl font-bold leading-tight" style={{ color: '#18181b' }}>
                  {campaign.name || campaign.topic || 'Untitled Campaign'}
                </h1>
                {campaign.name && campaign.topic && campaign.topic.trim() && (
                  <p className="text-xs mt-0.5" style={{ color: '#a1a1aa' }}>{campaign.topic}</p>
                )}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <StatusBadge status={campaign.status} />
                  {campaign.source === 'agent' ? (
                    <span
                      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe' }}
                    >
                      <Bot size={10} /> Agent Launched
                    </span>
                  ) : campaign.source === 'manual' ? (
                    <span
                      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: '#f4f4f5', color: '#52525b', border: '1px solid #e4e4e7' }}
                    >
                      <User size={10} /> Manual
                    </span>
                  ) : null}
                  {campaign.metaCampaignId && (
                    <span className="text-xs font-mono" style={{ color: '#a1a1aa' }}>
                      {campaign.metaCampaignId}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {campaign.objective && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: '#f4f4f5', color: '#52525b', border: '1px solid #e4e4e7' }}
                >
                  {campaign.objective}
                </span>
              )}
              {campaign.metaCampaignId && (
                <span className="text-xs font-mono" style={{ color: '#a1a1aa' }}>
                  {campaign.metaCampaignId}
                </span>
              )}
            </div>
            <div
              className="flex items-center gap-4 text-xs flex-wrap mt-2"
              style={{ color: '#a1a1aa' }}
            >
              {campaign.launchedAt && (
                <span>
                  Launched:{' '}
                  <span style={{ color: '#52525b' }}>{formatDate(campaign.launchedAt)}</span>
                </span>
              )}
              {campaign.approvedAt && (
                <span>
                  Approved:{' '}
                  <span style={{ color: '#52525b' }}>{formatDate(campaign.approvedAt)}</span>
                </span>
              )}
              {campaign.syncedAt && (
                <span className="flex items-center gap-1">
                  <RefreshCw size={10} />
                  Synced:{' '}
                  <span style={{ color: '#52525b' }}>{formatDate(campaign.syncedAt)}</span>
                </span>
              )}
              {campaign.runId && (
                <Link
                  href={`/dashboard/${tenantId}/runs/${campaign.runId}`}
                  className="font-medium transition-colors"
                  style={{ color: '#0284c7' }}
                >
                  View Run →
                </Link>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {campaign.status === 'pending_approval' && (
              <>
                <button
                  onClick={handleApprove}
                  disabled={approveState !== 'idle'}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                  style={
                    approveState !== 'idle'
                      ? { background: '#dcfce7', color: '#86efac', cursor: 'not-allowed' }
                      : { background: '#dcfce7', border: '1px solid #bbf7d0', color: '#15803d' }
                  }
                >
                  {approveState === 'loading' ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <ThumbsUp size={14} />
                  )}
                  {approveState === 'loading'
                    ? 'Approving...'
                    : approveState === 'success'
                    ? 'Approved!'
                    : 'Approve'}
                </button>
                <button
                  onClick={() => setRejectOpen((o) => !o)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: '#fee2e2',
                    border: '1px solid #fecaca',
                    color: '#b91c1c',
                  }}
                >
                  <XCircle size={14} /> Reject
                </button>
              </>
            )}
            {campaign.status === 'active' && (
              <button
                onClick={handlePause}
                disabled={pauseState !== 'idle'}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={
                  pauseState !== 'idle'
                    ? { background: '#fef3c7', color: '#b45309', opacity: 0.6, cursor: 'not-allowed' }
                    : { background: '#fef3c7', border: '1px solid #fde68a', color: '#b45309' }
                }
              >
                {pauseState === 'loading' ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Pause size={14} />
                )}
                {pauseState === 'loading' ? 'Pausing...' : pauseState === 'success' ? 'Paused!' : 'Pause'}
              </button>
            )}
            {campaign.status === 'paused' && (
              <button
                onClick={handleResume}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{ background: '#dbeafe', border: '1px solid #bfdbfe', color: '#1d4ed8' }}
              >
                <Play size={14} fill="currentColor" /> Resume
              </button>
            )}
          </div>
        </div>

        {/* Inline reject form */}
        {rejectOpen && (
          <div
            className="mt-4 rounded-xl p-4 flex flex-col gap-3"
            style={{ background: '#fef2f2', border: '1px solid #fecaca' }}
          >
            <p className="text-xs font-semibold" style={{ color: '#b91c1c' }}>
              Reason for rejection
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Describe why this campaign is being rejected..."
              rows={3}
              className="w-full rounded-lg px-3 py-2 text-sm resize-none"
              style={{ background: '#ffffff', border: '1px solid #fecaca', color: '#18181b' }}
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleReject}
                disabled={rejectState === 'loading' || !rejectReason.trim()}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#b91c1c' }}
              >
                {rejectState === 'loading' ? 'Rejecting...' : 'Confirm Reject'}
              </button>
              <button
                onClick={() => {
                  setRejectOpen(false)
                  setRejectReason('')
                }}
                className="text-xs transition-colors"
                style={{ color: '#a1a1aa' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Budget utilization bar */}
        {campaign.budget && campaign.budget > 0 && (
          <div className="mt-5 rounded-xl p-4" style={{ background: '#fafafa', border: '1px solid #e4e4e7' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium" style={{ color: '#52525b' }}>Budget utilization</span>
              <span className="text-xs font-semibold" style={{ color: '#18181b' }}>
                {formatCurrency(campaign.spend || 0)} <span style={{ color: '#a1a1aa' }}>of</span> {formatCurrency(campaign.budget)}
                <span className="ml-2" style={{ color: '#71717a' }}>
                  ({Math.min(((campaign.spend || 0) / campaign.budget) * 100, 100).toFixed(1)}%)
                </span>
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: '#e4e4e7' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(((campaign.spend || 0) / campaign.budget) * 100, 100)}%`,
                  background: ((campaign.spend || 0) / campaign.budget) > 0.9 ? '#b91c1c' : '#0284c7',
                }}
              />
            </div>
          </div>
        )}

        {/* Metrics grid */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mt-3">
          {[
            {
              icon: Eye,
              label: 'Impressions',
              value: campaign.impressions ? campaign.impressions.toLocaleString() : '—',
              iconColor: '#52525b', iconBg: '#f4f4f5',
            },
            {
              icon: MousePointerClick,
              label: 'Clicks',
              value: campaign.clicks ? campaign.clicks.toLocaleString() : '—',
              iconColor: '#1d4ed8', iconBg: '#dbeafe',
            },
            {
              icon: BarChart3,
              label: 'CTR',
              value: campaign.ctr != null ? `${campaign.ctr.toFixed(2)}%` : '—',
              iconColor: '#b45309', iconBg: '#fef3c7',
            },
            {
              icon: DollarSign,
              label: 'CPC',
              value: campaign.cpc ? formatCurrency(campaign.cpc) : '—',
              iconColor: '#52525b', iconBg: '#f4f4f5',
            },
            {
              icon: TrendingUp,
              label: 'ROAS',
              value: campaign.roas != null ? `${campaign.roas.toFixed(2)}x` : '—',
              iconColor: campaign.roas != null && campaign.roas >= 2 ? '#15803d' : campaign.roas != null && campaign.roas >= 1 ? '#b45309' : '#b91c1c',
              iconBg: campaign.roas != null && campaign.roas >= 2 ? '#dcfce7' : campaign.roas != null && campaign.roas >= 1 ? '#fef3c7' : '#fee2e2',
            },
            {
              icon: Target,
              label: 'Conversions',
              value: campaign.conversions ?? '—',
              iconColor: '#15803d', iconBg: '#dcfce7',
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl p-3 flex flex-col gap-2"
              style={{ background: '#fafafa', border: '1px solid #e4e4e7' }}
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: item.iconBg }}>
                <item.icon size={13} style={{ color: item.iconColor }} />
              </div>
              <div>
                <p className="text-xs" style={{ color: '#a1a1aa' }}>{item.label}</p>
                <p className="text-sm font-bold tabular-nums" style={{ color: item.iconColor }}>{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Review Debate */}
      {reviewDebateLog.length > 0 && (
        <div className="rounded-xl p-5 mb-5" style={sectionStyle}>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px" style={{ background: '#e4e4e7' }} />
            <h2 className="text-xs font-semibold uppercase tracking-wider px-2" style={{ color: '#a1a1aa' }}>
              Review Debate
            </h2>
            <div className="flex-1 h-px" style={{ background: '#e4e4e7' }} />
          </div>
          <DebateLog rounds={reviewDebateLog} />
        </div>
      )}

      {/* Review Notes */}
      {(campaign.reviewNotes || campaign.reviewAdjustments?.budgetAdjusted) && (
        <div className="rounded-xl p-5 mb-5" style={sectionStyle}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: '#18181b' }}>Review Notes</h2>
          {campaign.reviewAdjustments?.budgetAdjusted && (
            <div className="flex items-center gap-3 mb-3 px-3 py-2 rounded-lg text-sm" style={{ background: '#fef3c7', border: '1px solid #fde68a' }}>
              <span style={{ color: '#b45309' }}>Budget adjusted:</span>
              <span className="font-semibold" style={{ color: '#92400e' }}>
                {campaign.reviewAdjustments.originalBudget > 0 && formatCurrency(campaign.reviewAdjustments.originalBudget) + ' → '}
                {formatCurrency(campaign.reviewAdjustments.recommendedBudget)}
              </span>
            </div>
          )}
          {campaign.reviewNotes && (
            <p className="text-sm leading-relaxed" style={{ color: '#52525b' }}>{campaign.reviewNotes}</p>
          )}
        </div>
      )}

      {/* Ad Sets */}
      <div className="rounded-xl overflow-hidden mb-5" style={sectionStyle}>
        <div className="px-5 py-3.5" style={{ borderBottom: '1px solid #f0f0f1' }}>
          <h2 className="text-sm font-semibold" style={{ color: '#18181b' }}>
            {showPlanned ? 'Planned Ad Sets' : 'Ad Sets'}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: '#71717a' }}>
            {showPlanned
              ? 'Configured ad sets — live metrics will appear after campaign launches on Meta'
              : 'Click a row to expand per-ad metrics'}
          </p>
        </div>

        {showPlanned ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid #f0f0f1', background: '#fafafa' }}>
                  {['Ad Set', 'Audience', 'Budget %', 'Age', 'Geo', 'Optimization Goal'].map((h, i) => (
                    <th
                      key={h}
                      className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider ${i === 0 ? 'text-left' : 'text-right'}`}
                      style={{ color: '#a1a1aa' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plannedAdSets.map((adSet, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f4f4f5' }}>
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-medium" style={{ color: '#18181b' }}>{adSet.name}</p>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded mt-0.5 inline-block"
                        style={{ background: '#dbeafe', color: '#1d4ed8' }}
                      >
                        {adSet.audienceType}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-sm" style={{ color: '#52525b' }}>
                      {adSet.audienceType}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm font-semibold" style={{ color: '#0284c7' }}>
                        {adSet.budgetPercent}%
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-sm" style={{ color: '#52525b' }}>
                      {adSet.ageMin && adSet.ageMax ? `${adSet.ageMin}–${adSet.ageMax}` : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right text-sm" style={{ color: '#52525b' }}>
                      {adSet.geoLocations?.join(', ') || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right text-xs" style={{ color: '#71717a' }}>
                      {adSet.optimizationGoal?.replace(/_/g, ' ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid #f0f0f1', background: '#fafafa' }}>
                    {['Ad Set', 'Status', 'Spend', 'Impr.', 'Clicks', 'CTR', 'CPA', 'Freq.', 'Conv.'].map((h, i) => (
                      <th
                        key={h}
                        className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider ${i < 2 ? 'text-left' : 'text-right'}`}
                        style={{ color: '#a1a1aa' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {liveAdSets.map((adSet, idx) => (
                    <AdSetRow key={adSet.metaAdSetId || idx} adSet={adSet} />
                  ))}
                </tbody>
              </table>
            </div>
            {liveAdSets.length === 0 && (
              <div className="px-5 py-8 text-center">
                <p className="text-sm" style={{ color: '#a1a1aa' }}>No ad sets synced yet.</p>
                <p className="text-xs mt-1" style={{ color: '#d4d4d8' }}>Ad sets appear once the campaign is live on Meta.</p>
              </div>
            )}
          </>
        )}

        {/* Scale / Pause rules */}
        {(campaign.campaignConfig?.scaleRules || campaign.campaignConfig?.pauseRules) && (
          <div className="px-5 py-4" style={{ borderTop: '1px solid #f0f0f1' }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {campaign.campaignConfig.scaleRules && (
                <div>
                  <p className="text-xs font-semibold mb-1.5" style={{ color: '#15803d' }}>📈 Scale Rules</p>
                  <p className="text-xs leading-relaxed" style={{ color: '#52525b' }}>{campaign.campaignConfig.scaleRules}</p>
                </div>
              )}
              {campaign.campaignConfig.pauseRules && (
                <div>
                  <p className="text-xs font-semibold mb-1.5" style={{ color: '#b91c1c' }}>⏸ Pause Rules</p>
                  <p className="text-xs leading-relaxed" style={{ color: '#52525b' }}>{campaign.campaignConfig.pauseRules}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Pending Actions */}
      {pendingActions.length > 0 && (
        <div className="rounded-xl p-5" style={sectionStyle}>
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle size={15} style={{ color: '#b45309' }} />
            <h2 className="text-sm font-semibold" style={{ color: '#18181b' }}>
              Pending Actions
            </h2>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}
            >
              {pendingActions.length}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingActions.map((action) => (
              <PendingActionCard
                key={action.actionId}
                action={action}
                tenantId={tenantId}
                campaignId={campaignId}
                onRefresh={fetchCampaign}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
