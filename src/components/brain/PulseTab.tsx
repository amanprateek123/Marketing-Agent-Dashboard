'use client'

import React from 'react'
import { ArrowRight, CalendarClock, CircleCheck, Gavel, History, TrendingUp } from 'lucide-react'
import { formatPercent } from '@/lib/utils'
import { Details } from '@/components/plain/Details'
import { formatInr, formatRelative, plainStatus } from '@/lib/plain-language'
import type { BrainState, BrainTabKey } from '@/types/brain'
import { AgentGlyph, SectionCard, StatTile, STAGE_STATE_META, plainIfCode } from './shared'

const BRAIN_STATUS_META: Record<
  BrainState['brain']['status'],
  { label: string; chip: string; live: boolean }
> = {
  thinking: { label: plainStatus('brainStatus', 'thinking').label, chip: 'chip-info', live: true },
  idle: { label: plainStatus('brainStatus', 'idle').label, chip: 'chip-good', live: false },
  blocked: { label: plainStatus('brainStatus', 'blocked').label, chip: 'chip-warn', live: false },
  offline: { label: plainStatus('brainStatus', 'offline').label, chip: 'chip-bad', live: false },
}

const HEALTH_TONE: Record<string, { chip: string; bar: string; label: string }> = {
  good: { chip: 'chip-good', bar: 'var(--good)', label: plainStatus('health', 'good').label },
  watch: { chip: 'chip-warn', bar: 'var(--warn)', label: plainStatus('health', 'watch').label },
  bad: { chip: 'chip-bad', bar: 'var(--bad)', label: plainStatus('health', 'bad').label },
  unknown: { chip: 'chip-neutral', bar: 'var(--viz-unknown)', label: plainStatus('health', 'unknown').label },
}

interface PulseTabProps {
  state: BrainState
  onGoToTab: (tab: BrainTabKey) => void
}

export function PulseTab({ state, onGoToTab }: PulseTabProps) {
  const status = BRAIN_STATUS_META[state.brain.status] ?? {
    label: plainStatus('brainStatus', state.brain.status).label,
    chip: 'chip-neutral',
    live: false,
  }
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
                <span
                  className={`chip ${status.chip}`}
                  title={plainStatus('brainStatus', state.brain.status).meaning || undefined}
                >
                  {status.live && <span className="beacon" aria-hidden="true" />}
                  {status.label}
                </span>
              </div>
              <p className="insight-quote break-words">{state.brain.headline}</p>
              <p className="explain mt-2 max-w-[70ch] break-words">
                {plainIfCode(state.brain.posture, 'brainLabel')}
              </p>
              {state.brain.version && (
                <Details className="mt-3" items={[{ label: 'Brain version', value: state.brain.version }]} />
              )}
            </div>
          </div>

          <dl className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-3 lg:text-right">
            <div>
              <dt className="micro-label flex items-center gap-1.5 lg:justify-end">
                <History size={12} aria-hidden="true" /> Last checked
              </dt>
              <dd className="mt-0.5 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                {formatRelative(state.brain.lastCycleAt)}
              </dd>
            </div>
            <div>
              <dt className="micro-label flex items-center gap-1.5 lg:justify-end">
                <CalendarClock size={12} aria-hidden="true" /> Next check
              </dt>
              <dd className="mt-0.5 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                {formatRelative(state.brain.nextCycleAt)}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Daily budget it manages"
          value={formatInr(budget.dailyTotal)}
          meaning={
            budget.changedAt
              ? `Split between products ${formatRelative(budget.changedAt)}`
              : 'Not split between products yet'
          }
        />
        <StatTile
          label="Decisions waiting on you"
          value={String(state.openGates)}
          tone={state.openGates > 0 ? 'warn' : 'good'}
          meaning={
            state.openGates > 0
              ? 'New ads and campaigns wait until you answer these'
              : 'Nothing is waiting for your go-ahead'
          }
        />
        <StatTile
          label="Helpers working"
          value={`${state.agentsLive} of ${state.agentsTotal}`}
          meaning="The AI helpers that make, check and launch your ads"
        />
        <StatTile
          label="New ads"
          value={pipeline ? STAGE_STATE_META[stageStateOf(pipeline)].label : 'Nothing in progress'}
          tone={pipeline?.status === 'waiting_for_human' ? 'warn' : 'ink'}
          meaning={pipeline ? pipeline.headline : 'No new ads are being made right now'}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_1fr]">
        <SectionCard
          title="Where the money is going"
          description="How the Brain is splitting the daily budget, and why each product got what it got."
        >
          <ul className="flex flex-col gap-4">
            {budget.allocations.map((allocation) => {
              const tone = HEALTH_TONE[allocation.health] ?? {
                chip: 'chip-neutral',
                bar: 'var(--viz-unknown)',
                label: plainStatus('health', allocation.health).label,
              }
              const delta =
                allocation.previousDailyBudget != null
                  ? allocation.dailyBudget - allocation.previousDailyBudget
                  : 0

              return (
                <li key={allocation.product}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="min-w-0 break-words text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                        {allocation.product}
                      </span>
                      <span className={`chip ${tone.chip}`}>{tone.label}</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span
                        className="display-num text-[18px]"
                        style={{ color: 'var(--ink)' }}
                      >
                        {formatInr(allocation.dailyBudget)}
                      </span>
                      <span className="explain">a day</span>
                      {delta !== 0 && (
                        <span
                          className="chip chip-accent tabular-nums"
                          title={`Was ${formatInr(allocation.previousDailyBudget ?? 0, { perDay: true })}`}
                        >
                          <TrendingUp size={11} aria-hidden="true" />
                          {delta > 0 ? '+' : '−'}
                          {formatInr(Math.abs(delta))}
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

                  <p className="explain mt-1.5 break-words">{allocation.reason}</p>
                </li>
              )
            })}
          </ul>

          {movedProducts.length === 0 && (
            <p className="explain mt-4">No product&rsquo;s budget changed at the last check.</p>
          )}
        </SectionCard>

        <SectionCard
          title="What needs you"
          description="These won't sort themselves out — each one is holding something up."
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
                      <span className="block break-words text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                        {item.label}
                      </span>
                      <span className="explain mt-0.5 block break-words">{item.detail}</span>
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
