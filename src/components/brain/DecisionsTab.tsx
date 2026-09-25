'use client'

import React, { useMemo, useState } from 'react'
import {
  ChevronDown,
  Coins,
  CirclePause,
  ImageIcon,
  Rocket,
  ScrollText,
  Scale,
  TrendingUp,
} from 'lucide-react'
import { formatPercent } from '@/lib/utils'
import { Details } from '@/components/plain/Details'
import { formatRelative, formatWhen, plainStatus } from '@/lib/plain-language'
import type { BrainDecision, BrainDecisionKind } from '@/types/brain'
import { EvidenceList, SectionCard } from './shared'

const KIND_META: Record<
  BrainDecisionKind,
  { label: string; chip: string; Icon: React.ComponentType<{ size?: number }> }
> = {
  budget: { label: plainStatus('decisionKind', 'budget').label, chip: 'chip-accent', Icon: Coins },
  pause: { label: plainStatus('decisionKind', 'pause').label, chip: 'chip-bad', Icon: CirclePause },
  scale: { label: plainStatus('decisionKind', 'scale').label, chip: 'chip-good', Icon: TrendingUp },
  creative: { label: plainStatus('decisionKind', 'creative').label, chip: 'chip-info', Icon: ImageIcon },
  launch: { label: plainStatus('decisionKind', 'launch').label, chip: 'chip-good', Icon: Rocket },
  hold: { label: plainStatus('decisionKind', 'hold').label, chip: 'chip-neutral', Icon: Scale },
}

/** A kind the dashboard does not know yet still renders in plain words, never raw. */
function kindMeta(kind: string) {
  return (
    KIND_META[kind as BrainDecisionKind] ?? {
      label: plainStatus('decisionKind', kind).label,
      chip: 'chip-neutral',
      Icon: ScrollText,
    }
  )
}

const FILTERS: Array<{ key: 'all' | BrainDecisionKind; label: string }> = [
  { key: 'all', label: 'Everything' },
  { key: 'budget', label: 'Budget' },
  { key: 'pause', label: 'Pauses' },
  { key: 'scale', label: 'Scale-ups' },
  { key: 'creative', label: 'Ads' },
  { key: 'launch', label: 'Launches' },
  { key: 'hold', label: 'Holds' },
]

export function DecisionsTab({ decisions }: { decisions: BrainDecision[] }) {
  const [filter, setFilter] = useState<'all' | BrainDecisionKind>('all')
  const [openId, setOpenId] = useState<string | null>(decisions[0]?.id ?? null)

  const visible = useMemo(
    () => (filter === 'all' ? decisions : decisions.filter((d) => d.kind === filter)),
    [decisions, filter],
  )

  const measured = decisions.filter((d) => d.outcome?.state === 'measured').length

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        title="What the Brain decided"
        description={
          `Every decision the Brain made, and why. ` +
          `For ${measured} of ${decisions.length} we already know the result — the rest were carried out and we are still waiting to see the effect.`
        }
        action={
          <div
            className="flex flex-wrap items-center gap-1 rounded-xl p-1"
            style={{ background: 'var(--surface-warm)', border: '1px solid var(--hairline)' }}
            role="group"
            aria-label="Filter decisions"
          >
            {FILTERS.map((option) => {
              const active = filter === option.key
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setFilter(option.key)}
                  aria-pressed={active}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                  style={{
                    background: active ? 'var(--ink)' : 'transparent',
                    color: active ? 'var(--paper)' : 'var(--ink-3)',
                  }}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        }
        padded={false}
      >
        {visible.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <ScrollText size={22} aria-hidden="true" style={{ color: 'var(--ink-4)' }} className="mx-auto" />
            <p className="mt-3 text-sm font-semibold" style={{ color: 'var(--ink-2)' }}>
              {filter === 'all'
                ? 'No decisions yet'
                : `No decisions about ${FILTERS.find((f) => f.key === filter)?.label.toLowerCase()} yet`}
            </p>
            <p className="explain mt-1">
              The Brain records a decision every time it changes something. Nothing of this kind has
              happened.
            </p>
          </div>
        ) : (
          <ol className="flex flex-col">
            {visible.map((decision, index) => {
              const meta = kindMeta(decision.kind)
              const { Icon } = meta
              const open = openId === decision.id

              return (
                <li
                  key={decision.id}
                  style={{ borderTop: index === 0 ? undefined : '1px solid var(--hairline-light)' }}
                >
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : decision.id)}
                    aria-expanded={open}
                    className="flex w-full min-w-0 items-start gap-3.5 px-4 py-4 text-left transition-colors sm:px-5"
                    style={{ background: open ? 'var(--surface-warm)' : 'transparent' }}
                  >
                    <span
                      aria-hidden="true"
                      className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]"
                      style={{ background: 'var(--muted)', color: 'var(--ink-2)' }}
                    >
                      <Icon size={15} />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className={`chip ${meta.chip}`}>{meta.label}</span>
                        {decision.product && (
                          <span className="chip chip-neutral max-w-full truncate" title={decision.product}>
                            {decision.product}
                          </span>
                        )}
                        <span className="explain" title={formatWhen(decision.at)}>
                          {formatRelative(decision.at)}
                        </span>
                      </span>
                      <span className="micro-label mt-2 block">The Brain decided</span>
                      <span
                        className="mt-0.5 block break-words text-[15px] font-semibold leading-snug"
                        style={{ color: 'var(--ink)' }}
                      >
                        {decision.headline}
                      </span>

                      {/* Executed and measured must never look the same. */}
                      {decision.outcome && (
                        <span className="mt-2 flex flex-wrap items-center gap-2">
                          {decision.outcome.state === 'measured' ? (
                            <span className="chip chip-good" title={plainStatus('decisionOutcome', 'measured').meaning}>
                              {plainStatus('decisionOutcome', 'measured').label}
                              {decision.outcome.delta ? ` · ${decision.outcome.delta}` : ''}
                            </span>
                          ) : (
                            <span
                              className="chip"
                              style={{
                                background: 'transparent',
                                color: 'var(--ink-3)',
                                border: '1px dashed var(--hairline-strong)',
                              }}
                            >
                              {plainStatus('decisionOutcome', 'executed').label}
                            </span>
                          )}
                          <span className="explain min-w-0 break-words">{decision.outcome.label}</span>
                        </span>
                      )}
                    </span>

                    <span className="flex shrink-0 items-center gap-3">
                      <span className="hidden text-right sm:block">
                        <span className="micro-label block">How sure</span>
                        <span
                          className="text-[13px] font-semibold tabular-nums"
                          style={{ color: 'var(--ink-2)' }}
                        >
                          {formatPercent(decision.confidence)}
                        </span>
                      </span>
                      <ChevronDown
                        size={16}
                        aria-hidden="true"
                        style={{
                          color: 'var(--ink-4)',
                          transform: open ? 'rotate(180deg)' : undefined,
                          transition: 'transform var(--duration-standard) var(--ease-out)',
                        }}
                      />
                    </span>
                  </button>

                  {open && (
                    <div
                      className="animate-fade-in min-w-0 px-4 pb-5 sm:px-5 sm:pl-[70px]"
                      style={{ background: 'var(--surface-warm)' }}
                    >
                      <p className="micro-label mb-1">Because</p>
                      <p className="break-words text-[14px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                        {decision.rationale}
                      </p>
                      <p className="explain mt-2 sm:hidden">
                        How sure: {formatPercent(decision.confidence)}
                      </p>

                      {decision.evidence.length > 0 && (
                        <>
                          <p className="micro-label mt-4 mb-2">The numbers it looked at</p>
                          <EvidenceList evidence={decision.evidence} />
                        </>
                      )}

                      <p className="explain mt-3">Decided {formatWhen(decision.at)}</p>
                      <Details
                        className="mt-3"
                        reference={decision.id}
                        items={decision.runId ? [{ label: 'Work reference', value: decision.runId }] : undefined}
                      />
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </SectionCard>
    </div>
  )
}
