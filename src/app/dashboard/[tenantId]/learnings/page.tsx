'use client'

import { useState, useEffect, use, useRef } from 'react'
import {
  BookOpen,
  Loader2,
  Download,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  Search,
  Trophy,
  LayoutGrid,
  GitBranch,
  BrainCircuit,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { HookStyleChip } from '@/components/badges'
import { IntelligenceCenterNav } from '@/components/intelligence/IntelligenceCenterNav'
import { cn } from '@/lib/utils'
import { Details } from '@/components/plain/Details'
import { PLAIN_ERROR, errorDetail, formatInr, formatRelative, humanise } from '@/lib/plain-language'
import type { Company, CaseStudy, WinningExemplar, CausalInsight, AudienceScoreEntry } from '@/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8082/api/v1'

interface PageProps {
  params: Promise<{ tenantId: string }>
}

function TagList({
  items,
  color,
}: {
  items: string[] | string
  color: 'green' | 'red' | 'amber' | 'blue' | 'zinc'
}) {
  const list = Array.isArray(items) ? items : [items]
  const chipClass: Record<string, string> = {
    green: 'chip chip-good',
    red:   'chip chip-bad',
    amber: 'chip chip-warn',
    blue:  'chip chip-accent',
    zinc:  'chip chip-neutral',
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((item, i) => (
        <span key={i} className={cn(chipClass[color], 'max-w-full break-words whitespace-normal')}>
          {item}
        </span>
      ))}
    </div>
  )
}

// This legacy field is named `roas` in storage, but its producer asks the
// model for a normalized 0–1 audience score. Keep that distinction explicit:
// it is a hypothesis index, not observed return evidence.
function normalizeLegacyAudienceIndex(
  scores: Record<string, number | AudienceScoreEntry> | undefined,
): Array<{ audience: string; score: number; n: number | null }> {
  if (!scores) return []
  return Object.entries(scores)
    .map(([audience, v]) => {
      if (typeof v === 'number') return { audience, score: v, n: null }
      const score = Number((v as AudienceScoreEntry)?.roas)
      const n = Number((v as AudienceScoreEntry)?.n)
      return { audience, score: Number.isFinite(score) ? score : 0, n: Number.isFinite(n) ? n : null }
    })
    .sort((a, b) => b.score - a.score)
}

function AudienceIndexRows({ scores }: { scores: Array<{ audience: string; score: number; n: number | null }> }) {
  return (
    <div className="flex flex-col gap-3">
      {scores.map(({ audience, score, n }) => (
        <div key={audience} className="flex items-center justify-between gap-3">
          <span className="min-w-0 flex-1 truncate text-sm" style={{ color: 'var(--ink-2)' }} title={humanise(audience)}>
            {humanise(audience)}
          </span>
          <div className="flex w-[55%] max-w-[240px] items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--muted)' }}>
              <div
                className="h-full rounded-full animate-bar-grow"
                style={{
                  width: `${Math.max(0, Math.min(score, 1)) * 100}%`,
                  background: 'var(--accent)',
                }}
              />
            </div>
            <span className="mono text-xs font-semibold w-14 text-right tabular-nums" style={{ color: 'var(--ink)' }}>
              {Math.round(Math.max(0, Math.min(score, 1)) * 100)}/100
            </span>
            {n !== null && (
              <span
                className="mono text-[10px] px-1.5 py-0.5 rounded-full tabular-nums shrink-0"
                title={`Based on ${n} campaigns or ad groups`}
                style={
                  n >= 5
                    ? { background: 'var(--info-bg)', color: 'var(--info)', border: '1px solid var(--info-border)' }
                    : { background: 'var(--warn-bg)', color: 'var(--warn)', border: '1px solid var(--warn-border)' }
                }
              >
                {n} {n === 1 ? 'campaign' : 'campaigns'}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function InsightList({ items, bullet }: { items: string[] | string; bullet?: string }) {
  const list = Array.isArray(items) ? items : [items]
  return (
    <ul className="flex flex-col gap-1.5">
      {list.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--ink-2)' }}>
          <span className="mt-0.5 shrink-0" style={{ color: 'var(--accent)' }}>
            {bullet ?? '•'}
          </span>
          <span className="min-w-0 break-words">{item}</span>
        </li>
      ))}
    </ul>
  )
}

function CaseStudyCard({ study }: { study: CaseStudy }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="card overflow-hidden transition-all">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left transition-colors"
        style={{ background: expanded ? 'var(--surface-warm)' : 'var(--surface)' }}
      >
        <div className="flex items-center gap-4 flex-wrap min-w-0">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }} title={study.campaignName}>
              {study.campaignName}
            </p>
            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--ink-3)' }} title={study.product}>{study.product}</p>
          </div>
          {study.dateRange && (
            <span className="mono text-xs shrink-0" style={{ color: 'var(--ink-3)' }}>
              {study.dateRange}
            </span>
          )}
          {study.totalSpend !== undefined && (
            <span className="text-xs font-semibold shrink-0 tabular-nums" style={{ color: 'var(--ink-2)' }}>
              {formatInr(study.totalSpend)} spent
            </span>
          )}
          {study.totalConversions !== undefined && (
            <span className="text-xs shrink-0 tabular-nums" style={{ color: 'var(--ink-3)' }}>
              {study.totalConversions.toLocaleString('en-IN')} {study.totalConversions === 1 ? 'sale' : 'sales'}
            </span>
          )}
        </div>
        <ChevronDown
          size={15}
          className={cn('transition-transform shrink-0', expanded && 'rotate-180')}
          style={{ color: 'var(--ink-3)' }}
        />
      </button>

      {expanded && (
        <div className="px-5 pb-5 flex flex-col gap-4" style={{ borderTop: '1px solid var(--hairline-light)' }}>
          {study.context && (
            <div className="mt-4">
              <p className="micro-label mb-1">Background (AI summary)</p>
              <p className="text-sm break-words leading-relaxed" style={{ color: 'var(--ink-2)' }}>{study.context}</p>
            </div>
          )}

          <p className="text-[10.5px] leading-relaxed" style={{ color: 'var(--ink-3)' }}>
            The write-up is the AI&apos;s reading of the numbers. Spend, sales and cost per sale are measured; the explanation is a best guess, not proof.
          </p>

          {study.whatWorked && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <CheckCircle size={13} style={{ color: 'var(--good)' }} />
                <p className="micro-label" style={{ color: 'var(--good)' }}>What seemed to work</p>
              </div>
              {study.whatWorked.hooks && study.whatWorked.hooks.length > 0 && (
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--ink-3)' }}>Opening lines</p>
                  <TagList items={study.whatWorked.hooks} color="green" />
                </div>
              )}
              {study.whatWorked.audiences && study.whatWorked.audiences.length > 0 && (
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--ink-3)' }}>Audiences</p>
                  <TagList items={study.whatWorked.audiences} color="blue" />
                </div>
              )}
              {study.whatWorked.formats && study.whatWorked.formats.length > 0 && (
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--ink-3)' }}>Ad formats</p>
                  <TagList items={study.whatWorked.formats} color="amber" />
                </div>
              )}
              <div className="flex gap-3 flex-wrap mt-1">
                {study.whatWorked.bestCPA !== undefined && (
                  <div className="card-inset px-3 py-2">
                    <p className="micro-label">Lowest cost per sale</p>
                    <p className="text-xs font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>
                      {formatInr(study.whatWorked.bestCPA)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {study.whatFailed &&
            (study.whatFailed.hooks?.length ||
              study.whatFailed.audiences?.length ||
              study.whatFailed.reason) && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5">
                  <AlertCircle size={13} style={{ color: 'var(--bad)' }} />
                  <p className="micro-label" style={{ color: 'var(--bad)' }}>What seemed not to work</p>
                </div>
                {study.whatFailed.hooks && study.whatFailed.hooks.length > 0 && (
                  <div>
                    <p className="text-xs mb-1" style={{ color: 'var(--ink-3)' }}>Opening lines</p>
                    <TagList items={study.whatFailed.hooks} color="red" />
                  </div>
                )}
                {study.whatFailed.audiences && study.whatFailed.audiences.length > 0 && (
                  <div>
                    <p className="text-xs mb-1" style={{ color: 'var(--ink-3)' }}>Audiences</p>
                    <TagList items={study.whatFailed.audiences} color="red" />
                  </div>
                )}
                {study.whatFailed.reason && (
                  <p className="text-xs italic break-words" style={{ color: 'var(--ink-3)' }}>
                    {study.whatFailed.reason}
                  </p>
                )}
              </div>
            )}

          {study.lesson && (
            <div className="rounded-xl p-3" style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)' }}>
              <div className="mb-1 flex items-center gap-1.5">
                <Sparkles size={13} style={{ color: 'var(--accent-strong)' }} />
                <p className="text-xs font-semibold" style={{ color: 'var(--accent-strong)' }}>Lesson for next time (AI summary)</p>
              </div>
              <p className="text-sm break-words leading-relaxed" style={{ color: 'var(--ink-2)' }}>{study.lesson}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Winning Exemplars table ──────────────────────────────────────────────────
function WinningExemplarsTable({ exemplars }: { exemplars: WinningExemplar[] }) {
  const [segmentFilter, setSegmentFilter] = useState<string>('all')

  // audienceSegment is optional on backend entries. Bucket missing values under 'unknown'
  // (shown as "Unknown audience").
  const segmentOf = (e: WinningExemplar) => e.audienceSegment || 'unknown'
  const segments = Array.from(new Set(exemplars.map(segmentOf))).sort()
  const filtered = segmentFilter === 'all'
    ? exemplars
    : exemplars.filter((e) => segmentOf(e) === segmentFilter)
  const sorted = [...filtered].sort((a, b) => b.ctr - a.ctr)
  const hasProduct = exemplars.some((e) => e.product)

  return (
    <div>
      {segments.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap mb-3">
          <button
            onClick={() => setSegmentFilter('all')}
            className="text-[11px] px-2 py-1 rounded-full font-medium transition-colors"
            style={
              segmentFilter === 'all'
                ? { background: 'var(--accent)', color: '#fff' }
                : { background: 'var(--muted)', color: 'var(--ink-2)', border: '1px solid var(--hairline)' }
            }
          >
            All ({exemplars.length})
          </button>
          {segments.map((s) => {
            const count = exemplars.filter((e) => segmentOf(e) === s).length
            const active = segmentFilter === s
            return (
              <button
                key={s}
                onClick={() => setSegmentFilter(s)}
                className="text-[11px] px-2 py-1 rounded-full font-medium transition-colors"
                style={
                  active
                    ? { background: 'var(--accent)', color: '#fff' }
                    : { background: 'var(--muted)', color: 'var(--ink-2)', border: '1px solid var(--hairline)' }
                }
              >
                {s === 'unknown' ? 'Unknown audience' : humanise(s)} ({count})
              </button>
            )
          })}
        </div>
      )}

      <div className="card-inset overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Opening line</th>
              <th>Style</th>
              <th>Audience</th>
              {hasProduct && <th>Product</th>}
              <th className="num">Click rate</th>
              <th className="num">People reached</th>
              <th className="num">Saved</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((e, i) => (
              <tr key={`${e.hookLine}-${i}`}>
                <td className="max-w-md">
                  <p className="text-xs italic leading-snug truncate" style={{ color: 'var(--ink-2)' }} title={e.hookLine}>
                    &ldquo;{e.hookLine}&rdquo;
                  </p>
                </td>
                <td>
                  <HookStyleChip style={e.hookStyle} />
                </td>
                <td>
                  <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
                    {segmentOf(e) === 'unknown' ? 'Unknown audience' : humanise(segmentOf(e))}
                  </span>
                </td>
                {hasProduct && (
                  <td>
                    <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
                      {e.product ?? '—'}
                    </span>
                  </td>
                )}
                <td className="num mono text-xs font-bold" style={{ color: 'var(--good)' }}>
                  {e.ctr.toFixed(2)}%
                </td>
                <td className="num mono text-xs" style={{ color: 'var(--ink-3)' }}>
                  {e.sampleSize.toLocaleString('en-IN')}
                </td>
                <td className="num text-[11px] whitespace-nowrap" style={{ color: 'var(--ink-3)' }}>
                  {formatRelative(e.extractedAt)}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={hasProduct ? 7 : 6} className="px-3 py-8 text-center text-xs italic" style={{ color: 'var(--ink-3)' }}>
                  No examples for this audience.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Hook Saturation Heatmap ──────────────────────────────────────────────────
type HookSaturationMap = Record<string, Record<string, { pct: number; updatedAt: string }>>

function HookSaturationHeatmap({ data }: { data: HookSaturationMap }) {
  const audiences = Object.keys(data)
  const hookStylesSet = new Set<string>()
  for (const a of audiences) for (const k of Object.keys(data[a] ?? {})) hookStylesSet.add(k)
  const hookStyles = Array.from(hookStylesSet).sort()

  // Pinned to first render — recency comparison stays stable.
  const [now] = useState(() => Date.now())

  function cellColor(pct: number) {
    if (pct >= 80) return { bg: 'var(--bad-bg)', fg: 'var(--bad)', label: 'high' }
    if (pct >= 60) return { bg: 'var(--warn-bg)', fg: 'var(--warn)', label: 'medium' }
    return { bg: 'var(--good-bg)', fg: 'var(--good)', label: 'low' }
  }

  function recencyOpacity(updatedAt?: string) {
    if (!updatedAt) return 0.4
    const ageDays = (now - new Date(updatedAt).getTime()) / 86400000
    if (ageDays < 3) return 1
    if (ageDays < 7) return 0.85
    if (ageDays < 14) return 0.65
    if (ageDays < 30) return 0.45
    return 0.3
  }

  if (audiences.length === 0 || hookStyles.length === 0) {
    return (
      <p className="text-xs italic px-3 py-6 text-center" style={{ color: 'var(--ink-3)' }}>
        No data on worn-out opening lines yet.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 4 }}>
        <thead>
          <tr>
            <th className="px-2 py-1.5 text-left micro-label">
              Audience ↓ / Opening style →
            </th>
            {hookStyles.map((h) => (
              <th
                key={h}
                className="px-2 py-1.5 text-center text-[10px] font-medium"
                style={{ color: 'var(--ink-3)', minWidth: 80 }}
              >
                {humanise(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {audiences.map((a) => (
            <tr key={a}>
              <td
                className="px-2 py-1.5 text-xs font-semibold whitespace-nowrap"
                style={{ color: 'var(--ink-2)' }}
              >
                {humanise(a)}
              </td>
              {hookStyles.map((h) => {
                const cell = data[a]?.[h]
                if (!cell) {
                  return (
                    <td
                      key={h}
                      className="text-center text-[10px] tabular-nums"
                      style={{
                        background: 'var(--surface-warm)',
                        color: 'var(--ink-4)',
                        borderRadius: 4,
                        padding: 8,
                      }}
                    >
                      —
                    </td>
                  )
                }
                const c = cellColor(cell.pct)
                const op = recencyOpacity(cell.updatedAt)
                return (
                  <td
                    key={h}
                    className="mono text-center text-[11px] tabular-nums font-bold"
                    title={`${humanise(a)} · ${humanise(h)}: ${cell.pct.toFixed(0)}% worn out, updated ${formatRelative(cell.updatedAt)}`}
                    style={{
                      background: c.bg,
                      color: c.fg,
                      opacity: op,
                      borderRadius: 4,
                      padding: 8,
                    }}
                  >
                    {cell.pct.toFixed(0)}%
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px]" style={{ color: 'var(--ink-3)' }}>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded" style={{ background: 'var(--good-bg)', border: '1px solid var(--good-border)' }} />
          Under 60% — still fresh
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded" style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-border)' }} />
          60–80% — wearing out
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded" style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad-border)' }} />
          Over 80% — worn out
        </div>
        <span className="ml-auto" style={{ color: 'var(--ink-3)' }}>
          Faded = older data
        </span>
      </div>
    </div>
  )
}

// ── Causal Insights timeline ─────────────────────────────────────────────────
function CausalInsightsTimeline({ insights }: { insights: CausalInsight[] }) {
  return (
    <div className="space-y-3">
      {insights.map((insight, i) => {
        const conf = insight.confidence
        const confClass =
          conf >= 0.8 ? 'chip chip-good'
          : conf >= 0.6 ? 'chip chip-warn'
          : 'chip chip-neutral'
        return (
          <article key={i} className="card p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <span className="chip chip-accent mb-2">AI best guess</span>
                <p className="text-sm font-semibold break-words leading-snug" style={{ color: 'var(--ink)' }}>
                  {insight.finding}
                </p>
                {insight.productName && (
                  <span className="chip chip-accent mt-1.5">
                    {insight.productName}
                  </span>
                )}
              </div>
              <span
                className={cn(confClass, 'mono shrink-0')}
                title={`${(conf * 100).toFixed(0)}% sure, based on ${insight.dataPoints} results`}
              >
                {(conf * 100).toFixed(0)}% sure · {insight.dataPoints} results
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <p className="micro-label mb-1">
                  What was different
                </p>
                <p className="text-xs font-medium break-words" style={{ color: 'var(--accent)' }}>{humanise(insight.isolatedVariable)}</p>
              </div>
              <div>
                <p className="micro-label mb-1">
                  Kept the same
                </p>
                <div className="flex flex-wrap gap-1">
                  {(insight.controlledFor ?? []).length === 0 ? (
                    <span className="text-[11px] italic" style={{ color: 'var(--ink-3)' }}>Nothing</span>
                  ) : (
                    (insight.controlledFor ?? []).map((c) => (
                      <span
                        key={c}
                        className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--muted)', color: 'var(--ink-2)' }}
                      >
                        {humanise(c)}
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div>
                <p className="micro-label mb-1">
                  Likely reason
                </p>
                <p className="text-xs break-words" style={{ color: 'var(--ink-2)' }}>{insight.rootCause}</p>
              </div>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed" style={{ color: 'var(--ink-3)' }}>
              Worked out by comparing similar past ads — a strong hint, not proof.
            </p>
          </article>
        )
      })}
    </div>
  )
}

export default function LearningsPage({ params }: PageProps) {
  const resolvedParams = use(params)
  const { tenantId } = resolvedParams

  const [company, setCompany] = useState<Company | null>(null)
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Raw failure text, shown only inside the collapsed Details block.
  const [errorRaw, setErrorRaw] = useState<string>('')
  const [importPhase, setImportPhase] = useState<'idle' | 'importing' | 'completed' | 'failed'>('idle')
  const [importProgress, setImportProgress] = useState<{
    status: string
    progress: number
    completedBatches: number
    totalBatches: number
    totalCampaigns: number
    caseStudyCount: number
  } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importErrorRaw, setImportErrorRaw] = useState<string>('')
  const [search, setSearch] = useState('')
  const statusPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const studiesPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function fetchCompany() {
    const res = await fetch(`${API_BASE}/companies/${tenantId}`)
    if (!res.ok) throw new Error(`Could not load learnings (HTTP ${res.status}).`)
    setCompany(await res.json())
  }

  async function fetchCaseStudies() {
    const res = await fetch(`${API_BASE}/companies/${tenantId}/case-studies`)
    if (!res.ok) throw new Error(`Could not load past campaigns (HTTP ${res.status}).`)
    setCaseStudies(await res.json())
  }

  async function fetchData() {
    try {
      setLoading(true)
      setError(null)
      setErrorRaw('')
      await Promise.all([fetchCompany(), fetchCaseStudies()])
    } catch (err) {
      setError(PLAIN_ERROR)
      setErrorRaw(errorDetail(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  useEffect(() => {
    return () => {
      if (statusPollRef.current) clearInterval(statusPollRef.current)
      if (studiesPollRef.current) clearInterval(studiesPollRef.current)
    }
  }, [])

  async function handleImport() {
    if (statusPollRef.current) clearInterval(statusPollRef.current)
    if (studiesPollRef.current) clearInterval(studiesPollRef.current)
    setImportPhase('importing')
    setImportProgress(null)
    setImportError(null)
    setImportErrorRaw('')
    try {
      const res = await fetch(`${API_BASE}/companies/${tenantId}/import-learnings`, { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      // Poll status every 3s
      statusPollRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`${API_BASE}/companies/${tenantId}/import-status`)
          if (!statusRes.ok) return
          const data = await statusRes.json()
          setImportProgress({
            status: data.status,
            progress: data.progress ?? 0,
            completedBatches: data.completedBatches ?? 0,
            totalBatches: data.totalBatches ?? 0,
            totalCampaigns: data.totalCampaigns ?? 0,
            caseStudyCount: data.caseStudyCount ?? 0,
          })
          if (data.status === 'completed') {
            if (statusPollRef.current) clearInterval(statusPollRef.current)
            if (studiesPollRef.current) clearInterval(studiesPollRef.current)
            setImportPhase('completed')
            // Final fetch of company learnings + full case study list
            await Promise.all([fetchCompany(), fetchCaseStudies()])
          } else if (data.status === 'failed') {
            if (statusPollRef.current) clearInterval(statusPollRef.current)
            if (studiesPollRef.current) clearInterval(studiesPollRef.current)
            setImportPhase('failed')
            setImportError("We couldn't finish refreshing. Try again.")
            setImportErrorRaw('The import reported a failure on the server.')
          }
        } catch { /* keep polling */ }
      }, 3000)

      // Poll case studies every 5s to append in real time
      studiesPollRef.current = setInterval(async () => {
        try {
          const studiesRes = await fetch(`${API_BASE}/companies/${tenantId}/case-studies`)
          if (studiesRes.ok) setCaseStudies(await studiesRes.json())
        } catch { /* keep polling */ }
      }, 5000)
    } catch (err) {
      setImportPhase('failed')
      setImportError("We couldn't start refreshing. Try again.")
      setImportErrorRaw(errorDetail(err))
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <IntelligenceCenterNav tenantId={tenantId} active="patterns" />
        <div role="status" aria-label="Loading what works">
          <div className="skeleton h-4 w-32 rounded" />
          <div className="skeleton mt-3 h-9 w-full max-w-lg rounded-lg" />
          <div className="skeleton mt-3 h-4 w-full max-w-2xl rounded" />
          <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="card p-4">
                <div className="skeleton h-3 w-2/3 rounded" />
                <div className="skeleton mt-3 h-7 w-1/3 rounded" />
              </div>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="skeleton h-52 rounded-2xl" />
            <div className="skeleton h-52 rounded-2xl" />
          </div>
          <span className="sr-only">Loading what works…</span>
        </div>
      </div>
    )
  }

  const creative = company?.learnings?.creative
  const campaign = company?.learnings?.campaign
  const updatedAt = company?.learnings?.updatedAt

  const filteredStudies = caseStudies
    .filter((s) => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return s.campaignName.toLowerCase().includes(q) || s.product.toLowerCase().includes(q)
    })
    .sort((a, b) => {
      const conversionDelta = (b.totalConversions ?? 0) - (a.totalConversions ?? 0)
      if (conversionDelta !== 0) return conversionDelta
      const aCpa = a.whatWorked?.bestCPA ?? Number.POSITIVE_INFINITY
      const bCpa = b.whatWorked?.bestCPA ?? Number.POSITIVE_INFINITY
      return aCpa - bCpa
    })

  const hasPatternData =
    creative?.winningHooks?.length ||
    creative?.losingHooks?.length ||
    creative?.winningFormats?.length ||
    creative?.losingFormats?.length ||
    campaign?.audienceScores ||
    campaign?.budgetInsights?.length ||
    campaign?.timingInsights?.length

  const reusablePatternCount =
    (creative?.winningHooks?.length ?? 0) +
    (creative?.winningFormats?.length ?? 0) +
    (campaign?.budgetInsights?.length ?? 0) +
    (campaign?.timingInsights?.length ?? 0)
  const productCoverage = Object.keys(campaign?.audienceScoresByProduct ?? {}).length
  const exemplarCount = creative?.winningExemplars?.length ?? 0
  const hypothesisCount = company?.learnings?.causalInsights?.length ?? 0

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8 stagger">
      <IntelligenceCenterNav tenantId={tenantId} active="patterns" />
      {/* Header */}
      <div className="mb-7">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="min-w-0">
            <p className="micro-label mb-2">Insights · What works</p>
            <h1 className="page-title">What has worked in your past ads</h1>
            <p className="page-subtitle">
              Opening lines, formats and audiences that did well (or badly) before, so the next campaign can reuse the good ones.
              {updatedAt && (
                <span className="ml-1">· Updated {formatRelative(updatedAt)}</span>
              )}
            </p>
          </div>
          <button
            onClick={handleImport}
            disabled={importPhase === 'importing'}
            className={importPhase === 'failed' ? 'btn btn-danger' : 'btn btn-primary'}
          >
            {importPhase === 'importing' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : importPhase === 'completed' ? (
              <CheckCircle size={14} />
            ) : importPhase === 'failed' ? (
              <AlertCircle size={14} />
            ) : (
              <Download size={14} />
            )}
            {importPhase === 'importing'
              ? 'Refreshing…'
              : importPhase === 'completed'
              ? 'Up to date'
              : importPhase === 'failed'
              ? 'Try again'
              : 'Re-read past campaigns'}
          </button>
        </div>

        {/* Progress bar */}
        {(importPhase === 'importing' || importPhase === 'completed') && importProgress && (
          <div className="card mt-4 p-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span
                className="font-medium"
                style={{ color: importProgress.status === 'completed' ? 'var(--good)' : 'var(--accent)' }}
              >
                {importProgress.status === 'completed' ? 'Finished reading past campaigns' :
                 importProgress.status === 'failed' ? "Couldn't finish" :
                 `${humanise(importProgress.status)}…`}
              </span>
              <span className="tabular-nums" style={{ color: 'var(--ink-3)' }}>
                {importProgress.completedBatches} of {importProgress.totalBatches} steps
                {importProgress.totalCampaigns > 0 && ` · ${importProgress.totalCampaigns} campaigns`}
                {importProgress.caseStudyCount > 0 && ` · ${importProgress.caseStudyCount} write-ups`}
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--muted)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${importProgress.progress}%`,
                  background: importProgress.status === 'completed' ? 'var(--good)' : 'var(--accent)',
                }}
              />
            </div>
          </div>
        )}
        {importPhase === 'failed' && importError && (
          <>
            <p className="text-xs mt-2" style={{ color: 'var(--bad)' }}>{importError}</p>
            {importErrorRaw && (
              <Details className="mt-2" title="Technical details" items={[{ label: 'Error', value: importErrorRaw }]} />
            )}
          </>
        )}
      </div>

      <section aria-label="Summary" className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Ideas to reuse', value: reusablePatternCount, hint: 'Opening lines, formats, budget and timing tips' },
          { label: 'Products covered', value: productCoverage, hint: 'Products with audience notes (older data)' },
          { label: 'Top ads saved', value: exemplarCount, hint: 'Ads people clicked on the most' },
          { label: 'Best guesses', value: hypothesisCount, hint: 'AI explanations still waiting for more proof' },
        ].map((metric) => (
          <div key={metric.label} className="card min-w-0 p-4 sm:p-5">
            <p className="text-[11px] font-semibold" style={{ color: 'var(--ink-3)' }}>{metric.label}</p>
            <p className="mt-1.5 text-[28px] font-bold leading-none tabular-nums" style={{ color: 'var(--ink)' }}>
              {metric.value}
            </p>
            <p className="mt-2 text-[10.5px] leading-snug" style={{ color: 'var(--ink-3)' }}>{metric.hint}</p>
          </div>
        ))}
      </section>

      {error && (
        <div
          className="mb-6 flex flex-col gap-3 rounded-xl p-4 text-sm sm:flex-row sm:items-center"
          style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad-border)', color: 'var(--bad)' }}
        >
          <AlertCircle size={16} className="shrink-0" />
          <span className="min-w-0 flex-1 break-words">{error}</span>
          <button onClick={fetchData} className="btn btn-ghost shrink-0">
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}
      {error && errorRaw && (
        <Details className="mb-6" title="Technical details" items={[{ label: 'Error', value: errorRaw }]} />
      )}

      {/* ===== SECTION A: PATTERN MEMORY ===== */}
      <div className="mb-10">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: 'var(--accent-bg)', color: 'var(--accent-strong)' }}>
            <BrainCircuit size={17} />
          </span>
          <div>
            <h2 className="section-title">Patterns from past ads</h2>
            <p className="explain mt-0.5">What the system will lean on (or avoid) when it plans your next campaign.</p>
          </div>
        </div>

        {!hasPatternData ? (
          <div className="card py-10 text-center">
            <BrainCircuit size={26} className="mx-auto mb-3" style={{ color: 'var(--ink-4)' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>No patterns yet</p>
            <p className="text-xs mt-1" style={{ color: 'var(--ink-4)' }}>
              Press &ldquo;Re-read past campaigns&rdquo; to look through how your earlier ads did.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Model-extracted creative hypotheses. Per-ad exemplars below are
                the deterministic measured evidence. */}
            {creative?.winningHooks && creative.winningHooks.length > 0 && (
              <div className="card p-5">
                <h3 className="micro-label mb-3" style={{ color: 'var(--good)' }}>
                  Opening lines that worked
                </h3>
                <TagList items={creative.winningHooks} color="green" />
                <p className="mt-3 text-[10.5px] leading-relaxed" style={{ color: 'var(--ink-3)' }}>AI&apos;s reading — trust it more once the top ads below back it up.</p>
              </div>
            )}

            {/* Losing hooks */}
            {creative?.losingHooks && creative.losingHooks.length > 0 && (
              <div className="card p-5">
                <h3 className="micro-label mb-3" style={{ color: 'var(--bad)' }}>
                  Opening lines that did not work
                </h3>
                <TagList items={creative.losingHooks} color="red" />
              </div>
            )}

            {/* Winning formats */}
            {creative?.winningFormats && creative.winningFormats.length > 0 && (
              <div className="card p-5">
                <h3 className="micro-label mb-3" style={{ color: 'var(--warn)' }}>
                  Ad formats that worked
                </h3>
                <TagList items={creative.winningFormats} color="amber" />
              </div>
            )}

            {/* Losing formats */}
            {creative?.losingFormats && creative.losingFormats.length > 0 && (
              <div className="card p-5">
                <h3 className="micro-label mb-3" style={{ color: 'var(--ink-3)' }}>
                  Ad formats that did not work
                </h3>
                <TagList items={creative.losingFormats} color="zinc" />
              </div>
            )}

            {/* Legacy model-authored audience index — deliberately not used as ROAS. */}
            {campaign?.audienceScores && Object.keys(campaign.audienceScores).length > 0 && (
              <div className="card p-5">
                <h3 className="micro-label mb-3" style={{ color: 'var(--accent)' }}>
                  Audience scores (older, AI-estimated)
                </h3>
                <AudienceIndexRows scores={normalizeLegacyAudienceIndex(campaign.audienceScores)} />
                <p className="mt-3 text-[10.5px] leading-relaxed" style={{ color: 'var(--ink-3)' }}>
                  A 0–100 score the AI gave each audience. It is a guess, not measured results or return on ad spend.
                </p>
              </div>
            )}

            {/* Budget + timing insights */}
            {((campaign?.budgetInsights?.length ?? 0) > 0 ||
              (campaign?.timingInsights?.length ?? 0) > 0) && (
              <div className="card p-5">
                {campaign?.budgetInsights && campaign.budgetInsights.length > 0 && (
                  <div className="mb-3">
                    <h3 className="micro-label mb-2">
                      Budget tips (AI&apos;s reading)
                    </h3>
                    <InsightList items={campaign.budgetInsights} />
                  </div>
                )}
                {campaign?.timingInsights && campaign.timingInsights.length > 0 && (
                  <div>
                    <h3 className="micro-label mb-2">
                      Timing tips (AI&apos;s reading)
                    </h3>
                    <InsightList items={campaign.timingInsights} bullet="⏱" />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== SECTION A2: WINNING EXEMPLARS ===== */}
      {creative?.winningExemplars && creative.winningExemplars.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={15} style={{ color: 'var(--good)' }} />
            <h2 className="section-title">
              Ads people clicked most
            </h2>
            <span className="chip chip-neutral tabular-nums">
              {creative.winningExemplars.length}
            </span>
          </div>
          <div className="card p-5">
            <p className="mb-4 text-[11px] leading-relaxed" style={{ color: 'var(--ink-3)' }}>
              Sorted by click rate. Lots of clicks does not always mean lots of sales.
            </p>
            <WinningExemplarsTable exemplars={creative.winningExemplars} />
          </div>
        </div>
      )}

      {/* ===== SECTION A3: HOOK SATURATION HEATMAP ===== */}
      {creative?.audienceHookSaturation && Object.keys(creative.audienceHookSaturation).length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <LayoutGrid size={15} style={{ color: 'var(--warn)' }} />
            <h2 className="section-title">
              Which opening styles are wearing out
            </h2>
          </div>
          <div className="card p-5">
            <p className="mb-3 text-[11px] leading-relaxed" style={{ color: 'var(--ink-3)' }}>
              An estimate of how much each audience has already seen each opening style. High numbers mean it is time for fresh ads.
            </p>
            <HookSaturationHeatmap data={creative.audienceHookSaturation} />
          </div>
        </div>
      )}

      {/* ===== SECTION A4: CAUSAL INSIGHTS ===== */}
      {company?.learnings?.causalInsights && company.learnings.causalInsights.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <GitBranch size={15} style={{ color: 'var(--accent)' }} />
            <h2 className="section-title">
              Why some ads did better (AI best guesses)
            </h2>
            <span className="chip chip-neutral tabular-nums">
              {company.learnings.causalInsights.length}
            </span>
          </div>
          <CausalInsightsTimeline insights={company.learnings.causalInsights} />
        </div>
      )}

      {/* ===== SECTION B: CASE STUDIES ===== */}
      <div>
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <h2 className="section-title">
              Past campaign write-ups
            </h2>
            {caseStudies.length > 0 && (
              <span className="chip chip-neutral tabular-nums">
                {caseStudies.length}
              </span>
            )}
          </div>
          <div className="relative w-full sm:w-64">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 z-10" style={{ color: 'var(--ink-3)' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by campaign or product…"
              className="input text-xs"
              style={{ paddingLeft: 32, paddingTop: 6, paddingBottom: 6 }}
            />
          </div>
        </div>

        {filteredStudies.length === 0 ? (
          <div className="card py-12 text-center">
            <BookOpen size={28} className="mx-auto mb-3" style={{ color: 'var(--ink-4)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--ink-3)' }}>
              {search ? 'No campaign matches your search' : 'No write-ups yet'}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--ink-4)' }}>
              {search
                ? 'Try a different search term'
                : 'A write-up is added automatically when each campaign finishes'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredStudies.map((study, idx) => (
              <CaseStudyCard key={study._id || idx} study={study} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
