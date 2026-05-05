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
import type { Company, CaseStudy, WinningExemplar, CausalInsight } from '@/types'

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
  const styles: Record<string, React.CSSProperties> = {
    green:  { background: '#dcfce7', border: '1px solid #bbf7d0', color: '#15803d' },
    red:    { background: '#fee2e2', border: '1px solid #fecaca', color: '#b91c1c' },
    amber:  { background: '#fef3c7', border: '1px solid #fde68a', color: '#b45309' },
    blue:   { background: '#e0e7ff', border: '1px solid #c7d2fe', color: '#1d4ed8' },
    zinc:   { background: '#f8f9fb', border: '1px solid #e5e7eb', color: '#52525b' },
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((item, i) => (
        <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={styles[color]}>
          {item}
        </span>
      ))}
    </div>
  )
}

function InsightList({ items, bullet }: { items: string[] | string; bullet?: string }) {
  const list = Array.isArray(items) ? items : [items]
  return (
    <ul className="flex flex-col gap-1.5">
      {list.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#52525b' }}>
          <span className="mt-0.5 shrink-0" style={{ color: '#4338ca' }}>
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
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 2px rgba(15,23,42,0.03)',
      }}
    >
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left transition-colors hover:bg-zinc-50/60"
        style={{ background: expanded ? '#fafafa' : '#ffffff' }}
      >
        <div className="flex items-center gap-4 flex-wrap min-w-0">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: '#18181b' }}>
              {study.campaignName}
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#71717a' }}>{study.product}</p>
          </div>
          {study.dateRange && (
            <span className="text-xs shrink-0" style={{ color: '#a1a1aa' }}>
              {study.dateRange}
            </span>
          )}
          {study.totalSpend !== undefined && (
            <span className="text-xs font-semibold shrink-0" style={{ color: '#15803d' }}>
              {formatCurrency(study.totalSpend)}
            </span>
          )}
          {study.totalConversions !== undefined && (
            <span className="text-xs shrink-0" style={{ color: '#71717a' }}>
              {study.totalConversions} conv.
            </span>
          )}
        </div>
        <ChevronDown
          size={15}
          className={cn('transition-transform shrink-0', expanded && 'rotate-180')}
          style={{ color: '#a1a1aa' }}
        />
      </button>

      {expanded && (
        <div className="px-5 pb-5 flex flex-col gap-4" style={{ borderTop: '1px solid #f3f4f6' }}>
          {study.context && (
            <p className="text-sm leading-relaxed mt-4" style={{ color: '#71717a' }}>
              {study.context}
            </p>
          )}

          {study.whatWorked && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs">✅</span>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#15803d' }}>What Worked</p>
              </div>
              {study.whatWorked.hooks && study.whatWorked.hooks.length > 0 && (
                <div>
                  <p className="text-xs mb-1" style={{ color: '#a1a1aa' }}>Hooks</p>
                  <TagList items={study.whatWorked.hooks} color="green" />
                </div>
              )}
              {study.whatWorked.audiences && study.whatWorked.audiences.length > 0 && (
                <div>
                  <p className="text-xs mb-1" style={{ color: '#a1a1aa' }}>Audiences</p>
                  <TagList items={study.whatWorked.audiences} color="blue" />
                </div>
              )}
              {study.whatWorked.formats && study.whatWorked.formats.length > 0 && (
                <div>
                  <p className="text-xs mb-1" style={{ color: '#a1a1aa' }}>Formats</p>
                  <TagList items={study.whatWorked.formats} color="amber" />
                </div>
              )}
              <div className="flex gap-3 flex-wrap mt-1">
                {study.whatWorked.bestCPA !== undefined && (
                  <div className="rounded-lg px-3 py-2" style={{ background: '#f6f6f7', border: '1px solid #e5e7eb' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#c4c4cc' }}>Best CPA</p>
                    <p className="text-xs font-semibold" style={{ color: '#18181b' }}>
                      {formatCurrency(study.whatWorked.bestCPA)}
                    </p>
                  </div>
                )}
                {study.whatWorked.bestROAS !== undefined && (
                  <div className="rounded-lg px-3 py-2" style={{ background: '#f6f6f7', border: '1px solid #e5e7eb' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#c4c4cc' }}>Best ROAS</p>
                    <p className="text-xs font-semibold" style={{ color: '#15803d' }}>
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
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#b91c1c' }}>What Failed</p>
                </div>
                {study.whatFailed.hooks && study.whatFailed.hooks.length > 0 && (
                  <div>
                    <p className="text-xs mb-1" style={{ color: '#a1a1aa' }}>Hooks</p>
                    <TagList items={study.whatFailed.hooks} color="red" />
                  </div>
                )}
                {study.whatFailed.audiences && study.whatFailed.audiences.length > 0 && (
                  <div>
                    <p className="text-xs mb-1" style={{ color: '#a1a1aa' }}>Audiences</p>
                    <TagList items={study.whatFailed.audiences} color="red" />
                  </div>
                )}
                {study.whatFailed.reason && (
                  <p className="text-xs italic" style={{ color: '#a1a1aa' }}>
                    {study.whatFailed.reason}
                  </p>
                )}
              </div>
            )}

          {study.lesson && (
            <div className="rounded-xl p-3" style={{ background: '#eef2ff', border: '1px solid #c7d2fe' }}>
              <p className="text-xs font-semibold mb-1" style={{ color: '#4338ca' }}>💡 Lesson</p>
              <p className="text-sm leading-relaxed" style={{ color: '#4338ca' }}>{study.lesson}</p>
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

  const segments = Array.from(new Set(exemplars.map((e) => e.audienceSegment))).sort()
  const filtered = segmentFilter === 'all'
    ? exemplars
    : exemplars.filter((e) => e.audienceSegment === segmentFilter)
  const sorted = [...filtered].sort((a, b) => b.ctr - a.ctr)

  return (
    <div>
      {segments.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap mb-3">
          <button
            onClick={() => setSegmentFilter('all')}
            className="text-[11px] px-2 py-1 rounded-full font-medium transition-colors"
            style={
              segmentFilter === 'all'
                ? { background: '#4338ca', color: '#fff' }
                : { background: '#f3f4f6', color: '#4b5563', border: '1px solid #e5e7eb' }
            }
          >
            All ({exemplars.length})
          </button>
          {segments.map((s) => {
            const count = exemplars.filter((e) => e.audienceSegment === s).length
            const active = segmentFilter === s
            return (
              <button
                key={s}
                onClick={() => setSegmentFilter(s)}
                className="text-[11px] px-2 py-1 rounded-full font-medium capitalize transition-colors"
                style={
                  active
                    ? { background: '#4338ca', color: '#fff' }
                    : { background: '#f3f4f6', color: '#4b5563', border: '1px solid #e5e7eb' }
                }
              >
                {s.replace(/_/g, ' ')} ({count})
              </button>
            )
          })}
        </div>
      )}

      <div
        className="rounded-lg overflow-x-auto"
        style={{ background: '#ffffff', border: '1px solid #f3f4f6' }}
      >
        <table className="w-full">
          <thead>
            <tr style={{ background: '#fafafa', borderBottom: '1px solid #f3f4f6' }}>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#9ca3af' }}>Hook</th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#9ca3af' }}>Style</th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#9ca3af' }}>Audience</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#9ca3af' }}>CTR</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#9ca3af' }}>n</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#9ca3af' }}>Captured</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((e, i) => (
              <tr key={`${e.hookLine}-${i}`} style={{ borderBottom: i < sorted.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                <td className="px-3 py-2.5 max-w-md">
                  <p className="text-xs italic leading-snug truncate" style={{ color: '#374151' }} title={e.hookLine}>
                    &ldquo;{e.hookLine}&rdquo;
                  </p>
                </td>
                <td className="px-3 py-2.5">
                  <HookStyleChip style={e.hookStyle} />
                </td>
                <td className="px-3 py-2.5">
                  <span className="text-[11px] capitalize" style={{ color: '#6b7280' }}>
                    {e.audienceSegment.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right text-xs tabular-nums font-bold" style={{ color: '#15803d' }}>
                  {e.ctr.toFixed(2)}%
                </td>
                <td className="px-3 py-2.5 text-right text-xs tabular-nums" style={{ color: '#6b7280' }}>
                  {e.sampleSize.toLocaleString()}
                </td>
                <td className="px-3 py-2.5 text-right text-[11px] tabular-nums" style={{ color: '#9ca3af' }}>
                  {formatRelativeTime(e.extractedAt)}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-xs italic" style={{ color: '#9ca3af' }}>
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
    if (pct >= 80) return { bg: '#fee2e2', fg: '#b91c1c', label: 'high' }
    if (pct >= 60) return { bg: '#fef3c7', fg: '#b45309', label: 'medium' }
    return { bg: '#dcfce7', fg: '#166534', label: 'low' }
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
      <p className="text-xs italic px-3 py-6 text-center" style={{ color: '#9ca3af' }}>
        No saturation data yet.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 4 }}>
        <thead>
          <tr>
            <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#9ca3af' }}>
              Audience ↓ / Hook →
            </th>
            {hookStyles.map((h) => (
              <th
                key={h}
                className="px-2 py-1.5 text-center text-[10px] font-medium capitalize"
                style={{ color: '#6b7280', minWidth: 80 }}
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
                style={{ color: '#374151' }}
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
                        background: '#f9fafb',
                        color: '#d1d5db',
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
                    className="text-center text-[11px] tabular-nums font-bold"
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
      <div className="flex items-center gap-3 mt-3 text-[11px]" style={{ color: '#6b7280' }}>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded" style={{ background: '#dcfce7', border: '1px solid #bbf7d0' }} />
          &lt;60% fresh
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded" style={{ background: '#fef3c7', border: '1px solid #fde68a' }} />
          60–80% saturating
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded" style={{ background: '#fee2e2', border: '1px solid #fecaca' }} />
          &gt;80% burned out
        </div>
        <span className="ml-auto" style={{ color: '#9ca3af' }}>
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
        const confColor =
          conf >= 0.8 ? { bg: '#dcfce7', fg: '#166534', border: '#bbf7d0' }
          : conf >= 0.6 ? { bg: '#fef3c7', fg: '#b45309', border: '#fde68a' }
          : { bg: '#f3f4f6', fg: '#6b7280', border: '#e5e7eb' }
        return (
          <div
            key={i}
            className="rounded-lg p-4"
            style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <p className="text-sm font-semibold leading-snug" style={{ color: '#111827' }}>
                {insight.finding}
              </p>
              <span
                className="text-[11px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap shrink-0"
                style={{ background: confColor.bg, color: confColor.fg, border: `1px solid ${confColor.border}` }}
                title={`${(conf * 100).toFixed(0)}% confidence based on ${insight.dataPoints} data points`}
              >
                {(conf * 100).toFixed(0)}% conf · n={insight.dataPoints}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#9ca3af' }}>
                  Isolated variable
                </p>
                <p className="text-xs font-medium" style={{ color: '#4338ca' }}>{insight.isolatedVariable}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#9ca3af' }}>
                  Controlled for
                </p>
                <div className="flex flex-wrap gap-1">
                  {insight.controlledFor.length === 0 ? (
                    <span className="text-[11px] italic" style={{ color: '#9ca3af' }}>none</span>
                  ) : (
                    insight.controlledFor.map((c) => (
                      <span
                        key={c}
                        className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ background: '#f3f4f6', color: '#4b5563' }}
                      >
                        {c.replace(/_/g, ' ')}
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#9ca3af' }}>
                  Root cause
                </p>
                <p className="text-xs" style={{ color: '#374151' }}>{insight.rootCause}</p>
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
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#f8f9fb' }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin" style={{ color: '#4338ca' }} />
          <p className="text-sm" style={{ color: '#71717a' }}>Loading learnings...</p>
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

  const cardStyle: React.CSSProperties = {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    boxShadow: '0 1px 2px rgba(15,23,42,0.03)',
  }

  const hasPatternData =
    creative?.winningHooks?.length ||
    creative?.losingHooks?.length ||
    creative?.winningFormats?.length ||
    creative?.losingFormats?.length ||
    campaign?.audienceScores ||
    campaign?.budgetInsights?.length ||
    campaign?.timingInsights?.length

  return (
    <div className="p-7 max-w-5xl mx-auto animate-fade-up">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}
            >
              <BookOpen size={15} style={{ color: '#15803d' }} />
            </div>
            <div>
              <h1 className="text-[20px] font-bold tracking-tight" style={{ color: '#18181b' }}>
                Learnings
              </h1>
              <p className="text-xs mt-0.5" style={{ color: '#a1a1aa' }}>
                AI-synthesized insights from past campaign performance
                {updatedAt && (
                  <span className="ml-1">· Updated {new Date(updatedAt).toLocaleDateString()}</span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={handleImport}
            disabled={importPhase === 'importing'}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all"
            style={
              importPhase === 'importing'
                ? { background: '#f8f9fb', color: '#a1a1aa', cursor: 'not-allowed' }
                : importPhase === 'completed'
                ? { background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }
                : importPhase === 'failed'
                ? { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' }
                : { background: 'linear-gradient(135deg, #4338ca 0%, #4338ca 100%)', color: '#ffffff', boxShadow: '0 2px 6px rgba(2,132,199,0.35)' }
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
          <div className="mt-4 rounded-xl p-4 flex flex-col gap-3" style={cardStyle}>
            <div className="flex items-center justify-between text-xs">
              <span
                className="font-medium capitalize"
                style={{ color: importProgress.status === 'completed' ? '#15803d' : '#4338ca' }}
              >
                {importProgress.status === 'completed' ? '✓ Completed' :
                 importProgress.status === 'failed' ? '✗ Failed' :
                 `${importProgress.status}…`}
              </span>
              <span style={{ color: '#71717a' }}>
                {importProgress.completedBatches}/{importProgress.totalBatches} batches
                {importProgress.totalCampaigns > 0 && ` · ${importProgress.totalCampaigns} campaigns`}
                {importProgress.caseStudyCount > 0 && ` · ${importProgress.caseStudyCount} case studies`}
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#e5e7eb' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${importProgress.progress}%`,
                  background: importProgress.status === 'completed' ? '#15803d' : '#4338ca',
                }}
              />
            </div>
          </div>
        )}
        {importPhase === 'failed' && importError && (
          <p className="text-xs mt-2" style={{ color: '#b91c1c' }}>{importError}</p>
        )}
      </div>

      {error && (
        <div
          className="rounded-xl p-4 mb-6 text-sm"
          style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#b91c1c' }}
        >
          {error}
        </div>
      )}

      {/* ===== SECTION A: PATTERN MEMORY ===== */}
      <div className="mb-8">
        <h2 className="text-[15px] font-bold tracking-tight mb-4" style={{ color: '#18181b' }}>
          Pattern Memory
        </h2>

        {!hasPatternData ? (
          <div
            className="rounded-xl py-10 text-center"
            style={cardStyle}
          >
            <p className="text-sm" style={{ color: '#a1a1aa' }}>No learnings data yet.</p>
            <p className="text-xs mt-1" style={{ color: '#d4d4d8' }}>
              Import from Meta to generate AI-synthesized insights.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Winning hooks */}
            {creative?.winningHooks && creative.winningHooks.length > 0 && (
              <div className="rounded-xl p-5" style={cardStyle}>
                <h3
                  className="text-xs font-semibold uppercase tracking-wider mb-3"
                  style={{ color: '#15803d' }}
                >
                  Winning Hooks
                </h3>
                <TagList items={creative.winningHooks} color="green" />
              </div>
            )}

            {/* Losing hooks */}
            {creative?.losingHooks && creative.losingHooks.length > 0 && (
              <div className="rounded-xl p-5" style={cardStyle}>
                <h3
                  className="text-xs font-semibold uppercase tracking-wider mb-3"
                  style={{ color: '#b91c1c' }}
                >
                  Losing Hooks
                </h3>
                <TagList items={creative.losingHooks} color="red" />
              </div>
            )}

            {/* Winning formats */}
            {creative?.winningFormats && creative.winningFormats.length > 0 && (
              <div className="rounded-xl p-5" style={cardStyle}>
                <h3
                  className="text-xs font-semibold uppercase tracking-wider mb-3"
                  style={{ color: '#b45309' }}
                >
                  Winning Formats
                </h3>
                <TagList items={creative.winningFormats} color="amber" />
              </div>
            )}

            {/* Losing formats */}
            {creative?.losingFormats && creative.losingFormats.length > 0 && (
              <div className="rounded-xl p-5" style={cardStyle}>
                <h3
                  className="text-xs font-semibold uppercase tracking-wider mb-3"
                  style={{ color: '#71717a' }}
                >
                  Losing Formats
                </h3>
                <TagList items={creative.losingFormats} color="zinc" />
              </div>
            )}

            {/* Audience scores */}
            {campaign?.audienceScores && Object.keys(campaign.audienceScores).length > 0 && (
              <div className="rounded-xl p-5" style={cardStyle}>
                <h3
                  className="text-xs font-semibold uppercase tracking-wider mb-3"
                  style={{ color: '#4338ca' }}
                >
                  Audience Scores
                </h3>
                <div className="flex flex-col gap-2">
                  {Object.entries(campaign.audienceScores)
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, score]) => (
                      <div key={type} className="flex items-center justify-between gap-3">
                        <span className="text-sm capitalize" style={{ color: '#52525b' }}>{type}</span>
                        <div className="flex items-center gap-2 flex-1 max-w-[140px]">
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#e5e7eb' }}>
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min((score / 5) * 100, 100)}%`,
                                background: score >= 3 ? '#15803d' : score >= 2 ? '#b45309' : '#b91c1c',
                              }}
                            />
                          </div>
                          <span className="text-xs font-semibold w-8 text-right" style={{ color: '#18181b' }}>
                            {score.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Budget + timing insights */}
            {((campaign?.budgetInsights?.length ?? 0) > 0 ||
              (campaign?.timingInsights?.length ?? 0) > 0) && (
              <div className="rounded-xl p-5" style={cardStyle}>
                {campaign?.budgetInsights && campaign.budgetInsights.length > 0 && (
                  <div className="mb-3">
                    <h3
                      className="text-xs font-semibold uppercase tracking-wider mb-2"
                      style={{ color: '#a1a1aa' }}
                    >
                      Budget Insights
                    </h3>
                    <InsightList items={campaign.budgetInsights} />
                  </div>
                )}
                {campaign?.timingInsights && campaign.timingInsights.length > 0 && (
                  <div>
                    <h3
                      className="text-xs font-semibold uppercase tracking-wider mb-2"
                      style={{ color: '#a1a1aa' }}
                    >
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

      {/* ===== SECTION A2: WINNING EXEMPLARS ===== */}
      {creative?.winningExemplars && creative.winningExemplars.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={15} style={{ color: '#15803d' }} />
            <h2 className="text-[15px] font-bold tracking-tight" style={{ color: '#18181b' }}>
              Winning Exemplars
            </h2>
            <span
              className="text-xs font-normal px-2 py-0.5 rounded-full align-middle"
              style={{ background: '#f8f9fb', color: '#71717a', border: '1px solid #e5e7eb' }}
            >
              {creative.winningExemplars.length}
            </span>
          </div>
          <div className="rounded-xl p-5" style={cardStyle}>
            <WinningExemplarsTable exemplars={creative.winningExemplars} />
          </div>
        </div>
      )}

      {/* ===== SECTION A3: HOOK SATURATION HEATMAP ===== */}
      {creative?.audienceHookSaturation && Object.keys(creative.audienceHookSaturation).length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <LayoutGrid size={15} style={{ color: '#b45309' }} />
            <h2 className="text-[15px] font-bold tracking-tight" style={{ color: '#18181b' }}>
              Hook Saturation
            </h2>
          </div>
          <div className="rounded-xl p-5" style={cardStyle}>
            <HookSaturationHeatmap data={creative.audienceHookSaturation} />
          </div>
        </div>
      )}

      {/* ===== SECTION A4: CAUSAL INSIGHTS ===== */}
      {company?.learnings?.causalInsights && company.learnings.causalInsights.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <GitBranch size={15} style={{ color: '#4338ca' }} />
            <h2 className="text-[15px] font-bold tracking-tight" style={{ color: '#18181b' }}>
              Causal Insights
            </h2>
            <span
              className="text-xs font-normal px-2 py-0.5 rounded-full align-middle"
              style={{ background: '#f8f9fb', color: '#71717a', border: '1px solid #e5e7eb' }}
            >
              {company.learnings.causalInsights.length}
            </span>
          </div>
          <CausalInsightsTimeline insights={company.learnings.causalInsights} />
        </div>
      )}

      {/* ===== SECTION B: CASE STUDIES ===== */}
      <div>
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <h2 className="text-[15px] font-bold tracking-tight" style={{ color: '#18181b' }}>
            Case Studies
            {caseStudies.length > 0 && (
              <span
                className="ml-2 text-xs font-normal px-2 py-0.5 rounded-full align-middle"
                style={{ background: '#f8f9fb', color: '#71717a', border: '1px solid #e5e7eb' }}
              >
                {caseStudies.length}
              </span>
            )}
          </h2>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#a1a1aa' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by campaign or product…"
              className="rounded-lg pl-8 pr-4 py-1.5 text-xs w-64"
              style={{ background: '#f6f6f7', border: '1px solid #e5e7eb', color: '#18181b' }}
            />
          </div>
        </div>

        {filteredStudies.length === 0 ? (
          <div
            className="rounded-xl py-12 text-center"
            style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}
          >
            <BookOpen size={28} className="mx-auto mb-3" style={{ color: '#d4d4d8' }} />
            <p className="text-sm font-medium" style={{ color: '#a1a1aa' }}>
              {search ? 'No case studies match your search' : 'No case studies yet'}
            </p>
            <p className="text-xs mt-1" style={{ color: '#d4d4d8' }}>
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
