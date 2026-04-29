'use client'

import { useState, useEffect, useCallback, use } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Activity,
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
  ChevronDown,
} from 'lucide-react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { DebateLog } from '@/components/ui/DebateLog'
import { StrategyTab } from '@/components/pipeline/StrategyTab'
import { formatCurrency, formatDateTime, cn } from '@/lib/utils'
import type { FullRunData, CopyVariant, CreativePackage, Campaign } from '@/types'

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
    <div className="mt-6">
      <div className="relative flex items-center mb-2">
        {/* Track */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px" style={{ background: '#e5e7eb' }} />
        {/* Fill */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-px transition-all duration-1000 ease-out"
          style={{
            background: isFailed ? '#dc2626' : '#059669',
            width: currentPhaseIdx === 5
              ? '100%'
              : currentPhaseIdx < 0
              ? '0%'
              : `${(currentPhaseIdx / (PHASES.length - 1)) * 100}%`,
          }}
        />
        <div className="relative flex justify-between w-full">
          {PHASES.map((phase, idx) => {
            const done = currentPhaseIdx > idx || currentPhaseIdx === 5
            const active = currentPhaseIdx === idx && !isFailed
            return (
              <div key={phase.key} className="flex flex-col items-center">
                <div
                  className={cn('w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300', active && 'animate-pulse')}
                  style={
                    done
                      ? { background: '#059669' }
                      : active
                      ? { background: '#ffffff', border: '2px solid #4f46e5', boxShadow: '0 0 0 3px #eef2ff' }
                      : isFailed && idx <= currentPhaseIdx
                      ? { background: '#dc2626' }
                      : { background: '#f8f9fb', border: '1.5px solid #e5e7eb' }
                  }
                >
                  {done ? (
                    <CheckCircle2 size={12} style={{ color: '#ffffff' }} />
                  ) : active ? (
                    <Loader2 size={11} className="animate-spin" style={{ color: '#4f46e5' }} />
                  ) : isFailed && idx <= currentPhaseIdx ? (
                    <Circle size={8} style={{ color: '#ffffff' }} />
                  ) : (
                    <span className="text-[8px] font-bold" style={{ color: '#d1d5db' }}>{idx + 1}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="flex justify-between">
        {PHASES.map((phase, idx) => {
          const done = currentPhaseIdx > idx || currentPhaseIdx === 5
          const active = currentPhaseIdx === idx && !isFailed
          return (
            <span
              key={phase.key}
              className="text-[10px] font-medium text-center"
              style={{ color: done ? '#059669' : active ? '#4f46e5' : '#d1d5db', width: 64 }}
            >
              {phase.label}
            </span>
          )
        })}
      </div>
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
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 5, background: '#e5e7eb' }}>
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

// ── Accordion section ─────────────────────────────────────────────────────────

function AccordionSection({
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string
  badge?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderTop: '1px solid #e5e7eb' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-1 py-3 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold" style={{ color: '#334155' }}>
            {title}
          </span>
          {badge}
        </div>
        <ChevronDown
          size={14}
          className="shrink-0 transition-transform duration-200"
          style={{
            color: '#9ca3af',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>
      {open && <div className="pb-4">{children}</div>}
    </div>
  )
}

// ── Idea row (with optional inline creative + campaign) ────────────────────────

function CreativeInlinePanel({
  creativePackage,
  copyVariants,
  selectedCopyIndex,
}: {
  creativePackage: import('@/types').CreativePackage
  copyVariants: import('@/types').CopyVariant[]
  selectedCopyIndex?: number
}) {
  return (
    <div className="flex flex-col gap-4 pt-4" style={{ borderTop: '1px solid #e5e7eb' }}>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#9ca3af' }}>
        Creative Output
      </p>

      {copyVariants.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium" style={{ color: '#4b5563' }}>Copy Variants</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {copyVariants.map((v, idx) => (
              <div
                key={idx}
                className="rounded-lg p-4 flex flex-col gap-2"
                style={
                  idx === selectedCopyIndex
                    ? { background: '#eef2ff', border: '2px solid #4338ca' }
                    : { background: '#f3f4f6', border: '1px solid #e5e7eb' }
                }
              >
                {idx === selectedCopyIndex && (
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full self-start"
                    style={{ background: '#e0e7ff', color: '#1d4ed8', border: '1px solid #c7d2fe' }}
                  >
                    Selected
                  </span>
                )}
                {v.hookStyle && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full self-start"
                    style={{ background: '#f3f4f6', color: '#4b5563', border: '1px solid #e5e7eb' }}
                  >
                    {v.hookStyle}
                  </span>
                )}
                {v.headline && (
                  <p className="text-sm font-semibold" style={{ color: '#111827' }}>{v.headline}</p>
                )}
                <p className="text-xs leading-relaxed" style={{ color: '#4b5563' }}>{v.primaryText}</p>
                {v.cta && (
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-md self-start"
                    style={{ background: '#e0e7ff', color: '#1d4ed8' }}
                  >
                    {v.cta}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {(creativePackage.images?.length ?? 0) > 0 && (
        <div>
          {(creativePackage.images?.length ?? 0) > 0 ? (
            <div className="grid grid-cols-3 gap-2 mt-3">
              {creativePackage.images!.map((img, i) => {
                const isSel = i === (selectedCopyIndex ?? 0)
                return (
                  <div key={i} className="relative">
                    {isSel && <span className="absolute top-1 left-1 z-10 text-[9px] font-semibold px-1 py-0.5 rounded" style={{ background: '#15803d', color: '#fff' }}>Selected</span>}
                    {img.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img.imageUrl} alt={`Variant ${i + 1}`} className="rounded-lg w-full" style={{ border: isSel ? '2px solid #15803d' : '1px solid #e5e7eb', maxHeight: 300, objectFit: 'contain', display: 'block' }} />
                    ) : (
                      <div className="rounded-lg flex items-center justify-center" style={{ height: 200, background: '#f3f4f6', border: '1px dashed #d4d4d8' }}>
                        <p className="text-[10px]" style={{ color: '#d1d5db' }}>V{i + 1}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div
              className="mt-2 h-20 rounded-lg flex items-center justify-center"
              style={{ background: '#f3f4f6', border: '1px solid #e5e7eb' }}
            >
              <p className="text-xs" style={{ color: '#d1d5db' }}>Image not yet generated</p>
            </div>
          )}
        </div>
      )}

      {creativePackage.complianceNotes && (
        <div
          className="rounded-lg p-3"
          style={{ background: '#fffbeb', border: '1px solid #fde68a' }}
        >
          <p className="text-xs font-semibold mb-1" style={{ color: '#b45309' }}>Compliance Notes</p>
          <p className="text-xs leading-relaxed" style={{ color: '#78350f' }}>{creativePackage.complianceNotes}</p>
        </div>
      )}
    </div>
  )
}

function CampaignInlinePanel({
  campaign,
  onApprove,
  approveState,
  onRejectOpen,
  rejectOpen,
  rejectReason,
  onRejectReasonChange,
  onReject,
  rejectState,
  onRejectCancel,
  tenantId,
}: {
  campaign: import('@/types').Campaign
  onApprove: () => void
  approveState: 'idle' | 'loading' | 'success' | 'error'
  onRejectOpen: () => void
  rejectOpen: boolean
  rejectReason: string
  onRejectReasonChange: (v: string) => void
  onReject: () => void
  rejectState: 'idle' | 'loading' | 'success' | 'error'
  onRejectCancel: () => void
  tenantId: string
}) {
  return (
    <div className="flex flex-col gap-4 pt-4" style={{ borderTop: '1px solid #e5e7eb' }}>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#9ca3af' }}>
        Campaign
      </p>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg p-3" style={{ background: '#f3f4f6', border: '1px solid #e5e7eb' }}>
          <p className="text-xs mb-1" style={{ color: '#9ca3af' }}>Status</p>
          <StatusBadge status={campaign.status} />
        </div>
        <div className="rounded-lg p-3" style={{ background: '#f3f4f6', border: '1px solid #e5e7eb' }}>
          <p className="text-xs mb-1" style={{ color: '#9ca3af' }}>Budget</p>
          <p className="text-sm font-semibold" style={{ color: '#111827' }}>
            {campaign.budget ? formatCurrency(campaign.budget) : '—'}
          </p>
        </div>
        <div className="rounded-lg p-3" style={{ background: '#f3f4f6', border: '1px solid #e5e7eb' }}>
          <p className="text-xs mb-1" style={{ color: '#9ca3af' }}>Objective</p>
          <p className="text-xs" style={{ color: '#4b5563' }}>{campaign.objective || '—'}</p>
        </div>
      </div>

      {campaign.status === 'pending_approval' && (
        <div
          className="rounded-xl p-4 flex flex-col gap-3"
          style={{ background: '#f3f4f6', border: '2px solid #e5e7eb' }}
        >
          <p className="text-xs font-semibold text-center" style={{ color: '#111827' }}>
            Awaiting your approval
          </p>
          <div className="flex gap-2">
            <button
              onClick={onApprove}
              disabled={approveState !== 'idle'}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-60"
              style={{
                background: approveState !== 'idle' ? '#dcfce7' : '#15803d',
                color: approveState !== 'idle' ? '#15803d' : '#ffffff',
                border: '2px solid #15803d',
              }}
            >
              {approveState === 'loading' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ThumbsUp size={14} />
              )}
              {approveState === 'loading' ? 'Approving…' : approveState === 'success' ? 'Approved!' : 'Approve & Launch'}
            </button>
            <button
              onClick={onRejectOpen}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all"
              style={{ background: '#fee2e2', color: '#b91c1c', border: '2px solid #fecaca' }}
            >
              <XCircle size={14} />
              Reject
            </button>
          </div>

          {rejectOpen && (
            <div
              className="rounded-lg p-3 flex flex-col gap-2"
              style={{ background: '#fef2f2', border: '1px solid #fecaca' }}
            >
              <p className="text-xs font-semibold" style={{ color: '#b91c1c' }}>Reason for rejection</p>
              <textarea
                value={rejectReason}
                onChange={(e) => onRejectReasonChange(e.target.value)}
                placeholder="Describe why…"
                rows={2}
                className="w-full rounded-lg px-3 py-2 text-xs resize-none"
                style={{ background: '#ffffff', border: '1px solid #fecaca', color: '#111827', outline: 'none' }}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={onReject}
                  disabled={rejectState === 'loading' || !rejectReason.trim()}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                  style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#b91c1c' }}
                >
                  {rejectState === 'loading' ? 'Rejecting…' : 'Confirm Reject'}
                </button>
                <button onClick={onRejectCancel} className="text-xs" style={{ color: '#9ca3af' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {campaign._id && campaign.status !== 'pending_approval' && (
        <Link
          href={`/dashboard/${tenantId}/campaigns/${campaign._id}`}
          className="inline-flex items-center gap-1 text-xs font-medium"
          style={{ color: '#4f46e5', textDecoration: 'none' }}
        >
          View full campaign <ArrowRight size={11} />
        </Link>
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
      return { emoji: '🐦', textColor: '#1d4ed8', bg: '#eff6ff', border: '#c7d2fe' }
    case 'youtube':
      return { emoji: '📺', textColor: '#b91c1c', bg: '#fef2f2', border: '#fecaca' }
    default:
      return { emoji: '📡', textColor: '#71717a', bg: '#f6f6f7', border: '#e5e7eb' }
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
    <div className="flex items-center gap-3 mb-6">
      <span className="text-xs font-mono font-bold" style={{ color: '#d1d5db' }}>{number}</span>
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-[15px] font-bold" style={{ color: '#111827' }}>
          {title}
        </h2>
      </div>
      <div className="flex-1 h-px" style={{ background: '#e5e7eb' }} />
    </div>
  )
}

// ── Section tabs ───────────────────────────────────────────────────────────────

const SECTIONS = [
  { label: 'Scouts', emoji: '📡' },
  { label: 'Research', emoji: '🔬' },
  { label: 'Ad Library', emoji: '🏪' },
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
      className="flex overflow-x-auto"
      style={{ scrollbarWidth: 'none' }}
    >
      {SECTIONS.map((sec, idx) => {
        const isActive = activeSection === idx
        return (
          <button
            key={sec.label}
            onClick={() => onSelect(idx)}
            className="relative flex items-center gap-2 px-5 py-3 text-[13px] font-medium whitespace-nowrap transition-colors shrink-0"
            style={{ color: isActive ? '#111827' : '#9ca3af' }}
          >
            <span className="text-sm opacity-70">{sec.emoji}</span>
            {sec.label}
            {dataDots[idx] && !isActive && (
              <span className="w-1 h-1 rounded-full shrink-0" style={{ background: '#4f46e5' }} />
            )}
            {isActive && (
              <div className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full" style={{ background: '#4f46e5' }} />
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Creative entry card (collapsible) ────────────────────────────────────────

type CreativeEntryType = {
  briefId: string
  topic: string
  isWinner: boolean
  pkg: CreativePackage | null
  variants: CopyVariant[]
  selectedIdx?: number
  campaignId?: string
  creativePackageId?: string
}

function CreativeEntryCard({
  entry,
  tenantId,
  defaultOpen,
  onRefresh,
}: {
  entry: CreativeEntryType
  tenantId: string
  defaultOpen: boolean
  onRefresh?: () => void
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [imageCardState, setImageCardState] = useState<Record<number, 'idle' | 'loading' | 'polling'>>({})
  const [videoRegenState, setVideoRegenState] = useState<'idle' | 'loading' | 'polling'>('idle')

  function setCardState(i: number, state: 'idle' | 'loading' | 'polling') {
    setImageCardState(prev => ({ ...prev, [i]: state }))
  }
  function getCardState(i: number): 'idle' | 'loading' | 'polling' {
    return imageCardState[i] ?? 'idle'
  }

  async function pollImageVariant(variantIndex: number, pkgId: string, onDone: () => void) {
    const poll = setInterval(async () => {
      try {
        const r = await fetch(`${API_BASE}/creative/${tenantId}/packages/${pkgId}`, { cache: 'no-store' })
        if (!r.ok) return
        const pkg = await r.json()
        if (pkg.images?.[variantIndex]?.imageUrl) {
          clearInterval(poll)
          onDone()
          onRefresh?.()
        }
      } catch { /* keep polling */ }
    }, 10000)
    setTimeout(() => { clearInterval(poll); onDone() }, 180000)
  }

  async function pollVideoReady(pkgId: string, onDone: () => void) {
    const poll = setInterval(async () => {
      try {
        const r = await fetch(`${API_BASE}/creative/${tenantId}/packages/${pkgId}`, { cache: 'no-store' })
        if (!r.ok) return
        const pkg = await r.json()
        if (pkg.video?.videoUrl) {
          clearInterval(poll)
          onDone()
          onRefresh?.()
        }
      } catch { /* keep polling */ }
    }, 10000)
    setTimeout(() => { clearInterval(poll); onDone() }, 180000)
  }

  async function handleRegenImage(variantIndex: number) {
    const pkgId = entry.creativePackageId
    if (!pkgId) return
    setCardState(variantIndex, 'loading')
    try {
      const res = await fetch(`${API_BASE}/creative/${tenantId}/packages/${pkgId}/regenerate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantIndex }),
      })
      if (!res.ok) throw new Error()
      setCardState(variantIndex, 'polling')
      pollImageVariant(variantIndex, pkgId, () => setCardState(variantIndex, 'idle'))
    } catch {
      setCardState(variantIndex, 'idle')
    }
  }

  async function handleRewriteImagePrompt(variantIndex: number) {
    const pkgId = entry.creativePackageId
    if (!pkgId) return
    setCardState(variantIndex, 'loading')
    try {
      const res = await fetch(`${API_BASE}/creative/${tenantId}/packages/${pkgId}/regenerate-image-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantIndex }),
      })
      if (!res.ok) throw new Error()
      setCardState(variantIndex, 'polling')
      pollImageVariant(variantIndex, pkgId, () => setCardState(variantIndex, 'idle'))
    } catch {
      setCardState(variantIndex, 'idle')
    }
  }

  async function handleRegenVideo() {
    const pkgId = entry.creativePackageId
    if (!pkgId) return
    setVideoRegenState('loading')
    try {
      const res = await fetch(`${API_BASE}/creative/${tenantId}/packages/${pkgId}/regenerate-video`, { method: 'POST' })
      if (!res.ok) throw new Error()
      setVideoRegenState('polling')
      pollVideoReady(pkgId, () => setVideoRegenState('idle'))
    } catch {
      setVideoRegenState('idle')
    }
  }

  async function handleRewriteVideoPrompt() {
    const pkgId = entry.creativePackageId
    if (!pkgId) return
    setVideoRegenState('loading')
    try {
      const res = await fetch(`${API_BASE}/creative/${tenantId}/packages/${pkgId}/regenerate-video-prompt`, { method: 'POST' })
      if (!res.ok) throw new Error()
      setVideoRegenState('polling')
      pollVideoReady(pkgId, () => setVideoRegenState('idle'))
    } catch {
      setVideoRegenState('idle')
    }
  }

  // Summary chips shown in collapsed header
  const chips: string[] = []
  if (entry.variants.length > 0) chips.push(`${entry.variants.length} variant${entry.variants.length !== 1 ? 's' : ''}`)
  if (entry.pkg?.images?.some(img => !!img.imageUrl)) chips.push('image')
  if (entry.pkg?.video?.videoUrl || entry.pkg?.video?.videoPrompt) chips.push('video')
  if (entry.pkg?.complianceNotes) chips.push('compliance')

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={
        entry.isWinner
          ? { border: '2px solid #fbbf24', background: '#ffffff' }
          : { border: '1px solid #e5e7eb', background: '#ffffff' }
      }
    >
      {/* Clickable header — always visible */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        style={{ background: entry.isWinner ? '#fffbeb' : '#f3f4f6' }}
      >
        {entry.isWinner ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
            <Star size={9} fill="currentColor" /> Strategy Pick
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }}>
            <CheckCircle2 size={9} /> Produced
          </span>
        )}
        <span className="text-sm font-semibold truncate flex-1" style={{ color: '#111827' }}>
          {entry.topic}
        </span>
        {!open && chips.length > 0 && (
          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
            {chips.map((c) => (
              <span key={c} className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#f3f4f6', color: '#4b5563' }}>{c}</span>
            ))}
          </div>
        )}
        <ChevronDown
          size={14}
          className="shrink-0 transition-transform duration-200"
          style={{ color: '#9ca3af', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {/* Expanded content */}
      {open && (
        <div style={{ borderTop: `1px solid ${entry.isWinner ? '#fde68a' : '#e5e7eb'}` }}>
          <div className="px-4 flex flex-col">
            {!entry.pkg && entry.campaignId && (
              <div className="py-3">
                <div className="rounded-lg p-3 flex items-center justify-between gap-3" style={{ background: '#eef2ff', border: '1px solid #c7d2fe' }}>
                  <p className="text-xs" style={{ color: '#4338ca' }}>Creative package not yet available — view in campaign</p>
                  <Link
                    href={`/dashboard/${tenantId}/campaigns/${entry.campaignId}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold shrink-0"
                    style={{ color: '#4f46e5', textDecoration: 'none' }}
                  >
                    View Campaign <ArrowRight size={11} />
                  </Link>
                </div>
              </div>
            )}

            {/* Copy variants */}
            {entry.pkg && entry.variants.length > 0 && (
              <AccordionSection
                title="Copy Variants"
                defaultOpen={true}
                badge={
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#eef2ff', color: '#4f46e5' }}>
                    {entry.variants.length}
                  </span>
                }
              >
                <div className="flex flex-col gap-2">
                  {entry.variants.map((v, idx) => {
                    const isSel = idx === entry.selectedIdx
                    return (
                      <div
                        key={idx}
                        className="rounded-lg px-3 py-2.5 flex flex-col gap-1"
                        style={isSel
                          ? { background: '#eef2ff', border: '1.5px solid #4338ca' }
                          : { background: '#f3f4f6', border: '1px solid #e5e7eb' }
                        }
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          {isSel && (
                            <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: '#e0e7ff', color: '#1d4ed8' }}>Selected</span>
                          )}
                          {v.hookStyle && (
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#f3f4f6', color: '#4b5563' }}>{v.hookStyle}</span>
                          )}
                          {v.cta && (
                            <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded" style={{ background: '#e0e7ff', color: '#1d4ed8' }}>{v.cta}</span>
                          )}
                        </div>
                        {v.headline && <p className="text-xs font-semibold" style={{ color: '#111827' }}>{v.headline}</p>}
                        <p className="text-xs leading-relaxed" style={{ color: '#4b5563' }}>{v.primaryText}</p>
                      </div>
                    )
                  })}
                  {entry.pkg.copySelectionReason && (
                    <p className="text-xs italic pt-1" style={{ color: '#4b5563' }}>{entry.pkg.copySelectionReason}</p>
                  )}
                </div>
              </AccordionSection>
            )}

            {/* Image */}
            {entry.pkg && (entry.pkg.imagePrompt || (entry.pkg.images?.length ?? 0) > 0) && (
              <AccordionSection
                title="Image"
                defaultOpen={entry.pkg.images?.some(img => !!img.imageUrl) ?? false}
                badge={entry.pkg.images?.some(img => !!img.imageUrl)
                  ? <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#ecfdf5', color: '#059669' }}>Generated</span>
                  : undefined
                }
              >
                {(entry.pkg.images?.length ?? 0) > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {entry.pkg.images!.map((img, i) => {
                      const isSel = i === (entry.selectedIdx ?? 0)
                      const cardState = getCardState(i)
                      return (
                        <div key={i} className="flex flex-col gap-1.5">
                          <div className="relative">
                            {isSel && <span className="absolute top-1 left-1 z-10 text-[9px] font-semibold px-1 py-0.5 rounded" style={{ background: '#15803d', color: '#fff' }}>Selected</span>}
                            {cardState === 'polling' && (
                              <div className="absolute inset-0 z-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.7)' }}>
                                <Loader2 size={16} className="animate-spin" style={{ color: '#4f46e5' }} />
                              </div>
                            )}
                            {img.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={img.imageUrl} alt={`Variant ${i + 1}`} className="rounded-lg w-full" style={{ border: isSel ? '2px solid #15803d' : '1px solid #e5e7eb', maxHeight: 300, objectFit: 'contain', display: 'block' }} />
                            ) : (
                              <div className="rounded-lg flex items-center justify-center" style={{ height: 200, background: '#f3f4f6', border: '1px dashed #d4d4d8' }}>
                                <p className="text-[10px]" style={{ color: '#d1d5db' }}>{cardState === 'polling' ? '' : `V${i + 1}`}</p>
                              </div>
                            )}
                          </div>
                          {img.imagePrompt && (
                            <details>
                              <summary className="text-[9px] cursor-pointer" style={{ color: '#9ca3af' }}>Prompt</summary>
                              <p className="text-[9px] mt-1 font-mono leading-relaxed p-1.5 rounded" style={{ background: '#f9fafb', color: '#6b7280', border: '1px solid #e5e7eb' }}>{img.imagePrompt}</p>
                            </details>
                          )}
                          {entry.creativePackageId && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleRegenImage(i)}
                                disabled={cardState !== 'idle'}
                                className="flex-1 flex items-center justify-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium transition-all disabled:opacity-50"
                                style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#4b5563' }}
                              >
                                {cardState !== 'idle' ? <Loader2 size={8} className="animate-spin" /> : <ImageIcon size={8} />}
                                {cardState === 'idle' ? 'Re-roll' : 'Working…'}
                              </button>
                              <button
                                onClick={() => handleRewriteImagePrompt(i)}
                                disabled={cardState !== 'idle'}
                                className="flex-1 flex items-center justify-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium transition-all disabled:opacity-50"
                                style={{ background: '#eef2ff', border: '1px solid #c7d2fe', color: '#4f46e5' }}
                              >
                                <Sparkles size={8} /> New prompt
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="h-14 rounded-lg flex items-center justify-center" style={{ background: '#f3f4f6', border: '1px solid #e5e7eb' }}>
                    <p className="text-xs" style={{ color: '#d1d5db' }}>Not yet generated</p>
                  </div>
                )}
              </AccordionSection>
            )}

            {/* Video */}
            {entry.pkg && (entry.pkg.video?.videoUrl || entry.pkg.video?.videoPrompt) && (
              <AccordionSection title="Video" defaultOpen={!!entry.pkg.video?.videoUrl}>
                {entry.pkg.video?.videoUrl ? (
                  <video controls className="rounded-lg w-full mb-2" style={{ maxHeight: 300, border: '1px solid #e5e7eb' }}>
                    <source src={entry.pkg.video.videoUrl} type="video/mp4" />
                  </video>
                ) : null}
                {entry.pkg.video?.videoPrompt && (
                  <div className="rounded-lg p-3" style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <Video size={11} style={{ color: '#6b7280' }} />
                        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>Script</span>
                      </div>
                      {entry.creativePackageId && (
                        <>
                          <button
                            onClick={handleRegenVideo}
                            disabled={videoRegenState !== 'idle'}
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all disabled:opacity-50"
                            style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#4b5563' }}
                          >
                            {videoRegenState === 'idle' ? (
                              <><Video size={10} /> Re-roll</>
                            ) : (
                              <><Loader2 size={10} className="animate-spin" /> {videoRegenState === 'loading' ? 'Starting...' : 'Generating...'}</>
                            )}
                          </button>
                          <button
                            onClick={handleRewriteVideoPrompt}
                            disabled={videoRegenState !== 'idle'}
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all disabled:opacity-50"
                            style={{ background: '#eef2ff', border: '1px solid #c7d2fe', color: '#4f46e5' }}
                          >
                            <Sparkles size={10} /> Rewrite
                          </button>
                        </>
                      )}
                    </div>
                    <p className="text-xs font-mono leading-relaxed" style={{ color: '#6b7280' }}>{entry.pkg.video.videoPrompt}</p>
                  </div>
                )}
              </AccordionSection>
            )}

            {/* Compliance */}
            {entry.pkg && entry.pkg.complianceNotes && (
              <AccordionSection title="Compliance Notes">
                <div className="rounded-lg p-3" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                  <p className="text-xs leading-relaxed" style={{ color: '#78350f' }}>{entry.pkg.complianceNotes}</p>
                </div>
              </AccordionSection>
            )}

            {/* Debate */}
            {entry.pkg && entry.pkg.debateLog && entry.pkg.debateLog.length > 0 && (
              <AccordionSection
                title="Creative Debate"
                badge={
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#f3f4f6', color: '#4b5563' }}>
                    {entry.pkg.debateLog.length} rounds
                  </span>
                }
              >
                <DebateLog rounds={entry.pkg.debateLog} />
              </AccordionSection>
            )}
          </div>
        </div>
      )}
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
  const [producedRuns, setProducedRuns] = useState<Record<string, string>>(() => {
    try {
      const saved = typeof window !== 'undefined'
        ? localStorage.getItem(`producedRuns:${tenantId}:${runId}`)
        : null
      return saved ? JSON.parse(saved) : {}
    } catch { return {} }
  })
  const [siblingCampaigns, setSiblingCampaigns] = useState<Record<string, import('@/types').Campaign>>({})
  const [siblingCreativePackages, setSiblingCreativePackages] = useState<Record<string, import('@/types').CreativePackage>>({})

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
      const [fullRes] = await Promise.all([
        fetch(`${API_BASE}/pipeline/${tenantId}/runs/${runId}/full`),
      ])
      if (!fullRes.ok) throw new Error(`HTTP ${fullRes.status}`)
      const fullData: FullRunData = await fullRes.json()
      setData(fullData)
      setError(null)

      // Use campaigns API to find produced non-winner briefs.
      // campaign.briefId is the original brief ID (confirmed by backend schema).
      if (fullData.briefs) {
        const winnerBriefId = fullData.run?.selectedBriefId
        const nonWinnerBriefIds = new Set(
          fullData.briefs
            .filter((b) => b.briefId !== winnerBriefId && !b.selected)
            .map((b) => b.briefId)
        )
        try {
          const campaignsRes = await fetch(`${API_BASE}/campaigns/${tenantId}`, { cache: 'no-store' })
          if (campaignsRes.ok) {
            const allCampaigns: import('@/types').Campaign[] = await campaignsRes.json().catch(() => [])
            const sibCamps: Record<string, import('@/types').Campaign> = {}
            for (const c of allCampaigns) {
              if (c.briefId && nonWinnerBriefIds.has(c.briefId)) {
                sibCamps[c.briefId] = c
              }
            }
            if (Object.keys(sibCamps).length > 0) {
              setSiblingCampaigns(sibCamps)
              // Mark these briefs as produced (briefId → campaign._id as identifier)
              const fromCampaigns: Record<string, string> = {}
              for (const [briefId, camp] of Object.entries(sibCamps)) {
                fromCampaigns[briefId] = camp._id
              }
              setProducedRuns((prev) => ({ ...prev, ...fromCampaigns }))

              // Fetch creative packages for produced non-winner ideas
              const pkgResults = await Promise.allSettled(
                Object.entries(sibCamps)
                  .filter(([, c]) => c.creativePackageId)
                  .map(async ([briefId, c]) => {
                    const r = await fetch(`${API_BASE}/creative/${tenantId}/packages/${c.creativePackageId}`, { cache: 'no-store' })
                    if (!r.ok) throw new Error(`HTTP ${r.status}`)
                    const pkg: import('@/types').CreativePackage = await r.json()
                    return [briefId, pkg] as const
                  })
              )
              const sibPkgs: Record<string, import('@/types').CreativePackage> = {}
              for (const r of pkgResults) {
                if (r.status === 'fulfilled') {
                  const [briefId, pkg] = r.value
                  sibPkgs[briefId] = pkg
                }
              }
              if (Object.keys(sibPkgs).length > 0) setSiblingCreativePackages(sibPkgs)
            }
          }
        } catch (e) {
          // campaign cross-ref failed silently
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load run data')
    } finally {
      setLoading(false)
    }
  }, [tenantId, runId])

  useEffect(() => {
    fetchFull()
  }, [fetchFull])

  // Persist producedRuns to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(`producedRuns:${tenantId}:${runId}`, JSON.stringify(producedRuns))
    } catch {}
  }, [producedRuns, tenantId, runId])


  // Poll while active
  useEffect(() => {
    if (!data?.run) return
    const done = data.run.status === 'completed' || data.run.status === 'failed'
    if (done) return
    const interval = setInterval(fetchFull, 8000)
    return () => clearInterval(interval)
  }, [data?.run, fetchFull])

  async function handleProduce(briefId: string) {
    setProducingBrief(briefId)
    try {
      const res = await fetch(`${API_BASE}/pipeline/${tenantId}/runs/${runId}/produce/${briefId}`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const result = await res.json().catch(() => ({}))
      if (result?.runId) {
        setProducedRuns((prev) => ({ ...prev, [briefId]: result.runId }))
      }
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
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#f8f9fb' }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin" style={{ color: '#4f46e5' }} />
          <p className="text-sm font-medium" style={{ color: '#4b5563' }}>
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
  const adLibrary = data?.adLibrary ?? null
  const briefs = (data?.briefs || []).slice().sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0))
  const creativeBrief = data?.creativeBrief
  const creativePackage = data?.creativePackage
  const campaign = data?.campaign
  const copyVariants: CopyVariant[] = creativePackage?.copyVariants || []
  const selectedCopyIndex = creativePackage?.selectedCopyIndex

  const sectionStyle: React.CSSProperties = {
    background: '#ffffff',
    borderRadius: 16,
    boxShadow: '0 1px 3px rgba(26,26,26,0.04), 0 1px 2px rgba(26,26,26,0.02)',
  }

  const isActive =
    run &&
    run.status !== 'completed' &&
    run.status !== 'failed'

  const duration = run
    ? getDuration(run.startedAt, run.status === 'completed' || run.status === 'failed' ? run.completedAt : undefined)
    : ''

  // data dot: whether each section has content
  // Order: Scouts=0, Research=1, AdLibrary=2, Strategy=3, Creative=4, Campaign=5
  const dataDots = [
    scouts.length > 0,
    research.length > 0,
    !!(adLibrary?.competitorAds?.length || adLibrary?.gaps?.length),
    briefs.length > 0,
    !!creativePackage,
    !!campaign || Object.keys(siblingCampaigns).length > 0,
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
    <div style={{ background: '#f8f9fb', minHeight: '100vh' }}>
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-5 right-5 z-50 px-5 py-3 rounded-xl text-sm font-medium animate-scale-in"
          style={
            toast.type === 'success'
              ? { background: '#ecfdf5', color: '#059669', boxShadow: '0 8px 32px rgba(45,122,79,0.12)' }
              : { background: '#fef2f2', color: '#dc2626', boxShadow: '0 8px 32px rgba(180,69,69,0.12)' }
          }
        >
          {toast.message}
        </div>
      )}

      {/* Header area */}
      <div className="max-w-5xl mx-auto px-8 pt-8 animate-fade-up">
        {/* Back link */}
        <Link
          href={`/dashboard/${tenantId}/runs`}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors mb-6"
          style={{ color: '#9ca3af' }}
        >
          <ArrowLeft size={13} /> Back to Runs
        </Link>

        {/* Run header card */}
        <div className="rounded-2xl overflow-hidden bg-white" style={{ boxShadow: '0 1px 3px rgba(26,26,26,0.04), 0 1px 2px rgba(26,26,26,0.02)' }}>
          <div className="p-7">
            <div className="flex items-start justify-between gap-5 flex-wrap mb-5">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-xl font-bold" style={{ color: '#111827' }}>Pipeline Run</h1>
                  {run && <StatusBadge status={run.status} />}
                  {isActive && (
                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold"
                      style={{ background: '#eef2ff', color: '#4f46e5' }}>
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50" style={{ background: '#4f46e5' }} />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: '#4f46e5' }} />
                      </span>
                      Live
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs" style={{ color: '#9ca3af' }}>
                  <code className="font-mono">{runId}</code>
                  {run?.startedAt && (
                    <>
                      <span style={{ color: '#d1d5db' }}>&middot;</span>
                      <span>{formatDateTime(run.startedAt)}</span>
                    </>
                  )}
                  {run?.completedAt && (
                    <>
                      <span style={{ color: '#d1d5db' }}>&middot;</span>
                      <span>{formatDateTime(run.completedAt)}</span>
                    </>
                  )}
                </div>
              </div>

              {duration && (
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#d1d5db' }}>
                    {run?.status === 'completed' ? 'Completed in' : run?.status === 'failed' ? 'Failed after' : 'Running for'}
                  </p>
                  <p className="text-3xl font-black tabular-nums font-mono" style={{ color: '#111827' }}>
                    {duration}
                  </p>
                </div>
              )}
            </div>

            {run && <PhaseProgress status={run.status} />}
          </div>

          {/* Section tabs — attached to header */}
          <div style={{ borderTop: '1px solid #f3f4f6' }}>
            <SectionTabs
              activeSection={activeSection}
              dataDots={dataDots}
              onSelect={selectSection}
            />
          </div>
        </div>
      </div>

      {/* ===== CONTENT ===== */}
      <div className="max-w-5xl mx-auto px-8 py-6">
        {/* ===== SECTION B: SIGNAL SCOUTS ===== */}
        {activeSection === 0 && <div className="rounded-xl p-6" style={sectionStyle}>
          <SectionHeader number="01" title="Signal Scouts" icon={<span style={{ color: '#4f46e5' }}>📡</span>} />

          {scouts.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: '#9ca3af' }}>
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
                        <p className="text-xs" style={{ color: '#9ca3af' }}>
                          Signals
                        </p>
                        <p className="text-xl font-bold" style={{ color: cfg.textColor }}>
                          {signalCount}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: '#9ca3af' }}>
                          Viral Trends
                        </p>
                        <p className="text-sm font-semibold" style={{ color: '#4b5563' }}>
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
                  style={{ border: '1px solid #e5e7eb' }}
                >
                  {/* Platform tab switcher */}
                  <div
                    className="flex gap-1 p-3"
                    style={{ borderBottom: '1px solid #f3f4f6', background: '#f3f4f6' }}
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
                                  color: '#4b5563',
                                  border: '1px solid #e5e7eb',
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
                              <p className="text-xs font-medium mb-2.5" style={{ color: '#9ca3af' }}>
                                Trending Topics
                              </p>
                              <div className="flex flex-col gap-1.5">
                                {topics.slice(0, 5).map((t, i) => (
                                  <div key={i} className="flex items-center justify-between gap-2">
                                    <span className="text-xs truncate" style={{ color: '#4b5563' }}>
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
                              <p className="text-xs font-medium mb-2.5" style={{ color: '#9ca3af' }}>
                                Hook Examples
                              </p>
                              <div className="flex flex-col gap-1.5">
                                {hooks.slice(0, 4).map((h, i) => (
                                  <p
                                    key={i}
                                    className="text-xs italic leading-relaxed"
                                    style={{ color: '#4b5563' }}
                                  >
                                    &ldquo;{h}&rdquo;
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}
                          {formats.length > 0 && (
                            <div>
                              <p className="text-xs font-medium mb-2.5" style={{ color: '#9ca3af' }}>
                                Format Insights
                              </p>
                              <div className="flex flex-col gap-1.5">
                                {formats.slice(0, 4).map((f, i) => (
                                  <p key={i} className="text-xs leading-relaxed" style={{ color: '#4b5563' }}>
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
                    style={{ color: '#9ca3af' }}
                  >
                    Top Signals
                  </h3>
                  <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #e5e7eb' }}>
                    <table className="w-full">
                      <thead>
                        <tr style={{ borderBottom: '1px solid #f3f4f6', background: '#f3f4f6' }}>
                          {['Rank', 'Topic', 'Platforms', 'Score', 'Rationale'].map((h) => (
                            <th
                              key={h}
                              className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider"
                              style={{ color: '#9ca3af' }}
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
                              className="transition-colors hover:bg-slate-50"
                              style={{ borderBottom: '1px solid #f3f4f6' }}
                            >
                              <td className="px-4 py-3 text-sm" style={{ color: '#9ca3af' }}>
                                {idx + 1}
                              </td>
                              <td className="px-4 py-3 text-sm font-medium" style={{ color: '#111827' }}>
                                {sig.topic}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex gap-1 flex-wrap">
                                  {sig.platforms.map((p) => (
                                    <span
                                      key={p}
                                      className="text-xs px-1.5 py-0.5 rounded"
                                      style={{ background: '#f3f4f6', color: '#4b5563' }}
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
                                className="px-4 py-3 text-xs max-w-50 truncate"
                                style={{ color: '#4b5563' }}
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
            <p className="text-sm text-center py-6" style={{ color: '#9ca3af' }}>
              No research data available yet.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {research.map((r, idx) => {
                const insights = r.structured?.insights ?? []
                const summary = r.structured?.rawSummary
                const isExpanded = researchExpanded[idx] ?? false
                const fallbackText = r.content || ''
                const urgencyStyle = (u: string) =>
                  u === 'high' ? { bg: '#fee2e2', color: '#b91c1c', border: '#fecaca' }
                  : u === 'medium' ? { bg: '#fef3c7', color: '#b45309', border: '#fde68a' }
                  : { bg: '#f3f4f6', color: '#4b5563', border: '#e5e7eb' }
                return (
                  <div key={idx} className="rounded-xl overflow-hidden" style={{ border: '1px solid #e5e7eb' }}>
                    {/* Header */}
                    <div className="px-4 py-3 flex items-center justify-between" style={{ background: '#f3f4f6', borderBottom: '1px solid #f3f4f6' }}>
                      <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#4b5563' }}>
                        {r.type === 'competitor' ? '🏆 Competitor' : '📊 Market'} Research
                      </h4>
                      {insights.length > 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#e0e7ff', color: '#4f46e5' }}>
                          {insights.length} insight{insights.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    <div className="p-4">
                      {/* Summary */}
                      {summary && (
                        <p className="text-sm leading-relaxed mb-4" style={{ color: '#4b5563' }}>{summary}</p>
                      )}

                      {/* Structured insights */}
                      {insights.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          {insights.map((ins, i) => {
                            const us = urgencyStyle(ins.urgency)
                            return (
                              <div key={i} className="rounded-lg p-3" style={{ background: '#f3f4f6', border: '1px solid #f3f4f6' }}>
                                <div className="flex items-start justify-between gap-3 mb-1.5">
                                  <p className="text-sm font-medium leading-snug flex-1" style={{ color: '#111827' }}>{ins.insight}</p>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: us.bg, color: us.color, border: `1px solid ${us.border}` }}>
                                      {ins.urgency}
                                    </span>
                                    <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: '#f3f4f6', color: '#4b5563' }}>
                                      {ins.score}/10
                                    </span>
                                  </div>
                                </div>
                                <p className="text-xs leading-relaxed" style={{ color: '#4b5563' }}>→ {ins.implication}</p>
                                {ins.source && (
                                  <a href={ins.source} target="_blank" rel="noopener noreferrer" className="text-xs mt-1 block truncate" style={{ color: '#4f46e5' }}>
                                    {ins.source}
                                  </a>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      ) : fallbackText ? (
                        /* Fallback to raw text if no structured data */
                        <>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#4b5563' }}>
                            {isExpanded ? fallbackText : fallbackText.slice(0, 500) + (fallbackText.length > 500 ? '…' : '')}
                          </p>
                          {fallbackText.length > 500 && (
                            <button onClick={() => setResearchExpanded(prev => ({ ...prev, [idx]: !isExpanded }))} className="mt-2 text-xs font-medium" style={{ color: '#4f46e5' }}>
                              {isExpanded ? 'Show less' : 'Read more'}
                            </button>
                          )}
                        </>
                      ) : (
                        <p className="text-sm" style={{ color: '#9ca3af' }}>No data available.</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        }

        {/* ===== SECTION D: STRATEGY ===== */}
        {/* ===== SECTION: AD LIBRARY ===== */}
        {activeSection === 2 && (
          <div className="rounded-xl p-6" style={sectionStyle}>
            <SectionHeader number="03" title="Meta Ad Library" icon={<span>🏪</span>} />
            {!adLibrary ? (
              <p className="text-sm text-center py-6" style={{ color: '#9ca3af' }}>No ad library data available for this run.</p>
            ) : (
              <div className="flex flex-col gap-5">
                {/* Summary strip */}
                {(adLibrary.dominantFormat || adLibrary.rawSummary) && (
                  <div className="rounded-xl p-4" style={{ background: '#f3f4f6', border: '1px solid #e5e7eb' }}>
                    {adLibrary.rawSummary && <p className="text-sm leading-relaxed mb-2" style={{ color: '#4b5563' }}>{adLibrary.rawSummary}</p>}
                    {adLibrary.dominantFormat && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: '#e0e7ff', color: '#4338ca', border: '1px solid #c7d2fe' }}>
                        Dominant format: {adLibrary.dominantFormat}
                      </span>
                    )}
                  </div>
                )}

                {/* Competitor ads */}
                {adLibrary.competitorAds?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#9ca3af' }}>Competitor Ads Running Now</h3>
                    <div className="flex flex-col gap-2">
                      {adLibrary.competitorAds.map((ad, i) => (
                        <div key={i} className="rounded-xl p-4" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' }}>
                                {ad.competitor}
                              </span>
                              {ad.format && (
                                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#faf5ff', color: '#7c3aed', border: '1px solid #e9d5ff' }}>{ad.format}</span>
                              )}
                              {ad.angle && (
                                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#f3f4f6', color: '#4b5563', border: '1px solid #e5e7eb' }}>{ad.angle}</span>
                              )}
                              {ad.estimatedDaysRunning != null && (
                                <span className="text-xs" style={{ color: '#9ca3af' }}>{ad.estimatedDaysRunning}d running</span>
                              )}
                            </div>
                            {ad.score != null && (
                              <span className="text-xs font-bold px-2 py-0.5 rounded shrink-0" style={{ background: ad.score >= 8 ? '#dcfce7' : '#fef3c7', color: ad.score >= 8 ? '#15803d' : '#b45309' }}>
                                {ad.score}/10
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium italic mb-1" style={{ color: '#111827' }}>&ldquo;{ad.hook}&rdquo;</p>
                          {ad.cta && <p className="text-xs" style={{ color: '#4b5563' }}>CTA: <span style={{ color: '#1d4ed8' }}>{ad.cta}</span></p>}
                          {ad.source && (
                            <a href={ad.source} target="_blank" rel="noopener noreferrer" className="text-xs mt-1 block truncate" style={{ color: '#4f46e5' }}>{ad.source}</a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Gaps / opportunities */}
                {adLibrary.gaps?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#9ca3af' }}>Untapped Angles — Nobody Is Running These</h3>
                    <div className="flex flex-col gap-2">
                      {adLibrary.gaps.map((g, i) => {
                        const us = g.urgency === 'high'
                          ? { bg: '#fee2e2', color: '#b91c1c', border: '#fecaca' }
                          : g.urgency === 'medium'
                          ? { bg: '#fef3c7', color: '#b45309', border: '#fde68a' }
                          : { bg: '#f3f4f6', color: '#4b5563', border: '#e5e7eb' }
                        return (
                          <div key={i} className="rounded-xl p-4" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                            <div className="flex items-start justify-between gap-3 mb-1.5">
                              <p className="text-sm font-semibold flex-1" style={{ color: '#111827' }}>{g.gap}</p>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: us.bg, color: us.color, border: `1px solid ${us.border}` }}>{g.urgency}</span>
                                {g.score != null && <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: '#f3f4f6', color: '#4b5563' }}>{g.score}/10</span>}
                              </div>
                            </div>
                            <p className="text-xs leading-relaxed" style={{ color: '#15803d' }}>→ {g.opportunity}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===== SECTION: STRATEGY ===== */}
        {activeSection === 3 && (
          <StrategyTab
            briefs={briefs}
            run={run}
            tenantId={tenantId}
            creativeBrief={creativeBrief}
            creativePackage={creativePackage}
            copyVariants={copyVariants}
            selectedCopyIndex={selectedCopyIndex}
            campaign={campaign ?? undefined}
            siblingCampaigns={siblingCampaigns}
            producedRuns={producedRuns}
            producingBrief={producingBrief}
            onProduce={handleProduce}
            onApprove={handleApprove}
            approveState={approveState}
            rejectOpen={rejectOpen}
            onRejectOpen={() => setRejectOpen((o) => !o)}
            rejectReason={rejectReason}
            onRejectReasonChange={setRejectReason}
            onReject={handleReject}
            rejectState={rejectState}
            onRejectCancel={() => setRejectOpen(false)}
            sectionStyle={sectionStyle}
          />
        )}

        {/* ===== SECTION E: CREATIVE OUTPUT ===== */}
        {activeSection === 4 && (() => {
          const entries: CreativeEntryType[] = []

          // Winner
          if (creativePackage) {
            entries.push({
              briefId: run?.selectedBriefId ?? 'winner',
              topic: creativeBrief?.topic ?? 'Strategy Pick',
              isWinner: true,
              pkg: creativePackage,
              variants: copyVariants,
              selectedIdx: selectedCopyIndex,
              creativePackageId: campaign?.creativePackageId,
            })
          }

          // Produced non-winners — use fetched creative package if available
          for (const [briefId, sibCamp] of Object.entries(siblingCampaigns)) {
            const topic =
              briefs.find((b) => b.briefId === briefId)?.topic ?? 'Produced Idea'
            const pkg = siblingCreativePackages[briefId] ?? null
            entries.push({
              briefId,
              topic,
              isWinner: false,
              pkg,
              variants: pkg?.copyVariants ?? [],
              selectedIdx: pkg?.selectedCopyIndex,
              campaignId: pkg ? undefined : sibCamp._id,
              creativePackageId: sibCamp.creativePackageId,
            })
          }

          return (
            <div className="rounded-xl p-6" style={sectionStyle}>
              <SectionHeader
                number="05"
                title={`Creative Output${entries.length > 1 ? ` — ${entries.length} ideas` : ''}`}
                icon={<ImageIcon size={16} style={{ color: '#4f46e5' }} />}
              />

              {entries.length === 0 ? (
                <div className="rounded-lg p-5 text-center" style={{ background: '#f3f4f6', border: '1px solid #e5e7eb' }}>
                  <p className="text-sm" style={{ color: '#9ca3af' }}>No creative packages available yet.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {entries.map((entry) => (
                    <CreativeEntryCard
                      key={entry.briefId}
                      entry={entry}
                      tenantId={tenantId}
                      defaultOpen={entry.isWinner}
                      onRefresh={fetchFull}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })()}

        {/* ===== SECTION F: CAMPAIGN REVIEW ===== */}
        {activeSection === 5 && (() => {
          type CampaignEntry = {
            briefId: string
            topic: string
            isWinner: boolean
            camp: Campaign
          }
          const campEntries: CampaignEntry[] = []

          if (campaign) {
            campEntries.push({
              briefId: run?.selectedBriefId ?? 'winner',
              topic: creativeBrief?.topic ?? 'Strategy Pick',
              isWinner: true,
              camp: campaign,
            })
          }

          for (const [briefId, sibCamp] of Object.entries(siblingCampaigns)) {
            const topic =
              briefs.find((b) => b.briefId === briefId)?.topic ?? 'Produced Idea'
            campEntries.push({
              briefId,
              topic,
              isWinner: false,
              camp: sibCamp,
            })
          }

          return (
            <div className="rounded-xl p-6" style={sectionStyle}>
              <SectionHeader
                number="06"
                title={`Campaign Review${campEntries.length > 1 ? ` — ${campEntries.length} campaigns` : ''}`}
                icon={<Megaphone size={16} style={{ color: '#4f46e5' }} />}
              />

              {campEntries.length === 0 ? (
                <div className="rounded-lg p-5 text-center" style={{ background: '#f3f4f6', border: '1px solid #e5e7eb' }}>
                  <p className="text-sm" style={{ color: '#9ca3af' }}>No campaigns linked to this run yet.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {campEntries.map((entry) => (
                    <div
                      key={entry.briefId}
                      className="rounded-xl overflow-hidden"
                      style={
                        entry.isWinner
                          ? { border: '2px solid #fbbf24', background: '#ffffff' }
                          : { border: '1px solid #e5e7eb', background: '#ffffff' }
                      }
                    >
                      {/* Campaign header */}
                      <div
                        className="px-5 py-3 flex items-center gap-3 flex-wrap"
                        style={{
                          background: entry.isWinner ? '#fffbeb' : '#f3f4f6',
                          borderBottom: `1px solid ${entry.isWinner ? '#fde68a' : '#e5e7eb'}`,
                        }}
                      >
                        {entry.isWinner ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
                            <Star size={9} fill="currentColor" /> Strategy Pick
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }}>
                            <CheckCircle2 size={9} /> Produced
                          </span>
                        )}
                        <h3 className="text-sm font-semibold flex-1 truncate" style={{ color: '#111827' }}>
                          {entry.topic}
                        </h3>
                        <StatusBadge status={entry.camp.status} />
                      </div>

                      {/* Campaign content */}
                      <div className="px-5 flex flex-col">
                        {/* Always-visible: status / budget / objective */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 py-4">
                          <div className="rounded-lg p-3" style={{ background: '#f3f4f6', border: '1px solid #e5e7eb' }}>
                            <p className="text-xs mb-1" style={{ color: '#9ca3af' }}>Status</p>
                            <StatusBadge status={entry.camp.status} />
                          </div>
                          <div className="rounded-lg p-3" style={{ background: '#f3f4f6', border: '1px solid #e5e7eb' }}>
                            <p className="text-xs mb-1" style={{ color: '#9ca3af' }}>Budget</p>
                            <p className="text-sm font-semibold" style={{ color: '#111827' }}>
                              {entry.camp.budget ? formatCurrency(entry.camp.budget) : '—'}
                            </p>
                            {entry.camp.reviewAdjustments?.budgetAdjusted && (
                              <p className="text-xs mt-0.5" style={{ color: '#b45309' }}>
                                orig. {formatCurrency(entry.camp.reviewAdjustments.originalBudget)} → {formatCurrency(entry.camp.reviewAdjustments.recommendedBudget)}
                              </p>
                            )}
                          </div>
                          <div className="rounded-lg p-3" style={{ background: '#f3f4f6', border: '1px solid #e5e7eb' }}>
                            <p className="text-xs mb-1" style={{ color: '#9ca3af' }}>Objective</p>
                            <p className="text-sm" style={{ color: '#4b5563' }}>{entry.camp.objective || '—'}</p>
                          </div>
                        </div>

                        {/* Ad set config accordion */}
                        {entry.camp.campaignConfig?.adSets && entry.camp.campaignConfig.adSets.length > 0 && (
                          <AccordionSection
                            title="Ad Set Configuration"
                            badge={
                              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#f3f4f6', color: '#4b5563' }}>
                                {entry.camp.campaignConfig.adSets.length} set{entry.camp.campaignConfig.adSets.length !== 1 ? 's' : ''}
                              </span>
                            }
                          >
                            <div className="rounded-lg overflow-x-auto" style={{ border: '1px solid #e5e7eb' }}>
                              <table className="w-full">
                                <thead>
                                  <tr style={{ borderBottom: '1px solid #f3f4f6', background: '#f3f4f6' }}>
                                    {['Name','Audience','Budget %','Meta Audience ID','Age','Geo','Optimization'].map((h) => (
                                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#9ca3af' }}>{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {entry.camp.campaignConfig.adSets.map((adSet, idx) => (
                                    <tr key={idx} className="transition-colors hover:bg-slate-50" style={{ borderBottom: '1px solid #f3f4f6' }}>
                                      <td className="px-4 py-3 text-sm" style={{ color: '#111827' }}>{adSet.name}</td>
                                      <td className="px-4 py-3 text-xs" style={{ color: '#4b5563' }}>{adSet.audienceType}</td>
                                      <td className="px-4 py-3 text-sm" style={{ color: '#4b5563' }}>{adSet.budgetPercent}%</td>
                                      <td className="px-4 py-3 text-xs font-mono" style={{ color: '#9ca3af' }}>{adSet.metaAudienceId || '—'}</td>
                                      <td className="px-4 py-3 text-xs" style={{ color: '#4b5563' }}>{adSet.ageMin || adSet.ageMax ? `${adSet.ageMin ?? '?'}–${adSet.ageMax ?? '?'}` : '—'}</td>
                                      <td className="px-4 py-3 text-xs" style={{ color: '#4b5563' }}>{adSet.geoLocations?.join(', ') || '—'}</td>
                                      <td className="px-4 py-3 text-xs" style={{ color: '#4b5563' }}>{adSet.optimizationGoal || '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </AccordionSection>
                        )}

                        {/* Scale / pause rules accordion */}
                        {(entry.camp.campaignConfig?.scaleRules || entry.camp.campaignConfig?.pauseRules) && (
                          <AccordionSection title="Scale & Pause Rules">
                            <div className="flex flex-col gap-3">
                              {entry.camp.campaignConfig?.scaleRules && (
                                <div>
                                  <p className="text-xs font-medium mb-1.5" style={{ color: '#9ca3af' }}>Scale Rules</p>
                                  <pre className="text-xs rounded-lg p-3 whitespace-pre-wrap leading-relaxed" style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#4b5563' }}>{entry.camp.campaignConfig.scaleRules}</pre>
                                </div>
                              )}
                              {entry.camp.campaignConfig?.pauseRules && (
                                <div>
                                  <p className="text-xs font-medium mb-1.5" style={{ color: '#9ca3af' }}>Pause Rules</p>
                                  <pre className="text-xs rounded-lg p-3 whitespace-pre-wrap leading-relaxed" style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#4b5563' }}>{entry.camp.campaignConfig.pauseRules}</pre>
                                </div>
                              )}
                            </div>
                          </AccordionSection>
                        )}

                        {/* Review debate accordion */}
                        {entry.camp.reviewDebateLog && entry.camp.reviewDebateLog.length > 0 && (
                          <AccordionSection
                            title="Review Debate"
                            badge={
                              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#f3f4f6', color: '#4b5563' }}>
                                {entry.camp.reviewDebateLog.length} rounds
                              </span>
                            }
                          >
                            <DebateLog rounds={entry.camp.reviewDebateLog} />
                          </AccordionSection>
                        )}

                        {/* View full / Approve+Reject */}
                        {entry.camp._id && entry.camp.status !== 'pending_approval' && (
                          <div className="py-3">
                            <Link
                              href={`/dashboard/${tenantId}/campaigns/${entry.camp._id}`}
                              className="inline-flex items-center gap-2 text-sm font-medium transition-colors"
                              style={{ color: '#4f46e5' }}
                            >
                              View full campaign details <ArrowRight size={14} />
                            </Link>
                          </div>
                        )}

                        {entry.isWinner && entry.camp.status === 'pending_approval' && (
                          <div className="rounded-xl p-5 flex flex-col gap-4 my-3" style={{ background: '#f3f4f6', border: '2px solid #e5e7eb' }}>
                            <div className="text-center">
                              <p className="text-sm font-semibold" style={{ color: '#111827' }}>This campaign is awaiting your approval</p>
                              <p className="text-xs mt-1" style={{ color: '#4b5563' }}>Review the details above before approving or rejecting</p>
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
                                {approveState === 'loading' ? <Loader2 size={18} className="animate-spin" /> : <ThumbsUp size={18} />}
                                {approveState === 'loading' ? 'Approving…' : approveState === 'success' ? 'Approved!' : 'Approve & Launch Campaign'}
                              </button>
                              <button
                                onClick={() => setRejectOpen((o) => !o)}
                                className="w-full flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl text-sm font-semibold transition-all"
                                style={{ background: '#fee2e2', color: '#b91c1c', border: '2px solid #fecaca' }}
                              >
                                <XCircle size={16} /> Reject Campaign
                              </button>
                            </div>
                            {rejectOpen && (
                              <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
                                <p className="text-xs font-semibold" style={{ color: '#b91c1c' }}>Reason for rejection</p>
                                <textarea
                                  value={rejectReason}
                                  onChange={(e) => setRejectReason(e.target.value)}
                                  placeholder="Describe why this campaign is being rejected…"
                                  rows={3}
                                  className="w-full rounded-lg px-3 py-2 text-sm resize-none"
                                  style={{ background: '#ffffff', border: '1px solid #fecaca', color: '#111827', outline: 'none' }}
                                />
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={handleReject}
                                    disabled={rejectState === 'loading' || !rejectReason.trim()}
                                    className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#b91c1c' }}
                                  >
                                    {rejectState === 'loading' ? 'Rejecting…' : 'Confirm Reject'}
                                  </button>
                                  <button onClick={() => setRejectOpen(false)} className="text-xs transition-colors" style={{ color: '#9ca3af' }}>
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Non-winner pending approval — link to campaign */}
                        {!entry.isWinner && entry.camp.status === 'pending_approval' && entry.camp._id && (
                          <div className="rounded-xl p-4 flex items-center justify-between gap-3 my-3" style={{ background: '#fefce8', border: '1px solid #fde68a' }}>
                            <p className="text-xs font-medium" style={{ color: '#b45309' }}>Awaiting approval</p>
                            <Link
                              href={`/dashboard/${tenantId}/campaigns/${entry.camp._id}`}
                              className="inline-flex items-center gap-1 text-xs font-semibold shrink-0"
                              style={{ color: '#b45309', textDecoration: 'none' }}
                            >
                              Review Campaign <ArrowRight size={11} />
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })()}
      </div>
    </div>
  )
}
