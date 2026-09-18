'use client'

import { useState } from 'react'
import { formatCurrency, formatPercent, formatSignedCurrency } from '@/lib/utils'
import type { FacetRollup } from '@/types'

type Tab = 'objective' | 'product' | 'funnel' | 'budget' | 'language'

/**
 * Rollups across the dimensions encoded in campaign names.
 *
 * This is the view the old dashboard could not produce at all, because it
 * treated names as opaque strings. Grouped by product it becomes obvious that
 * every Nadi-Report campaign loses money while the single Nadi-Leaf campaign
 * is the only profitable one — a product-level conclusion that no amount of
 * per-campaign detail surfaces, and one that changes what you do next.
 */
export function FacetBreakdown({
  facets,
  breakevenROAS,
}: {
  facets: {
    byProduct: FacetRollup[]
    byFunnel: FacetRollup[]
    byBudgetModel: FacetRollup[]
    byLanguage: FacetRollup[]
    byObjective: FacetRollup[]
  }
  breakevenROAS: number
}) {
  const [tab, setTab] = useState<Tab>('objective')

  const data: Record<Tab, { rows: FacetRollup[]; empty: string }> = {
    objective: { rows: facets.byObjective, empty: 'No objectives found.' },
    product: { rows: facets.byProduct, empty: 'No product names could be parsed.' },
    funnel: { rows: facets.byFunnel, empty: 'No funnel stages found in campaign names.' },
    budget: { rows: facets.byBudgetModel, empty: 'No ABO/CBO markers found.' },
    language: { rows: facets.byLanguage, empty: 'No language markers found.' },
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'objective', label: 'Goal' },
    { key: 'product', label: 'Product' },
    { key: 'funnel', label: 'Funnel stage' },
    { key: 'budget', label: 'Budget model' },
    { key: 'language', label: 'Language' },
  ]

  const rows = data[tab].rows
  const maxSpend = Math.max(...rows.map((r) => r.spend), 1)

  return (
    <div className="card overflow-hidden">
      <div
        className="px-5 py-4"
        style={{ borderBottom: '1px solid var(--hairline)' }}
      >
        <h2 className="section-title">What&rsquo;s working, grouped</h2>
        <p className="explain mt-1">
          {tab === 'objective'
            ? 'Grouped by what each campaign was told to optimise. Return only means something for sales goals.'
            : 'Parsed from your campaign names — the pattern is usually clearer here than campaign by campaign.'}
        </p>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="chip"
              style={{
                cursor: 'pointer',
                background: tab === t.key ? 'var(--accent-bg)' : 'transparent',
                borderColor: tab === t.key ? 'var(--accent-border)' : 'var(--hairline)',
                color: tab === t.key ? 'var(--accent-strong)' : 'var(--ink-3)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="explain">{data[tab].empty}</p>
        </div>
      ) : (
        <div>
          {rows.map((r) => {
            const good = r.roas >= breakevenROAS
            return (
              <div
                key={r.key}
                className="px-5 py-3.5"
                style={{ borderTop: '1px solid var(--hairline-light)' }}
              >
                <div className="flex items-baseline justify-between gap-3 mb-2">
                  <span className="font-semibold truncate" style={{ color: 'var(--ink)' }}>
                    {r.label}
                  </span>
                  <span
                    className="mono font-semibold shrink-0"
                    style={{ color: good ? 'var(--good)' : 'var(--bad)' }}
                  >
                    {r.roas.toFixed(2)}x
                  </span>
                </div>

                <div
                  className="rounded-full overflow-hidden mb-2"
                  style={{ height: 5, background: 'var(--bg-muted)' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(r.spend / maxSpend) * 100}%`,
                      background: good ? 'var(--good)' : 'var(--bad)',
                      opacity: 0.75,
                    }}
                  />
                </div>

                <div className="flex items-center gap-3 flex-wrap explain">
                  <span>
                    {formatCurrency(Math.round(r.spend))} spent
                    {' · '}
                    {formatPercent(r.spendShare)} of budget
                  </span>
                  <span>
                    {r.campaignCount} campaign{r.campaignCount === 1 ? '' : 's'}
                  </span>
                  <span
                    className="mono ml-auto"
                    style={{ color: r.contributionProfit >= 0 ? 'var(--good)' : 'var(--bad)' }}
                  >
                    {formatSignedCurrency(r.contributionProfit)} profit
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
