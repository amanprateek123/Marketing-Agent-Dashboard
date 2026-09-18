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
import { formatRelativeTime } from '@/lib/utils'
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
import { AgentGlyph, RunStatusChip, SectionCard, TRIGGER_LABEL } from './shared'
import { TriggerList } from './TriggerList'
import { RunOutputView } from './RunOutput'

const STAGE_LABEL: Record<BrainAgent['stage'], string> = {
  understand: 'Understand',
  create: 'Create',
  control: 'Control',
  improve: 'Improve',
  prove: 'Prove',
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
            title="Run an agent"
            description="These four you can start yourself."
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
                          className="block text-[13.5px] font-semibold leading-snug"
                          style={{ color: active ? 'var(--ink)' : 'var(--ink-2)' }}
                        >
                          {agent.name}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="chip chip-neutral">{STAGE_LABEL[agent.stage]}</span>
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
            title="Brain-triggered"
            description="The core pipeline. You cannot start these — the Brain hands each one its work by webhook, and a sweeper re-fires anything the webhook missed."
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
                    <p className="text-[13px] font-semibold leading-snug" style={{ color: 'var(--ink-2)' }}>
                      {agent.name}
                    </p>
                    <p className="explain mt-0.5 flex items-center gap-1">
                      <Lock size={10} aria-hidden="true" /> {STAGE_LABEL[agent.stage]} · Brain-triggered
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
          <SectionCard title="Run an agent">
            <p className="explain">No agent is available to run right now.</p>
          </SectionCard>
        )}
      </div>

      <SectionCard
        title="Run history"
        description="Every run, whoever started it — you, the Brain, or a schedule."
        padded={false}
      >
        {runs.length === 0 ? (
          <p className="explain px-5 py-8 text-center">Nothing has run yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Agent</th>
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
                        <span className="text-[13.5px] font-semibold">{run.agentName}</span>
                      </span>
                    </td>
                    <td>
                      <RunStatusChip status={run.status} />
                    </td>
                    <td>
                      <span className="explain">{TRIGGER_LABEL[run.trigger]}</span>
                    </td>
                    <td>
                      <span className="explain mono">{formatRelativeTime(run.startedAt)}</span>
                    </td>
                    <td>
                      <span className="explain block max-w-[52ch]">{run.summary ?? '—'}</span>
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
        if (!cancelled) setError(err instanceof Error ? err.message : 'Lost track of that run.')
      }
    }

    void tick()
    return () => {
      cancelled = true
    }
  }, [runId, poll, onRunFinished])

  async function start() {
    if (missingRequired.length) {
      setError(`${missingRequired.join(' and ')} is required.`)
      return
    }
    setStarting(true)
    setError(null)
    setEvents([])
    setRun(null)
    notifiedRef.current = false
    try {
      const { runId: id } = await startBrainAgentRun(tenantId, agent.key, values)
      activeRunRef.current = id
      setRunId(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That run could not be started.')
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
        title={agent.name}
        description={agent.whatItDoes}
        action={<span className="chip chip-good">Live</span>}
      >
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="chip chip-neutral mono" title="Foundry agent id">
            {agent.foundryAgentId}
          </span>
          {agent.schedule && (
            <span className="chip chip-info">
              <CalendarClock size={11} aria-hidden="true" /> {agent.schedule}
            </span>
          )}
          {agent.nextRunAt && (
            <span className="explain">Next automatic run {formatRelativeTime(agent.nextRunAt)}</span>
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
            <p
              role="alert"
              className="flex items-center gap-2 text-[13px] font-semibold"
              style={{ color: 'var(--bad)' }}
            >
              <TriangleAlert size={14} aria-hidden="true" /> {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-accent" onClick={() => void start()} disabled={busy}>
              {busy ? (
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              ) : (
                <Play size={13} fill="currentColor" aria-hidden="true" />
              )}
              {busy ? 'Running…' : run ? 'Run again' : 'Run now'}
            </button>
            {busy && runId && (
              <button type="button" className="btn btn-ghost" onClick={() => void stop()}>
                <Square size={13} aria-hidden="true" /> Stop
              </button>
            )}
            {run?.status === 'succeeded' && (
              <span className="chip chip-good">
                <CircleCheck size={11} aria-hidden="true" /> Finished in{' '}
                {Math.round((run.durationMs ?? 0) / 1000)}s
              </span>
            )}
          </div>
        </div>
      </SectionCard>

      {run && (
        <SectionCard
          title="This run"
          description={
            <>
              <span className="mono">{run.runId}</span> · started {formatRelativeTime(run.startedAt)}
            </>
          }
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
                  className="text-[13.5px]"
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
              <summary className="micro-label">Live log ({events.length})</summary>
              <ul
                className="mt-2 flex max-h-56 flex-col gap-1 overflow-y-auto rounded-xl px-3 py-2.5"
                style={{ background: 'var(--surface-warm)', border: '1px solid var(--hairline-light)' }}
              >
                {events.map((event) => (
                  <li key={event.seq} className="animate-feed-in flex gap-2">
                    <span className="mono shrink-0 text-[11px]" style={{ color: 'var(--ink-4)' }}>
                      {new Date(event.at).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                    <span
                      className="text-[12.5px] leading-snug"
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
              <RefreshCw size={13} className="animate-spin" aria-hidden="true" /> The output appears
              here the moment the agent finishes.
            </p>
          ) : run.error ? (
            <p className="text-[13px] font-semibold" style={{ color: 'var(--bad)' }}>
              {run.error}
            </p>
          ) : null}
        </SectionCard>
      )}
    </div>
  )
}
