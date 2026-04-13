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
  ChevronDown,
  Image as ImageIcon,
  Video,
  Shield,
  Clock,
  Activity,
  FlameKindling,
} from 'lucide-react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { DebateLog } from '@/components/ui/DebateLog'
import { formatCurrency, formatDateTime, formatDate, cn } from '@/lib/utils'
import type { Campaign, CampaignAdSet, CampaignAd, PendingAction, AuditSnapshot } from '@/types'

interface CreativePackage {
  _id: string
  status: string
  copyVariants: Array<{ primaryText: string; headline?: string; cta?: string; hookStyle?: string }>
  selectedCopyIndex?: number
  copySelectionReason?: string
  imagePrompt?: string
  imageUrl?: string
  videoPrompt?: string
  videoUrl?: string
  complianceNotes?: string
}

const API_BASE = 'http://localhost:8082/api/v1'

interface PageProps {
  params: Promise<{ tenantId: string; campaignId: string }>
}

function AdRow({ ad }: { ad: CampaignAd }) {
  // Support nested metrics object with fallback to top-level fields
  const spend       = ad.metrics?.spend       ?? ad.spend
  const ctr         = ad.metrics?.ctr         ?? ad.ctr
  const conversions = ad.metrics?.conversions  ?? undefined

  // Creative fatigue: CTR dropped >35% vs baseline
  const isFatigued = ctr != null && ad.ctrBaseline != null && ctr < ad.ctrBaseline * 0.65

  return (
    <tr className="transition-colors hover:bg-zinc-50" style={{ borderBottom: '1px solid #f4f4f5' }}>
      <td className="px-4 py-2.5">
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-xs font-medium" style={{ color: '#18181b' }}>{ad.name || '—'}</p>
            {isFatigued && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' }}>
                <FlameKindling size={9} /> Fatigue
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {ad.hookStyle && (
              <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: '#f4f4f5', color: '#71717a' }}>
                {ad.hookStyle}
              </span>
            )}
            {ad.format && (
              <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
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
      <td className="px-4 py-2.5 text-right text-xs tabular-nums whitespace-nowrap" style={{ color: '#71717a' }}>
        {spend ? formatCurrency(spend) : '—'}
      </td>
      <td className="px-4 py-2.5 text-right text-xs tabular-nums whitespace-nowrap">
        {ctr != null ? (
          <span style={{ color: isFatigued ? '#b91c1c' : '#71717a' }}>
            {ctr.toFixed(2)}%
            {ad.ctrBaseline != null && (
              <span className="ml-1 text-[10px]" style={{ color: '#a1a1aa' }}>
                (base {ad.ctrBaseline.toFixed(2)}%)
              </span>
            )}
          </span>
        ) : '—'}
      </td>
      <td className="px-4 py-2.5 text-right text-xs tabular-nums whitespace-nowrap" style={{ color: '#71717a' }}>
        {ad.cpc ? formatCurrency(ad.cpc) : '—'}
      </td>
      <td className="px-4 py-2.5 text-right text-xs tabular-nums" style={{ color: '#71717a' }}>
        {conversions != null ? conversions : (ad.impressions ?? '—')}
      </td>
    </tr>
  )
}

function AdSetRow({ adSet }: { adSet: CampaignAdSet }) {
  const [expanded, setExpanded] = useState(false)
  const ads = adSet.ads || []

  // Support nested metrics with fallback to top-level fields
  const spend       = adSet.metrics?.spend       ?? adSet.spend
  const ctr         = adSet.metrics?.ctr         ?? adSet.ctr
  const roas        = adSet.metrics?.roas
  const conversions = adSet.metrics?.conversions  ?? adSet.conversions
  const frequency   = adSet.metrics?.frequency    ?? adSet.frequency
  const cpa         = adSet.metrics?.cpa          ?? adSet.cpa

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
              style={{ color: ads.length > 0 ? '#0284c7' : '#d4d4d8' }}
            />
            <div>
              <p className="text-sm font-medium truncate" style={{ color: '#18181b', maxWidth: 200 }}>
                {adSet.name || '—'}
              </p>
              {adSet.audienceType && (
                <p className="text-xs mt-0.5 capitalize" style={{ color: '#a1a1aa' }}>
                  {adSet.audienceType.replace(/_/g, ' ')}
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
        <td className="px-5 py-3.5 text-right text-sm tabular-nums whitespace-nowrap" style={{ color: '#52525b' }}>
          {spend ? formatCurrency(spend) : '—'}
        </td>
        <td className="px-5 py-3.5 text-right text-sm tabular-nums" style={{ color: '#52525b' }}>
          {adSet.impressions ? adSet.impressions.toLocaleString() : '—'}
        </td>
        <td className="px-5 py-3.5 text-right text-sm tabular-nums" style={{ color: '#52525b' }}>
          {adSet.clicks ? adSet.clicks.toLocaleString() : '—'}
        </td>
        <td className="px-5 py-3.5 text-right text-sm tabular-nums whitespace-nowrap" style={{ color: '#52525b' }}>
          {ctr != null ? `${ctr.toFixed(2)}%` : '—'}
        </td>
        <td className="px-5 py-3.5 text-right text-sm tabular-nums whitespace-nowrap" style={{ color: '#52525b' }}>
          {roas != null ? (
            <span className="font-semibold" style={{ color: roas >= 2 ? '#16a34a' : roas >= 1 ? '#d97706' : '#dc2626' }}>
              {roas.toFixed(2)}x
            </span>
          ) : '—'}
        </td>
        <td className="px-5 py-3.5 text-right text-sm tabular-nums whitespace-nowrap" style={{ color: '#52525b' }}>
          {cpa ? formatCurrency(cpa) : '—'}
        </td>
        <td className="px-5 py-3.5 text-right text-sm tabular-nums" style={{ color: '#52525b' }}>
          {frequency?.toFixed(2) || '—'}
        </td>
        <td className="px-5 py-3.5 text-right text-sm tabular-nums" style={{ color: '#52525b' }}>
          {conversions ?? '—'}
        </td>
      </tr>
      {expanded && ads.length > 0 && (
        <tr style={{ background: '#f9fafb' }}>
          <td colSpan={10} className="px-8 py-3">
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
                {typeof action.targetName === 'string' ? action.targetName : JSON.stringify(action.targetName)}
              </span>
            )}
          </div>
          {action.reason && (
            <p className="text-sm leading-relaxed" style={{ color: '#52525b' }}>
              {typeof action.reason === 'string' ? action.reason : JSON.stringify(action.reason)}
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
  // Approval flow
  const [accountIds, setAccountIds] = useState<string[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [creativePackage, setCreativePackage] = useState<CreativePackage | null>(null)
  const [creativeLoading, setCreativeLoading] = useState(false)
  const [videoExpanded, setVideoExpanded] = useState(false)
  const [imageRetryState, setImageRetryState] = useState<'idle' | 'loading' | 'polling'>('idle')
  const [videoRetryState, setVideoRetryState] = useState<'idle' | 'loading' | 'polling'>('idle')
  const [auditSnapshots, setAuditSnapshots] = useState<AuditSnapshot[]>([])
  const [auditLoading, setAuditLoading] = useState(false)

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function pollCreativePackage(pkgId: string, waitFor: 'imageUrl' | 'videoUrl', onDone: () => void) {
    const MAX = 60, INTERVAL = 3000
    let attempts = 0
    const timer = setInterval(async () => {
      attempts++
      try {
        const res = await fetch(`${API_BASE}/creative/${tenantId}/packages/${pkgId}`)
        if (res.ok) {
          const pkg = await res.json()
          if (pkg[waitFor]) {
            setCreativePackage(pkg)
            onDone()
            clearInterval(timer)
          }
        }
      } catch { /* keep polling */ }
      if (attempts >= MAX) { onDone(); clearInterval(timer) }
    }, INTERVAL)
  }

  async function retryImage() {
    const pkgId = campaign?.creativePackageId
    if (!pkgId) return
    setImageRetryState('loading')
    try {
      const res = await fetch(`${API_BASE}/creative/${tenantId}/packages/${pkgId}/regenerate-image`, { method: 'POST' })
      if (!res.ok) throw new Error()
      setImageRetryState('polling')
      pollCreativePackage(pkgId, 'imageUrl', () => setImageRetryState('idle'))
    } catch {
      setImageRetryState('idle')
      showToast('Failed to start image regeneration', 'error')
    }
  }

  async function retryVideo() {
    const pkgId = campaign?.creativePackageId
    if (!pkgId) return
    setVideoRetryState('loading')
    try {
      const res = await fetch(`${API_BASE}/creative/${tenantId}/packages/${pkgId}/regenerate-video`, { method: 'POST' })
      if (!res.ok) throw new Error()
      setVideoRetryState('polling')
      pollCreativePackage(pkgId, 'videoUrl', () => setVideoRetryState('idle'))
    } catch {
      setVideoRetryState('idle')
      showToast('Failed to start video regeneration', 'error')
    }
  }

  async function fetchCampaign() {
    try {
      const res = await fetch(`${API_BASE}/campaigns/${tenantId}/${campaignId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: Campaign = await res.json()
      setCampaign(data)
      setError(null)

      if (data.status === 'pending_approval') {
        // Fetch accountIds from company
        fetch(`${API_BASE}/companies/${tenantId}`)
          .then(r => r.ok ? r.json() : null)
          .then(company => {
            const ids: string[] = company?.meta?.accountIds || []
            setAccountIds(ids)
            if (ids.length > 0 && !selectedAccountId) setSelectedAccountId(ids[0])
          })
          .catch(() => {})

        // Fetch creative package
        if (data.creativePackageId) {
          setCreativeLoading(true)
          fetch(`${API_BASE}/creative/${tenantId}/packages/${data.creativePackageId}`)
            .then(r => r.ok ? r.json() : null)
            .then(pkg => { if (pkg) setCreativePackage(pkg) })
            .catch(() => {})
            .finally(() => setCreativeLoading(false))
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaign')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCampaign()
    // Fetch audit snapshots (non-blocking)
    setAuditLoading(true)
    fetch(`${API_BASE}/campaigns/${tenantId}/${campaignId}/audit-snapshots`)
      .then(r => r.ok ? r.json() : [])
      .then((data: AuditSnapshot[]) => setAuditSnapshots(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setAuditLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, campaignId])

  async function handlePause() {
    const reason = window.prompt('Reason for pausing this campaign?', 'Manual pause')
    if (!reason || !reason.trim()) return
    setPauseState('loading')
    try {
      const res = await fetch(`${API_BASE}/campaigns/${tenantId}/${campaignId}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
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
    if (!selectedAccountId) {
      showToast('Please select a Meta ad account first', 'error')
      return
    }
    setApproveState('loading')
    try {
      const res = await fetch(`${API_BASE}/campaigns/${tenantId}/${campaignId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: selectedAccountId.startsWith('act_') ? selectedAccountId : `act_${selectedAccountId}` }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const result = await res.json()
      setApproveState('success')
      showToast(`Campaign approved! Meta ID: ${result.metaCampaignId || 'assigned'}`, 'success')
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

  // Live ad sets — metaAdSets is the synced live data; adSets is legacy/empty fallback
  const liveAdSets = (campaign.metaAdSets && campaign.metaAdSets.length > 0)
    ? campaign.metaAdSets
    : (campaign.adSets || [])
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
            <div className="flex items-center gap-4 text-xs flex-wrap mt-2" style={{ color: '#a1a1aa' }}>
              {campaign.launchedAt && (
                <span className="flex items-center gap-1">
                  <Clock size={10} />
                  Launched: <span style={{ color: '#52525b' }}>{formatDate(campaign.launchedAt)}</span>
                </span>
              )}
              {campaign.approvedAt && (
                <span>
                  Approved: <span style={{ color: '#52525b' }}>{formatDate(campaign.approvedAt)}</span>
                </span>
              )}
              {campaign.lastAuditedAt && (
                <span className="flex items-center gap-1">
                  <Shield size={10} />
                  Last audited: <span style={{ color: '#52525b' }}>{formatDateTime(campaign.lastAuditedAt)}</span>
                </span>
              )}
              {campaign.metaAccountId && (
                <span className="flex items-center gap-1">
                  <span style={{ color: '#a1a1aa' }}>Meta acct:</span>
                  <code className="font-mono" style={{ color: '#52525b' }}>act_{campaign.metaAccountId}</code>
                </span>
              )}
              {campaign.syncedAt && (
                <span className="flex items-center gap-1">
                  <RefreshCw size={10} />
                  Synced: <span style={{ color: '#52525b' }}>{formatDate(campaign.syncedAt)}</span>
                </span>
              )}
              {campaign.runId && (
                <Link
                  href={`/dashboard/${tenantId}/runs/${campaign.runId}`}
                  className="font-medium transition-colors hover:text-sky-500"
                  style={{ color: '#0284c7' }}
                >
                  View Run →
                </Link>
              )}
            </div>
          </div>

          {/* Action Buttons — non-pending statuses only */}
          <div className="flex items-center gap-2 flex-wrap">
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


        {/* Budget + spend summary */}
        {campaign.budget && campaign.budget > 0 && (
          <div className="mt-5 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4" style={{ background: '#fafafa', border: '1px solid #e4e4e7' }}>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide mb-1" style={{ color: '#a1a1aa' }}>Daily Budget</p>
              <p className="text-sm font-semibold tabular-nums" style={{ color: '#18181b' }}>{formatCurrency(campaign.budget)}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide mb-1" style={{ color: '#a1a1aa' }}>Total Spend</p>
              <p className="text-sm font-semibold tabular-nums" style={{ color: '#18181b' }}>{formatCurrency(campaign.spend || 0)}</p>
            </div>
            {campaign.spend != null && campaign.launchedAt && (() => {
              const days = Math.max(1, Math.round((Date.now() - new Date(campaign.launchedAt).getTime()) / 86400000))
              const dailyAvg = campaign.spend / days
              return (
                <>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide mb-1" style={{ color: '#a1a1aa' }}>Avg Daily Spend</p>
                    <p className="text-sm font-semibold tabular-nums" style={{
                      color: dailyAvg > campaign.budget * 1.1 ? '#b91c1c' : dailyAvg > campaign.budget * 0.9 ? '#d97706' : '#16a34a'
                    }}>{formatCurrency(dailyAvg)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide mb-1" style={{ color: '#a1a1aa' }}>Days Running</p>
                    <p className="text-sm font-semibold tabular-nums" style={{ color: '#18181b' }}>{days}d</p>
                  </div>
                </>
              )
            })()}
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

        {/* Last audit insight strip */}
        {auditSnapshots.length > 0 && (() => {
          const latest = auditSnapshots[0]
          const v = latest.verdict
          const verdictStyle = v.verdict === 'act'
            ? { bg: '#fee2e2', border: '#fecaca', dot: '#dc2626', text: '#b91c1c', label: 'Act Now' }
            : v.verdict === 'watch'
            ? { bg: '#fffbeb', border: '#fde68a', dot: '#f59e0b', text: '#92400e', label: 'Watch' }
            : { bg: '#f0fdf4', border: '#bbf7d0', dot: '#16a34a', text: '#14532d', label: 'All Good' }
          const urgencyLabel = v.urgency === 'immediate' ? 'Immediate' : v.urgency === '48h' ? 'Within 48h' : v.urgency === '7d' ? 'Within 7 days' : null
          return (
            <div className="mt-4 rounded-xl px-4 py-3 flex items-start gap-3" style={{ background: verdictStyle.bg, border: `1px solid ${verdictStyle.border}` }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: verdictStyle.border }}>
                <Shield size={13} style={{ color: verdictStyle.dot }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="flex items-center gap-1 text-xs font-bold" style={{ color: verdictStyle.text }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: verdictStyle.dot }} />
                    {verdictStyle.label}
                  </span>
                  {urgencyLabel && (
                    <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: verdictStyle.border, color: verdictStyle.text }}>
                      {urgencyLabel}
                    </span>
                  )}
                  <span className="text-[11px]" style={{ color: '#a1a1aa' }}>
                    Last audit · {formatDateTime(latest.auditedAt)}
                  </span>
                </div>
                {v.contextInsight && (
                  <p className="text-sm leading-relaxed" style={{ color: verdictStyle.text }}>{v.contextInsight}</p>
                )}
                {v.recommendedActions && v.recommendedActions.length > 0 && (
                  <ul className="mt-1.5 flex flex-col gap-0.5">
                    {v.recommendedActions.map((a, i) => {
                      const text = typeof a === 'string' ? a : (a.reason ?? a.targetName ?? a.type ?? '')
                      return (
                        <li key={i} className="text-xs flex items-start gap-1.5" style={{ color: verdictStyle.text }}>
                          <ChevronRight size={10} className="mt-0.5 shrink-0" /> {text}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>
          )
        })()}
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

      {/* ===== CREATIVE PACKAGE (all statuses) ===== */}
      {campaign.creativePackageId && campaign.status !== 'pending_approval' && (
        <div className="rounded-xl mb-5 overflow-hidden" style={{ border: '1px solid #e4e4e7', background: '#fff' }}>
          <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #f4f4f5', background: '#fafafa' }}>
            <ImageIcon size={13} style={{ color: '#52525b' }} />
            <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#52525b' }}>Creative Package</h2>
          </div>
          <div className="px-5 py-4 space-y-4">
            {/* Image */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#71717a' }}>Image</p>
                <button
                  onClick={retryImage}
                  disabled={imageRetryState !== 'idle'}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-60"
                  style={{ background: '#f4f4f5', color: '#52525b', border: '1px solid #e4e4e7' }}
                >
                  <RefreshCw size={11} className={imageRetryState !== 'idle' ? 'animate-spin' : ''} />
                  {imageRetryState === 'idle' ? 'Retry' : imageRetryState === 'loading' ? 'Starting…' : 'Generating…'}
                </button>
              </div>
              {creativeLoading ? (
                <div className="flex items-center gap-2 text-xs" style={{ color: '#a1a1aa' }}><Loader2 size={12} className="animate-spin" /> Loading…</div>
              ) : creativePackage?.imageUrl ? (
                <img src={creativePackage.imageUrl} alt="Campaign creative" className="rounded-xl object-cover" style={{ maxHeight: 280, maxWidth: '100%', border: '1px solid #e4e4e7' }} />
              ) : (
                <div className="rounded-xl flex items-center justify-center" style={{ height: 100, background: '#f4f4f5', border: '1px dashed #d4d4d8' }}>
                  <p className="text-xs" style={{ color: '#a1a1aa' }}>{imageRetryState === 'polling' ? 'Generating image…' : 'No image yet'}</p>
                </div>
              )}
              {creativePackage?.imagePrompt && (
                <details className="mt-2">
                  <summary className="text-xs cursor-pointer" style={{ color: '#71717a' }}>View prompt</summary>
                  <p className="text-xs mt-1 font-mono leading-relaxed p-3 rounded-lg" style={{ background: '#f4f4f5', color: '#52525b' }}>{creativePackage.imagePrompt}</p>
                </details>
              )}
            </div>

            {/* Video */}
            {(creativePackage?.videoPrompt || creativePackage?.videoUrl) && (
              <div style={{ borderTop: '1px solid #f4f4f5', paddingTop: 16 }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#71717a' }}>Video</p>
                  <button
                    onClick={retryVideo}
                    disabled={videoRetryState !== 'idle'}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-60"
                    style={{ background: '#f4f4f5', color: '#52525b', border: '1px solid #e4e4e7' }}
                  >
                    <RefreshCw size={11} className={videoRetryState !== 'idle' ? 'animate-spin' : ''} />
                    {videoRetryState === 'idle' ? 'Retry' : videoRetryState === 'loading' ? 'Starting…' : 'Generating…'}
                  </button>
                </div>
                {creativePackage?.videoUrl ? (
                  <video controls className="rounded-xl w-full" style={{ maxHeight: 300, border: '1px solid #e4e4e7' }}>
                    <source src={creativePackage.videoUrl} />
                  </video>
                ) : (
                  <p className="text-xs font-mono leading-relaxed p-3 rounded-lg" style={{ background: '#f4f4f5', color: '#52525b', border: '1px solid #e4e4e7' }}>
                    {videoRetryState === 'polling' ? 'Generating video…' : creativePackage?.videoPrompt}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== APPROVAL PANEL (pending_approval only) ===== */}
      {campaign.status === 'pending_approval' && (
        <div className="rounded-xl overflow-hidden mb-5" style={{ border: '2px solid #bbf7d0', background: '#f0fdf4' }}>
          {/* Panel header */}
          <div className="px-5 py-4 flex items-center gap-3" style={{ background: '#dcfce7', borderBottom: '1px solid #bbf7d0' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#15803d' }}>
              <ThumbsUp size={15} color="white" />
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ color: '#14532d' }}>Campaign Awaiting Approval</h2>
              <p className="text-xs mt-0.5" style={{ color: '#166534' }}>Review the creative and configuration below, then select a Meta account to launch.</p>
            </div>
          </div>

          <div className="p-5 flex flex-col gap-6">

            {/* Copy Variants */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#52525b' }}>Copy Variants</h3>
              {creativeLoading ? (
                <div className="flex items-center gap-2 py-4" style={{ color: '#a1a1aa' }}>
                  <Loader2 size={14} className="animate-spin" /><span className="text-sm">Loading creative...</span>
                </div>
              ) : creativePackage?.copyVariants && creativePackage.copyVariants.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {creativePackage.copyVariants.map((v, i) => (
                    <div
                      key={i}
                      className="rounded-xl p-4 flex flex-col gap-2"
                      style={{
                        background: i === (creativePackage.selectedCopyIndex ?? -1) ? '#fff' : '#f9fafb',
                        border: i === (creativePackage.selectedCopyIndex ?? -1) ? '2px solid #15803d' : '1px solid #e4e4e7',
                      }}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        {i === (creativePackage.selectedCopyIndex ?? -1) && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }}>
                            ✓ Selected
                          </span>
                        )}
                        {v.hookStyle && (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#f4f4f5', color: '#71717a', border: '1px solid #e4e4e7' }}>
                            {v.hookStyle}
                          </span>
                        )}
                      </div>
                      {v.headline && (
                        <p className="text-sm font-semibold" style={{ color: '#18181b' }}>{v.headline}</p>
                      )}
                      <p className="text-xs leading-relaxed" style={{ color: '#52525b' }}>{v.primaryText}</p>
                      {v.cta && (
                        <span className="self-start text-xs font-semibold px-2 py-1 rounded-lg" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                          CTA: {v.cta}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm" style={{ color: '#a1a1aa' }}>No copy variants available.</p>
              )}
              {creativePackage?.copySelectionReason && (
                <p className="text-xs mt-2 italic" style={{ color: '#71717a' }}>
                  Selection rationale: {creativePackage.copySelectionReason}
                </p>
              )}
            </div>

            {/* Image */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#52525b' }}>
                  <span className="inline-flex items-center gap-1.5"><ImageIcon size={12} /> Creative Image</span>
                </h3>
                {campaign?.creativePackageId && (
                  <button
                    onClick={retryImage}
                    disabled={imageRetryState !== 'idle'}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-60"
                    style={{ background: '#f4f4f5', color: '#52525b', border: '1px solid #e4e4e7' }}
                  >
                    <RefreshCw size={11} className={imageRetryState !== 'idle' ? 'animate-spin' : ''} />
                    {imageRetryState === 'idle' ? 'Retry' : imageRetryState === 'loading' ? 'Starting…' : 'Generating…'}
                  </button>
                )}
              </div>
              {creativePackage?.imageUrl ? (
                <img
                  src={creativePackage.imageUrl}
                  alt="Campaign creative"
                  className="rounded-xl object-cover"
                  style={{ maxHeight: 280, maxWidth: '100%', border: '1px solid #e4e4e7' }}
                />
              ) : (
                <div className="rounded-xl flex items-center justify-center" style={{ height: 120, background: '#f4f4f5', border: '1px dashed #d4d4d8' }}>
                  <div className="text-center">
                    <ImageIcon size={24} style={{ color: '#d4d4d8', margin: '0 auto 6px' }} />
                    <p className="text-xs" style={{ color: '#a1a1aa' }}>
                      {imageRetryState === 'polling' ? 'Generating image…' : 'Image not yet generated'}
                    </p>
                  </div>
                </div>
              )}
              {creativePackage?.imagePrompt && (
                <details className="mt-2">
                  <summary className="text-xs cursor-pointer" style={{ color: '#71717a' }}>View image prompt</summary>
                  <p className="text-xs mt-1 font-mono leading-relaxed p-3 rounded-lg" style={{ background: '#f4f4f5', color: '#52525b' }}>
                    {creativePackage.imagePrompt}
                  </p>
                </details>
              )}
            </div>

            {/* Video */}
            {(creativePackage?.videoUrl || creativePackage?.videoPrompt) && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: '#52525b' }}>
                    <Video size={12} /> Video
                  </h3>
                  {campaign?.creativePackageId && (
                    <button
                      onClick={retryVideo}
                      disabled={videoRetryState !== 'idle'}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-60"
                      style={{ background: '#f4f4f5', color: '#52525b', border: '1px solid #e4e4e7' }}
                    >
                      <RefreshCw size={11} className={videoRetryState !== 'idle' ? 'animate-spin' : ''} />
                      {videoRetryState === 'idle' ? 'Retry' : videoRetryState === 'loading' ? 'Starting…' : 'Generating…'}
                    </button>
                  )}
                </div>
                {creativePackage.videoUrl ? (
                  <video controls className="rounded-xl w-full" style={{ maxHeight: 300, border: '1px solid #e4e4e7' }}>
                    <source src={creativePackage.videoUrl} />
                  </video>
                ) : (
                  <p className="text-xs font-mono leading-relaxed p-3 rounded-lg" style={{ background: '#f4f4f5', color: '#52525b', border: '1px solid #e4e4e7' }}>
                    {videoRetryState === 'polling' ? 'Generating video…' : creativePackage.videoPrompt}
                  </p>
                )}
                {creativePackage.videoPrompt && creativePackage.videoUrl && (
                  <details className="mt-2">
                    <summary className="text-xs cursor-pointer" style={{ color: '#71717a' }}>View video prompt</summary>
                    <p className="text-xs mt-1 font-mono leading-relaxed p-3 rounded-lg" style={{ background: '#f4f4f5', color: '#52525b' }}>{creativePackage.videoPrompt}</p>
                  </details>
                )}
              </div>
            )}

            {/* Compliance notes */}
            {creativePackage?.complianceNotes && (
              <div className="rounded-lg px-3 py-2.5" style={{ background: '#fef3c7', border: '1px solid #fde68a' }}>
                <p className="text-xs font-semibold mb-1" style={{ color: '#b45309' }}>⚠ Compliance Notes</p>
                <p className="text-xs leading-relaxed" style={{ color: '#92400e' }}>{creativePackage.complianceNotes}</p>
              </div>
            )}

            {/* Review debate (rationale) */}
            {reviewDebateLog.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#52525b' }}>Review Team Debate</h3>
                <DebateLog rounds={reviewDebateLog} />
              </div>
            )}

            {/* Account selector + approve/reject */}
            <div className="rounded-xl p-4 flex flex-col gap-4" style={{ background: '#ffffff', border: '1px solid #bbf7d0' }}>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#14532d' }}>
                  Meta Ad Account
                </label>
                {accountIds.length === 0 ? (
                  <p className="text-xs" style={{ color: '#a1a1aa' }}>No ad accounts found. Check company Meta settings.</p>
                ) : (
                  <div className="relative">
                    <select
                      value={selectedAccountId}
                      onChange={e => setSelectedAccountId(e.target.value)}
                      className="w-full rounded-lg px-3 py-2.5 text-sm appearance-none pr-8"
                      style={{ background: '#f9fafb', border: '1px solid #d1d5db', color: '#18181b' }}
                    >
                      {accountIds.map(id => (
                        <option key={id} value={id}>act_{id}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#71717a' }} />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleApprove}
                  disabled={approveState !== 'idle' || !selectedAccountId}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all"
                  style={
                    approveState === 'success'
                      ? { background: '#15803d', color: '#fff' }
                      : approveState !== 'idle' || !selectedAccountId
                      ? { background: '#dcfce7', color: '#86efac', cursor: 'not-allowed' }
                      : { background: '#15803d', color: '#fff', boxShadow: '0 2px 8px rgba(21,128,61,0.3)' }
                  }
                >
                  {approveState === 'loading' ? <Loader2 size={15} className="animate-spin" /> :
                   approveState === 'success' ? <CheckCircle size={15} /> :
                   <ThumbsUp size={15} />}
                  {approveState === 'loading' ? 'Launching on Meta...' :
                   approveState === 'success' ? 'Approved & Launched!' :
                   'Approve & Launch on Meta'}
                </button>
                <button
                  onClick={() => setRejectOpen(o => !o)}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
                  style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#b91c1c' }}
                >
                  <XCircle size={14} className="inline mr-1.5" />Reject
                </button>
              </div>

              {/* Reject form */}
              {rejectOpen && (
                <div className="flex flex-col gap-2 pt-2" style={{ borderTop: '1px solid #fecaca' }}>
                  <p className="text-xs font-semibold" style={{ color: '#b91c1c' }}>Reason for rejection</p>
                  <textarea
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="Describe why this campaign is being rejected..."
                    rows={3}
                    className="w-full rounded-lg px-3 py-2 text-sm resize-none"
                    style={{ background: '#fff', border: '1px solid #fecaca', color: '#18181b' }}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleReject}
                      disabled={rejectState === 'loading' || !rejectReason.trim()}
                      className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ background: '#b91c1c', color: '#fff' }}
                    >
                      {rejectState === 'loading' ? 'Rejecting...' : 'Confirm Reject'}
                    </button>
                    <button
                      onClick={() => { setRejectOpen(false); setRejectReason('') }}
                      className="text-xs transition-colors"
                      style={{ color: '#a1a1aa' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
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
                    {['Ad Set', 'Status', 'Spend', 'Impr.', 'Clicks', 'CTR', 'ROAS', 'CPA', 'Freq.', 'Conv.'].map((h, i) => (
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

      {/* ── Audit History ─────────────────────────────────────────── */}
      {(auditLoading || auditSnapshots.length > 0) && (
        <div className="rounded-xl overflow-hidden mb-5" style={sectionStyle}>
          <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: '1px solid #f0f0f1' }}>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: '#f0f9ff' }}>
                <Activity size={12} style={{ color: '#0284c7' }} />
              </div>
              <h2 className="text-sm font-semibold" style={{ color: '#18181b' }}>Audit History</h2>
              {auditSnapshots.length > 0 && (
                <span className="text-[11px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: '#f1f5f9', color: '#64748b' }}>
                  {auditSnapshots.length} snapshots
                </span>
              )}
            </div>
          </div>

          {auditLoading ? (
            <div className="flex items-center justify-center py-10 gap-2" style={{ color: '#a1a1aa' }}>
              <Loader2 size={14} className="animate-spin" /><span className="text-sm">Loading audit history…</span>
            </div>
          ) : (
            <div className="p-5 space-y-5">

              {/* Trend sparklines */}
              {auditSnapshots.length >= 3 && (() => {
                const roasData  = auditSnapshots.map(s => s.metrics.roas  ?? 0).reverse()
                const spendData = auditSnapshots.map(s => s.metrics.spend ?? 0).reverse()
                return (
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'ROAS Trend', data: roasData,  color: '#16a34a', unit: 'x', icon: TrendingUp },
                      { label: 'Spend Trend', data: spendData, color: '#0284c7', unit: '$', icon: DollarSign },
                    ].map(({ label, data, color, unit, icon: Icon }) => {
                      const latest = data[data.length - 1]
                      const prev   = data[data.length - 2] ?? latest
                      const delta  = prev !== 0 ? ((latest - prev) / prev) * 100 : 0
                      const min = Math.min(...data), max = Math.max(...data)
                      const range = max - min || 1
                      const W = 160, H = 44
                      const pts = data.map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * H}`).join(' ')
                      return (
                        <div key={label} className="rounded-xl p-4" style={{ background: '#fafafa', border: '1px solid #e4e4e7' }}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1.5">
                              <Icon size={12} style={{ color }} />
                              <p className="text-xs font-semibold" style={{ color: '#52525b' }}>{label}</p>
                            </div>
                            <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full" style={{
                              background: delta >= 0 ? '#dcfce7' : '#fee2e2',
                              color: delta >= 0 ? '#16a34a' : '#dc2626',
                            }}>
                              {delta >= 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex items-end gap-4">
                            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none" className="shrink-0">
                              <polyline points={pts} stroke={color} strokeWidth={1.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
                              {/* latest dot */}
                              {data.length > 0 && (() => {
                                const lx = W, ly = H - ((latest - min) / range) * H
                                return <circle cx={lx} cy={ly} r={3} fill={color} />
                              })()}
                            </svg>
                            <div>
                              <p className="text-lg font-bold tabular-nums leading-none" style={{ color }}>
                                {unit === '$' ? formatCurrency(latest) : `${latest.toFixed(2)}x`}
                              </p>
                              <p className="text-[11px] mt-0.5" style={{ color: '#a1a1aa' }}>Latest</p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}

              {/* Verdict timeline */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#a1a1aa' }}>Verdict Timeline</p>
                <div className="space-y-0">
                  {auditSnapshots.slice(0, 15).map((snap, i) => {
                    const v = snap.verdict
                    const verdictColor = v.verdict === 'act' ? '#dc2626' : v.verdict === 'watch' ? '#f59e0b' : '#16a34a'
                    const verdictBg    = v.verdict === 'act' ? '#fee2e2' : v.verdict === 'watch' ? '#fef3c7' : '#dcfce7'
                    const verdictLabel = v.verdict === 'act' ? 'Act' : v.verdict === 'watch' ? 'Watch' : 'OK'
                    const urgencyLabel = v.urgency === 'immediate' ? '• Immediate'
                      : v.urgency === '48h' ? '• 48h'
                      : v.urgency === '7d'  ? '• 7d'
                      : ''
                    return (
                      <div
                        key={i}
                        className="flex items-start gap-3 py-3"
                        style={{ borderBottom: i < Math.min(auditSnapshots.length, 15) - 1 ? '1px solid #f4f4f5' : 'none' }}
                      >
                        {/* Timeline dot */}
                        <div className="flex flex-col items-center shrink-0 mt-0.5">
                          <div className="w-2 h-2 rounded-full" style={{ background: verdictColor }} />
                          {i < Math.min(auditSnapshots.length, 15) - 1 && (
                            <div className="w-px flex-1 mt-1" style={{ background: '#e4e4e7', minHeight: 16 }} />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span
                              className="text-[11px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{ background: verdictBg, color: verdictColor }}
                            >
                              {verdictLabel}{urgencyLabel}
                            </span>
                            <span className="text-[11px]" style={{ color: '#a1a1aa' }}>
                              {formatDateTime(snap.auditedAt)}
                            </span>
                            {snap.metrics.roas != null && (
                              <span className="text-[11px] tabular-nums" style={{ color: '#52525b' }}>
                                ROAS {snap.metrics.roas.toFixed(2)}x
                              </span>
                            )}
                            {snap.metrics.spend != null && (
                              <span className="text-[11px] tabular-nums" style={{ color: '#71717a' }}>
                                · {formatCurrency(snap.metrics.spend)} spent
                              </span>
                            )}
                          </div>
                          {v.contextInsight && (
                            <p className="text-xs leading-relaxed" style={{ color: '#52525b' }}>{v.contextInsight}</p>
                          )}
                          {v.recommendedActions && v.recommendedActions.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {v.recommendedActions.map((a, j) => {
                                const text = typeof a === 'string' ? a : (a.reason ?? a.targetName ?? a.type ?? '')
                                return (
                                  <span key={j} className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: '#f4f4f5', color: '#71717a' }}>
                                    {text}
                                  </span>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
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
