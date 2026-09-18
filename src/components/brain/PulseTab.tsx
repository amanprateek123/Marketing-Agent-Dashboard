'use client'

import React from 'react'
import { ArrowRight, CalendarClock, CircleCheck, Gavel, History, TrendingUp } from 'lucide-react'
import { formatCurrency, formatPercent, formatRelativeTime } from '@/lib/utils'
import type { BrainState, BrainTabKey } from '@/types/brain'
import { AgentGlyph, SectionCard, StatTile, STAGE_STATE_META } from './shared'

const BRAIN_STATUS_META: Record<
  BrainState['brain']['status'],
  { label: string; chip: string; live: boolean }
> = {
  thinking: { label: 'Thinking now', chip: 'chip-info', live: true },
  idle: { label: 'Idle — nothing pending', chip: 'chip-good', live: false },
  blocked: { label: 'Waiting on you', chip: 'chip-warn', live: false },
  offline: { label: 'Offline', chip: 'chip-bad', live: false },
}

const HEALTH_TONE = {
  good: { chip: 'chip-good', bar: 'var(--good)', label: 'Working' },
  watch: { chip: 'chip-warn', bar: 'var(--warn)', label: 'Watch this' },
  bad: { chip: 'chip-bad', bar: 'var(--bad)', label: 'Losing money' },
  unknown: { chip: 'chip-neutral', bar: 'var(--viz-unknown)', label: 'No signal yet' },
} as const

interface PulseTabProps {
  state: BrainState
  onGoToTab: (tab: BrainTabKey) => void
}

export function PulseTab({ state, onGoToTab }: PulseTabProps) {
  const status = BRAIN_STATUS_META[state.brain.status]
  const { budget, pipeline } = state
  const movedProducts = budget.allocations.filter(
    (a) => a.previousDailyBudget != null && a.previousDailyBudget !== a.dailyBudget,
  )

  return (
    <div className="flex flex-col gap-6">
      {/* The Brain's own read on the situation, in its own words. */}
      <section
        className="card overflow-hidden"
        style={{ borderColor: 'var(--accent-border)' }}
      >
        <div
          className="flex flex-col gap-5 px-5 py-5 lg:flex-row lg:items-start lg:justify-between"
          style={{ background: 'linear-gradient(120deg, var(--accent-soft), transparent 65%)' }}
        >
          <div className="flex min-w-0 gap-4">
            <AgentGlyph agentKey="brain" size={48} />
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className={`chip ${status.chip}`}>
                  {status.live && <span className="beacon" aria-hidden="true" />}
                  {status.label}
                </span>
                <span className="chip chip-neutral mono">{state.brain.version}</span>
              </div>
              <p className="insight-quote">{state.brain.headline}</p>
              <p className="explain mt-2 max-w-[70ch]">{state.brain.posture}</p>
            </div>
          </div>

          <dl className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-3 lg:text-right">
            <div>
              <dt className="micro-label flex items-center gap-1.5 lg:justify-end">
                <History size={12} aria-hidden="true" /> Last cycle
              </dt>
              <dd className="mt-0.5 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                {formatRelativeTime(state.brain.lastCycleAt)}
              </dd>
            </div>
            <div>
              <dt className="micro-label flex items-center gap-1.5 lg:justify-end">
                <CalendarClock size={12} aria-hidden="true" /> Next cycle
              </dt>
              <dd className="mt-0.5 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                {formatRelativeTime(state.brain.nextCycleAt)}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Daily budget it controls"
          value={formatCurrency(budget.dailyTotal)}
          meaning={
            budget.changedAt
              ? `Last rebalanced ${formatRelativeTime(budget.changedAt)}`
              : 'Not yet rebalanced'
          }
        />
        <StatTile
          label="Decisions waiting on you"
          value={String(state.openGates)}
          tone={state.openGates > 0 ? 'warn' : 'good'}
          meaning={
            state.openGates > 0
              ? 'The pipeline cannot move until these are answered'
              : 'Nothing is blocked on a human'
          }
        />
        <StatTile
          label="Agents live"
          value={`${state.agentsLive} of ${state.agentsTotal}`}
          meaning="Marketing agents only — internal agents are not shown here"
        />
        <StatTile
          label="Pipeline"
          value={pipeline ? STAGE_STATE_META[stageStateOf(pipeline)].label : 'Idle'}
          tone={pipeline?.status === 'waiting_for_human' ? 'warn' : 'ink'}
          meaning={pipeline ? pipeline.headline : 'No batch in flight'}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_1fr]">
        <SectionCard
          title="Where the money is going"
          description="The Brain's current split, and why each product got what it got."
        >
          <ul className="flex flex-col gap-4">
            {budget.allocations.map((allocation) => {
              const tone = HEALTH_TONE[allocation.health]
              const delta =
                allocation.previousDailyBudget != null
                  ? allocation.dailyBudget - allocation.previousDailyBudget
                  : 0

              return (
                <li key={allocation.product}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                        {allocation.product}
                      </span>
                      <span className={`chip ${tone.chip}`}>{tone.label}</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span
                        className="display-num text-[18px]"
                        style={{ color: 'var(--ink)' }}
                      >
                        {formatCurrency(allocation.dailyBudget)}
                      </span>
                      <span className="explain">/day</span>
                      {delta !== 0 && (
                        <span
                          className="chip chip-accent tabular-nums"
                          title={`Was ${formatCurrency(allocation.previousDailyBudget ?? 0)}/day`}
                        >
                          <TrendingUp size={11} aria-hidden="true" />
                          {delta > 0 ? '+' : '−'}
                          {formatCurrency(Math.abs(delta))}
                        </span>
                      )}
                    </div>
                  </div>

                  <div
                    className="mt-2 h-2 w-full overflow-hidden rounded-full"
                    style={{ background: 'var(--muted)' }}
                    role="img"
                    aria-label={`${allocation.product}: ${formatPercent(allocation.share)} of the daily budget`}
                  >
                    <div
                      className="animate-bar-grow h-full rounded-full"
                      style={{ width: `${Math.round(allocation.share * 100)}%`, background: tone.bar }}
                    />
                  </div>

                  <p className="explain mt-1.5">{allocation.reason}</p>
                </li>
              )
            })}
          </ul>

          {movedProducts.length === 0 && (
            <p className="explain mt-4">No product&rsquo;s budget changed in the last cycle.</p>
          )}
        </SectionCard>

        <SectionCard
          title="What needs you"
          description="Nothing here resolves itself. Each one is holding something up."
          action={
            state.openGates > 0 ? (
              <button type="button" className="btn btn-accent" onClick={() => onGoToTab('approvals')}>
                <Gavel size={14} aria-hidden="true" /> Open approvals
              </button>
            ) : undefined
          }
        >
          {state.attention.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl px-4 py-4" style={{ background: 'var(--good-bg)' }}>
              <CircleCheck size={18} style={{ color: 'var(--good)' }} aria-hidden="true" />
              <p className="text-sm font-semibold" style={{ color: 'var(--ink-2)' }}>
                Nothing is waiting on you.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {state.attention.map((item) => {
                const tone =
                  item.severity === 'bad'
                    ? 'var(--bad)'
                    : item.severity === 'watch'
                      ? 'var(--warn)'
                      : item.severity === 'good'
                        ? 'var(--good)'
                        : 'var(--info)'

                const body = (
                  <>
                    <span
                      aria-hidden="true"
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                      style={{ background: tone }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                        {item.label}
                      </span>
                      <span className="explain mt-0.5 block">{item.detail}</span>
                    </span>
                    {item.tab && (
                      <ArrowRight size={15} aria-hidden="true" style={{ color: 'var(--ink-4)' }} />
                    )}
                  </>
                )

                return (
                  <li key={item.id}>
                    {item.tab ? (
                      <button
                        type="button"
                        onClick={() => onGoToTab(item.tab as BrainTabKey)}
                        className="card-hover flex w-full items-start gap-3 rounded-xl px-3.5 py-3 text-left"
                        style={{ border: '1px solid var(--hairline)', background: 'var(--surface)' }}
                      >
                        {body}
                      </button>
                    ) : (
                      <div
                        className="flex items-start gap-3 rounded-xl px-3.5 py-3"
                        style={{ border: '1px solid var(--hairline)', background: 'var(--surface)' }}
                      >
                        {body}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  )
}

function stageStateOf(pipeline: NonNullable<BrainState['pipeline']>) {
  if (pipeline.stages.some((stage) => stage.state === 'waiting_for_human')) return 'waiting_for_human'
  if (pipeline.stages.some((stage) => stage.state === 'failed')) return 'failed'
  if (pipeline.stages.some((stage) => stage.state === 'blocked')) return 'blocked'
  if (pipeline.stages.some((stage) => stage.state === 'running')) return 'running'
  if (pipeline.stages.every((stage) => stage.state === 'done')) return 'done'
  return 'idle'
}
