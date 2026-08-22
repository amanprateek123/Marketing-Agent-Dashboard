/**
 * Mirrors the backend's DashboardOverview (src/dashboard/dashboard.types.ts).
 *
 * These are RENDER types, not calculation inputs. Every figure here has
 * already been derived server-side against the tenant's real contribution
 * margin. Deriving anything further in the browser reintroduces exactly the
 * bug this endpoint exists to kill — a page that computed its own unweighted
 * mean ROAS and displayed it next to a total-derived revenue figure that
 * implied a different number.
 */

export type AlertSeverity = 'critical' | 'warning' | 'info'

export type AlertKind =
  | 'meta_disconnected'
  | 'no_margin_configured'
  | 'budget_cap_misconfigured'
  | 'zero_conversion_spend'
  | 'portfolio_below_breakeven'
  | 'campaign_losing_badly'
  | 'learning_limited'
  | 'stale_metrics'
  | 'pending_approvals'
  | 'pending_actions'
  | 'objective_off_target'
  | 'pipeline_stalled'

export interface DashboardAlert {
  kind: AlertKind
  severity: AlertSeverity
  title: string
  detail: string
  amount?: number
  suggestedAction?: string
  href?: string
  campaignId?: string
  campaignName?: string
}

export type PerformanceVerdict =
  // Revenue objectives — judged against breakeven ROAS.
  | 'profitable'
  | 'marginal'
  | 'below_breakeven'
  | 'losing_badly'
  | 'no_conversions'
  // Non-revenue objectives — judged on their own primary KPI.
  | 'on_target'
  | 'acceptable'
  | 'underperforming'
  | 'failing'
  // Shared
  | 'attribution_pending'
  | 'no_spend'

export type Severity = 'good' | 'watch' | 'bad' | 'neutral'

export interface WindowMetrics {
  spend: number
  revenue: number
  roas: number
  conversions: number
  clicks: number
  impressions: number
  ctr: number
  cvr: number
  cpc: number
  cpm: number
  aov: number
  cac: number
  contributionProfit: number
  campaignCount: number
}

export interface PortfolioRollup extends WindowMetrics {
  /** Campaign-scoped Meta return proof; configured/fallback rows are withheld. */
  returnEvidence: {
    status: 'no_sales_spend' | 'complete_meta' | 'complete_configured' | 'complete_mixed' | 'incomplete'
    campaignsWithSpend: number
    knownCampaigns: number
    unknownCampaigns: number
    knownSpend: number
    knownRevenue: number
    knownRoas: number
    metaCampaigns: number
    configuredCampaigns: number
  }
  isProfitable: boolean
  gapToBreakeven: number
  pctOfTarget: number
  spendBelowBreakeven: number
  pctSpendBelowBreakeven: number
  moneyAtRisk: number
  campaignsBelowBreakeven: number
  /** Spend across EVERY objective, including non-revenue ones. */
  totalSpendAllObjectives: number
  /** Spend on awareness / traffic / app / engagement objectives. */
  nonRevenueSpend: number
  nonRevenueCampaigns: number
  nonRevenueOffTarget: number
}

export interface TrendDelta {
  spendPct: number | null
  revenuePct: number | null
  roasPct: number | null
  contributionAbs: number
  direction: 'improving' | 'declining' | 'flat'
}

export interface CampaignFacets {
  /** Grouping key — collapses siblings. Never render this per-campaign. */
  product: string
  /** Per-campaign display label — keeps what distinguishes it from siblings. */
  label: string
  funnel: string
  funnelLabel: string
  budgetModel: string
  language: string | null
  optimizedFor: string | null
  isTest: boolean
  matched: string[]
}

export interface KpiReading {
  key: string
  label: string
  value: number
  display: string
  target: number | null
  targetDisplay: string | null
  direction: 'higher_better' | 'lower_better'
  status: 'good' | 'watch' | 'bad' | 'neutral'
}

export interface DashboardCampaignRow {
  id: string
  name: string
  displayName: string
  status: string
  statusLabel: string
  metaCampaignId?: string
  /** 'agent' | 'human' | 'manual' */
  source: string
  toolOwnership: {
    actor: 'agent' | 'human'
    evidence:
      | 'persisted_agent_source'
      | 'persisted_human_source'
      | 'legacy_agent_name'
    confidence: 'recorded' | 'name_inferred'
  } | null

  spend: number
  revenue: number
  revenueBasis:
    | 'meta_action_value'
    | 'configured_conversion_value'
    | 'no_attributed_revenue'
    | 'unknown'
  revenueAttributionSource:
    | 'custom_conversion'
    | 'custom_event'
    | 'standard_event'
    | 'app_event'
    | 'account_fallback'
    | 'unresolved'
    | 'unknown'
  revenueAttributionActionTypes: string[]
  roas: number
  /** Meta-attributed return minus ad spend, without margin adjustment. */
  returnSurplus: number
  /** Null when raw ROAS is not applicable or there is no spend. */
  isRawRoasProfitable: boolean | null
  rawRoasVerdict:
    | 'returned_more_than_spend'
    | 'break_even'
    | 'returned_less_than_spend'
    | 'no_spend'
    | 'not_applicable'
  toolImpactStage:
    | 'outside_scope'
    | 'created_unverified'
    | 'verified_zero_spend'
    | 'with_spend_immature'
    | 'mature'
  conversions: number
  clicks: number
  impressions: number
  ctr: number
  cvr: number

  contributionProfit: number
  gapToBreakeven: number
  /** This campaign's OWN product economics — products can differ. */
  breakevenROAS: number
  targetROAS: number
  marginPct: number
  moneyAtRisk: number

  /** Raw Meta objective string, e.g. OUTCOME_AWARENESS. */
  objective: string
  objectiveKey: string
  objectiveLabel: string
  /** False for awareness/traffic/app/engagement — ROAS is not their yardstick. */
  isRevenueObjective: boolean
  /** The KPI this campaign is actually judged on, with its own target. */
  primaryKpi: KpiReading
  costPerResult: number | null
  costPerResultDisplay: string | null

  verdict: PerformanceVerdict
  verdictLabel: string
  severity: Severity
  isActionable: boolean
  nextAction: string | null

  facets: CampaignFacets

  launchedAt: string | null
  endedAt: string | null
  daysRunning: number | null
  ageHours: number | null

  budget: number
  spendCap: number
  capRisk: {
    dailyBudget: number
    plannedDays: number
    projectedSpend: number
    cap: number
    overrunBy: number
  } | null

  learningStage: string | null
  learningStageLabel: string | null

  dataAsOf: string | null
  dataAgeHours: number | null
  isStale: boolean
}

export interface FacetRollup {
  key: string
  label: string
  campaignCount: number
  spend: number
  revenue: number
  roas: number
  contributionProfit: number
  isProfitable: boolean
  spendShare: number
}

export interface DashboardInsight {
  id: string
  finding: string
  confidence: number
  dataPoints: number
  strength: 'strong' | 'moderate' | 'weak'
  category: string | null
  recommendation: string | null
  createdAt: string | null
}

export interface TenantActivity {
  meta: {
    connected: boolean
    accountId: string | null
    businessId: string | null
    accountCount: number
    pixelId: string | null
    pageId: string | null
  }
  pipeline: {
    lastRunAt: string | null
    lastRunStatus: string | null
    lastRunId: string | null
    runsInWindow: number
    runningNow: number
    failedInWindow: number
  }
  creatives: {
    total: number
    ready: number
    producing: number
    failed: number
    allRejected: number
  }
  queue: {
    pendingApprovalCampaigns: number
    pendingActions: number
    pendingDecisions: number
  }
  sync: {
    lastSyncAt: string | null
    stalestCampaignHours: number | null
    staleCampaignCount: number
    activeCampaignCount: number
    campaignsWithFreshness: number
    campaignsWithoutFreshness: number
  }
}

export interface DashboardEconomics {
  productName: string | null
  marginPct: number
  refundPct: number
  netMarginPct: number
  breakevenROAS: number
  targetROAS: number
  method: 'product-config' | 'generic-default'
  isEstimated: boolean
  /** True when products differ enough that one headline breakeven misleads. */
  hasMixedMargins: boolean
  byProduct: Array<{
    productName: string | null
    marginPct: number
    breakevenROAS: number
    targetROAS: number
  }>
  notes: string[]
}

export type ToolImpactScope = 'agent' | 'managed'

export type ToolImpactReturnBasis =
  | DashboardCampaignRow['revenueBasis']
  | 'mixed'
  | 'not_applicable'

export type ToolImpactReturnNature =
  | 'meta_reported_action_value'
  | 'configured_conversion_estimate'
  | 'no_attributed_return'
  | 'unknown'
  | 'mixed'
  | 'not_applicable'

export interface ToolImpactDurationStats {
  sampleSize: number
  medianHours: number | null
  p90Hours: number | null
  basis: string
}

export interface ToolImpactCohortStageCounts {
  created: number
  launched: number
  withSpend: number
  mature: number
}

export interface ToolImpactRawOutcome {
  campaigns: number
  /** Every verified-launch campaign with real spend, sales + non-sales. */
  campaignsWithSpend: number
  /** Strict sales-objective campaigns with spend before provenance filtering. */
  salesCampaignsWithSpend: number
  /** Strict sales rows with resolved Meta return used by headline math. */
  resolvedSalesCampaignsWithSpend: number
  /** Configured-estimate or unknown rows withheld from the proof headline. */
  excludedSalesCampaignsWithSpend: number
  excludedSalesSpend: number
  returnCoverage: 'no_sales_spend' | 'complete' | 'partial' | 'unavailable'
  spend: number
  attributedReturn: number
  revenueBasis: Array<{
    basis:
      | 'meta_action_value'
      | 'configured_conversion_value'
      | 'no_attributed_revenue'
      | 'unknown'
    campaignCount: number
    spend: number
    revenue: number
    weightedRoas: number
  }>
  containsModeledOrUnknownRevenue: boolean
  weightedRoas: number
  returnSurplus: number
  returnPosition: 'above' | 'equal' | 'below' | 'no_spend'
  metOneXActionValueThreshold: boolean
  thresholdRule: 'weighted_attributed_roas_gte_1'
  /** @deprecated use nonSales.campaigns */
  nonSalesCampaigns: number
  /** @deprecated use nonSales.spend */
  nonSalesSpend: number
  /**
   * Non-sales spend, reported separately — never folded into the ROAS above.
   * Grouped by objective because CPM (awareness) and CPC (traffic) aren't
   * the same unit and blending them would repeat the mistake this whole
   * type exists to avoid.
   */
  nonSales: {
    campaigns: number
    spend: number
    byObjective: Array<{
      objectiveKey: string
      objectiveLabel: string
      campaignCount: number
      spend: number
      primaryKpiLabel: string
      weightedValue: number | null
      weightedDisplay: string
    }>
  }
}

export interface ToolImpactDailyPerformance {
  /** Persisted Meta campaign-day rows only; no lifetime interpolation. */
  source: 'metric_timeseries_campaign_daily'
  /** Meta date_start in the ad account timezone. */
  dateBasis: 'meta_ad_account_date_start'
  cohort: 'verified_sales_launches'
  calculationVersion: 'product_scoped_v1'
  coverage: {
    status: 'complete' | 'partial' | 'none'
    eligibleCampaigns: number
    campaignsWithRows: number
    campaignsWithoutRows: number
    observedDates: number
    campaignDateRows: number
    firstDate: string | null
    lastDate: string | null
    observedSpend: number
    lifetimeSpend: number
    spendCoveragePct: number | null
    observedPersistedAttributedReturn: number
    lifetimeAttributedReturn: number
  }
  returnCoverage: {
    status: 'complete' | 'partial' | 'none'
    trustedRows: number
    untrustedRows: number
    campaignsWithTrustedRows: number
    legacyRowsExcludedFromReturn: number
    returnBasis: ToolImpactReturnBasis
    returnNature: ToolImpactReturnNature
    warning: string | null
    byBasis: Array<{
      basis: DashboardCampaignRow['revenueBasis']
      rowCount: number
      persistedAttributedReturn: number
    }>
  }
  /** Missing calendar dates are intentionally absent, never zero-filled. */
  series: Array<{
    date: string
    spend: number
    /** Present only when every campaign row for the date is product-scoped. */
    attributedReturn: number | null
    knownAttributedReturn: number
    /** Stored subtotal, shown with explicit basis/provenance styling. */
    persistedAttributedReturn: number
    weightedRoas: number | null
    campaignsReporting: number
    trustedReturnCampaigns: number
    returnCoverage: 'complete' | 'partial' | 'none'
    returnBasis: ToolImpactReturnBasis
    returnNature: ToolImpactReturnNature
  }>
  /**
   * Day-wise evidence for every verified Meridian launch in the selected
   * scope. This includes non-revenue objectives, which are evaluated on their
   * own result/KPI instead of being forced into a ROAS chart.
   */
  byCampaign: ToolImpactCampaignDailyPerformance[]
}

export interface ToolImpactCampaignDailyPerformance {
  campaignId: string
  metaCampaignId: string
  campaignName: string
  displayName: string
  status: string
  objectiveKey: string
  objectiveLabel: string
  isRevenueObjective: boolean
  optimizationGoals: string[]
  resultMetric: {
    key: string
    label: string
    source: 'goal_selected_metric' | 'objective_proxy'
    optimizationGoal: string | null
  }
  primaryKpi: {
    key: string
    label: string
    value: number
    display: string
    target: number | null
    targetDisplay: string | null
    direction: 'higher_better' | 'lower_better'
    status: 'good' | 'watch' | 'bad' | 'neutral'
  }
  coverage: {
    status: 'complete' | 'partial' | 'none'
    observedDates: number
    campaignDateRows: number
    firstDate: string | null
    lastDate: string | null
    observedSpend: number
    lifetimeSpend: number
    spendCoveragePct: number | null
    warning: string | null
  }
  returnCoverage: {
    status: 'complete' | 'partial' | 'none' | 'not_applicable'
    trustedRows: number
    untrustedRows: number
    legacyRowsExcludedFromReturn: number
    returnBasis: ToolImpactReturnBasis
    returnNature: ToolImpactReturnNature
    warning: string | null
    byBasis: Array<{
      basis: DashboardCampaignRow['revenueBasis']
      rowCount: number
      persistedAttributedReturn: number
    }>
  }
  /** Missing dates are absent; values come from persisted campaign-day rows. */
  series: Array<{
    date: string
    spend: number
    attributedReturn: number | null
    knownAttributedReturn: number
    persistedAttributedReturn: number
    rawRoas: number | null
    conversions: number
    clicks: number
    impressions: number
    reach: number
    frequency: number
    inlineLinkClicks: number
    ctr: number
    cpc: number
    cpm: number
    addToCart: number
    initiateCheckout: number
    landingPageView: number
    video3s: number
    thruplay: number
    primaryKpiValue: number | null
    primaryKpiDisplay: string | null
    primaryKpiStatus: 'good' | 'watch' | 'bad' | 'neutral'
    objectiveResult: {
      key: string
      label: string
      value: number | null
      source: 'goal_selected_metric' | 'objective_proxy'
    }
    returnCoverage: 'complete' | 'partial' | 'none' | 'not_applicable'
    returnBasis: ToolImpactReturnBasis
    returnNature: ToolImpactReturnNature
  }>
}

/** Founder-facing, auditable evidence for campaigns Meridian owns. */
export interface ToolImpactOverview {
  tenantId: string
  generatedAt: string

  scope: {
    requested: ToolImpactScope
    includedSources: Array<'agent' | 'human'>
    label: string
    cohortRule: string
  }
  methodology: {
    version: 'attributed_action_value_roas_v1'
    headlineMetric: 'attributed_action_value_roas'
    revenueLabel: string
    actionValueRoasFormula: 'sum(attributedReturn) / sum(adSpend)'
    returnSurplusFormula: 'sum(attributedReturn) - sum(adSpend)'
    thresholdRule: 'weighted attributed-action-value ROAS >= 1.0x'
    verifiedLaunchRule: string
    maturityRule: string
    metricsWindow: 'campaign-lifetime'
    warnings: string[]
  }
  cohort: ToolImpactCohortStageCounts & {
    maturityDays: number
    bySource: {
      agent: ToolImpactCohortStageCounts
      human: ToolImpactCohortStageCounts
    }
    ownershipEvidence: {
      persistedAgentSource: number
      persistedHumanSource: number
      legacyAgentName: number
    }
    exclusions: Array<{
      code:
        | 'manual_source'
        | 'manual_source_name_coincidence'
        | 'unrecognized_source'
        | 'human_outside_agent_scope'
        | 'missing_meta_campaign_id'
        | 'missing_launched_at'
        | 'zero_spend'
        | 'not_mature'
      stage: 'scope' | 'verified_launch' | 'with_spend' | 'mature'
      count: number
      description: string
    }>
    /** Complete selected-source evidence ledger, including unverified records. */
    campaigns: DashboardCampaignRow[]
  }
  freshness: {
    latestMetricsAt: string | null
    oldestMetricsAt: string | null
    campaignsWithKnownFreshness: number
    campaignsWithoutFreshness: number
    staleCampaigns: number
    staleAfterHours: number
    status: 'fresh' | 'partially_stale' | 'unknown'
  }

  economics: DashboardEconomics

  dailyPerformance: ToolImpactDailyPerformance

  automation: {
    pipelineRuns: {
      total: number
      completed: number
      failed: number
      inProgress: number
      completionRatePct: number
      failureRatePct: number
    }
    timeToApprovalReady: ToolImpactDurationStats
    timeToLive: ToolImpactDurationStats
    cyclesRun: number
    cyclesCompleted: number
    cyclesFailed: number
    campaignsWatched: number
    lastCycleAt: string | null
    cadenceLabel: string
  }

  diagnosis: {
    decisionsProposed: number
    decisionFunnel: {
      proposed: number
      open: number
      approved: number
      rejected: number
      expired: number
      executed: number
      executionFailed: number
    }
    byStatus: Record<
      'shadow_review' | 'approved' | 'rejected' | 'expired',
      number
    >
    byActionType: Array<{ actionType: string; count: number }>
    modelEstimates: {
      label: 'Model estimate — not realized return'
      openDecisionsWithEstimate: number
      highestExpectedProfitDeltaINR7d: number | null
      areSummed: false
      notSummedReason: string
    }
    observedOutcomes: {
      label: 'Observed post-action outcomes — not causal proof'
      recorded: number
      awaiting24h: number
      measured24h: number
      finalized72h: number
      conclusive72h: number
      byLabel: Record<
        'improved' | 'worsened' | 'neutral' | 'inconclusive',
        number
      >
      improvedRatePct: number | null
      latestExecutedAt: string | null
    }
    examples: Array<{
      campaignName: string
      actionType: string
      reasoning: string
      expectedProfitDeltaINR7d: number
      isModelEstimate: true
      status: string
    }>
  }

  launched: {
    totalCampaigns: number
    byStatus: Record<string, number>
    withSpend: number
    portfolio: PortfolioRollup
    topWinner: DashboardCampaignRow | null
    mature: number
    rawOutcome: ToolImpactRawOutcome
    matureRawOutcome: ToolImpactRawOutcome
    /** Highest raw return surplus among verified sales launches with spend. */
    bestRawResult: DashboardCampaignRow | null
    campaigns: DashboardCampaignRow[]
  }
}

export interface DashboardOverview {
  tenantId: string
  companyName: string | null
  industry: string | null
  generatedAt: string

  window: {
    days: number
    from: string
    to: string
    label: string
    metricsSource: 'timeseries' | 'partial-timeseries' | 'campaign-lifetime'
    coverage: {
      status: 'complete' | 'partial' | 'unavailable'
      eligibleCampaigns: number
      campaignsWithRows: number
      campaignsWithoutRows: number
    }
  }

  economics: DashboardEconomics

  portfolio: PortfolioRollup
  lifetime: WindowMetrics & { isProfitable: boolean }
  previous: WindowMetrics | null
  trend: TrendDelta | null

  alerts: DashboardAlert[]
  campaigns: DashboardCampaignRow[]

  facets: {
    byProduct: FacetRollup[]
    byFunnel: FacetRollup[]
    byBudgetModel: FacetRollup[]
    byLanguage: FacetRollup[]
    byObjective: FacetRollup[]
  }

  insights: DashboardInsight[]
  activity: TenantActivity
}
