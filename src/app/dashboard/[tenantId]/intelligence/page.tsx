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
import { Term, GLOSSARY, PlainTerm } from '@/components/plain/Term'
import { Details } from '@/components/plain/Details'
import {
  PLAIN_ERROR,
  errorDetail,
  formatRelative,
  humanise,
  plainStatus,
  toneChip,
} from '@/lib/plain-language'
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


interface PageProps {
  params: Promise<{ tenantId: string }>
}

function OutcomeChip({ label }: { label: string | null }) {
  if (!label) {
    return (
      <span className="chip chip-accent" title="Results are checked 3 days after the change.">
        Checking in 3 days
      </span>
    )
  }
  const plain = plainStatus('reviewVerdict', label)
  return (
    <span className={`chip ${toneChip(plain.tone)}`} title={plain.meaning || undefined}>
      {plain.label}
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
  // The raw failure messages, kept for the collapsed Details block only.
  const [errorDetails, setErrorDetails] = useState<{ label: string; value: string }[]>([])
  const [unavailableSections, setUnavailableSections] = useState<string[]>([])
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      setUnavailableSections([])
      setErrorDetails([])
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
      const details: { label: string; value: string }[] = []
      const sections = [
        [o, 'Results of past changes'],
        [r, 'Changes the safety checks stopped'],
        [e, 'Instruction versions compared'],
        [s, 'Where good ideas came from'],
      ] as const
      for (const [result, name] of sections) {
        if (result.status === 'rejected') {
          unavailable.push(name)
          details.push({ label: name, value: errorDetail(result.reason) || 'No message' })
        }
      }
      setUnavailableSections(unavailable)
      setErrorDetails(details)
      if ([o, r, e, s].every((x) => x.status === 'rejected')) {
        setError(PLAIN_ERROR)
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
        <div role="status" aria-label="Loading results of past changes">
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
          <span className="sr-only">Loading results of past changes…</span>
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
        <div className="min-w-0">
          <p className="micro-label mb-2">Insights · Did it help?</p>
          <h1 className="page-title">Did the changes we made help?</h1>
          <p className="page-subtitle max-w-3xl">
            Every change made to your ads is checked 3 days later to see whether results got better or worse. This page also shows
            how often the safety checks were right to stop a change.
          </p>
          <p className="mt-2 text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
            These compare results before and after a change — other things may also have moved the numbers.
          </p>
        </div>
        <button onClick={() => setReloadKey((key) => key + 1)} className="btn btn-ghost self-start lg:self-auto">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 flex flex-col gap-3 rounded-xl p-4 text-sm sm:flex-row sm:items-center" style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad-border)', color: 'var(--bad)' }}>
          <AlertCircle size={16} className="shrink-0" />
          <span className="min-w-0 flex-1 break-words">{error}</span>
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
          <div className="min-w-0">
            <p className="font-semibold" style={{ color: 'var(--ink)' }}>Some sections could not load</p>
            <p className="mt-0.5 break-words text-[12px]" style={{ color: 'var(--ink-2)' }}>
              Missing: {unavailableSections.join(', ')}. Everything else below is up to date. Try refreshing in a minute.
            </p>
          </div>
        </div>
      )}

      {errorDetails.length > 0 && (
        <Details className="mb-6" title="Technical details" items={errorDetails} />
      )}

      <section aria-label="Summary" className="mb-9 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: 'Changes made',
            value: outcomes?.trackRecord.total ?? 0,
            hint: 'Changes applied to your ads',
            tone: 'var(--ink)',
          },
          {
            label: 'Checked after 3 days',
            value: measuredCount,
            hint: `${inconclusiveCount} with no clear answer`,
            tone: 'var(--ink)',
          },
          {
            label: 'Made things better',
            value: observedImprovementRate === null ? '—' : `${observedImprovementRate}%`,
            hint: 'Of the changes that clearly helped or hurt',
            tone: observedImprovementRate === null
              ? 'var(--ink-3)'
              : observedImprovementRate >= 50
                ? 'var(--good)'
                : observedImprovementRate >= 1
                  ? 'var(--warn)'
                  : 'var(--bad)',
          },
          {
            label: 'Safety checks right',
            value: guardrailSupportRate === null ? '—' : `${guardrailSupportRate}%`,
            hint: 'How often stopping a change was the right call',
            tone: guardrailSupportRate === null ? 'var(--ink-3)' : 'var(--accent-strong)',
          },
        ].map((metric) => (
          <div key={metric.label} className="card min-w-0 p-4 sm:p-5">
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
          title="Changes made, and what happened 3 days later"
          hint="After each change we look at cost per sale or click rate 3 days on. It shows what happened afterwards, not proof the change alone caused it."
        />
        {!outcomes || (outcomes.trackRecord.total === 0 && outcomes.recent.length === 0) ? (
          <EmptyState message="No change has been checked yet. Results appear here 3 days after a change is made." />
        ) : (
          <div className="flex flex-col gap-4">
            {outcomes.trackRecord.byActionType.length > 0 && (
              <div className="card overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Kind of change</th>
                      <th className="num">Checked</th>
                      <th className="num">Got better</th>
                      <th className="num">Got worse</th>
                      <th className="num">No change</th>
                      <th className="num">No clear answer</th>
                      <th className="num">Share that got worse</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outcomes.trackRecord.byActionType.map((b) => (
                      <tr key={b.actionType}>
                        <td className="font-medium" style={{ color: 'var(--ink)' }}><PlainTerm domain="actionType" code={b.actionType} /></td>
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
                  <p className="micro-label">Latest changes</p>
                  <span className="chip chip-info">Each checked on its own</span>
                </div>
                <table className="data-table">
                  <tbody>
                    {outcomes.recent.slice(0, 12).map((a, i) => (
                      <tr key={a._id ?? i}>
                        <td className="font-medium whitespace-nowrap" style={{ color: 'var(--ink)' }}><PlainTerm domain="actionType" code={a.action.type} /></td>
                        <td className="max-w-[220px] truncate" title={a.action.targetName ?? undefined}>{a.action.targetName ?? 'Unnamed ad'}</td>
                        <td className="whitespace-nowrap text-[10px]" style={{ color: 'var(--ink-3)' }}>{humanise(a.trigger)}</td>
                        <td className="whitespace-nowrap text-[11px]" style={{ color: 'var(--ink-3)' }}>{formatRelative(a.executedAt)}</td>
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
          title="Changes the safety checks stopped — were they right?"
          hint="When a safety check stops a change, we look again 3 days later. If stopping it often turns out to be a missed chance, that check may be too cautious. These are estimates."
        />
        {!regret || regret.total === 0 ? (
          <EmptyState message="Nothing stopped by a safety check has been looked at again yet." />
        ) : (
          <div className="card overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Suggested change</th>
                  <th>Why it was stopped</th>
                  <th className="num">Looked at again</th>
                  <th className="num">Right to stop</th>
                  <th className="num">Missed chance</th>
                  <th className="num">No clear answer</th>
                  <th className="num">Missed-chance rate (estimate)</th>
                </tr>
              </thead>
              <tbody>
                {regret.byActionAndReason.map((r) => (
                  <tr key={`${r.actionType}-${r.blockedReason}`}>
                    <td className="font-medium" style={{ color: 'var(--ink)' }}><PlainTerm domain="actionType" code={r.actionType} /></td>
                    <td className="min-w-[200px] break-words text-[11px]"><PlainTerm domain="blockedReason" code={r.blockedReason} /></td>
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
          title="Older check: did newer instructions do better?"
          hint="Compares campaigns made with one version of the system's instructions against the version before. It mixes different campaign goals, so treat it as a rough hint, not proof of sales."
        />
        {evals.length === 0 ? (
          <EmptyState message="There are not enough campaigns yet to compare one version with the last." />
        ) : (
          <div className="flex flex-col gap-3">
            {evals.map((e, i) => {
              const verdict = plainStatus('reviewVerdict', e.verdict)
              return (
                <div key={i} className="card min-w-0 p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex min-w-0 flex-wrap items-center gap-3">
                      <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
                        Version {e.newerVersion} <span style={{ color: 'var(--ink-3)' }}>vs</span> version {e.olderVersion}
                      </span>
                      <span className={`chip ${toneChip(verdict.tone)}`} title={verdict.meaning || undefined}>
                        {verdict.label}
                      </span>
                    </div>
                    <span className="text-xs tabular-nums" style={{ color: 'var(--ink-2)' }}>
                      <Term help={GLOSSARY.roas}>{`${e.newer.weightedROAS.toFixed(2)}x return on ad spend`}</Term> <span style={{ color: 'var(--ink-4)' }}>vs</span> {e.older.weightedROAS.toFixed(2)}x
                      <span className="ml-2" style={{ color: 'var(--ink-3)' }}>
                        ({e.newer.campaigns}/{e.older.campaigns} campaigns)
                      </span>
                    </span>
                  </div>
                  <p className="text-xs mt-2 break-words leading-relaxed" style={{ color: 'var(--ink-2)' }}>{e.detail}</p>
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
          title="Older check: where the good ideas came from"
          hint="For ideas that went live, how many brought any result, grouped by where the idea came from. It counts every kind of result, so it is a rough hint, not proof of sales."
        />
        {!signals || signals.briefsWithOutcomes === 0 ? (
          <EmptyState message="Not enough ideas have gone live yet to show where the good ones came from." />
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
                      <th>Where it came from</th>
                      <th className="num">Launched</th>
                      <th className="num">Brought a result</th>
                      <th className="num"><Term help={GLOSSARY.roas}>Average return on ad spend</Term></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.label}>
                        <td className="max-w-[240px] truncate font-medium" style={{ color: 'var(--ink)' }} title={humanise(r.label)}>{humanise(r.label)}</td>
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
