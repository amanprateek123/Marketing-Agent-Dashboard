'use client'

import { useState, useEffect, use } from 'react'
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
} from 'lucide-react'
import { HookStyleChip } from '@/components/badges'
import { cn, formatCurrency, formatRelativeTime } from '@/lib/utils'
import type { Company, CaseStudy, WinningExemplar, CausalInsight, AudienceScoreEntry } from '@/types'

const API_BASE = 'http://localhost:8082/api/v1'

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
        <span key={i} className={chipClass[color]}>
          {item}
        </span>
      ))}
    </div>
  )
}

// Backend audienceScores entries migrated from flat numbers to { roas, n,
// updatedAt }. Rendering `score.toFixed(1)` on the object shape crashed this
// page (the "Learning tab error"). Normalize both shapes to one row model.
function normalizeAudienceScores(
  scores: Record<string, number | AudienceScoreEntry> | undefined,
): Array<{ audience: string; roas: number; n: number | null }> {
  if (!scores) return []
  return Object.entries(scores)
    .map(([audience, v]) => {
      if (typeof v === 'number') return { audience, roas: v, n: null }
      const roas = Number((v as AudienceScoreEntry)?.roas)
      const n = Number((v as AudienceScoreEntry)?.n)
      return { audience, roas: Number.isFinite(roas) ? roas : 0, n: Number.isFinite(n) ? n : null }
    })
    .sort((a, b) => b.roas - a.roas)
}

function AudienceScoreRows({ scores }: { scores: Array<{ audience: string; roas: number; n: number | null }> }) {
  const maxRoas = Math.max(1.5, ...scores.map((s) => s.roas))
  return (
    <div className="flex flex-col gap-2">
      {scores.map(({ audience, roas, n }) => (
        <div key={audience} className="flex items-center justify-between gap-3">
          <span className="text-sm capitalize truncate" style={{ color: 'var(--ink-2)' }}>
            {audience.replace(/_/g, ' ')}
          </span>
          <div className="flex items-center gap-2 flex-1 max-w-[200px]">
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--muted)' }}>
              <div
                className="h-full rounded-full animate-bar-grow"
                style={{
                  width: `${Math.min((roas / maxRoas) * 100, 100)}%`,
                  background: roas >= 1.5 ? 'var(--good)' : roas >= 1 ? 'var(--warn)' : 'var(--bad)',
                }}
              />
            </div>
            <span className="mono text-xs font-semibold w-14 text-right tabular-nums" style={{ color: 'var(--ink)' }}>
              {roas.toFixed(2)}x
            </span>
            {n !== null && (
              <span
                className="mono text-[10px] px-1.5 py-0.5 rounded-full tabular-nums shrink-0"
                title={`${n} campaigns/ad sets behind this score`}
                style={
                  n >= 5
                    ? { background: 'var(--muted)', color: 'var(--ink-3)', border: '1px solid var(--hairline)' }
                    : { background: 'var(--warn-bg)', color: 'var(--warn)', border: '1px solid var(--warn-border)' }
                }
              >
                n={n}
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
          {item}
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
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>
              {study.campaignName}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--ink-3)' }}>{study.product}</p>
          </div>
          {study.dateRange && (
            <span className="mono text-xs shrink-0" style={{ color: 'var(--ink-3)' }}>
              {study.dateRange}
            </span>
          )}
          {study.totalSpend !== undefined && (
            <span className="mono text-xs font-semibold shrink-0" style={{ color: 'var(--good)' }}>
              {formatCurrency(study.totalSpend)}
            </span>
          )}
          {study.totalConversions !== undefined && (
            <span className="mono text-xs shrink-0" style={{ color: 'var(--ink-3)' }}>
              {study.totalConversions} conv.
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
            <p className="text-sm leading-relaxed mt-4" style={{ color: 'var(--ink-2)' }}>
              {study.context}
            </p>
          )}

          {study.whatWorked && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs">✅</span>
                <p className="micro-label" style={{ color: 'var(--good)' }}>What Worked</p>
              </div>
              {study.whatWorked.hooks && study.whatWorked.hooks.length > 0 && (
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--ink-3)' }}>Hooks</p>
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
                  <p className="text-xs mb-1" style={{ color: 'var(--ink-3)' }}>Formats</p>
                  <TagList items={study.whatWorked.formats} color="amber" />
                </div>
              )}
              <div className="flex gap-3 flex-wrap mt-1">
                {study.whatWorked.bestCPA !== undefined && (
                  <div className="card-inset px-3 py-2">
                    <p className="micro-label">Best CPA</p>
                    <p className="mono text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                      {formatCurrency(study.whatWorked.bestCPA)}
                    </p>
                  </div>
                )}
                {study.whatWorked.bestROAS !== undefined && (
                  <div className="card-inset px-3 py-2">
                    <p className="micro-label">Best ROAS</p>
                    <p className="mono text-xs font-semibold" style={{ color: 'var(--good)' }}>
                      {Number(study.whatWorked.bestROAS).toFixed(2)}x
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
                  <span className="text-xs">❌</span>
                  <p className="micro-label" style={{ color: 'var(--bad)' }}>What Failed</p>
                </div>
                {study.whatFailed.hooks && study.whatFailed.hooks.length > 0 && (
                  <div>
                    <p className="text-xs mb-1" style={{ color: 'var(--ink-3)' }}>Hooks</p>
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
                  <p className="text-xs italic" style={{ color: 'var(--ink-3)' }}>
                    {study.whatFailed.reason}
                  </p>
                )}
              </div>
            )}

          {study.lesson && (
            <div className="rounded-xl p-3" style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)' }}>
              <p className="text-xs font-semibold mb-1" style={{ color: 'var(--accent)' }}>💡 Lesson</p>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--accent)' }}>{study.lesson}</p>
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

  // audienceSegment is optional on backend entries — undefined crashed the
  // chip .replace() calls. Bucket missing values under 'unknown'.
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
                className="text-[11px] px-2 py-1 rounded-full font-medium capitalize transition-colors"
                style={
                  active
                    ? { background: 'var(--accent)', color: '#fff' }
                    : { background: 'var(--muted)', color: 'var(--ink-2)', border: '1px solid var(--hairline)' }
                }
              >
                {s.replace(/_/g, ' ')} ({count})
              </button>
            )
          })}
        </div>
      )}

      <div className="card-inset overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Hook</th>
              <th>Style</th>
              <th>Audience</th>
              {hasProduct && <th>Product</th>}
              <th className="num">CTR</th>
              <th className="num">n</th>
              <th className="num">Captured</th>
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
                  <span className="text-[11px] capitalize" style={{ color: 'var(--ink-3)' }}>
                    {segmentOf(e).replace(/_/g, ' ')}
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
                  {e.sampleSize.toLocaleString()}
                </td>
                <td className="num mono text-[11px]" style={{ color: 'var(--ink-3)' }}>
                  {formatRelativeTime(e.extractedAt)}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={hasProduct ? 7 : 6} className="px-3 py-8 text-center text-xs italic" style={{ color: 'var(--ink-3)' }}>
                  No exemplars match the current filter.
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
        No saturation data yet.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 4 }}>
        <thead>
          <tr>
            <th className="px-2 py-1.5 text-left micro-label">
              Audience ↓ / Hook →
            </th>
            {hookStyles.map((h) => (
              <th
                key={h}
                className="px-2 py-1.5 text-center text-[10px] font-medium capitalize"
                style={{ color: 'var(--ink-3)', minWidth: 80 }}
              >
                {h.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {audiences.map((a) => (
            <tr key={a}>
              <td
                className="px-2 py-1.5 text-xs font-semibold capitalize whitespace-nowrap"
                style={{ color: 'var(--ink-2)' }}
              >
                {a.replace(/_/g, ' ')}
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
                    title={`${a}/${h}: ${cell.pct.toFixed(0)}% saturation, updated ${formatRelativeTime(cell.updatedAt)}`}
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
      <div className="flex items-center gap-3 mt-3 text-[11px]" style={{ color: 'var(--ink-3)' }}>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded" style={{ background: 'var(--good-bg)', border: '1px solid var(--good-border)' }} />
          &lt;60% fresh
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded" style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-border)' }} />
          60–80% saturating
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded" style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad-border)' }} />
          &gt;80% burned out
        </div>
        <span className="ml-auto" style={{ color: 'var(--ink-3)' }}>
          Faded cells = stale data
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
          <div key={i} className="card p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--ink)' }}>
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
                title={`${(conf * 100).toFixed(0)}% confidence based on ${insight.dataPoints} data points`}
              >
                {(conf * 100).toFixed(0)}% conf · n={insight.dataPoints}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <p className="micro-label mb-1">
                  Isolated variable
                </p>
                <p className="text-xs font-medium" style={{ color: 'var(--accent)' }}>{insight.isolatedVariable}</p>
              </div>
              <div>
                <p className="micro-label mb-1">
                  Controlled for
                </p>
                <div className="flex flex-wrap gap-1">
                  {(insight.controlledFor ?? []).length === 0 ? (
                    <span className="text-[11px] italic" style={{ color: 'var(--ink-3)' }}>none</span>
                  ) : (
                    (insight.controlledFor ?? []).map((c) => (
                      <span
                        key={c}
                        className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--muted)', color: 'var(--ink-2)' }}
                      >
                        {c.replace(/_/g, ' ')}
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div>
                <p className="micro-label mb-1">
                  Root cause
                </p>
                <p className="text-xs" style={{ color: 'var(--ink-2)' }}>{insight.rootCause}</p>
              </div>
            </div>
          </div>
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
  const [search, setSearch] = useState('')

  async function fetchCompany() {
    const res = await fetch(`${API_BASE}/companies/${tenantId}`)
    if (res.ok) setCompany(await res.json())
  }

  async function fetchCaseStudies() {
    const res = await fetch(`${API_BASE}/companies/${tenantId}/case-studies`)
    if (res.ok) setCaseStudies(await res.json())
  }

  async function fetchData() {
    try {
      setLoading(true)
      await Promise.all([fetchCompany(), fetchCaseStudies()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load learnings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  async function handleImport() {
    setImportPhase('importing')
    setImportProgress(null)
    setImportError(null)
    try {
      const res = await fetch(`${API_BASE}/companies/${tenantId}/import-learnings`, { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      // Poll status every 3s
      const statusPoll = setInterval(async () => {
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
            clearInterval(statusPoll)
            clearInterval(studiesPoll)
            setImportPhase('completed')
            // Final fetch of company learnings + full case study list
            await Promise.all([fetchCompany(), fetchCaseStudies()])
          } else if (data.status === 'failed') {
            clearInterval(statusPoll)
            clearInterval(studiesPoll)
            setImportPhase('failed')
            setImportError('Import failed on the server.')
          }
        } catch { /* keep polling */ }
      }, 3000)

      // Poll case studies every 5s to append in real time
      const studiesPoll = setInterval(async () => {
        try {
          const studiesRes = await fetch(`${API_BASE}/companies/${tenantId}/case-studies`)
          if (studiesRes.ok) setCaseStudies(await studiesRes.json())
        } catch { /* keep polling */ }
      }, 5000)
    } catch (err) {
      setImportPhase('failed')
      setImportError(err instanceof Error ? err.message : 'Import failed')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent)' }} />
          <p className="text-sm" style={{ color: 'var(--ink-3)' }}>Loading learnings...</p>
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
    .sort((a, b) => (b.whatWorked?.bestROAS ?? 0) - (a.whatWorked?.bestROAS ?? 0))

  const hasPatternData =
    creative?.winningHooks?.length ||
    creative?.losingHooks?.length ||
    creative?.winningFormats?.length ||
    creative?.losingFormats?.length ||
    campaign?.audienceScores ||
    campaign?.budgetInsights?.length ||
    campaign?.timingInsights?.length

  return (
    <div className="px-8 py-8 max-w-5xl mx-auto stagger">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="micro-label mb-2">Learning memory</p>
            <h1 className="page-title">Learnings</h1>
            <p className="page-subtitle">
              AI-synthesized insights from past campaign performance
              {updatedAt && (
                <span className="ml-1 mono">· Updated {new Date(updatedAt).toLocaleDateString()}</span>
              )}
            </p>
          </div>
          <button
            onClick={handleImport}
            disabled={importPhase === 'importing'}
            className={
              importPhase === 'importing' ? 'btn btn-ghost'
              : importPhase === 'completed' ? 'btn chip-good border'
              : importPhase === 'failed' ? 'btn btn-danger'
              : 'btn btn-accent'
            }
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
              ? 'Importing...'
              : importPhase === 'completed'
              ? 'Done!'
              : importPhase === 'failed'
              ? 'Retry'
              : 'Import from Meta'}
          </button>
        </div>

        {/* Progress bar */}
        {(importPhase === 'importing' || importPhase === 'completed') && importProgress && (
          <div className="card mt-4 p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs">
              <span
                className="font-medium capitalize"
                style={{ color: importProgress.status === 'completed' ? 'var(--good)' : 'var(--accent)' }}
              >
                {importProgress.status === 'completed' ? '✓ Completed' :
                 importProgress.status === 'failed' ? '✗ Failed' :
                 `${importProgress.status}…`}
              </span>
              <span className="mono" style={{ color: 'var(--ink-3)' }}>
                {importProgress.completedBatches}/{importProgress.totalBatches} batches
                {importProgress.totalCampaigns > 0 && ` · ${importProgress.totalCampaigns} campaigns`}
                {importProgress.caseStudyCount > 0 && ` · ${importProgress.caseStudyCount} case studies`}
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
          <p className="text-xs mt-2" style={{ color: 'var(--bad)' }}>{importError}</p>
        )}
      </div>

      {error && (
        <div
          className="rounded-xl p-4 mb-6 text-sm"
          style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad-border)', color: 'var(--bad)' }}
        >
          {error}
        </div>
      )}

      {/* ===== SECTION A: PATTERN MEMORY ===== */}
      <div className="mb-10">
        <h2 className="section-title mb-4">
          Pattern Memory
        </h2>

        {!hasPatternData ? (
          <div className="card py-10 text-center">
            <p className="text-sm" style={{ color: 'var(--ink-3)' }}>No learnings data yet.</p>
            <p className="text-xs mt-1" style={{ color: 'var(--ink-4)' }}>
              Import from Meta to generate AI-synthesized insights.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Winning hooks */}
            {creative?.winningHooks && creative.winningHooks.length > 0 && (
              <div className="card p-5">
                <h3 className="micro-label mb-3" style={{ color: 'var(--good)' }}>
                  Winning Hooks
                </h3>
                <TagList items={creative.winningHooks} color="green" />
              </div>
            )}

            {/* Losing hooks */}
            {creative?.losingHooks && creative.losingHooks.length > 0 && (
              <div className="card p-5">
                <h3 className="micro-label mb-3" style={{ color: 'var(--bad)' }}>
                  Losing Hooks
                </h3>
                <TagList items={creative.losingHooks} color="red" />
              </div>
            )}

            {/* Winning formats */}
            {creative?.winningFormats && creative.winningFormats.length > 0 && (
              <div className="card p-5">
                <h3 className="micro-label mb-3" style={{ color: 'var(--warn)' }}>
                  Winning Formats
                </h3>
                <TagList items={creative.winningFormats} color="amber" />
              </div>
            )}

            {/* Losing formats */}
            {creative?.losingFormats && creative.losingFormats.length > 0 && (
              <div className="card p-5">
                <h3 className="micro-label mb-3" style={{ color: 'var(--ink-3)' }}>
                  Losing Formats
                </h3>
                <TagList items={creative.losingFormats} color="zinc" />
              </div>
            )}

            {/* Audience scores (tenant-aggregate ROAS) */}
            {campaign?.audienceScores && Object.keys(campaign.audienceScores).length > 0 && (
              <div className="card p-5">
                <h3 className="micro-label mb-3" style={{ color: 'var(--accent)' }}>
                  Audience ROAS · all products
                </h3>
                <AudienceScoreRows scores={normalizeAudienceScores(campaign.audienceScores)} />
              </div>
            )}

            {/* Budget + timing insights */}
            {((campaign?.budgetInsights?.length ?? 0) > 0 ||
              (campaign?.timingInsights?.length ?? 0) > 0) && (
              <div className="card p-5">
                {campaign?.budgetInsights && campaign.budgetInsights.length > 0 && (
                  <div className="mb-3">
                    <h3 className="micro-label mb-2">
                      Budget Insights
                    </h3>
                    <InsightList items={campaign.budgetInsights} />
                  </div>
                )}
                {campaign?.timingInsights && campaign.timingInsights.length > 0 && (
                  <div>
                    <h3 className="micro-label mb-2">
                      Timing Insights
                    </h3>
                    <InsightList items={campaign.timingInsights} bullet="⏱" />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== SECTION A1b: AUDIENCE PERFORMANCE BY PRODUCT ===== */}
      {campaign?.audienceScoresByProduct && Object.keys(campaign.audienceScoresByProduct).length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="section-title">
              Audience Performance by Product
            </h2>
          </div>
          <p className="text-xs mb-4" style={{ color: 'var(--ink-3)' }}>
            What the audit verdicts and targeting guards actually consume — per-product scores beat the
            all-products aggregate. Amber n = thin sample, treated as hypothesis-grade by the agents.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Object.entries(campaign.audienceScoresByProduct).map(([product, scores]) => {
              const rows = normalizeAudienceScores(scores)
              if (rows.length === 0) return null
              return (
                <div key={product} className="card p-5">
                  <h3 className="micro-label mb-3" style={{ color: 'var(--accent)' }}>
                    {product}
                  </h3>
                  <AudienceScoreRows scores={rows} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ===== SECTION A2: WINNING EXEMPLARS ===== */}
      {creative?.winningExemplars && creative.winningExemplars.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={15} style={{ color: 'var(--good)' }} />
            <h2 className="section-title">
              Winning Exemplars
            </h2>
            <span className="chip chip-neutral mono">
              {creative.winningExemplars.length}
            </span>
          </div>
          <div className="card p-5">
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
              Hook Saturation
            </h2>
          </div>
          <div className="card p-5">
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
              Causal Insights
            </h2>
            <span className="chip chip-neutral mono">
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
              Case Studies
            </h2>
            {caseStudies.length > 0 && (
              <span className="chip chip-neutral mono">
                {caseStudies.length}
              </span>
            )}
          </div>
          <div className="relative" style={{ width: 256 }}>
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
              {search ? 'No case studies match your search' : 'No case studies yet'}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--ink-4)' }}>
              {search
                ? 'Try a different search term'
                : 'Case studies are created automatically as campaigns complete'}
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
