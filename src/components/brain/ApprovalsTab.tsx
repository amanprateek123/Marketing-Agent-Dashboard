'use client'

import React, { useState } from 'react'
import {
  BadgeCheck,
  CircleCheck,
  Clock3,
  ImageIcon,
  Info,
  CalendarCheck,
  Lightbulb,
  Loader2,
  MessageSquare,
  ShieldCheck,
  TriangleAlert,
  XCircle,
} from 'lucide-react'
import { formatCurrency, formatRelativeTime } from '@/lib/utils'
import { decideBrainGate } from '@/lib/brain-api'
import type {
  BrainGate,
  BrainGateActionKey,
  BrainGateCampaign,
  BrainGateCreative,
  BrainGatePlan,
  BrainIdea,
} from '@/types/brain'
import { SectionCard } from './shared'

const KIND_META: Record<
  BrainGate['kind'],
  { label: string; chip: string; Icon: React.ComponentType<{ size?: number }> }
> = {
  creative_craft: { label: 'Craft gate', chip: 'chip-info', Icon: ShieldCheck },
  idea_selection: { label: 'Idea gate', chip: 'chip-accent', Icon: Lightbulb },
  campaign_launch: { label: 'Launch gate', chip: 'chip-warn', Icon: BadgeCheck },
  // A plan gate spends the day's money. Warn rather than accent: it is the one gate on this page
  // where approving commits real budget before a single creative exists.
  plan_approval: { label: 'Day plan', chip: 'chip-warn', Icon: CalendarCheck },
}

interface ApprovalsTabProps {
  tenantId: string
  gates: BrainGate[]
  /** Refetches everything — a cleared gate changes the pipeline and the ledger too. */
  onDecided: () => void
}

export function ApprovalsTab({ tenantId, gates, onDecided }: ApprovalsTabProps) {
  if (gates.length === 0) {
    return (
      <SectionCard title="Approvals" description="The human-in-the-loop gates, on the platform.">
        <div className="py-12 text-center">
          <CircleCheck size={24} aria-hidden="true" style={{ color: 'var(--good)' }} className="mx-auto" />
          <p className="mt-3 text-sm font-semibold" style={{ color: 'var(--ink-2)' }}>
            Nothing is waiting on you
          </p>
          <p className="explain mx-auto mt-1 max-w-[52ch]">
            When the Curator finishes a batch, or the Builder has a campaign paused and ready, the
            gate appears here as well as in Slack. Answering it in either place clears it in both.
          </p>
        </div>
      </SectionCard>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        className="flex items-start gap-3 rounded-xl px-4 py-3"
        style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)' }}
      >
        <Info size={16} aria-hidden="true" style={{ color: 'var(--accent-strong)', marginTop: 2 }} />
        <p className="explain" style={{ color: 'var(--ink-2)' }}>
          These are the same gates the agents post to Slack. Each one shows where it also lives, so
          the two surfaces never disagree about what was decided or by whom.
        </p>
      </div>

      {gates.map((gate) => (
        <GateCard key={gate.gateId} tenantId={tenantId} gate={gate} onDecided={onDecided} />
      ))}
    </div>
  )
}

function GateCard({
  tenantId,
  gate,
  onDecided,
}: {
  tenantId: string
  gate: BrainGate
  onDecided: () => void
}) {
  const meta = KIND_META[gate.kind]
  const { Icon } = meta

  const [selected, setSelected] = useState<string[]>(() => defaultSelection(gate))
  const [note, setNote] = useState('')
  const [pending, setPending] = useState<BrainGateActionKey | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectable = gate.selection !== 'none'

  function toggle(id: string) {
    setSelected((current) => {
      if (gate.selection === 'single') return current[0] === id ? [] : [id]
      return current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    })
  }

  async function decide(action: BrainGateActionKey, requiresNote: boolean) {
    if (requiresNote && !note.trim()) {
      setError('Write a note first — it is what goes back to the agent.')
      return
    }
    if (action === 'approve' && selectable && selected.length === 0) {
      setError('Pick at least one before approving.')
      return
    }

    setPending(action)
    setError(null)
    try {
      await decideBrainGate(tenantId, gate.gateId, {
        action,
        note: note.trim() || undefined,
        selectedIds: selectable ? selected : undefined,
      })
      onDecided()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That decision could not be recorded.')
      setPending(null)
    }
  }

  return (
    <section className="card animate-reveal-up overflow-hidden">
      <header
        className="flex flex-wrap items-start justify-between gap-3 px-5 py-4"
        style={{ background: 'var(--surface-warm)', borderBottom: '1px solid var(--hairline)' }}
      >
        <div className="flex min-w-0 gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'var(--surface)', color: 'var(--accent-strong)', border: '1px solid var(--accent-border)' }}
          >
            <Icon size={16} />
          </span>
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className={`chip ${meta.chip}`}>{meta.label}</span>
              {gate.product && <span className="chip chip-neutral">{gate.product}</span>}
              {gate.expiresAt && (
                <span className="chip chip-neutral">
                  <Clock3 size={11} aria-hidden="true" /> Expires {formatRelativeTime(gate.expiresAt)}
                </span>
              )}
            </div>
            <h2 className="section-title">{gate.title}</h2>
            <p className="explain mt-1 max-w-[72ch]">{gate.summary}</p>
          </div>
        </div>

        <div className="text-right">
          <p className="micro-label">Asked by</p>
          <p className="text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
            {gate.askedBy}
          </p>
          <p className="explain mono">{formatRelativeTime(gate.askedAt)}</p>
          {gate.slackChannel && (
            <p className="explain mt-1 flex items-center justify-end gap-1">
              <MessageSquare size={11} aria-hidden="true" /> also in{' '}
              <span className="mono">{gate.slackChannel}</span>
            </p>
          )}
        </div>
      </header>

      <div className="p-5">
        <GatePayload gate={gate} selected={selected} onToggle={toggle} />
      </div>

      <footer
        className="flex flex-col gap-3 px-5 py-4"
        style={{ background: 'var(--surface-warm)', borderTop: '1px solid var(--hairline)' }}
      >
        <label className="block">
          <span className="micro-label">Note back to the agent</span>
          <textarea
            className="input mt-1.5"
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={
              gate.kind === 'creative_craft'
                ? 'What should change in the revision? e.g. “Drop the portrait — the copy promises an expert the image never shows.”'
                : 'Optional for approve. Required when sending back or rejecting.'
            }
            disabled={pending != null}
          />
        </label>

        {error && (
          <p
            role="alert"
            className="flex items-center gap-2 text-[13px] font-semibold"
            style={{ color: 'var(--bad)' }}
          >
            <TriangleAlert size={14} aria-hidden="true" /> {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {gate.actions.map((action) => {
            const busy = pending === action.key
            const cls =
              action.tone === 'primary'
                ? 'btn btn-accent'
                : action.tone === 'danger'
                  ? 'btn btn-danger'
                  : 'btn btn-ghost'

            return (
              <button
                key={action.key}
                type="button"
                className={cls}
                disabled={pending != null}
                onClick={() => void decide(action.key, action.requiresNote)}
              >
                {busy ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                ) : action.key === 'approve' ? (
                  <CircleCheck size={14} aria-hidden="true" />
                ) : action.key === 'reject' ? (
                  <XCircle size={14} aria-hidden="true" />
                ) : (
                  <MessageSquare size={14} aria-hidden="true" />
                )}
                {action.label}
                {action.key === 'approve' && gate.selection === 'multiple' && selected.length > 0
                  ? ` (${selected.length})`
                  : ''}
              </button>
            )
          })}
        </div>
      </footer>
    </section>
  )
}

function defaultSelection(gate: BrainGate): string[] {
  // Pre-select what the agent itself judged fit. The operator is confirming a
  // recommendation, not doing the Curator's job again — but every box is still
  // theirs to change.
  if (gate.payload.kind === 'creative_craft') {
    return gate.payload.creatives.filter((c) => c.verdict === 'fit').map((c) => c.id)
  }
  return []
}

function GatePayload({
  gate,
  selected,
  onToggle,
}: {
  gate: BrainGate
  selected: string[]
  onToggle: (id: string) => void
}) {
  switch (gate.payload.kind) {
    case 'creative_craft':
      return (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {gate.payload.creatives.map((creative) => (
            <li key={creative.id}>
              <CreativeCard
                creative={creative}
                checked={selected.includes(creative.id)}
                onToggle={() => onToggle(creative.id)}
              />
            </li>
          ))}
        </ul>
      )
    case 'idea_selection':
      return (
        <ul className="flex flex-col gap-2.5">
          {gate.payload.ideas.map((idea) => (
            <li key={idea.id}>
              <IdeaRow
                idea={idea}
                checked={selected.includes(idea.id)}
                onToggle={() => onToggle(idea.id)}
              />
            </li>
          ))}
        </ul>
      )
    case 'campaign_launch':
      return <CampaignPreview campaign={gate.payload.campaign} />
    case 'plan_approval':
      return <PlanPreview plan={gate.payload.plan} />
  }
}

/**
 * The day's spend plan, presented as the Brain wrote it.
 *
 * Deliberately not parsed into fields. A plan gate's `summary` IS the review — the allocation, its
 * basis, month-to-date spend against the ceiling — written by the agent for a person to read, and
 * chopping it into a table here would mean this component deciding which sentences matter. Rendered
 * whole, in a monospaced block, so what is approved is exactly what was read.
 */
function PlanPreview({ plan }: { plan: BrainGatePlan }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {plan.planDate && <span className="chip chip-neutral">Plan date {plan.planDate}</span>}
        {plan.budgetInr !== null && (
          <span className="chip chip-neutral">Amount override ₹{plan.budgetInr.toLocaleString('en-IN')}</span>
        )}
        {!plan.posted && (
          <span
            className="chip chip-warn"
            title="The gate has not reached Slack yet. You are seeing it before the daemon posts it — deciding here is what closes it."
          >
            Not yet posted to Slack
          </span>
        )}
      </div>
      <pre
        className="overflow-x-auto whitespace-pre-wrap rounded-xl p-4 text-sm"
        style={{ background: 'var(--surface-warm)', border: '1px solid var(--hairline)', color: 'var(--ink-2)' }}
      >
        {plan.summary}
      </pre>
    </div>
  )
}

const VERDICT_META: Record<BrainGateCreative['verdict'], { label: string; chip: string }> = {
  fit: { label: 'Fit to go live', chip: 'chip-good' },
  near_miss: { label: 'Near-miss', chip: 'chip-warn' },
  unfit: { label: 'Unfit', chip: 'chip-bad' },
}

function CreativeCard({
  creative,
  checked,
  onToggle,
}: {
  creative: BrainGateCreative
  checked: boolean
  onToggle: () => void
}) {
  const verdict = VERDICT_META[creative.verdict]

  return (
    <label
      className="card-hover flex h-full cursor-pointer flex-col gap-3 rounded-xl p-3.5"
      style={{
        background: 'var(--surface)',
        border: checked ? '1px solid var(--accent)' : '1px solid var(--hairline)',
        boxShadow: checked ? 'var(--glow-accent)' : undefined,
      }}
    >
      <div className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="mt-1 h-4 w-4 shrink-0"
          style={{ accentColor: 'var(--accent)' }}
          aria-label={`Select ${creative.label}`}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold leading-snug" style={{ color: 'var(--ink)' }}>
            {creative.label}
          </span>
          <span className="mt-1 flex flex-wrap gap-1.5">
            <span className={`chip ${verdict.chip}`}>{verdict.label}</span>
            <span className="chip chip-neutral">{creative.language}</span>
          </span>
        </span>
      </div>

      {/* The real image lands here once the bridge serves it; until then the slot
          is a labelled placeholder, never a broken <img>. */}
      <div
        className="flex aspect-[4/5] w-full items-center justify-center rounded-[10px]"
        style={{ background: 'var(--muted)', border: '1px dashed var(--hairline-strong)' }}
      >
        {creative.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={creative.imageUrl}
            alt={creative.label}
            className="h-full w-full rounded-[10px] object-cover"
          />
        ) : (
          <span className="flex flex-col items-center gap-1.5 px-3 text-center">
            <ImageIcon size={18} aria-hidden="true" style={{ color: 'var(--ink-4)' }} />
            <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
              {creative.format}
            </span>
          </span>
        )}
      </div>

      <p className="text-[13px] leading-snug" style={{ color: 'var(--ink-2)' }}>
        {creative.copy}
      </p>

      {creative.rubric.length > 0 && (
        <ul className="flex flex-col gap-1 border-t pt-2.5" style={{ borderColor: 'var(--hairline-light)' }}>
          {creative.rubric.map((line) => (
            <li key={line.criterion}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
                  {line.criterion}
                </span>
                <span
                  className="mono text-[11.5px] font-bold"
                  style={{ color: line.score >= 4 ? 'var(--good)' : line.score >= 3 ? 'var(--warn)' : 'var(--bad)' }}
                >
                  {line.score}/5
                </span>
              </div>
              {line.note && (
                <p className="text-[11px] leading-snug" style={{ color: 'var(--ink-4)' }}>
                  {line.note}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </label>
  )
}

function IdeaRow({
  idea,
  checked,
  onToggle,
}: {
  idea: BrainIdea
  checked: boolean
  onToggle: () => void
}) {
  return (
    <label
      className="flex cursor-pointer items-start gap-3 rounded-xl px-3.5 py-3"
      style={{
        background: 'var(--surface)',
        border: checked ? '1px solid var(--accent)' : '1px solid var(--hairline)',
        boxShadow: checked ? 'var(--glow-accent)' : undefined,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-1 h-4 w-4 shrink-0"
        style={{ accentColor: 'var(--accent)' }}
        aria-label={`Select ${idea.title}`}
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            {idea.title}
          </span>
          <span className="chip chip-neutral">{idea.product}</span>
          <span className="chip chip-accent">{idea.angle}</span>
        </span>
        <span className="explain mt-1 block">{idea.rationale}</span>
      </span>
    </label>
  )
}

function CampaignPreview({ campaign }: { campaign: BrainGateCampaign }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="card-inset p-4">
          <p className="micro-label">Campaign</p>
          <p className="mono mt-1 text-[13.5px] font-semibold" style={{ color: 'var(--ink)' }}>
            {campaign.name}
          </p>

          <dl className="mt-4 flex flex-col gap-3">
            <Row label="Objective" value={campaign.objective} mono />
            <Row label="Daily budget" value={`${formatCurrency(campaign.dailyBudget)} / day`} />
            <Row label="Audience" value={campaign.audience} />
            <Row label="Placements" value={campaign.placements} />
          </dl>
        </div>

        <div className="card-inset p-4">
          <p className="micro-label">What is already built in Meta</p>
          <ul className="mt-2.5 flex flex-col gap-2">
            {campaign.levels.map((level) => (
              <li key={level.label} className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
                  {level.label}
                </span>
                <span className="text-right">
                  <span className="mono block text-[12.5px] font-semibold" style={{ color: 'var(--ink)' }}>
                    {level.value}
                  </span>
                  {level.note && (
                    <span className="block text-[11px]" style={{ color: 'var(--ink-3)' }}>
                      {level.note}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>

          <p className="micro-label mt-4">Safety checks</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {campaign.checks.map((check) => (
              <li key={check.label} className="flex items-start gap-2">
                {check.passed ? (
                  <CircleCheck size={14} aria-hidden="true" style={{ color: 'var(--good)', marginTop: 2, flexShrink: 0 }} />
                ) : (
                  <TriangleAlert size={14} aria-hidden="true" style={{ color: 'var(--warn)', marginTop: 2, flexShrink: 0 }} />
                )}
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-medium" style={{ color: 'var(--ink-2)' }}>
                    {check.label}
                  </span>
                  {check.note && (
                    <span className="block text-[11px]" style={{ color: 'var(--ink-3)' }}>
                      {check.note}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <p className="micro-label mb-2">Ads that will go live</p>
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {campaign.creatives.map((creative) => (
            <li key={creative.id}>
              <div
                className="flex gap-3 rounded-xl p-3"
                style={{ background: 'var(--surface)', border: '1px solid var(--hairline)' }}
              >
                <div
                  className="flex h-16 w-14 shrink-0 items-center justify-center rounded-[10px]"
                  style={{ background: 'var(--muted)', border: '1px dashed var(--hairline-strong)' }}
                >
                  <ImageIcon size={16} aria-hidden="true" style={{ color: 'var(--ink-4)' }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold leading-snug" style={{ color: 'var(--ink)' }}>
                    {creative.label}
                  </p>
                  <p className="mt-1 text-[12px] leading-snug" style={{ color: 'var(--ink-2)' }}>
                    {creative.copy}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="text-[12.5px]" style={{ color: 'var(--ink-3)' }}>
        {label}
      </dt>
      <dd
        className={`max-w-[38ch] text-right text-[12.5px] font-semibold ${mono ? 'mono' : ''}`}
        style={{ color: 'var(--ink)' }}
      >
        {value}
      </dd>
    </div>
  )
}
