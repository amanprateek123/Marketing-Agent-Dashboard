'use client'

import { use, useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Database,
  Download,
  Gauge,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Zap,
} from 'lucide-react'
import { plainLabel } from '@/lib/utils'
import {
  formatInr,
  formatRelative,
  formatWhen,
  humanise,
  PLAIN_ERROR,
  plainStatus,
} from '@/lib/plain-language'
import { Details } from '@/components/plain/Details'
import { getToolImpact } from '@/lib/api'
import type {
  DashboardCampaignRow,
  ToolImpactBrainReliability,
  ToolImpactOverview,
  ToolImpactScope,
} from '@/types'
import {
  ActionValueGapChart,
  CampaignDailyDrilldown,
  CampaignEvidenceTable,
  CampaignSpendValueChart,
  DailySpendValueChart,
  DecisionActivityChart,
  formatActionValueRoas,
  LaunchFunnelChart,
  NonSalesPerformanceChart,
  returnBasisLabel,
} from './performance-visuals'

interface PageProps {
  params: Promise<{ tenantId: string }>
}

type MetricHealth = 'good' | 'watch' | 'bad' | 'neutral'

const SCOPE_COPY: Record<
  ToolImpactScope,
  { label: string; shortLabel: string }
> = {
  agent: {
    label: 'Campaigns the AI launched on its own',
    shortLabel: 'AI only',
  },
  managed: {
    label: 'Every campaign launched from this dashboard',
    shortLabel: 'Everything launched here',
  },
}

/** '+₹1,200' / '−₹800' — money with a sign, for "sales minus spend". */
function formatSignedInr(amount: number): string {
  return `${amount < 0 ? '−' : '+'}${formatInr(Math.abs(amount))}`
}

const TOOL_IMPACT_SALES_OBJECTIVES = new Set([
  'OUTCOME_SALES', 'SALES', 'CONVERSIONS', 'OUTCOME_CONVERSIONS',
  'PRODUCT_CATALOG_SALES', 'CATALOG_SALES', 'OUTCOME_CATALOG_SALES',
  'RETARGETING', 'RETARGETING_SALES',
])

function isStrictSalesCampaign(campaign: DashboardCampaignRow): boolean {
  return TOOL_IMPACT_SALES_OBJECTIVES.has(String(campaign.objective ?? '').trim().toUpperCase())
}

function hasProofReturn(campaign: DashboardCampaignRow): boolean {
  return isStrictSalesCampaign(campaign) &&
    (campaign.revenueBasis === 'meta_action_value' || campaign.revenueBasis === 'no_attributed_revenue') &&
    !['unknown', 'unresolved', 'account_fallback'].includes(campaign.revenueAttributionSource)
}

function hasLaunchEvidence(campaign: DashboardCampaignRow): boolean {
  return (
    campaign.toolImpactStage === 'verified_zero_spend' ||
    campaign.toolImpactStage === 'with_spend_immature' ||
    campaign.toolImpactStage === 'mature'
  )
}

function formatDuration(hours: number | null | undefined): string {
  if (hours == null || !Number.isFinite(hours)) return '—'
  if (hours < 1) return `${Math.round(hours * 60)} min`
  return hours < 24
    ? `${hours.toFixed(hours < 10 ? 1 : 0)} hours`
    : `${(hours / 24).toFixed(1)} days`
}

function formatModeledDelta(deltaPct: number): string {
  const rounded = Math.round(Math.abs(deltaPct) * 10) / 10
  if (rounded === 0) return '0%'
  return `${deltaPct > 0 ? '+' : '−'}${rounded}%`
}

function csvCell(value: unknown): string {
  let valueAsText = value == null ? '' : String(value)
  if (
    typeof value === 'string' &&
    (/^[\t\r]/.test(valueAsText) || /^\s*[=+\-@]/.test(valueAsText))
  ) {
    valueAsText = `'${valueAsText}`
  }
  return `"${valueAsText.replaceAll('"', '""')}"`
}

function DemoMetric({
  label,
  value,
  sub,
  health = 'neutral',
}: {
  label: string
  value: string
  sub: string
  health?: MetricHealth
}) {
  const color =
    health === 'good'
      ? 'var(--good)'
      : health === 'watch'
        ? 'var(--warn)'
        : health === 'bad'
          ? 'var(--bad)'
          : 'var(--ink)'

  return (
    <div className="card card-metric px-4 sm:px-5 py-5 min-w-0">
      <div className="flex items-center gap-2 mb-2">
        {health !== 'neutral' && (
          <span
            className="rounded-full"
            style={{ width: 8, height: 8, background: color }}
          />
        )}
        <p className="micro-label">{label}</p>
      </div>
      <p className="display-num" style={{ fontSize: 34, color }}>
        {value}
      </p>
      <p className="explain mt-2 break-words">{sub}</p>
    </div>
  )
}

function Disclosure({
  title,
  badge,
  icon,
  children,
}: {
  title: string
  badge?: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <details className="card overflow-hidden group">
      <summary className="list-none cursor-pointer px-4 sm:px-5 py-4 flex items-center gap-3 [&::-webkit-details-marker]:hidden">
        <span className="shrink-0" style={{ color: 'var(--accent)' }}>{icon}</span>
        <span className="font-semibold min-w-0 break-words" style={{ color: 'var(--ink)' }}>
          {title}
        </span>
        {badge && <span className="chip chip-neutral ml-auto shrink-0">{badge}</span>}
        <ChevronDown
          size={16}
          className={`${badge ? '' : 'ml-auto'} transition-transform group-open:rotate-180`}
          style={{ color: 'var(--ink-3)' }}
        />
      </summary>
      <div
        className="px-4 sm:px-5 py-5"
        style={{ borderTop: '1px solid var(--hairline)' }}
      >
        {children}
      </div>
    </details>
  )
}

export default function AgentAchievementPage({ params }: PageProps) {
  const { tenantId } = use(params)
  // The founder-facing product claim is "launched through Meridian", which
  // includes recorded autonomous and recorded dashboard launches. AI-only is
  // still one click away and never silently absorbs human-created records.
  const [scope, setScope] = useState<ToolImpactScope>('managed')
  const [performanceView, setPerformanceView] = useState<
    'comparison' | 'gap'
  >('comparison')
  const [data, setData] = useState<ToolImpactOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestNumber = useRef(0)

  const load = useCallback(async () => {
    const request = ++requestNumber.current
    setLoading(true)
    setError(null)
    try {
      const result = await getToolImpact(tenantId, scope)
      if (request === requestNumber.current) setData(result)
    } catch (err) {
      if (request === requestNumber.current) {
        setError(
          err instanceof Error
            ? err.message
            : "Couldn't load the results",
        )
      }
    } finally {
      if (request === requestNumber.current) setLoading(false)
    }
  }, [scope, tenantId])

  useEffect(() => {
    void load()
  }, [load])

  if (loading && !data) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-[1600px] mx-auto">
        <div
          className="skeleton"
          style={{ height: 42, width: 300, marginBottom: 24 }}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="skeleton" style={{ height: 126 }} />
          ))}
        </div>
      </div>
    )
  }

  if ((error && !data) || !data) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-[1600px] mx-auto">
        <div
          className="flex items-center gap-3 rounded-xl px-5 py-4 flex-wrap"
          style={{
            background: 'var(--bad-bg)',
            border: '1px solid var(--bad-border)',
            color: 'var(--bad)',
          }}
        >
          <AlertTriangle size={17} className="shrink-0" />
          <span className="min-w-0">
            {error ? PLAIN_ERROR : 'There are no results to show yet.'}
          </span>
          <button onClick={() => void load()} className="btn btn-ghost ml-auto">
            Try again
          </button>
        </div>
        {error && (
          <Details className="mt-3" items={[{ label: 'Error', value: error }]} />
        )}
      </div>
    )
  }

  const responseScope = data.scope.requested
  const scopeMismatch = responseScope !== scope
  const cohort = data.cohort
  const raw = data.launched.rawOutcome
  const freshness = data.freshness
  const funnel = data.diagnosis.decisionFunnel
  const outcomes = data.diagnosis.observedOutcomes

  const verifiedCampaigns = [...data.launched.campaigns]
    .sort((a, b) => b.spend - a.spend)
  const salesCampaigns = verifiedCampaigns.filter(
    isStrictSalesCampaign,
  )
  const nonSalesCampaigns = verifiedCampaigns.filter(
    (campaign) => !isStrictSalesCampaign(campaign),
  )
  const ledgerCampaigns = [...cohort.campaigns]
    .sort((a, b) => b.spend - a.spend)
  const salesLedger = ledgerCampaigns.filter(
    isStrictSalesCampaign,
  )
  const nonSalesLedger = ledgerCampaigns.filter(
    (campaign) => !isStrictSalesCampaign(campaign),
  )

  const configuredBasis = raw.revenueBasis.find(
    (entry) => entry.basis === 'configured_conversion_value',
  )
  const unknownBasis = raw.revenueBasis.find(
    (entry) => entry.basis === 'unknown',
  )
  const manualNameCoincidences = cohort.exclusions.find(
    (item) => item.code === 'manual_source_name_coincidence',
  )
  const hasSalesSpend = raw.salesCampaignsWithSpend > 0
  const hasProofSpend = raw.spend > 0
  const roasHealth: MetricHealth = !hasSalesSpend
    ? 'neutral'
    : raw.returnCoverage !== 'complete'
      ? 'watch'
      : raw.metOneXActionValueThreshold
        ? 'good'
        : 'bad'

  const warnings: string[] = []
  if (scopeMismatch) {
    warnings.push(
      `You asked for "${SCOPE_COPY[scope].label.toLowerCase()}", but these figures are for "${SCOPE_COPY[responseScope].label.toLowerCase()}". Reload before sharing them.`,
    )
  }
  if (error) {
    warnings.push("We couldn't refresh the figures, so these are the last ones we had.")
  }
  if (freshness.staleCampaigns > 0) {
    warnings.push(
      `${freshness.staleCampaigns} running campaign${freshness.staleCampaigns === 1 ? ' has' : 's have'} out-of-date figures.`,
    )
  }
  if (freshness.campaignsWithoutFreshness > 0) {
    warnings.push(
      `For ${freshness.campaignsWithoutFreshness} spending campaign${freshness.campaignsWithoutFreshness === 1 ? '' : 's'}, we don't know when the figures were last updated.`,
    )
  }
  if ((configuredBasis?.campaignCount ?? 0) > 0) {
    warnings.push(
      `${configuredBasis?.campaignCount} sales campaign${configuredBasis?.campaignCount === 1 ? ' uses' : 's use'} an estimated sales value (number of sales × a set price), not Meta's figure.`,
    )
  }
  if ((unknownBasis?.campaignCount ?? 0) > 0) {
    warnings.push(
      `For ${unknownBasis?.campaignCount} sales campaign${unknownBasis?.campaignCount === 1 ? '' : 's'}, we can't tell where the sales value came from.`,
    )
  }
  if ((manualNameCoincidences?.count ?? 0) > 0) {
    warnings.push(
      `${manualNameCoincidences?.count} campaign${manualNameCoincidences?.count === 1 ? ' was' : 's were'} made by hand in Meta with a name that looks like an AI launch. ${manualNameCoincidences?.count === 1 ? 'It is' : 'They are'} left out, because a name alone doesn't prove who launched it.`,
    )
  }

  const evidenceGeneratedAt = data.generatedAt
  const methodologyVersion = data.methodology.version

  function selectScope(nextScope: ToolImpactScope) {
    if (nextScope === scope) return
    setLoading(true)
    setError(null)
    setData(null)
    setScope(nextScope)
  }

  function downloadEvidenceCsv() {
    const headers = [
      'record_type',
      'evidence_generated_at',
      'methodology_version',
      'scope',
      'campaign_name',
      'portfolio_sales_spend',
      'portfolio_persisted_attributed_action_value',
      'portfolio_weighted_attributed_action_value_roas',
      'portfolio_action_value_position',
      'campaign_id',
      'source',
      'ownership_actor',
      'ownership_evidence',
      'ownership_confidence',
      'meta_campaign_id',
      'verified_launch',
      'included_in_sales_portfolio',
      'tool_impact_stage',
      'status',
      'product',
      'objective',
      'launched_at',
      'data_as_of',
      'spend',
      'persisted_attributed_action_value',
      'return_basis',
      'return_attribution_source',
      'return_action_types',
      'attributed_action_value_roas',
      'attributed_action_value_minus_spend',
    ]
    const records: Array<Record<string, unknown>> = [
      {
        record_type: 'portfolio_summary',
        evidence_generated_at: evidenceGeneratedAt,
        methodology_version: methodologyVersion,
        scope: responseScope,
        portfolio_sales_spend: raw.spend,
        portfolio_persisted_attributed_action_value: raw.attributedReturn,
        portfolio_weighted_attributed_action_value_roas:
          raw.spend > 0 ? raw.weightedRoas : '',
        portfolio_action_value_position: raw.returnPosition,
      },
      ...ledgerCampaigns.map((campaign) => ({
        record_type: 'campaign',
        evidence_generated_at: evidenceGeneratedAt,
        methodology_version: methodologyVersion,
        scope: responseScope,
        campaign_name: campaign.name,
        campaign_id: campaign.id,
        source: campaign.source,
        ownership_actor: campaign.toolOwnership?.actor ?? '',
        ownership_evidence: campaign.toolOwnership?.evidence ?? '',
        ownership_confidence: campaign.toolOwnership?.confidence ?? '',
        meta_campaign_id: campaign.metaCampaignId ?? '',
        verified_launch: hasLaunchEvidence(campaign),
        included_in_sales_portfolio:
          hasLaunchEvidence(campaign) &&
          hasProofReturn(campaign) &&
          campaign.spend > 0,
        tool_impact_stage: campaign.toolImpactStage,
        status: campaign.status,
        product: campaign.facets.product,
        objective: campaign.objective,
        launched_at: campaign.launchedAt ?? '',
        data_as_of: campaign.dataAsOf ?? '',
        spend: campaign.spend,
        persisted_attributed_action_value: campaign.revenue,
        return_basis: campaign.revenueBasis,
        return_attribution_source: campaign.revenueAttributionSource,
        return_action_types: campaign.revenueAttributionActionTypes.join('|'),
        attributed_action_value_roas:
          hasProofReturn(campaign) && campaign.spend > 0
            ? campaign.roas
            : '',
        attributed_action_value_minus_spend:
          hasProofReturn(campaign) && campaign.spend > 0
            ? campaign.returnSurplus
            : '',
      })),
    ]
    const lines = [
      headers.map(csvCell).join(','),
      ...records.map((record) =>
        headers.map((header) => csvCell(record[header])).join(','),
      ),
    ]
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `meridian-performance-${responseScope}-${evidenceGeneratedAt.slice(0, 10)}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen">
      <div className="px-4 sm:px-6 lg:px-8 py-7 max-w-[1600px] mx-auto">
        <header className="mb-5">
          <div className="flex items-start justify-between gap-5 flex-wrap">
            <div className="max-w-3xl">
              <p className="micro-label mb-2">Campaigns launched from this dashboard</p>
              <h1 className="page-title">What the AI has delivered</h1>
              <p className="page-subtitle">
                How much the campaigns launched from here have spent and brought back
                in sales. Campaigns your team made directly in Meta are never counted.
              </p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="chip chip-accent">Since each campaign started</span>
                <span className="chip chip-neutral">
                  Headline sales use Meta&apos;s own figures only
                </span>
                {warnings.length > 0 && (
                  <span className="chip chip-warn">
                    {warnings.length} thing{warnings.length === 1 ? '' : 's'} to know about these figures
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={downloadEvidenceCsv} className="btn btn-ghost">
                <Download size={14} /> Download spreadsheet
              </button>
              <button
                onClick={() => void load()}
                disabled={loading}
                className="btn btn-ghost"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                Reload
              </button>
            </div>
          </div>
        </header>

        <div className="card card-hero px-4 sm:px-5 py-3 mb-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <ShieldCheck
              size={18}
              className="shrink-0"
              style={{ color: 'var(--accent)' }}
            />
            <div className="min-w-0">
              <p className="font-semibold" style={{ color: 'var(--ink)' }}>
                {SCOPE_COPY[responseScope].label}
              </p>
              <p className="explain break-words">
                {cohort.ownershipEvidence.persistedAgentSource} launched by the AI ·{' '}
                {cohort.ownershipEvidence.persistedHumanSource} launched by a person
                {freshness.latestMetricsAt
                  ? ` · figures updated ${formatRelative(freshness.latestMetricsAt)}`
                  : ' · last update unknown'}
              </p>
            </div>
          </div>
          <div
            className="inline-flex rounded-xl p-1"
            style={{
              background: 'var(--surface-warm)',
              border: '1px solid var(--hairline)',
            }}
            aria-label="Which campaigns to include"
          >
            {(['agent', 'managed'] as const).map((value) => (
              <button
                key={value}
                onClick={() => selectScope(value)}
                aria-pressed={scope === value}
                className="px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
                style={{
                  background: scope === value ? 'var(--surface)' : 'transparent',
                  color:
                    scope === value ? 'var(--accent-strong)' : 'var(--ink-3)',
                  boxShadow: scope === value ? 'var(--shadow-soft)' : 'none',
                }}
              >
                {SCOPE_COPY[value].shortLabel}
              </button>
            ))}
          </div>
        </div>

        <section className="mb-8" aria-label="Headline results">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <DemoMetric
              label="Campaigns live in Meta"
              value={cohort.launched.toString()}
              sub={`${cohort.withSpend} have spent money · ${cohort.mature} ran long enough to judge`}
            />
            <DemoMetric
              label="Spent on sales campaigns"
              value={formatInr(raw.spend)}
              sub={`${raw.resolvedSalesCampaignsWithSpend} of ${raw.salesCampaignsWithSpend} sales campaigns have sales figures from Meta`}
              health={raw.returnCoverage === 'complete' ? 'neutral' : 'watch'}
            />
            <DemoMetric
              label="Sales value from Meta"
              value={hasProofSpend ? formatInr(raw.attributedReturn) : '—'}
              sub={raw.returnCoverage === 'complete'
                ? "Meta's own sales figures only"
                : `${formatInr(raw.excludedSalesSpend)} of spend left out — its sales figures aren't confirmed`}
              health={raw.returnCoverage === 'complete' ? 'neutral' : 'watch'}
            />
            <DemoMetric
              label="Return on ad spend"
              value={hasProofSpend ? formatActionValueRoas(raw.weightedRoas) : '—'}
              sub={
                hasProofSpend
                  ? `${formatSignedInr(raw.returnSurplus)} sales minus spend · 1.00x means it broke even`
                  : hasSalesSpend
                    ? "Money was spent, but the sales figures aren't confirmed yet"
                    : 'Nothing spent on sales campaigns yet'
              }
              health={roasHealth}
            />
          </div>
        </section>

        <BrainReliabilityPanel
          reliability={data.brainReliability}
          tenantId={tenantId}
        />

        <section className="mb-8" aria-labelledby="campaign-performance-heading">
          <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <BarChart3 size={18} style={{ color: 'var(--accent)' }} />
              <h2 id="campaign-performance-heading" className="section-title">
                How each campaign is doing
              </h2>
            </div>
            <span className="chip chip-neutral">Every campaign live in Meta</span>
          </div>

          <DailySpendValueChart performance={data.dailyPerformance} />

          <CampaignDailyDrilldown
            performance={data.dailyPerformance}
            campaigns={verifiedCampaigns}
            tenantId={tenantId}
          />

          <div className="flex items-center justify-between gap-3 mt-4 mb-3 flex-wrap">
            <p className="micro-label">Since each campaign started</p>
            <div
              className="inline-flex rounded-lg p-0.5"
              style={{
                background: 'var(--surface-warm)',
                border: '1px solid var(--hairline)',
              }}
              aria-label="Which comparison to show"
            >
              {([
                ['comparison', 'Spend vs sales'],
                ['gap', 'Sales minus spend'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPerformanceView(value)}
                  aria-pressed={performanceView === value}
                  className="px-2.5 py-1.5 rounded-md text-xs font-semibold"
                  style={{
                    background:
                      performanceView === value
                        ? 'var(--surface)'
                        : 'transparent',
                    color:
                      performanceView === value
                        ? 'var(--accent-strong)'
                        : 'var(--ink-3)',
                    boxShadow:
                      performanceView === value
                        ? 'var(--shadow-soft)'
                        : 'none',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {performanceView === 'comparison' ? (
            <CampaignSpendValueChart
              campaigns={salesCampaigns}
              tenantId={tenantId}
            />
          ) : (
            <ActionValueGapChart
              campaigns={salesCampaigns}
              tenantId={tenantId}
            />
          )}
          <NonSalesPerformanceChart
            campaigns={nonSalesCampaigns}
            tenantId={tenantId}
          />
        </section>

        <section className="mb-8" aria-labelledby="system-proof-heading">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={18} style={{ color: 'var(--accent)' }} />
            <h2 id="system-proof-heading" className="section-title">
              What the AI did behind the scenes
            </h2>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <LaunchFunnelChart cohort={cohort} />
            <DecisionActivityChart overview={data} />
          </div>

          <div className="card-inset px-4 py-3 mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
            <CompactStat
              label="Typical time to be ready for approval"
              value={formatDuration(data.automation.timeToApprovalReady.medianHours)}
              sub={`Based on ${data.automation.timeToApprovalReady.sampleSize} AI launches`}
            />
            <CompactStat
              label="Typical time to go live"
              value={formatDuration(data.automation.timeToLive.medianHours)}
              sub={`Based on ${data.automation.timeToLive.sampleSize} AI launches`}
            />
            <CompactStat
              label="Campaign runs"
              value={data.automation.pipelineRuns.total.toString()}
              sub={`${data.automation.pipelineRuns.completed} finished · ${data.automation.pipelineRuns.failed} failed`}
            />
            <CompactStat
              label="Last check-up"
              value={
                data.automation.lastCycleAt
                  ? formatRelative(data.automation.lastCycleAt)
                  : '—'
              }
              sub={data.automation.cadenceLabel}
            />
          </div>
        </section>

        <section className="space-y-3" aria-label="More detail">
          <Disclosure
            title="Every campaign, one row each"
            badge={`${ledgerCampaigns.length} campaign${ledgerCampaigns.length === 1 ? '' : 's'}`}
            icon={<Database size={17} />}
          >
            <div className="space-y-4">
              <CampaignEvidenceTable
                title="Sales campaigns"
                rows={salesLedger}
                tenantId={tenantId}
                variant="sales"
              />
              <CampaignEvidenceTable
                title="Campaigns with other goals"
                rows={nonSalesLedger}
                tenantId={tenantId}
                variant="other"
              />
            </div>
          </Disclosure>

          <Disclosure
            title="How these figures are worked out"
            badge={warnings.length > 0 ? `${warnings.length} note${warnings.length === 1 ? '' : 's'}` : 'Nothing to flag'}
            icon={<ShieldCheck size={17} />}
          >
            {warnings.length > 0 && (
              <div
                className="rounded-xl px-4 py-3 mb-5"
                style={{
                  background: 'var(--warn-bg)',
                  border: '1px solid var(--warn-border)',
                }}
              >
                <ul className="list-disc pl-5 space-y-1 text-sm break-words">
                  {warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="micro-label mb-2">Where the sales figures come from</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
              {raw.revenueBasis
                .filter((entry) => entry.campaignCount > 0)
                .map((entry) => (
                  <div key={entry.basis} className="card-inset px-3 py-3 min-w-0">
                    <p className="font-semibold text-sm">
                      {returnBasisLabel(entry.basis)}
                    </p>
                    <p className="explain mt-1">
                      {entry.campaignCount} campaign
                      {entry.campaignCount === 1 ? '' : 's'} ·{' '}
                      {formatInr(entry.spend)} spent ·{' '}
                      {formatActionValueRoas(entry.weightedRoas)} return
                    </p>
                  </div>
                ))}
            </div>

            {cohort.exclusions.some((item) => item.count > 0) && (
              <>
                <p className="micro-label mb-2">Left out of the headline figures</p>
                <div className="flex items-center gap-2 flex-wrap mb-5">
                  {cohort.exclusions
                    .filter((item) => item.count > 0)
                    .map((item) => (
                      <span
                        key={item.code}
                        className="chip chip-neutral"
                        title={plainStatus('launchExclusion', item.code).meaning || item.description}
                      >
                        {item.count} {plainStatus('launchExclusion', item.code).label}
                      </span>
                    ))}
                </div>
              </>
            )}

            <dl className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
              <MethodItem label="Which campaigns count" value={data.scope.cohortRule} />
              <MethodItem
                label="How return on ad spend is worked out"
                value={`${data.methodology.actionValueRoasFormula}; ${data.methodology.thresholdRule}.`}
              />
              <MethodItem
                label="When a campaign counts as live"
                value={data.methodology.verifiedLaunchRule}
              />
              <MethodItem
                label="When a campaign is old enough to judge"
                value={data.methodology.maturityRule}
              />
            </dl>

            <div
              className="mt-5 pt-4"
              style={{ borderTop: '1px solid var(--hairline-light)' }}
            >
              <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>
                What these figures don&apos;t claim
              </p>
              <p className="explain mt-1">
                These are the results we saw. Sales value from Meta is not the same as
                cash in the bank, and this page does not claim the AI caused the
                results or beat your team — that would need a fair side-by-side test.
              </p>
              <p className="explain mt-2">
                Figures worked out {formatWhen(data.generatedAt)}
              </p>
            </div>

            <div
              className="mt-5 pt-4"
              style={{ borderTop: '1px solid var(--hairline-light)' }}
            >
              <Details
                title="Technical notes"
                items={[{ label: 'Method version', value: data.methodology.version }]}
              >
                <ul className="list-disc pl-5 space-y-1">
                  {data.methodology.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </Details>
            </div>
            {error && (
              <Details
                title="Why the refresh failed"
                className="mt-3"
                items={[{ label: 'Error', value: error }]}
              />
            )}
          </Disclosure>

          <Disclosure
            title="Changes the AI suggested"
            badge={`${funnel.proposed} suggested · ${outcomes.recorded} checked`}
            icon={<Sparkles size={17} />}
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {([
                ['Awaiting review', funnel.open],
                ['Approved', funnel.approved],
                ['Expired unreviewed', funnel.expired],
                ['Results checked', outcomes.finalized72h],
              ] as const).map(([label, value]) => (
                <CompactStat key={label} label={label} value={String(value)} />
              ))}
            </div>

            {data.diagnosis.examples.length > 0 ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {data.diagnosis.examples.map((example, index) => {
                  const goalContext =
                    example.decisionContractVersion === 'goal_aware_v1' &&
                    example.objective &&
                    example.primaryKPI &&
                    example.expectedImpact?.metric &&
                    Number.isFinite(example.expectedImpact?.deltaPct) &&
                    Number.isFinite(example.expectedImpact?.confidence)
                      ? {
                          objective: example.objective,
                          primaryKPI: example.primaryKPI,
                          expectedImpact: example.expectedImpact,
                        }
                      : null

                  return (
                    <div
                      key={`${example.campaignName}-${index}`}
                      className="card-inset px-4 py-4 min-w-0"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-semibold break-words">{example.campaignName}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            <span className="chip chip-accent">
                              {plainStatus('actionType', example.actionType).label}
                            </span>
                            {goalContext && (
                              <span className="chip chip-neutral">
                                {plainStatus('objective', goalContext.objective).label} · {plainLabel(goalContext.primaryKPI)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="mono font-semibold">
                            {goalContext
                              ? `${formatModeledDelta(goalContext.expectedImpact.deltaPct)} ${plainLabel(goalContext.expectedImpact.metric)}`
                              : 'No forecast'}
                          </p>
                          <p className="explain">
                            {goalContext
                              ? `${Math.round(goalContext.expectedImpact.confidence * 100)}% sure · a forecast`
                              : 'Made before forecasts were added'}
                          </p>
                        </div>
                      </div>
                      {example.reasoning && goalContext && (
                        <p className="text-sm mt-3" style={{ color: 'var(--ink-2)' }}>
                          {example.reasoning}
                        </p>
                      )}
                      <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
                        <p className="explain">
                          {plainStatus('reviewStatus', example.status).label}
                        </p>
                        {goalContext && (
                          <Link
                            href={`/dashboard/${tenantId}/proposed-actions?campaignId=${encodeURIComponent(example.campaignId)}`}
                            className="text-xs font-semibold"
                            style={{ color: 'var(--accent-strong)' }}
                          >
                            See why it suggested this →
                          </Link>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="explain">No suggestions waiting for these campaigns.</p>
            )}
            <p className="explain mt-4">
              Forecasts are the AI&apos;s best guess. Results are before-and-after
              comparisons — they don&apos;t prove the change caused them.
            </p>
          </Disclosure>
        </section>
      </div>
    </div>
  )
}

type ReliabilityTone = 'good' | 'watch' | 'neutral'

function coverageValue(numerator: number, denominator: number): string {
  return `${numerator}/${denominator}`
}

function coverageTone(
  numerator: number,
  denominator: number,
  incomplete: number,
): ReliabilityTone {
  if (denominator === 0) return 'neutral'
  if (numerator === denominator && incomplete === 0) return 'good'
  return 'watch'
}

function ReliabilityCard({
  icon,
  label,
  value,
  status,
  detail,
  footnote,
  progressPct,
  tone = 'neutral',
}: {
  icon: ReactNode
  label: string
  value: string
  status: string
  detail: string
  footnote: string
  progressPct: number | null
  tone?: ReliabilityTone
}) {
  const color =
    tone === 'good'
      ? 'var(--good)'
      : tone === 'watch'
        ? 'var(--warn)'
        : 'var(--accent)'
  const background =
    tone === 'good'
      ? 'var(--good-bg)'
      : tone === 'watch'
        ? 'var(--warn-bg)'
        : 'var(--accent-soft)'

  return (
    <div className="card px-4 py-4 min-w-0">
      <div className="flex items-start justify-between gap-3">
        <span
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background, color }}
        >
          {icon}
        </span>
        <span
          className="text-[11px] font-semibold rounded-full px-2 py-1 text-right"
          style={{ background, color }}
        >
          {status}
        </span>
      </div>
      <p className="micro-label mt-4">{label}</p>
      <p className="display-num mt-1" style={{ fontSize: 30 }}>
        {value}
      </p>
      <p className="text-sm mt-1" style={{ color: 'var(--ink-2)' }}>
        {detail}
      </p>
      <div
        className="h-1.5 rounded-full overflow-hidden mt-3"
        style={{ background: 'var(--surface-warm)' }}
        aria-hidden="true"
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            background: color,
            width: `${Math.max(0, Math.min(100, progressPct ?? 0))}%`,
          }}
        />
      </div>
      <p className="explain mt-2">{footnote}</p>
    </div>
  )
}

function gateLabel(gate: 'passed' | 'held' | 'unavailable'): string {
  if (gate === 'held') return 'Held back for safety'
  return plainStatus('coverage', gate).label
}

function gateChipClass(gate: 'passed' | 'held' | 'unavailable'): string {
  if (gate === 'passed') return 'chip chip-good'
  if (gate === 'held') return 'chip chip-warn'
  return 'chip chip-neutral'
}

function BrainReliabilityPanel({
  reliability,
  tenantId,
}: {
  reliability?: ToolImpactBrainReliability
  tenantId: string
}) {
  const trace = reliability?.cycleCompleteness
  const gates = reliability?.gateReadiness
  const predictions = reliability?.predictions
  const outcomes = reliability?.outcomes

  const traceStatus = !trace || trace.cyclesRun === 0
    ? 'Not enough yet'
    : trace.fullTraceCycles === trace.cyclesRun
      ? 'All complete'
      : `${trace.partialTraceCycles + trace.unavailableTraceCycles} incomplete`
  const gateStatus = !gates || gates.evaluatedCycles === 0
    ? 'Not enough yet'
    : gates.recommendHeld > 0
      ? `${gates.recommendHeld} held back for safety`
      : 'All passed'
  const predictionStatus = !predictions || predictions.decisions === 0
    ? 'No suggestions yet'
    : predictions.legacyOrIncomplete === 0
      ? 'All have a forecast'
      : `${predictions.legacyOrIncomplete} without a forecast`
  const outcomeStatus = !outcomes || (outcomes.due24h === 0 && outcomes.due72h === 0)
    ? 'Not enough yet'
    : outcomes.reportable
      ? 'Enough to report'
      : 'Still measuring'

  const topBlocker = gates?.topRecommendBlockers[0]

  return (
    <section className="mb-8" aria-labelledby="brain-reliability-heading">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <BrainCircuit size={19} style={{ color: 'var(--accent)' }} />
          <div>
            <h2 id="brain-reliability-heading" className="section-title">
              How carefully the AI checks your campaigns
            </h2>
            <p className="explain mt-0.5">
              {reliability
                ? `Last ${reliability.window.days} days · each check answers a different question, so they are not added up`
                : 'Each check answers a different question, so they are not added up'}
            </p>
          </div>
        </div>
        <span className="chip chip-neutral">4 separate checks</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <ReliabilityCard
          icon={<CheckCircle2 size={18} />}
          label="Check-ups done in full"
          value={trace ? coverageValue(trace.fullTraceCycles, trace.cyclesRun) : '—'}
          status={traceStatus}
          detail={trace ? `Each check-up has ${trace.requiredSteps} steps` : 'Not available yet'}
          footnote={trace
            ? `${trace.statusCompleted} finished · ${trace.failed} failed · ${trace.pending} still running`
            : 'This check is not switched on yet'}
          progressPct={trace?.fullTraceRatePct ?? null}
          tone={trace
            ? coverageTone(
                trace.fullTraceCycles,
                trace.cyclesRun,
                trace.partialTraceCycles + trace.unavailableTraceCycles,
              )
            : 'neutral'}
        />
        <ReliabilityCard
          icon={<ClipboardCheck size={18} />}
          label="Enough evidence to suggest a change"
          value={gates ? coverageValue(gates.recommendPassed, gates.evaluatedCycles) : '—'}
          status={gateStatus}
          detail={gates
            ? `${gates.executionEvidencePassed} also had enough to act on`
            : 'Not available yet'}
          footnote={gates
            ? topBlocker
              ? `Most common reason held back: ${humanise(topBlocker.code).toLowerCase()} (${topBlocker.count}) · ${gates.unavailableCycles} older check-ups not rated`
              : `${gates.unavailableCycles} older check-ups not rated`
            : 'The AI holds back when evidence is weak, so it does not suggest risky changes'}
          progressPct={gates?.recommendPassRatePct ?? null}
          tone={gates
            ? coverageTone(
                gates.recommendPassed,
                gates.evaluatedCycles,
                gates.recommendHeld + gates.unavailableCycles,
              )
            : 'neutral'}
        />
        <ReliabilityCard
          icon={<Gauge size={18} />}
          label="Suggestions with a forecast"
          value={predictions ? coverageValue(predictions.completePredictions, predictions.decisions) : '—'}
          status={predictionStatus}
          detail={predictions
            ? `${predictions.goalAwareDecisions} suggestions are tied to the campaign goal`
            : 'Not available yet'}
          footnote={predictions
            ? `${predictions.byStatus.shadow_review} awaiting review · ${predictions.executionSucceeded} carried out`
            : 'Counts suggestions that say what should change, by how much, and how sure the AI is'}
          progressPct={predictions?.contractCoveragePct ?? null}
          tone={predictions
            ? coverageTone(
                predictions.completePredictions,
                predictions.decisions,
                predictions.legacyOrIncomplete,
              )
            : 'neutral'}
        />
        <ReliabilityCard
          icon={<TimerReset size={18} />}
          label="Results checked afterwards"
          value={outcomes ? `${coverageValue(outcomes.measured24h, outcomes.due24h)} after 1 day` : '—'}
          status={outcomeStatus}
          detail={outcomes
            ? `${coverageValue(outcomes.finalized72h, outcomes.due72h)} after 3 days · ${outcomes.conclusive72h} with a clear answer`
            : 'Not available yet'}
          footnote={outcomes
            ? `Forecast accuracy shown once there are ${outcomes.minimumConclusiveSample} clear answers`
            : 'Results are checked 1 day and 3 days after a change is made'}
          progressPct={outcomes && outcomes.due72h > 0
            ? (outcomes.finalized72h / outcomes.due72h) * 100
            : null}
          tone={outcomes?.reportable ? 'good' : 'neutral'}
        />
      </div>

      <div className="card overflow-hidden mt-4">
        <div className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold" style={{ color: 'var(--ink)' }}>
              Latest check-ups
            </p>
            <p className="explain">What the AI looked at and what it suggested</p>
          </div>
          <span className="chip chip-neutral shrink-0">
            {reliability
              ? `${Math.min(reliability.recentCycles.length, 5)} shown`
              : 'Not available'}
          </span>
        </div>

        {reliability && reliability.recentCycles.length > 0 ? (
          <div style={{ borderTop: '1px solid var(--hairline)' }}>
            {reliability.recentCycles.slice(0, 5).map((cycle) => {
              const traceComplete =
                cycle.stepsRecorded === cycle.requiredSteps &&
                cycle.requiredSteps > 0
              const holdReason = cycle.reasonsBlocked[0]
              return (
                <div
                  key={cycle.cycleId}
                  className="px-4 sm:px-5 py-3 grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_0.7fr_0.9fr_0.9fr_0.8fr] gap-2 lg:gap-4 items-center"
                  style={{ borderTop: '1px solid var(--hairline-light)' }}
                >
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/${tenantId}/proposed-actions?campaignId=${encodeURIComponent(cycle.campaignId)}`}
                      className="font-semibold text-sm block truncate"
                      style={{ color: 'var(--ink)' }}
                      title={cycle.campaignName}
                    >
                      {cycle.campaignName}
                    </Link>
                    <p className="explain truncate">
                      {formatRelative(cycle.startedAt)} · {plainStatus('agentRun', cycle.status).label}
                    </p>
                  </div>
                  <div>
                    <p className="micro-label">Steps done</p>
                    <span className={traceComplete ? 'chip chip-good mt-1' : 'chip chip-warn mt-1'}>
                      {cycle.stepsRecorded}/{cycle.requiredSteps} steps
                    </span>
                  </div>
                  <div>
                    <p className="micro-label">Enough to suggest?</p>
                    <span className={`${gateChipClass(cycle.recommendGate)} mt-1`}>
                      {gateLabel(cycle.recommendGate)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="micro-label">Enough to act?</p>
                    <span className={`${gateChipClass(cycle.executionEvidenceGate)} mt-1`}>
                      {gateLabel(cycle.executionEvidenceGate)}
                    </span>
                    {holdReason && (
                      <p className="explain truncate mt-1" title={humanise(holdReason)}>
                        {humanise(holdReason)}
                      </p>
                    )}
                  </div>
                  <div className="lg:text-right">
                    <p className="micro-label">Suggested</p>
                    <p className="font-semibold text-sm mt-1" style={{ color: 'var(--ink)' }}>
                      {cycle.decisionsWritten > 0
                        ? `${cycle.decisionsWritten} change${cycle.decisionsWritten === 1 ? '' : 's'}`
                        : cycle.recommendGate === 'held'
                          ? 'Nothing · held back for safety'
                          : 'Nothing needed'}
                    </p>
                    {cycle.confidenceOverall != null && (
                      <p className="explain">
                        {Math.round(cycle.confidenceOverall * 100)}% sure
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div
            className="px-4 sm:px-5 py-4 explain"
            style={{ borderTop: '1px solid var(--hairline)' }}
          >
            {reliability
              ? 'No check-ups in this period yet.'
              : 'Check-up history is not available yet.'}
          </div>
        )}
      </div>
    </section>
  )
}

function CompactStat({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="min-w-0">
      <p className="micro-label truncate">{label}</p>
      <p className="display-num mt-1" style={{ fontSize: 22 }}>
        {value}
      </p>
      {sub && <p className="explain mt-1 break-words">{sub}</p>}
    </div>
  )
}

function MethodItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="micro-label mb-1">{label}</dt>
      <dd className="break-words" style={{ color: 'var(--ink-2)' }}>{value}</dd>

    </div>
  )
}
