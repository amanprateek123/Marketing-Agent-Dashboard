'use client'

import { useState, useEffect, useCallback, use } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Loader2,
  Star,
  Image as ImageIcon,
  Video,
  Sparkles,
  Copy,
  AlertCircle,
  ThumbsUp,
  XCircle,
  ChevronDown,
} from 'lucide-react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { DebateLog } from '@/components/ui/DebateLog'
import { CollapsibleSection } from '@/components/ui/CollapsibleSection'
import { formatCurrency, formatDateTime, cn } from '@/lib/utils'
import type { FullRunData, PipelineRun, IntelligenceBrief, CopyVariant, Campaign } from '@/types'

const API_BASE = 'http://localhost:8082/api/v1'

interface PageProps {
  params: Promise<{ tenantId: string; runId: string }>
}

// ── Phase stepper ─────────────────────────────────────────────────────────────

const PHASES = [
  { key: 'scouts', label: 'Scouts' },
  { key: 'intelligence', label: 'Intelligence' },
  { key: 'ideas', label: 'Ideas' },
  { key: 'creative', label: 'Creative' },
  { key: 'campaign', label: 'Campaign' },
]

function getPhaseIndex(status: string): number {
  const s = (status || '').toLowerCase()
  if (s === 'scouts_running') return 0
  if (s === 'intelligence_running' || s === 'idea_pool_running') return 1
  if (s === 'creative_running') return 3
  if (s === 'campaign_launching') return 4
  if (s === 'completed') return 5
  return -1
}

function PhaseProgress({ status }: { status: string }) {
  const currentPhaseIdx = getPhaseIndex(status)
  return (
    <div className="flex items-center gap-0 mt-4">
      {PHASES.map((phase, idx) => {
        const done = currentPhaseIdx > idx
        const active = currentPhaseIdx === idx
        const isLast = idx === PHASES.length - 1
        return (
          <div key={phase.key} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1.5 min-w-[60px]">
              <div
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all',
                  done
                    ? 'border-green-500 bg-green-500'
                    : active
                    ? 'border-sky-500 bg-sky-50 animate-pulse'
                    : 'border-zinc-200 bg-white'
                )}
              >
                {done ? (
                  <CheckCircle2 size={14} className="text-white" />
                ) : active ? (
                  <Loader2 size={13} className="text-sky-500 animate-spin" />
                ) : (
                  <Circle size={13} className="text-zinc-300" />
                )}
              </div>
              <span
                className={cn(
                  'text-xs font-medium whitespace-nowrap',
                  done ? 'text-green-700' : active ? 'text-sky-600' : 'text-zinc-400'
                )}
              >
                {phase.label}
              </span>
            </div>
            {!isLast && (
              <div
                className={cn('flex-1 h-0.5 mx-1 mb-4', done ? 'bg-green-300' : 'bg-zinc-200')}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Score badge ───────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score?: number }) {
  if (score === undefined || score === null) return null
  const style =
    score >= 8
      ? { background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }
      : score >= 6
      ? { background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }
      : { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' }
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={style}>
      {score.toFixed(1)}
    </span>
  )
}

// ── Idea card ─────────────────────────────────────────────────────────────────

function IdeaCard({
  brief,
  isWinner,
  onProduce,
  producing,
}: {
  brief: IntelligenceBrief
  isWinner: boolean
  onProduce?: () => void
  producing?: boolean
}) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3 transition-all"
      style={
        isWinner
          ? {
              background: '#fffbeb',
              border: '2px solid #fbbf24',
              boxShadow: '0 2px 8px rgba(251,191,36,0.12)',
            }
          : {
              background: '#fafafa',
              border: '1px solid #e4e4e7',
            }
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {isWinner && (
              <span
                className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}
              >
                <Star size={10} fill="currentColor" /> Selected
              </span>
            )}
            <ScoreBadge score={brief.finalScore} />
          </div>
          <h4 className="text-sm font-semibold leading-snug" style={{ color: '#18181b' }}>
            {brief.topic}
          </h4>
        </div>
      </div>
      {brief.angle && (
        <p className="text-xs leading-relaxed" style={{ color: '#71717a' }}>
          {brief.angle}
        </p>
      )}
      {brief.hook && (
        <p className="text-xs italic leading-relaxed" style={{ color: '#0284c7' }}>
          &ldquo;{brief.hook}&rdquo;
        </p>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        {brief.platform && (
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: '#f4f4f5', color: '#71717a', border: '1px solid #e4e4e7' }}
          >
            {brief.platform}
          </span>
        )}
        {brief.format && (
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: '#f4f4f5', color: '#71717a', border: '1px solid #e4e4e7' }}
          >
            {brief.format}
          </span>
        )}
      </div>
      {!isWinner && onProduce && (
        <button
          onClick={onProduce}
          disabled={producing}
          className="mt-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            background: '#f4f4f5',
            border: '1px solid #e4e4e7',
            color: '#52525b',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLElement).style.background = '#e0f2fe'
            ;(e.currentTarget as HTMLElement).style.color = '#0284c7'
            ;(e.currentTarget as HTMLElement).style.borderColor = '#bae6fd'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLElement).style.background = '#f4f4f5'
            ;(e.currentTarget as HTMLElement).style.color = '#52525b'
            ;(e.currentTarget as HTMLElement).style.borderColor = '#e4e4e7'
          }}
        >
          {producing ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
          {producing ? 'Producing...' : 'Produce This'}
        </button>
      )}
    </div>
  )
}

// ── Copy variant card ─────────────────────────────────────────────────────────

function CopyVariantCard({ variant, isSelected }: { variant: CopyVariant; isSelected: boolean }) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3"
      style={
        isSelected
          ? {
              background: '#f0f9ff',
              border: '2px solid #0284c7',
              boxShadow: '0 2px 8px rgba(2,132,199,0.1)',
            }
          : {
              background: '#fafafa',
              border: '1px solid #e4e4e7',
            }
      }
    >
      {isSelected && (
        <span
          className="self-start text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe' }}
        >
          Selected
        </span>
      )}
      {variant.hookStyle && (
        <span
          className="self-start text-xs px-2 py-0.5 rounded-full"
          style={{ background: '#f4f4f5', color: '#71717a', border: '1px solid #e4e4e7' }}
        >
          {variant.hookStyle}
        </span>
      )}
      {variant.headline && (
        <h4 className="text-sm font-semibold" style={{ color: '#18181b' }}>
          {variant.headline}
        </h4>
      )}
      <p className="text-sm leading-relaxed" style={{ color: '#52525b' }}>
        {variant.primaryText}
      </p>
      {variant.cta && (
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: '#a1a1aa' }}>CTA:</span>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded"
            style={{ background: '#dbeafe', color: '#1d4ed8' }}
          >
            {variant.cta}
          </span>
        </div>
      )}
    </div>
  )
}

// ── Platform icon ─────────────────────────────────────────────────────────────

function platformConfig(platform: string): {
  emoji: string
  textColor: string
  bg: string
  border: string
} {
  switch (platform) {
    case 'instagram':
      return { emoji: '📸', textColor: '#be185d', bg: '#fdf2f8', border: '#fbcfe8' }
    case 'reddit':
      return { emoji: '🗨️', textColor: '#c2410c', bg: '#fff7ed', border: '#fed7aa' }
    case 'twitter':
      return { emoji: '🐦', textColor: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' }
    case 'youtube':
      return { emoji: '📺', textColor: '#b91c1c', bg: '#fef2f2', border: '#fecaca' }
    default:
      return { emoji: '📡', textColor: '#71717a', bg: '#f4f4f5', border: '#e4e4e7' }
  }
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RunDetailPage({ params }: PageProps) {
  const resolvedParams = use(params)
  const { tenantId, runId } = resolvedParams

  const [data, setData] = useState<FullRunData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [producingBrief, setProducingBrief] = useState<string | null>(null)
  const [approveState, setApproveState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectState, setRejectState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [researchExpanded, setResearchExpanded] = useState<Record<number, boolean>>({})

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const fetchFull = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/pipeline/${tenantId}/runs/${runId}/full`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const fullData: FullRunData = await res.json()
      setData(fullData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load run data')
    } finally {
      setLoading(false)
    }
  }, [tenantId, runId])

  const fetchStatusOnly = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/pipeline/${tenantId}/runs/${runId}`)
      if (!res.ok) return
      const run: PipelineRun = await res.json()
      const done = run.status === 'completed' || run.status === 'failed'
      if (done) {
        fetchFull()
      } else {
        setData((prev) => (prev ? { ...prev, run } : prev))
      }
    } catch {
      // ignore polling errors
    }
  }, [tenantId, runId, fetchFull])

  useEffect(() => {
    fetchFull()
  }, [fetchFull])

  useEffect(() => {
    if (!data?.run) return
    const done = data.run.status === 'completed' || data.run.status === 'failed'
    if (done) return
    const interval = setInterval(fetchStatusOnly, 10000)
    return () => clearInterval(interval)
  }, [data?.run, fetchStatusOnly])

  async function handleProduce(briefId: string) {
    if (!window.confirm('Are you sure you want to produce this brief?')) return
    setProducingBrief(briefId)
    try {
      const res = await fetch(`${API_BASE}/pipeline/${tenantId}/runs/${runId}/produce/${briefId}`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      showToast('Production started!', 'success')
      fetchFull()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to produce', 'error')
    } finally {
      setProducingBrief(null)
    }
  }

  async function handleApprove() {
    const campaign = data?.campaign
    if (!campaign) return
    const campaignId = campaign._id
    if (!campaignId) return
    setApproveState('loading')
    try {
      const res = await fetch(`${API_BASE}/campaigns/${tenantId}/${campaignId}/approve`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setApproveState('success')
      showToast('Campaign approved and launching!', 'success')
      fetchFull()
    } catch (err) {
      setApproveState('error')
      showToast(err instanceof Error ? err.message : 'Approval failed', 'error')
      setTimeout(() => setApproveState('idle'), 3000)
    }
  }

  async function handleReject() {
    const campaign = data?.campaign
    if (!campaign) return
    const campaignId = campaign._id
    if (!campaignId) return
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
      fetchFull()
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
          <p className="text-sm" style={{ color: '#71717a' }}>Loading pipeline run...</p>
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div
          className="rounded-xl p-5"
          style={{ background: '#fee2e2', border: '1px solid #fecaca' }}
        >
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle size={18} style={{ color: '#b91c1c' }} />
            <h3 className="text-sm font-semibold" style={{ color: '#b91c1c' }}>
              Failed to Load Run
            </h3>
          </div>
          <p className="text-sm" style={{ color: '#7f1d1d' }}>
            {error}
          </p>
        </div>
      </div>
    )
  }

  const run = data?.run
  const scouts = data?.scouts || []
  const coordinator = data?.coordinator
  const research = data?.research || []
  const briefs = (data?.briefs || []).slice().sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0))
  const creativeBrief = data?.creativeBrief
  const creativePackage = data?.creativePackage
  const campaign = data?.campaign
  const copyVariants: CopyVariant[] = creativePackage?.copyVariants || []
  const selectedCopyIndex = creativePackage?.selectedCopyIndex

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
          href={`/dashboard/${tenantId}/runs`}
          className="inline-flex items-center gap-1.5 text-sm transition-colors"
          style={{ color: '#71717a' }}
        >
          <ArrowLeft size={14} /> Back to Runs
        </Link>
      </div>

      {/* ===== SECTION A: RUN HEADER ===== */}
      <div className="rounded-xl p-5 mb-5" style={sectionStyle}>
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-lg font-bold" style={{ color: '#18181b' }}>Pipeline Run</h1>
              {run && <StatusBadge status={run.status} />}
            </div>
            <p className="text-xs font-mono mb-3" style={{ color: '#a1a1aa' }}>
              {runId.slice(0, 8)}
            </p>
            <div className="flex items-center gap-4 text-xs flex-wrap" style={{ color: '#a1a1aa' }}>
              {run?.startedAt && (
                <span>
                  Started:{' '}
                  <span style={{ color: '#52525b' }}>{formatDateTime(run.startedAt)}</span>
                </span>
              )}
              {run?.completedAt && (
                <span>
                  Completed:{' '}
                  <span style={{ color: '#52525b' }}>{formatDateTime(run.completedAt)}</span>
                </span>
              )}
            </div>
          </div>
        </div>
        {run && <PhaseProgress status={run.status} />}
      </div>

      {/* ===== SECTION B: SIGNAL SCOUTS ===== */}
      <CollapsibleSection
        title="Signal Scouts"
        defaultOpen={true}
        badge={scouts.length || undefined}
        className="mb-5"
      >
        <div className="flex flex-col gap-4">
          {scouts.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: '#a1a1aa' }}>
              No scout data available yet.
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {scouts.map((scout) => {
                const cfg = platformConfig(scout.platform)
                const signalCount =
                  (scout.data?.trending_topics?.length ?? 0) +
                  (scout.data?.viral_trends?.length ?? 0)
                const viralCount = scout.data?.viral_trends?.length ?? 0
                return (
                  <div
                    key={scout.platform}
                    className="rounded-xl p-4 flex flex-col gap-2"
                    style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{cfg.emoji}</span>
                      <span
                        className="text-sm font-semibold capitalize"
                        style={{ color: cfg.textColor }}
                      >
                        {scout.platform}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: '#a1a1aa' }}>Signals</p>
                      <p className="text-xl font-bold" style={{ color: cfg.textColor }}>
                        {signalCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: '#a1a1aa' }}>Viral Trends</p>
                      <p className="text-sm font-semibold" style={{ color: '#52525b' }}>
                        {viralCount}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {coordinator?.topSignals && coordinator.topSignals.length > 0 && (
            <div>
              <h3
                className="text-xs font-semibold uppercase tracking-wider mb-3"
                style={{ color: '#a1a1aa' }}
              >
                Top Signals
              </h3>
              <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #e4e4e7' }}>
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #f0f0f1', background: '#fafafa' }}>
                      {['Rank', 'Topic', 'Platforms', 'Score', 'Rationale'].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider"
                          style={{ color: '#a1a1aa' }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {coordinator.topSignals.map((sig, idx) => {
                      const scoreStyle =
                        sig.compositeScore >= 8
                          ? { background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }
                          : sig.compositeScore >= 6
                          ? { background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }
                          : { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' }
                      return (
                        <tr
                          key={idx}
                          className="transition-colors hover:bg-zinc-50"
                          style={{ borderBottom: '1px solid #f4f4f5' }}
                        >
                          <td className="px-4 py-3 text-sm" style={{ color: '#a1a1aa' }}>
                            {idx + 1}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium" style={{ color: '#18181b' }}>
                            {sig.topic}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1 flex-wrap">
                              {sig.platforms.map((p) => (
                                <span
                                  key={p}
                                  className="text-xs px-1.5 py-0.5 rounded"
                                  style={{ background: '#f4f4f5', color: '#71717a' }}
                                >
                                  {p}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="px-2 py-0.5 rounded-full text-xs font-bold"
                              style={scoreStyle}
                            >
                              {sig.compositeScore.toFixed(1)}
                            </span>
                          </td>
                          <td
                            className="px-4 py-3 text-xs max-w-[200px] truncate"
                            style={{ color: '#71717a' }}
                          >
                            {sig.rationale}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* ===== SECTION C: RESEARCH ===== */}
      {research.length > 0 && (
        <CollapsibleSection
          title="Research"
          defaultOpen={false}
          badge={research.length}
          className="mb-5"
        >
          <div className="flex flex-col gap-3">
            {research.map((r, idx) => {
              const isExpanded = researchExpanded[idx] ?? false
              const text = r.content || ''
              const truncated = text.length > 500 ? text.slice(0, 500) + '...' : text
              return (
                <div
                  key={idx}
                  className="rounded-xl p-4"
                  style={{ background: '#fafafa', border: '1px solid #e4e4e7' }}
                >
                  <h4
                    className="text-xs font-semibold uppercase tracking-wider mb-2 capitalize"
                    style={{ color: '#a1a1aa' }}
                  >
                    {r.type} Research
                  </h4>
                  <p
                    className="text-sm leading-relaxed whitespace-pre-wrap"
                    style={{ color: '#52525b' }}
                  >
                    {isExpanded ? text : truncated}
                  </p>
                  {text.length > 500 && (
                    <button
                      onClick={() =>
                        setResearchExpanded((prev) => ({ ...prev, [idx]: !isExpanded }))
                      }
                      className="mt-2 text-xs font-medium transition-colors"
                      style={{ color: '#0284c7' }}
                    >
                      {isExpanded ? 'Show less' : 'Read more'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </CollapsibleSection>
      )}

      {/* ===== SECTION D: STRATEGY TEAM DEBATE ===== */}
      <div className="rounded-xl p-5 mb-5" style={sectionStyle}>
        <div className="flex items-center gap-3 mb-4">
          <div
            className="p-1.5 rounded-lg"
            style={{ background: '#dbeafe', border: '1px solid #bfdbfe' }}
          >
            <Sparkles size={15} style={{ color: '#1d4ed8' }} />
          </div>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: '#18181b' }}>
              Strategy Team &mdash; {briefs.length}{' '}
              {briefs.length === 1 ? 'Idea' : 'Ideas'}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: '#71717a' }}>
              AI-generated campaign ideas ranked by potential
            </p>
          </div>
        </div>

        {briefs.length === 0 ? (
          <div
            className="rounded-lg p-5 text-center"
            style={{ background: '#fafafa', border: '1px solid #e4e4e7' }}
          >
            <p className="text-sm" style={{ color: '#a1a1aa' }}>
              No intelligence briefs available yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
            {briefs.map((brief) => (
              <IdeaCard
                key={brief.briefId}
                brief={brief}
                isWinner={brief.selected === true || brief.briefId === run?.selectedBriefId}
                onProduce={() => handleProduce(brief.briefId)}
                producing={producingBrief === brief.briefId}
              />
            ))}
          </div>
        )}

        {creativeBrief?.debateLog && creativeBrief.debateLog.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 h-px" style={{ background: '#e4e4e7' }} />
              <span className="text-xs font-medium px-2" style={{ color: '#a1a1aa' }}>
                Brief Selection Debate
              </span>
              <div className="flex-1 h-px" style={{ background: '#e4e4e7' }} />
            </div>
            <DebateLog
              rounds={creativeBrief.debateLog}
              rationale={creativeBrief.debateRationale}
            />
          </div>
        )}
      </div>

      {/* ===== SECTION E: CREATIVE OUTPUT ===== */}
      <div className="rounded-xl p-5 mb-5" style={sectionStyle}>
        <div className="flex items-center gap-3 mb-4">
          <div
            className="p-1.5 rounded-lg"
            style={{ background: '#fef3c7', border: '1px solid #fde68a' }}
          >
            <ImageIcon size={15} style={{ color: '#b45309' }} />
          </div>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: '#18181b' }}>
              Creative Output
            </h2>
            <p className="text-xs mt-0.5" style={{ color: '#71717a' }}>
              Copy variants, visuals & compliance
            </p>
          </div>
        </div>

        {!creativePackage ? (
          <div
            className="rounded-lg p-5 text-center"
            style={{ background: '#fafafa', border: '1px solid #e4e4e7' }}
          >
            <p className="text-sm" style={{ color: '#a1a1aa' }}>
              No creative package available yet.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {/* Copy variants */}
            {copyVariants.length > 0 && (
              <div>
                <h3
                  className="text-xs font-semibold uppercase tracking-wider mb-3"
                  style={{ color: '#a1a1aa' }}
                >
                  Copy Variants
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {copyVariants.map((variant, idx) => (
                    <CopyVariantCard
                      key={idx}
                      variant={variant}
                      isSelected={idx === selectedCopyIndex}
                    />
                  ))}
                </div>
                {creativePackage.copySelectionReason && (
                  <p className="mt-2 text-xs italic" style={{ color: '#71717a' }}>
                    {creativePackage.copySelectionReason}
                  </p>
                )}
              </div>
            )}

            {/* Image prompt */}
            {creativePackage.imagePrompt && (
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <ImageIcon size={13} style={{ color: '#a1a1aa' }} />
                    <h3
                      className="text-xs font-semibold uppercase tracking-wider"
                      style={{ color: '#a1a1aa' }}
                    >
                      Image Prompt
                    </h3>
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(creativePackage.imagePrompt || '')}
                    className="flex items-center gap-1 text-xs transition-colors"
                    style={{ color: '#a1a1aa' }}
                  >
                    <Copy size={11} /> Copy
                  </button>
                </div>
                <div
                  className="rounded-lg p-4"
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
                >
                  <p
                    className="text-xs font-mono leading-relaxed"
                    style={{ color: '#475569' }}
                  >
                    {creativePackage.imagePrompt}
                  </p>
                </div>
                {creativePackage.imageUrl ? (
                  <div className="mt-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={creativePackage.imageUrl}
                      alt="Generated creative"
                      className="rounded-lg max-w-full"
                      style={{ border: '1px solid #e4e4e7' }}
                    />
                  </div>
                ) : (
                  <div
                    className="mt-2 h-24 rounded-lg flex items-center justify-center"
                    style={{ background: '#f4f4f5', border: '1px solid #e4e4e7' }}
                  >
                    <p className="text-xs" style={{ color: '#d4d4d8' }}>
                      Image not yet generated
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Video prompt */}
            {creativePackage.videoPrompt && (
              <CollapsibleSection title="Video Prompt">
                <div
                  className="rounded-lg p-4"
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Video size={12} style={{ color: '#a1a1aa' }} />
                    <span
                      className="text-xs font-semibold uppercase tracking-wider"
                      style={{ color: '#a1a1aa' }}
                    >
                      Video Script
                    </span>
                  </div>
                  <p
                    className="text-xs font-mono leading-relaxed"
                    style={{ color: '#475569' }}
                  >
                    {creativePackage.videoPrompt}
                  </p>
                </div>
              </CollapsibleSection>
            )}

            {/* Compliance notes */}
            {creativePackage.complianceNotes && (
              <div
                className="rounded-xl p-4"
                style={{ background: '#fffbeb', border: '1px solid #fde68a' }}
              >
                <p className="text-xs font-semibold mb-1" style={{ color: '#b45309' }}>
                  Compliance Notes
                </p>
                <p className="text-sm leading-relaxed" style={{ color: '#78350f' }}>
                  {creativePackage.complianceNotes}
                </p>
              </div>
            )}

            {/* Creative debate log */}
            {creativePackage.debateLog && creativePackage.debateLog.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 h-px" style={{ background: '#e4e4e7' }} />
                  <span className="text-xs font-medium px-2" style={{ color: '#a1a1aa' }}>
                    Creative Debate
                  </span>
                  <div className="flex-1 h-px" style={{ background: '#e4e4e7' }} />
                </div>
                <DebateLog rounds={creativePackage.debateLog} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== SECTION F: CAMPAIGN REVIEW ===== */}
      <div className="rounded-xl p-5" style={sectionStyle}>
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div
              className="p-1.5 rounded-lg"
              style={{ background: '#dcfce7', border: '1px solid #bbf7d0' }}
            >
              <ChevronDown size={15} style={{ color: '#15803d' }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: '#18181b' }}>
                Campaign Review
              </h2>
              <p className="text-xs mt-0.5" style={{ color: '#71717a' }}>
                Review and approve the generated campaign
              </p>
            </div>
          </div>

          {campaign && campaign.status === 'pending_approval' && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleApprove}
                disabled={approveState !== 'idle'}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                style={
                  approveState !== 'idle'
                    ? { background: '#dcfce7', color: '#86efac', cursor: 'not-allowed' }
                    : {
                        background: '#dcfce7',
                        border: '1px solid #bbf7d0',
                        color: '#15803d',
                      }
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
                  : 'Approve Campaign'}
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
            </div>
          )}
        </div>

        {/* Inline reject form */}
        {rejectOpen && (
          <div
            className="mb-4 rounded-xl p-4 flex flex-col gap-3"
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
              style={{
                background: '#ffffff',
                border: '1px solid #fecaca',
                color: '#18181b',
              }}
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleReject}
                disabled={rejectState === 'loading' || !rejectReason.trim()}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: '#fee2e2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                }}
              >
                {rejectState === 'loading' ? 'Rejecting...' : 'Confirm Reject'}
              </button>
              <button
                onClick={() => setRejectOpen(false)}
                className="text-xs transition-colors"
                style={{ color: '#a1a1aa' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {!campaign ? (
          <div
            className="rounded-lg p-5 text-center"
            style={{ background: '#fafafa', border: '1px solid #e4e4e7' }}
          >
            <p className="text-sm" style={{ color: '#a1a1aa' }}>
              No campaign linked to this run yet.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Status + budget */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div
                className="rounded-lg p-3"
                style={{ background: '#fafafa', border: '1px solid #e4e4e7' }}
              >
                <p className="text-xs mb-1" style={{ color: '#a1a1aa' }}>Status</p>
                <StatusBadge status={campaign.status} />
              </div>
              <div
                className="rounded-lg p-3"
                style={{ background: '#fafafa', border: '1px solid #e4e4e7' }}
              >
                <p className="text-xs mb-1" style={{ color: '#a1a1aa' }}>Budget</p>
                <p className="text-sm font-semibold" style={{ color: '#18181b' }}>
                  {campaign.budget ? formatCurrency(campaign.budget) : '—'}
                </p>
                {campaign.reviewAdjustments?.budgetAdjusted && (
                  <p className="text-xs mt-0.5" style={{ color: '#b45309' }}>
                    orig. {formatCurrency(campaign.reviewAdjustments.originalBudget)} →{' '}
                    {formatCurrency(campaign.reviewAdjustments.recommendedBudget)}
                  </p>
                )}
              </div>
              <div
                className="rounded-lg p-3"
                style={{ background: '#fafafa', border: '1px solid #e4e4e7' }}
              >
                <p className="text-xs mb-1" style={{ color: '#a1a1aa' }}>Objective</p>
                <p className="text-sm" style={{ color: '#52525b' }}>
                  {campaign.objective || '—'}
                </p>
              </div>
            </div>

            {/* Ad set config table */}
            {campaign.campaignConfig?.adSets && campaign.campaignConfig.adSets.length > 0 && (
              <div>
                <h3
                  className="text-xs font-semibold uppercase tracking-wider mb-3"
                  style={{ color: '#a1a1aa' }}
                >
                  Ad Set Configuration
                </h3>
                <div className="rounded-lg overflow-x-auto" style={{ border: '1px solid #e4e4e7' }}>
                  <table className="w-full">
                    <thead>
                      <tr style={{ borderBottom: '1px solid #f0f0f1', background: '#fafafa' }}>
                        {[
                          'Name',
                          'Audience',
                          'Budget %',
                          'Meta Audience ID',
                          'Age',
                          'Geo',
                          'Optimization',
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider"
                            style={{ color: '#a1a1aa' }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {campaign.campaignConfig.adSets.map((adSet, idx) => (
                        <tr
                          key={idx}
                          className="transition-colors hover:bg-zinc-50"
                          style={{ borderBottom: '1px solid #f4f4f5' }}
                        >
                          <td className="px-4 py-3 text-sm" style={{ color: '#18181b' }}>
                            {adSet.name}
                          </td>
                          <td className="px-4 py-3 text-xs" style={{ color: '#71717a' }}>
                            {adSet.audienceType}
                          </td>
                          <td className="px-4 py-3 text-sm" style={{ color: '#52525b' }}>
                            {adSet.budgetPercent}%
                          </td>
                          <td className="px-4 py-3 text-xs font-mono" style={{ color: '#a1a1aa' }}>
                            {adSet.metaAudienceId || '—'}
                          </td>
                          <td className="px-4 py-3 text-xs" style={{ color: '#71717a' }}>
                            {adSet.ageMin || adSet.ageMax
                              ? `${adSet.ageMin ?? '?'}–${adSet.ageMax ?? '?'}`
                              : '—'}
                          </td>
                          <td className="px-4 py-3 text-xs" style={{ color: '#71717a' }}>
                            {adSet.geoLocations?.join(', ') || '—'}
                          </td>
                          <td className="px-4 py-3 text-xs" style={{ color: '#71717a' }}>
                            {adSet.optimizationGoal || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Scale / pause rules */}
            {campaign.campaignConfig?.scaleRules && (
              <div>
                <h3
                  className="text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: '#a1a1aa' }}
                >
                  Scale Rules
                </h3>
                <pre
                  className="text-xs rounded-lg p-3 whitespace-pre-wrap leading-relaxed"
                  style={{
                    background: '#fafafa',
                    border: '1px solid #e4e4e7',
                    color: '#52525b',
                  }}
                >
                  {campaign.campaignConfig.scaleRules}
                </pre>
              </div>
            )}
            {campaign.campaignConfig?.pauseRules && (
              <div>
                <h3
                  className="text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: '#a1a1aa' }}
                >
                  Pause Rules
                </h3>
                <pre
                  className="text-xs rounded-lg p-3 whitespace-pre-wrap leading-relaxed"
                  style={{
                    background: '#fafafa',
                    border: '1px solid #e4e4e7',
                    color: '#52525b',
                  }}
                >
                  {campaign.campaignConfig.pauseRules}
                </pre>
              </div>
            )}

            {/* Campaign review debate log */}
            {campaign.reviewDebateLog && campaign.reviewDebateLog.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 h-px" style={{ background: '#e4e4e7' }} />
                  <span className="text-xs font-medium px-2" style={{ color: '#a1a1aa' }}>
                    Review Debate
                  </span>
                  <div className="flex-1 h-px" style={{ background: '#e4e4e7' }} />
                </div>
                <DebateLog rounds={campaign.reviewDebateLog} />
              </div>
            )}

            {/* View full campaign */}
            <div className="pt-2">
              <Link
                href={`/dashboard/${tenantId}/campaigns/${campaign._id}`}
                className="inline-flex items-center gap-2 text-sm font-medium transition-colors"
                style={{ color: '#0284c7' }}
              >
                View full campaign details →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
