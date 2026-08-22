'use client'

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clock3,
  Database,
  Gauge,
  Loader2,
  Play,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react'
import {
  formatCurrency,
  formatRelativeTime,
} from '@/lib/utils'
import { getDashboardOverview } from '@/lib/api'
import { ActivityGrid } from '@/components/overview/ActivityGrid'
import { AlertFeed } from '@/components/overview/AlertFeed'
import { GrowthLoop } from '@/components/overview/GrowthLoop'
import { InsightList } from '@/components/overview/InsightList'
import { ObjectiveHealth } from '@/components/overview/ObjectiveHealth'
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
    } catch {
      setError("We couldn't refresh the latest Meta and Meridian data.")
    } finally {
      setLoading(false)
    }
  }, [tenantId, windowDays])

  useEffect(() => {
    void load()
  }, [load])

  async function handleTrigger() {
    setTriggerState('loading')
    setTriggerMessage('')
    try {
      const res = await fetch(`${API_BASE}/pipeline/${tenantId}/trigger`, { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = await res.json()
      setTriggerState('success')
      setTriggerMessage('Meridian is developing new ad ideas now.')
      if (body?.runId) {
        setTimeout(() => router.push(`/dashboard/${tenantId}/runs/${body.runId}`), 900)
      } else {
        setTimeout(() => setTriggerState('idle'), 5000)
      }
    } catch {
      setTriggerState('error')
      setTriggerMessage("New ad ideas couldn't start. Please try again.")
      setTimeout(() => setTriggerState('idle'), 4000)
    }
  }

  if (loading && !data) return <CommandCenterSkeleton />

  if (error || !data) {
    return (
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div
          role="alert"
          className="card mx-auto flex max-w-2xl flex-col items-start gap-4 px-5 py-5 sm:flex-row sm:items-center"
          style={{ background: 'var(--bad-bg)', borderColor: 'var(--bad-border)' }}
        >
          <span
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'var(--surface)', color: 'var(--bad)' }}
          >
            <AlertTriangle size={18} aria-hidden="true" />
          </span>
          <div className="flex-1">
            <p className="font-semibold" style={{ color: 'var(--ink)' }}>
              The latest growth view could not be loaded
            </p>
            <p className="explain mt-1">{error ?? 'No dashboard data was returned.'}</p>
          </div>
          <button type="button" onClick={() => void load()} className="btn btn-ghost">
            <RefreshCw size={14} aria-hidden="true" /> Retry
          </button>
        </div>
      </main>
    )
  }

  const { activity, alerts, campaigns, lifetime, portfolio, window: win } = data
  const metaConnected = activity.meta.connected
  const partialCoverage = win.metricsSource === 'partial-timeseries'
  const criticalCount = alerts.filter((alert) => alert.severity === 'critical').length
  const allGoalsHaveNoSpend = portfolio.totalSpendAllObjectives <= 0
  const salesHaveSpend = portfolio.spend > 0
  const returnEvidence = portfolio.returnEvidence
  const hasKnownReturn = returnEvidence.knownCampaigns > 0
  const completeReturnEvidence = returnEvidence.status !== 'incomplete'
  const resolvedMetaReturn = returnEvidence.status === 'complete_meta'
  const rawValueGap = returnEvidence.knownRevenue - returnEvidence.knownSpend
  const rawReturnAboveSpend = hasKnownReturn && returnEvidence.knownRoas >= 1
  const openProposals = activity.queue.pendingActions + activity.queue.pendingDecisions

  const heroMetric = allGoalsHaveNoSpend
    ? 'Ready'
    : formatCurrency(Math.round(portfolio.totalSpendAllObjectives))
  const heroMetricLabel = allGoalsHaveNoSpend
    ? 'to plan your next growth campaign'
    : 'ad spend monitored'

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <header className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="chip chip-accent">
                <Bot size={12} aria-hidden="true" /> Growth Command Center
              </span>
              <span className={metaConnected ? 'chip chip-good' : 'chip chip-warn'}>
                <span className={metaConnected ? 'beacon' : 'beacon beacon-bad'} aria-hidden="true" />
                {metaConnected ? 'Meta connected' : 'Meta needs connection'}
              </span>
            </div>
            <h1 className="page-title">{data.companyName || 'Your business'} growth, in one view</h1>
            <p className="page-subtitle">
              {data.industry ? `${data.industry} · ` : ''}
              View generated {formatRelativeTime(data.generatedAt)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              className="flex items-center gap-1 rounded-xl p-1"
              style={{ background: 'var(--surface)', border: '1px solid var(--hairline)' }}
              aria-label="Reporting window"
            >
              {WINDOWS.map((window) => (
                <button
                  key={window}
                  type="button"
                  onClick={() => setWindowDays(window)}
                  aria-pressed={windowDays === window}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                  style={{
                    background: windowDays === window ? 'var(--ink)' : 'transparent',
                    color: windowDays === window ? 'var(--paper)' : 'var(--ink-3)',
                  }}
                >
                  {window} days
                </button>
              ))}
            </div>
            <Link href={`/dashboard/${tenantId}/campaign-copilot`} className="btn btn-accent">
              <Sparkles size={14} aria-hidden="true" /> Plan with Copilot
            </Link>
            <button
              type="button"
              onClick={handleTrigger}
              disabled={triggerState === 'loading' || !metaConnected}
              className={triggerState === 'error' ? 'btn btn-danger' : 'btn btn-ghost'}
              title={!metaConnected ? 'Connect Meta first in Settings' : undefined}
            >
              {triggerState === 'loading' ? (
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              ) : triggerState === 'success' ? (
                <CheckCircle2 size={14} aria-hidden="true" />
              ) : (
                <Play size={13} fill="currentColor" aria-hidden="true" />
              )}
              {triggerState === 'loading'
                ? 'Developing ideas…'
                : triggerState === 'success'
                  ? 'Ideas in progress'
                  : triggerState === 'error'
                    ? 'Try ideas again'
                    : 'Generate ad ideas'}
            </button>
          </div>
        </header>

        <div aria-live="polite" className="min-h-0">
          {triggerMessage && (
            <p
              className="mb-4 text-sm font-medium"
              style={{ color: triggerState === 'success' ? 'var(--good)' : 'var(--bad)' }}
            >
              {triggerMessage}
            </p>
          )}
        </div>

        {!metaConnected && (
          <section
            className="card mb-5 flex flex-col items-start gap-4 px-5 py-4 sm:flex-row sm:items-center"
            style={{ borderColor: 'var(--warn-border)', background: 'var(--warn-bg)' }}
          >
            <AlertTriangle size={18} style={{ color: 'var(--warn)' }} className="shrink-0" aria-hidden="true" />
            <div className="flex-1">
              <p className="font-semibold" style={{ color: 'var(--ink)' }}>Connect Meta to activate the growth loop</p>
              <p className="explain mt-0.5">Meridian needs account, Page and measurement access before it can sync evidence or prepare launches.</p>
            </div>
            <Link href={`/dashboard/${tenantId}/settings`} className="btn btn-ghost">
              <Settings size={14} aria-hidden="true" /> Open settings
            </Link>
          </section>
        )}

        {partialCoverage && (
          <section
            className="card mb-5 flex flex-col items-start gap-4 px-5 py-4 sm:flex-row sm:items-center"
            style={{ borderColor: 'var(--warn-border)', background: 'var(--warn-bg)' }}
            role="status"
          >
            <Database size={18} style={{ color: 'var(--warn)' }} className="shrink-0" aria-hidden="true" />
            <div className="flex-1">
              <p className="font-semibold" style={{ color: 'var(--ink)' }}>Daily evidence is incomplete</p>
              <p className="explain mt-0.5">
                This view covers {win.coverage.campaignsWithRows} of {win.coverage.eligibleCampaigns} campaigns expected to have delivered in this window. Totals exclude {win.coverage.campaignsWithoutRows} campaign{win.coverage.campaignsWithoutRows === 1 ? '' : 's'} without daily rows.
              </p>
            </div>
            <Link href={`/dashboard/${tenantId}/campaigns`} className="btn btn-ghost">Review sync coverage</Link>
          </section>
        )}

        <section
          aria-labelledby="business-outcome-title"
          className="card card-hero noise-bg relative mb-5 overflow-hidden"
          style={{ borderColor: completeReturnEvidence && rawReturnAboveSpend ? 'var(--good-border)' : 'var(--accent-border)' }}
        >
          <div
            className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full blur-3xl"
            style={{ background: completeReturnEvidence && rawReturnAboveSpend ? 'var(--good-bg)' : 'var(--accent-bg)' }}
            aria-hidden="true"
          />
          <div className="relative grid grid-cols-1 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.5fr)]">
            <div className="px-5 py-6 sm:px-7 sm:py-7 lg:px-8">
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <p className="micro-label">Account-wide growth oversight · {win.label.toLowerCase()}</p>
                {!completeReturnEvidence && salesHaveSpend && (
                  <Link href={`/dashboard/${tenantId}/campaigns`} className="chip chip-warn">
                    Revenue coverage {returnEvidence.knownCampaigns}/{returnEvidence.campaignsWithSpend}
                    <ArrowRight size={12} aria-hidden="true" />
                  </Link>
                )}
              </div>
              <h2
                id="business-outcome-title"
                className="max-w-4xl font-semibold tracking-[-0.035em]"
                style={{ color: 'var(--ink)', fontSize: 'clamp(2.35rem, 4vw, 3.75rem)', lineHeight: 1.02 }}
              >
                <span className="display-num block">{heroMetric}</span>
                <span
                  className="mt-2 block font-semibold tracking-[-0.025em]"
                  style={{ color: 'var(--ink-2)', fontSize: 'clamp(1.15rem, 1.8vw, 1.65rem)', lineHeight: 1.2 }}
                >
                  {heroMetricLabel}
                </span>
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-6 sm:text-base" style={{ color: 'var(--ink-2)' }}>
                {allGoalsHaveNoSpend
                  ? 'Start with a business goal. Copilot can shape the audience, budget, creative and measurement plan for review.'
                  : `Meridian is monitoring ${portfolio.campaignCount} campaign${portfolio.campaignCount === 1 ? '' : 's'} across sales and objective-specific growth goals. Results from campaigns launched by Meridian are isolated on the Impact page.`}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link href={`/dashboard/${tenantId}/tool-impact`} className="btn btn-primary">
                  Open Meridian impact <ArrowRight size={14} aria-hidden="true" />
                </Link>
                {!completeReturnEvidence && salesHaveSpend ? (
                  <Link href={`/dashboard/${tenantId}/campaigns`} className="btn btn-ghost">
                    Review revenue coverage
                  </Link>
                ) : (
                  <p className="explain max-w-xl">
                    {win.metricsSource === 'timeseries'
                      ? `Measured from true daily campaign data for this ${win.days}-day window.`
                      : partialCoverage
                        ? `${win.coverage.campaignsWithRows} of ${win.coverage.eligibleCampaigns} expected campaigns have daily rows.`
                        : `Daily data is not synced, so this view uses the available campaign totals.`}
                  </p>
                )}
              </div>
            </div>

            <div
              className="relative flex flex-col justify-between px-5 py-6 sm:px-7 xl:border-l xl:px-6"
              style={{ borderColor: 'var(--hairline)', background: 'rgba(255,255,255,0.68)' }}
            >
              <div>
                <p className="micro-label">Workspace status</p>
                <div className="mt-5 space-y-5">
                  <HeroSignal
                    icon={Gauge}
                    value={portfolio.campaignCount}
                    label={`campaign${portfolio.campaignCount === 1 ? '' : 's'} monitored · ${win.label.toLowerCase()}`}
                  />
                  <HeroSignal icon={Sparkles} value={activity.creatives.ready} label="creative assets ready now" />
                  <HeroSignal
                    icon={Target}
                    value={openProposals}
                    label={`growth decision${openProposals === 1 ? '' : 's'} awaiting review`}
                  />
                </div>
              </div>
              <Link
                href={`/dashboard/${tenantId}/runs`}
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold"
                style={{ color: 'var(--accent-strong)' }}
              >
                See AI activity <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <section aria-label="Growth outcome metrics" className="stagger mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {hasKnownReturn ? (
            <>
              <OutcomeMetric
                label={partialCoverage ? 'Covered investment · all goals' : 'Account investment · all goals'}
                value={formatCurrency(Math.round(portfolio.totalSpendAllObjectives))}
                detail={portfolio.nonRevenueSpend > 0
                  ? `${formatCurrency(Math.round(portfolio.spend))} sales · ${formatCurrency(Math.round(portfolio.nonRevenueSpend))} other goals`
                  : `${portfolio.campaignCount} campaign${portfolio.campaignCount === 1 ? '' : 's'} in view`}
                icon={Gauge}
              />
              <OutcomeMetric
                label={resolvedMetaReturn ? 'Meta-attributed action value' : 'Verified recorded action value'}
                value={formatCurrency(Math.round(returnEvidence.knownRevenue))}
                detail={`Covers ${returnEvidence.knownCampaigns}/${returnEvidence.campaignsWithSpend} sales campaigns`}
                icon={ArrowUpRight}
                tone={completeReturnEvidence ? (rawReturnAboveSpend ? 'good' : 'bad') : 'neutral'}
              />
              <OutcomeMetric
                label="Verified-evidence raw ROAS"
                value={`${returnEvidence.knownRoas.toFixed(2)}x`}
                detail="Campaign-scoped recorded action value ÷ covered sales spend"
                icon={Activity}
                tone={completeReturnEvidence ? (rawReturnAboveSpend ? 'good' : 'bad') : 'neutral'}
              />
              <OutcomeMetric
                label="Known action-value gap"
                value={`${rawValueGap >= 0 ? '+' : '−'}${formatCurrency(Math.round(Math.abs(rawValueGap)))}`}
                detail={completeReturnEvidence ? 'Recorded action value minus sales spend; not contribution profit' : 'Verified campaigns only; unresolved rows remain withheld'}
                icon={Gauge}
                tone={completeReturnEvidence ? (rawValueGap >= 0 ? 'good' : 'bad') : 'neutral'}
              />
            </>
          ) : (
            <>
              <OutcomeMetric
                label={partialCoverage ? 'Covered sales spend' : 'Sales spend monitored'}
                value={formatCurrency(Math.round(portfolio.spend))}
                detail={`${returnEvidence.campaignsWithSpend} sales campaign${returnEvidence.campaignsWithSpend === 1 ? '' : 's'} with spend`}
                icon={Gauge}
              />
              <OutcomeMetric
                label="Other growth goals"
                value={formatCurrency(Math.round(portfolio.nonRevenueSpend))}
                detail={`${portfolio.nonRevenueCampaigns} awareness, reach, traffic or engagement campaign${portfolio.nonRevenueCampaigns === 1 ? '' : 's'}`}
                icon={Target}
              />
              <OutcomeMetric
                label="Campaigns monitored"
                value={portfolio.campaignCount.toLocaleString('en-IN')}
                detail={`Delivery evidence for the ${win.label.toLowerCase()} reporting window`}
                icon={Activity}
              />
              <OutcomeMetric
                label="Revenue-ready campaigns"
                value={`${returnEvidence.knownCampaigns} / ${returnEvidence.campaignsWithSpend}`}
                detail="Product mapping and a fresh Meta sync are required before raw ROAS is shown"
                icon={Database}
                tone="warn"
              />
            </>
          )}
        </section>

        <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.4fr)]">
          <ObjectiveHealth campaigns={campaigns} objectives={data.facets.byObjective} tenantId={tenantId} />
          <TrustPanel data={data} tenantId={tenantId} />
        </div>

        <div className="mb-5">
          <GrowthLoop activity={activity} insights={data.insights} portfolio={portfolio} tenantId={tenantId} />
        </div>

        <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
          <section className="card overflow-hidden lg:col-span-2" aria-labelledby="attention-title">
            <div
              className="flex items-center gap-2.5 px-5 py-4"
              style={{ borderBottom: '1px solid var(--hairline)' }}
            >
              <AlertTriangle size={17} style={{ color: criticalCount > 0 ? 'var(--bad)' : 'var(--ink-3)' }} aria-hidden="true" />
              <div>
                <p className="micro-label">Next best action</p>
                <h2 id="attention-title" className="section-title">What needs a decision</h2>
              </div>
              <span className={`ml-auto ${criticalCount > 0 ? 'chip chip-bad' : 'chip chip-good'}`}>
                {criticalCount > 0 ? `${criticalCount} urgent` : 'No urgent risks'}
              </span>
            </div>
            <AlertFeed alerts={alerts} />
          </section>
          <InsightList insights={data.insights} tenantId={tenantId} />
        </div>

        <section aria-labelledby="system-pulse-title">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="micro-label mb-1">Operations</p>
              <h2 id="system-pulse-title" className="section-title">System pulse</h2>
            </div>
            <p className="explain">Connections, production, review queues and evidence freshness</p>
          </div>
          <ActivityGrid activity={activity} tenantId={tenantId} />
        </section>

        <footer className="mt-8 flex flex-col gap-2 border-t pt-4 text-xs sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'var(--hairline)', color: 'var(--ink-4)' }}>
          <span>Reporting window: {win.label} · Generated {formatRelativeTime(data.generatedAt)}</span>
          <span>Account lifetime: {formatCurrency(Math.round(lifetime.spend))} spend · open Campaigns for basis-aware return evidence</span>
        </footer>
      </div>
    </main>
  )
}

function CommandCenterSkeleton() {
  return (
    <main aria-busy="true" aria-label="Loading growth command center" className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <span className="sr-only" role="status">Loading the latest growth evidence</span>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <div className="skeleton mb-3 h-6 w-44" />
          <div className="skeleton h-9 w-72 max-w-full" />
        </div>
        <div className="skeleton hidden h-10 w-64 sm:block" />
      </div>
      <div className="skeleton mb-4 h-80 w-full rounded-2xl" />
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => <div key={item} className="skeleton h-32" />)}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="skeleton h-72 lg:col-span-2" />
        <div className="skeleton h-72" />
      </div>
    </main>
  )
}

function OutcomeMetric({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string
  value: string
  detail: string
  icon: typeof Activity
  tone?: 'good' | 'bad' | 'warn' | 'neutral'
}) {
  const color = tone === 'good'
    ? 'var(--good)'
    : tone === 'bad'
      ? 'var(--bad)'
      : tone === 'warn'
        ? 'var(--warn)'
        : 'var(--ink)'
  const background = tone === 'good'
    ? 'var(--good-bg)'
    : tone === 'bad'
      ? 'var(--bad-bg)'
      : tone === 'warn'
        ? 'var(--warn-bg)'
        : 'var(--surface-warm)'
  return (
    <article className="card card-metric min-w-0 px-5 py-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="micro-label">{label}</p>
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ color, background }}>
          <Icon size={15} aria-hidden="true" />
        </span>
      </div>
      <p className="display-num text-3xl" style={{ color }}>{value}</p>
      <p className="explain mt-2">{detail}</p>
    </article>
  )
}

function HeroSignal({ icon: Icon, value, label }: { icon: typeof Activity; value: number; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{ background: 'var(--accent-bg)', color: 'var(--accent-strong)' }}
      >
        <Icon size={16} aria-hidden="true" />
      </span>
      <div>
        <span className="display-num text-xl" style={{ color: 'var(--ink)' }}>{value.toLocaleString('en-IN')}</span>
        <p className="explain">{label}</p>
      </div>
    </div>
  )
}

function TrustPanel({ data, tenantId }: { data: DashboardOverview; tenantId: string }) {
  const { activity, economics } = data
  const trustRows = [
    {
      icon: ShieldCheck,
      label: 'Human review',
      value: `${activity.queue.pendingApprovalCampaigns} campaign${activity.queue.pendingApprovalCampaigns === 1 ? '' : 's'} awaiting approval`,
      href: `/dashboard/${tenantId}/approvals`,
      healthy: true,
    },
    {
      icon: RefreshCw,
      label: 'Evidence freshness',
      value: activity.sync.campaignsWithoutFreshness > 0
        ? `${activity.sync.campaignsWithoutFreshness}/${activity.sync.activeCampaignCount} active campaigns lack a metrics timestamp`
        : activity.sync.lastSyncAt
          ? `${activity.sync.staleCampaignCount === 0 ? 'All timestamped active campaigns are within threshold' : `${activity.sync.staleCampaignCount} stale`} · latest evidence ${formatRelativeTime(activity.sync.lastSyncAt)}`
          : 'No active campaign metrics timestamp',
      href: `/dashboard/${tenantId}/campaigns`,
      healthy: activity.sync.campaignsWithoutFreshness === 0 && activity.sync.staleCampaignCount === 0 && Boolean(activity.sync.lastSyncAt),
    },
    {
      icon: Gauge,
      label: 'Economics basis',
      value: economics.isEstimated
        ? 'Margin is assumed; raw command-center proof excludes contribution'
        : economics.hasMixedMargins
          ? 'Product margins are stored; contribution is withheld from this demo'
          : `${economics.productName ?? 'Primary product'} economics stored; raw proof shown above`,
      href: `/dashboard/${tenantId}/settings`,
      healthy: !economics.isEstimated,
    },
    {
      icon: Clock3,
      label: 'Reporting evidence',
      value: data.window.metricsSource === 'timeseries'
        ? `True daily evidence · ${data.window.label.toLowerCase()}`
        : data.window.metricsSource === 'partial-timeseries'
          ? `Partial daily evidence · ${data.window.coverage.campaignsWithRows}/${data.window.coverage.eligibleCampaigns} campaigns covered`
          : `Campaign lifetime fallback · ${data.window.label.toLowerCase()}`,
      href: `/dashboard/${tenantId}/tool-impact`,
      healthy: data.window.metricsSource === 'timeseries',
    },
  ]

  return (
    <aside className="card overflow-hidden" aria-labelledby="trust-panel-title">
      <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--hairline)' }}>
        <p className="micro-label mb-1.5">Proof &amp; safety</p>
        <h2 id="trust-panel-title" className="section-title">Trust the number before acting</h2>
      </div>
      <div>
        {trustRows.map((row, index) => {
          const Icon = row.icon
          return (
            <Link
              key={row.label}
              href={row.href}
              className="group flex items-start gap-3 px-5 py-4 transition-colors hover:bg-[var(--surface-warm)]"
              style={{ borderTop: index > 0 ? '1px solid var(--hairline-light)' : undefined }}
            >
              <span
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ background: row.healthy ? 'var(--good-bg)' : 'var(--warn-bg)', color: row.healthy ? 'var(--good)' : 'var(--warn)' }}
              >
                <Icon size={14} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{row.label}</p>
                <p className="explain mt-0.5">{row.value}</p>
              </div>
              <ArrowRight size={14} className="mt-1 shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: 'var(--ink-4)' }} aria-hidden="true" />
            </Link>
          )
        })}
      </div>
    </aside>
  )
}
