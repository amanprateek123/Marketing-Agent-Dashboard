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
import { formatDateTime, formatPercent, formatRelativeTime } from '@/lib/utils'
import type { BrainDecision, BrainDecisionKind } from '@/types/brain'
import { EvidenceList, SectionCard } from './shared'

const KIND_META: Record<
  BrainDecisionKind,
  { label: string; chip: string; Icon: React.ComponentType<{ size?: number }> }
> = {
  budget: { label: 'Budget', chip: 'chip-accent', Icon: Coins },
  pause: { label: 'Paused something', chip: 'chip-bad', Icon: CirclePause },
  scale: { label: 'Scaled up', chip: 'chip-good', Icon: TrendingUp },
  creative: { label: 'Creative', chip: 'chip-info', Icon: ImageIcon },
  launch: { label: 'Launch', chip: 'chip-good', Icon: Rocket },
  hold: { label: 'Held steady', chip: 'chip-neutral', Icon: Scale },
}

const FILTERS: Array<{ key: 'all' | BrainDecisionKind; label: string }> = [
  { key: 'all', label: 'Everything' },
  { key: 'budget', label: 'Budget' },
  { key: 'pause', label: 'Pauses' },
  { key: 'scale', label: 'Scale-ups' },
  { key: 'creative', label: 'Creative' },
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
        title="The decision ledger"
        description={
          `Every call the Brain made, with the evidence it used. ` +
          `${measured} of ${decisions.length} have a measured outcome — the rest are executed but not yet proven.`
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
              No {FILTERS.find((f) => f.key === filter)?.label.toLowerCase()} decisions yet
            </p>
            <p className="explain mt-1">
              The Brain records a decision every time it changes something. Nothing of this kind has
              happened.
            </p>
          </div>
        ) : (
          <ol className="flex flex-col">
            {visible.map((decision, index) => {
              const meta = KIND_META[decision.kind]
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
                    className="flex w-full items-start gap-3.5 px-5 py-4 text-left transition-colors"
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
                          <span className="chip chip-neutral">{decision.product}</span>
                        )}
                        <span className="explain mono">{formatRelativeTime(decision.at)}</span>
                      </span>
                      <span
                        className="mt-1.5 block text-[15px] font-semibold leading-snug"
                        style={{ color: 'var(--ink)' }}
                      >
                        {decision.headline}
                      </span>

                      {/* Executed and measured must never look the same. */}
                      {decision.outcome && (
                        <span className="mt-2 flex flex-wrap items-center gap-2">
                          {decision.outcome.state === 'measured' ? (
                            <span className="chip chip-good">
                              Measured
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
                              Executed · not yet measured
                            </span>
                          )}
                          <span className="explain">{decision.outcome.label}</span>
                        </span>
                      )}
                    </span>

                    <span className="flex shrink-0 items-center gap-3">
                      <span className="hidden text-right sm:block">
                        <span className="micro-label block">Confidence</span>
                        <span
                          className="mono text-[13px] font-semibold"
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
                      className="animate-fade-in px-5 pb-5 pl-[70px]"
                      style={{ background: 'var(--surface-warm)' }}
                    >
                      <p className="text-[14px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                        {decision.rationale}
                      </p>

                      <p className="micro-label mt-4 mb-2">What it decided this on</p>
                      <EvidenceList evidence={decision.evidence} />

                      <p className="explain mono mt-3">
                        {formatDateTime(decision.at)}
                        {decision.runId ? ` · ${decision.runId}` : ''}
                      </p>
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
