'use client'

import { useState, useEffect, use } from 'react'
import { Loader2, Activity, ShieldAlert, GitCompareArrows, Radar } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'
import {
  getActionOutcomes,
  getRegretSummary,
  getPromptVersionEvals,
  getSignalAccuracy,
} from '@/lib/api'
import type {
  ActionOutcomesResponse,
  RegretSummary,
  PromptVersionEval,
  SignalAccuracy,
} from '@/types'

interface PageProps {
  params: Promise<{ tenantId: string }>
}

function OutcomeChip({ label }: { label: string | null }) {
  const classes: Record<string, string> = {
    improved:     'chip-good',
    worsened:     'chip-bad',
    neutral:      'chip-neutral',
    inconclusive: 'chip-warn',
    pending:      'chip-accent',
  }
  const key = label ?? 'pending'
  return (
    <span className={`chip ${classes[key] ?? classes.pending}`}>
      {key === 'pending' ? 'awaiting +72h' : key}
    </span>
  )
}

function SectionHeader({ icon: Icon, color, title, hint }: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  color: string
  title: string
  hint: string
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <Icon size={15} style={{ color }} />
        <h2 className="section-title">{title}</h2>
      </div>
      <p className="text-xs mt-0.5" style={{ color: 'var(--ink-3)' }}>{hint}</p>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="card py-8 text-center">
      <p className="text-xs italic" style={{ color: 'var(--ink-3)' }}>{message}</p>
    </div>
  )
}

export default function IntelligencePage({ params }: PageProps) {
  const { tenantId } = use(params)

  const [outcomes, setOutcomes] = useState<ActionOutcomesResponse | null>(null)
  const [regret, setRegret] = useState<RegretSummary | null>(null)
  const [evals, setEvals] = useState<PromptVersionEval[]>([])
  const [signals, setSignals] = useState<SignalAccuracy | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      // Each section degrades independently — one failed endpoint must not
      // blank the whole intelligence view.
      const [o, r, e, s] = await Promise.allSettled([
        getActionOutcomes(tenantId),
        getRegretSummary(tenantId),
        getPromptVersionEvals(tenantId),
        getSignalAccuracy(tenantId),
      ])
      if (cancelled) return
      if (o.status === 'fulfilled') setOutcomes(o.value)
      if (r.status === 'fulfilled') setRegret(r.value)
      if (e.status === 'fulfilled') setEvals(e.value)
      if (s.status === 'fulfilled') setSignals(s.value)
      if ([o, r, e, s].every((x) => x.status === 'rejected')) {
        setError('Could not reach the intelligence endpoints — is the agent API running?')
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [tenantId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent)' }} />
          <p className="text-sm" style={{ color: 'var(--ink-2)' }}>Loading system intelligence...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-8 py-8 max-w-[1600px] mx-auto stagger">
      {/* Header */}
      <div className="mb-8">
        <p className="micro-label mb-2">Feedback loops</p>
        <h1 className="page-title">System Intelligence</h1>
        <p className="page-subtitle">
          The feedback loops grading the agent&apos;s own decisions — actions, guardrails, prompts, and signals
        </p>
      </div>

      {error && (
        <div className="rounded-xl p-4 mb-6 text-sm" style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad-border)', color: 'var(--bad)' }}>
          {error}
        </div>
      )}

      {/* ===== 1. ACTION TRACK RECORD ===== */}
      <div className="mb-10">
        <SectionHeader
          icon={Activity}
          color="var(--good)"
          title="Action Outcomes"
          hint="Every optimizer action is re-measured at +72h: did the metric it targeted actually move the right way?"
        />
        {!outcomes || (outcomes.trackRecord.total === 0 && outcomes.recent.length === 0) ? (
          <EmptyState message="No executed actions yet — outcomes appear ~72h after the audit loop takes its first action." />
        ) : (
          <div className="flex flex-col gap-4">
            {outcomes.trackRecord.byActionType.length > 0 && (
              <div className="card overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Action type</th>
                      <th className="num">Executed</th>
                      <th className="num">Improved</th>
                      <th className="num">Worsened</th>
                      <th className="num">Neutral</th>
                      <th className="num">Inconclusive</th>
                      <th className="num">Worsened rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outcomes.trackRecord.byActionType.map((b) => (
                      <tr key={b.actionType}>
                        <td className="font-medium" style={{ color: 'var(--ink)' }}>{b.actionType.replace(/_/g, ' ')}</td>
                        <td className="num mono">{b.total}</td>
                        <td className="num mono font-semibold" style={{ color: 'var(--good)' }}>{b.improved}</td>
                        <td className="num mono font-semibold" style={{ color: b.worsened > 0 ? 'var(--bad)' : 'var(--ink-4)' }}>{b.worsened}</td>
                        <td className="num mono">{b.neutral}</td>
                        <td className="num mono" style={{ color: 'var(--ink-3)' }}>{b.inconclusive}</td>
                        <td className="num mono font-bold" style={{ color: b.worsenedRatePct >= 40 ? 'var(--bad)' : b.worsenedRatePct >= 20 ? 'var(--warn)' : 'var(--good)' }}>
                          {b.worsenedRatePct.toFixed(0)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {outcomes.recent.length > 0 && (
              <div className="card overflow-x-auto">
                <p className="micro-label px-4 pt-3 pb-1">Recent actions</p>
                <table className="data-table">
                  <tbody>
                    {outcomes.recent.slice(0, 12).map((a, i) => (
                      <tr key={a._id ?? i}>
                        <td className="font-medium whitespace-nowrap" style={{ color: 'var(--ink)' }}>{a.action.type.replace(/_/g, ' ')}</td>
                        <td className="max-w-[220px] truncate" title={a.action.targetName}>{a.action.targetName ?? a.action.targetId}</td>
                        <td className="whitespace-nowrap text-[10px]" style={{ color: 'var(--ink-3)' }}>{a.trigger.replace(/_/g, ' ')}</td>
                        <td className="whitespace-nowrap mono text-[11px]" style={{ color: 'var(--ink-3)' }}>{formatRelativeTime(a.executedAt)}</td>
                        <td className="num"><OutcomeChip label={a.status === 'final' ? a.outcomeLabel : null} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== 2. GUARDRAIL REGRET ===== */}
      <div className="mb-10">
        <SectionHeader
          icon={ShieldAlert}
          color="var(--warn)"
          title="Guardrail Regret"
          hint="Actions the safety guards blocked, graded +72h later: correct block (problem resolved itself) vs missed signal (the agent was right). High regret = guard too conservative."
        />
        {!regret || regret.total === 0 ? (
          <EmptyState message="No finalized blocked-action evaluations yet — regret labels accumulate ~72h after guards block their first actions." />
        ) : (
          <div className="card overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Blocked by</th>
                  <th className="num">Blocked</th>
                  <th className="num">Correct</th>
                  <th className="num">Missed</th>
                  <th className="num">Regret</th>
                </tr>
              </thead>
              <tbody>
                {regret.byActionAndReason.map((r) => (
                  <tr key={`${r.actionType}-${r.blockedReason}`}>
                    <td className="font-medium" style={{ color: 'var(--ink)' }}>{r.actionType.replace(/_/g, ' ')}</td>
                    <td className="text-[11px]">{r.blockedReason.replace(/_/g, ' ')}</td>
                    <td className="num mono">{r.total}</td>
                    <td className="num mono" style={{ color: 'var(--good)' }}>{r.correct}</td>
                    <td className="num mono" style={{ color: r.missed > 0 ? 'var(--bad)' : 'var(--ink-4)' }}>{r.missed}</td>
                    <td className="num mono font-bold" style={{ color: r.regretRatePct >= 40 ? 'var(--bad)' : r.regretRatePct >= 20 ? 'var(--warn)' : 'var(--good)' }}>
                      {r.regretRatePct.toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===== 3. PROMPT VERSION EVALS ===== */}
      <div className="mb-10">
        <SectionHeader
          icon={GitCompareArrows}
          color="var(--accent)"
          title="Prompt Version Evals"
          hint="Each Day-30 learning cycle is graded before regenerating prompts: did campaigns under the new prompt version beat the previous one (spend-weighted ROAS)?"
        />
        {evals.length === 0 ? (
          <EmptyState message="No evals yet — the first comparison runs at the next Day-30 deep learning cycle, once two prompt versions have campaign data." />
        ) : (
          <div className="flex flex-col gap-3">
            {evals.map((e, i) => {
              const verdictClass: Record<string, string> = {
                improved:     'chip-good',
                regressed:    'chip-bad',
                neutral:      'chip-neutral',
                inconclusive: 'chip-warn',
              }
              return (
                <div key={i} className="card p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold mono tabular-nums" style={{ color: 'var(--ink)' }}>
                        v{e.newerVersion} <span style={{ color: 'var(--ink-3)' }}>vs</span> v{e.olderVersion}
                      </span>
                      <span className={`chip uppercase ${verdictClass[e.verdict]}`}>
                        {e.verdict}
                      </span>
                    </div>
                    <span className="text-xs mono tabular-nums" style={{ color: 'var(--ink-2)' }}>
                      {e.newer.weightedROAS.toFixed(2)}x <span style={{ color: 'var(--ink-4)' }}>vs</span> {e.older.weightedROAS.toFixed(2)}x
                      <span className="ml-2" style={{ color: 'var(--ink-3)' }}>
                        ({e.newer.campaigns}/{e.older.campaigns} campaigns)
                      </span>
                    </span>
                  </div>
                  <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--ink-2)' }}>{e.detail}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ===== 4. SIGNAL ACCURACY ===== */}
      <div>
        <SectionHeader
          icon={Radar}
          color="var(--info)"
          title="Signal Accuracy"
          hint="Which intelligence sources and platforms produce briefs that actually convert — joined from brief performance writebacks over the last 90 days."
        />
        {!signals || signals.briefsWithOutcomes === 0 ? (
          <EmptyState message="No measured briefs yet — accuracy appears once launched briefs reach day-7 performance writeback." />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {([
              { title: 'By idea source', rows: signals.bySource.map((s) => ({ label: s.source, ...s })) },
              { title: 'By signal platform', rows: signals.byPlatform.map((p) => ({ label: p.platform, ...p })) },
            ] as const).map(({ title, rows }) => (
              <div key={title} className="card overflow-x-auto">
                <p className="micro-label px-4 pt-3 pb-1">{title}</p>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Source</th>
                      <th className="num">Launched</th>
                      <th className="num">Converted</th>
                      <th className="num">Avg ROAS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.label}>
                        <td className="font-medium capitalize" style={{ color: 'var(--ink)' }}>{r.label.replace(/_/g, ' ')}</td>
                        <td className="num mono">{r.launched}</td>
                        <td className="num mono">{r.converted}</td>
                        <td className="num mono font-bold" style={{ color: r.avgROAS >= 1.5 ? 'var(--good)' : r.avgROAS >= 1 ? 'var(--warn)' : 'var(--bad)' }}>
                          {r.avgROAS.toFixed(2)}x
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
