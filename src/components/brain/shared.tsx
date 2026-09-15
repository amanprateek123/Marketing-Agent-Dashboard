'use client'

import React from 'react'
import {
  Bot,
  BrainCircuit,
  CircleCheck,
  CircleDot,
  CirclePause,
  Gavel,
  ImageIcon,
  Loader2,
  Megaphone,
  Radar,
  ScrollText,
  ShieldCheck,
  TriangleAlert,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  BrainAgentKey,
  BrainEvidence,
  BrainRunStatus,
  BrainRunTrigger,
  BrainStageState,
} from '@/types/brain'

// ── Status vocabulary ──────────────────────────────────────────────────────

/**
 * DESIGN.md §5: status is never carried by colour alone, and "recommended /
 * approved / executed / measured" must look different. One table so every tab
 * says the same word for the same state.
 */
export const RUN_STATUS_META: Record<
  BrainRunStatus,
  { label: string; chip: string; Icon: React.ComponentType<{ size?: number; className?: string }> }
> = {
  queued: { label: 'Queued', chip: 'chip-neutral', Icon: CircleDot },
  running: { label: 'Running', chip: 'chip-info', Icon: Loader2 },
  waiting_for_human: { label: 'Waiting for you', chip: 'chip-warn', Icon: Gavel },
  succeeded: { label: 'Done', chip: 'chip-good', Icon: CircleCheck },
  failed: { label: 'Failed', chip: 'chip-bad', Icon: XCircle },
  cancelled: { label: 'Cancelled', chip: 'chip-neutral', Icon: CirclePause },
}

export const STAGE_STATE_META: Record<
  BrainStageState,
  { label: string; chip: string; dot: string }
> = {
  idle: { label: 'Not started', chip: 'chip-neutral', dot: 'var(--ink-4)' },
  running: { label: 'Running', chip: 'chip-info', dot: 'var(--info)' },
  waiting_for_human: { label: 'Waiting for you', chip: 'chip-warn', dot: 'var(--warn)' },
  done: { label: 'Done', chip: 'chip-good', dot: 'var(--good)' },
  blocked: { label: 'Stopped', chip: 'chip-bad', dot: 'var(--bad)' },
  failed: { label: 'Failed', chip: 'chip-bad', dot: 'var(--bad)' },
}

export const TRIGGER_LABEL: Record<BrainRunTrigger, string> = {
  dashboard: 'Started here',
  brain: 'Brain-triggered',
  schedule: 'Scheduled',
  slack: 'From Slack',
}

const AGENT_ICON: Record<BrainAgentKey, React.ComponentType<{ size?: number }>> = {
  brain: BrainCircuit,
  'competitor-research': Radar,
  'campaign-report': ScrollText,
  'performance-analyst': Bot,
  'creative-producer': ImageIcon,
  'creative-curator': ShieldCheck,
  'campaign-builder': Megaphone,
  'campaign-launcher': Gavel,
}

export function AgentGlyph({
  agentKey,
  size = 38,
  tone = 'accent',
}: {
  agentKey: BrainAgentKey
  size?: number
  tone?: 'accent' | 'neutral' | 'teal'
}) {
  const Icon = AGENT_ICON[agentKey] ?? Bot
  const palette =
    tone === 'teal'
      ? { background: 'var(--brand-secondary-bg)', color: 'var(--brand-secondary)', border: '1px solid var(--brand-secondary-border)' }
      : tone === 'neutral'
        ? { background: 'var(--muted)', color: 'var(--ink-3)', border: '1px solid var(--hairline)' }
        : { background: 'var(--accent-bg)', color: 'var(--accent-strong)', border: '1px solid var(--accent-border)' }

  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-xl"
      style={{ width: size, height: size, ...palette }}
    >
      <Icon size={Math.round(size * 0.45)} />
    </span>
  )
}

export function RunStatusChip({ status, className }: { status: BrainRunStatus; className?: string }) {
  const meta = RUN_STATUS_META[status]
  const { Icon } = meta
  return (
    <span className={cn('chip', meta.chip, className)}>
      <Icon size={12} className={status === 'running' ? 'animate-spin' : undefined} />
      {meta.label}
    </span>
  )
}

// ── Surfaces ───────────────────────────────────────────────────────────────

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  padded = true,
}: {
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <section className={cn('card', className)}>
      {(title || action) && (
        <header
          className="flex flex-wrap items-start justify-between gap-3 px-5 py-4"
          style={{ borderBottom: '1px solid var(--hairline-light)' }}
        >
          <div className="min-w-0">
            {title && <h2 className="section-title">{title}</h2>}
            {description && <p className="explain mt-1">{description}</p>}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={padded ? 'p-5' : undefined}>{children}</div>
    </section>
  )
}

/** A number with its meaning attached — DESIGN.md §6 forbids isolated metrics. */
export function StatTile({
  label,
  value,
  meaning,
  tone = 'ink',
}: {
  label: string
  value: string
  meaning?: string
  tone?: 'ink' | 'good' | 'warn' | 'bad' | 'accent'
}) {
  const color =
    tone === 'good'
      ? 'var(--good)'
      : tone === 'warn'
        ? 'var(--warn)'
        : tone === 'bad'
          ? 'var(--bad)'
          : tone === 'accent'
            ? 'var(--accent-strong)'
            : 'var(--ink)'

  return (
    <div className="card-inset px-4 py-3.5">
      <p className="micro-label">{label}</p>
      <p className="display-num mt-1.5 text-[26px]" style={{ color }}>
        {value}
      </p>
      {meaning && <p className="explain mt-1 leading-snug">{meaning}</p>}
    </div>
  )
}

// ── Evidence ───────────────────────────────────────────────────────────────

const PROVENANCE_META: Record<
  BrainEvidence['provenance'],
  { label: string; color: string; border: string }
> = {
  measured: { label: 'Measured', color: 'var(--good)', border: 'solid' },
  estimate: { label: 'Estimate', color: 'var(--viz-estimate)', border: 'dashed' },
  unknown: { label: 'Unknown source', color: 'var(--viz-unknown)', border: 'dotted' },
}

/**
 * Provenance is carried by the border STYLE as well as the colour — dashed for
 * an estimate, dotted for unknown — so an estimate can never be mistaken for a
 * measured fact by someone who cannot separate the two hues.
 */
export function EvidenceList({ evidence }: { evidence: BrainEvidence[] }) {
  if (!evidence.length) return null

  return (
    <ul className="flex flex-col gap-2">
      {evidence.map((item, index) => {
        const meta = PROVENANCE_META[item.provenance]
        return (
          <li
            key={`${item.label}-${index}`}
            className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-[10px] px-3 py-2"
            style={{
              background: 'var(--surface-warm)',
              border: `1px ${meta.border} var(--hairline)`,
            }}
          >
            <span className="text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
              {item.label}
            </span>
            <span className="mono text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
              {item.value}
            </span>
            <span className="ml-auto flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--ink-3)' }}>
              <span style={{ color: meta.color, fontWeight: 700 }}>{meta.label}</span>
              <span aria-hidden="true">·</span>
              <span>{item.source}</span>
              {item.freshness && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="mono">{item.freshness}</span>
                </>
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

// ── Designed non-happy states (DESIGN.md §8) ───────────────────────────────

export function BrainSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="card p-5">
          <div className="skeleton h-4 w-40" />
          <div className="skeleton mt-3 h-3 w-full" />
          <div className="skeleton mt-2 h-3 w-4/5" />
        </div>
      ))}
    </div>
  )
}

export function BrainError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="card flex flex-col items-start gap-4 px-5 py-5 sm:flex-row sm:items-center"
      style={{ background: 'var(--bad-bg)', borderColor: 'var(--bad-border)' }}
    >
      <span
        aria-hidden="true"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ background: 'var(--surface)', color: 'var(--bad)' }}
      >
        <TriangleAlert size={18} />
      </span>
      <div className="flex-1">
        <p className="font-semibold" style={{ color: 'var(--ink)' }}>
          The Brain could not be reached
        </p>
        <p className="explain mt-1">{message}</p>
      </div>
      <button type="button" className="btn btn-ghost" onClick={onRetry}>
        Try again
      </button>
    </div>
  )
}
