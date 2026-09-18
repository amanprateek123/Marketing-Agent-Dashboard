'use client'

import { useState, useEffect, use } from 'react'
import {
  AlertCircle,
  Activity,
  GitCompareArrows,
  Radar,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'
import { Term, GLOSSARY } from '@/components/plain/Term'
import { IntelligenceCenterNav } from '@/components/intelligence/IntelligenceCenterNav'
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

// Plain-English labels for the internal reason codes the safety system logs
// when it blocks an action — these are code slugs, not written for display.
const BLOCKED_REASON_LABEL: Record<string, string> = {
  bandit_disagreement: 'Two internal checks disagreed on whether this would help',
  oscillation_cooldown: 'This was changed too recently — waiting to avoid flip-flopping',
  recipient_thin_evidence: 'Not enough data yet on this audience to be sure',
  recipient_learned_poor_audience: 'Past results say this audience underperforms',
}
function humanizeBlockedReason(reason: string): string {
  return BLOCKED_REASON_LABEL[reason] ?? reason.replace(/_/g, ' ')
}

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
      {key === 'pending' ? 'Awaiting 72h check' : key === 'improved' ? 'Observed improvement' : key === 'worsened' ? 'Observed decline' : key}
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
  const [unavailableSections, setUnavailableSections] = useState<string[]>([])
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      setUnavailableSections([])
      setOutcomes(null)
      setRegret(null)
      setEvals([])
      setSignals(null)
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
      const unavailable: string[] = []
      if (o.status === 'rejected') unavailable.push('Action outcomes')
      if (r.status === 'rejected') unavailable.push('Safety calibration')
      if (e.status === 'rejected') unavailable.push('Copy comparisons')
      if (s.status === 'rejected') unavailable.push('Signal performance')
      setUnavailableSections(unavailable)
      if ([o, r, e, s].every((x) => x.status === 'rejected')) {
        setError('Could not reach the intelligence endpoints — is the agent API running?')
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [tenantId, reloadKey])

  if (loading) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <IntelligenceCenterNav tenantId={tenantId} active="quality" />
        <div role="status" aria-label="Loading decision quality">
          <div className="skeleton h-4 w-36 rounded" />
          <div className="skeleton mt-3 h-9 w-full max-w-xl rounded-lg" />
          <div className="skeleton mt-3 h-4 w-full max-w-3xl rounded" />
          <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="card p-4">
                <div className="skeleton h-3 w-2/3 rounded" />
                <div className="skeleton mt-3 h-7 w-1/3 rounded" />
              </div>
            ))}
          </div>
          <div className="skeleton mt-6 h-64 rounded-2xl" />
          <span className="sr-only">Loading decision quality…</span>
        </div>
      </div>
    )
  }

  const actionRows = outcomes?.trackRecord.byActionType ?? []
  const improvedCount = actionRows.reduce((sum, row) => sum + row.improved, 0)
  const worsenedCount = actionRows.reduce((sum, row) => sum + row.worsened, 0)
  const neutralCount = actionRows.reduce((sum, row) => sum + row.neutral, 0)
  const inconclusiveCount = actionRows.reduce((sum, row) => sum + row.inconclusive, 0)
  const measuredCount = improvedCount + worsenedCount + neutralCount + inconclusiveCount
  const directionalCount = improvedCount + worsenedCount
  const observedImprovementRate = directionalCount > 0
    ? Math.round((improvedCount / directionalCount) * 100)
    : null
  const guardrailCorrect = (regret?.byActionAndReason ?? []).reduce((sum, row) => sum + row.correct, 0)
  const guardrailMissed = (regret?.byActionAndReason ?? []).reduce((sum, row) => sum + row.missed, 0)
  const calibratedGuardrails = guardrailCorrect + guardrailMissed
  const guardrailSupportRate = calibratedGuardrails > 0
    ? Math.round((guardrailCorrect / calibratedGuardrails) * 100)
    : null

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8 stagger">
      <IntelligenceCenterNav tenantId={tenantId} active="quality" />
      {/* Header */}
      <div className="mb-7 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <p className="micro-label mb-2">Intelligence center · Decision quality</p>
          <h1 className="page-title">Know whether the intelligence is earning trust</h1>
          <p className="page-subtitle max-w-3xl">
            Follow executed actions into 72-hour outcome checks, calibrate safety blocks and compare learning versions.
          </p>
          <p className="mt-2 text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
            These are observed before-and-after checks—not proof that Meridian alone caused the change.
          </p>
        </div>
        <button onClick={() => setReloadKey((key) => key + 1)} className="btn btn-ghost self-start lg:self-auto">
          <RefreshCw size={14} /> Refresh scorecard
        </button>
      </div>

      {error && (
        <div className="mb-6 flex flex-col gap-3 rounded-xl p-4 text-sm sm:flex-row sm:items-center" style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad-border)', color: 'var(--bad)' }}>
          <AlertCircle size={16} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setReloadKey((key) => key + 1)} className="btn btn-ghost shrink-0">
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {!error && unavailableSections.length > 0 && (
        <div
          className="mb-6 flex items-start gap-3 rounded-xl p-4 text-sm"
          role="status"
          style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-border)' }}
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--warn)' }} />
          <div>
            <p className="font-semibold" style={{ color: 'var(--ink)' }}>Some evidence is temporarily unavailable</p>
            <p className="mt-0.5 text-[12px]" style={{ color: 'var(--ink-2)' }}>
              Missing: {unavailableSections.join(', ')}. Other loaded sections remain available.
            </p>
          </div>
        </div>
      )}

      <section aria-label="Decision quality summary" className="mb-9 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: 'Executed actions',
            value: outcomes?.trackRecord.total ?? 0,
            hint: 'Recorded as sent or applied',
            tone: 'var(--ink)',
          },
          {
            label: 'Outcome checks',
            value: measuredCount,
            hint: `${inconclusiveCount} inconclusive`,
            tone: 'var(--ink)',
          },
          {
            label: 'Observed improvement',
            value: observedImprovementRate === null ? '—' : `${observedImprovementRate}%`,
            hint: 'Improved ÷ improved + worsened',
            tone: observedImprovementRate === null
              ? 'var(--ink-3)'
              : observedImprovementRate >= 50
                ? 'var(--good)'
                : observedImprovementRate >= 1
                  ? 'var(--warn)'
                  : 'var(--bad)',
          },
          {
            label: 'Safety calls supported',
            value: guardrailSupportRate === null ? '—' : `${guardrailSupportRate}%`,
            hint: 'Excludes inconclusive checks',
            tone: guardrailSupportRate === null ? 'var(--ink-3)' : 'var(--accent-strong)',
          },
        ].map((metric) => (
          <div key={metric.label} className="card p-4 sm:p-5">
            <p className="text-[11px] font-semibold" style={{ color: 'var(--ink-3)' }}>{metric.label}</p>
            <p className="mt-1.5 text-[28px] font-bold leading-none tabular-nums" style={{ color: metric.tone }}>
              {metric.value}
            </p>
            <p className="mt-2 text-[10.5px] leading-snug" style={{ color: 'var(--ink-3)' }}>{metric.hint}</p>
          </div>
        ))}
      </section>

      {/* ===== 1. ACTION TRACK RECORD ===== */}
      <div className="mb-10">
        <SectionHeader
          icon={Activity}
          color="var(--good)"
          title="Executed actions and 72-hour proxy checks"
          hint="CPA or CTR is checked after execution because objective-specific KPI context is not yet stored on these records. The comparison is observational and does not establish incrementality."
        />
        {!outcomes || (outcomes.trackRecord.total === 0 && outcomes.recent.length === 0) ? (
          <EmptyState message="No executed actions have completed a 72-hour outcome check yet." />
        ) : (
          <div className="flex flex-col gap-4">
            {outcomes.trackRecord.byActionType.length > 0 && (
              <div className="card overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Action type</th>
                      <th className="num">Checked</th>
                      <th className="num">Proxy improved</th>
                      <th className="num">Proxy declined</th>
                      <th className="num">Neutral</th>
                      <th className="num">Inconclusive</th>
                      <th className="num">Proxy decline rate</th>
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
                <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-1">
                  <p className="micro-label">Recent execution log</p>
                  <span className="chip chip-info">Measured separately</span>
                </div>
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
          title="Safety calibration"
          hint="Meridian revisits blocked actions after 72 hours. A high miss rate suggests a guardrail may be too conservative; counterfactual labels remain model-based."
        />
        {!regret || regret.total === 0 ? (
          <EmptyState message="No blocked action has enough follow-up evidence for safety calibration yet." />
        ) : (
          <div className="card overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Proposed action</th>
                  <th>Guardrail reason</th>
                  <th className="num">Evaluated blocks</th>
                  <th className="num">Block supported</th>
                  <th className="num">Possible miss</th>
                  <th className="num">Inconclusive</th>
                  <th className="num">Modeled miss rate · all evaluated</th>
                </tr>
              </thead>
              <tbody>
                {regret.byActionAndReason.map((r) => (
                  <tr key={`${r.actionType}-${r.blockedReason}`}>
                    <td className="font-medium" style={{ color: 'var(--ink)' }}>{r.actionType.replace(/_/g, ' ')}</td>
                    <td className="text-[11px]">{humanizeBlockedReason(r.blockedReason)}</td>
                    <td className="num mono">{r.total}</td>
                    <td className="num mono" style={{ color: 'var(--good)' }}>{r.correct}</td>
                    <td className="num mono" style={{ color: r.missed > 0 ? 'var(--bad)' : 'var(--ink-4)' }}>{r.missed}</td>
                    <td className="num mono" style={{ color: 'var(--ink-3)' }}>{r.inconclusive}</td>
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
          title="Legacy campaign version comparisons"
          hint="This legacy diagnostic mixes campaign objectives and stored return bases. Treat its return-ratio comparison as directional only, not sales-performance proof."
        />
        {evals.length === 0 ? (
          <EmptyState message="No instruction versions have enough legacy campaign records to compare yet." />
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
                        Version {e.newerVersion} <span style={{ color: 'var(--ink-3)' }}>vs</span> version {e.olderVersion}
                      </span>
                      <span className={`chip uppercase ${verdictClass[e.verdict]}`}>
                        {e.verdict}
                      </span>
                    </div>
                    <span className="text-xs mono tabular-nums" style={{ color: 'var(--ink-2)' }}>
                      <Term help={GLOSSARY.roas}>{`${e.newer.weightedROAS.toFixed(2)}x stored return-ratio proxy`}</Term> <span style={{ color: 'var(--ink-4)' }}>vs</span> {e.older.weightedROAS.toFixed(2)}x
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
          title="Legacy signal follow-up"
          hint="This legacy view includes all brief objectives, counts any recorded conversion as a result, and uses an arithmetic mean of stored ROAS. It is not purchase or revenue proof."
        />
        {!signals || signals.briefsWithOutcomes === 0 ? (
          <EmptyState message="No launched briefs have enough legacy follow-up data yet." />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {([
              { title: 'By where the idea came from', rows: signals.bySource.map((s) => ({ label: s.source, ...s })) },
              { title: 'By ad platform', rows: signals.byPlatform.map((p) => ({ label: p.platform, ...p })) },
            ] as const).map(({ title, rows }) => (
              <div key={title} className="card overflow-x-auto">
                <p className="micro-label px-4 pt-3 pb-1">{title}</p>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Source</th>
                      <th className="num">Launched</th>
                      <th className="num">Recorded result &gt; 0</th>
                      <th className="num"><Term help={GLOSSARY.roas}>Mean stored ROAS proxy</Term></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.label}>
                        <td className="font-medium capitalize" style={{ color: 'var(--ink)' }}>{r.label.replace(/_/g, ' ')}</td>
                        <td className="num mono">{r.launched}</td>
                        <td className="num mono">{r.converted}</td>
                        <td className="num mono font-bold" style={{ color: 'var(--ink-2)' }}>
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
