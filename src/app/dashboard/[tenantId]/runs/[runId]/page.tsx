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
  ArrowRight,
  Megaphone,
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

// ── Duration helper ────────────────────────────────────────────────────────────

function getDuration(start?: string, end?: string): string {
  if (!start) return ''
  const ms = new Date(end || Date.now()).getTime() - new Date(start).getTime()
  const mins = Math.floor(ms / 60000)
  const secs = Math.floor((ms % 60000) / 1000)
  if (mins === 0) return `${secs}s`
  return `${mins}m ${secs}s`
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
  const isFailed = (status || '').toLowerCase() === 'failed'

  return (
    <div className="flex items-end gap-0 mt-6">
      {PHASES.map((phase, idx) => {
        const done = currentPhaseIdx > idx || currentPhaseIdx === 5
        const active = currentPhaseIdx === idx && !isFailed
        const isLast = idx === PHASES.length - 1
        return (
          <div key={phase.key} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center gap-2 min-w-[64px]">
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all',
                  active && 'animate-pulse'
                )}
                style={
                  done
                    ? { borderColor: '#15803d', background: '#15803d' }
                    : active
                    ? { borderColor: '#0284c7', background: '#e0f2fe' }
                    : { borderColor: '#d4d4d8', background: '#ffffff' }
                }
              >
                {done ? (
                  <CheckCircle2 size={18} style={{ color: '#ffffff' }} />
                ) : active ? (
                  <Loader2 size={16} className="animate-spin" style={{ color: '#0284c7' }} />
                ) : (
                  <Circle size={16} style={{ color: '#d4d4d8' }} />
                )}
              </div>
              <span
                className="text-xs font-semibold whitespace-nowrap"
                style={
                  done
                    ? { color: '#15803d' }
                    : active
                    ? { color: '#0284c7' }
                    : { color: '#a1a1aa' }
                }
              >
                {phase.label}
              </span>
            </div>
            {!isLast && (
              <div
                className="flex-1 mb-7"
                style={{
                  height: 3,
                  marginLeft: 2,
                  marginRight: 2,
                  background: done ? '#15803d' : '#e4e4e7',
                  transition: 'background 0.3s',
                }}
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

// ── Score bar ─────────────────────────────────────────────────────────────────

function ScoreBar({ score, max = 10 }: { score?: number; max?: number }) {
  if (score === undefined || score === null) return null
  const pct = Math.max(0, Math.min(100, (score / max) * 100))
  const color = score >= 8 ? '#15803d' : score >= 6 ? '#b45309' : '#b91c1c'
  const bg = score >= 8 ? '#dcfce7' : score >= 6 ? '#fef3c7' : '#fee2e2'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 5, background: '#f4f4f5' }}>
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: color,
            transition: 'width 0.4s ease',
          }}
        />
      </div>
      <span className="text-xs font-bold w-7 text-right" style={{ color }}>
        {score.toFixed(1)}
      </span>
    </div>
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
      className="rounded-xl p-5 flex flex-col gap-3 transition-all"
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
          <div className="flex items-center gap-2 flex-wrap mb-2">
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
      {brief.finalScore !== undefined && (
        <ScoreBar score={brief.finalScore} />
      )}
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
          className="mt-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
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
      className="rounded-xl p-5 flex flex-col gap-4"
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
      <div className="flex items-center gap-2 flex-wrap">
        {isSelected && (
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe' }}
          >
            Selected
          </span>
        )}
        {variant.hookStyle && (
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: '#f4f4f5', color: '#71717a', border: '1px solid #e4e4e7' }}
          >
            {variant.hookStyle}
          </span>
        )}
      </div>
      {variant.headline && (
        <h4 className="text-base font-semibold leading-snug" style={{ color: '#18181b' }}>
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
            className="text-xs font-semibold px-2.5 py-1 rounded-md"
            style={{ background: '#dbeafe', color: '#1d4ed8' }}
          >
            {variant.cta}
          </span>
        </div>
      )}
    </div>
  )
}

// ── Platform config ────────────────────────────────────────────────────────────

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

// ── Section header (numbered) ─────────────────────────────────────────────────

function SectionHeader({
  number,
  title,
  icon,
}: {
  number: string
  title: string
  icon?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
        style={{ background: '#0284c7', color: '#ffffff' }}
      >
        {number}
      </div>
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-base font-bold" style={{ color: '#18181b' }}>
          {title}
        </h2>
      </div>
      <div className="flex-1 h-px" style={{ background: '#e4e4e7' }} />
    </div>
  )
}

// ── Section tabs ───────────────────────────────────────────────────────────────

const SECTIONS = [
  { label: 'Scouts', emoji: '📡' },
  { label: 'Research', emoji: '🔬' },
  { label: 'Strategy', emoji: '✨' },
  { label: 'Creative', emoji: '🎨' },
  { label: 'Campaign', emoji: '📣' },
]

function SectionTabs({
  activeSection,
  dataDots,
  onSelect,
}: {
  activeSection: number
  dataDots: boolean[]
  onSelect: (idx: number) => void
}) {
  return (
    <div
      className="flex gap-1 p-1 overflow-x-auto"
      style={{ scrollbarWidth: 'none' }}
    >
      {SECTIONS.map((sec, idx) => {
        const isActive = activeSection === idx
        return (
          <button
            key={sec.label}
            onClick={() => onSelect(idx)}
            className="relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all shrink-0 flex-1 justify-center"
            style={
              isActive
                ? {
                    background: '#0284c7',
                    color: '#ffffff',
                    border: '1px solid #0284c7',
                    boxShadow: '0 2px 6px rgba(2,132,199,0.2)',
                  }
                : {
                    background: 'transparent',
                    color: '#71717a',
                    border: '1px solid transparent',
                  }
            }
          >
            <span>{sec.emoji}</span>
            {sec.label}
            {dataDots[idx] && (
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: isActive ? '#bae6fd' : '#0284c7' }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
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
  const [activeSection, setActiveSection] = useState(0)
  const [scoutTab, setScoutTab] = useState(0)

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

  useEffect(() => {
    fetchFull()
  }, [fetchFull])

  // Poll while active
  useEffect(() => {
    if (!data?.run) return
    const done = data.run.status === 'completed' || data.run.status === 'failed'
    if (done) return
    const interval = setInterval(fetchFull, 8000)
    return () => clearInterval(interval)
  }, [data?.run, fetchFull])


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

  function selectSection(idx: number) {
    setActiveSection(idx)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#f4f4f5' }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin" style={{ color: '#0284c7' }} />
          <p className="text-sm" style={{ color: '#71717a' }}>
            Loading pipeline run…
          </p>
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

  const isActive =
    run &&
    run.status !== 'completed' &&
    run.status !== 'failed'

  const duration = run
    ? getDuration(run.startedAt, run.status === 'completed' || run.status === 'failed' ? run.completedAt : undefined)
    : ''

  // data dot: whether each section has content
  const dataDots = [
    scouts.length > 0,
    research.length > 0,
    briefs.length > 0,
    !!creativePackage,
    !!campaign,
  ]

  // Scout platform tabs
  const scoutPlatforms = scouts.filter(
    (s) =>
      (s.data?.trending_topics?.length ?? 0) > 0 ||
      (s.data?.hook_examples?.length ?? 0) > 0 ||
      (s.data?.format_insights?.length ?? 0) > 0
  )
  const activeScout = scoutPlatforms[scoutTab] ?? null

  return (
    <div style={{ background: '#f4f4f5', minHeight: '100vh' }}>
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

      <div className="max-w-5xl mx-auto px-6 pt-6">
        {/* Back */}
        <div className="mb-4">
          <Link
            href={`/dashboard/${tenantId}/runs`}
            className="inline-flex items-center gap-1.5 text-sm transition-colors"
            style={{ color: '#71717a' }}
          >
            <ArrowLeft size={14} /> Back to Runs
          </Link>
        </div>
      </div>

      {/* ===== SECTION A: COMMAND CENTER HEADER ===== */}
      <div className="max-w-5xl mx-auto px-6 mb-0">
        <div className="rounded-t-xl p-6" style={sectionStyle}>
          {/* Top row: ID + status + Live badge */}
          <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h1 className="text-2xl font-bold" style={{ color: '#18181b' }}>
                  Pipeline Run
                </h1>
                {run && <StatusBadge status={run.status} />}
                {isActive && (
                  <span
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold animate-pulse"
                    style={{ background: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe' }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full animate-ping"
                      style={{ background: '#1d4ed8' }}
                    />
                    Live
                  </span>
                )}
              </div>
              <code
                className="text-sm font-mono px-2 py-0.5 rounded"
                style={{ background: '#f4f4f5', color: '#52525b' }}
              >
                {runId}
              </code>
            </div>

            {/* Duration */}
            {duration && (
              <div className="text-right">
                <p className="text-xs" style={{ color: '#a1a1aa' }}>
                  {run?.status === 'completed' ? 'Completed in' : run?.status === 'failed' ? 'Failed after' : 'Running for'}
                </p>
                <p className="text-2xl font-bold" style={{ color: '#18181b' }}>
                  {duration}
                </p>
              </div>
            )}
          </div>

          {/* Times */}
          <div className="flex items-center gap-6 text-xs mb-2 flex-wrap" style={{ color: '#a1a1aa' }}>
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

          {/* Phase stepper */}
          {run && <PhaseProgress status={run.status} />}
        </div>
      </div>

      {/* ===== SECTION TABS ===== */}
      <div className="max-w-5xl mx-auto px-6">
        <div style={{ ...sectionStyle, borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '8px' }}>
          <SectionTabs
            activeSection={activeSection}
            dataDots={dataDots}
            onSelect={selectSection}
          />
        </div>
      </div>

      {/* ===== CONTENT ===== */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* ===== SECTION B: SIGNAL SCOUTS ===== */}
        {activeSection === 0 && <div className="rounded-xl p-6" style={sectionStyle}>
          <SectionHeader number="01" title="Signal Scouts" icon={<span style={{ color: '#0284c7' }}>📡</span>} />

          {scouts.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: '#a1a1aa' }}>
              No scout data available yet.
            </p>
          ) : (
            <div className="flex flex-col gap-5">
              {/* Platform summary grid */}
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
                        <span className="text-sm font-semibold capitalize" style={{ color: cfg.textColor }}>
                          {scout.platform}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: '#a1a1aa' }}>
                          Signals
                        </p>
                        <p className="text-xl font-bold" style={{ color: cfg.textColor }}>
                          {signalCount}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: '#a1a1aa' }}>
                          Viral Trends
                        </p>
                        <p className="text-sm font-semibold" style={{ color: '#52525b' }}>
                          {viralCount}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Tabbed scout details */}
              {scoutPlatforms.length > 0 && (
                <div
                  className="rounded-xl overflow-hidden"
                  style={{ border: '1px solid #e4e4e7' }}
                >
                  {/* Platform tab switcher */}
                  <div
                    className="flex gap-1 p-3"
                    style={{ borderBottom: '1px solid #e4e4e7', background: '#fafafa' }}
                  >
                    {scoutPlatforms.map((scout, idx) => {
                      const cfg = platformConfig(scout.platform)
                      const isActiveTab = scoutTab === idx
                      return (
                        <button
                          key={scout.platform}
                          onClick={() => setScoutTab(idx)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize"
                          style={
                            isActiveTab
                              ? {
                                  background: cfg.bg,
                                  color: cfg.textColor,
                                  border: `1px solid ${cfg.border}`,
                                }
                              : {
                                  background: '#ffffff',
                                  color: '#71717a',
                                  border: '1px solid #e4e4e7',
                                }
                          }
                        >
                          <span>{cfg.emoji}</span>
                          {scout.platform}
                        </button>
                      )
                    })}
                  </div>

                  {/* Active platform detail */}
                  {activeScout && (() => {
                    const cfg = platformConfig(activeScout.platform)
                    const topics = activeScout.data?.trending_topics || []
                    const hooks = activeScout.data?.hook_examples || []
                    const formats = activeScout.data?.format_insights || []
                    return (
                      <div className="p-5">
                        <p
                          className="text-xs font-semibold capitalize mb-4"
                          style={{ color: cfg.textColor }}
                        >
                          {cfg.emoji} {activeScout.platform} — What the agent found
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                          {topics.length > 0 && (
                            <div>
                              <p className="text-xs font-medium mb-2.5" style={{ color: '#a1a1aa' }}>
                                Trending Topics
                              </p>
                              <div className="flex flex-col gap-1.5">
                                {topics.slice(0, 5).map((t, i) => (
                                  <div key={i} className="flex items-center justify-between gap-2">
                                    <span className="text-xs truncate" style={{ color: '#52525b' }}>
                                      {t.topic}
                                    </span>
                                    {t.score !== undefined && (
                                      <span
                                        className="text-xs font-mono shrink-0"
                                        style={{ color: cfg.textColor }}
                                      >
                                        {t.score.toFixed(1)}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {hooks.length > 0 && (
                            <div>
                              <p className="text-xs font-medium mb-2.5" style={{ color: '#a1a1aa' }}>
                                Hook Examples
                              </p>
                              <div className="flex flex-col gap-1.5">
                                {hooks.slice(0, 4).map((h, i) => (
                                  <p
                                    key={i}
                                    className="text-xs italic leading-relaxed"
                                    style={{ color: '#71717a' }}
                                  >
                                    &ldquo;{h}&rdquo;
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}
                          {formats.length > 0 && (
                            <div>
                              <p className="text-xs font-medium mb-2.5" style={{ color: '#a1a1aa' }}>
                                Format Insights
                              </p>
                              <div className="flex flex-col gap-1.5">
                                {formats.slice(0, 4).map((f, i) => (
                                  <p key={i} className="text-xs leading-relaxed" style={{ color: '#71717a' }}>
                                    • {f}
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Top signals table */}
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
          )}
        </div>

        }

        {/* ===== SECTION C: RESEARCH ===== */}
        {activeSection === 1 && <div className="rounded-xl p-6" style={sectionStyle}>
          <SectionHeader number="02" title="Research" icon={<span>🔬</span>} />
          {research.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: '#a1a1aa' }}>
              No research data available yet.
            </p>
          ) : (
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
          )}
        </div>

        }

        {/* ===== SECTION D: STRATEGY ===== */}
        {activeSection === 2 && <div className="rounded-xl p-6" style={sectionStyle}>
          <SectionHeader
            number="03"
            title={`Strategy — ${briefs.length} ${briefs.length === 1 ? 'Idea' : 'Ideas'}`}
            icon={<Sparkles size={16} style={{ color: '#0284c7' }} />}
          />

          {/* Selected brief summary */}
          {creativeBrief && (
            <div
              className="rounded-xl p-5 mb-5 flex flex-col gap-3"
              style={{ background: '#fffbeb', border: '2px solid #fbbf24', boxShadow: '0 2px 8px rgba(251,191,36,0.1)' }}
            >
              <div className="flex items-center gap-2">
                <Star size={13} fill="currentColor" style={{ color: '#b45309' }} />
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#b45309' }}>
                  Selected Brief
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Topic', value: creativeBrief.topic },
                  { label: 'Platform', value: creativeBrief.platform },
                  { label: 'Format', value: creativeBrief.format },
                  { label: 'Audience', value: creativeBrief.audience },
                ]
                  .filter((f) => f.value)
                  .map((f) => (
                    <div key={f.label}>
                      <p className="text-xs mb-0.5" style={{ color: '#a1a1aa' }}>
                        {f.label}
                      </p>
                      <p className="text-sm font-medium capitalize" style={{ color: '#18181b' }}>
                        {f.value}
                      </p>
                    </div>
                  ))}
              </div>
              {creativeBrief.angle && (
                <p className="text-xs leading-relaxed" style={{ color: '#71717a' }}>
                  <span className="font-semibold" style={{ color: '#b45309' }}>
                    Angle:{' '}
                  </span>
                  {creativeBrief.angle}
                </p>
              )}
              {creativeBrief.hook && (
                <p className="text-xs italic leading-relaxed" style={{ color: '#0284c7' }}>
                  &ldquo;{creativeBrief.hook}&rdquo;
                </p>
              )}
              {creativeBrief.keyMessage && (
                <p className="text-xs leading-relaxed" style={{ color: '#52525b' }}>
                  <span className="font-semibold">Key Message: </span>
                  {creativeBrief.keyMessage}
                </p>
              )}
              <div className="flex items-center gap-4 flex-wrap">
                {creativeBrief.suggestedBudget !== undefined && (
                  <span className="text-xs" style={{ color: '#71717a' }}>
                    Budget:{' '}
                    <span className="font-semibold" style={{ color: '#15803d' }}>
                      {formatCurrency(creativeBrief.suggestedBudget)}
                    </span>
                  </span>
                )}
                {creativeBrief.selectionReason && (
                  <p className="text-xs italic flex-1" style={{ color: '#a1a1aa' }}>
                    {creativeBrief.selectionReason}
                  </p>
                )}
              </div>
            </div>
          )}

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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
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

        }

        {/* ===== SECTION E: CREATIVE OUTPUT ===== */}
        {activeSection === 3 && <div className="rounded-xl p-6" style={sectionStyle}>
          <SectionHeader
            number="04"
            title="Creative Output"
            icon={<ImageIcon size={16} style={{ color: '#0284c7' }} />}
          />

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
            <div className="flex flex-col gap-6">
              {/* Copy variants */}
              {copyVariants.length > 0 && (
                <div>
                  <h3
                    className="text-xs font-semibold uppercase tracking-wider mb-3"
                    style={{ color: '#a1a1aa' }}
                  >
                    Copy Variants
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-all"
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
                      <Copy size={11} /> Copy
                    </button>
                  </div>
                  <div
                    className="rounded-lg p-5"
                    style={{ background: '#0f172a', border: '1px solid #1e293b' }}
                  >
                    <p
                      className="text-xs font-mono leading-relaxed"
                      style={{ color: '#94a3b8' }}
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
                    style={{ background: '#0f172a', border: '1px solid #1e293b' }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Video size={12} style={{ color: '#64748b' }} />
                      <span
                        className="text-xs font-semibold uppercase tracking-wider"
                        style={{ color: '#64748b' }}
                      >
                        Video Script
                      </span>
                    </div>
                    <p
                      className="text-xs font-mono leading-relaxed"
                      style={{ color: '#94a3b8' }}
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

        }

        {/* ===== SECTION F: CAMPAIGN REVIEW ===== */}
        {activeSection === 4 && <div className="rounded-xl p-6" style={sectionStyle}>
          <SectionHeader
            number="05"
            title="Campaign Review"
            icon={<Megaphone size={16} style={{ color: '#0284c7' }} />}
          />

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
            <div className="flex flex-col gap-5">
              {/* Status + budget + objective */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div
                  className="rounded-lg p-3"
                  style={{ background: '#fafafa', border: '1px solid #e4e4e7' }}
                >
                  <p className="text-xs mb-1" style={{ color: '#a1a1aa' }}>
                    Status
                  </p>
                  <StatusBadge status={campaign.status} />
                </div>
                <div
                  className="rounded-lg p-3"
                  style={{ background: '#fafafa', border: '1px solid #e4e4e7' }}
                >
                  <p className="text-xs mb-1" style={{ color: '#a1a1aa' }}>
                    Budget
                  </p>
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
                  <p className="text-xs mb-1" style={{ color: '#a1a1aa' }}>
                    Objective
                  </p>
                  <p className="text-sm" style={{ color: '#52525b' }}>
                    {campaign.objective || '—'}
                  </p>
                </div>
              </div>

              {/* Ad set config */}
              {campaign.campaignConfig?.adSets && campaign.campaignConfig.adSets.length > 0 && (
                <div>
                  <h3
                    className="text-xs font-semibold uppercase tracking-wider mb-3"
                    style={{ color: '#a1a1aa' }}
                  >
                    Ad Set Configuration
                  </h3>
                  <div
                    className="rounded-lg overflow-x-auto"
                    style={{ border: '1px solid #e4e4e7' }}
                  >
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
                    style={{ background: '#fafafa', border: '1px solid #e4e4e7', color: '#52525b' }}
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
                    style={{ background: '#fafafa', border: '1px solid #e4e4e7', color: '#52525b' }}
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

              {/* View full campaign link */}
              {campaign._id && campaign.status !== 'pending_approval' && (
                <div className="pt-1">
                  <Link
                    href={`/dashboard/${tenantId}/campaigns/${campaign._id}`}
                    className="inline-flex items-center gap-2 text-sm font-medium transition-colors"
                    style={{ color: '#0284c7' }}
                  >
                    View full campaign details <ArrowRight size={14} />
                  </Link>
                </div>
              )}

              {/* ===== PENDING APPROVAL — PROMINENT ACTION BUTTONS ===== */}
              {campaign.status === 'pending_approval' && (
                <div
                  className="rounded-xl p-5 mt-2 flex flex-col gap-4"
                  style={{ background: '#fafafa', border: '2px solid #e4e4e7' }}
                >
                  <div className="text-center">
                    <p className="text-sm font-semibold" style={{ color: '#18181b' }}>
                      This campaign is awaiting your approval
                    </p>
                    <p className="text-xs mt-1" style={{ color: '#71717a' }}>
                      Review the details above before approving or rejecting
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    <button
                      onClick={handleApprove}
                      disabled={approveState !== 'idle'}
                      className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl text-base font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      style={{
                        background: approveState !== 'idle' ? '#dcfce7' : '#15803d',
                        color: approveState !== 'idle' ? '#15803d' : '#ffffff',
                        border: '2px solid #15803d',
                        boxShadow: approveState === 'idle' ? '0 4px 12px rgba(21,128,61,0.25)' : 'none',
                      }}
                    >
                      {approveState === 'loading' ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <ThumbsUp size={18} />
                      )}
                      {approveState === 'loading'
                        ? 'Approving…'
                        : approveState === 'success'
                        ? 'Approved!'
                        : 'Approve & Launch Campaign'}
                    </button>

                    <button
                      onClick={() => setRejectOpen((o) => !o)}
                      className="w-full flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl text-sm font-semibold transition-all"
                      style={{
                        background: '#fee2e2',
                        color: '#b91c1c',
                        border: '2px solid #fecaca',
                      }}
                    >
                      <XCircle size={16} />
                      Reject Campaign
                    </button>
                  </div>

                  {/* Inline reject form */}
                  {rejectOpen && (
                    <div
                      className="rounded-xl p-4 flex flex-col gap-3"
                      style={{ background: '#fef2f2', border: '1px solid #fecaca' }}
                    >
                      <p className="text-xs font-semibold" style={{ color: '#b91c1c' }}>
                        Reason for rejection
                      </p>
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Describe why this campaign is being rejected…"
                        rows={3}
                        className="w-full rounded-lg px-3 py-2 text-sm resize-none"
                        style={{
                          background: '#ffffff',
                          border: '1px solid #fecaca',
                          color: '#18181b',
                          outline: 'none',
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
                          {rejectState === 'loading' ? 'Rejecting…' : 'Confirm Reject'}
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
                </div>
              )}
            </div>
          )}
        </div>}
      </div>
    </div>
  )
}
