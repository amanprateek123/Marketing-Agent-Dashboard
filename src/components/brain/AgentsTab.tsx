'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  CalendarClock,
  CircleCheck,
  CircleDot,
  Loader2,
  Lock,
  Play,
  RefreshCw,
  Square,
  TriangleAlert,
} from 'lucide-react'
import { Details } from '@/components/plain/Details'
import { errorDetail, formatRelative, formatWhen } from '@/lib/plain-language'
import {
  cancelBrainRun,
  getBrainRun,
  getBrainRunEvents,
  startBrainAgentRun,
} from '@/lib/brain-api'
import type {
  BrainAgent,
  BrainAgentKey,
  BrainRunDetail,
  BrainRunEvent,
  BrainRunSummary,
} from '@/types/brain'
import { AGENT_PLAIN, AgentGlyph, RunStatusChip, SectionCard, agentRole, triggerLabel } from './shared'
import { TriggerList } from './TriggerList'
import { RunOutputView } from './RunOutput'

/** Which part of the job each helper covers, in words a marketer would use. */
const STAGE_LABEL: Record<BrainAgent['stage'], string> = {
  understand: 'Research',
  create: 'Making ads',
  control: 'Spending',
  improve: 'Improving',
  prove: 'Reporting',
}

function stageLabel(stage: BrainAgent['stage'] | string): string {
  return STAGE_LABEL[stage as BrainAgent['stage']] ?? 'Other'
}

interface AgentsTabProps {
  tenantId: string
  agents: BrainAgent[]
  runs: BrainRunSummary[]
  onRunFinished: () => void
}

export function AgentsTab({ tenantId, agents, runs, onRunFinished }: AgentsTabProps) {
  const callable = agents.filter((agent) => agent.invocation === 'on_demand')
  const automatic = agents.filter((agent) => agent.invocation !== 'on_demand')

  const [selectedKey, setSelectedKey] = useState<BrainAgentKey | null>(callable[0]?.key ?? null)
  const selected = callable.find((agent) => agent.key === selectedKey) ?? null

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_1fr]">
        <div className="flex flex-col gap-4">
          <SectionCard
            title="Ask a helper"
            description="Each helper does one job for you. Pick one and start it whenever you like."
            padded={false}
          >
            <ul className="flex flex-col">
              {callable.map((agent, index) => {
                const active = agent.key === selectedKey
                return (
                  <li
                    key={agent.key}
                    style={{ borderTop: index === 0 ? undefined : '1px solid var(--hairline-light)' }}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedKey(agent.key)}
                      aria-current={active ? 'true' : undefined}
                      className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors"
                      style={{
                        background: active ? 'var(--accent-bg)' : 'transparent',
                        borderLeft: active ? '3px solid var(--accent)' : '3px solid transparent',
                      }}
                    >
                      <AgentGlyph agentKey={agent.key} size={34} tone={active ? 'accent' : 'neutral'} />
                      <span className="min-w-0 flex-1">
                        <span
                          className="block break-words text-[13.5px] font-semibold leading-snug"
                          style={{ color: active ? 'var(--ink)' : 'var(--ink-2)' }}
                        >
                          {agentRole(agent.key)}
                        </span>
                        <span className="explain block break-words">{agent.name}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="chip chip-neutral">{stageLabel(agent.stage)}</span>
                          {agent.lastRun && <RunStatusChip status={agent.lastRun.status} />}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </SectionCard>

          <SectionCard
            title="Started by the Brain"
            description="These helpers make and launch your ads. You don't start them — the Brain hands each one its work when the step before it is done."
            padded={false}
          >
            <ul className="flex flex-col">
              {automatic.map((agent, index) => (
                <li
                  key={agent.key}
                  className="flex items-start gap-3 px-4 py-3"
                  style={{ borderTop: index === 0 ? undefined : '1px solid var(--hairline-light)' }}
                >
                  <AgentGlyph agentKey={agent.key} size={30} tone="neutral" />
                  <div className="min-w-0 flex-1">
                    <p
                      className="break-words text-[13px] font-semibold leading-snug"
                      style={{ color: 'var(--ink-2)' }}
                    >
                      {agentRole(agent.key)}
                    </p>
                    <p className="explain mt-0.5 break-words">
                      {AGENT_PLAIN[agent.key]?.detail ?? agent.name}
                    </p>
                    <p className="explain mt-0.5 flex flex-wrap items-center gap-1">
                      <Lock size={10} aria-hidden="true" /> {stageLabel(agent.stage)} · Started by the Brain
                    </p>
                    {/* These four are precisely where a paused schedule misleads: they are
                        webhook-driven by design, so "every schedule paused" is the HEALTHY state
                        and looked like breakage for six days. Showing it stops that recurring. */}
                    <div className="mt-2">
                      <TriggerList tenantId={tenantId} agentKey={agent.key} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>

        {selected ? (
          <AgentRunPanel
            key={selected.key}
            tenantId={tenantId}
            agent={selected}
            onRunFinished={onRunFinished}
          />
        ) : (
          <SectionCard title="Ask a helper">
            <p className="explain">No helper is available to start right now.</p>
          </SectionCard>
        )}
      </div>

      <SectionCard
        title="What the helpers have done"
        description="Every piece of work, whoever started it — you, the Brain, or a timetable."
        padded={false}
      >
        {runs.length === 0 ? (
          <p className="explain px-5 py-8 text-center">No helper has done any work yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Helper</th>
                  <th scope="col">Status</th>
                  <th scope="col">Started by</th>
                  <th scope="col">Started</th>
                  <th scope="col">What came of it</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.runId}>
                    <td>
                      <span className="flex items-center gap-2.5">
                        <AgentGlyph agentKey={run.agentKey} size={28} tone="neutral" />
                        <span className="min-w-0">
                          <span className="block text-[13.5px] font-semibold">{agentRole(run.agentKey)}</span>
                          <span className="explain block">{run.agentName}</span>
                        </span>
                      </span>
                    </td>
                    <td>
                      <RunStatusChip status={run.status} />
                    </td>
                    <td>
                      <span className="explain">{triggerLabel(run.trigger)}</span>
                    </td>
                    <td>
                      <span className="explain whitespace-nowrap" title={formatWhen(run.startedAt)}>
                        {formatRelative(run.startedAt)}
                      </span>
                    </td>
                    <td>
                      <span className="explain block max-w-[52ch] break-words">{run.summary ?? '—'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}

function formatDuration(ms: number | null | undefined): string {
  const seconds = Math.max(0, Math.round((ms ?? 0) / 1000))
  if (seconds < 60) return `${seconds} seconds`
  const minutes = Math.round(seconds / 60)
  return minutes === 1 ? '1 minute' : `${minutes} minutes`
}

// ── One agent: its form, its live run, its output ──────────────────────────

function AgentRunPanel({
  tenantId,
  agent,
  onRunFinished,
}: {
  tenantId: string
  agent: BrainAgent
  onRunFinished: () => void
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(agent.inputs.map((input) => [input.key, input.defaultValue ?? ''])),
  )
  const [runId, setRunId] = useState<string | null>(null)
  const [run, setRun] = useState<BrainRunDetail | null>(null)
  const [events, setEvents] = useState<BrainRunEvent[]>([])
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The raw technical message behind `error`, kept for the collapsed Details only.
  const [errorRaw, setErrorRaw] = useState<string | null>(null)

  // Guards a stale poll from writing over a newer run's state after the
  // operator starts a second run before the first finished.
  const activeRunRef = useRef<string | null>(null)
  const notifiedRef = useRef(false)

  const missingRequired = agent.inputs
    .filter((input) => input.required && !values[input.key]?.trim())
    .map((input) => input.label)

  const poll = useCallback(
    async (id: string, cursor: number) => {
      const [detail, page] = await Promise.all([
        getBrainRun(tenantId, id),
        getBrainRunEvents(tenantId, id, cursor),
      ])
      if (activeRunRef.current !== id) return null
      setRun(detail)
      if (page.events.length) setEvents((current) => [...current, ...page.events])
      return { detail, cursor: page.cursor }
    },
    [tenantId],
  )

  useEffect(() => {
    if (!runId) return
    let cancelled = false
    let cursor = 0

    async function tick() {
      if (cancelled) return
      try {
        const result = await poll(runId as string, cursor)
        if (!result || cancelled) return
        cursor = result.cursor
        if (result.detail.status === 'running' || result.detail.status === 'queued') {
          window.setTimeout(() => void tick(), 900)
        } else if (!notifiedRef.current) {
          // One refresh when the run lands — its output may have written a
          // decision or moved a gate, and those live on other tabs.
          notifiedRef.current = true
          onRunFinished()
        }
      } catch (err) {
        if (!cancelled) {
          setError("We lost track of this piece of work. Refresh the page to see where it got to.")
          setErrorRaw(errorDetail(err) || null)
        }
      }
    }

    void tick()
    return () => {
      cancelled = true
    }
  }, [runId, poll, onRunFinished])

  async function start() {
    if (missingRequired.length) {
      setError(`Please fill in ${missingRequired.join(' and ')}.`)
      setErrorRaw(null)
      return
    }
    setStarting(true)
    setError(null)
    setErrorRaw(null)
    setEvents([])
    setRun(null)
    notifiedRef.current = false
    try {
      const { runId: id } = await startBrainAgentRun(tenantId, agent.key, values)
      activeRunRef.current = id
      setRunId(id)
    } catch (err) {
      setError("We couldn't start this. Try again.")
      setErrorRaw(errorDetail(err) || null)
    } finally {
      setStarting(false)
    }
  }

  async function stop() {
    if (!runId) return
    await cancelBrainRun(tenantId, runId)
  }

  const busy = starting || run?.status === 'running' || run?.status === 'queued'

  return (
    <div className="flex flex-col gap-5">
      <SectionCard
        title={agentRole(agent.key)}
        description={
          <>
            <span className="block break-words">{agent.whatItDoes}</span>
            <span className="mt-0.5 block break-words" style={{ color: 'var(--ink-4)' }}>
              {agent.name}
            </span>
          </>
        }
        action={<span className="chip chip-good">Ready</span>}
      >
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {agent.schedule && (
            <span className="chip chip-info max-w-full">
              <CalendarClock size={11} aria-hidden="true" />{' '}
              <span className="min-w-0 break-words">{agent.schedule}</span>
            </span>
          )}
          {agent.nextRunAt && (
            <span className="explain">Next starts on its own {formatRelative(agent.nextRunAt)}</span>
          )}
        </div>

        <div className="mb-5">
          <p className="micro-label mb-2" style={{ color: 'var(--ink-2)' }}>
            What starts it
          </p>
          <TriggerList tenantId={tenantId} agentKey={agent.key} />
        </div>

        <div className="flex flex-col gap-4">
          {agent.inputs.map((input) => (
            <label key={input.key} className="block">
              <span className="micro-label" style={{ color: 'var(--ink-2)' }}>
                {input.label}
                {input.required && (
                  <span style={{ color: 'var(--bad)' }} aria-hidden="true">
                    {' '}
                    *
                  </span>
                )}
              </span>
              {input.hint && <span className="explain mt-0.5 block">{input.hint}</span>}

              {input.type === 'textarea' ? (
                <textarea
                  className="input mt-1.5"
                  rows={4}
                  value={values[input.key] ?? ''}
                  placeholder={input.placeholder}
                  disabled={busy}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, [input.key]: event.target.value }))
                  }
                />
              ) : input.type === 'select' ? (
                <select
                  className="input mt-1.5"
                  value={values[input.key] ?? ''}
                  disabled={busy}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, [input.key]: event.target.value }))
                  }
                >
                  {input.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="input mt-1.5"
                  type={input.type === 'number' ? 'number' : 'text'}
                  value={values[input.key] ?? ''}
                  placeholder={input.placeholder}
                  disabled={busy}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, [input.key]: event.target.value }))
                  }
                />
              )}
            </label>
          ))}

          {error && (
            <div role="alert" className="flex min-w-0 flex-col gap-1">
              <p
                className="flex items-center gap-2 break-words text-[13px] font-semibold"
                style={{ color: 'var(--bad)' }}
              >
                <TriangleAlert size={14} aria-hidden="true" className="shrink-0" /> {error}
              </p>
              {errorRaw && <Details items={[{ label: 'What went wrong', value: errorRaw }]} />}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-accent" onClick={() => void start()} disabled={busy}>
              {busy ? (
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              ) : (
                <Play size={13} fill="currentColor" aria-hidden="true" />
              )}
              {busy ? 'Working…' : run ? 'Start again' : 'Start now'}
            </button>
            {busy && runId && (
              <button type="button" className="btn btn-ghost" onClick={() => void stop()}>
                <Square size={13} aria-hidden="true" /> Stop
              </button>
            )}
            {run?.status === 'succeeded' && (
              <span className="chip chip-good">
                <CircleCheck size={11} aria-hidden="true" /> Finished in{' '}
                {formatDuration(run.durationMs)}
              </span>
            )}
          </div>
        </div>
      </SectionCard>

      {run && (
        <SectionCard
          title="This piece of work"
          description={<>Started {formatRelative(run.startedAt)}</>}
          action={<RunStatusChip status={run.status} />}
        >
          <ol className="mb-5 flex flex-col gap-2">
            {run.steps.map((step) => (
              <li key={step.key} className="flex items-center gap-2.5">
                {step.state === 'done' ? (
                  <CircleCheck size={15} aria-hidden="true" style={{ color: 'var(--good)' }} />
                ) : step.state === 'running' ? (
                  <Loader2 size={15} className="animate-spin" aria-hidden="true" style={{ color: 'var(--info)' }} />
                ) : (
                  <CircleDot size={15} aria-hidden="true" style={{ color: 'var(--ink-4)' }} />
                )}
                <span
                  className="min-w-0 break-words text-[13.5px]"
                  style={{
                    color: step.state === 'pending' ? 'var(--ink-4)' : 'var(--ink-2)',
                    fontWeight: step.state === 'running' ? 600 : 400,
                  }}
                >
                  {step.label}
                </span>
              </li>
            ))}
          </ol>

          {events.length > 0 && (
            <details className="mb-5" open={run.status === 'running'}>
              <summary className="micro-label">Step-by-step progress ({events.length})</summary>
              <ul
                className="mt-2 flex max-h-56 flex-col gap-1 overflow-y-auto rounded-xl px-3 py-2.5"
                style={{ background: 'var(--surface-warm)', border: '1px solid var(--hairline-light)' }}
              >
                {events.map((event) => (
                  <li key={event.seq} className="animate-feed-in flex min-w-0 gap-2">
                    <span className="shrink-0 text-[11px] tabular-nums" style={{ color: 'var(--ink-4)' }}>
                      {new Date(event.at).toLocaleTimeString('en-IN', {
                        hour: 'numeric',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                    <span
                      className="min-w-0 break-words text-[12.5px] leading-snug"
                      style={{
                        color:
                          event.level === 'error'
                            ? 'var(--bad)'
                            : event.level === 'warn'
                              ? 'var(--warn)'
                              : event.level === 'success'
                                ? 'var(--good)'
                                : 'var(--ink-2)',
                      }}
                    >
                      {event.message}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {run.output ? (
            <div className="animate-fade-up border-t pt-5" style={{ borderColor: 'var(--hairline-light)' }}>
              <RunOutputView output={run.output} />
            </div>
          ) : run.status === 'running' ? (
            <p className="explain flex items-center gap-2">
              <RefreshCw size={13} className="animate-spin" aria-hidden="true" /> The result appears
              here as soon as it is done.
            </p>
          ) : run.error ? (
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-[13px] font-semibold" style={{ color: 'var(--bad)' }}>
                This didn&apos;t finish. Try starting it again.
              </p>
              <Details items={[{ label: 'What went wrong', value: run.error }]} />
            </div>
          ) : null}
          <Details className="mt-4" reference={run.runId} />
        </SectionCard>
      )}
    </div>
  )
}
