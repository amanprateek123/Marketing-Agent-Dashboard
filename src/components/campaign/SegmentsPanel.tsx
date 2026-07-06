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

export function SegmentsPanel({ tenantId, campaignId }: { tenantId: string; campaignId: string }) {
  const [breakdowns, setBreakdowns] = useState<CampaignBreakdowns | null>(null)
  const [series, setSeries] = useState<TimeseriesPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getCampaignBreakdowns(tenantId, campaignId),
      getCampaignTimeseries(tenantId, campaignId),
    ])
      .then(([b, s]) => { if (!cancelled) { setBreakdowns(b); setSeries(s) } })
      .catch(() => { if (!cancelled) setError('Failed to load segment data') })
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
      {series.length > 1 && <TrendSection series={series} />}

      {breakdowns?.age_gender && breakdowns.age_gender.rows.length > 0 && (
        <SegmentTable
          title="Age × Gender"
          icon={<Users size={13} />}
          rows={breakdowns.age_gender.rows}
          segmentLabel={r => `${r.keys.age || '—'} · ${r.keys.gender || '—'}`}
          showRoas
        />
      )}

      {breakdowns?.placement && breakdowns.placement.rows.length > 0 && (
        <SegmentTable
          title="Placement"
          icon={<Layers size={13} />}
          rows={breakdowns.placement.rows}
          segmentLabel={r => [r.keys.publisherPlatform, r.keys.platformPosition, r.keys.devicePlatform].filter(Boolean).join(' · ') || '—'}
          showRoas
        />
      )}

      {breakdowns?.region && breakdowns.region.rows.length > 0 && (
        <SegmentTable
          title="Region"
          icon={<MapPin size={13} />}
          rows={breakdowns.region.rows}
          segmentLabel={r => r.keys.region || '—'}
          showRoas={false}
          note="Meta doesn't report conversions at region granularity — spend, clicks and CTR only. Pair with first-party order data for regional ROAS."
        />
      )}

      {breakdowns?.hourly && breakdowns.hourly.rows.length > 0 && (
        <HourBars rows={breakdowns.hourly.rows} />
      )}

      {breakdowns?.dow && breakdowns.dow.rows.length > 0 && (
        <DowBars rows={breakdowns.dow.rows} />
      )}

      {(breakdowns?.asset_body?.rows.length || breakdowns?.asset_title?.rows.length || breakdowns?.asset_video?.rows.length) ? (
        <CreativeAssetSection breakdowns={breakdowns!} />
      ) : null}
    </div>
  )
}

/* ═════════════════════════════════════════════════════════════════
   DAILY TREND — single-axis sparkline cards, one per measure.
   Same visual language as the Audit tab's trend cards, sourced from the
   full 90-day daily series instead of the last few audit snapshots.
   ═════════════════════════════════════════════════════════════════ */
function TrendSection({ series }: { series: TimeseriesPoint[] }) {
  const spend = series.map(s => s.spend)
  const roas = series.map(s => (s.spend > 0 && s.revenue > 0 ? s.revenue / s.spend : 0))
  const conv = series.map(s => s.conversions)

  const cards = [
    { label: 'Spend', data: spend, color: 'var(--accent)', unit: '₹', Icon: DollarSign },
    { label: 'ROAS', data: roas, color: 'var(--good)', unit: 'x', Icon: TrendingUp },
    { label: 'Conversions', data: conv, color: 'var(--info)', unit: '#', Icon: Target },
  ]

  return (
    <div className="card p-5">
      <p className="micro-label mb-4">Daily Trend · {series.length} days</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map(({ label, data, color, unit, Icon }) => {
          const latest = data[data.length - 1] ?? 0
          const prevWindow = data.slice(0, -1)
          const prevAvg = prevWindow.length ? prevWindow.reduce((a, b) => a + b, 0) / prevWindow.length : latest
          const delta = prevAvg ? ((latest - prevAvg) / prevAvg) * 100 : 0
          const min = Math.min(...data), max = Math.max(...data), rng = max - min || 1
          const W = 220, H = 52
          const pts = data.map((v, i) => `${(i / Math.max(1, data.length - 1)) * W},${H - ((v - min) / rng) * H}`).join(' ')
          const fmt = (v: number) => (unit === '₹' ? formatCurrency(v) : unit === 'x' ? `${v.toFixed(2)}x` : Math.round(v).toLocaleString('en-IN'))
          return (
            <div key={label} className="card-inset p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5"><Icon size={12} style={{ color }} /><p className="text-xs font-bold" style={{ color: 'var(--ink-2)' }}>{label}</p></div>
                {prevAvg > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: delta >= 0 ? 'var(--good-bg)' : 'var(--bad-bg)', color: delta >= 0 ? 'var(--good)' : 'var(--bad)' }}>
                    {delta >= 0 ? '↑' : '↓'}{Math.abs(delta).toFixed(0)}% vs avg
                  </span>
                )}
              </div>
              <div className="flex items-end gap-4">
                <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none" className="shrink-0">
                  <polyline points={pts} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
                  <circle cx={W} cy={H - ((latest - min) / rng) * H} r={3.5} fill={color} />
                </svg>
                <div>
                  <p className="display-num text-lg" style={{ color }}>{fmt(latest)}</p>
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
   SEGMENT TABLE — age×gender, placement, region. ROAS-colored when
   conversions are available at that breakdown granularity (Meta withholds
   them for region).
   ═════════════════════════════════════════════════════════════════ */
function SegmentTable({
  title, icon, rows, segmentLabel, showRoas, note,
}: {
  title: string
  icon: React.ReactNode
  rows: BreakdownRow[]
  segmentLabel: (r: BreakdownRow) => string
  showRoas: boolean
  note?: string
}) {
  const sorted = [...rows].sort((a, b) => b.spend - a.spend).slice(0, 12)
  const headers = showRoas
    ? ['Segment', 'Spend', 'Impr.', 'Clicks', 'CTR', 'Conv.', 'ROAS', 'CPA']
    : ['Segment', 'Spend', 'Impr.', 'Clicks', 'CTR']

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--hairline-light)' }}>
        <div className="flex items-center gap-2"><span style={{ color: 'var(--accent)' }}>{icon}</span><p className="micro-label mb-0">{title}</p></div>
        {showRoas && (
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
                <td className="num mono text-xs" style={{ color: 'var(--ink-3)' }}>{r.impressions.toLocaleString('en-IN')}</td>
                <td className="num mono text-xs" style={{ color: 'var(--ink-3)' }}>{r.clicks.toLocaleString('en-IN')}</td>
                <td className="num mono text-xs" style={{ color: 'var(--ink-3)' }}>{r.ctr ? `${r.ctr.toFixed(2)}%` : '—'}</td>
                {showRoas && <td className="num mono text-xs" style={{ color: 'var(--ink-2)' }}>{r.conversions || '—'}</td>}
                {showRoas && (
                  <td className="num">
                    <span className="mono text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: roasBg(r.roas), color: roasColor(r.roas) }}>
                      {r.roas > 0 ? `${r.roas.toFixed(2)}x` : '—'}
                    </span>
                  </td>
                )}
                {showRoas && <td className="num mono text-xs" style={{ color: 'var(--ink-3)' }}>{r.cpa > 0 ? formatCurrency(r.cpa) : '—'}</td>}
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
   Conversion count overlaid where present; lowest-CPA hours called out.
   ═════════════════════════════════════════════════════════════════ */
function HourBars({ rows }: { rows: BreakdownRow[] }) {
  const byHour = new Map<number, BreakdownRow>()
  for (const r of rows) {
    const h = parseInt(String(r.keys.hour ?? '').slice(0, 2), 10)
    if (Number.isFinite(h)) byHour.set(h, r)
  }
  const maxSpend = Math.max(...rows.map(r => r.spend), 1)
  const bestHours = rows.filter(r => r.conversions > 0).sort((a, b) => a.cpa - b.cpa).slice(0, 3)

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2"><Clock size={13} style={{ color: 'var(--accent)' }} /><p className="micro-label mb-0">Hour of Day</p></div>
        {bestHours.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-semibold" style={{ color: 'var(--ink-3)' }}>Lowest CPA:</span>
            {bestHours.map((r, i) => (
              <span key={i} className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: 'var(--good-bg)', color: 'var(--good)' }}>
                {String(r.keys.hour ?? '').slice(0, 5)} · {formatCurrency(r.cpa)}
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
            <div key={h} className="flex flex-col items-center gap-1" title={r ? `${h}:00 — ${formatCurrency(r.spend)} spend, ${r.conversions} conv.` : `${h}:00 — no data`}>
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
function DowBars({ rows }: { rows: BreakdownRow[] }) {
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
            <div key={day} className="flex flex-col items-center gap-1.5" title={r ? `${day} — ${formatCurrency(r.spend)} spend, ${r.conversions} conv., ${r.roas > 0 ? r.roas.toFixed(2) + 'x' : '—'} ROAS` : day}>
              <div className="w-full rounded-t-sm" style={{ height: 56, display: 'flex', alignItems: 'flex-end', background: 'var(--muted)' }}>
                <div className="w-full rounded-t-sm transition-all" style={{ height: `${pct}%`, background: r && r.roas > 0 ? roasColor(r.roas) : 'var(--accent)', minHeight: r ? 3 : 0 }} />
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
function CreativeAssetSection({ breakdowns }: { breakdowns: CampaignBreakdowns }) {
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
          const top = [...rows].sort((a, b) => (b.conversions - a.conversions) || (b.spend - a.spend)).slice(0, 5)
          return (
            <div key={key}>
              <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--ink-3)' }}>{label}</p>
              <div className="space-y-2">
                {top.map((r, i) => (
                  <div key={i} className="rounded-lg px-3 py-2" style={{ background: 'var(--surface-warm)', border: '1px solid var(--hairline-light)' }}>
                    <p className="text-[12px] leading-snug mb-1 line-clamp-2" style={{ color: 'var(--ink)' }} title={text(r)}>{text(r)}</p>
                    <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--ink-3)' }}>
                      <span className="mono">{formatCurrency(r.spend)}</span>
                      {r.conversions > 0 && <span className="mono font-bold" style={{ color: roasColor(r.roas) }}>{r.roas.toFixed(2)}x</span>}
                      {r.conversions > 0 && <span>· {r.conversions} conv.</span>}
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
