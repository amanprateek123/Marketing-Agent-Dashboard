'use client'

import { useState, useEffect, use } from 'react'
import { Brain, Loader2, Activity, ShieldAlert, GitCompareArrows, Radar } from 'lucide-react'
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

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  boxShadow: '0 1px 2px rgba(15,23,42,0.03)',
}

const thCls = 'px-3 py-2 text-[10px] font-semibold uppercase tracking-wider'
const thStyle: React.CSSProperties = { color: '#9ca3af' }

function OutcomeChip({ label }: { label: string | null }) {
  const styles: Record<string, React.CSSProperties> = {
    improved:     { background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' },
    worsened:     { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' },
    neutral:      { background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb' },
    inconclusive: { background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' },
    pending:      { background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe' },
  }
  const key = label ?? 'pending'
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={styles[key] ?? styles.pending}>
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
        <h2 className="text-[15px] font-bold tracking-tight" style={{ color: '#18181b' }}>{title}</h2>
      </div>
      <p className="text-xs mt-0.5" style={{ color: '#a1a1aa' }}>{hint}</p>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl py-8 text-center" style={cardStyle}>
      <p className="text-xs italic" style={{ color: '#9ca3af' }}>{message}</p>
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
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#f8f9fb' }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin" style={{ color: '#4338ca' }} />
          <p className="text-sm" style={{ color: '#71717a' }}>Loading system intelligence...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-7 max-w-5xl mx-auto animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: '#eef2ff', border: '1px solid #c7d2fe' }}
        >
          <Brain size={15} style={{ color: '#4338ca' }} />
        </div>
        <div>
          <h1 className="text-[20px] font-bold tracking-tight" style={{ color: '#18181b' }}>
            System Intelligence
          </h1>
          <p className="text-xs mt-0.5" style={{ color: '#a1a1aa' }}>
            The feedback loops grading the agent&apos;s own decisions — actions, guardrails, prompts, and signals
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl p-4 mb-6 text-sm" style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#b91c1c' }}>
          {error}
        </div>
      )}

      {/* ===== 1. ACTION TRACK RECORD ===== */}
      <div className="mb-10">
        <SectionHeader
          icon={Activity}
          color="#15803d"
          title="Action Outcomes"
          hint="Every optimizer action is re-measured at +72h: did the metric it targeted actually move the right way?"
        />
        {!outcomes || (outcomes.trackRecord.total === 0 && outcomes.recent.length === 0) ? (
          <EmptyState message="No executed actions yet — outcomes appear ~72h after the audit loop takes its first action." />
        ) : (
          <div className="flex flex-col gap-4">
            {outcomes.trackRecord.byActionType.length > 0 && (
              <div className="rounded-xl overflow-x-auto" style={cardStyle}>
                <table className="w-full">
                  <thead>
                    <tr style={{ background: '#fafafa', borderBottom: '1px solid #f3f4f6' }}>
                      <th className={`${thCls} text-left`} style={thStyle}>Action type</th>
                      <th className={`${thCls} text-right`} style={thStyle}>Executed</th>
                      <th className={`${thCls} text-right`} style={{ color: '#15803d' }}>Improved</th>
                      <th className={`${thCls} text-right`} style={{ color: '#b91c1c' }}>Worsened</th>
                      <th className={`${thCls} text-right`} style={thStyle}>Neutral</th>
                      <th className={`${thCls} text-right`} style={thStyle}>Inconclusive</th>
                      <th className={`${thCls} text-right`} style={thStyle}>Worsened rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outcomes.trackRecord.byActionType.map((b, i) => (
                      <tr key={b.actionType} style={{ borderBottom: i < outcomes.trackRecord.byActionType.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                        <td className="px-3 py-2.5 text-xs font-medium" style={{ color: '#374151' }}>{b.actionType.replace(/_/g, ' ')}</td>
                        <td className="px-3 py-2.5 text-right text-xs tabular-nums" style={{ color: '#6b7280' }}>{b.total}</td>
                        <td className="px-3 py-2.5 text-right text-xs tabular-nums font-semibold" style={{ color: '#15803d' }}>{b.improved}</td>
                        <td className="px-3 py-2.5 text-right text-xs tabular-nums font-semibold" style={{ color: b.worsened > 0 ? '#b91c1c' : '#d1d5db' }}>{b.worsened}</td>
                        <td className="px-3 py-2.5 text-right text-xs tabular-nums" style={{ color: '#6b7280' }}>{b.neutral}</td>
                        <td className="px-3 py-2.5 text-right text-xs tabular-nums" style={{ color: '#9ca3af' }}>{b.inconclusive}</td>
                        <td className="px-3 py-2.5 text-right text-xs tabular-nums font-bold" style={{ color: b.worsenedRatePct >= 40 ? '#b91c1c' : b.worsenedRatePct >= 20 ? '#b45309' : '#15803d' }}>
                          {b.worsenedRatePct.toFixed(0)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {outcomes.recent.length > 0 && (
              <div className="rounded-xl overflow-x-auto" style={cardStyle}>
                <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={thStyle}>Recent actions</p>
                <table className="w-full">
                  <tbody>
                    {outcomes.recent.slice(0, 12).map((a, i) => (
                      <tr key={a._id ?? i} style={{ borderTop: '1px solid #f3f4f6' }}>
                        <td className="px-4 py-2 text-xs font-medium whitespace-nowrap" style={{ color: '#374151' }}>{a.action.type.replace(/_/g, ' ')}</td>
                        <td className="px-3 py-2 text-xs max-w-[220px] truncate" style={{ color: '#6b7280' }} title={a.action.targetName}>{a.action.targetName ?? a.action.targetId}</td>
                        <td className="px-3 py-2 text-[10px] whitespace-nowrap" style={{ color: '#9ca3af' }}>{a.trigger.replace(/_/g, ' ')}</td>
                        <td className="px-3 py-2 text-[11px] whitespace-nowrap tabular-nums" style={{ color: '#9ca3af' }}>{formatRelativeTime(a.executedAt)}</td>
                        <td className="px-3 py-2 text-right"><OutcomeChip label={a.status === 'final' ? a.outcomeLabel : null} /></td>
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
          color="#b45309"
          title="Guardrail Regret"
          hint="Actions the safety guards blocked, graded +72h later: correct block (problem resolved itself) vs missed signal (the agent was right). High regret = guard too conservative."
        />
        {!regret || regret.total === 0 ? (
          <EmptyState message="No finalized blocked-action evaluations yet — regret labels accumulate ~72h after guards block their first actions." />
        ) : (
          <div className="rounded-xl overflow-x-auto" style={cardStyle}>
            <table className="w-full">
              <thead>
                <tr style={{ background: '#fafafa', borderBottom: '1px solid #f3f4f6' }}>
                  <th className={`${thCls} text-left`} style={thStyle}>Action</th>
                  <th className={`${thCls} text-left`} style={thStyle}>Blocked by</th>
                  <th className={`${thCls} text-right`} style={thStyle}>Blocked</th>
                  <th className={`${thCls} text-right`} style={{ color: '#15803d' }}>Correct</th>
                  <th className={`${thCls} text-right`} style={{ color: '#b91c1c' }}>Missed</th>
                  <th className={`${thCls} text-right`} style={thStyle}>Regret</th>
                </tr>
              </thead>
              <tbody>
                {regret.byActionAndReason.map((r, i) => (
                  <tr key={`${r.actionType}-${r.blockedReason}`} style={{ borderBottom: i < regret.byActionAndReason.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                    <td className="px-3 py-2.5 text-xs font-medium" style={{ color: '#374151' }}>{r.actionType.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2.5 text-[11px]" style={{ color: '#6b7280' }}>{r.blockedReason.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums" style={{ color: '#6b7280' }}>{r.total}</td>
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums" style={{ color: '#15803d' }}>{r.correct}</td>
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums" style={{ color: r.missed > 0 ? '#b91c1c' : '#d1d5db' }}>{r.missed}</td>
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums font-bold" style={{ color: r.regretRatePct >= 40 ? '#b91c1c' : r.regretRatePct >= 20 ? '#b45309' : '#15803d' }}>
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
          color="#4338ca"
          title="Prompt Version Evals"
          hint="Each Day-30 learning cycle is graded before regenerating prompts: did campaigns under the new prompt version beat the previous one (spend-weighted ROAS)?"
        />
        {evals.length === 0 ? (
          <EmptyState message="No evals yet — the first comparison runs at the next Day-30 deep learning cycle, once two prompt versions have campaign data." />
        ) : (
          <div className="flex flex-col gap-3">
            {evals.map((e, i) => {
              const verdictStyle: Record<string, React.CSSProperties> = {
                improved:     { background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' },
                regressed:    { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' },
                neutral:      { background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb' },
                inconclusive: { background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' },
              }
              return (
                <div key={i} className="rounded-xl p-4" style={cardStyle}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold tabular-nums" style={{ color: '#18181b' }}>
                        v{e.newerVersion} <span style={{ color: '#9ca3af' }}>vs</span> v{e.olderVersion}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase" style={verdictStyle[e.verdict]}>
                        {e.verdict}
                      </span>
                    </div>
                    <span className="text-xs tabular-nums" style={{ color: '#6b7280' }}>
                      {e.newer.weightedROAS.toFixed(2)}x <span style={{ color: '#c4c4cc' }}>vs</span> {e.older.weightedROAS.toFixed(2)}x
                      <span className="ml-2" style={{ color: '#9ca3af' }}>
                        ({e.newer.campaigns}/{e.older.campaigns} campaigns)
                      </span>
                    </span>
                  </div>
                  <p className="text-xs mt-2 leading-relaxed" style={{ color: '#71717a' }}>{e.detail}</p>
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
          color="#0e7490"
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
              <div key={title} className="rounded-xl overflow-x-auto" style={cardStyle}>
                <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={thStyle}>{title}</p>
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <th className={`${thCls} text-left`} style={thStyle}>Source</th>
                      <th className={`${thCls} text-right`} style={thStyle}>Launched</th>
                      <th className={`${thCls} text-right`} style={thStyle}>Converted</th>
                      <th className={`${thCls} text-right`} style={thStyle}>Avg ROAS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.label} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                        <td className="px-3 py-2.5 text-xs font-medium capitalize" style={{ color: '#374151' }}>{r.label.replace(/_/g, ' ')}</td>
                        <td className="px-3 py-2.5 text-right text-xs tabular-nums" style={{ color: '#6b7280' }}>{r.launched}</td>
                        <td className="px-3 py-2.5 text-right text-xs tabular-nums" style={{ color: '#6b7280' }}>{r.converted}</td>
                        <td className="px-3 py-2.5 text-right text-xs tabular-nums font-bold" style={{ color: r.avgROAS >= 1.5 ? '#15803d' : r.avgROAS >= 1 ? '#b45309' : '#b91c1c' }}>
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
