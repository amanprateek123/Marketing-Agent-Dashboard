'use client'

import { useState, useEffect, use, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle, Loader2, Minus,
  Play, Settings,
} from 'lucide-react'
import {
  formatCurrency, formatPercent, formatROASPlain, formatSignedCurrency,
} from '@/lib/utils'
import { getDashboardOverview } from '@/lib/api'
import { PlainMetric } from '@/components/plain/PlainMetric'
import { AlertFeed } from '@/components/overview/AlertFeed'
import { BreakevenBar } from '@/components/overview/BreakevenBar'
import { FacetBreakdown } from '@/components/overview/FacetBreakdown'
import { InsightList } from '@/components/overview/InsightList'
import { ActivityGrid } from '@/components/overview/ActivityGrid'
import type { DashboardOverview } from '@/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8082/api/v1'

const WINDOWS = [7, 30, 90] as const

interface PageProps {
  params: Promise<{ tenantId: string }>
}

export default function HomePage({ params }: PageProps) {
  const { tenantId } = use(params)
  const router = useRouter()

  const [data, setData] = useState<DashboardOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [windowDays, setWindowDays] = useState<number>(30)
  const [triggerState, setTriggerState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [triggerMessage, setTriggerMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await getDashboardOverview(tenantId, windowDays))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your dashboard")
    } finally {
      setLoading(false)
    }
  }, [tenantId, windowDays])

  useEffect(() => { void load() }, [load])

  async function handleTrigger() {
    setTriggerState('loading')
    setTriggerMessage('')
    try {
      const res = await fetch(`${API_BASE}/pipeline/${tenantId}/trigger`, { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = await res.json()
      setTriggerState('success')
      setTriggerMessage('Working on new ad ideas…')
      if (body?.runId) {
        setTimeout(() => router.push(`/dashboard/${tenantId}/runs/${body.runId}`), 900)
      } else {
        setTimeout(() => setTriggerState('idle'), 5000)
      }
    } catch (err) {
      setTriggerState('error')
      setTriggerMessage(err instanceof Error ? err.message : 'Something went wrong')
      setTimeout(() => setTriggerState('idle'), 4000)
    }
  }

  if (loading && !data) {
    return (
      <div className="px-8 py-8 max-w-[1600px] mx-auto">
        <div className="skeleton" style={{ height: 40, width: 320, marginBottom: 24 }} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 112 }} />
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="px-8 py-8 max-w-[1600px] mx-auto">
        <div
          className="flex items-center gap-3 rounded-xl px-5 py-4"
          style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad-border)', color: 'var(--bad)' }}
        >
          <AlertTriangle size={16} className="shrink-0" />
          <span>{error ?? 'No data'}</span>
          <button onClick={() => void load()} className="btn btn-ghost ml-auto">Retry</button>
        </div>
      </div>
    )
  }

  const { economics, portfolio, lifetime, trend, alerts, activity, window: win } = data
  const metaConnected = activity.meta.connected
  const criticalCount = alerts.filter(a => a.severity === 'critical').length

  return (
    <div className="min-h-screen">
      <div className="px-8 py-8 max-w-[1600px] mx-auto">

        {/* ── Hero ─────────────────────────────────────────────────── */}
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="page-title">Hi, here&rsquo;s what&rsquo;s happening today</h1>
            <p className="page-subtitle">
              {data.companyName || tenantId}
              {data.industry ? ` · ${data.industry}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              {WINDOWS.map((w) => (
                <button
                  key={w}
                  onClick={() => setWindowDays(w)}
                  className="chip"
                  style={{
                    cursor: 'pointer',
                    background: windowDays === w ? 'var(--accent-bg)' : 'transparent',
                    borderColor: windowDays === w ? 'var(--accent-border)' : 'var(--hairline)',
                    color: windowDays === w ? 'var(--accent-strong)' : 'var(--ink-3)',
                  }}
                >
                  {w}d
                </button>
              ))}
            </div>
            <button
              onClick={handleTrigger}
              disabled={triggerState === 'loading' || !metaConnected}
              /* Demoted from the primary action. Generating more ideas while
                 the account is below breakeven adds spend to a funnel that
                 loses money on every rupee — fixing what's live comes first,
                 and the alert feed below now carries that call to action. */
              className={
                'btn ' + (
                  triggerState === 'success' ? 'btn-ghost'
                  : triggerState === 'error' ? 'btn-danger'
                  : portfolio.isProfitable ? 'btn-accent'
                  : 'btn-ghost'
                )
              }
              title={!metaConnected ? 'Connect Meta first in Settings' : undefined}
            >
              {triggerState === 'loading' ? <Loader2 size={14} className="animate-spin" />
               : triggerState === 'success' ? <CheckCircle size={14} />
               : <Play size={13} fill="currentColor" />}
              {triggerState === 'loading' ? 'Thinking…'
                : triggerState === 'success' ? 'On it'
                : triggerState === 'error' ? 'Try again'
                : 'Come up with new ad ideas'}
            </button>
          </div>
        </div>
        {triggerMessage && (
          <p className="mb-4" style={{ color: triggerState === 'success' ? 'var(--good)' : 'var(--bad)' }}>
            {triggerMessage}
          </p>
        )}

        {!metaConnected && (
          <div
            className="card px-5 py-4 flex items-center gap-4 mb-5"
            style={{ borderColor: 'var(--warn-border)', background: 'var(--warn-bg)' }}
          >
            <AlertTriangle size={18} style={{ color: 'var(--warn)' }} className="shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold" style={{ color: 'var(--ink)' }}>Meta not connected yet</p>
              <p className="explain">Add your Meta Ads token in Settings so we can see your ads.</p>
            </div>
            <Link href={`/dashboard/${tenantId}/settings`} className="btn btn-ghost shrink-0">
              <Settings size={14} /> Open settings
            </Link>
          </div>
        )}

        {/* ── Breakeven context ────────────────────────────────────── */}
        <div className="mb-5">
          <BreakevenBar economics={economics} roas={portfolio.roas} />
        </div>

        {/* ── Top-line tiles ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-3">
          {/* Total across EVERY objective. The three tiles beside it cover
              sales campaigns only, so this one has to state the whole number
              or the page appears to lose track of real spend. */}
          <PlainMetric
            label={`Money spent · ${win.label.toLowerCase()}`}
            value={formatCurrency(Math.round(portfolio.totalSpendAllObjectives))}
            sub={
              portfolio.nonRevenueSpend > 0
                ? `${formatCurrency(Math.round(portfolio.spend))} on sales goals · ${formatCurrency(Math.round(portfolio.nonRevenueSpend))} on other goals`
                : `Across ${portfolio.campaignCount} campaign${portfolio.campaignCount === 1 ? '' : 's'}` +
                  (trend?.spendPct != null ? ` · ${signed(trend.spendPct)}% vs previous` : '')
            }
            help="Every campaign, all objectives. The tiles beside this one cover sales-objective campaigns only, since return and profit are only meaningful there."
          />
          <PlainMetric
            label="Money earned · sales goals"
            value={portfolio.revenue > 0 ? formatCurrency(Math.round(portfolio.revenue)) : '—'}
            sub={
              portfolio.revenue > 0
                ? formatROASPlain(portfolio.roas, economics.breakevenROAS)
                : 'No attributed revenue yet'
            }
            help="Revenue attributed by Meta's pixel, already net of refunds."
            health={portfolio.isProfitable ? 'good' : 'bad'}
          />
          {/* The tile the old dashboard was missing entirely: whether any of
              this actually made money once cost of goods is taken out. */}
          <PlainMetric
            label="Actual profit · sales goals"
            value={formatSignedCurrency(portfolio.contributionProfit)}
            sub={
              economics.hasMixedMargins
                ? "After each product's own margin"
                : `After ${formatPercent(economics.marginPct)} margin${economics.isEstimated ? ' (assumed)' : ''}`
            }
            help="Revenue × margin − spend, across sales-objective campaigns. Awareness, traffic and app campaigns are excluded — they were never asked for tracked revenue."
            health={portfolio.contributionProfit >= 0 ? 'good' : 'bad'}
          />
          <PlainMetric
            label="Money at risk"
            value={portfolio.moneyAtRisk > 0 ? formatCurrency(Math.round(portfolio.moneyAtRisk)) : '₹0'}
            sub={
              portfolio.campaignsBelowBreakeven > 0
                ? `${portfolio.campaignsBelowBreakeven} campaign${portfolio.campaignsBelowBreakeven === 1 ? '' : 's'} below breakeven · ${formatPercent(portfolio.pctSpendBelowBreakeven)} of spend`
                : 'Every campaign is above breakeven'
            }
            help="Contribution profit being destroyed by campaigns that lose money."
            health={portfolio.moneyAtRisk > 0 ? 'bad' : 'good'}
          />
        </div>

        {/* Window provenance + lifetime, stated rather than implied. The old
            page stacked a lifetime total on top of a 10-day table with no
            label on either. */}
        <div className="flex items-center gap-3 flex-wrap mb-8 explain">
          <span>
            {win.metricsSource === 'timeseries'
              ? `True ${win.days}-day window from daily data.`
              : `Daily data not synced — showing lifetime totals for campaigns started in the last ${win.days} days.`}
            {portfolio.nonRevenueCampaigns > 0 && (
              <>
                {' '}
                {portfolio.nonRevenueCampaigns} campaign
                {portfolio.nonRevenueCampaigns === 1 ? '' : 's'} run non-sales goals
                {portfolio.nonRevenueOffTarget > 0
                  ? ` (${portfolio.nonRevenueOffTarget} off target)`
                  : ''}{' '}
                and are judged on their own KPIs.
              </>
            )}
          </span>
          <span style={{ color: 'var(--ink-4)' }}>|</span>
          <span>
            Lifetime: {formatCurrency(Math.round(lifetime.spend))} spent ·{' '}
            {formatCurrency(Math.round(lifetime.revenue))} earned ·{' '}
            <span style={{ color: lifetime.isProfitable ? 'var(--good)' : 'var(--bad)' }}>
              {lifetime.roas.toFixed(2)}x
            </span>{' '}
            ·{' '}
            <span style={{ color: lifetime.contributionProfit >= 0 ? 'var(--good)' : 'var(--bad)' }}>
              {formatSignedCurrency(lifetime.contributionProfit)} profit
            </span>
          </span>
          {trend && (
            <>
              <span style={{ color: 'var(--ink-4)' }}>|</span>
              <span className="inline-flex items-center gap-1">
                <TrendIcon direction={trend.direction} />
                <span
                  style={{
                    color:
                      trend.direction === 'improving' ? 'var(--good)'
                      : trend.direction === 'declining' ? 'var(--bad)'
                      : 'var(--ink-3)',
                  }}
                >
                  {trend.direction === 'flat'
                    ? 'Flat vs previous period'
                    : `${trend.direction === 'improving' ? 'Improving' : 'Declining'}${
                        trend.roasPct != null ? ` · ${signed(trend.roasPct)}% return` : ''
                      }`}
                </span>
              </span>
            </>
          )}
        </div>

        {/* ── Attention + learnings ────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
          <div className="lg:col-span-2 card overflow-hidden">
            <div
              className="px-5 py-4 flex items-center gap-2.5"
              style={{ borderBottom: '1px solid var(--hairline)' }}
            >
              <AlertTriangle
                size={18}
                style={{ color: criticalCount > 0 ? 'var(--bad)' : 'var(--ink-3)' }}
              />
              <h2 className="section-title">What needs your attention</h2>
              {criticalCount > 0 && (
                <span className="ml-auto chip chip-bad">{criticalCount} urgent</span>
              )}
            </div>
            <AlertFeed alerts={alerts} />
          </div>

          <InsightList insights={data.insights} tenantId={tenantId} />
        </div>

        {/* ── Grouped performance ──────────────────────────────────── */}
        <div className="mb-8">
          <FacetBreakdown facets={data.facets} breakevenROAS={economics.breakevenROAS} />
        </div>

        {/* The per-campaign table lives on /campaigns, not here. This page
            answers "what's happening and what needs me", which the tiles,
            alert feed and grouped view already cover; an 18-row table
            underneath repeated the same verdicts one campaign at a time. */}

        {/* ── Everything else under this tenant ────────────────────── */}
        <div className="mb-3">
          <h2 className="section-title mb-1">Everything else running</h2>
          <p className="explain mb-4">
            The rest of the system working on this account.
          </p>
          <ActivityGrid activity={activity} tenantId={tenantId} />
        </div>
      </div>
    </div>
  )
}

function TrendIcon({ direction }: { direction: 'improving' | 'declining' | 'flat' }) {
  if (direction === 'improving') return <ArrowUpRight size={13} style={{ color: 'var(--good)' }} />
  if (direction === 'declining') return <ArrowDownRight size={13} style={{ color: 'var(--bad)' }} />
  return <Minus size={13} style={{ color: 'var(--ink-3)' }} />
}

function signed(pct: number): string {
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}`
}
