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
import { Details } from '@/components/plain/Details'
import { PLAIN_ERROR, formatInr, formatWhen, humanise, plainStatus, toneChip, type PlainDomain } from '@/lib/plain-language'
import type {
  BrainAgentKey,
  BrainEvidence,
  BrainRunStatus,
  BrainRunTrigger,
  BrainStageState,
  BrainBudgetAuthority,
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
  queued: { label: plainStatus('agentRun', 'queued').label, chip: 'chip-neutral', Icon: CircleDot },
  running: { label: plainStatus('agentRun', 'running').label, chip: 'chip-info', Icon: Loader2 },
  waiting_for_human: { label: plainStatus('agentRun', 'waiting_for_human').label, chip: 'chip-warn', Icon: Gavel },
  succeeded: { label: plainStatus('agentRun', 'succeeded').label, chip: 'chip-good', Icon: CircleCheck },
  failed: { label: plainStatus('agentRun', 'failed').label, chip: 'chip-bad', Icon: XCircle },
  cancelled: { label: plainStatus('agentRun', 'cancelled').label, chip: 'chip-neutral', Icon: CirclePause },
}

export const STAGE_STATE_META: Record<
  BrainStageState,
  { label: string; chip: string; dot: string }
> = {
  idle: { label: plainStatus('stageState', 'idle').label, chip: 'chip-neutral', dot: 'var(--ink-4)' },
  running: { label: plainStatus('stageState', 'running').label, chip: 'chip-info', dot: 'var(--info)' },
  waiting_for_human: { label: plainStatus('stageState', 'waiting_for_human').label, chip: 'chip-warn', dot: 'var(--warn)' },
  done: { label: plainStatus('stageState', 'done').label, chip: 'chip-good', dot: 'var(--good)' },
  blocked: { label: plainStatus('stageState', 'blocked').label, chip: 'chip-bad', dot: 'var(--bad)' },
  failed: { label: plainStatus('stageState', 'failed').label, chip: 'chip-bad', dot: 'var(--bad)' },
}

/** Who started a run, in plain words (unknown triggers are humanised, never raw). */
export function triggerLabel(trigger: BrainRunTrigger | string | null | undefined): string {
  return plainStatus('runTrigger', trigger).label
}

export const TRIGGER_LABEL: Record<BrainRunTrigger, string> = {
  dashboard: triggerLabel('dashboard'),
  brain: triggerLabel('brain'),
  schedule: triggerLabel('schedule'),
  slack: triggerLabel('slack'),
}

/**
 * Each agent described by what it does for a marketer — the agent's product name is secondary.
 * `role` is the headline ("Writes your ads"); `detail` one plain sentence under it.
 */
export const AGENT_PLAIN: Record<BrainAgentKey, { role: string; detail: string }> = {
  brain: {
    role: 'Plans and decides',
    detail: 'Looks at your whole account each day and decides where the money should go.',
  },
  'competitor-research': {
    role: 'Watches your competitors',
    detail: 'Finds what similar brands are advertising, so you can spot gaps and ideas.',
  },
  'campaign-report': {
    role: 'Writes your reports',
    detail: 'Sums up how your campaigns did, in plain words you can share.',
  },
  'performance-analyst': {
    role: 'Checks how ads are doing',
    detail: 'Reads your results and points out what is working and what is not.',
  },
  'creative-producer': {
    role: 'Writes your ads',
    detail: 'Writes and designs a batch of new ads for a product.',
  },
  'creative-curator': {
    role: 'Checks your ads before they go live',
    detail: 'Scores every new ad and keeps only the ones good enough to run.',
  },
  'campaign-builder': {
    role: 'Sets up your campaigns',
    detail: 'Creates the campaign, audiences and ads in Meta — switched off until approved.',
  },
  'campaign-launcher': {
    role: 'Switches campaigns on',
    detail: 'Turns a campaign on once someone has approved it.',
  },
}

/**
 * Some fields arrive as either prose or a bare code ("record_and_propose"). A bare code goes
 * through the vocabulary (humanised if unknown); prose passes through untouched.
 */
export function plainIfCode(value: string | null | undefined, domain: PlainDomain): string {
  if (!value) return ''
  const trimmed = value.trim()
  const known = plainStatus(domain, trimmed)
  if (known.meaning) return known.label
  return /^[A-Za-z0-9]+(_[A-Za-z0-9]+)+$/.test(trimmed) ? humanise(trimmed) : value
}

/** A bare code ("pain_point", "LEARN_MORE") humanised; readable text passes through. */
export function plainCode(value: string | null | undefined): string {
  if (!value) return ''
  const trimmed = value.trim()
  return /^[A-Za-z0-9]+(_[A-Za-z0-9]+)+$/.test(trimmed) ? humanise(trimmed) : value
}

export function agentRole(key: BrainAgentKey | string): string {
  return AGENT_PLAIN[key as BrainAgentKey]?.role ?? 'Helper'
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
  if (!meta) {
    // A status the dashboard does not know yet — humanised, never raw.
    const plain = plainStatus('agentRun', status)
    return <span className={cn('chip', toneChip(plain.tone), className)}>{plain.label}</span>
  }
  const { Icon } = meta
  return (
    <span className={cn('chip', meta.chip, className)} title={plainStatus('agentRun', status).meaning || undefined}>
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
          {action && <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">{action}</div>}
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
  measured: { label: plainStatus('provenance', 'measured').label, color: 'var(--good)', border: 'solid' },
  estimate: { label: plainStatus('provenance', 'estimate').label, color: 'var(--viz-estimate)', border: 'dashed' },
  unknown: { label: plainStatus('provenance', 'unknown').label, color: 'var(--viz-unknown)', border: 'dotted' },
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
        const meta = PROVENANCE_META[item.provenance] ?? PROVENANCE_META.unknown
        return (
          <li
            key={`${item.label}-${index}`}
            className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 rounded-[10px] px-3 py-2"
            style={{
              background: 'var(--surface-warm)',
              border: `1px ${meta.border} var(--hairline)`,
            }}
          >
            <span className="min-w-0 break-words text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
              {item.label}
            </span>
            <span className="min-w-0 break-words text-[13px] font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>
              {item.value}
            </span>
            <span
              className="ml-auto flex min-w-0 flex-wrap items-center gap-1.5 text-[11px]"
              style={{ color: 'var(--ink-3)' }}
            >
              <span style={{ color: meta.color, fontWeight: 700 }}>{meta.label}</span>
              {item.source && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="min-w-0 break-words">{item.source}</span>
                </>
              )}
              {item.freshness && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{humanFreshness(item.freshness)}</span>
                </>
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/** Evidence freshness can arrive as an ISO timestamp — never print one raw. */
function humanFreshness(value: string): string {
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? formatWhen(value) : value
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
      <div className="min-w-0 flex-1">
        <p className="font-semibold" style={{ color: 'var(--ink)' }}>
          We couldn&apos;t reach the Brain
        </p>
        <p className="explain mt-1">{PLAIN_ERROR}</p>
        {message && (
          <Details className="mt-2" items={[{ label: 'What went wrong', value: message }]} />
        )}
      </div>
      <button type="button" className="btn btn-ghost" onClick={onRetry}>
        Try again
      </button>
    </div>
  )
}

/**
 * Which budget governs a run, as the brain states it — and, when the contract disagrees with it,
 * a warning that says so and why.
 *
 * consistent:false is not a cosmetic mismatch: the Builder refuses to build a run whose contract
 * and authorised budget disagree (or whose audience is over Meta's per-ad-set cap), so a run
 * showing this will sit still until someone fixes the amount. Showing either number alone as "the
 * budget" is how run 94 was built at ₹5,000 a day with ₹6,000 approved.
 *
 * `compact` renders only the warning; a consistent budget draws nothing.
 */
export function BudgetAuthorityNotice({
  authority,
  compact = false,
}: {
  authority: BrainBudgetAuthority | null | undefined
  compact?: boolean
}) {
  if (!authority) return null
  const authorised =
    authority.authorisedDailyBudgetInr !== null
      ? formatInr(authority.authorisedDailyBudgetInr, { perDay: true })
      : 'nothing yet'
  const contract =
    authority.contractTotalInr !== null
      ? formatInr(authority.contractTotalInr, { perDay: true })
      : 'no daily budgets'

  if (authority.consistent) {
    if (compact) return null
    return (
      <p className="explain">
        Budget: <strong>{authorised}</strong>
        {authority.sourceLabel ? ` — set by ${authority.sourceLabel.toLowerCase()}` : ''}. The
        audiences add up to it.
      </p>
    )
  }

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl px-4 py-3"
      style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-border)' }}
    >
      <TriangleAlert size={16} aria-hidden="true" style={{ color: 'var(--warn)', marginTop: 2 }} />
      <div className="min-w-0">
        <p className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
          The budget does not add up, so this will not be built until it does.
        </p>
        <p className="explain mt-1" style={{ color: 'var(--ink-2)' }}>
          Authorised: {authorised}
          {authority.sourceLabel ? ` (${authority.sourceLabel.toLowerCase()})` : ''} · the audiences
          add up to {contract}.
        </p>
        {authority.why && (
          <p className="explain mt-1" style={{ color: 'var(--ink-2)' }}>
            Why: {authority.why}
          </p>
        )}
      </div>
    </div>
  )
}
