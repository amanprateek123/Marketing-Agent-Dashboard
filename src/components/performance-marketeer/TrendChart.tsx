'use client'

import { useState } from 'react'
import type { PmTrendResponse } from '@/types/performance-marketeer'
import { Empty, Source, fmt, useWidth } from './shared'

/**
 * Daily Meta spend (bars, left axis) with first-party ROAS (line, right axis),
 * its 7-day rolling average (dashed) and the 1.00× target. Hand-rolled SVG like
 * the rest of the dashboard. Arrow keys move the readout day by day.
 */
export function TrendChart({ trend, height = 240, target = 1 }: { trend: PmTrendResponse; height?: number; target?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const pts = trend.points
  const [active, setActive] = useState<number | null>(null)
  if (!pts.length) return <Empty title="No days with data in this range" />

  const m = { top: 14, right: 40, bottom: 26, left: 48 }
  const w = width
  const iw = w - m.left - m.right
  const ih = height - m.top - m.bottom
  const maxSpend = Math.max(1, ...pts.map((p) => p.spend))
  const spendTop = niceMax(maxSpend)
  const roasVals = [...pts.map((p) => p.firstPartyRoas), ...trend.rollingRoas7].filter((v): v is number => v != null)
  const roasTop = Math.max(1.5, Math.ceil(Math.max(target, ...roasVals) * 2) / 2)
  const step = iw / pts.length
  const x = (i: number) => m.left + step * i + step / 2
  const ySpend = (v: number) => m.top + ih - (v / spendTop) * ih
  const yRoas = (v: number) => m.top + ih - (Math.min(v, roasTop) / roasTop) * ih
  const line = (vals: (number | null)[]) =>
    vals
      .map((v, i) => (v == null ? null : `${x(i).toFixed(1)},${yRoas(v).toFixed(1)}`))
      .reduce<string[]>((segs, p, i, arr) => {
        if (p == null) return segs
        segs.push(`${i === 0 || arr[i - 1] == null ? 'M' : 'L'}${p}`)
        return segs
      }, [])
      .join(' ')
  const labelEvery = Math.max(1, Math.ceil(pts.length / Math.max(2, Math.floor(iw / 64))))
  const cur = active == null ? null : pts[active]

  return (
    <div ref={ref} className="min-w-0">
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]" style={{ color: 'var(--ink-3)' }}>
        <Legend swatch={<rect width="12" height="10" rx="2" fill="var(--viz-spend)" opacity="0.55" />}>Spend <Source s="meta" /></Legend>
        <Legend swatch={<line x1="0" y1="5" x2="14" y2="5" stroke="var(--viz-roas)" strokeWidth="2.5" />}>Daily ROAS <Source s="fp" /></Legend>
        <Legend swatch={<line x1="0" y1="5" x2="14" y2="5" stroke="var(--viz-value)" strokeWidth="2.5" strokeDasharray="4 2" />}>7-day rolling ROAS <Source s="fp" /></Legend>
        <Legend swatch={<line x1="0" y1="5" x2="14" y2="5" stroke="var(--viz-target)" strokeWidth="1.5" strokeDasharray="2 2" />}>Target {fmt.roas(target)}</Legend>
      </div>
      <svg
        width={w}
        height={height}
        viewBox={`0 0 ${w} ${height}`}
        role="group"
        tabIndex={0}
        aria-label={`Daily spend and first-party ROAS, ${fmt.date(pts[0].date)} to ${fmt.date(pts[pts.length - 1].date)}. Use left and right arrow keys to read each day.`}
        className="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        onFocus={() => setActive((a) => a ?? pts.length - 1)}
        onBlur={() => setActive(null)}
        onMouseLeave={() => setActive(null)}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
          e.preventDefault()
          setActive((a) => Math.max(0, Math.min(pts.length - 1, (a ?? pts.length - 1) + (e.key === 'ArrowLeft' ? -1 : 1))))
        }}
      >
        <rect x={m.left} y={m.top} width={iw} height={ih} fill="var(--viz-plot-bg)" />
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={m.left} x2={w - m.right} y1={m.top + ih * (1 - f)} y2={m.top + ih * (1 - f)} stroke="var(--viz-grid)" />
            <text x={m.left - 6} y={m.top + ih * (1 - f) + 4} textAnchor="end" fontSize="11" fill="var(--ink-3)">
              {fmt.inrCompact(spendTop * f)}
            </text>
            <text x={w - m.right + 6} y={m.top + ih * (1 - f) + 4} fontSize="11" fill="var(--ink-3)">
              {(roasTop * f).toFixed(1)}×
            </text>
          </g>
        ))}
        {pts.map((p, i) => (
          <rect
            key={p.date}
            x={x(i) - Math.max(1, step * 0.32)}
            y={ySpend(p.spend)}
            width={Math.max(2, step * 0.64)}
            height={m.top + ih - ySpend(p.spend)}
            rx="2"
            fill="var(--viz-spend)"
            opacity={active === i ? 0.85 : 0.45}
          />
        ))}
        <line x1={m.left} x2={w - m.right} y1={yRoas(target)} y2={yRoas(target)} stroke="var(--viz-target)" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d={line(trend.rollingRoas7)} fill="none" stroke="var(--viz-value)" strokeWidth="2.5" strokeDasharray="6 3" strokeLinejoin="round" />
        <path d={line(pts.map((p) => p.firstPartyRoas))} fill="none" stroke="var(--viz-roas)" strokeWidth="2" strokeLinejoin="round" />
        {pts.map((p, i) =>
          p.firstPartyRoas == null ? null : (
            <circle key={p.date} cx={x(i)} cy={yRoas(p.firstPartyRoas)} r={active === i ? 4.5 : 2.5} fill="var(--viz-roas)" stroke="var(--surface)" strokeWidth="1" />
          ),
        )}
        {pts.map((p, i) =>
          (pts.length - 1 - i) % labelEvery === 0 ? (
            <text key={p.date} x={x(i)} y={height - 8} textAnchor="middle" fontSize="11" fill="var(--ink-3)">
              {fmt.date(p.date)}
            </text>
          ) : null,
        )}
        {active != null && <line x1={x(active)} x2={x(active)} y1={m.top} y2={m.top + ih} stroke="var(--ink-4)" strokeDasharray="2 2" />}
        {pts.map((p, i) => (
          <rect key={p.date} x={m.left + step * i} y={m.top} width={step} height={ih} fill="transparent" onMouseEnter={() => setActive(i)} />
        ))}
      </svg>
      <p className="mt-2 min-h-[20px] text-[12.5px] tabular-nums" style={{ color: 'var(--ink-2)' }} aria-live="polite">
        {cur ? (
          <>
            <strong>{fmt.date(cur.date)}</strong> · spend {fmt.inr(cur.spend)} (Meta) · {fmt.int(cur.firstPartyOrders)} orders · ROAS {fmt.roas(cur.firstPartyRoas)} · 7-day {fmt.roas(trend.rollingRoas7[active!])} (first-party) ·
            CPA {fmt.inr(cur.firstPartyCpa)}
          </>
        ) : (
          <span style={{ color: 'var(--ink-4)' }}>Hover or focus the chart to read a day.</span>
        )}
      </p>
    </div>
  )
}

function Legend({ swatch, children }: { swatch: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="14" height="10" aria-hidden="true">
        {swatch}
      </svg>
      {children}
    </span>
  )
}

function niceMax(v: number): number {
  const p = 10 ** Math.floor(Math.log10(v))
  const n = v / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p
}
