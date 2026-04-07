'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Loader2,
  ThumbsUp,
  Pause,
  CheckCircle,
  XCircle,
  ChevronRight,
  AlertCircle,
  Megaphone,
  Bot,
  User,
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
  const metrics = ad.metrics || {}
  return (
    <tr className="transition-colors hover:bg-zinc-50" style={{ borderBottom: '1px solid #f4f4f5' }}>
      <td className="px-4 py-2.5 text-xs font-mono" style={{ color: '#71717a' }}>
        {ad.metaAdId?.slice(0, 12) || '—'}
      </td>
      <td className="px-4 py-2.5">
        {ad.status ? (
          <StatusBadge status={ad.status} />
        ) : (
          <span className="text-xs" style={{ color: '#d4d4d8' }}>—</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-right text-xs" style={{ color: '#71717a' }}>
        {metrics.spend ? formatCurrency(metrics.spend) : '—'}
      </td>
      <td className="px-4 py-2.5 text-right text-xs" style={{ color: '#71717a' }}>
        {metrics.ctr ? `${(metrics.ctr * 100).toFixed(2)}%` : '—'}
      </td>
      <td className="px-4 py-2.5 text-right text-xs" style={{ color: '#71717a' }}>
        {metrics.cpc ? formatCurrency(metrics.cpc) : '—'}
      </td>
      <td className="px-4 py-2.5 text-right text-xs" style={{ color: '#71717a' }}>
        {metrics.conversions ?? '—'}
      </td>
    </tr>
  )
}

function AdSetRow({ adSet }: { adSet: CampaignAdSet }) {
  const [expanded, setExpanded] = useState(false)
  const ads = adSet.ads || []
  const metrics = adSet.metrics || {}

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
          {adSet.status ? (
            <StatusBadge status={adSet.status} />
          ) : (
            <span className="text-sm" style={{ color: '#d4d4d8' }}>—</span>
          )}
        </td>
        <td className="px-5 py-3.5 text-right text-sm" style={{ color: '#52525b' }}>
          {metrics.spend ? formatCurrency(metrics.spend) : '—'}
        </td>
        <td className="px-5 py-3.5 text-right text-sm" style={{ color: '#52525b' }}>
          {metrics.ctr ? `${(metrics.ctr * 100).toFixed(2)}%` : '—'}
        </td>
        <td className="px-5 py-3.5 text-right text-sm" style={{ color: '#52525b' }}>
          {metrics.cpa ? formatCurrency(metrics.cpa) : '—'}
        </td>
        <td className="px-5 py-3.5 text-right text-sm" style={{ color: '#52525b' }}>
          {metrics.frequency?.toFixed(2) || '—'}
        </td>
        <td className="px-5 py-3.5 text-right text-sm" style={{ color: '#52525b' }}>
          {metrics.conversions ?? '—'}
        </td>
      </tr>
      {expanded && ads.length > 0 && (
        <tr style={{ background: '#f9fafb' }}>
          <td colSpan={7} className="px-8 py-3">
            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #e4e4e7' }}>
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid #f0f0f1', background: '#fafafa' }}>
                    {['Ad', 'Status', 'Spend', 'CTR', 'CPC', 'Conv.'].map((h, i) => (
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
                    <AdRow key={ad.metaAdId || i} ad={ad} />
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

  const adSets = campaign.adSets || []
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
                  {campaign.topic || 'Untitled Campaign'}
                </h1>
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
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{ background: '#fef3c7', border: '1px solid #fde68a', color: '#b45309' }}
              >
                <Pause size={14} />
                Pause
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

        {/* Budget Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          {[
            { label: 'Budget', value: campaign.budget ? formatCurrency(campaign.budget) : '—', color: '#18181b' },
            { label: 'Total Spend', value: campaign.spend ? formatCurrency(campaign.spend) : '—', color: '#18181b' },
            { label: 'ROAS', value: campaign.roas ? `${campaign.roas.toFixed(2)}x` : '—', color: '#15803d' },
            { label: 'Conversions', value: campaign.conversions ?? '—', color: '#18181b' },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-lg p-3"
              style={{ background: '#fafafa', border: '1px solid #e4e4e7' }}
            >
              <p className="text-xs mb-1" style={{ color: '#a1a1aa' }}>{item.label}</p>
              <p className="text-sm font-semibold" style={{ color: item.color }}>
                {item.value}
              </p>
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

      {/* Ad Sets */}
      {adSets.length > 0 && (
        <div className="rounded-xl overflow-hidden mb-5" style={sectionStyle}>
          <div className="px-5 py-3.5" style={{ borderBottom: '1px solid #f0f0f1' }}>
            <h2 className="text-sm font-semibold" style={{ color: '#18181b' }}>Ad Sets</h2>
            <p className="text-xs mt-0.5" style={{ color: '#71717a' }}>
              Click a row to expand per-ad metrics
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid #f0f0f1', background: '#fafafa' }}>
                  {['Ad Set', 'Status', 'Spend', 'CTR', 'CPA', 'Freq.', 'Conv.'].map((h, i) => (
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
                {adSets.map((adSet, idx) => (
                  <AdSetRow key={adSet.metaAdSetId || idx} adSet={adSet} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
