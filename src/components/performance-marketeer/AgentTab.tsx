'use client'

import { useEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Tabs from '@radix-ui/react-tabs'
import { X } from 'lucide-react'
import { cancelPmAgentQueued, getPmAgentDates, getPmAgentQueue, getPmAgentRollup, getPmAgentRun, istToday, productLabel, savePmAgentNote } from '@/lib/performance-marketeer-api'
import type { PmAgentAction, PmAgentConfidence, PmAgentQueue, PmAgentRollup, PmAgentRun, PmAgentRunStatus, PmJournalEntry } from '@/types/performance-marketeer'
import { Empty, LoadError, PmSkeleton, SectionCard, TableWrap, fmt, serverMessage, useLoad } from './shared'
import type { PmView } from './PerformanceMarketeer'

const NO_RUNS = 'No AI runs for this date yet — runs come from the nightly pipeline or from Analyse with AI on the Overview tab.'
const NOTE_MAX = 2000
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

const TYPE: Record<PmAgentAction['type'], string> = {
  creative: 'Creative', budget: 'Budget', geo: 'Geo', audience: 'Audience', placement: 'Placement', landing_funnel: 'Landing / funnel', tracking: 'Tracking', festival_prep: 'Festival prep', pause: 'Pause', hold: 'Hold',
}
const LEVEL: Record<PmAgentAction['entityLevel'], string> = { campaign: 'Campaign', adset: 'Ad set', ad: 'Ad', site: 'Site' }
const STATUS: Record<PmAgentRunStatus, { label: string; chip: string }> = {
  queued: { label: 'Queued', chip: 'chip-neutral' },
  running: { label: 'Running', chip: 'chip-info' },
  done: { label: 'Done', chip: 'chip-good' },
  failed: { label: 'Failed', chip: 'chip-bad' },
}
const JOURNAL: Record<PmJournalEntry['status'], { label: string; chip: string }> = {
  taken: { label: 'Taken', chip: 'chip-good' },
  partly: { label: 'Partly taken', chip: 'chip-warn' },
  not_taken: { label: 'Not taken', chip: 'chip-neutral' },
  outside_change: { label: 'Outside change', chip: 'chip-info' },
}
const READ: Record<PmJournalEntry['read'], { label: string; help: string }> = {
  too_soon: { label: 'Too soon to read', help: 'Less than 2 days since the change.' },
  early: { label: 'Early read · day 2–3', help: 'An early signal only — it can still change.' },
  settled: { label: 'Settled · day 7+', help: 'Enough time has passed to judge the result.' },
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const rounds = (r: { investigateRounds: number; planRounds: number }) => `investigate ${plural(r.investigateRounds, 'round')} · plan ${r.planRounds}`
const val = (v: string | number | null) => (v == null || v === '' ? '—' : typeof v === 'number' ? fmt.int(v) : v)

function Change({ a }: { a: PmAgentAction }) {
  const { field, from, to } = a.change
  if (from == null && to == null) return <span style={{ color: 'var(--ink-3)' }}>No change</span>
  return (
    <>
      <span style={{ color: 'var(--ink-3)' }} translate="no">{field}: </span>
      {val(from)} → {val(to)}
    </>
  )
}

function ConfChip({ c }: { c: PmAgentConfidence }) {
  const label = c >= 0.8 ? 'High' : c >= 0.5 ? 'Medium' : 'Low'
  return (
    <span className={`chip ${c >= 0.8 ? 'chip-good' : c >= 0.5 ? 'chip-info' : 'chip-neutral'}`} title="The AI’s confidence, in three coarse bins (0.2 / 0.5 / 0.8).">
      {label} · {c}
    </span>
  )
}

function StatusChip({ status, step }: { status: PmAgentRunStatus; step: string }) {
  const s = STATUS[status] ?? STATUS.queued
  return (
    <span className={`chip ${s.chip}`}>
      {s.label}
      {step && status !== 'done' ? ` · ${step}` : ''}
    </span>
  )
}

function Flags({ a, dash = true }: { a: PmAgentAction; dash?: boolean }) {
  const checks = a.checksFailed ?? []
  if (!a.disputed && !checks.length && a.verdict === 'approve') return dash ? <span style={{ color: 'var(--ink-4)' }}>—</span> : null
  return (
    <span className="flex flex-wrap gap-1">
      {a.verdict === 'unresolved' && <span className="chip chip-warn" title="The plan check hit its round limit with open issues on this action.">Unresolved</span>}
      {a.verdict === 'change' && <span className="chip chip-info" title="The plan checker asked for a change to this action.">Changed</span>}
      {a.disputed && <span className="chip chip-warn" title="The investigator and the verifier disagree on the cause behind this action by more than 0.3.">Disputed</span>}
      {checks.length > 0 && (
        <span className="chip chip-bad" title={checks.join('\n')}>
          Check failed
        </span>
      )}
    </span>
  )
}

// ── Tab ────────────────────────────────────────────────────────────────────

export function AgentTab({ tenantId, view, update }: { tenantId: string; view: PmView; update: (p: Partial<PmView>) => void }) {
  const dates = useLoad('agent-dates', () => getPmAgentDates(tenantId))
  const day = view.day || dates.data?.[0] || ''
  const rollup = useLoad(`agent-rollup${day}`, () => (day ? getPmAgentRollup(tenantId, day) : Promise.resolve<PmAgentRollup>({ date: null, runs: [], actions: [] })))

  const options = dates.data ? (dates.data.includes(day) ? dates.data : [day, ...dates.data]) : []
  const r = rollup.data
  // A queued run finished or was cancelled: pull the new date (if any) and its actions in without a reload.
  const refresh = () => {
    dates.reload()
    rollup.reload()
  }

  let body: React.ReactNode
  if (dates.error) body = <LoadError message={dates.error} onRetry={dates.reload} />
  else if (!dates.data) body = <PmSkeleton rows={2} />
  else if (!dates.data.length)
    body = (
      <div className="card">
        <Empty title={NO_RUNS} hint="Once a run finishes, each day’s actions and campaign runs show up here." />
      </div>
    )
  else
    body = (
      <>
        <div className="card flex flex-wrap items-end gap-x-6 gap-y-3 px-4 py-3.5 sm:px-5">
          <label className="flex min-w-[180px] flex-col gap-1 text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
            Run date (IST)
            <select className="input !min-h-[38px] !py-1.5" name="day" value={day} onChange={(e) => update({ day: e.target.value, run: '' })}>
              {options.map((d) => (
                <option key={d} value={d}>
                  {fmt.date(d)} {d.slice(0, 4)}
                </option>
              ))}
            </select>
          </label>
          {r && r.runs.length > 0 && (
            <p className="explain tabular-nums" aria-live="polite">
              {plural(r.runs.length, 'campaign')} · {plural(r.actions.length, 'action')} · {fmt.inr(r.actions.reduce((s, a) => s + a.impactRupeesPerDay, 0))}/day at stake · AI cost {usd.format(r.runs.reduce((s, x) => s + x.costUsd, 0))}
            </p>
          )}
        </div>

        {rollup.error ? (
          <LoadError message={rollup.error} onRetry={rollup.reload} />
        ) : !r ? (
          <PmSkeleton rows={2} />
        ) : r.runs.length === 0 ? (
          <div className="card">
            <Empty title={NO_RUNS} />
          </div>
        ) : (
          <div className={`flex flex-col gap-5 ${rollup.loading ? 'opacity-60' : ''}`} aria-busy={rollup.loading}>
            <RollupActions r={r} onOpen={(run) => update({ run })} />
            <Campaigns r={r} onOpen={(run) => update({ run })} />
          </div>
        )}
      </>
    )

  return (
    <div className="flex flex-col gap-5">
      <AgentQueue tenantId={tenantId} onOpen={(d, run) => update({ day: d, run })} onFinished={refresh} />
      {body}
      <RunPanel tenantId={tenantId} date={day} campaignId={view.run} onClose={() => update({ run: '' })} />
    </div>
  )
}

// ── Queue (admin-triggered runs for today) ─────────────────────────────────

const POLL_MS = 10_000
const BUDGET_WAIT = 'waiting: daily budget reached'

function elapsed(fromIso: string | null, now: number): string {
  const t = fromIso ? Date.parse(fromIso) : NaN
  if (Number.isNaN(t)) return ''
  const min = Math.max(0, Math.round((now - t) / 60_000))
  return min < 1 ? 'under 1 min' : min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`
}

/**
 * Today’s queue. Polls every 10 s only while something is queued or running and
 * the browser tab is visible; a hidden tab stops polling and catches up on return.
 */
function AgentQueue({ tenantId, onOpen, onFinished }: { tenantId: string; onOpen: (date: string, campaignId: string) => void; onFinished: () => void }) {
  const [today] = useState(istToday)
  const [nonce, setNonce] = useState(0)
  const [st, setSt] = useState<{ data?: PmAgentQueue; error?: string; at: number }>({ at: 0 })
  const [announce, setAnnounce] = useState('')
  const [cancelling, setCancelling] = useState('')
  const [cancelError, setCancelError] = useState('')
  // "<date>|<campaignId>" → 'queued' | 'running' from the previous poll.
  const prev = useRef<Map<string, string> | null>(null)
  const finished = useRef(onFinished)
  useEffect(() => {
    finished.current = onFinished
  })

  useEffect(() => {
    let alive = true
    getPmAgentQueue(tenantId, today).then(
      (data) => {
        if (!alive) return
        const before = prev.current
        const k = (x: { date: string; campaignId: string }) => `${x.date}|${x.campaignId}`
        const msgs: string[] = []
        let anyDone = false
        for (const x of data.running) if (before && before.get(k(x)) !== 'running') msgs.push(`${x.campaignName || x.campaignId} started.`)
        for (const x of data.finished)
          if (before?.has(k(x))) {
            msgs.push(`${x.campaignName || x.campaignId} ${x.status === 'done' ? 'finished' : 'failed'}.`)
            anyDone = true
          }
        prev.current = new Map([...data.queued.map((x) => [k(x), 'queued'] as const), ...data.running.map((x) => [k(x), 'running'] as const)])
        if (msgs.length) setAnnounce(msgs.join(' '))
        setSt({ data, at: Date.now() })
        if (anyDone) finished.current()
      },
      (err: unknown) => alive && setSt((s) => ({ ...s, error: serverMessage(err), at: Date.now() })),
    )
    return () => {
      alive = false
    }
  }, [tenantId, today, nonce])

  const q = st.data
  const active = !!q && (q.queued.length > 0 || q.running.length > 0)
  useEffect(() => {
    if (!active) return
    const poll = () => document.visibilityState === 'visible' && setNonce((n) => n + 1)
    const id = window.setTimeout(poll, POLL_MS)
    document.addEventListener('visibilitychange', poll)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('visibilitychange', poll)
    }
  }, [active, st.at])

  async function cancel(campaignId: string, date: string) {
    setCancelling(`${date}|${campaignId}`)
    setCancelError('')
    try {
      await cancelPmAgentQueued(tenantId, campaignId, date)
      setAnnounce('Analysis cancelled.')
      finished.current()
    } catch (err) {
      setCancelError(`Couldn’t cancel: ${serverMessage(err)}`)
    } finally {
      setCancelling('')
      setNonce((n) => n + 1)
    }
  }

  const otherDay = (d: string) => (d && d !== today ? ` · for ${fmt.date(d)}` : '')
  const finishedSorted = q ? [...q.finished].sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? '')) : []
  const empty = q && !q.queued.length && !q.running.length && !q.finished.length

  return (
    <SectionCard
      title="Queue"
      description={`Today’s AI runs (${fmt.date(today)}) — nightly and queued from the Overview tab.${active ? ' Updates every 10 seconds while this tab is open.' : ''}`}
      action={active ? <span className="chip chip-info">Live</span> : undefined}
    >
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      {!q ? (
        st.error ? (
          <LoadError message={st.error} onRetry={() => setNonce((n) => n + 1)} />
        ) : (
          <div className="flex flex-col gap-2" aria-busy="true">
            <span className="sr-only">Loading queue…</span>
            <div className="skeleton h-12 w-full" />
          </div>
        )
      ) : (
        <div className="flex flex-col gap-4">
          {!q.worker && (
            <p role="status" className="rounded-lg px-3 py-2 text-[13px]" style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-border)', color: 'var(--ink)' }}>
              <strong style={{ color: 'var(--warn)' }}>Worker off: </strong>
              This server doesn’t process the queue — analyses will wait until the worker is enabled.
            </p>
          )}
          <p className="explain tabular-nums">
            AI spend today: {usd.format(q.spentUsd)} of {usd.format(q.capUsd)} daily cap
            {q.spentUsd >= q.capUsd ? ' — cap reached, queued runs wait until tomorrow.' : ''}
          </p>
          {st.error && (
            <p className="text-[13px]" style={{ color: 'var(--bad)' }} role="status">
              Couldn’t refresh the queue — showing the last update. ({st.error})
            </p>
          )}
          {cancelError && (
            <p className="break-words text-[13px]" style={{ color: 'var(--bad)' }} role="alert">
              {cancelError}
            </p>
          )}
          {empty && <Empty title="Nothing in the queue." hint="Pick campaigns on the Overview tab and click Analyse with AI." />}
          {q.running.length > 0 && (
            <QueueGroup label="Running">
              {q.running.map((x) => (
                <QueueRow key={`${x.date}|${x.campaignId}`} name={x.campaignName || x.campaignId} chip={<StatusChip status="running" step={x.step} />}>
                  <span className="tabular-nums">
                    {elapsed(x.startedAt, st.at)} elapsed · {usd.format(x.costUsd)} so far{otherDay(x.date)}
                  </span>
                </QueueRow>
              ))}
            </QueueGroup>
          )}
          {q.queued.length > 0 && (
            <QueueGroup label="Waiting">
              {[...q.queued].sort((a, b) => a.position - b.position).map((x) => {
                const key = `${x.date}|${x.campaignId}`
                const name = x.campaignName || x.campaignId
                return (
                  <QueueRow
                    key={key}
                    name={name}
                    chip={
                      <>
                        <span className="chip chip-neutral">Queued · #{x.position}</span>
                        {x.step === BUDGET_WAIT && (
                          <span className="chip chip-warn" title="Today’s AI spend cap is reached; this run starts once budget frees up.">
                            Waiting · daily budget reached
                          </span>
                        )}
                      </>
                    }
                    action={
                      <button type="button" className="btn btn-ghost !min-h-[34px] !px-3 !py-1.5 text-[13px]" disabled={cancelling === key} aria-label={`Cancel analysis of ${name}`} onClick={() => cancel(x.campaignId, x.date)}>
                        {cancelling === key ? 'Cancelling…' : 'Cancel'}
                      </button>
                    }
                  >
                    {x.queuedAt ? `Queued ${fmt.dateTime(x.queuedAt)}` : 'Queued'}
                    {x.queuedBy ? ` by ${x.queuedBy}` : ''}
                    {otherDay(x.date)}
                    {x.step && x.step !== BUDGET_WAIT ? ` · ${x.step}` : ''}
                  </QueueRow>
                )
              })}
            </QueueGroup>
          )}
          {finishedSorted.length > 0 && (
            <QueueGroup label="Finished today">
              {finishedSorted.map((x) => (
                <QueueRow
                  key={`${x.date}|${x.campaignId}`}
                  name={x.campaignName || x.campaignId}
                  chip={<StatusChip status={x.status} step={x.step} />}
                  action={
                    <button type="button" className="btn btn-ghost !min-h-[34px] !px-3 !py-1.5 text-[13px]" aria-label={`Open run for ${x.campaignName || x.campaignId}`} onClick={() => onOpen(x.date, x.campaignId)}>
                      Open Run
                    </button>
                  }
                >
                  <span className="tabular-nums">
                    {x.finishedAt ? `Finished ${fmt.dateTime(x.finishedAt)} · ` : ''}
                    {x.status === 'done' ? `${plural(x.actionCount, 'action')} · ` : ''}
                    {usd.format(x.costUsd)}
                  </span>
                  {x.status === 'failed' && x.error && (
                    <span className="block break-words" style={{ color: 'var(--bad)' }}>
                      {x.error}
                    </span>
                  )}
                </QueueRow>
              ))}
            </QueueGroup>
          )}
        </div>
      )}
    </SectionCard>
  )
}

function QueueGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="micro-label mb-1.5">{label}</h3>
      <ul className="flex flex-col gap-2">{children}</ul>
    </div>
  )
}

function QueueRow({ name, chip, action, children }: { name: string; chip: React.ReactNode; action?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-3.5 py-2.5" style={{ background: 'var(--surface-warm)', border: '1px solid var(--hairline)' }}>
      <div className="min-w-0 flex-1 basis-[220px]">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="min-w-0 break-words text-[14px] font-semibold">{name}</span>
          {chip}
        </div>
        {children && (
          <div className="mt-0.5 break-words text-[12px]" style={{ color: 'var(--ink-3)' }}>
            {children}
          </div>
        )}
      </div>
      {action}
    </li>
  )
}

function RollupActions({ r, onOpen }: { r: PmAgentRollup; onOpen: (campaignId: string) => void }) {
  return (
    <SectionCard title={`Actions across all campaigns (${r.actions.length})`} description="Ranked by ₹ impact × confidence. Every number comes from a tool result; open a campaign to see the evidence trail." padded={false}>
      {r.actions.length === 0 ? (
        <Empty title="No actions for this date" hint="Runs may still be going, or every campaign was told to hold." />
      ) : (
        <TableWrap label="Actions ranked by impact">
          <thead>
            <tr>
              <th className="num">#</th>
              <th>Action</th>
              <th>Campaign › item</th>
              <th>Change</th>
              <th className="num">₹/day</th>
              <th>Confidence</th>
              <th>Flags</th>
              <th>Judge on</th>
            </tr>
          </thead>
          <tbody>
            {r.actions.map((a, i) => (
              <tr key={`${a.campaignId}-${a.id}`}>
                <td className="num">{i + 1}</td>
                <td className="min-w-[200px] max-w-[260px] whitespace-normal">
                  <span className="block font-semibold leading-snug">{a.title}</span>
                  <span className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
                    {a.id} · {TYPE[a.type] ?? a.type}
                    {a.resetsLearning ? ' · resets learning' : ''}
                  </span>
                </td>
                <td className="min-w-[180px] max-w-[240px] whitespace-normal">
                  <button type="button" className="rounded text-left font-semibold text-[var(--accent-strong)] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-[var(--accent)]" onClick={() => onOpen(a.campaignId)}>
                    <span className="break-words">{a.campaignName || a.campaignId}</span>
                  </button>
                  <span className="block break-words text-[12px]" style={{ color: 'var(--ink-3)' }}>
                    › {LEVEL[a.entityLevel] ?? a.entityLevel} · {a.entityName}
                  </span>
                </td>
                <td className="min-w-[140px] max-w-[200px] whitespace-normal break-words text-[13px]">
                  <Change a={a} />
                </td>
                <td className="num font-semibold">{fmt.inr(a.impactRupeesPerDay)}</td>
                <td>
                  <ConfChip c={a.confidence} />
                </td>
                <td>
                  <Flags a={a} />
                </td>
                <td className="tabular-nums">{fmt.date(a.judgeOn)}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </SectionCard>
  )
}

function Campaigns({ r, onOpen }: { r: PmAgentRollup; onOpen: (campaignId: string) => void }) {
  return (
    <SectionCard title={`Campaign runs (${r.runs.length})`} description="Each campaign goes through investigate → verify → plan → plan check; a check can send a phase back up to 2 times." padded={false}>
      <TableWrap label="Campaign runs">
        <thead>
          <tr>
            <th>Campaign</th>
            <th>Status</th>
            <th>Rounds</th>
            <th className="num">Actions</th>
            <th className="num">₹/day</th>
            <th className="num">AI cost</th>
          </tr>
        </thead>
        <tbody>
          {r.runs.map((x) => (
            <tr key={x.campaignId}>
              <td className="max-w-[340px] whitespace-normal">
                <button type="button" className="rounded text-left font-semibold text-[var(--accent-strong)] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-[var(--accent)]" onClick={() => onOpen(x.campaignId)}>
                  <span className="break-words">{x.campaignName || x.campaignId}</span>
                </button>
                <span className="block text-[12px]" style={{ color: 'var(--ink-3)' }}>
                  {productLabel(x.product)}
                </span>
              </td>
              <td className="max-w-[260px] whitespace-normal">
                <StatusChip status={x.status} step={x.step} />
                {x.status === 'failed' && x.error && (
                  <span className="mt-1 block break-words text-[12px]" style={{ color: 'var(--bad)' }}>
                    {x.error}
                  </span>
                )}
              </td>
              <td className="text-[13px]">{rounds(x)}</td>
              <td className="num">
                {x.actionCount}
                {x.unresolvedCount > 0 && (
                  <span className="block text-[12px]" style={{ color: 'var(--warn)' }}>
                    {x.unresolvedCount} unresolved
                  </span>
                )}
              </td>
              <td className="num">{fmt.inr(x.impactRupeesPerDay)}</td>
              <td className="num">{usd.format(x.costUsd)}</td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </SectionCard>
  )
}

// ── Run panel ──────────────────────────────────────────────────────────────

function RunPanel({ tenantId, date, campaignId, onClose }: { tenantId: string; date: string; campaignId: string; onClose: () => void }) {
  const open = !!campaignId && !!date
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay data-portal className="fixed inset-0 z-[60] animate-fade-in" style={{ background: 'rgba(15,23,42,0.35)' }} />
        <Dialog.Content
          data-portal
          className="fixed inset-y-0 right-0 z-[61] flex w-full max-w-[720px] flex-col overflow-y-auto overscroll-contain animate-panel-slide-in"
          style={{ background: 'var(--paper)', boxShadow: 'var(--shadow-overlay)' }}
        >
          {open && <RunBody key={`${campaignId}|${date}`} tenantId={tenantId} date={date} campaignId={campaignId} />}
          <Dialog.Close asChild>
            <button type="button" className="btn btn-ghost absolute right-4 top-4 !min-h-[36px] !px-2" aria-label="Close panel">
              <X size={18} aria-hidden="true" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** Phase files in the order they were written: brief/journal, then each investigate→verify round, each plan→check round, then the result. */
function fileOrder(name: string): number[] {
  const n = Number(name.slice(0, 2))
  const round = Number(/\.v(\d+)\./.exec(name)?.[1] ?? 0)
  if (Number.isNaN(n)) return [9, 0, 0]
  const group = n === 0 ? 0 : n <= 2 ? 1 : n <= 4 ? 2 : 3
  return [group, round, n]
}
const byFileOrder = (a: string, b: string) => {
  const x = fileOrder(a)
  const y = fileOrder(b)
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2] || a.localeCompare(b)
}

const TAB_CLASS =
  '-mb-px shrink-0 whitespace-nowrap rounded-t-lg border-b-2 border-transparent px-3 py-2 text-[14px] font-semibold text-[var(--ink-3)] transition-colors hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent)] data-[state=active]:border-[var(--accent)] data-[state=active]:text-[var(--accent-strong)]'
const PANEL = 'rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]'

function RunBody({ tenantId, date, campaignId }: { tenantId: string; date: string; campaignId: string }) {
  const run = useLoad(`agent-run${campaignId}${date}`, () => getPmAgentRun(tenantId, campaignId, date))
  const d = run.data
  return (
    <div className="flex flex-col gap-4 p-5 pt-6">
      <div className="pr-12">
        <p className="micro-label">AI analyst · {fmt.date(date)}{d ? ` · ${productLabel(d.product)}` : ''}</p>
        <Dialog.Title className="section-title mt-1 break-words text-pretty">{d?.campaignName || campaignId}</Dialog.Title>
        <Dialog.Description className="explain mt-1">
          {d ? `${rounds(d)} · ${plural(d.actions.length, 'action')} · ${fmt.inr(d.impactRupeesPerDay)}/day · AI cost ${usd.format(d.costUsd)}` : 'Loading run…'}
        </Dialog.Description>
        {d && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <StatusChip status={d.status} step={d.step} />
          </div>
        )}
      </div>
      {run.error ? (
        <LoadError message={run.error} onRetry={run.reload} />
      ) : !d ? (
        <PmSkeleton rows={2} />
      ) : (
        <>
          {d.status === 'failed' && d.error && (
            <p role="alert" className="rounded-lg px-3 py-2 text-[13px]" style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad-border)', color: 'var(--ink)' }}>
              <strong style={{ color: 'var(--bad)' }}>Run failed{d.step ? ` at ${d.step}` : ''}: </strong>
              <span className="break-words">{d.error}</span>
            </p>
          )}
          <Tabs.Root defaultValue="actions" className="flex min-w-0 flex-col gap-4">
            <Tabs.List aria-label="Run details" className="flex gap-1 overflow-x-auto overflow-y-hidden" style={{ borderBottom: '1px solid var(--hairline)' }}>
              <Tabs.Trigger value="actions" className={TAB_CLASS}>Actions ({d.actions.length})</Tabs.Trigger>
              <Tabs.Trigger value="journal" className={TAB_CLASS}>Journal ({d.journal.length})</Tabs.Trigger>
              <Tabs.Trigger value="files" className={TAB_CLASS}>Phase Files ({Object.keys(d.files).length})</Tabs.Trigger>
              <Tabs.Trigger value="note" className={TAB_CLASS}>Your Note{d.userNote ? ' ✓' : ''}</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="actions" className={PANEL}>
              <RunActions d={d} />
            </Tabs.Content>
            <Tabs.Content value="journal" className={PANEL}>
              <Journal entries={d.journal} />
            </Tabs.Content>
            <Tabs.Content value="files" className={PANEL}>
              <Files files={d.files} />
            </Tabs.Content>
            <Tabs.Content value="note" className={PANEL}>
              <NoteBox tenantId={tenantId} d={d} onSaved={run.reload} />
            </Tabs.Content>
          </Tabs.Root>
        </>
      )}
    </div>
  )
}

function RunActions({ d }: { d: PmAgentRun }) {
  return (
    <div className="flex flex-col gap-3">
      {d.unresolved.length > 0 && (
        <div className="rounded-lg px-3 py-2 text-[13px]" style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-border)', color: 'var(--ink-2)' }}>
          <strong style={{ color: 'var(--warn)' }}>Unresolved after the round limit:</strong>
          <ul className="mt-1 list-disc pl-5">
            {d.unresolved.map((u, i) => (
              <li key={i} className="break-words">{u}</li>
            ))}
          </ul>
        </div>
      )}
      {d.actions.length === 0 ? (
        <Empty title="No actions in this run" hint={d.status === 'done' ? 'The plan had no approved actions.' : 'The run has not reached the final plan yet.'} />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {d.actions.map((a) => (
            <li key={a.id} className="rounded-xl px-4 py-3" style={{ background: 'var(--surface-warm)', border: '1px solid var(--hairline)' }}>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="chip chip-accent !font-bold">{a.id}</span>
                <span className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
                  {TYPE[a.type] ?? a.type} · {LEVEL[a.entityLevel] ?? a.entityLevel}
                </span>
                <span className="min-w-0 break-words text-[12.5px] font-semibold" style={{ color: 'var(--ink-2)' }}>{a.entityName}</span>
              </div>
              <p className="mt-1.5 text-[15px] font-semibold leading-snug">{a.title}</p>
              <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-[13px] sm:grid-cols-[auto_1fr]" style={{ color: 'var(--ink-2)' }}>
                <dt style={{ color: 'var(--ink-3)' }}>Change</dt>
                <dd className="break-words">
                  <Change a={a} />
                </dd>
                <dt style={{ color: 'var(--ink-3)' }}>Expected</dt>
                <dd className="tabular-nums">{a.expectedEffect.metric} {a.expectedEffect.low} to {a.expectedEffect.high}</dd>
                <dt style={{ color: 'var(--ink-3)' }}>Impact</dt>
                <dd className="tabular-nums">{fmt.inr(a.impactRupeesPerDay)}/day</dd>
                <dt style={{ color: 'var(--ink-3)' }}>Judge on</dt>
                <dd>{fmt.date(a.judgeOn)}{a.resetsLearning ? ' · resets learning' : ''}</dd>
                <dt style={{ color: 'var(--ink-3)' }}>Stop if</dt>
                <dd className="break-words">{a.stopCondition || '—'}</dd>
                {a.causeIds.length > 0 && (
                  <>
                    <dt style={{ color: 'var(--ink-3)' }}>Causes</dt>
                    <dd>{a.causeIds.join(', ')}</dd>
                  </>
                )}
              </dl>
              {a.creativeBrief && (
                <p className="mt-2 break-words rounded-lg px-3 py-2 text-[13px]" style={{ background: 'var(--surface)', border: '1px solid var(--hairline-light)' }}>
                  <strong>Creative brief: </strong>
                  {a.creativeBrief}
                </p>
              )}
              {a.checksFailed && a.checksFailed.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-[12.5px]" style={{ color: 'var(--bad)' }}>
                  {a.checksFailed.map((c, i) => (
                    <li key={i} className="break-words">{c}</li>
                  ))}
                </ul>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <ConfChip c={a.confidence} />
                <Flags a={a} dash={false} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Journal({ entries }: { entries: PmJournalEntry[] }) {
  if (!entries.length) return <Empty title="Nothing in the journal yet" hint="It fills from earlier recommendations and the Meta change log." />
  return (
    <ul className="flex flex-col gap-2.5">
      {entries.map((e, i) => {
        const s = JOURNAL[e.status] ?? JOURNAL.not_taken
        const r = READ[e.read] ?? READ.too_soon
        return (
          <li key={i} className="rounded-xl px-4 py-3" style={{ background: 'var(--surface-warm)', border: '1px solid var(--hairline)' }}>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[12px] tabular-nums" style={{ color: 'var(--ink-3)' }}>
                {fmt.date(e.date)}
                {e.actionId ? ` · ${e.actionId}` : ''}
              </span>
              <span className={`chip ${s.chip}`}>{s.label}</span>
              <span className="chip chip-neutral" title={r.help}>{r.label}</span>
              {e.resetsLearning && <span className="chip chip-warn">Resets learning</span>}
            </div>
            <p className="mt-1.5 break-words text-[14.5px] font-semibold leading-snug">{e.title}</p>
            {e.matched.length > 0 && <p className="explain mt-1 break-words">Matched: {e.matched.join(' · ')}</p>}
            <p className="mt-1 break-words text-[13px]" style={{ color: 'var(--ink-2)' }}>
              Result so far: {e.resultSoFar || '—'}
              {e.judgeAgainOn ? ` · judge again ${fmt.date(e.judgeAgainOn)}` : ''}
            </p>
            {e.userNote && <p className="explain mt-1 break-words">Your note: “{e.userNote}”</p>}
          </li>
        )
      })}
    </ul>
  )
}

function Files({ files }: { files: Record<string, string> }) {
  const names = Object.keys(files).sort(byFileOrder)
  if (!names.length) return <Empty title="No phase files yet" hint="Files appear as each phase finishes." />
  return (
    <div className="flex flex-col gap-2">
      {names.map((n) => (
        <details key={n} className="group rounded-xl" style={{ background: 'var(--surface-warm)', border: '1px solid var(--hairline)' }}>
          <summary className="cursor-pointer rounded-xl px-4 py-2.5 text-[13.5px] font-semibold focus-visible:outline-2 focus-visible:outline-[var(--accent)]" translate="no">
            {n}
            <span className="ml-2 font-normal" style={{ color: 'var(--ink-3)' }}>{fmt.int(files[n].length)} chars</span>
          </summary>
          {/* ponytail: plain text, no markdown renderer in the deps; add react-markdown if formatting matters */}
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words px-4 pb-3 text-[12.5px] leading-relaxed" style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono, ui-monospace, monospace)' }}>
            {files[n]}
          </pre>
        </details>
      ))}
    </div>
  )
}

function NoteBox({ tenantId, d, onSaved }: { tenantId: string; d: PmAgentRun; onSaved: () => void }) {
  const [note, setNote] = useState(d.userNote)
  const [state, setState] = useState<{ saving: boolean; msg: string; error: boolean }>({ saving: false, msg: '', error: false })
  async function save(e: React.FormEvent) {
    e.preventDefault()
    setState({ saving: true, msg: '', error: false })
    try {
      await savePmAgentNote(tenantId, d.campaignId, d.date, note)
      setState({ saving: false, msg: 'Saved — tomorrow’s run will read it.', error: false })
      onSaved()
    } catch (err) {
      setState({ saving: false, msg: `Couldn’t save the note. Try again. (${(err instanceof Error ? err.message : String(err)).slice(0, 120)})`, error: true })
    }
  }
  return (
    <form className="flex flex-col gap-2" onSubmit={save}>
      <label htmlFor="pm-agent-note" className="text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
        Tell tomorrow’s run what you did with these actions
      </label>
      <textarea
        id="pm-agent-note"
        name="note"
        className="input !min-h-[140px] resize-y"
        value={note}
        maxLength={NOTE_MAX}
        autoComplete="off"
        placeholder="Did A2, skipped A3 because the Diwali creative isn’t ready…"
        aria-describedby="pm-agent-note-help"
        onChange={(e) => setNote(e.target.value)}
      />
      <p id="pm-agent-note-help" className="explain tabular-nums">
        {note.length.toLocaleString('en-IN')} / {NOTE_MAX.toLocaleString('en-IN')} characters · added to the journal for {d.campaignName || d.campaignId}.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={state.saving}>
          {state.saving ? 'Saving…' : 'Save Note'}
        </button>
        <span aria-live="polite" className="text-[13px]" style={{ color: state.error ? 'var(--bad)' : 'var(--ink-3)' }}>
          {state.msg}
        </span>
      </div>
    </form>
  )
}
