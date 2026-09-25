'use client'

import { useEffect, useState } from 'react'
import {
  Loader2, AlertCircle, Users, MapPin, Layers, Clock, CalendarDays, Sparkles,
  TrendingUp, DollarSign, Target,
} from 'lucide-react'
import { getCampaignBreakdowns, getCampaignTimeseries } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import type { CampaignBreakdowns, TimeseriesPoint, BreakdownRow } from '@/types'

/* ─── Status color — same ROAS bands used everywhere else in the campaign detail page ─── */
function roasColor(roas: number): string {
  if (!roas || roas <= 0) return 'var(--ink-4)'
  if (roas >= 2) return 'var(--good)'
  if (roas >= 1) return 'var(--warn)'
  return 'var(--bad)'
}
function roasBg(roas: number): string {
  if (!roas || roas <= 0) return 'var(--muted)'
  if (roas >= 2) return 'var(--good-bg)'
  if (roas >= 1) return 'var(--warn-bg)'
  return 'var(--bad-bg)'
}

const DOW_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

export type SegmentObjectiveGroup = 'sales' | 'awareness' | 'traffic' | 'leads' | 'app' | 'engagement' | 'unknown'

interface SegmentMetricSource {
  spend: number
  impressions: number
  clicks: number
  conversions: number
  revenue?: number
  ctr?: number
  cpc?: number
  cpm?: number
  cpa?: number
  roas?: number
}

interface SegmentMetricContext {
  group: SegmentObjectiveGroup
  resultLabel: string
  efficiencyLabel: string
  efficiencyFormat: 'currency' | 'percent' | 'roas'
  returnUnavailable: boolean
  result: (row: SegmentMetricSource) => number
  efficiency: (row: SegmentMetricSource) => number
}

function metricContextFor(group: SegmentObjectiveGroup, returnEvidenceAvailable: boolean): SegmentMetricContext {
  if (group === 'sales' && returnEvidenceAvailable) {
    return {
      group,
      resultLabel: 'Purchases',
      efficiencyLabel: 'Raw ROAS',
      efficiencyFormat: 'roas',
      returnUnavailable: false,
      result: row => row.conversions,
      efficiency: row => row.roas && row.roas > 0
        ? row.roas
        : row.spend > 0 && row.revenue && row.revenue > 0
          ? row.revenue / row.spend
          : 0,
    }
  }
  if (group === 'sales') {
    return {
      group,
      resultLabel: 'Clicks',
      efficiencyLabel: 'CTR',
      efficiencyFormat: 'percent',
      returnUnavailable: true,
      result: row => row.clicks,
      efficiency: row => row.ctr ?? (row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0),
    }
  }
  if (group === 'awareness') {
    return {
      group,
      resultLabel: 'Impressions',
      efficiencyLabel: 'CPM',
      efficiencyFormat: 'currency',
      returnUnavailable: false,
      result: row => row.impressions,
      efficiency: row => row.cpm ?? (row.impressions > 0 ? (row.spend / row.impressions) * 1000 : 0),
    }
  }
  if (group === 'traffic' || group === 'engagement') {
    return {
      group,
      resultLabel: 'Clicks',
      efficiencyLabel: 'CPC',
      efficiencyFormat: 'currency',
      returnUnavailable: false,
      result: row => row.clicks,
      efficiency: row => row.cpc ?? (row.clicks > 0 ? row.spend / row.clicks : 0),
    }
  }

  const resultLabel = group === 'leads'
    ? 'Leads'
    : group === 'app'
      ? 'App results'
      : 'Clicks'
  const efficiencyLabel = group === 'leads'
    ? 'Cost / lead'
    : group === 'app'
      ? 'Cost / result'
      : 'CTR'

  return {
    group,
    resultLabel,
    efficiencyLabel,
    efficiencyFormat: group === 'unknown' ? 'percent' : 'currency',
    returnUnavailable: false,
    result: row => group === 'unknown' ? row.clicks : row.conversions,
    efficiency: row => group === 'unknown'
      ? row.ctr ?? (row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0)
      : row.cpa ?? (row.conversions > 0 ? row.spend / row.conversions : 0),
  }
}

function formatResult(value: number): string {
  return value > 0 ? Math.round(value).toLocaleString('en-IN') : '—'
}

function formatEfficiency(value: number, context: SegmentMetricContext): string {
  if (value <= 0) return '—'
  if (context.efficiencyFormat === 'roas') return `${value.toFixed(2)}x`
  if (context.efficiencyFormat === 'percent') return `${value.toFixed(2)}%`
  return formatCurrency(value)
}

function hasObjectiveResults(rows: BreakdownRow[], context: SegmentMetricContext): boolean {
  // Delivery results remain available for delivery-based objectives even where
  // Meta suppresses attributed conversion events for a geographic breakdown.
  if (['awareness', 'traffic', 'engagement', 'unknown'].includes(context.group) || context.returnUnavailable) return true
  return rows.some(row => context.result(row) > 0)
}

function unavailableResultNote(granularity: 'region' | 'country', context: SegmentMetricContext): string {
  const result = context.resultLabel.toLowerCase()
  return `Meta doesn't report ${result} at ${granularity} granularity — spend, clicks and CTR remain available.`
}

export function SegmentsPanel({
  tenantId,
  campaignId,
  objectiveGroup = 'unknown',
  returnEvidenceAvailable = false,
}: {
  tenantId: string
  campaignId: string
  objectiveGroup?: SegmentObjectiveGroup
  returnEvidenceAvailable?: boolean
}) {
  const [breakdowns, setBreakdowns] = useState<CampaignBreakdowns | null>(null)
  const [series, setSeries] = useState<TimeseriesPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const metricContext = metricContextFor(objectiveGroup, returnEvidenceAvailable)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getCampaignBreakdowns(tenantId, campaignId),
      getCampaignTimeseries(tenantId, campaignId),
    ])
      .then(([b, s]) => { if (!cancelled) { setBreakdowns(b); setSeries(s) } })
      .catch(() => { if (!cancelled) setError("We couldn't load the audience breakdown. Try again.") })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [tenantId, campaignId])

  if (loading) {
    return <div className="flex items-center justify-center py-20" style={{ color: 'var(--ink-3)' }}><Loader2 size={18} className="animate-spin" /></div>
  }
  if (error) {
    return (
      <div className="py-16 text-center">
        <AlertCircle size={20} style={{ color: 'var(--bad)', margin: '0 auto 8px' }} />
        <p className="text-sm" style={{ color: 'var(--ink-3)' }}>{error}</p>
      </div>
    )
  }

  const hasBreakdowns = breakdowns && Object.keys(breakdowns).length > 0
  if (!hasBreakdowns && series.length === 0) {
    return (
      <div className="py-16 text-center rounded-2xl" style={{ background: 'var(--surface-warm)', border: '2px dashed var(--hairline)' }}>
        <Sparkles size={24} style={{ color: 'var(--ink-4)', margin: '0 auto 10px' }} />
        <p className="text-sm font-semibold" style={{ color: 'var(--ink-3)' }}>No segment data yet</p>
        <p className="text-xs mt-1" style={{ color: 'var(--ink-4)' }}>Run a deep-sync to populate age, region, placement, and daily trend data.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {metricContext.returnUnavailable && (
        <div className="card-inset px-4 py-3 text-xs font-medium" style={{ color: 'var(--ink-3)' }}>
          Campaign return unavailable · showing delivery metrics only
        </div>
      )}
      {series.length > 1 && <TrendSection series={series} context={metricContext} />}

      {breakdowns?.age_gender && breakdowns.age_gender.rows.length > 0 && (
        <SegmentTable
          title="Age × Gender"
          icon={<Users size={13} />}
          rows={breakdowns.age_gender.rows}
          segmentLabel={r => `${r.keys.age || '—'} · ${r.keys.gender || '—'}`}
          context={metricContext}
          showObjectiveMetrics
        />
      )}

      {breakdowns?.placement && breakdowns.placement.rows.length > 0 && (
        <SegmentTable
          title="Placement"
          icon={<Layers size={13} />}
          rows={breakdowns.placement.rows}
          segmentLabel={r => [r.keys.publisherPlatform, r.keys.platformPosition, r.keys.devicePlatform].filter(Boolean).join(' · ') || '—'}
          context={metricContext}
          showObjectiveMetrics
        />
      )}

      {breakdowns?.region && breakdowns.region.rows.length > 0 && (
        <SegmentTable
          title="Region"
          icon={<MapPin size={13} />}
          rows={breakdowns.region.rows}
          segmentLabel={r => r.keys.region || '—'}
          context={metricContext}
          showObjectiveMetrics={hasObjectiveResults(breakdowns.region.rows, metricContext)}
          note={hasObjectiveResults(breakdowns.region.rows, metricContext) ? undefined : unavailableResultNote('region', metricContext)}
        />
      )}

      {/* Meta sometimes preserves objective-result attribution at country level
          even when the finer region breakdown suppresses it. */}
      {breakdowns?.country && breakdowns.country.rows.length > 0 && (() => {
        const showObjectiveMetrics = hasObjectiveResults(breakdowns.country!.rows, metricContext)
        return (
          <SegmentTable
            title="Country"
            icon={<MapPin size={13} />}
            rows={breakdowns.country!.rows}
            segmentLabel={r => r.keys.country || '—'}
            context={metricContext}
            showObjectiveMetrics={showObjectiveMetrics}
            note={showObjectiveMetrics ? undefined : unavailableResultNote('country', metricContext)}
          />
        )
      })()}

      {breakdowns?.hourly && breakdowns.hourly.rows.length > 0 && (
        <HourBars rows={breakdowns.hourly.rows} context={metricContext} />
      )}

      {breakdowns?.dow && breakdowns.dow.rows.length > 0 && (
        <DowBars rows={breakdowns.dow.rows} context={metricContext} />
      )}

      {(breakdowns?.asset_body?.rows.length || breakdowns?.asset_title?.rows.length || breakdowns?.asset_video?.rows.length) ? (
        <CreativeAssetSection breakdowns={breakdowns!} context={metricContext} />
      ) : null}
    </div>
  )
}

/* ═════════════════════════════════════════════════════════════════
   DAILY TREND — single-axis sparkline cards, one per measure.
   Same visual language as the Audit tab's trend cards, sourced from the
   full 90-day daily series instead of the last few audit snapshots.
   ═════════════════════════════════════════════════════════════════ */
function TrendSection({ series, context }: { series: TimeseriesPoint[]; context: SegmentMetricContext }) {
  const spend = series.map(s => s.spend)
  const result = series.map(row => context.result(row))
  const efficiency = series.map(row => context.efficiency(row))

  const cards = [
    { label: 'Spend', data: spend, color: 'var(--accent)', format: formatCurrency, directional: false, Icon: DollarSign },
    { label: context.efficiencyLabel, data: efficiency, color: context.efficiencyFormat === 'roas' ? 'var(--good)' : 'var(--accent-strong)', format: (value: number) => formatEfficiency(value, context), directional: context.efficiencyFormat === 'roas', Icon: TrendingUp },
    { label: context.resultLabel, data: result, color: 'var(--info)', format: formatResult, directional: false, Icon: Target },
  ]

  return (
    <div className="card p-5">
      <p className="micro-label mb-4">Daily Trend · {series.length} days</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map(({ label, data, color, format, directional, Icon }) => {
          const latest = data[data.length - 1] ?? 0
          const prevWindow = data.slice(0, -1)
          const prevAvg = prevWindow.length ? prevWindow.reduce((a, b) => a + b, 0) / prevWindow.length : latest
          const delta = prevAvg ? ((latest - prevAvg) / prevAvg) * 100 : 0
          const min = Math.min(...data), max = Math.max(...data), rng = max - min || 1
          const W = 220, H = 52
          const pts = data.map((v, i) => `${(i / Math.max(1, data.length - 1)) * W},${H - ((v - min) / rng) * H}`).join(' ')
          return (
            <div key={label} className="card-inset p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5"><Icon size={12} style={{ color }} /><p className="text-xs font-bold" style={{ color: 'var(--ink-2)' }}>{label}</p></div>
                {prevAvg > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={directional ? { background: delta >= 0 ? 'var(--good-bg)' : 'var(--bad-bg)', color: delta >= 0 ? 'var(--good)' : 'var(--bad)' } : { background: 'var(--muted)', color: 'var(--ink-3)' }}>
                    {delta >= 0 ? '↑' : '↓'}{Math.abs(delta).toFixed(0)}% vs avg
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <svg height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" fill="none" className="w-full min-w-0 sm:max-w-[220px]">
                  <polyline points={pts} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
                  <circle cx={W - 3.5} cy={H - ((latest - min) / rng) * H} r={3.5} fill={color} />
                </svg>
                <div className="shrink-0">
                  <p className="display-num text-lg" style={{ color }}>{format(latest)}</p>
                  <p className="text-[10px] mt-0.5 font-semibold" style={{ color: 'var(--ink-3)' }}>Today</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ═════════════════════════════════════════════════════════════════
   SEGMENT TABLE — age×gender, placement and geography. Only verified sales
   return receives ROAS coloring; every other objective stays neutral.
   ═════════════════════════════════════════════════════════════════ */
function SegmentTable({
  title, icon, rows, segmentLabel, context, showObjectiveMetrics, note,
}: {
  title: string
  icon: React.ReactNode
  rows: BreakdownRow[]
  segmentLabel: (r: BreakdownRow) => string
  context: SegmentMetricContext
  showObjectiveMetrics: boolean
  note?: string
}) {
  const sorted = [...rows].sort((a, b) => b.spend - a.spend).slice(0, 12)
  const showBaseImpressions = !showObjectiveMetrics || context.resultLabel !== 'Impressions'
  const showBaseClicks = !showObjectiveMetrics || context.resultLabel !== 'Clicks'
  const showBaseCtr = !showObjectiveMetrics || context.efficiencyLabel !== 'CTR'
  const showSalesCpa = showObjectiveMetrics && context.efficiencyFormat === 'roas'
  const headers = [
    'Segment',
    'Spend',
    ...(showBaseImpressions ? ['Impr.'] : []),
    ...(showBaseClicks ? ['Clicks'] : []),
    ...(showBaseCtr ? ['CTR'] : []),
    ...(showObjectiveMetrics ? [context.resultLabel, context.efficiencyLabel] : []),
    ...(showSalesCpa ? ['CPA'] : []),
  ]

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--hairline-light)' }}>
        <div className="flex items-center gap-2"><span style={{ color: 'var(--accent)' }}>{icon}</span><p className="micro-label mb-0">{title}</p></div>
        {showSalesCpa && (
          <div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--ink-3)' }}>
            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: 'var(--good)' }} />≥2x</span>
            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: 'var(--warn)' }} />≥1x</span>
            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: 'var(--bad)' }} />&lt;1x</span>
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead><tr>{headers.map((h, i) => <th key={h} className={i === 0 ? '' : 'num'}>{h}</th>)}</tr></thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={i}>
                <td className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>{segmentLabel(r)}</td>
                <td className="num mono text-xs" style={{ color: 'var(--ink-2)' }}>{formatCurrency(r.spend)}</td>
                {showBaseImpressions && <td className="num mono text-xs" style={{ color: 'var(--ink-3)' }}>{r.impressions.toLocaleString('en-IN')}</td>}
                {showBaseClicks && <td className="num mono text-xs" style={{ color: 'var(--ink-3)' }}>{r.clicks.toLocaleString('en-IN')}</td>}
                {showBaseCtr && <td className="num mono text-xs" style={{ color: 'var(--ink-3)' }}>{r.ctr ? `${r.ctr.toFixed(2)}%` : '—'}</td>}
                {showObjectiveMetrics && <td className="num mono text-xs" style={{ color: 'var(--ink-2)' }}>{formatResult(context.result(r))}</td>}
                {showObjectiveMetrics && context.efficiencyFormat === 'roas' ? (
                  <td className="num">
                    <span className="mono text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: roasBg(context.efficiency(r)), color: roasColor(context.efficiency(r)) }}>
                      {formatEfficiency(context.efficiency(r), context)}
                    </span>
                  </td>
                ) : showObjectiveMetrics ? (
                  <td className="num mono text-xs font-semibold" style={{ color: 'var(--ink-2)' }}>{formatEfficiency(context.efficiency(r), context)}</td>
                ) : null}
                {showSalesCpa && <td className="num mono text-xs" style={{ color: 'var(--ink-3)' }}>{r.cpa > 0 ? formatCurrency(r.cpa) : '—'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {note && <p className="px-5 py-2.5 text-[11px] leading-relaxed" style={{ color: 'var(--ink-3)', background: 'var(--surface-warm)', borderTop: '1px solid var(--hairline-light)' }}>{note}</p>}
    </div>
  )
}

/* ═════════════════════════════════════════════════════════════════
   HOUR-OF-DAY BARS — magnitude (spend) across 24 ordered bins, single hue.
   Objective-specific result is called out without treating cost movement as
   inherently good or bad.
   ═════════════════════════════════════════════════════════════════ */
function HourBars({ rows, context }: { rows: BreakdownRow[]; context: SegmentMetricContext }) {
  const byHour = new Map<number, BreakdownRow>()
  for (const r of rows) {
    const h = parseInt(String(r.keys.hour ?? '').slice(0, 2), 10)
    if (Number.isFinite(h)) byHour.set(h, r)
  }
  const maxSpend = Math.max(...rows.map(r => r.spend), 1)
  const topHours = rows
    .filter(row => context.result(row) > 0)
    .sort((a, b) => context.efficiencyFormat === 'roas'
      ? context.efficiency(b) - context.efficiency(a)
      : context.result(b) - context.result(a))
    .slice(0, 3)
  const highlightLabel = context.efficiencyFormat === 'roas'
    ? 'Highest raw ROAS:'
    : `Most ${context.resultLabel.toLowerCase()}:`

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2"><Clock size={13} style={{ color: 'var(--accent)' }} /><p className="micro-label mb-0">Hour of Day</p></div>
        {topHours.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-semibold" style={{ color: 'var(--ink-3)' }}>{highlightLabel}</span>
            {topHours.map((r, i) => (
              <span key={i} className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={context.efficiencyFormat === 'roas' ? { background: 'var(--good-bg)', color: 'var(--good)' } : { background: 'var(--accent-bg)', color: 'var(--accent-strong)' }}>
                {String(r.keys.hour ?? '').slice(0, 5)} · {context.efficiencyFormat === 'roas' ? formatEfficiency(context.efficiency(r), context) : formatResult(context.result(r))}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
        {Array.from({ length: 24 }, (_, h) => {
          const r = byHour.get(h)
          const pct = r ? Math.max(4, (r.spend / maxSpend) * 100) : 0
          return (
            <div key={h} className="flex flex-col items-center gap-1" title={r ? `${h}:00 — ${formatCurrency(r.spend)} spend, ${formatResult(context.result(r))} ${context.resultLabel.toLowerCase()}, ${formatEfficiency(context.efficiency(r), context)} ${context.efficiencyLabel}` : `${h}:00 — no data`}>
              <div className="w-full rounded-t-sm" style={{ height: 64, display: 'flex', alignItems: 'flex-end', background: 'var(--muted)' }}>
                <div className="w-full rounded-t-sm transition-all" style={{ height: `${pct}%`, background: 'var(--accent)', minHeight: r ? 3 : 0 }} />
              </div>
              <span className="text-[8px] mono" style={{ color: 'var(--ink-4)' }}>{h % 3 === 0 ? h : ''}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ═════════════════════════════════════════════════════════════════
   DAY-OF-WEEK BARS
   ═════════════════════════════════════════════════════════════════ */
function DowBars({ rows, context }: { rows: BreakdownRow[]; context: SegmentMetricContext }) {
  const byDow = new Map<string, BreakdownRow>()
  for (const r of rows) if (r.keys.dow) byDow.set(r.keys.dow, r)
  const maxSpend = Math.max(...rows.map(r => r.spend), 1)

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4"><CalendarDays size={13} style={{ color: 'var(--accent)' }} /><p className="micro-label mb-0">Day of Week</p></div>
      <div className="grid grid-cols-7 gap-2">
        {DOW_ORDER.map(day => {
          const r = byDow.get(day)
          const pct = r ? Math.max(4, (r.spend / maxSpend) * 100) : 0
          return (
            <div key={day} className="flex flex-col items-center gap-1.5" title={r ? `${day} — ${formatCurrency(r.spend)} spend, ${formatResult(context.result(r))} ${context.resultLabel.toLowerCase()}, ${formatEfficiency(context.efficiency(r), context)} ${context.efficiencyLabel}` : day}>
              <div className="w-full rounded-t-sm" style={{ height: 56, display: 'flex', alignItems: 'flex-end', background: 'var(--muted)' }}>
                <div className="w-full rounded-t-sm transition-all" style={{ height: `${pct}%`, background: r && context.efficiencyFormat === 'roas' && context.efficiency(r) > 0 ? roasColor(context.efficiency(r)) : 'var(--accent)', minHeight: r ? 3 : 0 }} />
              </div>
              <span className="text-[10px] font-semibold capitalize" style={{ color: 'var(--ink-3)' }}>{day.slice(0, 3)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ═════════════════════════════════════════════════════════════════
   CREATIVE ASSET PERFORMANCE — per-asset rows for dynamic-creative ads
   (Meta mixes variants at delivery; this is the only level real
   per-copy/per-video attribution exists at).
   ═════════════════════════════════════════════════════════════════ */
function CreativeAssetSection({ breakdowns, context }: { breakdowns: CampaignBreakdowns; context: SegmentMetricContext }) {
  const sections: Array<{ key: keyof CampaignBreakdowns; label: string; text: (r: BreakdownRow) => string }> = [
    { key: 'asset_video', label: 'Videos', text: r => r.keys.assetName || r.keys.video_asset || 'Untitled' },
    { key: 'asset_body', label: 'Body copy', text: r => r.keys.assetText || '—' },
    { key: 'asset_title', label: 'Titles', text: r => r.keys.assetText || '—' },
  ]

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4"><Sparkles size={13} style={{ color: 'var(--accent)' }} /><p className="micro-label mb-0">Creative Asset Performance</p></div>
      <div className="grid md:grid-cols-3 gap-4">
        {sections.map(({ key, label, text }) => {
          const rows = breakdowns[key]?.rows ?? []
          if (rows.length === 0) return null
          const top = [...rows].sort((a, b) => (context.result(b) - context.result(a)) || (b.spend - a.spend)).slice(0, 5)
          return (
            <div key={key}>
              <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--ink-3)' }}>{label}</p>
              <div className="space-y-2">
                {top.map((r, i) => (
                  <div key={i} className="rounded-lg px-3 py-2" style={{ background: 'var(--surface-warm)', border: '1px solid var(--hairline-light)' }}>
                    <p className="text-[12px] leading-snug mb-1 line-clamp-2" style={{ color: 'var(--ink)' }} title={text(r)}>{text(r)}</p>
                    <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--ink-3)' }}>
                      <span className="mono">{formatCurrency(r.spend)}</span>
                      {context.efficiency(r) > 0 && <span className="mono font-bold" style={{ color: context.efficiencyFormat === 'roas' ? roasColor(context.efficiency(r)) : 'var(--ink-2)' }}>{formatEfficiency(context.efficiency(r), context)}</span>}
                      {context.result(r) > 0 && <span>· {formatResult(context.result(r))} {context.resultLabel.toLowerCase()}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
