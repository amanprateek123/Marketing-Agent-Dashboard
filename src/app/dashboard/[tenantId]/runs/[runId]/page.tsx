'use client'

import { useState, useEffect, useCallback, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Loader2,
  Star,
  Image as ImageIcon,
  Video,
  Sparkles,
  AlertCircle,
  ThumbsUp,
  XCircle,
  ArrowRight,
  Megaphone,
  ChevronDown,
  Play,
} from 'lucide-react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { DebateLog } from '@/components/ui/DebateLog'
import { StrategyTab } from '@/components/pipeline/StrategyTab'
import { PromptsVersionBadge } from '@/components/badges'
import { triggerPipeline } from '@/lib/api'
import { formatCurrency, formatDateTime, cn } from '@/lib/utils'
import type { FullRunData, CopyVariant, CreativePackage, Campaign } from '@/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8082/api/v1'

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
  { key: 'scouts', label: 'Signals' },
  { key: 'intelligence', label: 'Synthesis' },
  { key: 'research', label: 'Research' },
  { key: 'ideas', label: 'Strategy' },
  { key: 'digest', label: 'Brief' },
  { key: 'creative', label: 'Creative' },
  { key: 'campaign', label: 'Launch' },
]
const FINAL_PHASE_IDX = PHASES.length // 7 — sentinel for "completed"

function getPhaseIndex(status: string): number {
  const s = (status || '').toLowerCase()
  if (s === 'scouts_running') return 0
  if (s === 'intelligence_running') return 1
  if (s === 'research_running') return 2
  if (s === 'idea_pool_running') return 3
  if (s === 'digest_running') return 4
  if (s === 'creative_running') return 5
  if (s === 'campaign_launching') return 6
  if (s === 'completed') return FINAL_PHASE_IDX
  return -1
}

function PhaseProgress({ status }: { status: string }) {
  const currentPhaseIdx = getPhaseIndex(status)
  const isFailed = (status || '').toLowerCase() === 'failed'

  return (
    <div className="mt-6">
      <div className="relative flex items-center mb-2">
        {/* Track */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px" style={{ background: 'var(--hairline)' }} />
        {/* Fill */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-px transition-all duration-1000 ease-out"
          style={{
            background: isFailed ? 'var(--bad)' : 'var(--good)',
            width: currentPhaseIdx === FINAL_PHASE_IDX
              ? '100%'
              : currentPhaseIdx < 0
              ? '0%'
              : `${(currentPhaseIdx / (PHASES.length - 1)) * 100}%`,
          }}
        />
        <div className="relative flex justify-between w-full">
          {PHASES.map((phase, idx) => {
            const done = currentPhaseIdx > idx || currentPhaseIdx === FINAL_PHASE_IDX
            const active = currentPhaseIdx === idx && !isFailed
            return (
              <div key={phase.key} className="flex flex-col items-center">
                <div
                  className={cn('w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300', active && 'animate-pulse')}
                  style={
                    done
                      ? { background: 'var(--good)' }
                      : active
                      ? { background: 'var(--surface)', border: '2px solid var(--accent)', boxShadow: '0 0 0 3px var(--accent-bg)' }
                      : isFailed && idx <= currentPhaseIdx
                      ? { background: 'var(--bad)' }
                      : { background: 'var(--surface-warm)', border: '1.5px solid var(--hairline)' }
                  }
                >
                  {done ? (
                    <CheckCircle2 size={12} style={{ color: '#fff' }} />
                  ) : active ? (
                    <Loader2 size={11} className="animate-spin" style={{ color: 'var(--accent)' }} />
                  ) : isFailed && idx <= currentPhaseIdx ? (
                    <Circle size={8} style={{ color: '#fff' }} />
                  ) : (
                    <span className="text-[8px] font-bold" style={{ color: 'var(--ink-4)' }}>{idx + 1}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="flex justify-between">
        {PHASES.map((phase, idx) => {
          const done = currentPhaseIdx > idx || currentPhaseIdx === FINAL_PHASE_IDX
          const active = currentPhaseIdx === idx && !isFailed
          return (
            <span
              key={phase.key}
              className="text-[10px] font-medium text-center"
              style={{ color: done ? 'var(--good)' : active ? 'var(--accent)' : 'var(--ink-4)', width: 64 }}
            >
              {phase.label}
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ── Failure banner ────────────────────────────────────────────────────────
const STUCK_RUN_PREFIX = 'Auto-marked failed by stuck-run sweeper'

function FailureBanner({ tenantId, error }: { tenantId: string; error?: string }) {
  const [resuming, setResuming] = useState(false)
  const [resumeError, setResumeError] = useState<string | null>(null)
  const router = useRouter()

  if (!error) {
    return (
      <div
        className="rounded-xl px-4 py-3 mt-4 flex items-start gap-3"
        style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad-border)' }}
      >
        <span className="shrink-0 text-base">❌</span>
        <p className="text-sm font-medium" style={{ color: 'var(--bad)' }}>
          Run failed without an error message.
        </p>
      </div>
    )
  }

  const isAutoRecovery = error.startsWith(STUCK_RUN_PREFIX)

  async function handleResume() {
    setResuming(true)
    setResumeError(null)
    try {
      const data = await triggerPipeline(tenantId)
      if (data.runId) router.push(`/dashboard/${tenantId}/runs/${data.runId}`)
    } catch (e) {
      setResumeError(e instanceof Error ? e.message : 'Resume failed')
      setResuming(false)
    }
  }

  if (isAutoRecovery) {
    return (
      <div
        className="rounded-xl px-4 py-3 mt-4 flex items-start gap-3 flex-wrap"
        style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-border)' }}
      >
        <span className="shrink-0 text-base">⏰</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: 'var(--warn)' }}>
            Auto-recovered after timeout
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--warn)' }}>
            {error}
          </p>
          {resumeError && (
            <p className="text-xs mt-1" style={{ color: 'var(--bad)' }}>{resumeError}</p>
          )}
        </div>
        <button
          onClick={handleResume}
          disabled={resuming}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-60 shrink-0"
          style={{ background: 'var(--warn)', color: '#fff' }}
        >
          {resuming ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} fill="currentColor" />}
          {resuming ? 'Triggering…' : 'Resume'}
        </button>
      </div>
    )
  }

  return (
    <div
      className="rounded-xl px-4 py-3 mt-4 flex items-start gap-3"
      style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad-border)' }}
    >
      <span className="shrink-0 text-base">❌</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: 'var(--bad)' }}>Failed</p>
        <p className="text-xs mt-0.5 break-words" style={{ color: 'var(--bad)' }}>{error}</p>
      </div>
    </div>
  )
}

// ── Score badge ───────────────────────────────────────────────────────────────

// Retained for the alternate compact-score layout used by run exports.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ScoreBadge({ score }: { score?: number }) {
  if (score === undefined || score === null) return null
  const style =
    score >= 8
      ? { background: 'var(--good-bg)', color: 'var(--good)', border: '1px solid var(--good-border)' }
      : score >= 6
      ? { background: 'var(--warn-bg)', color: 'var(--warn)', border: '1px solid var(--warn-border)' }
      : { background: 'var(--bad-bg)', color: 'var(--bad)', border: '1px solid var(--bad-border)' }
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={style}>
      {score.toFixed(1)}
    </span>
  )
}

// ── Score bar ─────────────────────────────────────────────────────────────────

// Retained for the alternate compact-score layout used by run exports.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ScoreBar({ score, max = 10 }: { score?: number; max?: number }) {
  if (score === undefined || score === null) return null
  const pct = Math.max(0, Math.min(100, (score / max) * 100))
  const color = score >= 8 ? 'var(--good)' : score >= 6 ? 'var(--warn)' : 'var(--bad)'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 5, background: 'var(--hairline)' }}>
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
    <div style={{ borderTop: '1px solid var(--hairline)' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-1 py-3 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold" style={{ color: 'var(--ink-2)' }}>
            {title}
          </span>
          {badge}
        </div>
        <ChevronDown
          size={14}
          className="shrink-0 transition-transform duration-200"
          style={{
            color: 'var(--ink-3)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>
      {open && <div className="pb-4">{children}</div>}
    </div>
  )
}

// ── Idea row (with optional inline creative + campaign) ────────────────────────

// Retained for backward-compatible rendering of archived run payloads.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    <div className="flex flex-col gap-4 pt-4" style={{ borderTop: '1px solid var(--hairline)' }}>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
        Creative Output
      </p>

      {copyVariants.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium" style={{ color: 'var(--ink-2)' }}>Copy Variants</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {copyVariants.map((v, idx) => (
              <div
                key={idx}
                className="rounded-lg p-4 flex flex-col gap-2"
                style={
                  idx === selectedCopyIndex
                    ? { background: 'var(--accent-bg)', border: '2px solid var(--accent)' }
                    : { background: 'var(--muted)', border: '1px solid var(--hairline)' }
                }
              >
                {idx === selectedCopyIndex && (
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full self-start"
                    style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}
                  >
                    Selected
                  </span>
                )}
                {v.hookStyle && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full self-start"
                    style={{ background: 'var(--muted)', color: 'var(--ink-2)', border: '1px solid var(--hairline)' }}
                  >
                    {v.hookStyle}
                  </span>
                )}
                {v.headline && (
                  <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{v.headline}</p>
                )}
                <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-2)' }}>{v.primaryText}</p>
                {v.cta && (
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-md self-start"
                    style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}
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
                    {isSel && <span className="absolute top-1 left-1 z-10 text-[9px] font-semibold px-1 py-0.5 rounded" style={{ background: 'var(--good)', color: '#fff' }}>Selected</span>}
                    {img.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img.imageUrl} alt={`Variant ${i + 1}`} className="rounded-lg w-full" style={{ border: isSel ? '2px solid var(--good)' : '1px solid var(--hairline)', maxHeight: 300, objectFit: 'contain', display: 'block' }} />
                    ) : (
                      <div className="rounded-lg flex items-center justify-center" style={{ height: 200, background: 'var(--muted)', border: '1px dashed var(--ink-4)' }}>
                        <p className="text-[10px]" style={{ color: 'var(--ink-4)' }}>V{i + 1}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div
              className="mt-2 h-20 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--muted)', border: '1px solid var(--hairline)' }}
            >
              <p className="text-xs" style={{ color: 'var(--ink-4)' }}>Image not yet generated</p>
            </div>
          )}
        </div>
      )}

      {creativePackage.complianceNotes && (
        <div
          className="rounded-lg p-3"
          style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-border)' }}
        >
          <p className="text-xs font-semibold mb-1" style={{ color: 'var(--warn)' }}>Compliance Notes</p>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--warn)' }}>{creativePackage.complianceNotes}</p>
        </div>
      )}
    </div>
  )
}

// Retained for backward-compatible rendering of archived run payloads.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    <div className="flex flex-col gap-4 pt-4" style={{ borderTop: '1px solid var(--hairline)' }}>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
        Campaign
      </p>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg p-3" style={{ background: 'var(--muted)', border: '1px solid var(--hairline)' }}>
          <p className="text-xs mb-1" style={{ color: 'var(--ink-3)' }}>Status</p>
          <StatusBadge status={campaign.status} />
        </div>
        <div className="rounded-lg p-3" style={{ background: 'var(--muted)', border: '1px solid var(--hairline)' }}>
          <p className="text-xs mb-1" style={{ color: 'var(--ink-3)' }}>Budget</p>
          <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            {campaign.budget ? formatCurrency(campaign.budget) : '—'}
          </p>
        </div>
        <div className="rounded-lg p-3" style={{ background: 'var(--muted)', border: '1px solid var(--hairline)' }}>
          <p className="text-xs mb-1" style={{ color: 'var(--ink-3)' }}>Objective</p>
          <p className="text-xs" style={{ color: 'var(--ink-2)' }}>{campaign.objective || '—'}</p>
        </div>
      </div>

      {campaign.status === 'pending_approval' && (
        <div
          className="rounded-xl p-4 flex flex-col gap-3"
          style={{ background: 'var(--muted)', border: '2px solid var(--hairline)' }}
        >
          <p className="text-xs font-semibold text-center" style={{ color: 'var(--ink)' }}>
            Awaiting your approval
          </p>
          <div className="flex gap-2">
            <button
              onClick={onApprove}
              disabled={approveState !== 'idle'}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-60"
              style={{
                background: approveState !== 'idle' ? 'var(--good-bg)' : 'var(--good)',
                color: approveState !== 'idle' ? 'var(--good)' : 'var(--surface)',
                border: '2px solid var(--good)',
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
              style={{ background: 'var(--bad-bg)', color: 'var(--bad)', border: '2px solid var(--bad-border)' }}
            >
              <XCircle size={14} />
              Reject
            </button>
          </div>

          {rejectOpen && (
            <div
              className="rounded-lg p-3 flex flex-col gap-2"
              style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad-border)' }}
            >
              <p className="text-xs font-semibold" style={{ color: 'var(--bad)' }}>Reason for rejection</p>
              <textarea
                value={rejectReason}
                onChange={(e) => onRejectReasonChange(e.target.value)}
                placeholder="Describe why…"
                rows={2}
                className="w-full rounded-lg px-3 py-2 text-xs resize-none"
                style={{ background: 'var(--surface)', border: '1px solid var(--bad-border)', color: 'var(--ink)', outline: 'none' }}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={onReject}
                  disabled={rejectState === 'loading' || !rejectReason.trim()}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                  style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad-border)', color: 'var(--bad)' }}
                >
                  {rejectState === 'loading' ? 'Rejecting…' : 'Confirm Reject'}
                </button>
                <button onClick={onRejectCancel} className="text-xs" style={{ color: 'var(--ink-3)' }}>
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
          style={{ color: 'var(--accent)', textDecoration: 'none' }}
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
      return { emoji: '📸', textColor: 'var(--accent)', bg: 'var(--accent-bg)', border: 'var(--accent-border)' }
    case 'reddit':
      return { emoji: '🗨️', textColor: 'var(--warn)', bg: 'var(--warn-bg)', border: 'var(--warn-border)' }
    case 'twitter':
      return { emoji: '🐦', textColor: 'var(--info)', bg: 'var(--info-bg)', border: 'var(--info-border)' }
    case 'youtube':
      return { emoji: '📺', textColor: 'var(--bad)', bg: 'var(--bad-bg)', border: 'var(--bad-border)' }
    default:
      return { emoji: '📡', textColor: 'var(--ink-2)', bg: 'var(--muted)', border: 'var(--hairline)' }
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
      <span className="mono text-xs font-bold" style={{ color: 'var(--ink-4)' }}>{number}</span>
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="section-title">
          {title}
        </h2>
      </div>
      <div className="flex-1 h-px" style={{ background: 'var(--hairline)' }} />
    </div>
  )
}

// ── Section tabs ───────────────────────────────────────────────────────────────

const SECTIONS = [
  { label: 'Market signals', emoji: '📡' },
  { label: 'Deep research', emoji: '🔬' },
  { label: 'Competitor ads', emoji: '🏪' },
  { label: 'Strategy', emoji: '✨' },
  { label: 'Creative output', emoji: '🎨' },
  { label: 'Launch plan', emoji: '📣' },
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
            style={{ color: isActive ? 'var(--ink)' : 'var(--ink-3)' }}
          >
            <span className="text-sm opacity-70">{sec.emoji}</span>
            {sec.label}
            {dataDots[idx] && !isActive && (
              <span className="w-1 h-1 rounded-full shrink-0" style={{ background: 'var(--accent)' }} />
            )}
            {isActive && (
              <div className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full" style={{ background: 'var(--accent)' }} />
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
          ? { border: '2px solid var(--warn-border)', background: 'var(--surface)' }
          : { border: '1px solid var(--hairline)', background: 'var(--surface)' }
      }
    >
      {/* Clickable header — always visible */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        style={{ background: entry.isWinner ? 'var(--warn-bg)' : 'var(--muted)' }}
      >
        {entry.isWinner ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: 'var(--warn-bg)', color: 'var(--warn)', border: '1px solid var(--warn-border)' }}>
            <Star size={9} fill="currentColor" /> Strategy Pick
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: 'var(--good-bg)', color: 'var(--good)', border: '1px solid var(--good-border)' }}>
            <CheckCircle2 size={9} /> Produced
          </span>
        )}
        <span className="text-sm font-semibold truncate flex-1" style={{ color: 'var(--ink)' }}>
          {entry.topic}
        </span>
        {!open && chips.length > 0 && (
          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
            {chips.map((c) => (
              <span key={c} className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--muted)', color: 'var(--ink-2)' }}>{c}</span>
            ))}
          </div>
        )}
        <ChevronDown
          size={14}
          className="shrink-0 transition-transform duration-200"
          style={{ color: 'var(--ink-3)', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {/* Expanded content */}
      {open && (
        <div style={{ borderTop: `1px solid ${entry.isWinner ? 'var(--warn-border)' : 'var(--hairline)'}` }}>
          <div className="px-4 flex flex-col">
            {!entry.pkg && entry.campaignId && (
              <div className="py-3">
                <div className="rounded-lg p-3 flex items-center justify-between gap-3" style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)' }}>
                  <p className="text-xs" style={{ color: 'var(--accent)' }}>Creative package not yet available — view in campaign</p>
                  <Link
                    href={`/dashboard/${tenantId}/campaigns/${entry.campaignId}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold shrink-0"
                    style={{ color: 'var(--accent)', textDecoration: 'none' }}
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
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
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
                          ? { background: 'var(--accent-bg)', border: '1.5px solid var(--accent)' }
                          : { background: 'var(--muted)', border: '1px solid var(--hairline)' }
                        }
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          {isSel && (
                            <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>Selected</span>
                          )}
                          {v.hookStyle && (
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--muted)', color: 'var(--ink-2)' }}>{v.hookStyle}</span>
                          )}
                          {v.cta && (
                            <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>{v.cta}</span>
                          )}
                        </div>
                        {v.headline && <p className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>{v.headline}</p>}
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-2)' }}>{v.primaryText}</p>
                      </div>
                    )
                  })}
                  {entry.pkg.copySelectionReason && (
                    <p className="text-xs italic pt-1" style={{ color: 'var(--ink-2)' }}>{entry.pkg.copySelectionReason}</p>
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
                  ? <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--good-bg)', color: 'var(--good)' }}>Generated</span>
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
                            {isSel && <span className="absolute top-1 left-1 z-10 text-[9px] font-semibold px-1 py-0.5 rounded" style={{ background: 'var(--good)', color: '#fff' }}>Selected</span>}
                            {cardState === 'polling' && (
                              <div className="absolute inset-0 z-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(23,20,15,0.55)' }}>
                                <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent)' }} />
                              </div>
                            )}
                            {img.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={img.imageUrl} alt={`Variant ${i + 1}`} className="rounded-lg w-full" style={{ border: isSel ? '2px solid var(--good)' : '1px solid var(--hairline)', maxHeight: 300, objectFit: 'contain', display: 'block' }} />
                            ) : (
                              <div className="rounded-lg flex items-center justify-center" style={{ height: 200, background: 'var(--muted)', border: '1px dashed var(--ink-4)' }}>
                                <p className="text-[10px]" style={{ color: 'var(--ink-4)' }}>{cardState === 'polling' ? '' : `V${i + 1}`}</p>
                              </div>
                            )}
                          </div>
                          {img.imagePrompt && (
                            <details>
                              <summary className="text-[9px] cursor-pointer" style={{ color: 'var(--ink-3)' }}>Prompt</summary>
                              <p className="text-[9px] mt-1 font-mono leading-relaxed p-1.5 rounded" style={{ background: 'var(--surface-warm)', color: 'var(--ink-3)', border: '1px solid var(--hairline)' }}>{img.imagePrompt}</p>
                            </details>
                          )}
                          {entry.creativePackageId && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleRegenImage(i)}
                                disabled={cardState !== 'idle'}
                                className="flex-1 flex items-center justify-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium transition-all disabled:opacity-50"
                                style={{ background: 'var(--muted)', border: '1px solid var(--hairline)', color: 'var(--ink-2)' }}
                              >
                                {cardState !== 'idle' ? <Loader2 size={8} className="animate-spin" /> : <ImageIcon size={8} />}
                                {cardState === 'idle' ? 'Re-roll' : 'Working…'}
                              </button>
                              <button
                                onClick={() => handleRewriteImagePrompt(i)}
                                disabled={cardState !== 'idle'}
                                className="flex-1 flex items-center justify-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium transition-all disabled:opacity-50"
                                style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', color: 'var(--accent)' }}
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
                  <div className="h-14 rounded-lg flex items-center justify-center" style={{ background: 'var(--muted)', border: '1px solid var(--hairline)' }}>
                    <p className="text-xs" style={{ color: 'var(--ink-4)' }}>Not yet generated</p>
                  </div>
                )}
              </AccordionSection>
            )}

            {/* Video */}
            {entry.pkg && (entry.pkg.video?.videoUrl || entry.pkg.video?.videoPrompt) && (
              <AccordionSection title="Video" defaultOpen={!!entry.pkg.video?.videoUrl}>
                {entry.pkg.video?.videoUrl ? (
                  <video controls className="rounded-lg w-full mb-2" style={{ maxHeight: 300, border: '1px solid var(--hairline)' }}>
                    <source src={entry.pkg.video.videoUrl} type="video/mp4" />
                  </video>
                ) : null}
                {entry.pkg.video?.videoPrompt && (
                  <div className="rounded-lg p-3" style={{ background: 'var(--surface-warm)', border: '1px solid var(--hairline)' }}>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <Video size={11} style={{ color: 'var(--ink-3)' }} />
                        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>Script</span>
                      </div>
                      {entry.creativePackageId && (
                        <>
                          <button
                            onClick={handleRegenVideo}
                            disabled={videoRegenState !== 'idle'}
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all disabled:opacity-50"
                            style={{ background: 'var(--muted)', border: '1px solid var(--hairline)', color: 'var(--ink-2)' }}
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
                            style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', color: 'var(--accent)' }}
                          >
                            <Sparkles size={10} /> Rewrite
                          </button>
                        </>
                      )}
                    </div>
                    <p className="text-xs font-mono leading-relaxed" style={{ color: 'var(--ink-3)' }}>{entry.pkg.video.videoPrompt}</p>
                  </div>
                )}
              </AccordionSection>
            )}

            {/* Compliance */}
            {entry.pkg && entry.pkg.complianceNotes && (
              <AccordionSection title="Compliance Notes">
                <div className="rounded-lg p-3" style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-border)' }}>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--warn)' }}>{entry.pkg.complianceNotes}</p>
                </div>
              </AccordionSection>
            )}

            {/* Debate */}
            {entry.pkg && entry.pkg.debateLog && entry.pkg.debateLog.length > 0 && (
              <AccordionSection
                title="Creative Debate"
                badge={
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--muted)', color: 'var(--ink-2)' }}>
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
        } catch {
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--ink-2)' }}>
            Loading AI growth run…
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
          style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad-border)' }}
        >
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle size={18} style={{ color: 'var(--bad)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--bad)' }}>
              Could not load this AI growth run
            </h3>
          </div>
          <p className="text-sm" style={{ color: 'var(--bad)' }}>
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
    background: 'var(--surface)',
    border: '1px solid var(--hairline)',
    borderRadius: 14,
    boxShadow: 'var(--shadow-soft)',
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
    <div className="min-h-screen">
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-5 right-5 z-50 px-5 py-3 rounded-xl text-sm font-medium animate-scale-in"
          style={
            toast.type === 'success'
              ? { background: 'var(--good-bg)', color: 'var(--good)', border: '1px solid var(--good-border)', boxShadow: 'var(--shadow-raised)' }
              : { background: 'var(--bad-bg)', color: 'var(--bad)', border: '1px solid var(--bad-border)', boxShadow: 'var(--shadow-raised)' }
          }
        >
          {toast.message}
        </div>
      )}

      {/* Header area */}
      <div className="max-w-[1280px] mx-auto px-4 pt-6 sm:px-6 lg:px-8 lg:pt-8 animate-fade-up">
        {/* Back link */}
        <Link
          href={`/dashboard/${tenantId}/runs`}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors mb-6"
          style={{ color: 'var(--ink-3)' }}
        >
          <ArrowLeft size={13} /> Activity &amp; audit
        </Link>

        {/* Run header card */}
        <div className="card overflow-hidden">
          <div className="p-7">
            <div className="flex items-start justify-between gap-5 flex-wrap mb-5">
              <div>
                <p className="micro-label mb-2">
                  Auditable AI workflow · <span className="mono normal-case tracking-normal">{runId}</span>
                </p>
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <h1 className="page-title">AI growth run</h1>
                  {run && <StatusBadge status={run.status} />}
                  {isActive && (
                    <span className="chip chip-accent">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50" style={{ background: 'currentColor' }} />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: 'currentColor' }} />
                      </span>
                      Live
                    </span>
                  )}
                  <PromptsVersionBadge version={run?.promptsVersion} />
                </div>
                <div className="page-subtitle flex items-center gap-4">
                  {run?.startedAt && (
                    <span className="mono">{formatDateTime(run.startedAt)}</span>
                  )}
                  {run?.completedAt && (
                    <>
                      <span style={{ color: 'var(--ink-4)' }}>&middot;</span>
                      <span className="mono">{formatDateTime(run.completedAt)}</span>
                    </>
                  )}
                </div>
              </div>

              {duration && (
                <div className="text-right">
                  <p className="micro-label mb-1">
                    {run?.status === 'completed' ? 'Completed in' : run?.status === 'failed' ? 'Failed after' : 'Running for'}
                  </p>
                  <p className="display-num text-3xl" style={{ color: 'var(--ink)' }}>
                    {duration}
                  </p>
                </div>
              )}
            </div>

            {run && <PhaseProgress status={run.status} />}
          </div>

          {/* Section tabs — attached to header */}
          <div style={{ borderTop: '1px solid var(--hairline-light)' }}>
            <SectionTabs
              activeSection={activeSection}
              dataDots={dataDots}
              onSelect={selectSection}
            />
          </div>
        </div>

        {run?.status === 'failed' && (
          <FailureBanner tenantId={tenantId} error={run.error} />
        )}
      </div>

      {/* ===== CONTENT ===== */}
      <div className="max-w-[1280px] mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* ===== SECTION B: SIGNAL SCOUTS ===== */}
        {activeSection === 0 && <div className="rounded-xl p-6" style={sectionStyle}>
          <SectionHeader number="01" title="Signal Scouts" icon={<span style={{ color: 'var(--accent)' }}>📡</span>} />

          {scouts.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: 'var(--ink-3)' }}>
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
                        <p className="text-xs" style={{ color: 'var(--ink-3)' }}>
                          Signals
                        </p>
                        <p className="display-num text-2xl" style={{ color: cfg.textColor }}>
                          {signalCount}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: 'var(--ink-3)' }}>
                          Viral Trends
                        </p>
                        <p className="text-sm font-semibold" style={{ color: 'var(--ink-2)' }}>
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
                  style={{ border: '1px solid var(--hairline)' }}
                >
                  {/* Platform tab switcher */}
                  <div
                    className="flex gap-1 p-3"
                    style={{ borderBottom: '1px solid var(--hairline-light)', background: 'var(--muted)' }}
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
                                  background: 'var(--surface)',
                                  color: 'var(--ink-2)',
                                  border: '1px solid var(--hairline)',
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
                              <p className="text-xs font-medium mb-2.5" style={{ color: 'var(--ink-3)' }}>
                                Trending Topics
                              </p>
                              <div className="flex flex-col gap-1.5">
                                {topics.slice(0, 5).map((t, i) => (
                                  <div key={i} className="flex items-center justify-between gap-2">
                                    <span className="text-xs truncate" style={{ color: 'var(--ink-2)' }}>
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
                              <p className="text-xs font-medium mb-2.5" style={{ color: 'var(--ink-3)' }}>
                                Hook Examples
                              </p>
                              <div className="flex flex-col gap-1.5">
                                {hooks.slice(0, 4).map((h, i) => (
                                  <p
                                    key={i}
                                    className="text-xs italic leading-relaxed"
                                    style={{ color: 'var(--ink-2)' }}
                                  >
                                    &ldquo;{h}&rdquo;
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}
                          {formats.length > 0 && (
                            <div>
                              <p className="text-xs font-medium mb-2.5" style={{ color: 'var(--ink-3)' }}>
                                Format Insights
                              </p>
                              <div className="flex flex-col gap-1.5">
                                {formats.slice(0, 4).map((f, i) => (
                                  <p key={i} className="text-xs leading-relaxed" style={{ color: 'var(--ink-2)' }}>
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
                    style={{ color: 'var(--ink-3)' }}
                  >
                    Top Signals
                  </h3>
                  <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--hairline)' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          {['Rank', 'Topic', 'Platforms', 'Score', 'Rationale'].map((h) => (
                            <th key={h}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {coordinator.topSignals.map((sig, idx) => {
                          const scoreStyle =
                            sig.compositeScore >= 8
                              ? { background: 'var(--good-bg)', color: 'var(--good)', border: '1px solid var(--good-border)' }
                              : sig.compositeScore >= 6
                              ? { background: 'var(--warn-bg)', color: 'var(--warn)', border: '1px solid var(--warn-border)' }
                              : { background: 'var(--bad-bg)', color: 'var(--bad)', border: '1px solid var(--bad-border)' }
                          return (
                            <tr key={idx}>
                              <td className="mono text-sm" style={{ color: 'var(--ink-3)' }}>
                                {idx + 1}
                              </td>
                              <td className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                                {sig.topic}
                              </td>
                              <td>
                                <div className="flex gap-1 flex-wrap">
                                  {sig.platforms.map((p) => (
                                    <span
                                      key={p}
                                      className="text-xs px-1.5 py-0.5 rounded"
                                      style={{ background: 'var(--muted)', color: 'var(--ink-2)' }}
                                    >
                                      {p}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td>
                                <span
                                  className="mono px-2 py-0.5 rounded-full text-xs font-bold"
                                  style={scoreStyle}
                                >
                                  {sig.compositeScore.toFixed(1)}
                                </span>
                              </td>
                              <td className="text-xs max-w-50 truncate">
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
            <p className="text-sm text-center py-6" style={{ color: 'var(--ink-3)' }}>
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
                  u === 'high' ? { bg: 'var(--bad-bg)', color: 'var(--bad)', border: 'var(--bad-border)' }
                  : u === 'medium' ? { bg: 'var(--warn-bg)', color: 'var(--warn)', border: 'var(--warn-border)' }
                  : { bg: 'var(--muted)', color: 'var(--ink-2)', border: 'var(--hairline)' }
                return (
                  <div key={idx} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--hairline)' }}>
                    {/* Header */}
                    <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'var(--muted)', borderBottom: '1px solid var(--hairline-light)' }}>
                      <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-2)' }}>
                        {r.type === 'competitor' ? '🏆 Competitor' : '📊 Market'} Research
                      </h4>
                      {insights.length > 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
                          {insights.length} insight{insights.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    <div className="p-4">
                      {/* Summary */}
                      {summary && (
                        <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--ink-2)' }}>{summary}</p>
                      )}

                      {/* Structured insights */}
                      {insights.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          {insights.map((ins, i) => {
                            const us = urgencyStyle(ins.urgency)
                            return (
                              <div key={i} className="rounded-lg p-3" style={{ background: 'var(--muted)', border: '1px solid var(--hairline-light)' }}>
                                <div className="flex items-start justify-between gap-3 mb-1.5">
                                  <p className="text-sm font-medium leading-snug flex-1" style={{ color: 'var(--ink)' }}>{ins.insight}</p>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: us.bg, color: us.color, border: `1px solid ${us.border}` }}>
                                      {ins.urgency}
                                    </span>
                                    <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--muted)', color: 'var(--ink-2)' }}>
                                      {ins.score}/10
                                    </span>
                                  </div>
                                </div>
                                <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-2)' }}>→ {ins.implication}</p>
                                {ins.source && (
                                  <a href={ins.source} target="_blank" rel="noopener noreferrer" className="text-xs mt-1 block truncate" style={{ color: 'var(--accent)' }}>
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
                          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--ink-2)' }}>
                            {isExpanded ? fallbackText : fallbackText.slice(0, 500) + (fallbackText.length > 500 ? '…' : '')}
                          </p>
                          {fallbackText.length > 500 && (
                            <button onClick={() => setResearchExpanded(prev => ({ ...prev, [idx]: !isExpanded }))} className="mt-2 text-xs font-medium" style={{ color: 'var(--accent)' }}>
                              {isExpanded ? 'Show less' : 'Read more'}
                            </button>
                          )}
                        </>
                      ) : (
                        <p className="text-sm" style={{ color: 'var(--ink-3)' }}>No data available.</p>
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
              <p className="text-sm text-center py-6" style={{ color: 'var(--ink-3)' }}>No ad library data available for this run.</p>
            ) : (
              <div className="flex flex-col gap-5">
                {/* Summary strip */}
                {(adLibrary.dominantFormat || adLibrary.rawSummary) && (
                  <div className="rounded-xl p-4" style={{ background: 'var(--muted)', border: '1px solid var(--hairline)' }}>
                    {adLibrary.rawSummary && <p className="text-sm leading-relaxed mb-2" style={{ color: 'var(--ink-2)' }}>{adLibrary.rawSummary}</p>}
                    {adLibrary.dominantFormat && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>
                        Dominant format: {adLibrary.dominantFormat}
                      </span>
                    )}
                  </div>
                )}

                {/* Competitor ads */}
                {adLibrary.competitorAds?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--ink-3)' }}>Competitor Ads Running Now</h3>
                    <div className="flex flex-col gap-2">
                      {adLibrary.competitorAds.map((ad, i) => (
                        <div key={i} className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--hairline)' }}>
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--bad-bg)', color: 'var(--bad)', border: '1px solid var(--bad-border)' }}>
                                {ad.competitor}
                              </span>
                              {ad.format && (
                                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>{ad.format}</span>
                              )}
                              {ad.angle && (
                                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--muted)', color: 'var(--ink-2)', border: '1px solid var(--hairline)' }}>{ad.angle}</span>
                              )}
                              {ad.estimatedDaysRunning != null && (
                                <span className="text-xs" style={{ color: 'var(--ink-3)' }}>{ad.estimatedDaysRunning}d running</span>
                              )}
                            </div>
                            {ad.score != null && (
                              <span className="text-xs font-bold px-2 py-0.5 rounded shrink-0" style={{ background: ad.score >= 8 ? 'var(--good-bg)' : 'var(--warn-bg)', color: ad.score >= 8 ? 'var(--good)' : 'var(--warn)' }}>
                                {ad.score}/10
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium italic mb-1" style={{ color: 'var(--ink)' }}>&ldquo;{ad.hook}&rdquo;</p>
                          {ad.cta && <p className="text-xs" style={{ color: 'var(--ink-2)' }}>CTA: <span style={{ color: 'var(--accent)' }}>{ad.cta}</span></p>}
                          {ad.source && (
                            <a href={ad.source} target="_blank" rel="noopener noreferrer" className="text-xs mt-1 block truncate" style={{ color: 'var(--accent)' }}>{ad.source}</a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Gaps / opportunities */}
                {adLibrary.gaps?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--ink-3)' }}>Untapped Angles — Nobody Is Running These</h3>
                    <div className="flex flex-col gap-2">
                      {adLibrary.gaps.map((g, i) => {
                        const us = g.urgency === 'high'
                          ? { bg: 'var(--bad-bg)', color: 'var(--bad)', border: 'var(--bad-border)' }
                          : g.urgency === 'medium'
                          ? { bg: 'var(--warn-bg)', color: 'var(--warn)', border: 'var(--warn-border)' }
                          : { bg: 'var(--muted)', color: 'var(--ink-2)', border: 'var(--hairline)' }
                        return (
                          <div key={i} className="rounded-xl p-4" style={{ background: 'var(--good-bg)', border: '1px solid var(--good-border)' }}>
                            <div className="flex items-start justify-between gap-3 mb-1.5">
                              <p className="text-sm font-semibold flex-1" style={{ color: 'var(--ink)' }}>{g.gap}</p>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: us.bg, color: us.color, border: `1px solid ${us.border}` }}>{g.urgency}</span>
                                {g.score != null && <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--muted)', color: 'var(--ink-2)' }}>{g.score}/10</span>}
                              </div>
                            </div>
                            <p className="text-xs leading-relaxed" style={{ color: 'var(--good)' }}>→ {g.opportunity}</p>
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
                icon={<ImageIcon size={16} style={{ color: 'var(--accent)' }} />}
              />

              {entries.length === 0 ? (
                <div className="rounded-lg p-5 text-center" style={{ background: 'var(--muted)', border: '1px solid var(--hairline)' }}>
                  <p className="text-sm" style={{ color: 'var(--ink-3)' }}>No creative packages available yet.</p>
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
                icon={<Megaphone size={16} style={{ color: 'var(--accent)' }} />}
              />

              {campEntries.length === 0 ? (
                <div className="rounded-lg p-5 text-center" style={{ background: 'var(--muted)', border: '1px solid var(--hairline)' }}>
                  <p className="text-sm" style={{ color: 'var(--ink-3)' }}>No campaigns linked to this run yet.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {campEntries.map((entry) => (
                    <div
                      key={entry.briefId}
                      className="rounded-xl overflow-hidden"
                      style={
                        entry.isWinner
                          ? { border: '2px solid var(--warn-border)', background: 'var(--surface)' }
                          : { border: '1px solid var(--hairline)', background: 'var(--surface)' }
                      }
                    >
                      {/* Campaign header */}
                      <div
                        className="px-5 py-3 flex items-center gap-3 flex-wrap"
                        style={{
                          background: entry.isWinner ? 'var(--warn-bg)' : 'var(--muted)',
                          borderBottom: `1px solid ${entry.isWinner ? 'var(--warn-border)' : 'var(--hairline)'}`,
                        }}
                      >
                        {entry.isWinner ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--warn-bg)', color: 'var(--warn)', border: '1px solid var(--warn-border)' }}>
                            <Star size={9} fill="currentColor" /> Strategy Pick
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--good-bg)', color: 'var(--good)', border: '1px solid var(--good-border)' }}>
                            <CheckCircle2 size={9} /> Produced
                          </span>
                        )}
                        <h3 className="text-sm font-semibold flex-1 truncate" style={{ color: 'var(--ink)' }}>
                          {entry.topic}
                        </h3>
                        <StatusBadge status={entry.camp.status} />
                      </div>

                      {/* Campaign content */}
                      <div className="px-5 flex flex-col">
                        {/* Always-visible: status / budget / objective */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 py-4">
                          <div className="rounded-lg p-3" style={{ background: 'var(--muted)', border: '1px solid var(--hairline)' }}>
                            <p className="text-xs mb-1" style={{ color: 'var(--ink-3)' }}>Status</p>
                            <StatusBadge status={entry.camp.status} />
                          </div>
                          <div className="rounded-lg p-3" style={{ background: 'var(--muted)', border: '1px solid var(--hairline)' }}>
                            <p className="text-xs mb-1" style={{ color: 'var(--ink-3)' }}>Budget</p>
                            <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                              {entry.camp.budget ? formatCurrency(entry.camp.budget) : '—'}
                            </p>
                            {entry.camp.reviewAdjustments?.budgetAdjusted && (
                              <p className="text-xs mt-0.5" style={{ color: 'var(--warn)' }}>
                                orig. {formatCurrency(entry.camp.reviewAdjustments.originalBudget)} → {formatCurrency(entry.camp.reviewAdjustments.recommendedBudget)}
                              </p>
                            )}
                          </div>
                          <div className="rounded-lg p-3" style={{ background: 'var(--muted)', border: '1px solid var(--hairline)' }}>
                            <p className="text-xs mb-1" style={{ color: 'var(--ink-3)' }}>Objective</p>
                            <p className="text-sm" style={{ color: 'var(--ink-2)' }}>{entry.camp.objective || '—'}</p>
                          </div>
                        </div>

                        {/* Ad set config accordion */}
                        {entry.camp.campaignConfig?.adSets && entry.camp.campaignConfig.adSets.length > 0 && (
                          <AccordionSection
                            title="Ad Set Configuration"
                            badge={
                              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--muted)', color: 'var(--ink-2)' }}>
                                {entry.camp.campaignConfig.adSets.length} set{entry.camp.campaignConfig.adSets.length !== 1 ? 's' : ''}
                              </span>
                            }
                          >
                            <div className="rounded-lg overflow-x-auto" style={{ border: '1px solid var(--hairline)' }}>
                              <table className="data-table">
                                <thead>
                                  <tr>
                                    {['Name','Audience','Budget %','Meta Audience ID','Age','Geo','Optimization'].map((h) => (
                                      <th key={h} className={h === 'Budget %' ? 'num' : undefined}>{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {entry.camp.campaignConfig.adSets.map((adSet, idx) => (
                                    <tr key={idx}>
                                      <td className="text-sm" style={{ color: 'var(--ink)' }}>{adSet.name}</td>
                                      <td className="text-xs">{adSet.audienceType}</td>
                                      <td className="num mono text-sm">{adSet.budgetPercent}%</td>
                                      <td className="mono text-xs" style={{ color: 'var(--ink-3)' }}>{adSet.metaAudienceId || '—'}</td>
                                      <td className="mono text-xs">{adSet.ageMin || adSet.ageMax ? `${adSet.ageMin ?? '?'}–${adSet.ageMax ?? '?'}` : '—'}</td>
                                      <td className="text-xs">{adSet.geoLocations?.join(', ') || '—'}</td>
                                      <td className="text-xs">{adSet.optimizationGoal || '—'}</td>
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
                                  <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--ink-3)' }}>Scale Rules</p>
                                  <pre className="text-xs rounded-lg p-3 whitespace-pre-wrap leading-relaxed" style={{ background: 'var(--muted)', border: '1px solid var(--hairline)', color: 'var(--ink-2)' }}>{entry.camp.campaignConfig.scaleRules}</pre>
                                </div>
                              )}
                              {entry.camp.campaignConfig?.pauseRules && (
                                <div>
                                  <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--ink-3)' }}>Pause Rules</p>
                                  <pre className="text-xs rounded-lg p-3 whitespace-pre-wrap leading-relaxed" style={{ background: 'var(--muted)', border: '1px solid var(--hairline)', color: 'var(--ink-2)' }}>{entry.camp.campaignConfig.pauseRules}</pre>
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
                              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--muted)', color: 'var(--ink-2)' }}>
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
                              style={{ color: 'var(--accent)' }}
                            >
                              View full campaign details <ArrowRight size={14} />
                            </Link>
                          </div>
                        )}

                        {entry.isWinner && entry.camp.status === 'pending_approval' && (
                          <div className="rounded-xl p-5 flex flex-col gap-4 my-3" style={{ background: 'var(--muted)', border: '2px solid var(--hairline)' }}>
                            <div className="text-center">
                              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>This campaign is awaiting your approval</p>
                              <p className="text-xs mt-1" style={{ color: 'var(--ink-2)' }}>Review the details above before approving or rejecting</p>
                            </div>
                            <div className="flex flex-col gap-3">
                              <button
                                onClick={handleApprove}
                                disabled={approveState !== 'idle'}
                                className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl text-base font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                                style={{
                                  background: approveState !== 'idle' ? 'var(--good-bg)' : 'var(--good)',
                                  color: approveState !== 'idle' ? 'var(--good)' : 'var(--surface)',
                                  border: '2px solid var(--good)',
                                  boxShadow: approveState === 'idle' ? '0 4px 12px rgba(21,128,61,0.25)' : 'none',
                                }}
                              >
                                {approveState === 'loading' ? <Loader2 size={18} className="animate-spin" /> : <ThumbsUp size={18} />}
                                {approveState === 'loading' ? 'Approving…' : approveState === 'success' ? 'Approved!' : 'Approve & Launch Campaign'}
                              </button>
                              <button
                                onClick={() => setRejectOpen((o) => !o)}
                                className="w-full flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl text-sm font-semibold transition-all"
                                style={{ background: 'var(--bad-bg)', color: 'var(--bad)', border: '2px solid var(--bad-border)' }}
                              >
                                <XCircle size={16} /> Reject Campaign
                              </button>
                            </div>
                            {rejectOpen && (
                              <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad-border)' }}>
                                <p className="text-xs font-semibold" style={{ color: 'var(--bad)' }}>Reason for rejection</p>
                                <textarea
                                  value={rejectReason}
                                  onChange={(e) => setRejectReason(e.target.value)}
                                  placeholder="Describe why this campaign is being rejected…"
                                  rows={3}
                                  className="w-full rounded-lg px-3 py-2 text-sm resize-none"
                                  style={{ background: 'var(--surface)', border: '1px solid var(--bad-border)', color: 'var(--ink)', outline: 'none' }}
                                />
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={handleReject}
                                    disabled={rejectState === 'loading' || !rejectReason.trim()}
                                    className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad-border)', color: 'var(--bad)' }}
                                  >
                                    {rejectState === 'loading' ? 'Rejecting…' : 'Confirm Reject'}
                                  </button>
                                  <button onClick={() => setRejectOpen(false)} className="text-xs transition-colors" style={{ color: 'var(--ink-3)' }}>
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Non-winner pending approval — link to campaign */}
                        {!entry.isWinner && entry.camp.status === 'pending_approval' && entry.camp._id && (
                          <div className="rounded-xl p-4 flex items-center justify-between gap-3 my-3" style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-border)' }}>
                            <p className="text-xs font-medium" style={{ color: 'var(--warn)' }}>Awaiting approval</p>
                            <Link
                              href={`/dashboard/${tenantId}/campaigns/${entry.camp._id}`}
                              className="inline-flex items-center gap-1 text-xs font-semibold shrink-0"
                              style={{ color: 'var(--warn)', textDecoration: 'none' }}
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
