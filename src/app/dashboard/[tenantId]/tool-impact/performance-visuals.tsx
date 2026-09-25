'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  DashboardCampaignRow,
  ToolImpactCampaignDailyPerformance,
  ToolImpactDailyPerformance,
  ToolImpactOverview,
  ToolImpactReturnNature,
} from '@/types'
import {
  formatInr,
  formatRelative,
  formatWhen,
  humanise,
  plainStatus,
} from '@/lib/plain-language'

/** Rupees for small per-result costs keep paise; everything else is whole rupees. */
function costInr(value: number): string {
  return formatInr(value, { decimals: Math.abs(value) < 100 ? 2 : 0 })
}

export function formatActionValueRoas(value: number): string {
  const gap = Math.abs(value - 1)
  return `${value.toFixed(gap < 0.001 ? 4 : gap < 0.01 ? 3 : 2)}x`
}

export function returnBasisLabel(
  basis: DashboardCampaignRow['revenueBasis'],
): string {
  return plainStatus('returnBasis', basis).label
}

function isResolvedMetaValue(campaign: DashboardCampaignRow): boolean {
  return (
    campaign.revenueBasis === 'meta_action_value' &&
    campaign.revenueAttributionSource !== 'unknown' &&
    campaign.revenueAttributionSource !== 'unresolved' &&
    campaign.revenueAttributionSource !== 'account_fallback'
  )
}

function hasUnknownReturn(campaign: DashboardCampaignRow): boolean {
  return (
    campaign.revenueBasis === 'unknown' ||
    campaign.revenueAttributionSource === 'unknown' ||
    campaign.revenueAttributionSource === 'unresolved' ||
    campaign.revenueAttributionSource === 'account_fallback'
  )
}

function roasTone(campaign: DashboardCampaignRow): {
  color: string
  background: string
  border: string
} {
  if (campaign.spend <= 0) {
    return {
      color: 'var(--ink-3)',
      background: 'var(--surface-warm)',
      border: 'var(--hairline)',
    }
  }
  if (hasUnknownReturn(campaign)) {
    return {
      color: 'var(--ink-3)',
      background: 'var(--surface-warm)',
      border: 'var(--hairline)',
    }
  }
  if (campaign.revenueBasis === 'configured_conversion_value') {
    return {
      color: 'var(--warn)',
      background: 'var(--warn-bg)',
      border: 'var(--warn-border)',
    }
  }
  if (campaign.roas >= 1 && isResolvedMetaValue(campaign)) {
    return {
      color: 'var(--good)',
      background: 'var(--good-bg)',
      border: 'var(--good-border)',
    }
  }
  return {
    color: 'var(--bad)',
    background: 'var(--bad-bg)',
    border: 'var(--bad-border)',
  }
}

function valueBarStyle(campaign: DashboardCampaignRow): React.CSSProperties {
  if (
    campaign.revenueBasis === 'unknown' ||
    campaign.revenueAttributionSource === 'unknown' ||
    campaign.revenueAttributionSource === 'unresolved' ||
    campaign.revenueAttributionSource === 'account_fallback'
  ) {
    return {
      background:
        'repeating-linear-gradient(135deg, var(--viz-unknown) 0 5px, var(--muted) 5px 10px)',
    }
  }
  if (campaign.revenueBasis === 'configured_conversion_value') {
    return {
      background:
        'repeating-linear-gradient(135deg, var(--viz-estimate) 0 5px, var(--warn-bg) 5px 10px)',
    }
  }
  return { background: 'var(--viz-value)' }
}

function objectiveSeriesColor(objectiveKey: string, metricKey = ''): string {
  const key = `${objectiveKey} ${metricKey}`.toLowerCase()
  if (key.includes('purchase') || key.includes('sale') || key.includes('conversion')) {
    return 'var(--viz-purchase)'
  }
  if (key.includes('reach')) return 'var(--viz-reach)'
  if (key.includes('impression') || key.includes('awareness')) return 'var(--viz-awareness)'
  if (key.includes('click') || key.includes('traffic') || key.includes('landing')) return 'var(--viz-clicks)'
  if (key.includes('lead')) return 'var(--viz-leads)'
  if (key.includes('engagement') || key.includes('view') || key.includes('video')) return 'var(--viz-engagement)'
  return 'var(--viz-impressions)'
}

function barWidth(value: number, maximum: number): string {
  if (value <= 0 || maximum <= 0) return '0%'
  return `${Math.max(1.5, Math.min(100, (value / maximum) * 100))}%`
}

type DailyRange = 7 | 30 | 90 | 'all'

const DAY_MS = 86_400_000
const DAILY_RANGES: Array<{ value: DailyRange; label: string }> = [
  { value: 7, label: '7D' },
  { value: 30, label: '30D' },
  { value: 90, label: '90D' },
  { value: 'all', label: 'All' },
]

function dateKeyMs(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const result = Date.UTC(year, month - 1, day)
  const parsed = new Date(result)
  return Number.isFinite(result) &&
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
    ? result
    : null
}

function shortDate(value: string): string {
  const at = dateKeyMs(value)
  if (at == null) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(at))
}

function longDate(value: string): string {
  return dateKeyMs(value) == null ? '—' : formatWhen(value)
}

function compactCurrency(value: number): string {
  return formatInr(value, { compact: true })
}

function niceMaximum(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalized = value / magnitude
  const nice =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return nice * magnitude
}

function percentLabel(value: number | null): string {
  return value == null || !Number.isFinite(value)
    ? 'unknown'
    : `${Math.round(value)}%`
}

type ReturnNaturePresentation = {
  label: string
  color: string
  dashArray?: string
  filled: boolean
}

function returnNaturePresentation(
  nature: ToolImpactReturnNature,
): ReturnNaturePresentation {
  if (nature === 'meta_reported_action_value') {
    return {
      label: plainStatus('returnNature', 'meta_reported_action_value').label,
      color: 'var(--viz-value)',
      filled: true,
    }
  }
  if (nature === 'configured_conversion_estimate') {
    return {
      label: plainStatus('returnNature', 'configured_conversion_estimate').label,
      color: 'var(--viz-estimate)',
      dashArray: '7 5',
      filled: false,
    }
  }
  if (nature === 'no_attributed_return') {
    return {
      label: plainStatus('returnNature', 'no_attributed_return').label,
      color: 'var(--viz-value)',
      filled: true,
    }
  }
  if (nature === 'mixed') {
    return {
      label: plainStatus('returnNature', 'mixed').label,
      color: 'var(--viz-estimate)',
      dashArray: '3 4',
      filled: false,
    }
  }
  if (nature === 'not_applicable') {
    return {
      label: plainStatus('returnNature', 'not_applicable').label,
      color: 'var(--viz-unknown)',
      dashArray: '3 4',
      filled: false,
    }
  }
  return {
    label: plainStatus('returnNature', 'unknown').label,
    color: 'var(--viz-unknown)',
    dashArray: '3 4',
    filled: false,
  }
}

function pointReturnPresentation(
  nature: ToolImpactReturnNature,
  productScoped: boolean,
): ReturnNaturePresentation {
  const base = returnNaturePresentation(nature)
  if (productScoped || nature === 'unknown' || nature === 'not_applicable') {
    return base
  }
  return {
    label: `${base.label} · not fully confirmed`,
    color: 'var(--viz-unknown)',
    dashArray: '3 4',
    filled: false,
  }
}

type DailyChartPoint = ToolImpactDailyPerformance['series'][number] & {
  at: number
  displayReturn: number
  productScoped: boolean
  nature: ToolImpactReturnNature
}

function splitConsecutiveDays<T extends { at: number }>(points: T[]): T[][] {
  const segments: T[][] = []
  let current: T[] = []
  for (const point of points) {
    const previous = current[current.length - 1]
    if (previous && point.at - previous.at !== DAY_MS) {
      segments.push(current)
      current = []
    }
    current.push(point)
  }
  if (current.length > 0) segments.push(current)
  return segments
}

/**
 * Day-wise portfolio evidence for the exact verified sales cohort. Missing
 * calendar dates are gaps, never invented zeroes. Persisted legacy value is
 * still visible, but provenance-specific labels and line styles prevent Meta
 * action value, configured estimates and unknown legacy value from blending.
 */
export function DailySpendValueChart({
  performance,
  title = 'Money spent and sales value, day by day',
  subtitle = 'Sales campaigns only, by the date Meta recorded',
  emptyHistoryLabel,
}: {
  performance?: ToolImpactDailyPerformance | null
  title?: string
  subtitle?: string
  emptyHistoryLabel?: string
}) {
  const [range, setRange] = useState<DailyRange>(30)
  const [activeDate, setActiveDate] = useState<string | null>(null)
  const chartShellRef = useRef<HTMLDivElement>(null)
  const [chartWidth, setChartWidth] = useState(760)

  useEffect(() => {
    const element = chartShellRef.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const update = () => setChartWidth(Math.max(300, element.clientWidth))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const allPoints = useMemo<DailyChartPoint[]>(() => {
    return [...(performance?.series ?? [])]
      .map((point) => {
        const at = dateKeyMs(point.date)
        if (at == null) return null
        const productScoped =
          point.returnCoverage === 'complete' &&
          point.attributedReturn != null &&
          Number.isFinite(point.attributedReturn)
        const nature = point.returnNature ?? 'unknown'
        return {
          ...point,
          at,
          spend: Math.max(0, Number(point.spend) || 0),
          displayReturn: Math.max(
            0,
            Number(
              productScoped
                ? point.attributedReturn
                : point.persistedAttributedReturn,
            ) || 0,
          ),
          productScoped,
          nature,
        }
      })
      .filter((point): point is DailyChartPoint => point != null)
      .sort((a, b) => a.at - b.at)
  }, [performance])

  const lastObservedAt = allPoints[allPoints.length - 1]?.at ?? null
  const visiblePoints = useMemo(() => {
    if (lastObservedAt == null || range === 'all') return allPoints
    const cutoff = lastObservedAt - (range - 1) * DAY_MS
    return allPoints.filter((point) => point.at >= cutoff)
  }, [allPoints, lastObservedAt, range])

  if (!performance) {
    return (
      <div className="card overflow-hidden">
        <DailyChartHeader
          range={range}
          onRangeChange={setRange}
          title={title}
          subtitle={subtitle}
        />
        <ChartEmpty
          title="Day-by-day figures not available"
          label="Day-by-day figures are not available yet."
        />
      </div>
    )
  }

  if (performance.coverage.eligibleCampaigns === 0) {
    return (
      <div className="card overflow-hidden">
        <DailyChartHeader
          range={range}
          onRangeChange={setRange}
          title={title}
          subtitle={subtitle}
        />
        <ChartEmpty
          title="No sales campaigns yet"
          label="Day-by-day results appear once a sales campaign goes live."
        />
      </div>
    )
  }

  if (allPoints.length === 0) {
    return (
      <div className="card overflow-hidden">
        <DailyChartHeader
          range={range}
          onRangeChange={setRange}
          title={title}
          subtitle={subtitle}
        />
        <ChartEmpty
          title="No daily figures yet"
          label={
            emptyHistoryLabel ??
            `${performance.coverage.eligibleCampaigns} sales campaign${performance.coverage.eligibleCampaigns === 1 ? '' : 's'} ${performance.coverage.eligibleCampaigns === 1 ? 'has' : 'have'} no daily figures saved yet.`
          }
        />
      </div>
    )
  }

  const mobile = chartWidth < 560
  const height = mobile ? 260 : 300
  const margin = {
    top: 16,
    right: mobile ? 12 : 18,
    bottom: 38,
    left: mobile ? 48 : 62,
  }
  const plotWidth = Math.max(1, chartWidth - margin.left - margin.right)
  const plotHeight = height - margin.top - margin.bottom
  const firstObservedAt = visiblePoints[0]?.at ?? lastObservedAt ?? 0
  const requestedDomainStart =
    range === 'all' || lastObservedAt == null
      ? firstObservedAt
      : lastObservedAt - (range - 1) * DAY_MS
  const requestedDomainEnd = lastObservedAt ?? firstObservedAt
  const domainStart =
    requestedDomainStart === requestedDomainEnd
      ? requestedDomainStart - DAY_MS / 2
      : requestedDomainStart
  const domainEnd =
    requestedDomainStart === requestedDomainEnd
      ? requestedDomainEnd + DAY_MS / 2
      : requestedDomainEnd
  const domainSpan = domainEnd - domainStart
  const xFor = (at: number) =>
    margin.left + ((at - domainStart) / domainSpan) * plotWidth
  const largestValue = Math.max(
    0,
    ...visiblePoints.flatMap((point) => [point.spend, point.displayReturn]),
  )
  const yMaximum = niceMaximum(largestValue * 1.08)
  const yFor = (value: number) =>
    margin.top + plotHeight - (Math.max(0, value) / yMaximum) * plotHeight
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    value: yMaximum * ratio,
    y: margin.top + plotHeight * (1 - ratio),
  }))
  const maximumXTicks = mobile ? 4 : 7
  const xTickCount = Math.min(maximumXTicks, visiblePoints.length)
  const xTickIndexes = [
    ...new Set(
      Array.from(
        { length: xTickCount },
        (_, index) =>
          Math.round(
            (index / Math.max(1, xTickCount - 1)) *
              (visiblePoints.length - 1),
          ),
      ),
    ),
  ]
  const consecutiveSegments = splitConsecutiveDays(visiblePoints)
  const pathFor = (
    segment: DailyChartPoint[],
    selector: (point: DailyChartPoint) => number,
  ) =>
    segment
      .map(
        (point, index) =>
          `${index === 0 ? 'M' : 'L'} ${xFor(point.at).toFixed(2)} ${yFor(selector(point)).toFixed(2)}`,
      )
      .join(' ')
  const activePoint = visiblePoints.find((point) => point.date === activeDate)
  const visibleReturnNatures = [
    ...new Set(visiblePoints.map((point) => point.nature)),
  ]
  const rangeReturnNature: ToolImpactReturnNature =
    visibleReturnNatures.length === 1 ? visibleReturnNatures[0] : 'mixed'
  const rangeProductScoped = visiblePoints.every((point) => point.productScoped)
  const rangeReturnPresentation = pointReturnPresentation(
    rangeReturnNature,
    rangeProductScoped,
  )
  const selectedSpend = visiblePoints.reduce(
    (total, point) => total + point.spend,
    0,
  )
  const selectedAttributedValue = visiblePoints.reduce(
    (total, point) => total + point.displayReturn,
    0,
  )
  const totalRows =
    performance.returnCoverage.trustedRows +
    performance.returnCoverage.untrustedRows
  const basisSummary = (performance.returnCoverage.byBasis ?? [])
    .filter((entry) => entry.rowCount > 0)
    .map((entry) => `${returnBasisLabel(entry.basis)}: ${entry.rowCount} days`)
    .join(' · ')
  const spendReconciles =
    performance.coverage.spendCoveragePct != null &&
    Math.abs(
      performance.coverage.observedSpend - performance.coverage.lifetimeSpend,
    ) <= Math.max(1, performance.coverage.lifetimeSpend * 0.01)
  const spendReconciliationLabel =
    performance.coverage.spendCoveragePct == null
      ? 'Not sure the daily spend adds up'
      : spendReconciles
        ? 'Daily spend adds up to the total'
        : 'Daily spend does not add up to the total'

  return (
    <div className="card overflow-hidden">
      <DailyChartHeader
        range={range}
        onRangeChange={setRange}
        title={title}
        subtitle={subtitle}
      />

      <div className="px-4 sm:px-5 pt-3 flex items-center gap-x-4 gap-y-2 flex-wrap explain">
        <span className="micro-label">
          Up to{' '}
          {shortDate(visiblePoints[visiblePoints.length - 1]?.date ?? '')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block rounded-full"
            style={{ width: 20, height: 3, background: 'var(--viz-spend)' }}
          />
          Spend{' '}
          <strong className="mono" style={{ color: 'var(--ink)' }}>
            {formatInr(selectedSpend)}
          </strong>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="20" height="6" aria-hidden="true">
            <line
              x1="0"
              y1="3"
              x2="20"
              y2="3"
              stroke={rangeReturnPresentation.color}
              strokeWidth="3"
              strokeDasharray={rangeReturnPresentation.dashArray}
            />
          </svg>
          {rangeReturnPresentation.label}{' '}
          <strong className="mono" style={{ color: 'var(--ink)' }}>
            {formatInr(selectedAttributedValue)}
          </strong>
        </span>
        <span
          className={
            rangeReturnNature === 'meta_reported_action_value' &&
            rangeProductScoped
              ? 'chip chip-accent ml-auto'
              : rangeReturnNature === 'no_attributed_return' &&
                  rangeProductScoped
                ? 'chip chip-bad ml-auto'
              : 'chip chip-warn ml-auto'
          }
          title={performance.returnCoverage.warning ?? undefined}
        >
          {rangeReturnPresentation.label}
        </span>
      </div>

      <div ref={chartShellRef} className="px-1 sm:px-3 pb-1">
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${chartWidth} ${height}`}
          className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          role="group"
          tabIndex={0}
          aria-label={`Daily campaign performance from ${shortDate(visiblePoints[0]?.date ?? '')} to ${shortDate(visiblePoints[visiblePoints.length - 1]?.date ?? '')}. ${performance.coverage.campaignsWithRows} of ${performance.coverage.eligibleCampaigns} sales campaigns have daily figures.`}
          onFocus={() =>
            setActiveDate(
              (current) =>
                current ?? visiblePoints[visiblePoints.length - 1]?.date ?? null,
            )
          }
          onBlur={() => setActiveDate(null)}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
            event.preventDefault()
            const currentIndex = visiblePoints.findIndex(
              (point) => point.date === activeDate,
            )
            const startIndex = currentIndex >= 0 ? currentIndex : visiblePoints.length - 1
            const nextIndex = Math.max(
              0,
              Math.min(
                visiblePoints.length - 1,
                startIndex + (event.key === 'ArrowLeft' ? -1 : 1),
              ),
            )
            setActiveDate(visiblePoints[nextIndex]?.date ?? null)
          }}
          onMouseLeave={() => setActiveDate(null)}
        >
          {yTicks.map((tick) => (
            <g key={tick.value}>
              <line
                x1={margin.left}
                y1={tick.y}
                x2={chartWidth - margin.right}
                y2={tick.y}
                stroke="var(--viz-grid)"
                strokeWidth="1"
              />
              <text
                x={margin.left - 8}
                y={tick.y + 4}
                textAnchor="end"
                fontSize={mobile ? 10 : 11}
                fill="var(--ink-3)"
              >
                {compactCurrency(tick.value)}
              </text>
            </g>
          ))}

          {xTickIndexes.map((pointIndex) => {
            const point = visiblePoints[pointIndex]
            return (
              <text
                key={point.date}
                x={xFor(point.at)}
                y={height - 12}
                textAnchor={
                  pointIndex === 0
                    ? 'start'
                    : pointIndex === visiblePoints.length - 1
                      ? 'end'
                      : 'middle'
                }
                fontSize={mobile ? 10 : 11}
                fill="var(--ink-3)"
              >
                {shortDate(point.date)}
              </text>
            )
          })}

          {consecutiveSegments.map((segment) =>
            segment.length > 1 ? (
              <path
                key={`spend-${segment[0].date}`}
                d={pathFor(segment, (point) => point.spend)}
                fill="none"
                stroke="var(--viz-spend)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null,
          )}

          {visiblePoints.slice(1).map((point, index) => {
            const previous = visiblePoints[index]
            if (point.at - previous.at !== DAY_MS) return null
            const segmentNature: ToolImpactReturnNature =
              point.nature === previous.nature ? point.nature : 'mixed'
            const presentation = pointReturnPresentation(
              segmentNature,
              point.productScoped && previous.productScoped,
            )
            return (
              <line
                key={`return-${previous.date}-${point.date}`}
                x1={xFor(previous.at)}
                y1={yFor(previous.displayReturn)}
                x2={xFor(point.at)}
                y2={yFor(point.displayReturn)}
                stroke={presentation.color}
                strokeWidth="2.75"
                strokeLinecap="round"
                strokeDasharray={presentation.dashArray}
              />
            )
          })}

          {visiblePoints.map((point) => (
            <g key={`points-${point.date}`} pointerEvents="none">
              <circle
                cx={xFor(point.at)}
                cy={yFor(point.spend)}
                r={activePoint?.date === point.date ? 5 : 3.5}
                fill="var(--viz-spend)"
                stroke="var(--surface)"
                strokeWidth="1.5"
              />
              {(() => {
                const presentation = pointReturnPresentation(
                  point.nature,
                  point.productScoped,
                )
                return (
                  <circle
                    cx={xFor(point.at)}
                    cy={yFor(point.displayReturn)}
                    r={activePoint?.date === point.date ? 5.5 : 4}
                    fill={
                      presentation.filled
                        ? presentation.color
                        : 'var(--surface)'
                    }
                    stroke={presentation.color}
                    strokeWidth={presentation.filled ? 1.5 : 2}
                  />
                )
              })()}
            </g>
          ))}

          {visiblePoints.map((point, index) => {
            const x = xFor(point.at)
            const previousX =
              index === 0 ? margin.left : xFor(visiblePoints[index - 1].at)
            const nextX =
              index === visiblePoints.length - 1
                ? chartWidth - margin.right
                : xFor(visiblePoints[index + 1].at)
            const left = index === 0 ? margin.left : (previousX + x) / 2
            const right =
              index === visiblePoints.length - 1
                ? chartWidth - margin.right
                : (x + nextX) / 2
            const valueLabel = `${pointReturnPresentation(point.nature, point.productScoped).label} ${formatInr(point.displayReturn)}`
            return (
              <rect
                key={`hit-${point.date}`}
                x={left}
                y={margin.top}
                width={Math.max(1, right - left)}
                height={plotHeight}
                fill="transparent"
                aria-label={`${longDate(point.date)}: spend ${formatInr(point.spend)}, ${valueLabel}`}
                onMouseEnter={() => setActiveDate(point.date)}
                onPointerDown={() => setActiveDate(point.date)}
              />
            )
          })}

          {activePoint && (
            <DailyPointTooltip
              point={activePoint}
              x={xFor(activePoint.at)}
              y={Math.min(
                yFor(activePoint.spend),
                yFor(activePoint.displayReturn),
              )}
              chartWidth={chartWidth}
              chartHeight={height}
              margin={margin}
            />
          )}
        </svg>
        <p className="sr-only" aria-live="polite">
          {activePoint
            ? `${longDate(activePoint.date)}. Spend ${formatInr(activePoint.spend)}. ${pointReturnPresentation(activePoint.nature, activePoint.productScoped).label} ${formatInr(activePoint.displayReturn)}.`
            : ''}
        </p>
      </div>

      <div
        className="px-4 sm:px-5 py-3 explain flex items-center justify-between gap-x-4 gap-y-1 flex-wrap"
        style={{ borderTop: '1px solid var(--hairline-light)' }}
      >
        <span>
          {performance.coverage.campaignsWithRows} of{' '}
          {performance.coverage.eligibleCampaigns} campaigns have daily figures (
          {plainStatus('coverage', performance.coverage.status).label.toLowerCase()})
        </span>
        <span>
          {spendReconciliationLabel} ·{' '}
          {formatInr(performance.coverage.observedSpend)} by day of{' '}
          {formatInr(performance.coverage.lifetimeSpend)}{' '}
          in total ({percentLabel(performance.coverage.spendCoveragePct)})
        </span>
        <span>
          {performance.returnCoverage.trustedRows} of {totalRows} days have confirmed
          sales value{basisSummary ? ` · ${basisSummary}` : ''}
        </span>
      </div>
    </div>
  )
}

function DailyChartHeader({
  range,
  onRangeChange,
  title,
  subtitle,
}: {
  range: DailyRange
  onRangeChange: (range: DailyRange) => void
  title: string
  subtitle: string
}) {
  return (
    <div
      className="px-4 sm:px-5 py-4 flex items-center justify-between gap-3 flex-wrap"
      style={{ borderBottom: '1px solid var(--hairline)' }}
    >
      <div>
        <h3 className="font-semibold" style={{ color: 'var(--ink)' }}>
          {title}
        </h3>
        <p className="explain mt-1">{subtitle}</p>
      </div>
      <div
        className="inline-flex rounded-lg p-0.5"
        style={{
          background: 'var(--surface-warm)',
          border: '1px solid var(--hairline)',
        }}
        aria-label="How many days to show"
        role="group"
      >
        {DAILY_RANGES.map((option) => (
          <button
            key={option.label}
            type="button"
            onClick={() => onRangeChange(option.value)}
            aria-pressed={range === option.value}
            className="px-2.5 py-1.5 rounded-md text-xs font-semibold"
            style={{
              background:
                range === option.value ? 'var(--surface)' : 'transparent',
              color:
                range === option.value
                  ? 'var(--accent-strong)'
                  : 'var(--ink-3)',
              boxShadow:
                range === option.value ? 'var(--shadow-soft)' : 'none',
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function DailyPointTooltip({
  point,
  x,
  y,
  chartWidth,
  chartHeight,
  margin,
}: {
  point: DailyChartPoint
  x: number
  y: number
  chartWidth: number
  chartHeight: number
  margin: { top: number; right: number; bottom: number; left: number }
}) {
  const presentation = pointReturnPresentation(
    point.nature,
    point.productScoped,
  )
  const tooltipNatureLabel = !point.productScoped
    ? point.nature === 'meta_reported_action_value'
      ? 'Sales value from Meta · not fully confirmed'
      : point.nature === 'configured_conversion_estimate'
        ? 'Estimated sales value · not fully confirmed'
        : 'Sales value · not fully confirmed'
    : point.nature === 'configured_conversion_estimate'
      ? 'Number of sales × a set price (estimate)'
      : point.nature === 'no_attributed_return'
        ? 'Meta recorded no sales'
        : plainStatus('returnNature', point.nature).label
  const tooltipWidth = chartWidth < 480 ? 210 : 232
  const tooltipHeight = 112
  const tooltipX = Math.max(
    margin.left,
    Math.min(
      chartWidth - margin.right - tooltipWidth,
      x < chartWidth / 2 ? x + 12 : x - tooltipWidth - 12,
    ),
  )
  const tooltipY = Math.max(margin.top + 4, y - tooltipHeight - 10)
  const labelX = tooltipX + 12
  const valueX = tooltipX + tooltipWidth - 12

  return (
    <g pointerEvents="none">
      <line
        x1={x}
        y1={margin.top}
        x2={x}
        y2={chartHeight - margin.bottom}
        stroke="var(--ink-3)"
        strokeWidth="1"
        strokeDasharray="3 4"
      />
      <rect
        x={tooltipX}
        y={tooltipY}
        width={tooltipWidth}
        height={tooltipHeight}
        rx="9"
        fill="var(--surface)"
        stroke="var(--hairline)"
      />
      <text
        x={labelX}
        y={tooltipY + 18}
        fontSize="11"
        fontWeight="600"
        fill="var(--ink)"
      >
        {longDate(point.date)}
      </text>
      <text x={labelX} y={tooltipY + 39} fontSize="11" fill="var(--ink-3)">
        Spend
      </text>
      <text
        x={valueX}
        y={tooltipY + 39}
        textAnchor="end"
        fontSize="11"
        fontWeight="600"
        fill="var(--ink)"
      >
        {formatInr(point.spend)}
      </text>
      <text x={labelX} y={tooltipY + 58} fontSize="11" fill="var(--ink-3)">
        {point.nature === 'configured_conversion_estimate'
          ? 'Estimated sales'
          : 'Sales value'}
      </text>
      <text
        x={valueX}
        y={tooltipY + 58}
        textAnchor="end"
        fontSize="11"
        fontWeight="600"
        fill={presentation.color}
      >
        {formatInr(point.displayReturn)}
      </text>
      <text x={labelX} y={tooltipY + 78} fontSize="11" fill="var(--ink-3)">
        Return on ad spend
      </text>
      <text
        x={valueX}
        y={tooltipY + 78}
        textAnchor="end"
        fontSize="11"
        fontWeight="600"
        fill="var(--ink)"
      >
        {point.weightedRoas == null
          ? '—'
          : formatActionValueRoas(point.weightedRoas)}
      </text>
      <text
        x={labelX}
        y={tooltipY + 98}
        fontSize="10"
        fill={presentation.color}
      >
        {tooltipNatureLabel}
      </text>
    </g>
  )
}

function fullNumber(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value)
}

function compactNumber(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function healthColor(
  health: 'good' | 'watch' | 'bad' | 'neutral',
): string {
  if (health === 'good') return 'var(--good)'
  if (health === 'watch') return 'var(--warn)'
  if (health === 'bad') return 'var(--bad)'
  return 'var(--ink)'
}

function campaignAsSalesPerformance(
  campaign: ToolImpactCampaignDailyPerformance,
  lifetimeReturn: number,
): ToolImpactDailyPerformance {
  const trustedRows = campaign.returnCoverage.trustedRows
  const untrustedRows = campaign.returnCoverage.untrustedRows
  const hasRows = campaign.series.length > 0
  const persistedReturn = campaign.series.reduce(
    (total, point) => total + point.persistedAttributedReturn,
    0,
  )

  return {
    source: 'metric_timeseries_campaign_daily',
    dateBasis: 'meta_ad_account_date_start',
    cohort: 'verified_sales_launches',
    calculationVersion: 'product_scoped_v1',
    coverage: {
      status: campaign.coverage.status,
      eligibleCampaigns: 1,
      campaignsWithRows: hasRows ? 1 : 0,
      campaignsWithoutRows: hasRows ? 0 : 1,
      observedDates: campaign.coverage.observedDates,
      campaignDateRows: campaign.coverage.campaignDateRows,
      firstDate: campaign.coverage.firstDate,
      lastDate: campaign.coverage.lastDate,
      observedSpend: campaign.coverage.observedSpend,
      lifetimeSpend: campaign.coverage.lifetimeSpend,
      spendCoveragePct: campaign.coverage.spendCoveragePct,
      observedPersistedAttributedReturn: persistedReturn,
      lifetimeAttributedReturn: lifetimeReturn,
    },
    returnCoverage: {
      status:
        campaign.returnCoverage.status === 'not_applicable'
          ? 'none'
          : campaign.returnCoverage.status,
      trustedRows,
      untrustedRows,
      campaignsWithTrustedRows: trustedRows > 0 ? 1 : 0,
      legacyRowsExcludedFromReturn:
        campaign.returnCoverage.legacyRowsExcludedFromReturn,
      returnBasis: campaign.returnCoverage.returnBasis,
      returnNature: campaign.returnCoverage.returnNature,
      byBasis: campaign.returnCoverage.byBasis,
      warning: campaign.returnCoverage.warning,
    },
    series: campaign.series.map((point) => ({
      date: point.date,
      spend: point.spend,
      attributedReturn: point.attributedReturn,
      knownAttributedReturn: point.knownAttributedReturn,
      persistedAttributedReturn: point.persistedAttributedReturn,
      weightedRoas: point.rawRoas,
      campaignsReporting: 1,
      trustedReturnCampaigns:
        point.returnCoverage === 'complete' ? 1 : 0,
      returnCoverage:
        point.returnCoverage === 'complete'
          ? 'complete'
          : point.returnCoverage === 'partial'
            ? 'partial'
            : 'none',
      returnBasis: point.returnBasis,
      returnNature: point.returnNature,
    })),
    byCampaign: [],
  }
}

function CampaignMetric({
  label,
  value,
  sub,
  color = 'var(--ink)',
}: {
  label: string
  value: string
  sub: string
  color?: string
}) {
  return (
    <div className="card-inset px-3.5 py-3 min-w-0">
      <p className="micro-label truncate">{label}</p>
      <p
        className="mono text-xl sm:text-2xl font-semibold mt-1 truncate"
        style={{ color }}
        title={value}
      >
        {value}
      </p>
      <p className="explain mt-1 truncate" title={sub}>
        {sub}
      </p>
    </div>
  )
}

/**
 * A campaign selector plus objective-aware day-wise evidence. Sales shows
 * spend against attributed value; every other objective shows the exact
 * stored result metric (or the backend-labelled objective proxy) on its own
 * axis so counts and rupees are never compared as if they shared a unit.
 */
export function CampaignDailyDrilldown({
  performance,
  campaigns,
  tenantId,
}: {
  performance?: ToolImpactDailyPerformance | null
  campaigns: DashboardCampaignRow[]
  tenantId: string
}) {
  const entries = useMemo(
    () =>
      [...(performance?.byCampaign ?? [])].sort(
        (a, b) =>
          b.coverage.lifetimeSpend - a.coverage.lifetimeSpend ||
          a.displayName.localeCompare(b.displayName),
      ),
    [performance],
  )
  const [requestedCampaignId, setRequestedCampaignId] = useState<string | null>(
    null,
  )
  const selected =
    entries.find((entry) => entry.campaignId === requestedCampaignId) ??
    entries[0]

  if (!selected) {
    return (
      <div className="card overflow-hidden mt-4">
        <ChartEmpty
          title="No single-campaign history yet"
          label="Day-by-day figures for each campaign are not available yet."
        />
      </div>
    )
  }

  const campaign = campaigns.find((row) => row.id === selected.campaignId)
  const observedResultValues = selected.series
    .map((point) => point.objectiveResult.value)
    .filter(
      (value): value is number => value != null && Number.isFinite(value),
    )
  const resultDaysWithData = observedResultValues.length
  const resultDataPartial = resultDaysWithData < selected.series.length
  const resultIsDailyReach = selected.resultMetric.key === 'reach'
  const observedResult =
    observedResultValues.length === 0
      ? null
      : resultIsDailyReach
        ? Math.max(...observedResultValues)
        : observedResultValues.reduce((total, value) => total + value, 0)
  const observedReturn = selected.series.reduce(
    (total, point) => total + point.persistedAttributedReturn,
    0,
  )
  const observedClicks = selected.series.reduce(
    (total, point) => total + point.clicks,
    0,
  )
  const observedImpressions = selected.series.reduce(
    (total, point) => total + point.impressions,
    0,
  )
  const observedCtr =
    observedImpressions > 0 ? (observedClicks / observedImpressions) * 100 : null
  const observedCostPerResult =
    !resultIsDailyReach &&
    !resultDataPartial &&
    observedResult != null &&
    observedResult > 0
      ? selected.coverage.observedSpend / observedResult
      : null
  const lifetimeReturn = campaign?.revenue ?? observedReturn
  const rawRoas = campaign?.roas ?? selected.primaryKpi.value
  const hasLifetimeSpend = selected.coverage.lifetimeSpend > 0
  const salesBasisLabel = campaign
    ? returnBasisLabel(campaign.revenueBasis)
    : 'Sales value'
  const resolvedSalesValue = campaign ? isResolvedMetaValue(campaign) : false
  const modeledSalesValue =
    campaign?.revenueBasis === 'configured_conversion_value'
  const unknownSalesValue = campaign ? hasUnknownReturn(campaign) : true
  const knownZeroSalesValue =
    campaign?.revenueBasis === 'no_attributed_revenue' &&
    campaign.revenueAttributionSource !== 'unknown' &&
    campaign.revenueAttributionSource !== 'unresolved' &&
    campaign.revenueAttributionSource !== 'account_fallback'
  const knownSalesValue = resolvedSalesValue || knownZeroSalesValue
  const displayableSalesValue = knownSalesValue || modeledSalesValue
  const rawRoasColor =
    !hasLifetimeSpend
      ? 'var(--ink)'
      : modeledSalesValue
        ? 'var(--warn)'
        : unknownSalesValue || !knownSalesValue
          ? 'var(--ink-3)'
          : rawRoas >= 1
            ? 'var(--good)'
            : 'var(--bad)'
  const resultSourceLabel =
    selected.resultMetric.source === 'goal_selected_metric'
      ? 'Measured against the campaign goal'
      : 'Closest match to the campaign goal'
  const salesPerformance = selected.isRevenueObjective
    ? campaignAsSalesPerformance(selected, lifetimeReturn)
    : null

  return (
    <div className="mt-4 space-y-3">
      <div className="card px-4 sm:px-5 py-4">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <label
              htmlFor="campaign-performance-selector"
              className="micro-label block mb-2"
            >
              Pick a campaign
            </label>
            <select
              id="campaign-performance-selector"
              value={selected.campaignId}
              onChange={(event) => setRequestedCampaignId(event.target.value)}
              className="input w-full max-w-2xl"
            >
              {entries.map((entry) => (
                <option key={entry.campaignId} value={entry.campaignId}>
                  {entry.displayName} · {entry.objectiveLabel} ·{' '}
                  {formatInr(entry.coverage.lifetimeSpend)}
                </option>
              ))}
            </select>
          </div>
          <Link
            href={`/dashboard/${tenantId}/campaigns/${selected.campaignId}`}
            className="btn btn-ghost shrink-0"
          >
            Open campaign
          </Link>
        </div>

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="chip chip-accent">{selected.objectiveLabel}</span>
          <span className="chip chip-neutral">{selected.resultMetric.label}</span>
          {!selected.isRevenueObjective && (
            <span
              className={
                selected.resultMetric.source === 'goal_selected_metric'
                  ? 'chip chip-neutral'
                  : 'chip chip-warn'
              }
              title={
                selected.resultMetric.optimizationGoal
                  ? `Meta is aiming for: ${humanise(selected.resultMetric.optimizationGoal)}`
                  : undefined
              }
            >
              {resultSourceLabel}
            </span>
          )}
          <span className="chip chip-neutral">
            {selected.coverage.observedDates} day
            {selected.coverage.observedDates === 1 ? '' : 's'} of figures
          </span>
          <span
            className={
              campaign?.isStale || !campaign?.dataAsOf
                ? 'chip chip-warn'
                : 'chip chip-neutral'
            }
            title={campaign?.dataAsOf ? `Figures as of ${formatWhen(campaign.dataAsOf)}` : 'We do not know when these figures were last updated'}
          >
            {campaign?.dataAsOf
              ? `${campaign.isStale ? 'Figures out of date' : 'Figures updated'} · ${formatRelative(campaign.dataAsOf)}`
              : 'Last update unknown'}
          </span>
          {selected.coverage.warning && selected.series.length > 0 && (
            <span className="chip chip-warn" title={selected.coverage.warning}>
              Some days missing
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 mt-4">
          <CampaignMetric
            label="Total spent"
            value={formatInr(selected.coverage.lifetimeSpend)}
            sub={`${percentLabel(selected.coverage.spendCoveragePct)} of it shown day by day`}
          />
          {selected.isRevenueObjective ? (
            <>
              <CampaignMetric
                label={modeledSalesValue ? 'Estimated sales value' : 'Sales value'}
                value={unknownSalesValue || !displayableSalesValue
                  ? 'Unavailable'
                  : formatInr(lifetimeReturn)}
                sub={salesBasisLabel}
                color={
                  modeledSalesValue
                    ? 'var(--warn)'
                    : knownZeroSalesValue && hasLifetimeSpend
                      ? 'var(--bad)'
                      : undefined
                }
              />
              <CampaignMetric
                label="Return on ad spend"
                value={!hasLifetimeSpend
                  ? '—'
                  : unknownSalesValue || !displayableSalesValue
                    ? 'Unavailable'
                    : formatActionValueRoas(rawRoas)}
                sub={
                  hasLifetimeSpend && displayableSalesValue && !unknownSalesValue
                    ? `${salesBasisLabel} · 1.00x means it broke even`
                    : hasLifetimeSpend
                      ? 'Sales value source unclear'
                      : 'No spend'
                }
                color={rawRoasColor}
              />
              <CampaignMetric
                label={selected.resultMetric.label}
                value={
                  observedResult == null
                    ? '—'
                    : selected.resultMetric.key === 'attributedReturn'
                      ? formatInr(observedResult)
                      : fullNumber(observedResult)
                }
                sub={
                  observedResult == null
                    ? 'Not available'
                    : resultDataPartial
                      ? `${resultDaysWithData} of ${selected.series.length} days have figures`
                      : resultSourceLabel
                }
              />
            </>
          ) : (
            <>
              <CampaignMetric
                label={selected.primaryKpi.label}
                value={selected.primaryKpi.display}
                sub={selected.primaryKpi.targetDisplay ? `Target ${selected.primaryKpi.targetDisplay}` : 'No target set'}
                color={healthColor(selected.primaryKpi.status)}
              />
              <CampaignMetric
                label={`${resultIsDailyReach ? 'Best day: ' : ''}${selected.resultMetric.label}`}
                value={observedResult == null ? '—' : fullNumber(observedResult)}
                sub={
                  observedResult == null
                    ? 'Not available'
                    : resultIsDailyReach
                      ? 'The same people can be counted on several days'
                      : resultDataPartial
                        ? `${resultDaysWithData} of ${selected.series.length} days have figures`
                        : `Over ${selected.coverage.observedDates} days`
                }
              />
              <CampaignMetric
                label="Cost per result"
                value={
                  observedCostPerResult == null
                    ? '—'
                    : costInr(observedCostPerResult)
                }
                sub={
                  observedCostPerResult == null
                    ? resultIsDailyReach
                      ? 'Reach cannot be added up across days'
                      : observedResult == null
                        ? 'Not available'
                        : resultDataPartial
                          ? 'Not shown — some days are missing'
                        : 'No results yet'
                    : `${resultSourceLabel}${
                        (selected.objectiveKey === 'traffic' ||
                          selected.objectiveKey === 'engagement') &&
                        observedCtr != null
                          ? ` · click rate ${observedCtr.toFixed(2)}%`
                          : ''
                      }`
                }
              />
            </>
          )}
        </div>
      </div>

      {selected.isRevenueObjective ? (
        <DailySpendValueChart
          key={selected.campaignId}
          performance={salesPerformance}
          title="Money spent and sales value, day by day"
          subtitle={`${selected.objectiveLabel} · ${selected.displayName}`}
          emptyHistoryLabel={
            selected.coverage.warning ??
            'This campaign is live, but no daily figures are saved yet.'
          }
        />
      ) : (
        <ObjectiveDailyChart key={selected.campaignId} campaign={selected} />
      )}
    </div>
  )
}

type ObjectiveChartPoint =
  ToolImpactCampaignDailyPerformance['series'][number] & {
    at: number
    result: number | null
  }

type ObjectiveResultPoint = ObjectiveChartPoint & { result: number }

function ObjectiveDailyChart({
  campaign,
}: {
  campaign: ToolImpactCampaignDailyPerformance
}) {
  const [range, setRange] = useState<DailyRange>(30)
  const [activeDate, setActiveDate] = useState<string | null>(null)
  const chartShellRef = useRef<HTMLDivElement>(null)
  const [chartWidth, setChartWidth] = useState(760)

  useEffect(() => {
    const element = chartShellRef.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const update = () => setChartWidth(Math.max(300, element.clientWidth))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const allPoints = useMemo<ObjectiveChartPoint[]>(
    () =>
      campaign.series
        .map((point) => {
          const at = dateKeyMs(point.date)
          if (at == null) return null
          return {
            ...point,
            at,
            spend: Math.max(0, Number(point.spend) || 0),
            result:
              point.objectiveResult.value == null ||
              !Number.isFinite(point.objectiveResult.value)
                ? null
                : Math.max(0, point.objectiveResult.value),
          }
        })
        .filter((point): point is ObjectiveChartPoint => point != null)
        .sort((a, b) => a.at - b.at),
    [campaign],
  )
  const lastObservedAt = allPoints[allPoints.length - 1]?.at ?? null
  const visiblePoints = useMemo(() => {
    if (lastObservedAt == null || range === 'all') return allPoints
    const cutoff = lastObservedAt - (range - 1) * DAY_MS
    return allPoints.filter((point) => point.at >= cutoff)
  }, [allPoints, lastObservedAt, range])

  if (allPoints.length === 0) {
    return (
      <div className="card overflow-hidden">
        <DailyChartHeader
          range={range}
          onRangeChange={setRange}
          title={`Money spent and ${campaign.resultMetric.label.toLowerCase()}, day by day`}
          subtitle={`${campaign.objectiveLabel} · no daily figures yet`}
        />
        <ChartEmpty
          title="No daily figures yet"
          label={
            campaign.coverage.warning ??
            'This campaign is live, but no daily figures are saved yet.'
          }
        />
      </div>
    )
  }

  const mobile = chartWidth < 560
  const height = mobile ? 260 : 300
  const margin = {
    top: 16,
    right: mobile ? 48 : 64,
    bottom: 38,
    left: mobile ? 48 : 62,
  }
  const plotWidth = Math.max(1, chartWidth - margin.left - margin.right)
  const plotHeight = height - margin.top - margin.bottom
  const firstObservedAt = visiblePoints[0]?.at ?? lastObservedAt ?? 0
  const requestedStart =
    range === 'all' || lastObservedAt == null
      ? firstObservedAt
      : lastObservedAt - (range - 1) * DAY_MS
  const requestedEnd = lastObservedAt ?? firstObservedAt
  const domainStart =
    requestedStart === requestedEnd ? requestedStart - DAY_MS / 2 : requestedStart
  const domainEnd =
    requestedStart === requestedEnd ? requestedEnd + DAY_MS / 2 : requestedEnd
  const xFor = (at: number) =>
    margin.left +
    ((at - domainStart) / Math.max(1, domainEnd - domainStart)) * plotWidth
  const spendMaximum = niceMaximum(
    Math.max(0, ...visiblePoints.map((point) => point.spend)) * 1.08,
  )
  const resultMaximum = niceMaximum(
    Math.max(
      0,
      ...visiblePoints.map((point) => point.result).filter((value) => value != null),
    ) * 1.08,
  )
  const spendY = (value: number) =>
    margin.top + plotHeight - (Math.max(0, value) / spendMaximum) * plotHeight
  const resultY = (value: number) =>
    margin.top + plotHeight - (Math.max(0, value) / resultMaximum) * plotHeight
  const ratios = [0, 0.25, 0.5, 0.75, 1]
  const xTickCount = Math.min(mobile ? 4 : 7, visiblePoints.length)
  const xTickIndexes = [
    ...new Set(
      Array.from({ length: xTickCount }, (_, index) =>
        Math.round(
          (index / Math.max(1, xTickCount - 1)) * (visiblePoints.length - 1),
        ),
      ),
    ),
  ]
  const segments = splitConsecutiveDays(visiblePoints)
  const resultPoints = visiblePoints.filter(
    (point): point is ObjectiveResultPoint => point.result != null,
  )
  const resultSegments = splitConsecutiveDays(resultPoints)
  const pathFor = (
    segment: ObjectiveChartPoint[],
    selector: (point: ObjectiveChartPoint) => number,
    yFor: (value: number) => number,
  ) =>
    segment
      .map(
        (point, index) =>
          `${index === 0 ? 'M' : 'L'} ${xFor(point.at).toFixed(2)} ${yFor(selector(point)).toFixed(2)}`,
      )
      .join(' ')
  const activePoint = visiblePoints.find((point) => point.date === activeDate)
  const selectedSpend = visiblePoints.reduce(
    (total, point) => total + point.spend,
    0,
  )
  const resultIsDailyReach = campaign.resultMetric.key === 'reach'
  const selectedResult =
    resultPoints.length === 0
      ? null
      : resultIsDailyReach
        ? Math.max(...resultPoints.map((point) => point.result))
        : resultPoints.reduce((total, point) => total + point.result, 0)
  const selectedCost =
    !resultIsDailyReach &&
    resultPoints.length === visiblePoints.length &&
    selectedResult != null &&
    selectedResult > 0
      ? selectedSpend / selectedResult
      : null
  const sourceLabel =
    campaign.resultMetric.source === 'goal_selected_metric'
      ? 'Measured against the campaign goal'
      : 'Closest match to the campaign goal'
  const resultColor = objectiveSeriesColor(
    campaign.objectiveKey,
    campaign.resultMetric.key,
  )

  return (
    <div className="card overflow-hidden">
      <DailyChartHeader
        range={range}
        onRangeChange={setRange}
        title={`Money spent and ${campaign.resultMetric.label.toLowerCase()}, day by day`}
        subtitle={`${campaign.objectiveLabel} · money on the left scale, results on the right`}
      />

      <div className="px-4 sm:px-5 pt-3 flex items-center gap-x-4 gap-y-2 flex-wrap explain">
        <span className="micro-label">
          Up to {shortDate(visiblePoints[visiblePoints.length - 1]?.date ?? '')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block rounded-full"
            style={{ width: 20, height: 3, background: 'var(--viz-spend)' }}
          />
          Spend{' '}
          <strong className="mono" style={{ color: 'var(--ink)' }}>
            {formatInr(selectedSpend)}
          </strong>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block rounded-full"
            style={{ width: 20, height: 3, background: resultColor }}
          />
          {resultIsDailyReach ? 'Best day: ' : ''}
          {campaign.resultMetric.label}{' '}
          <strong className="mono" style={{ color: 'var(--ink)' }}>
            {selectedResult == null ? '—' : fullNumber(selectedResult)}
          </strong>
        </span>
        <span className="chip chip-neutral ml-auto">
          {resultIsDailyReach
            ? 'Reach cannot be added up across days'
            : selectedResult == null
              ? 'Not available'
              : resultPoints.length < visiblePoints.length
                ? 'Cost per result hidden — some days missing'
              : selectedCost == null
                ? 'No results yet'
                : `${costInr(selectedCost)} per result`}
        </span>
        {resultPoints.length < visiblePoints.length && (
          <span className="chip chip-warn">
            Figures for {resultPoints.length} of {visiblePoints.length} days
          </span>
        )}
      </div>

      {activePoint && (
        <div
          className="mx-4 sm:mx-5 mt-3 px-3 py-2 rounded-lg flex items-center gap-x-4 gap-y-1 flex-wrap explain"
          style={{ background: 'var(--surface-warm)' }}
          role="status"
        >
          <strong style={{ color: 'var(--ink)' }}>
            {longDate(activePoint.date)}
          </strong>
          <span>{formatInr(activePoint.spend)} spent</span>
          <span>
            {activePoint.result == null
              ? `${campaign.resultMetric.label} unavailable`
              : `${fullNumber(activePoint.result)} ${campaign.resultMetric.label}`}
          </span>
          <span>
            {campaign.primaryKpi.label}{' '}
            {activePoint.primaryKpiDisplay ?? 'not available'}
          </span>
          {(campaign.objectiveKey === 'traffic' ||
            campaign.objectiveKey === 'engagement') && (
            <span>Click rate {activePoint.ctr.toFixed(2)}%</span>
          )}
        </div>
      )}

      <div ref={chartShellRef} className="px-1 sm:px-3 pb-1">
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${chartWidth} ${height}`}
          className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          role="group"
          tabIndex={0}
          aria-label={`${campaign.displayName} daily spend and ${campaign.resultMetric.label}, from ${shortDate(visiblePoints[0]?.date ?? '')} to ${shortDate(visiblePoints[visiblePoints.length - 1]?.date ?? '')}.`}
          onFocus={() =>
            setActiveDate(
              (current) =>
                current ?? visiblePoints[visiblePoints.length - 1]?.date ?? null,
            )
          }
          onBlur={() => setActiveDate(null)}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
            event.preventDefault()
            const currentIndex = visiblePoints.findIndex(
              (point) => point.date === activeDate,
            )
            const startIndex = currentIndex >= 0 ? currentIndex : visiblePoints.length - 1
            const nextIndex = Math.max(
              0,
              Math.min(
                visiblePoints.length - 1,
                startIndex + (event.key === 'ArrowLeft' ? -1 : 1),
              ),
            )
            setActiveDate(visiblePoints[nextIndex]?.date ?? null)
          }}
          onMouseLeave={() => setActiveDate(null)}
        >
          {ratios.map((ratio) => {
            const y = margin.top + plotHeight * (1 - ratio)
            return (
              <g key={ratio}>
                <line
                  x1={margin.left}
                  y1={y}
                  x2={chartWidth - margin.right}
                  y2={y}
                  stroke="var(--viz-grid)"
                />
                <text
                  x={margin.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize={mobile ? 10 : 11}
                  fill="var(--ink-3)"
                >
                  {compactCurrency(spendMaximum * ratio)}
                </text>
                <text
                  x={chartWidth - margin.right + 8}
                  y={y + 4}
                  textAnchor="start"
                  fontSize={mobile ? 10 : 11}
                  fill={resultColor}
                >
                  {resultPoints.length > 0
                    ? compactNumber(resultMaximum * ratio)
                    : '—'}
                </text>
              </g>
            )
          })}

          {xTickIndexes.map((pointIndex) => {
            const point = visiblePoints[pointIndex]
            return (
              <text
                key={point.date}
                x={xFor(point.at)}
                y={height - 12}
                textAnchor={
                  pointIndex === 0
                    ? 'start'
                    : pointIndex === visiblePoints.length - 1
                      ? 'end'
                      : 'middle'
                }
                fontSize={mobile ? 10 : 11}
                fill="var(--ink-3)"
              >
                {shortDate(point.date)}
              </text>
            )
          })}

          {segments.map((segment) =>
            segment.length > 1 ? (
              <path
                key={`objective-spend-${segment[0].date}`}
                d={pathFor(segment, (point) => point.spend, spendY)}
                fill="none"
                stroke="var(--viz-spend)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null,
          )}

          {resultSegments.map((segment) =>
            segment.length > 1 ? (
              <path
                key={`objective-result-${segment[0].date}`}
                d={pathFor(segment, (point) => point.result ?? 0, resultY)}
                fill="none"
                stroke={resultColor}
                strokeWidth="2.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null,
          )}

          {visiblePoints.map((point) => (
            <g key={`objective-points-${point.date}`} pointerEvents="none">
              <circle
                cx={xFor(point.at)}
                cy={spendY(point.spend)}
                r={activePoint?.date === point.date ? 5 : 3.5}
                fill="var(--viz-spend)"
                stroke="var(--surface)"
                strokeWidth="1.5"
              />
              {point.result != null && (
                <circle
                  cx={xFor(point.at)}
                  cy={resultY(point.result)}
                  r={activePoint?.date === point.date ? 5.5 : 4}
                  fill={resultColor}
                  stroke="var(--surface)"
                  strokeWidth="1.5"
                />
              )}
            </g>
          ))}

          {visiblePoints.map((point, index) => {
            const x = xFor(point.at)
            const previousX =
              index === 0 ? margin.left : xFor(visiblePoints[index - 1].at)
            const nextX =
              index === visiblePoints.length - 1
                ? chartWidth - margin.right
                : xFor(visiblePoints[index + 1].at)
            const left = index === 0 ? margin.left : (previousX + x) / 2
            const right =
              index === visiblePoints.length - 1
                ? chartWidth - margin.right
                : (x + nextX) / 2
            return (
              <rect
                key={`objective-hit-${point.date}`}
                x={left}
                y={margin.top}
                width={Math.max(1, right - left)}
                height={plotHeight}
                fill="transparent"
                aria-label={`${longDate(point.date)}: spend ${formatInr(point.spend)}, ${point.result == null ? `${campaign.resultMetric.label} unavailable` : `${fullNumber(point.result)} ${campaign.resultMetric.label}`}, ${campaign.primaryKpi.label} ${point.primaryKpiDisplay ?? 'unavailable'}.`}
                onMouseEnter={() => setActiveDate(point.date)}
                onPointerDown={() => setActiveDate(point.date)}
              />
            )
          })}
        </svg>
      </div>

      <div
        className="px-4 sm:px-5 py-3 explain flex items-center justify-between gap-x-4 gap-y-1 flex-wrap"
        style={{ borderTop: '1px solid var(--hairline-light)' }}
      >
        <span>{sourceLabel}</span>
        <span>
          {formatInr(campaign.coverage.observedSpend)} by day of{' '}
          {formatInr(campaign.coverage.lifetimeSpend)} in total
          {' '}({percentLabel(campaign.coverage.spendCoveragePct)})
        </span>
        <span>Figures: {plainStatus('coverage', campaign.coverage.status).label.toLowerCase()}</span>
      </div>
    </div>
  )
}

export function CampaignSpendValueChart({
  campaigns,
  tenantId,
}: {
  campaigns: DashboardCampaignRow[]
  tenantId: string
}) {
  const rows = [...campaigns].sort((a, b) => b.spend - a.spend)
  const maximum = Math.max(
    1,
    ...rows.flatMap((campaign) => hasUnknownReturn(campaign)
      ? [campaign.spend]
      : [campaign.spend, campaign.revenue]),
  )

  return (
    <div className="card overflow-hidden">
      <div
        className="px-4 sm:px-5 py-4 flex items-start justify-between gap-3 flex-wrap"
        style={{ borderBottom: '1px solid var(--hairline)' }}
      >
        <div>
          <h3 className="font-semibold" style={{ color: 'var(--ink)' }}>
            Money spent vs sales value
          </h3>
          <p className="explain mt-1">Every sales campaign launched here, since it started</p>
        </div>
        <div className="flex items-center gap-3 explain">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block rounded-full"
              style={{ width: 18, height: 5, background: 'var(--viz-spend)' }}
            />
            Spend
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block rounded-full"
              style={{ width: 18, height: 5, background: 'var(--viz-value)' }}
            />
            Sales value
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <ChartEmpty label="No sales campaigns have been launched here yet." />
      ) : (
        <div>
          {rows.map((campaign) => {
            const tone = roasTone(campaign)
            return (
              <div
                key={campaign.id}
                className="px-4 sm:px-5 py-4"
                style={{ borderTop: '1px solid var(--hairline-light)' }}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/${tenantId}/campaigns/${campaign.id}`}
                      className="font-semibold hover:underline block truncate"
                      style={{ color: 'var(--ink)' }}
                      title={campaign.name}
                    >
                      {campaign.displayName}
                    </Link>
                    <div className="flex items-center gap-2 mt-1 flex-wrap explain">
                      <span>{campaign.statusLabel}</span>
                      <span>·</span>
                      <span>
                        {plainStatus('toolImpactStage', campaign.toolImpactStage).label}
                      </span>
                      {campaign.isStale && (
                        <span className="chip chip-warn">Figures out of date</span>
                      )}
                    </div>
                  </div>
                  <span
                    className="mono font-semibold rounded-full px-2.5 py-1 shrink-0"
                    style={{
                      color: tone.color,
                      background: tone.background,
                      border: `1px solid ${tone.border}`,
                      fontSize: 12,
                    }}
                  >
                    {campaign.spend <= 0
                      ? 'Nothing spent'
                      : hasUnknownReturn(campaign)
                        ? 'Sales value unclear'
                        : `${formatActionValueRoas(campaign.roas)} return`}
                  </span>
                </div>

                <div className="grid grid-cols-[52px_minmax(0,1fr)_92px] gap-x-3 gap-y-2 items-center">
                  <span className="micro-label">Spend</span>
                  <div
                    className="rounded-full overflow-hidden"
                    style={{ height: 8, background: 'var(--bg-muted)' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: barWidth(campaign.spend, maximum),
                        background: 'var(--viz-spend)',
                      }}
                    />
                  </div>
                  <span className="mono text-xs text-right">
                    {campaign.spend > 0
                      ? formatInr(campaign.spend)
                      : '—'}
                  </span>

                  <span className="micro-label">Sales</span>
                  <div
                    className="rounded-full overflow-hidden"
                    style={{ height: 8, background: 'var(--bg-muted)' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: hasUnknownReturn(campaign)
                          ? '100%'
                          : campaign.spend > 0
                            ? barWidth(campaign.revenue, maximum)
                            : '0%',
                        ...valueBarStyle(campaign),
                      }}
                    />
                  </div>
                  <span className="mono text-xs text-right">
                    {campaign.spend <= 0
                      ? '—'
                      : hasUnknownReturn(campaign)
                        ? 'Unavailable'
                        : formatInr(campaign.revenue)}
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <span
                    className={
                      isResolvedMetaValue(campaign)
                        ? 'chip chip-accent'
                        : 'chip chip-warn'
                    }
                  >
                    {returnBasisLabel(campaign.revenueBasis)}
                  </span>
                  {campaign.dataAsOf ? (
                    <span className="explain">
                      Updated {formatRelative(campaign.dataAsOf)}
                    </span>
                  ) : (
                    <span className="explain">Last update unknown</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function ActionValueGapChart({
  campaigns,
  tenantId,
}: {
  campaigns: DashboardCampaignRow[]
  tenantId: string
}) {
  const rows = [...campaigns].sort((a, b) => {
    const unknownDelta = Number(hasUnknownReturn(a)) - Number(hasUnknownReturn(b))
    return unknownDelta || Math.abs(b.returnSurplus) - Math.abs(a.returnSurplus)
  })
  const maximumGap = Math.max(
    1,
    ...rows.filter((campaign) => !hasUnknownReturn(campaign)).map((campaign) => Math.abs(campaign.returnSurplus)),
  )

  return (
    <div className="card overflow-hidden">
      <div
        className="px-4 sm:px-5 py-4"
        style={{ borderBottom: '1px solid var(--hairline)' }}
      >
        <h3 className="font-semibold" style={{ color: 'var(--ink)' }}>
          Sales value minus money spent
        </h3>
        <div className="flex items-center justify-between gap-3 mt-1 explain">
          <span>← Brought back less</span>
          <span className="text-right">Brought back more →</span>
        </div>
      </div>

      {rows.length === 0 ? (
        <ChartEmpty label="No sales campaigns have been launched here yet." />
      ) : (
        <div>
          {rows.map((campaign) => {
            const unknownReturn = hasUnknownReturn(campaign)
            const gap = campaign.spend > 0 && !unknownReturn ? campaign.returnSurplus : 0
            const halfWidth = Math.min(
              50,
              (Math.abs(gap) / maximumGap) * 50,
            )
            const positive = gap >= 0
            const configuredReturn =
              campaign.revenueBasis === 'configured_conversion_value'
            const barColor = unknownReturn
              ? 'var(--viz-unknown)'
              : configuredReturn
                ? 'var(--viz-estimate)'
                : positive
                  ? 'var(--state-positive)'
                  : 'var(--state-negative)'

            return (
              <div
                key={campaign.id}
                className="px-4 sm:px-5 py-4"
                style={{ borderTop: '1px solid var(--hairline-light)' }}
              >
                <div className="flex items-baseline justify-between gap-3 mb-2">
                  <Link
                    href={`/dashboard/${tenantId}/campaigns/${campaign.id}`}
                    className="text-sm font-semibold hover:underline truncate min-w-0"
                    style={{ color: 'var(--ink)' }}
                    title={campaign.displayName}
                  >
                    {campaign.displayName}
                  </Link>
                  <span
                    className="mono text-xs font-semibold shrink-0"
                    style={{
                      color:
                        campaign.spend <= 0 ? 'var(--ink-3)' : barColor,
                    }}
                  >
                    {campaign.spend <= 0
                      ? 'Nothing spent'
                      : unknownReturn
                        ? 'Sales value unclear'
                        : `${gap >= 0 ? '+' : '−'}${formatInr(Math.abs(gap))}`}
                  </span>
                </div>
                <div
                  className="relative rounded-full"
                  style={{ height: 12, background: 'var(--surface-warm)' }}
                  aria-label={unknownReturn
                    ? `${campaign.displayName}: sales value unclear`
                    : `${campaign.displayName}: sales value minus spend ${gap >= 0 ? '' : '-'}${formatInr(Math.abs(gap))}`}
                >
                  <span
                    className="absolute top-[-3px] bottom-[-3px]"
                    style={{ left: '50%', width: 1, background: 'var(--ink-3)' }}
                  />
                  {campaign.spend > 0 && !unknownReturn && Math.abs(gap) > 0 && (
                    <span
                      className="absolute top-0 bottom-0 rounded-full"
                      style={{
                        left: positive ? '50%' : `${50 - halfWidth}%`,
                        width: `${halfWidth}%`,
                        background: barColor,
                        opacity: 0.82,
                      }}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function NonSalesPerformanceChart({
  campaigns,
  tenantId,
}: {
  campaigns: DashboardCampaignRow[]
  tenantId: string
}) {
  const rows = [...campaigns].sort((a, b) => b.spend - a.spend)

  if (rows.length === 0) return null

  return (
    <div className="card overflow-hidden mt-4">
      <div
        className="px-4 sm:px-5 py-4 flex items-start justify-between gap-3 flex-wrap"
        style={{ borderBottom: '1px solid var(--hairline)' }}
      >
        <div>
          <h3 className="font-semibold" style={{ color: 'var(--ink)' }}>
            Campaigns with other goals
          </h3>
          <p className="explain mt-1">Campaigns aiming for clicks, reach, leads or engagement rather than sales</p>
        </div>
        <span className="chip chip-neutral">{rows.length} campaign{rows.length === 1 ? '' : 's'}</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2">
        {rows.map((campaign) => {
          const reading = campaign.primaryKpi
          const target = reading.target
          const maximum = Math.max(reading.value, target ?? 0, 1) * 1.15
          const actualWidth =
            campaign.spend > 0
              ? Math.min(100, (reading.value / maximum) * 100)
              : 0
          const targetLeft =
            target == null ? null : Math.min(100, (target / maximum) * 100)
          const healthColor =
            reading.status === 'good'
              ? 'var(--state-positive)'
              : reading.status === 'watch'
                ? 'var(--state-watch)'
                : reading.status === 'bad'
                  ? 'var(--state-negative)'
                  : 'var(--viz-neutral)'
          const seriesColor = objectiveSeriesColor(
            campaign.objectiveKey,
            reading.key,
          )

          return (
            <div
              key={campaign.id}
              className="px-4 sm:px-5 py-4"
              style={{ borderTop: '1px solid var(--hairline-light)' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/dashboard/${tenantId}/campaigns/${campaign.id}`}
                    className="font-semibold hover:underline block truncate"
                    style={{ color: 'var(--ink)' }}
                  >
                    {campaign.displayName}
                  </Link>
                  <span className="explain">
                    {campaign.objectiveLabel} ·{' '}
                    {formatInr(campaign.spend)} spent
                  </span>
                </div>
                <span
                  className="mono font-semibold text-sm shrink-0"
                  style={{ color: seriesColor }}
                >
                  {campaign.spend > 0 ? reading.display : 'Nothing spent'}
                </span>
              </div>

              <div
                className="relative rounded-full mt-3"
                style={{ height: 8, background: 'var(--bg-muted)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${actualWidth}%`, background: seriesColor }}
                />
                {targetLeft != null && (
                  <span
                    className="absolute"
                    style={{
                      left: `${targetLeft}%`,
                      top: -4,
                      bottom: -4,
                      width: 2,
                      background: 'var(--ink)',
                    }}
                    title={`Target ${reading.targetDisplay ?? target}`}
                  />
                )}
              </div>
              <div className="flex items-center justify-between gap-3 mt-2 explain">
                <span>{reading.label}</span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="inline-block rounded-full"
                    style={{ width: 7, height: 7, background: healthColor }}
                  />
                  {reading.targetDisplay
                    ? `Target ${reading.targetDisplay}`
                    : plainStatus('health', reading.status).label}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function LaunchFunnelChart({
  cohort,
}: {
  cohort: ToolImpactOverview['cohort']
}) {
  const stages = [
    { label: 'Created here', value: cohort.created, color: 'var(--viz-funnel-1)' },
    { label: 'Confirmed live in Meta', value: cohort.launched, color: 'var(--viz-funnel-2)' },
    { label: 'Started spending', value: cohort.withSpend, color: 'var(--viz-funnel-3)' },
    { label: `Ran ${cohort.maturityDays}+ days`, value: cohort.mature, color: 'var(--viz-funnel-4)' },
  ]
  const maximum = Math.max(1, cohort.created)

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="font-semibold" style={{ color: 'var(--ink)' }}>
          How far campaigns got
        </h3>
        <span className="chip chip-neutral">Launched here only</span>
      </div>
      <div className="space-y-4">
        {stages.map((stage, index) => (
          <div key={stage.label}>
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <span className="text-sm" style={{ color: 'var(--ink-2)' }}>
                {index + 1}. {stage.label}
              </span>
              <span className="display-num" style={{ fontSize: 20 }}>
                {stage.value}
              </span>
            </div>
            <div
              className="rounded-full overflow-hidden"
              style={{ height: 7, background: 'var(--bg-muted)' }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: barWidth(stage.value, maximum),
                  background: stage.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function DecisionActivityChart({
  overview,
}: {
  overview: ToolImpactOverview
}) {
  const funnel = overview.diagnosis.decisionFunnel
  const outcomes = overview.diagnosis.observedOutcomes
  const decisionStatuses = [
    { label: 'Awaiting review', value: funnel.open, color: 'var(--accent)' },
    { label: 'Approved', value: funnel.approved, color: 'var(--info)' },
    { label: 'Rejected', value: funnel.rejected, color: 'var(--bad)' },
    { label: 'Expired', value: funnel.expired, color: 'var(--warn)' },
  ]
  const outcomeStatuses = [
    { label: 'Improved', value: outcomes.byLabel.improved },
    { label: 'Got worse', value: outcomes.byLabel.worsened },
    { label: 'No change', value: outcomes.byLabel.neutral },
    { label: 'No clear answer', value: outcomes.byLabel.inconclusive },
  ]
  const totalDecisionStatuses = Math.max(
    1,
    decisionStatuses.reduce((total, status) => total + status.value, 0),
  )

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold" style={{ color: 'var(--ink)' }}>
            Suggestions and what happened
          </h3>
          <p className="explain mt-1">Two separate counts — one does not feed the other</p>
        </div>
        <span className="chip chip-neutral">These campaigns only</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card-inset px-4 py-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="micro-label">Changes suggested</p>
              <p className="display-num mt-1" style={{ fontSize: 30 }}>
                {funnel.proposed}
              </p>
            </div>
            <span className="explain">{funnel.executed} carried out</span>
          </div>
          <div
            className="flex rounded-full overflow-hidden mt-4"
            style={{ height: 9, background: 'var(--muted)' }}
          >
            {decisionStatuses.map((status) => (
              <span
                key={status.label}
                style={{
                  width: `${(status.value / totalDecisionStatuses) * 100}%`,
                  background: status.color,
                }}
                title={`${status.label}: ${status.value}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-x-3 gap-y-1 mt-3 flex-wrap explain">
            {decisionStatuses.map((status) => (
              <span key={status.label} className="inline-flex items-center gap-1.5">
                <span
                  className="rounded-full"
                  style={{ width: 7, height: 7, background: status.color }}
                />
                {status.value} {status.label.toLowerCase()}
              </span>
            ))}
          </div>
        </div>

        <div className="card-inset px-4 py-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="micro-label">Changes checked afterwards</p>
              <p className="display-num mt-1" style={{ fontSize: 30 }}>
                {outcomes.recorded}
              </p>
            </div>
            <span className="explain">
              {outcomes.finalized72h} with a final answer
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 mt-4">
            {outcomeStatuses.map((status) => (
              <div
                key={status.label}
                className="flex items-center justify-between gap-2 explain"
              >
                <span>{status.label}</span>
                <span className="mono font-semibold">{status.value}</span>
              </div>
            ))}
          </div>
          <p className="explain mt-3">Before-and-after comparisons — they do not prove the change caused it</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4 flex-wrap explain">
        <span>{overview.automation.cyclesRun} check-ups run</span>
        <span>·</span>
        <span>{overview.automation.campaignsWatched} campaigns watched</span>
        {overview.automation.lastCycleAt && (
          <>
            <span>·</span>
            <span>
              last checked {formatRelative(overview.automation.lastCycleAt)}
            </span>
          </>
        )}
      </div>
    </div>
  )
}

export function CampaignEvidenceTable({
  title,
  rows,
  tenantId,
  variant,
}: {
  title: string
  rows: DashboardCampaignRow[]
  tenantId: string
  variant: 'sales' | 'other'
}) {
  if (rows.length === 0) return null

  return (
    <div className="card overflow-hidden">
      <div
        className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3"
        style={{ borderBottom: '1px solid var(--hairline-light)' }}
      >
        <h3 className="font-semibold min-w-0 truncate" style={{ color: 'var(--ink)' }}>
          {title}
        </h3>
        <span className="chip chip-neutral">{rows.length}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table min-w-[900px]">
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Status</th>
              <th className="num">Spend</th>
              {variant === 'sales' ? (
                <>
                  <th className="num">Sales value</th>
                  <th className="num">Return on ad spend</th>
                  <th className="num">Sales minus spend</th>
                </>
              ) : (
                <th className="num">Goal result</th>
              )}
              <th className="num">Launched by</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((campaign) => {
              const tone = roasTone(campaign)
              const unknownReturn = hasUnknownReturn(campaign)
              return (
                <tr key={campaign.id}>
                  <td>
                    <Link
                      href={`/dashboard/${tenantId}/campaigns/${campaign.id}`}
                      className="font-semibold hover:underline break-words"
                    >
                      {campaign.displayName}
                    </Link>
                    <span className="explain block">
                      {campaign.objectiveLabel}
                    </span>
                  </td>
                  <td>
                    {campaign.statusLabel}
                    <span className="explain block">
                      {plainStatus('toolImpactStage', campaign.toolImpactStage).label}
                    </span>
                  </td>
                  <td className="num">
                    {campaign.spend > 0
                      ? formatInr(campaign.spend)
                      : '—'}
                  </td>
                  {variant === 'sales' ? (
                    <>
                      <td className="num">
                        {campaign.spend > 0 && !unknownReturn
                          ? formatInr(campaign.revenue)
                          : campaign.spend > 0 ? 'Unavailable' : '—'}
                      </td>
                      <td className="num">
                        <span
                          className="mono font-semibold"
                          style={{ color: tone.color }}
                        >
                          {campaign.spend > 0 && !unknownReturn
                            ? formatActionValueRoas(campaign.roas)
                            : campaign.spend > 0 ? 'Unavailable' : '—'}
                        </span>
                      </td>
                      <td className="num">
                        {campaign.spend > 0 && !unknownReturn
                          ? `${campaign.returnSurplus >= 0 ? '+' : '−'}${formatInr(Math.abs(campaign.returnSurplus))}`
                          : campaign.spend > 0 ? 'Unavailable' : '—'}
                      </td>
                    </>
                  ) : (
                    <td className="num">
                      {campaign.spend > 0
                        ? `${campaign.primaryKpi.display} ${campaign.primaryKpi.label}`
                        : '—'}
                    </td>
                  )}
                  <td className="num">
                    <span className="block">
                      {campaign.toolOwnership?.actor === 'agent'
                        ? 'The AI'
                        : campaign.toolOwnership?.actor === 'human'
                          ? 'A person, from the dashboard'
                          : 'Not known'}
                    </span>
                    <span className="explain block">
                      {variant === 'sales'
                        ? returnBasisLabel(campaign.revenueBasis)
                        : campaign.dataAsOf
                          ? `Updated ${formatRelative(campaign.dataAsOf)}`
                          : 'Last update unknown'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ChartEmpty({
  title = 'No results yet',
  label,
}: {
  title?: string
  label: string
}) {
  return (
    <div className="px-5 py-12 text-center">
      <p className="font-semibold" style={{ color: 'var(--ink)' }}>
        {title}
      </p>
      <p className="explain mt-1">{label}</p>
    </div>
  )
}
