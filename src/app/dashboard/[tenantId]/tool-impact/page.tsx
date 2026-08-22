'use client'

import { use, useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  AlertTriangle,
  BarChart3,
  ChevronDown,
  Database,
  Download,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react'
import {
  formatCurrency,
  formatDateTime,
  formatRelativeTime,
  formatSignedCurrency,
  plainLabel,
} from '@/lib/utils'
import { getToolImpact } from '@/lib/api'
import type {
  DashboardCampaignRow,
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
    label: 'Autonomous AI launches',
    shortLabel: 'AI only',
  },
  managed: {
    label: 'All Meridian launches',
    shortLabel: 'All Meridian launches',
  },
}

const DECISION_STATUS_LABEL: Record<string, string> = {
  shadow_review: 'Awaiting review',
  approved: 'Approved',
  rejected: 'Rejected',
  expired: 'Expired unreviewed',
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
  if (hours < 1) return `${Math.round(hours * 60)}m`
  return hours < 24
    ? `${hours.toFixed(hours < 10 ? 1 : 0)}h`
    : `${(hours / 24).toFixed(1)}d`
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
    <div className="card card-metric px-4 sm:px-5 py-5">
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
      <p className="explain mt-2">{sub}</p>
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
        <span style={{ color: 'var(--accent)' }}>{icon}</span>
        <span className="font-semibold" style={{ color: 'var(--ink)' }}>
          {title}
        </span>
        {badge && <span className="chip chip-neutral ml-auto">{badge}</span>}
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
            : "Couldn't load Meridian performance",
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
          className="flex items-center gap-3 rounded-xl px-5 py-4"
          style={{
            background: 'var(--bad-bg)',
            border: '1px solid var(--bad-border)',
            color: 'var(--bad)',
          }}
        >
          <AlertTriangle size={17} className="shrink-0" />
          <span>{error ?? 'No Meridian performance data available'}</span>
          <button onClick={() => void load()} className="btn btn-ghost ml-auto">
            Retry
          </button>
        </div>
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
      `Requested ${SCOPE_COPY[scope].label}, but the API returned ${SCOPE_COPY[responseScope].label}. Reload before presenting this snapshot.`,
    )
  }
  if (error) {
    warnings.push(`Reload failed; this is the last successful snapshot. ${error}`)
  }
  if (freshness.staleCampaigns > 0) {
    warnings.push(`${freshness.staleCampaigns} active campaign metrics are stale.`)
  }
  if (freshness.campaignsWithoutFreshness > 0) {
    warnings.push(
      `${freshness.campaignsWithoutFreshness} spending campaigns have no metrics timestamp.`,
    )
  }
  if ((configuredBasis?.campaignCount ?? 0) > 0) {
    warnings.push(
      `${configuredBasis?.campaignCount} sales campaigns use conversion count × configured value.`,
    )
  }
  if ((unknownBasis?.campaignCount ?? 0) > 0) {
    warnings.push(
      `${unknownBasis?.campaignCount} sales campaigns have unknown return derivation.`,
    )
  }
  if ((manualNameCoincidences?.count ?? 0) > 0) {
    warnings.push(
      `${manualNameCoincidences?.count} manual campaigns match an old AGENT_* naming pattern but remain excluded because names are not ownership proof.`,
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
              <p className="micro-label mb-2">Verified impact · campaigns Meridian owns</p>
              <h1 className="page-title">Results Meridian can prove</h1>
              <p className="page-subtitle">
                Only launches recorded through this workspace. Campaigns created
                directly in Meta by the marketing team are never mixed into these results.
              </p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="chip chip-accent">Campaign-lifetime results</span>
                <span className="chip chip-neutral">
                  Proof headline uses campaign-scoped Meta value only
                </span>
                {warnings.length > 0 && (
                  <span className="chip chip-warn">
                    {warnings.length} data note{warnings.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={downloadEvidenceCsv} className="btn btn-ghost">
                <Download size={14} /> Evidence CSV
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
              <p className="explain truncate">
                {cohort.ownershipEvidence.persistedAgentSource} recorded AI ·{' '}
                {cohort.ownershipEvidence.persistedHumanSource} recorded dashboard
                {freshness.latestMetricsAt
                  ? ` · latest metrics ${formatRelativeTime(freshness.latestMetricsAt)}`
                  : ' · freshness unknown'}
              </p>
            </div>
          </div>
          <div
            className="inline-flex rounded-xl p-1"
            style={{
              background: 'var(--surface-warm)',
              border: '1px solid var(--hairline)',
            }}
            aria-label="Campaign scope"
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

        <section className="mb-8" aria-label="Headline performance">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <DemoMetric
              label="Verified launches"
              value={cohort.launched.toString()}
              sub={`${cohort.withSpend} received spend · ${cohort.mature} mature`}
            />
            <DemoMetric
              label="Proof-eligible sales spend"
              value={formatCurrency(Math.round(raw.spend))}
              sub={`${raw.resolvedSalesCampaignsWithSpend}/${raw.salesCampaignsWithSpend} sales campaigns have resolved Meta return`}
              health={raw.returnCoverage === 'complete' ? 'neutral' : 'watch'}
            />
            <DemoMetric
              label="Resolved Meta action value"
              value={hasProofSpend ? formatCurrency(Math.round(raw.attributedReturn)) : '—'}
              sub={raw.returnCoverage === 'complete'
                ? 'Resolved Meta attribution only'
                : `${formatCurrency(Math.round(raw.excludedSalesSpend))} sales spend withheld from headline`}
              health={raw.returnCoverage === 'complete' ? 'neutral' : 'watch'}
            />
            <DemoMetric
              label="Raw ROAS · resolved Meta value"
              value={hasProofSpend ? formatActionValueRoas(raw.weightedRoas) : '—'}
              sub={
                hasProofSpend
                  ? `${formatSignedCurrency(raw.returnSurplus)} value minus spend · benchmark 1.00x`
                  : hasSalesSpend
                    ? 'Sales spend exists, but return provenance is not proof-eligible'
                    : 'No sales spend in this scope'
              }
              health={roasHealth}
            />
          </div>
        </section>

        <section className="mb-8" aria-labelledby="campaign-performance-heading">
          <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <BarChart3 size={18} style={{ color: 'var(--accent)' }} />
              <h2 id="campaign-performance-heading" className="section-title">
                Campaign performance
              </h2>
            </div>
            <span className="chip chip-neutral">All verified launches</span>
          </div>

          <DailySpendValueChart performance={data.dailyPerformance} />

          <CampaignDailyDrilldown
            performance={data.dailyPerformance}
            campaigns={verifiedCampaigns}
            tenantId={tenantId}
          />

          <div className="flex items-center justify-between gap-3 mt-4 mb-3 flex-wrap">
            <p className="micro-label">Campaign-lifetime comparison</p>
            <div
              className="inline-flex rounded-lg p-0.5"
              style={{
                background: 'var(--surface-warm)',
                border: '1px solid var(--hairline)',
              }}
              aria-label="Campaign comparison chart"
            >
              {([
                ['comparison', 'Spend vs value'],
                ['gap', 'Value gap'],
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
              Automation and decision activity
            </h2>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <LaunchFunnelChart cohort={cohort} />
            <DecisionActivityChart overview={data} />
          </div>

          <div className="card-inset px-4 py-3 mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
            <CompactStat
              label="Agent-only approval median"
              value={formatDuration(data.automation.timeToApprovalReady.medianHours)}
              sub={`${data.automation.timeToApprovalReady.sampleSize} joined agent runs`}
            />
            <CompactStat
              label="Agent-only live median"
              value={formatDuration(data.automation.timeToLive.medianHours)}
              sub={`${data.automation.timeToLive.sampleSize} joined agent runs`}
            />
            <CompactStat
              label="Tenant pipeline records"
              value={data.automation.pipelineRuns.total.toString()}
              sub={`${data.automation.pipelineRuns.completed} completed · ${data.automation.pipelineRuns.failed} failed`}
            />
            <CompactStat
              label="Last intelligence check"
              value={
                data.automation.lastCycleAt
                  ? formatRelativeTime(data.automation.lastCycleAt)
                  : '—'
              }
              sub={data.automation.cadenceLabel}
            />
          </div>
        </section>

        <section className="space-y-3" aria-label="Evidence details">
          <Disclosure
            title="Complete campaign ledger"
            badge={`${ledgerCampaigns.length} records`}
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
                title="Non-sales campaigns"
                rows={nonSalesLedger}
                tenantId={tenantId}
                variant="other"
              />
            </div>
          </Disclosure>

          <Disclosure
            title="Evidence quality and methodology"
            badge={warnings.length > 0 ? `${warnings.length} notes` : 'No alerts'}
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
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="micro-label mb-2">Return provenance</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
              {raw.revenueBasis
                .filter((entry) => entry.campaignCount > 0)
                .map((entry) => (
                  <div key={entry.basis} className="card-inset px-3 py-3">
                    <p className="font-semibold text-sm">
                      {returnBasisLabel(entry.basis)}
                    </p>
                    <p className="explain mt-1">
                      {entry.campaignCount} campaign
                      {entry.campaignCount === 1 ? '' : 's'} ·{' '}
                      {formatCurrency(Math.round(entry.spend))} spent ·{' '}
                      {formatActionValueRoas(entry.weightedRoas)}
                    </p>
                  </div>
                ))}
            </div>

            {cohort.exclusions.some((item) => item.count > 0) && (
              <>
                <p className="micro-label mb-2">Excluded or incomplete</p>
                <div className="flex items-center gap-2 flex-wrap mb-5">
                  {cohort.exclusions
                    .filter((item) => item.count > 0)
                    .map((item) => (
                      <span
                        key={item.code}
                        className="chip chip-neutral"
                        title={item.description}
                      >
                        {item.count} {plainLabel(item.code)}
                      </span>
                    ))}
                </div>
              </>
            )}

            <dl className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
              <MethodItem label="Cohort" value={data.scope.cohortRule} />
              <MethodItem
                label="ROAS formula"
                value={`${data.methodology.actionValueRoasFormula}; ${data.methodology.thresholdRule}.`}
              />
              <MethodItem
                label="Verified launch"
                value={data.methodology.verifiedLaunchRule}
              />
              <MethodItem
                label="Maturity"
                value={data.methodology.maturityRule}
              />
            </dl>

            <div
              className="mt-5 pt-4"
              style={{ borderTop: '1px solid var(--hairline-light)' }}
            >
              <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>
                Claim boundary
              </p>
              <p className="explain mt-1">
                These are scoped observed results. Attributed action value is not
                reconciled cash, and this page does not claim AI caused the outcome
                or beat the marketing team without a comparable holdout.
              </p>
              <p className="explain mt-2">
                Snapshot {formatDateTime(data.generatedAt)} · contract{' '}
                {data.methodology.version}
              </p>
            </div>

            <div
              className="mt-5 pt-4"
              style={{ borderTop: '1px solid var(--hairline-light)' }}
            >
              <p className="micro-label mb-2">Full contract notes</p>
              <ul className="list-disc pl-5 space-y-1 text-sm" style={{ color: 'var(--ink-2)' }}>
                {data.methodology.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          </Disclosure>

          <Disclosure
            title="Decision and outcome detail"
            badge={`${funnel.proposed} proposed · ${outcomes.recorded} actions`}
            icon={<Sparkles size={17} />}
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {([
                ['Awaiting review', funnel.open],
                ['Approved', funnel.approved],
                ['Expired', funnel.expired],
                ['Final outcomes', outcomes.finalized72h],
              ] as const).map(([label, value]) => (
                <CompactStat key={label} label={label} value={String(value)} />
              ))}
            </div>

            {data.diagnosis.examples.length > 0 ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {data.diagnosis.examples.map((example, index) => (
                  <div
                    key={`${example.campaignName}-${index}`}
                    className="card-inset px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold">{example.campaignName}</p>
                        <span className="chip chip-accent mt-1.5">
                          {plainLabel(example.actionType)}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="mono font-semibold">
                          {formatSignedCurrency(example.expectedProfitDeltaINR7d)} / 7d
                        </p>
                        <p className="explain">model estimate</p>
                      </div>
                    </div>
                    {example.reasoning && (
                      <p className="text-sm mt-3" style={{ color: 'var(--ink-2)' }}>
                        {example.reasoning}
                      </p>
                    )}
                    <p className="explain mt-2">
                      {DECISION_STATUS_LABEL[example.status] ??
                        plainLabel(example.status)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="explain">No open decision examples in this cohort.</p>
            )}
            <p className="explain mt-4">
              Model estimates are hypothetical. Observed outcomes are
              before/after measurements, not causal proof.
            </p>
          </Disclosure>
        </section>
      </div>
    </div>
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
      {sub && <p className="explain mt-1">{sub}</p>}
    </div>
  )
}

function MethodItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="micro-label mb-1">{label}</dt>
      <dd style={{ color: 'var(--ink-2)' }}>{value}</dd>
    </div>
  )
}
