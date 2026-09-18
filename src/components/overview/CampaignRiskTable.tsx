'use client'

import Link from 'next/link'
import { useState } from 'react'
import { AlertTriangle, Clock } from 'lucide-react'
import {
  formatCurrency, formatRelativeTime, formatSignedCurrency, severityToHealth,
} from '@/lib/utils'
import { HealthBadge } from '@/components/plain/HealthBadge'
import type { DashboardCampaignRow, DashboardEconomics } from '@/types'

type SortKey = 'risk' | 'spend' | 'roas' | 'recent'

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'risk', label: 'Money at risk' },
  { key: 'spend', label: 'Spend' },
  { key: 'roas', label: 'Return' },
  { key: 'recent', label: 'Most recent' },
]

/**
 * Campaign table, sorted by money at risk by default.
 *
 * Recency order buried the biggest loser at the bottom of the list — the
 * ₹34,715 campaign at 0.78x sat below three smaller ones simply because it
 * started earlier. Sorting by contribution destroyed puts the most expensive
 * problem first, which is the only ordering that matches what the reader
 * needs to do next.
 */
export function CampaignRiskTable({
  rows,
  economics,
  tenantId,
}: {
  rows: DashboardCampaignRow[]
  economics: DashboardEconomics
  tenantId: string
}) {
  const [sort, setSort] = useState<SortKey>('risk')

  const sorted = [...rows].sort((a, b) => {
    switch (sort) {
      case 'risk':
        // Losers first by size of loss, then winners by size of gain.
        if (a.moneyAtRisk !== b.moneyAtRisk) return b.moneyAtRisk - a.moneyAtRisk
        return b.contributionProfit - a.contributionProfit
      case 'spend':
        return b.spend - a.spend
      case 'roas':
        return b.roas - a.roas
      case 'recent':
        return (
          new Date(b.launchedAt ?? 0).getTime() -
          new Date(a.launchedAt ?? 0).getTime()
        )
    }
  })

  if (!rows.length) {
    return (
      <div className="px-5 py-12 text-center">
        <p style={{ color: 'var(--ink-3)' }}>No campaigns in this period.</p>
      </div>
    )
  }

  return (
    <>
      <div
        className="px-5 py-2.5 flex items-center gap-2 flex-wrap"
        style={{ borderBottom: '1px solid var(--hairline-light)' }}
      >
        <span className="explain">Sort by</span>
        {SORTS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSort(s.key)}
            className="chip"
            style={{
              cursor: 'pointer',
              background: sort === s.key ? 'var(--accent-bg)' : 'transparent',
              borderColor: sort === s.key ? 'var(--accent-border)' : 'var(--hairline)',
              color: sort === s.key ? 'var(--accent-strong)' : 'var(--ink-3)',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '30%' }}>Campaign</th>
              <th>How it&rsquo;s doing</th>
              <th className="num">Spent</th>
              <th className="num">Return</th>
              <th className="num">
                Profit
                <span className="explain block" style={{ fontWeight: 400 }}>
                  {economics.hasMixedMargins
                    ? "after each product's margin"
                    : `after ${(economics.marginPct * 100).toFixed(0)}% margin`}
                </span>
              </th>
              <th className="num">Started</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => {
              const health = severityToHealth(c.severity)
              const profitColor =
                c.contributionProfit > 0 ? 'var(--good)'
                : c.contributionProfit < 0 ? 'var(--bad)'
                : 'var(--ink-3)'
              return (
                <tr key={c.id}>
                  <td>
                    <Link
                      href={`/dashboard/${tenantId}/campaigns/${c.id}`}
                      className="font-semibold hover:underline"
                      style={{ color: 'var(--ink)' }}
                    >
                      {c.displayName}
                    </Link>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="explain">{c.statusLabel}</span>
                      <span
                        className="chip"
                        style={{
                          fontSize: 10.5,
                          background: c.isRevenueObjective ? 'var(--accent-bg)' : 'var(--bg-muted)',
                          borderColor: c.isRevenueObjective ? 'var(--accent-border)' : 'var(--hairline)',
                          color: c.isRevenueObjective ? 'var(--accent-strong)' : 'var(--ink-3)',
                        }}
                      >
                        {c.objectiveLabel}
                      </span>
                      {c.facets.funnel !== 'unknown' && (
                        <span className="chip chip-neutral" style={{ fontSize: 10.5 }}>
                          {c.facets.funnelLabel}
                        </span>
                      )}
                      {c.facets.budgetModel !== 'unknown' && (
                        <span className="chip chip-neutral" style={{ fontSize: 10.5 }}>
                          {c.facets.budgetModel.toUpperCase()}
                        </span>
                      )}
                      {c.learningStage === 'LEARNING_LIMITED' && (
                        <span className="chip chip-warn" style={{ fontSize: 10.5 }}>
                          {c.learningStageLabel}
                        </span>
                      )}
                      {c.capRisk && (
                        <span className="chip chip-bad" style={{ fontSize: 10.5 }}>
                          <AlertTriangle size={10} /> Cap too low
                        </span>
                      )}
                      {c.isStale && (
                        <span className="chip chip-neutral" style={{ fontSize: 10.5 }}>
                          <Clock size={10} /> Stale
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <HealthBadge health={health} label={c.verdictLabel} />
                    {c.nextAction && (
                      <p className="explain mt-1">{c.nextAction}</p>
                    )}
                  </td>
                  <td className="num" style={{ color: 'var(--ink)' }}>
                    {c.spend > 0 ? formatCurrency(Math.round(c.spend)) : '—'}
                  </td>
                  {/* Each campaign is scored on the KPI its objective was set
                      to optimise — ROAS for sales, CPM for awareness, CPC for
                      traffic — not on one shared purchase metric. */}
                  <td className="num">
                    {c.spend > 0 ? (
                      <>
                        <span
                          className="mono font-semibold"
                          style={{
                            color:
                              c.primaryKpi.status === 'good' ? 'var(--good)'
                              : c.primaryKpi.status === 'watch' ? 'var(--warn)'
                              : c.primaryKpi.status === 'bad' ? 'var(--bad)'
                              : 'var(--ink-3)',
                          }}
                        >
                          {c.primaryKpi.display}
                        </span>
                        <span className="explain block">
                          {c.primaryKpi.label}
                          {c.primaryKpi.targetDisplay
                            ? ` · aim ${c.primaryKpi.targetDisplay}`
                            : ''}
                        </span>
                        {!c.isRevenueObjective && c.costPerResultDisplay && (
                          <span className="explain block">
                            {c.costPerResultDisplay} per result
                          </span>
                        )}
                      </>
                    ) : (
                      <span style={{ color: 'var(--ink-3)' }}>—</span>
                    )}
                  </td>
                  {/* Profit is only a verdict for revenue objectives. Showing
                      "−₹56,156" against an awareness campaign implies a
                      shortfall on revenue nobody asked it to produce. */}
                  <td className="num">
                    {c.spend <= 0 ? (
                      <span style={{ color: 'var(--ink-3)' }}>—</span>
                    ) : c.isRevenueObjective ? (
                      <span className="mono font-semibold" style={{ color: profitColor }}>
                        {formatSignedCurrency(c.contributionProfit)}
                      </span>
                    ) : (
                      <span className="explain">not a sales goal</span>
                    )}
                  </td>
                  <td className="num" style={{ color: 'var(--ink-3)' }}>
                    {c.launchedAt ? formatRelativeTime(c.launchedAt) : '—'}
                    {c.daysRunning != null && (
                      <span className="explain block">{c.daysRunning}d run</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
